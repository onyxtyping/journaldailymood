import { describe, expect, it } from 'vitest';
import { dueCheckpoint, normalizeTimes, parseTime } from '../src/domain/checkpoints';
import { at } from './helpers';

const T = ['09:00', '14:00', '21:00'];

describe('чекпоінти', () => {
  it('нормалізує часи: валідні, без дублікатів, за зростанням', () => {
    expect(normalizeTimes(['21:00', '9:00', '09:00', '25:00', 'abc', '14:5', '14:05'])).toEqual(['09:00', '14:05', '21:00']);
    expect(parseTime('24:00')).toBeNull();
  });

  it('до першого чекпоінту доби — вчорашній вечірній, якщо не пройдений', () => {
    const now = at(2026, 10, 16, 8, 0);
    const d = dueCheckpoint(now, T, at(2026, 10, 15, 14, 30));
    expect(d?.at).toBe(at(2026, 10, 15, 21, 0));
    expect(d?.isEvening).toBe(true);
  });

  it('вчорашній вечірній пройдений — до 09:00 нічого', () => {
    expect(dueCheckpoint(at(2026, 10, 16, 8, 59), T, at(2026, 10, 15, 21, 10))).toBeNull();
  });

  it('рівно в час чекпоінту — він уже настав', () => {
    const d = dueCheckpoint(at(2026, 10, 16, 9, 0), T, at(2026, 10, 15, 21, 10));
    expect(d?.time).toBe('09:00');
    expect(d?.isEvening).toBe(false);
  });

  it('пропущені не накопичуються: показується лише найсвіжіший', () => {
    // Останній пройдений — позавчора; зараз 15:00 — має бути лише 14:00 сьогодні.
    const d = dueCheckpoint(at(2026, 10, 16, 15, 0), T, at(2026, 10, 14, 9, 0));
    expect(d?.at).toBe(at(2026, 10, 16, 14, 0));
  });

  it('пройдений після настання — більше не показується', () => {
    expect(dueCheckpoint(at(2026, 10, 16, 15, 0), T, at(2026, 10, 16, 14, 20))).toBeNull();
  });

  it('межа доби: о 00:30 актуальний вчорашній 21:00', () => {
    const d = dueCheckpoint(at(2026, 10, 17, 0, 30), T, at(2026, 10, 16, 14, 10));
    expect(d?.at).toBe(at(2026, 10, 16, 21, 0));
  });

  it('без налаштованих часів — нічого', () => {
    expect(dueCheckpoint(at(2026, 10, 16, 15, 0), [], undefined)).toBeNull();
  });
});
