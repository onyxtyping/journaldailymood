import type { Entry, Millis } from './types';
import { addDays, startOfDay } from './time';
import { isOpenTask } from './tasks';

export interface TodayOverview {
  overdue: Entry[];
  dueToday: Entry[];
  /** Задачі, відкриті вчора, що досі висять. */
  fromYesterday: Entry[];
  /** Кількість учорашніх записів по категоріях, за спаданням. */
  yesterdayByCategory: { categoryId: string; count: number }[];
  yesterdayTotal: number;
}

export function todayOverview(entries: Entry[], now: Millis): TodayOverview {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const o: TodayOverview = { overdue: [], dueToday: [], fromYesterday: [], yesterdayByCategory: [], yesterdayTotal: 0 };
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.deletedAt) continue;
    if (e.eventAt >= yesterday && e.eventAt < today) {
      counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
      o.yesterdayTotal++;
    }
    if (!isOpenTask(e)) continue;
    if (e.dueAt != null && e.dueAt < now) o.overdue.push(e);
    else if (e.dueAt != null && e.dueAt < tomorrow) o.dueToday.push(e);
    if (e.createdAt >= yesterday && e.createdAt < today) o.fromYesterday.push(e);
  }
  o.overdue.sort((a, b) => a.dueAt! - b.dueAt!);
  o.dueToday.sort((a, b) => a.dueAt! - b.dueAt!);
  o.fromYesterday.sort((a, b) => a.createdAt - b.createdAt);
  o.yesterdayByCategory = [...counts].map(([categoryId, count]) => ({ categoryId, count })).sort((a, b) => b.count - a.count);
  return o;
}

/** Відкриті задачі з терміном на завтра (для вечірнього чекпоінту). */
export function dueTomorrow(entries: Entry[], now: Millis): Entry[] {
  const from = addDays(startOfDay(now), 1);
  const to = addDays(from, 1);
  return entries.filter((e) => isOpenTask(e) && e.dueAt != null && e.dueAt >= from && e.dueAt < to).sort((a, b) => a.dueAt! - b.dueAt!);
}
