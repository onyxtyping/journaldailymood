export type ID = string;
/** Час завжди зберігається як epoch-мілісекунди (число): зручно індексувати й порівнювати. */
export type Millis = number;

/** Поля, спільні для всіх сутностей, що синхронізуються між пристроями. */
export interface SyncMeta {
  id: ID;
  updatedAt: Millis;
  /** Пристрій, на якому сутність змінено востаннє. */
  deviceId: string;
  /** Tombstone. Запис фізично не видаляється, доки tombstone не синхронізовано. */
  deletedAt?: Millis;
  /** Локальний лічильник змін (для інкрементальної синхро). У файли не експортується. */
  localSeq?: number;
}

export type TaskStatus = 'open' | 'done' | 'cancelled';
export type Priority = 'low' | 'normal' | 'high';

export interface Entry extends SyncMeta {
  createdAt: Millis;
  eventAt: Millis;
  categoryId: ID;
  text: string;
  tags: string[];
  fields: Record<string, unknown>;
  isTask: boolean;
  status: TaskStatus;
  dueAt?: Millis;
  priority?: Priority;
  closedAt?: Millis;
  closeNote?: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'person' | 'vehicle' | 'item' | 'location';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
}

export interface Category extends SyncMeta {
  name: string;
  emoji: string;
  color: string;
  group: string;
  order: number;
  archived: boolean;
  defaultIsTask: boolean;
  fieldSchema: FieldDef[];
}

export interface Person extends SyncMeta {
  name: string;
  role?: string;
}
export interface Vehicle extends SyncMeta {
  name: string;
  plate?: string;
}
export interface Item extends SyncMeta {
  name: string;
  serial?: string;
}
export interface Location extends SyncMeta {
  name: string;
}

/** Стара версія сутності, збережена після конфлікту синхро. */
export interface HistoryRecord {
  id: ID;
  table: SyncTable;
  entityId: ID;
  savedAt: Millis;
  reason: 'conflict' | 'import';
  data: unknown;
}

/** Стан синхронізації з іншим пристроєм. */
export interface Peer {
  deviceId: string;
  name: string;
  /** Наш localSeq, до якого включно зміни вже відправлено цьому пристрою. */
  sentSeq: number;
  lastSentAt?: Millis;
  lastReceivedAt?: Millis;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export const SYNC_TABLES = ['entries', 'categories', 'people', 'vehicles', 'items', 'locations'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export type Theme = 'dark' | 'night';
