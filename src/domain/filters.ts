import type { Category, Entry, Millis } from './types';
import { addDays, dayKey, startOfDay } from './time';

export interface EntryFilter {
  from?: Millis;
  to?: Millis;
  categoryIds?: string[];
  tags?: string[];
  onlyTasks?: boolean;
  q?: string;
  includeDeleted?: boolean;
}

export type PeriodKind = 'all' | 'today' | 'yesterday' | 'week' | 'month';

/** Межі періоду в локальному часі. «Тиждень» і «місяць» — останні 7/30 днів включно з сьогодні. */
export function periodRange(kind: PeriodKind, now: Millis): { from?: Millis; to?: Millis } {
  const today = startOfDay(now);
  switch (kind) {
    case 'all':
      return {};
    case 'today':
      return { from: today, to: addDays(today, 1) - 1 };
    case 'yesterday':
      return { from: addDays(today, -1), to: today - 1 };
    case 'week':
      return { from: addDays(today, -6), to: addDays(today, 1) - 1 };
    case 'month':
      return { from: addDays(today, -29), to: addDays(today, 1) - 1 };
  }
}

function fieldText(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(fieldText).join(' ');
  return String(v);
}

export function entryHaystack(e: Entry, cat?: Category): string {
  return [e.text, e.tags.join(' '), ...Object.values(e.fields).map(fieldText), e.closeNote ?? '', cat?.name ?? '']
    .join(' ')
    .toLowerCase();
}

/** Усі слова запиту мають зустрітися в тексті, тегах, полях, примітці або назві категорії. */
export function matchesQuery(e: Entry, q: string, cat?: Category): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = entryHaystack(e, cat);
  return words.every((w) => hay.includes(w.replace(/^#/, '')));
}

export function filterEntries(entries: Entry[], f: EntryFilter, cats?: Map<string, Category>): Entry[] {
  const catSet = f.categoryIds?.length ? new Set(f.categoryIds) : null;
  const tagList = f.tags?.length ? f.tags : null;
  return entries.filter((e) => {
    if (!f.includeDeleted && e.deletedAt) return false;
    if (f.from != null && e.eventAt < f.from) return false;
    if (f.to != null && e.eventAt > f.to) return false;
    if (catSet && !catSet.has(e.categoryId)) return false;
    if (f.onlyTasks && !e.isTask) return false;
    if (tagList && !tagList.every((t) => e.tags.includes(t))) return false;
    if (f.q && !matchesQuery(e, f.q, cats?.get(e.categoryId))) return false;
    return true;
  });
}

export interface DayGroup {
  key: string;
  start: Millis;
  items: Entry[];
}

/** Групування по днях (за eventAt), найновіші зверху. */
export function groupByDay(entries: Entry[]): DayGroup[] {
  const sorted = [...entries].sort((a, b) => b.eventAt - a.eventAt || b.createdAt - a.createdAt);
  const out: DayGroup[] = [];
  for (const e of sorted) {
    const key = dayKey(e.eventAt);
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      g = { key, start: startOfDay(e.eventAt), items: [] };
      out.push(g);
    }
    g.items.push(e);
  }
  return out;
}

/** Останні використані категорії (за часом створення записів), без архівних і видалених. */
export function recentCategoryIds(entries: Entry[], cats: Map<string, Category>, limit: number): string[] {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const out: string[] = [];
  for (const e of sorted) {
    if (out.length >= limit) break;
    const c = cats.get(e.categoryId);
    if (!c || c.archived || c.deletedAt || out.includes(c.id)) continue;
    out.push(c.id);
  }
  return out;
}

export function allTags(entries: Entry[]): string[] {
  const s = new Set<string>();
  for (const e of entries) if (!e.deletedAt) for (const t of e.tags) s.add(t);
  return [...s].sort((a, b) => a.localeCompare(b, 'uk'));
}
