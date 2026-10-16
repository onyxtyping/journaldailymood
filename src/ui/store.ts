import { computed, effect, signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { JournalDB } from '../db/schema';
import { ensureDevice, ensureSeeded, getSetting, setSetting } from '../db/repo';
import type { Category, Entry, Item, Location, Person, Theme, Vehicle } from '../domain/types';
import { countOverdue } from '../domain/tasks';
import { DEFAULT_CHECKPOINTS, dueCheckpoint } from '../domain/checkpoints';
import { dayKey } from '../domain/time';

export const db = new JournalDB();

export const ready = signal(false);
export const bootError = signal<string | null>(null);
export const entries = signal<Entry[]>([]);
export const categories = signal<Category[]>([]);
export const settings = signal<Record<string, unknown>>({});

/** «Зараз», що оновлюється раз на 30 с — для прострочених задач і заголовків днів. */
export const now = signal(Date.now());

export const people = signal<Person[]>([]);
export const vehicles = signal<Vehicle[]>([]);
export const items = signal<Item[]>([]);
export const locations = signal<Location[]>([]);
export const directories = { people, vehicles, items, locations } as const;

export const liveEntries = computed(() => entries.value.filter((e) => !e.deletedAt));
export const catMap = computed(() => new Map(categories.value.map((c) => [c.id, c])));
export const activeCategories = computed(() =>
  categories.value.filter((c) => !c.archived && !c.deletedAt).sort((a, b) => a.order - b.order),
);
export const overdueCount = computed(() => countOverdue(entries.value, now.value));
export const theme = computed<Theme>(() => (settings.value.theme === 'night' ? 'night' : 'dark'));

export function setting<T>(key: string, fallback: T): T {
  const v = settings.value[key];
  return v === undefined ? fallback : (v as T);
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await setSetting(db, key, value);
}

export async function toggleTheme(): Promise<void> {
  await saveSetting('theme', theme.value === 'night' ? 'dark' : 'night');
}

/* ---------- Тости ---------- */

export interface Toast {
  id: number;
  msg: string;
  action?: { label: string; run: () => void };
}
export const toast = signal<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

export function showToast(msg: string, action?: Toast['action'], ms = action ? 5000 : 1800): void {
  clearTimeout(toastTimer);
  toast.value = { id: ++toastSeq, msg, action };
  toastTimer = setTimeout(() => (toast.value = null), ms);
}

/* ---------- Маршрутизація (hash) ---------- */

export type ScreenName =
  | 'capture'
  | 'journal'
  | 'pending'
  | 'today'
  | 'report'
  | 'settings'
  | 'edit'
  | 'checkpoint'
  | 'categories'
  | 'category'
  | 'directory';
export interface Route {
  name: ScreenName;
  id?: string;
}

const KNOWN: ScreenName[] = ['capture', 'journal', 'pending', 'today', 'report', 'settings', 'edit', 'checkpoint', 'categories', 'category', 'directory'];

function parseHash(): Route {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  const known = KNOWN;
  return known.includes(name as ScreenName) ? { name: name as ScreenName, id } : { name: 'capture' };
}

export const route = signal<Route>(parseHash());
window.addEventListener('hashchange', () => (route.value = parseHash()));

export function go(name: ScreenName, id?: string): void {
  const h = `#/${name}${id ? `/${id}` : ''}`;
  if (location.hash !== h) location.hash = h;
}

export function back(fallback: ScreenName = 'journal'): void {
  if (history.length > 1) history.back();
  else go(fallback);
}

/* ---------- Старт ---------- */

export async function bootstrap(): Promise<void> {
  try {
    await db.open();
    await ensureDevice(db);
    await ensureSeeded(db);

    // Persistent storage: просимо один раз при першому запуску, результат показуємо в налаштуваннях.
    if (navigator.storage?.persisted) {
      let persisted = await navigator.storage.persisted();
      const asked = await getSetting(db, 'persistAsked', false);
      if (!persisted && !asked && navigator.storage.persist) {
        persisted = await navigator.storage.persist();
        await setSetting(db, 'persistAsked', true);
      }
      await setSetting(db, 'persisted', persisted);
    }

    // Перший запуск: не показувати чекпоінт і «Сьогодні» одразу після встановлення.
    if ((await getSetting(db, 'lastCheckpointAt', null)) == null) {
      await setSetting(db, 'lastCheckpointAt', Date.now());
      await setSetting(db, 'lastTodayShownDay', dayKey(Date.now()));
    }

    liveQuery(() => db.entries.toArray()).subscribe({ next: (v) => (entries.value = v), error: console.error });
    for (const [table, sig] of Object.entries(directories)) {
      liveQuery(() => db.table(table).toArray()).subscribe({
        next: (v) => (sig.value = v.filter((r: { deletedAt?: number }) => !r.deletedAt).sort((a: any, b: any) => a.name.localeCompare(b.name, 'uk'))),
        error: console.error,
      });
    }
    liveQuery(() => db.categories.toArray()).subscribe({ next: (v) => (categories.value = v), error: console.error });
    liveQuery(() => db.settings.toArray()).subscribe({
      next: (rows) => (settings.value = Object.fromEntries(rows.map((r) => [r.key, r.value]))),
      error: console.error,
    });

    setInterval(() => (now.value = Date.now()), 30_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        now.value = Date.now();
        void autoScreens();
      }
    });
    ready.value = true;
    await autoScreens();
  } catch (e) {
    console.error(e);
    bootError.value = String((e as Error)?.message ?? e);
  }
}

/* ---------- Чекпоінти та «Сьогодні» при відкритті ---------- */

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el?.matches?.('input, textarea, select, [contenteditable]');
}

/** При відкритті: спершу чекпоінт (якщо настав), інакше — «Сьогодні» один раз на день. */
export async function autoScreens(): Promise<void> {
  // Не перебиваємо набір тексту і незбережене редагування.
  if (isTyping() || ['checkpoint', 'edit', 'category'].includes(route.value.name)) return;
  const t = Date.now();
  const times = await getSetting<string[]>(db, 'checkpointTimes', DEFAULT_CHECKPOINTS);
  const last = await getSetting<number | undefined>(db, 'lastCheckpointAt', undefined);
  if (dueCheckpoint(t, times, last)) {
    go('checkpoint');
    return;
  }
  await showTodayOncePerDay();
}

export async function showTodayOncePerDay(): Promise<boolean> {
  const key = dayKey(Date.now());
  if ((await getSetting(db, 'lastTodayShownDay', '')) === key) return false;
  await setSetting(db, 'lastTodayShownDay', key);
  go('today');
  return true;
}

export async function finishCheckpoint(): Promise<void> {
  await setSetting(db, 'lastCheckpointAt', Date.now());
  if (!(await showTodayOncePerDay())) go('capture');
}

effect(() => {
  const th = theme.value;
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th === 'night' ? '#000000' : '#0e1013');
});
