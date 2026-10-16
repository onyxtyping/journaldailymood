import Dexie, { type Table, type Transaction } from 'dexie';
import { v2AddSeedKind } from './migrations';
import type { Category, Entry, HistoryRecord, Item, Location, Peer, Person, SettingRow, Vehicle } from '../domain/types';

export const DB_NAME = 'journal';

/**
 * Версії схеми IndexedDB. Правила:
 *  - існуючі версії НІКОЛИ не редагуються, лише додаються нові;
 *  - кожна нова версія з upgrade() має тест у tests/migrations.test.ts;
 *  - SCHEMA_VERSION = остання версія; вона ж пишеться в бекапи.
 */
export interface DbVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => unknown;
}

export const DB_VERSIONS: DbVersion[] = [
  {
    version: 1,
    stores: {
      entries: 'id, eventAt, createdAt, categoryId, status, updatedAt, localSeq, deletedAt, *tags',
      categories: 'id, order, localSeq',
      people: 'id, name, localSeq',
      vehicles: 'id, name, localSeq',
      items: 'id, name, localSeq',
      locations: 'id, name, localSeq',
      history: 'id, entityId, savedAt',
      peers: 'deviceId',
      settings: 'key',
    },
  },
  {
    // Ролі категорій для підсумків. Індекси не змінюються.
    version: 2,
    stores: {},
    upgrade: (tx) =>
      tx
        .table('categories')
        .toCollection()
        .modify((c: any) => {
          const next = v2AddSeedKind(c);
          if (next.kind) c.kind = next.kind;
        }),
  },
];

export const SCHEMA_VERSION = DB_VERSIONS[DB_VERSIONS.length - 1].version;

export class JournalDB extends Dexie {
  entries!: Table<Entry, string>;
  categories!: Table<Category, string>;
  people!: Table<Person, string>;
  vehicles!: Table<Vehicle, string>;
  items!: Table<Item, string>;
  locations!: Table<Location, string>;
  history!: Table<HistoryRecord, string>;
  peers!: Table<Peer, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = DB_NAME, versions = DB_VERSIONS) {
    super(name);
    for (const v of versions) {
      const s = this.version(v.version).stores(v.stores);
      const up = v.upgrade;
      if (up) s.upgrade(async (tx) => void (await up(tx)));
    }
  }
}
