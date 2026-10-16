import type { Entry, Millis, Priority } from './types';
import { endOfDay } from './time';

export function isOpenTask(e: Entry): boolean {
  return e.isTask && e.status === 'open' && !e.deletedAt;
}

export function isOverdue(e: Entry, now: Millis): boolean {
  return isOpenTask(e) && e.dueAt != null && e.dueAt < now;
}

export interface PendingGroups {
  overdue: Entry[];
  today: Entry[];
  dated: Entry[];
  undated: Entry[];
}

const PRIO: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const prio = (e: Entry) => PRIO[e.priority ?? 'normal'];

/** Відкриті задачі в порядку: прострочені → на сьогодні → з терміном → без терміну. */
export function groupPending(entries: Entry[], now: Millis): PendingGroups {
  const g: PendingGroups = { overdue: [], today: [], dated: [], undated: [] };
  const eod = endOfDay(now);
  for (const e of entries) {
    if (!isOpenTask(e)) continue;
    if (e.dueAt == null) g.undated.push(e);
    else if (e.dueAt < now) g.overdue.push(e);
    else if (e.dueAt <= eod) g.today.push(e);
    else g.dated.push(e);
  }
  const byDue = (a: Entry, b: Entry) => a.dueAt! - b.dueAt! || prio(a) - prio(b);
  g.overdue.sort(byDue);
  g.today.sort(byDue);
  g.dated.sort(byDue);
  // Без терміну: спершу важливі, далі найстаріші — вони муляють найдовше.
  g.undated.sort((a, b) => prio(a) - prio(b) || a.eventAt - b.eventAt);
  return g;
}

export function countOverdue(entries: Entry[], now: Millis): number {
  let n = 0;
  for (const e of entries) if (isOverdue(e, now)) n++;
  return n;
}
