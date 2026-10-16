import type { JournalDB } from './schema';
import type { Entry, Priority, SyncMeta, SyncTable, TaskStatus } from '../domain/types';
import { uuid } from '../domain/uuid';
import { seedCategories } from './seed';

/**
 * Єдина точка запису сутностей, що синхронізуються.
 * Кожна зміна отримує updatedAt, deviceId і новий localSeq — це потрібно для синхро.
 */

let deviceId = 'unknown';

export function currentDeviceId(): string {
  return deviceId;
}

export async function getSetting<T>(db: JournalDB, key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(db: JournalDB, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Повертає наступний localSeq. Викликати лише всередині rw-транзакції, що включає settings. */
async function nextSeq(db: JournalDB): Promise<number> {
  const cur = await getSetting<number>(db, 'seq', 0);
  await db.settings.put({ key: 'seq', value: cur + 1 });
  return cur + 1;
}

function guessDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/.test(ua)) return 'Айфон';
  if (/iPad/.test(ua)) return 'Айпад';
  if (/Android/.test(ua)) return 'Андроїд';
  if (/Windows/.test(ua)) return 'Ноут Win';
  if (/Mac/.test(ua)) return 'Мак';
  return 'Пристрій';
}

export async function ensureDevice(db: JournalDB): Promise<{ deviceId: string; deviceName: string }> {
  let id = await getSetting<string | null>(db, 'deviceId', null);
  let name = await getSetting<string | null>(db, 'deviceName', null);
  if (!id) {
    id = uuid();
    await setSetting(db, 'deviceId', id);
  }
  if (!name) {
    name = guessDeviceName();
    await setSetting(db, 'deviceName', name);
  }
  deviceId = id;
  return { deviceId: id, deviceName: name };
}

/** Seed виконується один раз на пристрій. Якщо потім видалити категорії — вони не повернуться. */
export async function ensureSeeded(db: JournalDB): Promise<void> {
  await db.transaction('rw', db.categories, db.settings, async () => {
    if (await getSetting(db, 'seeded', false)) return;
    for (const c of seedCategories()) {
      const existing = await db.categories.get(c.id);
      if (!existing) await db.categories.put({ ...c, localSeq: await nextSeq(db) });
    }
    await setSetting(db, 'seeded', true);
  });
}

/** Записати сутність як локальну зміну. */
export async function putSynced<T extends SyncMeta>(db: JournalDB, table: SyncTable, obj: T): Promise<T> {
  const t = db.table(table);
  return db.transaction('rw', t, db.settings, async () => {
    const rec = { ...obj, updatedAt: Date.now(), deviceId, localSeq: await nextSeq(db) };
    await t.put(rec);
    return rec;
  });
}

/** Записати сутність, отриману ззовні (імпорт/синхро): метадані автора зберігаються, localSeq — новий. */
export async function putIncoming<T extends SyncMeta>(db: JournalDB, table: SyncTable, obj: T): Promise<void> {
  await db.table(table).put({ ...obj, localSeq: await nextSeq(db) });
}

export interface NewEntryInput {
  categoryId: string;
  text: string;
  tags?: string[];
  fields?: Record<string, unknown>;
  eventAt?: number;
  isTask?: boolean;
  dueAt?: number;
  priority?: Priority;
}

export async function createEntry(db: JournalDB, input: NewEntryInput): Promise<Entry> {
  const now = Date.now();
  const e: Entry = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    deviceId,
    eventAt: input.eventAt ?? now,
    categoryId: input.categoryId,
    text: input.text.trim(),
    tags: cleanTags(input.tags ?? []),
    fields: input.fields ?? {},
    isTask: Boolean(input.isTask),
    status: 'open',
  };
  if (input.isTask && input.dueAt) e.dueAt = input.dueAt;
  if (input.isTask && input.priority) e.priority = input.priority;
  return putSynced(db, 'entries', e);
}

export async function updateEntry(db: JournalDB, id: string, patch: Partial<Entry>): Promise<Entry | undefined> {
  const cur = await db.entries.get(id);
  if (!cur) return undefined;
  const next: Entry = { ...cur, ...patch };
  if (patch.tags) next.tags = cleanTags(patch.tags);
  for (const k of Object.keys(next) as (keyof Entry)[]) if (next[k] === undefined) delete next[k];
  return putSynced(db, 'entries', next);
}

export async function softDeleteEntry(db: JournalDB, id: string): Promise<void> {
  await updateEntry(db, id, { deletedAt: Date.now() });
}

export async function restoreEntry(db: JournalDB, id: string): Promise<void> {
  await updateEntry(db, id, { deletedAt: undefined });
}

export async function setTaskStatus(db: JournalDB, id: string, status: TaskStatus, closeNote?: string): Promise<void> {
  if (status === 'open') {
    await updateEntry(db, id, { status, closedAt: undefined, closeNote: undefined });
  } else {
    await updateEntry(db, id, { status, closedAt: Date.now(), closeNote: closeNote?.trim() || undefined });
  }
}

export async function makeTask(db: JournalDB, id: string): Promise<void> {
  await updateEntry(db, id, { isTask: true, status: 'open', closedAt: undefined, closeNote: undefined });
}

export function cleanTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().replace(/^#/, '').toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function parseTags(s: string): string[] {
  return cleanTags(s.split(/[,\s]+/));
}
