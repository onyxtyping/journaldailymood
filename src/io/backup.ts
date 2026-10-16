import type { JournalDB } from '../db/schema';
import { SCHEMA_VERSION } from '../db/schema';
import { normalizeCategory, normalizeEntry, normalizeNamed } from '../db/normalize';
import { getSetting, putIncoming } from '../db/repo';
import { SYNC_TABLES, type SyncMeta, type SyncTable } from '../domain/types';

export const BACKUP_FORMAT = 'journal-backup';
export const BACKUP_EXT = '.journal-backup';

/** Налаштування, що належать саме цьому пристрою: не експортуються і не перезаписуються імпортом. */
export const DEVICE_LOCAL_KEYS = new Set(['deviceId', 'deviceName', 'seq', 'seeded', 'persisted', 'lastBackupAt']);

export type BackupData = Record<SyncTable, SyncMeta[]> & { settings: Record<string, unknown> };

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: number;
  deviceId: string;
  deviceName: string;
  data: BackupData;
}

export class BackupError extends Error {
  constructor(
    public code: 'not-json' | 'wrong-format' | 'too-new' | 'bad-version' | 'no-migration',
    message?: string,
  ) {
    super(message ?? code);
  }
}

function strip<T extends SyncMeta>(r: T): T {
  const { localSeq: _ignored, ...rest } = r;
  return rest as T;
}

export async function exportBackup(db: JournalDB): Promise<BackupFile> {
  const data = { settings: {} } as BackupData;
  for (const t of SYNC_TABLES) {
    data[t] = ((await db.table(t).toArray()) as SyncMeta[]).map(strip);
  }
  for (const row of await db.settings.toArray()) {
    if (!DEVICE_LOCAL_KEYS.has(row.key)) data.settings[row.key] = row.value;
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    deviceId: await getSetting(db, 'deviceId', 'unknown'),
    deviceName: await getSetting(db, 'deviceName', ''),
    data,
  };
}

export function serializeBackup(b: BackupFile): string {
  return JSON.stringify(b);
}

/**
 * Міграції формату бекапу: ключ — версія, З ЯКОЇ мігруємо (n → n+1).
 * Кожна зміна схеми БД, що змінює форму даних, додає сюди крок і тест.
 */
export type BackupMigration = (data: any) => any;
export const BACKUP_MIGRATIONS: Record<number, BackupMigration> = {};

export function migrateBackup(raw: any, migrations: Record<number, BackupMigration> = BACKUP_MIGRATIONS, target = SCHEMA_VERSION): any {
  let v = raw.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new BackupError('bad-version');
  if (v > target) throw new BackupError('too-new');
  let data = raw.data;
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new BackupError('no-migration', `немає міграції з версії ${v}`);
    data = step(data);
    v++;
  }
  return { ...raw, schemaVersion: v, data };
}

function normalizeData(data: any): BackupData {
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  const valid = (r: any) => r && typeof r === 'object' && r.id != null;
  return {
    entries: arr(data?.entries).filter(valid).map(normalizeEntry),
    categories: arr(data?.categories).filter(valid).map(normalizeCategory),
    people: arr(data?.people).filter(valid).map(normalizeNamed),
    vehicles: arr(data?.vehicles).filter(valid).map(normalizeNamed),
    items: arr(data?.items).filter(valid).map(normalizeNamed),
    locations: arr(data?.locations).filter(valid).map(normalizeNamed),
    settings: data?.settings && typeof data.settings === 'object' ? data.settings : {},
  };
}

export function parseBackup(text: string, migrations?: Record<number, BackupMigration>, target?: number): BackupFile {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('not-json');
  }
  if (!raw || raw.format !== BACKUP_FORMAT) throw new BackupError('wrong-format');
  const m = migrateBackup(raw, migrations, target);
  return { ...m, data: normalizeData(m.data) };
}

export type MergeDecision = 'add' | 'update' | 'skip';

/** Злиття за id: перемагає новіший updatedAt. Tombstone — звичайна зміна з новішим updatedAt. */
export function mergeDecision(local: SyncMeta | undefined, incoming: SyncMeta): MergeDecision {
  if (!local) return 'add';
  return incoming.updatedAt > local.updatedAt ? 'update' : 'skip';
}

export interface ImportReport {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export async function importBackup(db: JournalDB, file: BackupFile, mode: 'merge' | 'replace'): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, deleted: 0, skipped: 0 };
  const tables = [...SYNC_TABLES.map((t) => db.table(t)), db.settings, db.peers];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const t of SYNC_TABLES) await db.table(t).clear();
      // Після повної заміни стан синхро з іншими пристроями недійсний.
      await db.peers.clear();
      for (const key of (await db.settings.toCollection().primaryKeys()) as string[]) {
        if (!DEVICE_LOCAL_KEYS.has(key)) await db.settings.delete(key);
      }
    }
    for (const t of SYNC_TABLES) {
      for (const rec of file.data[t]) {
        const local = mode === 'replace' ? undefined : ((await db.table(t).get(rec.id)) as SyncMeta | undefined);
        const d = mergeDecision(local, rec);
        if (d === 'skip') {
          report.skipped++;
          continue;
        }
        await putIncoming(db, t, rec);
        if (rec.deletedAt && !local?.deletedAt) report.deleted++;
        else if (d === 'add') report.added++;
        else report.updated++;
      }
    }
    if (mode === 'replace') {
      for (const [key, value] of Object.entries(file.data.settings)) {
        if (!DEVICE_LOCAL_KEYS.has(key)) await db.settings.put({ key, value });
      }
    }
  });
  return report;
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `journal-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${BACKUP_EXT}`;
}
