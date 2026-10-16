import type { Millis } from './types';
import { addDays, startOfDay } from './time';

export const DEFAULT_CHECKPOINTS = ['09:00', '14:00', '21:00'];

export function parseTime(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

/** Валідні часи без дублікатів, за зростанням, у форматі ГГ:ХХ. */
export function normalizeTimes(times: string[]): string[] {
  const out = new Set<string>();
  for (const t of times) {
    const p = parseTime(t);
    if (p) out.add(`${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`);
  }
  return [...out].sort();
}

function at(day: Millis, time: string): Millis {
  const p = parseTime(time)!;
  const d = new Date(day);
  d.setHours(p.h, p.m, 0, 0);
  return d.getTime();
}

export interface DueCheckpoint {
  at: Millis;
  time: string;
  /** Останній чекпоінт доби — показує ще й те, що має термін завтра. */
  isEvening: boolean;
}

/**
 * Найсвіжіший чекпоінт, що вже настав (сьогодні або вчора), і ще не пройдений.
 * Пропущені не накопичуються: повертається лише один, найпізніший.
 */
export function dueCheckpoint(now: Millis, times: string[], lastDoneAt: Millis | undefined): DueCheckpoint | null {
  const list = normalizeTimes(times);
  if (!list.length) return null;
  const today = startOfDay(now);
  let best: DueCheckpoint | null = null;
  for (const day of [addDays(today, -1), today]) {
    for (const time of list) {
      const t = at(day, time);
      if (t <= now && (!best || t > best.at)) best = { at: t, time, isEvening: time === list[list.length - 1] };
    }
  }
  if (!best) return null;
  if (lastDoneAt != null && lastDoneAt >= best.at) return null;
  return best;
}
