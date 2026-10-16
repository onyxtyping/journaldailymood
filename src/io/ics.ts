import type { Category, Entry, Millis } from '../domain/types';
import { normalizeTimes, parseTime } from '../domain/checkpoints';
import { startOfDay } from '../domain/time';

/**
 * Файли календаря (.ics) для нагадувань через штатний Календар телефона.
 * Час — «плаваючий» (без часового поясу): подія о 09:00 буде о 09:00 за місцевим часом пристрою.
 */

const pad = (n: number) => String(n).padStart(2, '0');

function local(t: Millis): string {
  const d = new Date(t);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function utc(t: Millis): string {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Перенесення рядків довших за 75 октетів (RFC 5545). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function calendar(events: string[][]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Journal PWA//UK', 'CALSCALE:GREGORIAN'];
  for (const ev of events) lines.push(...ev);
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function alarm(text: string): string[] {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(text)}`, 'TRIGGER:PT0M', 'END:VALARM'];
}

/** Щоденні події-нагадування на кожен час чекпоінту. */
export function checkpointsIcs(times: string[], now: Millis = Date.now()): string {
  const day = startOfDay(now);
  const events = normalizeTimes(times).map((time) => {
    const p = parseTime(time)!;
    const d = new Date(day);
    d.setHours(p.h, p.m, 0, 0);
    const start = d.getTime();
    const summary = `Журнал: чекпоінт ${time}`;
    return [
      'BEGIN:VEVENT',
      `UID:journal-checkpoint-${time.replace(':', '')}@journal.local`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${local(start)}`,
      `DTEND:${local(start + 10 * 60_000)}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape('Відкрийте Журнал: що сталося, що висить.')}`,
      'TRANSP:TRANSPARENT',
      ...alarm(summary),
      'END:VEVENT',
    ];
  });
  return calendar(events);
}

/** Нагадування про термін задачі. */
export function taskIcs(e: Entry, cat: Category | undefined, now: Millis = Date.now()): string {
  const due = e.dueAt ?? now;
  const title = e.text.split('\n')[0].slice(0, 80) || cat?.name || 'Задача';
  const summary = `${cat?.emoji ? `${cat.emoji} ` : ''}${title}`;
  return calendar([
    [
      'BEGIN:VEVENT',
      `UID:journal-task-${e.id}@journal.local`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${local(due)}`,
      `DTEND:${local(due + 15 * 60_000)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape([cat?.name, e.text].filter(Boolean).join('\n'))}`,
      ...alarm(summary),
      'END:VEVENT',
    ],
  ]);
}
