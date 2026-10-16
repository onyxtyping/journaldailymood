import { describe, expect, it } from 'vitest';
import { allTags, filterEntries, groupByDay, matchesQuery, periodRange, recentCategoryIds } from '../src/domain/filters';
import { seedCategories } from '../src/db/seed';
import { at, mkEntry } from './helpers';

const now = at(2026, 10, 16, 12, 0);

describe('periodRange', () => {
  it('сьогодні: від 00:00 до 23:59:59.999', () => {
    const r = periodRange('today', now);
    expect(r.from).toBe(at(2026, 10, 16));
    expect(r.to).toBe(at(2026, 10, 17) - 1);
  });
  it('вчора', () => {
    const r = periodRange('yesterday', now);
    expect(r.from).toBe(at(2026, 10, 15));
    expect(r.to).toBe(at(2026, 10, 16) - 1);
  });
  it('тиждень = 7 днів включно з сьогодні', () => {
    expect(periodRange('week', now).from).toBe(at(2026, 10, 10));
  });
  it('усе — без меж', () => {
    expect(periodRange('all', now)).toEqual({});
  });
});

describe('filterEntries', () => {
  const list = [
    mkEntry({ id: '1', eventAt: at(2026, 10, 16, 9), text: 'Впав лінк на КСП', categoryId: 'a', tags: ['ррл'] }),
    mkEntry({ id: '2', eventAt: at(2026, 10, 15, 9), text: 'Заправка', categoryId: 'b', fields: { vehicle: 'Пікап 12', liters: 40 } }),
    mkEntry({ id: '3', eventAt: at(2026, 10, 16, 10), text: 'Подати рапорт', categoryId: 'a', isTask: true }),
    mkEntry({ id: '4', eventAt: at(2026, 10, 16, 11), text: 'Видалений', deletedAt: now }),
  ];

  it('ховає видалені за замовчуванням', () => {
    expect(filterEntries(list, {}).map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(filterEntries(list, { includeDeleted: true })).toHaveLength(4);
  });
  it('період', () => {
    expect(filterEntries(list, periodRange('today', now)).map((e) => e.id)).toEqual(['1', '3']);
  });
  it('категорії', () => {
    expect(filterEntries(list, { categoryIds: ['b'] }).map((e) => e.id)).toEqual(['2']);
  });
  it('лише задачі', () => {
    expect(filterEntries(list, { onlyTasks: true }).map((e) => e.id)).toEqual(['3']);
  });
  it('теги', () => {
    expect(filterEntries(list, { tags: ['ррл'] }).map((e) => e.id)).toEqual(['1']);
  });
  it('пошук по полях, без урахування регістру', () => {
    expect(filterEntries(list, { q: 'пікап' }).map((e) => e.id)).toEqual(['2']);
    expect(filterEntries(list, { q: '40' }).map((e) => e.id)).toEqual(['2']);
  });
  it('пошук: усі слова мають збігтися', () => {
    expect(matchesQuery(list[0], 'лінк ксп')).toBe(true);
    expect(matchesQuery(list[0], 'лінк рапорт')).toBe(false);
    expect(matchesQuery(list[0], '#ррл')).toBe(true);
  });
  it('пошук по назві категорії', () => {
    const cat = seedCategories()[0];
    expect(matchesQuery(mkEntry({ text: 'x' }), 'командування', cat)).toBe(true);
  });
});

describe('groupByDay', () => {
  it('групує за локальним днем, найновіші зверху, межа доби — опівночі', () => {
    const g = groupByDay([
      mkEntry({ id: 'a', eventAt: at(2026, 10, 15, 23, 59) }),
      mkEntry({ id: 'b', eventAt: at(2026, 10, 16, 0, 0) }),
      mkEntry({ id: 'c', eventAt: at(2026, 10, 16, 8, 0) }),
    ]);
    expect(g.map((d) => d.key)).toEqual(['2026-10-16', '2026-10-15']);
    expect(g[0].items.map((e) => e.id)).toEqual(['c', 'b']);
  });
});

describe('recentCategoryIds / allTags', () => {
  const cats = new Map(seedCategories().map((c) => [c.id, c]));
  const [c1, c2, c3] = [...cats.keys()];
  cats.set(c3, { ...cats.get(c3)!, archived: true });

  it('останні використані, без повторів і архівних', () => {
    const list = [
      mkEntry({ categoryId: c1, createdAt: 1 }),
      mkEntry({ categoryId: c2, createdAt: 2 }),
      mkEntry({ categoryId: c1, createdAt: 3 }),
      mkEntry({ categoryId: c3, createdAt: 4 }),
    ];
    expect(recentCategoryIds(list, cats, 8)).toEqual([c1, c2]);
  });

  it('теги без дублікатів і без видалених записів', () => {
    expect(allTags([mkEntry({ tags: ['б', 'а'] }), mkEntry({ tags: ['а'] }), mkEntry({ tags: ['в'], deletedAt: 1 })])).toEqual(['а', 'б']);
  });
});
