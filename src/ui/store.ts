import { computed, effect, signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { JournalDB } from '../db/schema';
import { ensureDevice, ensureSeeded, getSetting, setSetting } from '../db/repo';
import type { Category, Entry, Theme } from '../domain/types';
import { countOverdue } from '../domain/tasks';

export const db = new JournalDB();

export const ready = signal(false);
export const bootError = signal<string | null>(null);
export const entries = signal<Entry[]>([]);
export const categories = signal<Category[]>([]);
export const settings = signal<Record<string, unknown>>({});

/** «Зараз», що оновлюється раз на 30 с — для прострочених задач і заголовків днів. */
export const now = signal(Date.now());

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

export type ScreenName = 'capture' | 'journal' | 'pending' | 'settings' | 'edit';
export interface Route {
  name: ScreenName;
  id?: string;
}

function parseHash(): Route {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  const known: ScreenName[] = ['capture', 'journal', 'pending', 'settings', 'edit'];
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

    liveQuery(() => db.entries.toArray()).subscribe({ next: (v) => (entries.value = v), error: console.error });
    liveQuery(() => db.categories.toArray()).subscribe({ next: (v) => (categories.value = v), error: console.error });
    liveQuery(() => db.settings.toArray()).subscribe({
      next: (rows) => (settings.value = Object.fromEntries(rows.map((r) => [r.key, r.value]))),
      error: console.error,
    });

    setInterval(() => (now.value = Date.now()), 30_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') now.value = Date.now();
    });
    ready.value = true;
  } catch (e) {
    console.error(e);
    bootError.value = String((e as Error)?.message ?? e);
  }
}

effect(() => {
  const th = theme.value;
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th === 'night' ? '#000000' : '#0e1013');
});
