import { describe, expect, it } from 'vitest';
import { DB_VERSIONS, JournalDB, SCHEMA_VERSION } from '../src/db/schema';
import { normalizeCategory, normalizeEntry } from '../src/db/normalize';
import { BackupError, migrateBackup, parseBackup } from '../src/io/backup';
import { seedCategories, seedId } from '../src/db/seed';
import { freshDb } from './helpers';

describe('схема IndexedDB', () => {
  it('відкривається на поточній версії з усіма таблицями', async () => {
    const db = freshDb();
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    for (const t of ['entries', 'categories', 'people', 'vehicles', 'items', 'locations', 'history', 'peers', 'settings']) {
      expect(db.tables.map((x) => x.name)).toContain(t);
    }
    db.close();
  });

  it('версії йдуть строго за зростанням', () => {
    const v = DB_VERSIONS.map((x) => x.version);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(new Set(v).size).toBe(v.length);
  });

  it('механізм upgrade: дані зі старої версії переживають міграцію', async () => {
    // Шаблон для майбутніх міграцій: стара БД → нова версія з upgrade().
    const name = `mig-${Date.now()}`;
    const old = new JournalDB(name, DB_VERSIONS);
    await old.entries.put(normalizeEntry({ id: 'x', text: 'старий', categoryId: 'c', createdAt: 1 }));
    old.close();

    const next = new JournalDB(name, [
      ...DB_VERSIONS,
      {
        version: SCHEMA_VERSION + 1,
        stores: {},
        upgrade: (tx) =>
          tx
            .table('entries')
            .toCollection()
            .modify((e: any) => {
              e.fields = { ...e.fields, migrated: true };
            }),
      },
    ]);
    const e = await next.entries.get('x');
    expect(e?.text).toBe('старий');
    expect(e?.fields).toEqual({ migrated: true });
    next.close();
  });
});

describe('міграція v1 → v2 (ролі категорій)', () => {
  it('Dexie: seed-категорії отримують kind, власні й уже задані — без змін', async () => {
    const name = `v2-${Date.now()}`;
    const v1 = new JournalDB(name, DB_VERSIONS.slice(0, 1));
    const fuel = { ...seedCategories()[15] } as any;
    delete fuel.kind;
    await v1.categories.bulkPut([
      fuel,
      normalizeCategory({ id: 'custom', name: 'Своя' }),
      normalizeCategory({ id: seedId(6), name: 'Змінена', kind: 'trip' }),
    ]);
    v1.close();

    const v2 = new JournalDB(name, DB_VERSIONS.slice(0, 2));
    expect((await v2.categories.get(seedId(16)))?.kind).toBe('fuel');
    expect((await v2.categories.get('custom'))?.kind).toBeUndefined();
    expect((await v2.categories.get(seedId(6)))?.kind).toBe('trip');
    v2.close();
  });

  it('бекап версії 1 імпортується з ролями категорій', () => {
    const f = parseBackup(
      JSON.stringify({
        format: 'journal-backup',
        schemaVersion: 1,
        exportedAt: 1,
        deviceId: 'd',
        deviceName: '',
        data: { categories: [{ id: seedId(18), name: 'Майно отримано' }], entries: [] },
      }),
    );
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.data.categories[0]).toMatchObject({ id: seedId(18), kind: 'propIn' });
  });
});

describe('міграції формату бекапу', () => {
  const raw = { format: 'journal-backup', schemaVersion: 1, data: { entries: [{ id: 'a', text: 'x' }] } };

  it('проганяє ланцюжок кроків n → n+1', () => {
    const out = migrateBackup(
      raw,
      {
        1: (d) => ({ ...d, entries: d.entries.map((e: any) => ({ ...e, v2: true })) }),
        2: (d) => ({ ...d, entries: d.entries.map((e: any) => ({ ...e, v3: true })) }),
      },
      3,
    );
    expect(out.schemaVersion).toBe(3);
    expect(out.data.entries[0]).toMatchObject({ id: 'a', v2: true, v3: true });
  });

  it('поточна версія — без змін', () => {
    expect(migrateBackup(raw, {}, 1).data).toBe(raw.data);
  });

  it('новіша версія ніж застосунок — помилка too-new', () => {
    expect(() => migrateBackup({ ...raw, schemaVersion: 99 }, {}, 1)).toThrow(BackupError);
    try {
      migrateBackup({ ...raw, schemaVersion: 99 }, {}, 1);
    } catch (e) {
      expect((e as BackupError).code).toBe('too-new');
    }
  });

  it('відсутній крок — помилка no-migration', () => {
    expect(() => migrateBackup(raw, {}, 2)).toThrow(/версії 1/);
  });

  it('некоректна версія', () => {
    expect(() => migrateBackup({ ...raw, schemaVersion: '1' }, {}, 1)).toThrow(BackupError);
  });
});

describe('нормалізація старих записів', () => {
  it('заповнює відсутні поля значеннями за замовчуванням і зберігає невідомі', () => {
    const e = normalizeEntry({ id: 7, createdAt: 1000, categoryId: 'c', text: 'x', legacy: 'keep', status: 'weird', priority: 'urgent' });
    expect(e).toMatchObject({
      id: '7',
      createdAt: 1000,
      updatedAt: 1000,
      eventAt: 1000,
      tags: [],
      fields: {},
      isTask: false,
      status: 'open',
      legacy: 'keep',
    });
    expect(e.priority).toBeUndefined();
  });

  it('категорія без схеми полів', () => {
    const c = normalizeCategory({ id: 'c', name: 'Стара' });
    expect(c.fieldSchema).toEqual([]);
    expect(c.archived).toBe(false);
  });
});
