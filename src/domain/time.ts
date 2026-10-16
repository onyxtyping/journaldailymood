import type { Millis } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(t: Millis): Millis {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Додає календарні дні (коректно через перехід на літній/зимовий час). */
export function addDays(t: Millis, n: number): Millis {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function endOfDay(t: Millis): Millis {
  return addDays(startOfDay(t), 1) - 1;
}

export function isSameDay(a: Millis, b: Millis): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Ключ дня у локальному часі: YYYY-MM-DD. */
export function dayKey(t: Millis): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Значення для <input type="datetime-local">. */
export function toLocalInput(t: Millis | undefined): string {
  if (t == null) return '';
  const d = new Date(t);
  return `${dayKey(t)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(s: string): Millis | undefined {
  if (!s) return undefined;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? undefined : t;
}

const timeFmt = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' });
const fullFmt = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtTime(t: Millis): string {
  return timeFmt.format(t);
}

export function fmtDateTime(t: Millis): string {
  return fullFmt.format(t);
}

/** «14:30» для сьогодні, «16.10 14:30» для інших днів. */
export function fmtShort(t: Millis, now: Millis): string {
  return isSameDay(t, now) ? timeFmt.format(t) : `${shortFmt.format(t)} ${timeFmt.format(t)}`;
}

export function fmtDayHeader(t: Millis, now: Millis, labels: { today: string; yesterday: string }): string {
  if (isSameDay(t, now)) return labels.today;
  if (isSameDay(t, addDays(now, -1))) return labels.yesterday;
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayFmt : dayYearFmt).format(t);
}
