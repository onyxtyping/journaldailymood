import { describe, expect, it } from 'vitest';
import { createEntry, ensureDevice, ensureSeeded, setSetting, softDeleteEntry, updateEntry } from '../src/db/repo';
import { exportBackup, importBackup, mergeDecision, parseBackup, serializeBackup, BackupError } from '../src/io/backup';
import { freshDb } from './helpers';

async function setup() {
  const db = freshDb();
  await ensureDevice(db);
  await ensureSeeded(db);
  return db;
}

const strip = (rows: any[]) => rows.map(({ localSeq: _s, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));

describe('mergeDecision', () => {
  it('новіший updatedAt перемагає, рівний — без змін', () => {
    expect(mergeDecision(undefined, { id: 'a', updatedAt: 1, deviceId: 'x' })).toBe('add');
    expect(mergeDecision({ id: 'a', updatedAt: 1, deviceId: 'x' }, { id: 'a', updatedAt: 2, deviceId: 'y' })).toBe('update');
    expect(mergeDecision({ id: 'a', updatedAt: 2, deviceId: 'x' }, { id: 'a', updatedAt: 1, deviceId: 'y' })).toBe('skip');
    expect(mergeDecision({ id: 'a', updatedAt: 2, deviceId: 'x' }, { id: 'a', updatedAt: 2, deviceId: 'y' })).toBe('skip');
  });
});

describe('бекап: експорт → імпорт', () => {
  it('повний цикл «замінити все» відтворює дані', async () => {
    const src = await setup();
    const cat = (await src.categories.toArray())[0];
    await createEntry(src, { categoryId: cat.id, text: 'Перший', tags: ['a'] });
    const e2 = await createEntry(src, { categoryId: cat.id, text: 'Задача', isTask: true, dueAt: 123, priority: 'high' });
    await softDeleteEntry(src, e2.id);
    await setSetting(src, 'theme', 'night');

    const text = serializeBackup(await exportBackup(src));
    expect(text).not.toContain('localSeq');

    const dst = await setup();
    await createEntry(dst, { categoryId: cat.id, text: 'Буде стерто' });
    await setSetting(dst, 'deviceName', 'Ноут');
    const report = await importBackup(dst, parseBackup(text), 'replace');

    expect(strip(await dst.entries.toArray())).toEqual(strip(await src.entries.toArray()));
    expect(strip(await dst.categories.toArray())).toEqual(strip(await src.categories.toArray()));
    expect(report.added).toBeGreaterThan(0);
    expect(report.deleted).toBe(1);
    // Налаштування переносяться, але локальні для пристрою — ні.
    expect((await dst.settings.get('theme'))?.value).toBe('night');
    expect((await dst.settings.get('deviceName'))?.value).toBe('Ноут');
    expect((await dst.settings.get('deviceId'))?.value).not.toBe((await src.settings.get('deviceId'))?.value);
  });

  it('«злити за id»: нове додається, новіше оновлює, старіше пропускається, tombstone застосовується', async () => {
    const a = await setup();
    const cat = (await a.categories.toArray())[0];
    const keep = await createEntry(a, { categoryId: cat.id, text: 'спільний' });
    const del = await createEntry(a, { categoryId: cat.id, text: 'буде видалено' });
    const base = serializeBackup(await exportBackup(a));

    const b = await setup();
    await importBackup(b, parseBackup(base), 'merge');

    // На A: видалили один і додали новий; на B: змінили спільний пізніше.
    await softDeleteEntry(a, del.id);
    await createEntry(a, { categoryId: cat.id, text: 'новий з A' });
    await new Promise((r) => setTimeout(r, 5));
    await updateEntry(b, keep.id, { text: 'змінено на B' });

    const fromA = parseBackup(serializeBackup(await exportBackup(a)));
    const r = await importBackup(b, fromA, 'merge');

    expect(r.added).toBe(1);
    expect(r.deleted).toBe(1);
    expect((await b.entries.get(keep.id))?.text).toBe('змінено на B');
    expect((await b.entries.get(del.id))?.deletedAt).toBeTypeOf('number');
    expect(await b.entries.count()).toBe(3);
  });

  it('повторний імпорт того самого файлу нічого не змінює (ідемпотентність)', async () => {
    const a = await setup();
    const cat = (await a.categories.toArray())[0];
    await createEntry(a, { categoryId: cat.id, text: 'x' });
    const file = parseBackup(serializeBackup(await exportBackup(a)));

    const b = await setup();
    await importBackup(b, file, 'merge');
    const snapshot = strip(await b.entries.toArray());
    const r2 = await importBackup(b, file, 'merge');
    expect(r2.added + r2.updated + r2.deleted).toBe(0);
    expect(strip(await b.entries.toArray())).toEqual(snapshot);
  });

  it('відхиляє чужі й пошкоджені файли', () => {
    expect(() => parseBackup('не json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"other"}')).toThrow(BackupError);
  });

  it('пропускає сміттєві записи без id і нормалізує решту', () => {
    const f = parseBackup(
      JSON.stringify({
        format: 'journal-backup',
        schemaVersion: 1,
        exportedAt: 1,
        deviceId: 'd',
        deviceName: '',
        data: { entries: [{ id: 'ok', text: 't', createdAt: 5 }, { text: 'без id' }, null] },
      }),
    );
    expect(f.data.entries).toHaveLength(1);
    expect(f.data.entries[0]).toMatchObject({ id: 'ok', tags: [], eventAt: 5 });
    expect(f.data.categories).toEqual([]);
  });
});
