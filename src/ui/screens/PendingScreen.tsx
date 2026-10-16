import { useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Entry } from '../../domain/types';
import { groupPending } from '../../domain/tasks';
import { fmtShort } from '../../domain/time';
import { setTaskStatus } from '../../db/repo';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { taskIcs } from '../../io/ics';
import { shareOrDownload } from '../../io/share';
import { catMap, db, entries, go, now, showToast } from '../store';

export function TaskRow({ e, overdue }: { e: Entry; overdue: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const cat = catMap.value.get(e.categoryId);
  const nowV = now.value;

  const close = async (status: 'done' | 'cancelled', withNote?: string) => {
    await setTaskStatus(db, e.id, status, withNote);
    showToast(status === 'done' ? t.task.closed : t.task.cancelledToast, {
      label: t.common.undo,
      run: () => void setTaskStatus(db, e.id, 'open'),
    });
  };

  return (
    <li class={`task-row ${overdue ? 'overdue' : ''} prio-${e.priority ?? 'normal'}`} style={{ '--cat': cat?.color ?? '#888' }}>
      <div class="task-line">
        <button class="check-btn" aria-label={t.common.close} title={t.common.close} onClick={() => void close('done')}>
          <Icon name="check" size={24} />
        </button>
        <button class="task-body" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div class="entry-meta">
            <span class="emoji">{cat?.emoji ?? '•'}</span>
            <span class="entry-cat">{cat?.name ?? '—'}</span>
            {e.priority === 'high' && <span class="pill overdue">!</span>}
            {e.dueAt != null && <span class={`pill ${overdue ? 'overdue' : 'task'}`}>{fmtShort(e.dueAt, nowV)}</span>}
          </div>
          <div class="entry-text">{e.text || '—'}</div>
        </button>
      </div>
      {open && (
        <div class="task-expand">
          <input
            type="text"
            value={note}
            placeholder={t.task.closeNote}
            onInput={(ev) => setNote((ev.target as HTMLInputElement).value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') void close('done', note);
            }}
          />
          <div class="row wrap">
            <button class="btn primary" onClick={() => void close('done', note)}>
              {t.task.closeWithNote}
            </button>
            <button class="btn" onClick={() => void close('cancelled', note)}>
              {t.task.cancelTask}
            </button>
            {e.dueAt != null && (
              <button class="btn" onClick={() => void shareOrDownload(`journal-task-${e.id.slice(0, 8)}.ics`, taskIcs(e, cat), 'text/calendar')}>
                {t.calendar.addTask}
              </button>
            )}
            <button class="btn ghost" onClick={() => go('edit', e.id)}>
              {t.edit.title}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function PendingScreen() {
  const nowV = now.value;
  const g = useMemo(() => groupPending(entries.value, nowV), [entries.value, nowV]);
  const sections: [string, Entry[], boolean][] = [
    [t.pending.overdue, g.overdue, true],
    [t.pending.today, g.today, false],
    [t.pending.dated, g.dated, false],
    [t.pending.undated, g.undated, false],
  ];
  const total = g.overdue.length + g.today.length + g.dated.length + g.undated.length;

  return (
    <div class="screen pending">
      <Header title={`${t.nav.pending}${total ? ` · ${total}` : ''}`} />
      <div class="content">
        {total === 0 && <p class="empty">{t.pending.empty}</p>}
        {sections.map(([title, list, overdue]) =>
          list.length ? (
            <section key={title} class="day">
              <h2 class={`day-title ${overdue ? 'danger-text' : ''}`}>
                {title} <span class="muted">· {list.length}</span>
              </h2>
              <ul class="entries">
                {list.map((e) => (
                  <TaskRow key={e.id} e={e} overdue={overdue} />
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
    </div>
  );
}
