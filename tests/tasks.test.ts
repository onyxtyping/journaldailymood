import { describe, expect, it } from 'vitest';
import { countOverdue, groupPending } from '../src/domain/tasks';
import { at, mkEntry } from './helpers';

const now = at(2026, 10, 16, 12, 0);

describe('groupPending', () => {
  const tasks = [
    mkEntry({ id: 'over', isTask: true, dueAt: at(2026, 10, 16, 9) }),
    mkEntry({ id: 'over-old', isTask: true, dueAt: at(2026, 10, 14, 9) }),
    mkEntry({ id: 'today', isTask: true, dueAt: at(2026, 10, 16, 18) }),
    mkEntry({ id: 'later', isTask: true, dueAt: at(2026, 10, 20) }),
    mkEntry({ id: 'nodue-low', isTask: true, priority: 'low', eventAt: at(2026, 10, 1) }),
    mkEntry({ id: 'nodue-high', isTask: true, priority: 'high', eventAt: at(2026, 10, 15) }),
    mkEntry({ id: 'done', isTask: true, status: 'done', dueAt: at(2026, 10, 1) }),
    mkEntry({ id: 'deleted', isTask: true, deletedAt: now, dueAt: at(2026, 10, 1) }),
    mkEntry({ id: 'note' }),
  ];

  it('розкладає за групами і порядком', () => {
    const g = groupPending(tasks, now);
    expect(g.overdue.map((e) => e.id)).toEqual(['over-old', 'over']);
    expect(g.today.map((e) => e.id)).toEqual(['today']);
    expect(g.dated.map((e) => e.id)).toEqual(['later']);
    expect(g.undated.map((e) => e.id)).toEqual(['nodue-high', 'nodue-low']);
  });

  it('рахує лише відкриті невидалені прострочені', () => {
    expect(countOverdue(tasks, now)).toBe(2);
  });

  it('термін рівно о 23:59 сьогодні — «на сьогодні», о 00:00 завтра — «з терміном»', () => {
    const g = groupPending(
      [mkEntry({ id: 'a', isTask: true, dueAt: at(2026, 10, 16, 23, 59) }), mkEntry({ id: 'b', isTask: true, dueAt: at(2026, 10, 17, 0, 0) })],
      now,
    );
    expect(g.today.map((e) => e.id)).toEqual(['a']);
    expect(g.dated.map((e) => e.id)).toEqual(['b']);
  });
});
