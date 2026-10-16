import { useRef } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Category, Entry } from '../../domain/types';
import { fmtShort, fmtTime } from '../../domain/time';
import { isOverdue } from '../../domain/tasks';
import { Icon } from './Icon';
import { fieldsShort } from '../../domain/fields';

const LONG_PRESS_MS = 450;

export function TaskBadge({ e, now }: { e: Entry; now: number }) {
  if (!e.isTask) return null;
  if (e.status === 'done') return <span class="pill done">{t.task.done}</span>;
  if (e.status === 'cancelled') return <span class="pill muted">{t.task.cancelled}</span>;
  if (isOverdue(e, now)) return <span class="pill overdue">{t.task.overdue} · {fmtShort(e.dueAt!, now)}</span>;
  if (e.dueAt) return <span class="pill task">{t.task.due} {fmtShort(e.dueAt, now)}</span>;
  return <span class="pill task">задача</span>;
}

/**
 * Рядок журналу. Натиск — редагування; довгий натиск, правий клік або «⋯» — дії.
 */
export function EntryRow({
  e,
  cat,
  now,
  selected,
  actionsOpen,
  onOpen,
  onActions,
  onDelete,
  onMakeTask,
}: {
  e: Entry;
  cat?: Category;
  now: number;
  selected?: boolean;
  actionsOpen: boolean;
  onOpen: () => void;
  onActions: (open: boolean) => void;
  onDelete: () => void;
  onMakeTask: () => void;
}) {
  const short = fieldsShort(e, cat);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const longFired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return (
    <li class={`entry ${selected ? 'selected' : ''} ${e.isTask && e.status !== 'open' ? 'closed' : ''}`} style={{ '--cat': cat?.color ?? '#888' }}>
      <div
        class="entry-main"
        role="button"
        tabIndex={0}
        onPointerDown={(ev) => {
          longFired.current = false;
          start.current = { x: ev.clientX, y: ev.clientY };
          timer.current = setTimeout(() => {
            longFired.current = true;
            navigator.vibrate?.(10);
            onActions(true);
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(ev) => {
          if (start.current && Math.hypot(ev.clientX - start.current.x, ev.clientY - start.current.y) > 10) cancel();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(ev) => {
          ev.preventDefault();
          onActions(true);
        }}
        onClick={() => {
          if (longFired.current) return;
          onOpen();
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') onOpen();
        }}
      >
        <span class="entry-time">{fmtTime(e.eventAt)}</span>
        <div class="entry-body">
          <div class="entry-meta">
            <span class="emoji" aria-hidden="true">
              {cat?.emoji ?? '•'}
            </span>
            <span class="entry-cat">{cat?.name ?? '—'}</span>
            <TaskBadge e={e} now={now} />
          </div>
          {e.text && <div class="entry-text">{e.text}</div>}
          {short && <div class={e.text ? 'entry-fields' : 'entry-text'}>{short}</div>}
          {e.tags.length > 0 && (
            <div class="entry-tags">
              {e.tags.map((tag) => (
                <span key={tag} class="tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button class="icon-btn entry-more" aria-label="Дії" aria-expanded={actionsOpen} onClick={() => onActions(!actionsOpen)}>
        <Icon name="more" />
      </button>
      {actionsOpen && (
        <div class="entry-actions">
          {!e.isTask && (
            <button class="btn" onClick={onMakeTask}>
              {t.journal.makeTask}
            </button>
          )}
          <button class="btn danger" onClick={onDelete}>
            {t.common.delete}
          </button>
          <button class="btn" onClick={() => onActions(false)}>
            {t.common.cancel}
          </button>
        </div>
      )}
    </li>
  );
}
