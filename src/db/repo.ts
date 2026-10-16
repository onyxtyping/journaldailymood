import type { JournalDB } from './schema';
import type { Category, Entry, Priority, SyncMeta, SyncTable, TaskStatus } from '../domain/types';
import { DIRECTORY_OF } from '../domain/fields';
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
  e.fields = cleanFields(e.fields);
  return putSynced(db, 'entries', e);
}

export async function updateEntry(db: JournalDB, id: string, patch: Partial<Entry>): Promise<Entry | undefined> {
  const cur = await db.entries.get(id);
  if (!cur) return undefined;
  const next: Entry = { ...cur, ...patch };
  if (patch.tags) next.tags = cleanTags(patch.tags);
  if (patch.fields) next.fields = cleanFields(patch.fields);
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

/* ---------- Довідники ---------- */

export type DirectoryTable = 'people' | 'vehicles' | 'items' | 'locations';

/** Нові значення полів-довідників автоматично додаються в довідник. */
export async function rememberDirectoryValues(db: JournalDB, cat: Category | undefined, fields: Record<string, unknown>): Promise<void> {
  if (!cat) return;
  for (const def of cat.fieldSchema) {
    const table = DIRECTORY_OF[def.type];
    const raw = fields[def.key];
    if (!table || typeof raw !== 'string' || !raw.trim()) continue;
    await addDirectoryName(db, table, raw);
  }
}

export async function addDirectoryName(db: JournalDB, table: DirectoryTable, name: string, extra: Record<string, string> = {}): Promise<void> {
  const value = name.trim();
  if (!value) return;
  const low = value.toLowerCase();
  const all = (await db.table(table).toArray()) as (SyncMeta & { name: string })[];
  const existing = all.find((r) => r.name.trim().toLowerCase() === low);
  if (existing && !existing.deletedAt) return;
  // Якщо значення колись видалили, а тепер ввели знову — відновлюємо той самий запис.
  const rec = existing ? { ...existing, ...extra, name: value, deletedAt: undefined } : { id: uuid(), name: value, ...extra, updatedAt: 0, deviceId };
  if (existing) delete (rec as SyncMeta).deletedAt;
  await putSynced(db, table, rec);
}

export async function saveNamed(db: JournalDB, table: DirectoryTable, rec: SyncMeta & { name: string }): Promise<void> {
  await putSynced(db, table, { ...rec, name: rec.name.trim() });
}

export async function softDeleteNamed(db: JournalDB, table: DirectoryTable, id: string): Promise<void> {
  const cur = await db.table(table).get(id);
  if (cur) await putSynced(db, table, { ...cur, deletedAt: Date.now() });
}

/* ---------- Категорії ---------- */

export async function saveCategory(db: JournalDB, c: Category): Promise<Category> {
  return putSynced(db, 'categories', c);
}

/** Категорію з записами лише архівуємо; порожню — видаляємо через tombstone. */
export async function removeCategory(db: JournalDB, id: string): Promise<'archived' | 'deleted'> {
  const cur = await db.categories.get(id);
  if (!cur) return 'deleted';
  const used = (await db.entries.where('categoryId').equals(id).count()) > 0;
  if (used) {
    await putSynced(db, 'categories', { ...cur, archived: true });
    return 'archived';
  }
  await putSynced(db, 'categories', { ...cur, deletedAt: Date.now() });
  return 'deleted';
}

/** Новий порядок категорій: order = 10, 20, 30… Пишуться лише ті, що змінились. */
export async function reorderCategories(db: JournalDB, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const c = await db.categories.get(ids[i]);
    const order = (i + 1) * 10;
    if (c && c.order !== order) await putSynced(db, 'categories', { ...c, order });
  }
}

export function cleanTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().replace(/^#/, '').toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Прибирає порожні значення полів і зайві пробіли. */
export function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || (typeof v === 'number' && Number.isNaN(v))) continue;
    if (typeof v === 'string') {
      if (v.trim()) out[k] = v.trim();
    } else out[k] = v;
  }
  return out;
}

export function parseTags(s: string): string[] {
  return cleanTags(s.split(/[,\s]+/));
}
