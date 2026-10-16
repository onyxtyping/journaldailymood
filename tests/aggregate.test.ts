import { describe, expect, it } from 'vitest';
import { computeTotals, fmtDuration, fuelOp } from '../src/domain/aggregate';
import { seedCategories, seedId } from '../src/db/seed';
import { HOUR } from '../src/domain/time';
import { mkEntry } from './helpers';

const cats = new Map(seedCategories().map((c) => [c.id, c]));
const FUEL = seedId(16);
const TRIP = seedId(17);
const IN = seedId(18);
const OUT = seedId(19);
const OFF = seedId(20);
const FAULT = seedId(6);
const CAR_FAULT = seedId(14);

describe('підсумки', () => {
  it('пальне: по авто й типу, окремо отримано/видано/заправлено', () => {
    const t = computeTotals(
      [
        mkEntry({ categoryId: FUEL, fields: { operation: 'Отримано', vehicle: 'Пікап-12', fuelType: 'ДП', liters: 100 } }),
        mkEntry({ categoryId: FUEL, fields: { operation: 'Заправлено', vehicle: 'Пікап-12', fuelType: 'ДП', liters: '40,5' } }),
        mkEntry({ categoryId: FUEL, fields: { operation: 'Заправлено', vehicle: 'Пікап-12', fuelType: 'ДП', liters: 9.5 } }),
        mkEntry({ categoryId: FUEL, fields: { operation: 'Видано', vehicle: 'Бус', fuelType: 'А-95', liters: 20 } }),
        mkEntry({ categoryId: FUEL, fields: { operation: 'Заправлено', vehicle: 'Бус', fuelType: 'А-95' } }), // без літрів — ігнор
        mkEntry({ categoryId: FUEL, fields: { operation: 'Отримано', vehicle: 'Бус', fuelType: 'А-95', liters: 30 }, deletedAt: 1 }),
      ],
      cats,
    );
    expect(t.fuel).toEqual([
      { vehicle: 'Бус', fuelType: 'А-95', received: 0, issued: 20, fueled: 0, other: 0 },
      { vehicle: 'Пікап-12', fuelType: 'ДП', received: 100, issued: 0, fueled: 50, other: 0 },
    ]);
  });

  it('кілометраж по авто', () => {
    const t = computeTotals(
      [
        mkEntry({ categoryId: TRIP, fields: { vehicle: 'Пікап-12', km: 30 } }),
        mkEntry({ categoryId: TRIP, fields: { vehicle: 'Пікап-12', km: 12 } }),
        mkEntry({ categoryId: TRIP, fields: { vehicle: 'Бус' } }),
      ],
      cats,
    );
    expect(t.km).toEqual([
      { vehicle: 'Бус', km: 0, trips: 1 },
      { vehicle: 'Пікап-12', km: 42, trips: 2 },
    ]);
  });

  it('майно по найменуваннях без урахування регістру; кількість за замовчуванням 1', () => {
    const t = computeTotals(
      [
        mkEntry({ categoryId: IN, fields: { item: 'Радіостанція', qty: 5 } }),
        mkEntry({ categoryId: OUT, fields: { item: 'радіостанція', qty: 2 } }),
        mkEntry({ categoryId: OFF, fields: { item: 'Радіостанція' } }),
        mkEntry({ categoryId: IN, fields: { qty: 3 } }), // без найменування — ігнор
      ],
      cats,
    );
    expect(t.property).toEqual([{ item: 'Радіостанція', received: 5, issued: 2, writtenOff: 1 }]);
  });

  it('несправності: кількість і середній час до закриття', () => {
    const t = computeTotals(
      [
        mkEntry({ categoryId: FAULT, isTask: true, status: 'done', eventAt: 0, closedAt: 2 * HOUR }),
        mkEntry({ categoryId: CAR_FAULT, isTask: true, status: 'done', eventAt: 0, closedAt: 4 * HOUR }),
        mkEntry({ categoryId: FAULT, isTask: true, status: 'open' }),
        mkEntry({ categoryId: FAULT, isTask: true, status: 'cancelled', closedAt: 5 }),
      ],
      cats,
    );
    expect(t.faults).toEqual({ total: 4, closed: 2, open: 1, avgCloseMs: 3 * HOUR });
  });

  it('категорії без ролі не впливають на підсумки', () => {
    const t = computeTotals([mkEntry({ categoryId: seedId(27), fields: { liters: 10 } })], cats);
    expect(t).toEqual({ fuel: [], km: [], property: [], faults: { total: 0, closed: 0, open: 0, avgCloseMs: null } });
  });

  it('операція пального та тривалість', () => {
    expect(fuelOp('Отримано')).toBe('received');
    expect(fuelOp('видано')).toBe('issued');
    expect(fuelOp('ЗАПРАВЛЕНО')).toBe('fueled');
    expect(fuelOp(undefined)).toBe('other');
    expect(fmtDuration(0)).toBe('0 хв');
    expect(fmtDuration(26 * HOUR + 5 * 60_000)).toBe('1 д 2 год 5 хв');
  });
});
