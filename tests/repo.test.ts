import { describe, expect, it } from 'vitest';
import {
  cleanTags,
  createEntry,
  currentDeviceId,
  ensureDevice,
  ensureSeeded,
  makeTask,
  parseTags,
  setTaskStatus,
  softDeleteEntry,
  restoreEntry,
  rememberDirectoryValues,
  softDeleteNamed,
  addDirectoryName,
  removeCategory,
  reorderCategories,
} from '../src/db/repo';
import { seedCategories, seedId } from '../src/db/seed';
import { freshDb } from './helpers';

describe('repo', () => {
  it('кожна зміна отримує deviceId, updatedAt і зростаючий localSeq', async () => {
    const db = freshDb();
    const { deviceId } = await ensureDevice(db);
    expect(currentDeviceId()).toBe(deviceId);
    const a = await createEntry(db, { categoryId: 'c', text: '  перший  ' });
    const b = await createEntry(db, { categoryId: 'c', text: 'другий' });
    expect(a.text).toBe('перший');
    expect(a.deviceId).toBe(deviceId);
    expect(a.eventAt).toBe(a.createdAt);
    expect(b.localSeq!).toBeGreaterThan(a.localSeq!);
  });

  it('видалення — лише tombstone, запис лишається в БД', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const e = await createEntry(db, { categoryId: 'c', text: 'x' });
    await softDeleteEntry(db, e.id);
    const del = await db.entries.get(e.id);
    expect(del?.deletedAt).toBeTypeOf('number');
    expect(del!.localSeq!).toBeGreaterThan(e.localSeq!);
    await restoreEntry(db, e.id);
    expect((await db.entries.get(e.id))?.deletedAt).toBeUndefined();
  });

  it('статуси задачі: закриття з приміткою, повторне відкриття, «зробити задачею»', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const e = await createEntry(db, { categoryId: 'c', text: 'x' });
    expect(e.isTask).toBe(false);
    await makeTask(db, e.id);
    expect(await db.entries.get(e.id)).toMatchObject({ isTask: true, status: 'open' });
    await setTaskStatus(db, e.id, 'done', ' замінив АКБ ');
    expect(await db.entries.get(e.id)).toMatchObject({ status: 'done', closeNote: 'замінив АКБ' });
    expect((await db.entries.get(e.id))?.closedAt).toBeTypeOf('number');
    await setTaskStatus(db, e.id, 'open');
    const re = await db.entries.get(e.id);
    expect(re?.closedAt).toBeUndefined();
    expect(re?.closeNote).toBeUndefined();
  });

  it('dueAt і пріоритет зберігаються лише для задач', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const n = await createEntry(db, { categoryId: 'c', text: 'x', dueAt: 5, priority: 'high' });
    expect(n.dueAt).toBeUndefined();
    const t = await createEntry(db, { categoryId: 'c', text: 'x', isTask: true, dueAt: 5, priority: 'high' });
    expect(t).toMatchObject({ dueAt: 5, priority: 'high' });
  });

  it('seed: один раз, детерміновані id, не повертається після видалення', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await ensureSeeded(db);
    expect(await db.categories.count()).toBe(seedCategories().length);
    expect(await db.categories.get(seedId(1))).toBeTruthy();
    await db.categories.delete(seedId(1));
    await ensureSeeded(db);
    expect(await db.categories.get(seedId(1))).toBeUndefined();
  });

  it('довідники поповнюються з полів запису, без дублікатів, видалене відновлюється', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const cat = seedCategories().find((c) => c.kind === 'fuel')!;
    await rememberDirectoryValues(db, cat, { vehicle: ' Пікап-12 ', liters: 40 });
    await rememberDirectoryValues(db, cat, { vehicle: 'пікап-12' });
    const all = await db.vehicles.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Пікап-12');
    await softDeleteNamed(db, 'vehicles', all[0].id);
    await addDirectoryName(db, 'vehicles', 'Пікап-12');
    const back = await db.vehicles.get(all[0].id);
    expect(back?.deletedAt).toBeUndefined();
    expect(await db.vehicles.count()).toBe(1);
  });

  it('категорія з записами архівується, порожня — tombstone', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await ensureSeeded(db);
    await createEntry(db, { categoryId: seedId(1), text: 'x' });
    expect(await removeCategory(db, seedId(1))).toBe('archived');
    expect((await db.categories.get(seedId(1)))?.archived).toBe(true);
    expect(await removeCategory(db, seedId(2))).toBe('deleted');
    expect((await db.categories.get(seedId(2)))?.deletedAt).toBeTypeOf('number');
  });

  it('порядок категорій', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await ensureSeeded(db);
    await reorderCategories(db, [seedId(3), seedId(1), seedId(2)]);
    expect((await db.categories.get(seedId(3)))?.order).toBe(10);
    expect((await db.categories.get(seedId(1)))?.order).toBe(20);
  });

  it('порожні значення полів не зберігаються', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const e = await createEntry(db, { categoryId: 'c', text: 'x', fields: { a: '  ', b: ' v ', c: NaN, d: 0 } });
    expect(e.fields).toEqual({ b: 'v', d: 0 });
  });

  it('теги: без #, нижній регістр, без дублікатів', () => {
    expect(parseTags('#РРЛ, ррл  кСп')).toEqual(['ррл', 'ксп']);
    expect(cleanTags([' a ', '', 'A'])).toEqual(['a']);
  });
});
