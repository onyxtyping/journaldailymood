import type { Category, Entry, FieldDef, Priority, TaskStatus } from '../domain/types';

/**
 * Нормалізатори приводять запис будь-якої давнини до поточної форми:
 * відсутні поля отримують значення за замовчуванням, зайві — зберігаються.
 * Так старі записи не ламаються при зміні категорій чи полів.
 */

const STATUSES: TaskStatus[] = ['open', 'done', 'cancelled'];
const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function normalizeEntry(raw: any): Entry {
  const createdAt = num(raw.createdAt) ?? num(raw.updatedAt) ?? Date.now();
  const e: Entry = {
    ...raw,
    id: String(raw.id),
    createdAt,
    updatedAt: num(raw.updatedAt) ?? createdAt,
    eventAt: num(raw.eventAt) ?? createdAt,
    deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : 'unknown',
    categoryId: String(raw.categoryId ?? ''),
    text: typeof raw.text === 'string' ? raw.text : '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') : [],
    fields: raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields) ? raw.fields : {},
    isTask: Boolean(raw.isTask),
    status: STATUSES.includes(raw.status) ? raw.status : 'open',
  };
  if (num(raw.dueAt) == null) delete e.dueAt;
  if (!PRIORITIES.includes(raw.priority)) delete e.priority;
  if (num(raw.closedAt) == null) delete e.closedAt;
  if (num(raw.deletedAt) == null) delete e.deletedAt;
  return e;
}

export function normalizeFieldDef(raw: any): FieldDef {
  const f: FieldDef = {
    key: String(raw.key),
    label: String(raw.label ?? raw.key),
    type: raw.type ?? 'text',
  };
  if (raw.unit) f.unit = String(raw.unit);
  if (Array.isArray(raw.options)) f.options = raw.options.map(String);
  return f;
}

export function normalizeCategory(raw: any): Category {
  const c: Category = {
    ...raw,
    id: String(raw.id),
    updatedAt: num(raw.updatedAt) ?? Date.now(),
    deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : 'unknown',
    name: String(raw.name ?? '—'),
    emoji: String(raw.emoji ?? '•'),
    color: String(raw.color ?? '#888888'),
    group: String(raw.group ?? ''),
    order: num(raw.order) ?? 0,
    archived: Boolean(raw.archived),
    defaultIsTask: Boolean(raw.defaultIsTask),
    fieldSchema: Array.isArray(raw.fieldSchema) ? raw.fieldSchema.map(normalizeFieldDef) : [],
  };
  if (num(raw.deletedAt) == null) delete c.deletedAt;
  return c;
}

export function normalizeNamed<T extends { id: string; name: string; updatedAt: number; deviceId: string; deletedAt?: number }>(
  raw: any,
): T {
  const r = {
    ...raw,
    id: String(raw.id),
    name: String(raw.name ?? ''),
    updatedAt: num(raw.updatedAt) ?? Date.now(),
    deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : 'unknown',
  };
  if (num(raw.deletedAt) == null) delete r.deletedAt;
  return r as T;
}
