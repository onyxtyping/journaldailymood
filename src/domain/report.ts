import type { Category, Entry, Millis } from './types';
import { filterEntries } from './filters';
import { computeTotals, fmtDuration, type Totals } from './aggregate';
import { fieldPairs } from './fields';
import { fmtDateTime, fmtTime } from './time';

export interface ReportQuery {
  from?: Millis;
  to?: Millis;
  categoryIds?: string[];
}

export interface ReportGroup {
  cat: Category | undefined;
  categoryId: string;
  items: Entry[];
}

export interface Report {
  query: ReportQuery;
  entries: Entry[];
  groups: ReportGroup[];
  totals: Totals;
}

/** Вибірка: записи за період, згруповані за категоріями (в порядку категорій), хронологічно всередині. */
export function buildReport(all: Entry[], cats: Map<string, Category>, q: ReportQuery): Report {
  const entries = filterEntries(all, { from: q.from, to: q.to, categoryIds: q.categoryIds }).sort(
    (a, b) => a.eventAt - b.eventAt || a.createdAt - b.createdAt,
  );
  const map = new Map<string, ReportGroup>();
  for (const e of entries) {
    let g = map.get(e.categoryId);
    if (!g) map.set(e.categoryId, (g = { cat: cats.get(e.categoryId), categoryId: e.categoryId, items: [] }));
    g.items.push(e);
  }
  const groups = [...map.values()].sort((a, b) => (a.cat?.order ?? 1e9) - (b.cat?.order ?? 1e9));
  return { query: q, entries, groups, totals: computeTotals(entries, cats) };
}

const STATUS: Record<string, string> = { open: 'відкрита', done: 'виконано', cancelled: 'скасовано' };

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

function dateOnly(t: Millis): string {
  return fmtDateTime(t).split(',')[0].trim();
}

export function periodLabel(q: ReportQuery): string {
  if (q.from == null && q.to == null) return 'увесь час';
  const a = q.from != null ? dateOnly(q.from) : '…';
  const b = q.to != null ? dateOnly(q.to) : '…';
  return a === b ? a : `${a} – ${b}`;
}

export function hasTotals(t: Totals): boolean {
  return t.fuel.length > 0 || t.km.length > 0 || t.property.length > 0 || t.faults.total > 0;
}

/** Рядки підсумків (спільні для екрана і тексту). */
export function totalsLines(t: Totals): { title: string; lines: string[] }[] {
  const out: { title: string; lines: string[] }[] = [];
  if (t.fuel.length) {
    out.push({
      title: 'Пальне, л',
      lines: t.fuel.map((r) => {
        const parts = [];
        if (r.received) parts.push(`отримано ${fmtNum(r.received)}`);
        if (r.issued) parts.push(`видано ${fmtNum(r.issued)}`);
        if (r.fueled) parts.push(`заправлено ${fmtNum(r.fueled)}`);
        if (r.other) parts.push(`інше ${fmtNum(r.other)}`);
        return `${r.vehicle}, ${r.fuelType}: ${parts.join(', ')}`;
      }),
    });
  }
  if (t.km.length) {
    out.push({ title: 'Кілометраж', lines: t.km.map((r) => `${r.vehicle}: ${fmtNum(r.km)} км (виїздів: ${r.trips})`) });
  }
  if (t.property.length) {
    out.push({
      title: 'Майно, шт',
      lines: t.property.map((r) => {
        const parts = [];
        if (r.received) parts.push(`отримано ${fmtNum(r.received)}`);
        if (r.issued) parts.push(`видано ${fmtNum(r.issued)}`);
        if (r.writtenOff) parts.push(`ремонт/списання ${fmtNum(r.writtenOff)}`);
        return `${r.item}: ${parts.join(', ')}`;
      }),
    });
  }
  if (t.faults.total) {
    const f = t.faults;
    const avg = f.avgCloseMs != null ? `, середній час до закриття ${fmtDuration(f.avgCloseMs)}` : '';
    out.push({ title: 'Несправності', lines: [`усього ${f.total}, закрито ${f.closed}, відкрито ${f.open}${avg}`] });
  }
  return out;
}

function entryLine(e: Entry, cat: Category | undefined): string {
  const date = dateOnly(e.eventAt).slice(0, 5);
  let s = `${date} ${fmtTime(e.eventAt)} — ${e.text || '(без тексту)'}`;
  const pairs = fieldPairs(e, cat);
  if (pairs.length) s += `\n      ${pairs.map((p) => `${p.label}: ${p.value}`).join('; ')}`;
  if (e.isTask) {
    let task = `Задача: ${STATUS[e.status]}`;
    if (e.dueAt) task += `, термін ${fmtDateTime(e.dueAt)}`;
    if (e.closedAt && e.status !== 'open') task += `, закрито ${fmtDateTime(e.closedAt)}`;
    if (e.closeNote) task += ` — ${e.closeNote}`;
    s += `\n      ${task}`;
  }
  if (e.tags.length) s += `\n      #${e.tags.join(' #')}`;
  return s;
}

/** Чистий текст для вставки у звіт. */
export function reportText(r: Report): string {
  const lines: string[] = [`ЖУРНАЛ · ${periodLabel(r.query)}`, `Записів: ${r.entries.length}`];
  const totals = totalsLines(r.totals);
  if (totals.length) {
    lines.push('', 'ПІДСУМКИ');
    for (const t of totals) {
      lines.push(`${t.title}:`);
      for (const l of t.lines) lines.push(`  ${l}`);
    }
  }
  for (const g of r.groups) {
    lines.push('', `${g.cat ? `${g.cat.emoji} ${g.cat.name}` : 'Без категорії'} (${g.items.length})`);
    for (const e of g.items) lines.push(`  ${entryLine(e, g.cat)}`);
  }
  return lines.join('\n') + '\n';
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV з роздільником «;» і BOM — відкривається в Excel з українською локаллю. */
export function reportCsv(r: Report): string {
  // Колонки полів: об'єднання всіх полів записів вибірки, з назвами зі схем категорій.
  const fieldCols: { key: string; label: string }[] = [];
  const seen = new Map<string, number>();
  for (const g of r.groups) {
    for (const e of g.items) {
      for (const key of Object.keys(e.fields)) {
        const label = g.cat?.fieldSchema.find((f) => f.key === key)?.label ?? key;
        const id = `${key}`;
        if (!seen.has(id)) {
          seen.set(id, fieldCols.length);
          fieldCols.push({ key, label });
        }
      }
    }
  }
  const header = ['Дата', 'Час', 'Категорія', 'Текст', 'Теги', 'Задача', 'Стан', 'Термін', 'Закрито', 'Примітка', ...fieldCols.map((c) => c.label)];
  const rows = [header];
  for (const g of r.groups) {
    for (const e of g.items) {
      rows.push([
        dateOnly(e.eventAt),
        fmtTime(e.eventAt),
        g.cat?.name ?? '',
        e.text,
        e.tags.join(' '),
        e.isTask ? 'так' : '',
        e.isTask ? STATUS[e.status] : '',
        e.dueAt ? fmtDateTime(e.dueAt) : '',
        e.closedAt ? fmtDateTime(e.closedAt) : '',
        e.closeNote ?? '',
        ...fieldCols.map((c) => {
          const v = e.fields[c.key];
          return v == null ? '' : String(v);
        }),
      ]);
    }
  }
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function reportJson(r: Report): string {
  return JSON.stringify(
    {
      period: { from: r.query.from ?? null, to: r.query.to ?? null, label: periodLabel(r.query) },
      totals: r.totals,
      groups: r.groups.map((g) => ({
        category: g.cat ? { id: g.cat.id, name: g.cat.name, emoji: g.cat.emoji } : { id: g.categoryId },
        entries: g.items.map(({ localSeq: _s, ...e }) => e),
      })),
    },
    null,
    2,
  );
}
