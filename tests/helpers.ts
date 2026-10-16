import 'fake-indexeddb/auto';
import { JournalDB } from '../src/db/schema';
import type { Entry } from '../src/domain/types';

let n = 0;
export function freshDb(): JournalDB {
  return new JournalDB(`test-${Date.now()}-${n++}`);
}

export function mkEntry(p: Partial<Entry> = {}): Entry {
  const t = p.createdAt ?? Date.now();
  return {
    id: p.id ?? `e${n++}`,
    createdAt: t,
    updatedAt: t,
    eventAt: t,
    deviceId: 'dev-a',
    categoryId: 'cat',
    text: '',
    tags: [],
    fields: {},
    isTask: false,
    status: 'open',
    ...p,
  };
}

/** Локальна дата → мс. */
export function at(y: number, m: number, d: number, h = 0, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}
