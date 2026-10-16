import { describe, expect, it } from 'vitest';
import { buildReport, reportCsv, reportJson, reportText } from '../src/domain/report';
import { periodRange } from '../src/domain/filters';
import { todayOverview, dueTomorrow } from '../src/domain/today';
import { fieldsShort, makeFieldKey } from '../src/domain/fields';
import { checkpointsIcs, fold, icsEscape, taskIcs } from '../src/io/ics';
import { seedCategories, seedId } from '../src/db/seed';
import { at, mkEntry } from './helpers';

const cats = new Map(seedCategories().map((c) => [c.id, c]));
const FUEL = seedId(16);
const NOTE = seedId(27);
const now = at(2026, 10, 16, 12, 0);

const list = [
  mkEntry({ id: 'n2', categoryId: NOTE, eventAt: at(2026, 10, 16, 11), text: 'Друга; з крапкою з комою' }),
  mkEntry({ id: 'f1', categoryId: FUEL, eventAt: at(2026, 10, 16, 9), text: 'Заправка', fields: { operation: 'Заправлено', vehicle: 'Пікап-12', fuelType: 'ДП', liters: 40 } }),
  mkEntry({ id: 'n1', categoryId: NOTE, eventAt: at(2026, 10, 16, 8), text: 'Перша', tags: ['ррл'] }),
  mkEntry({ id: 'old', categoryId: NOTE, eventAt: at(2026, 10, 1, 8), text: 'Стара' }),
];

describe('вибірка', () => {
  const r = buildReport(list, cats, periodRange('today', now));

  it('групує за категоріями в порядку категорій, хронологічно всередині', () => {
    expect(r.groups.map((g) => g.categoryId)).toEqual([FUEL, NOTE]);
    expect(r.groups[1].items.map((e) => e.id)).toEqual(['n1', 'n2']);
    expect(r.entries).toHaveLength(3);
  });

  it('фільтр категорій', () => {
    expect(buildReport(list, cats, { categoryIds: [NOTE] }).entries.map((e) => e.id)).toEqual(['old', 'n1', 'n2']);
  });

  it('текст: заголовок, підсумки, групи, поля', () => {
    const txt = reportText(r);
    expect(txt).toContain('ЖУРНАЛ · 16.10.2026');
    expect(txt).toContain('Записів: 3');
    expect(txt).toContain('Пікап-12, ДП: заправлено 40');
    expect(txt).toContain('⛽ Пальне (1)');
    expect(txt).toContain('Літри: 40 л');
    expect(txt).toContain('#ррл');
  });

  it('CSV: BOM, «;», екранування, колонки полів', () => {
    const csv = reportCsv(r);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('Літри');
    expect(csv).toContain('"Друга; з крапкою з комою"');
  });

  it('JSON без localSeq', () => {
    const j = JSON.parse(reportJson({ ...r, groups: r.groups.map((g) => ({ ...g, items: g.items.map((e) => ({ ...e, localSeq: 5 })) })) }));
    expect(j.groups[0].entries[0].localSeq).toBeUndefined();
    expect(j.totals.fuel[0].fueled).toBe(40);
  });
});

describe('огляд «Сьогодні»', () => {
  const entries = [
    mkEntry({ id: 'over', isTask: true, dueAt: at(2026, 10, 15, 18), createdAt: at(2026, 10, 15, 9) }),
    mkEntry({ id: 'today', isTask: true, dueAt: at(2026, 10, 16, 18) }),
    mkEntry({ id: 'tomorrow', isTask: true, dueAt: at(2026, 10, 17, 10) }),
    mkEntry({ id: 'y-open', isTask: true, createdAt: at(2026, 10, 15, 10), eventAt: at(2026, 10, 15, 10) }),
    mkEntry({ id: 'y-done', isTask: true, status: 'done', createdAt: at(2026, 10, 15, 11), eventAt: at(2026, 10, 15, 11) }),
    mkEntry({ id: 'y-note', categoryId: 'b', eventAt: at(2026, 10, 15, 23, 59) }),
  ];
  const o = todayOverview(entries, now);

  it('прострочене, на сьогодні, вчорашні відкриті', () => {
    expect(o.overdue.map((e) => e.id)).toEqual(['over']);
    expect(o.dueToday.map((e) => e.id)).toEqual(['today']);
    expect(o.fromYesterday.map((e) => e.id)).toEqual(['over', 'y-open']);
  });

  it('учорашні записи по категоріях', () => {
    // 'over' теж створено вчора (eventAt = createdAt).
    expect(o.yesterdayTotal).toBe(4);
    expect(o.yesterdayByCategory).toEqual([
      { categoryId: 'cat', count: 3 },
      { categoryId: 'b', count: 1 },
    ]);
  });

  it('термін на завтра', () => {
    expect(dueTomorrow(entries, now).map((e) => e.id)).toEqual(['tomorrow']);
  });
});

describe('поля', () => {
  it('короткий рядок з одиницями', () => {
    const e = mkEntry({ categoryId: FUEL, fields: { vehicle: 'Пікап-12', liters: 40, operation: 'Видано' } });
    expect(fieldsShort(e, cats.get(FUEL))).toBe('Видано · Пікап-12 · 40 л');
  });
  it('ключ поля з назви, унікальний', () => {
    expect(makeFieldKey('Серійний номер', [])).toBe('seriynyy_nomer');
    expect(makeFieldKey('Літри', ['liters', 'litry'])).toBe('litry_2');
    expect(makeFieldKey('!!!', [])).toBe('field');
  });
});

describe('ics', () => {
  it('щоденні чекпоінти з нагадуванням', () => {
    const s = checkpointsIcs(['21:00', '09:00'], at(2026, 10, 16, 12));
    expect(s.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(s.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(s).toContain('DTSTART:20261016T090000');
    expect(s).toContain('RRULE:FREQ=DAILY');
    expect(s).toContain('BEGIN:VALARM');
  });
  it('задача на термін', () => {
    const s = taskIcs(mkEntry({ id: 'x1', text: 'Рапорт, терміново', isTask: true, dueAt: at(2026, 10, 17, 10, 30) }), cats.get(seedId(2)));
    expect(s).toContain('DTSTART:20261017T103000');
    expect(s).toContain('UID:journal-task-x1@journal.local');
    expect(s).toContain('Рапорт\\, терміново');
  });
  it('екранування і перенесення довгих рядків', () => {
    expect(icsEscape('a;b,c\nd')).toBe('a\\;b\\,c\\nd');
    const long = 'SUMMARY:' + 'ж'.repeat(60);
    const folded = fold(long);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
