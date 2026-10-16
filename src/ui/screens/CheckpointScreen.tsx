import { useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Entry } from '../../domain/types';
import { DEFAULT_CHECKPOINTS, dueCheckpoint } from '../../domain/checkpoints';
import { groupPending } from '../../domain/tasks';
import { dueTomorrow } from '../../domain/today';
import { fmtTime } from '../../domain/time';
import { createEntry } from '../../db/repo';
import { QUICK_TASK_SEED, seedId } from '../../db/seed';
import { CaptureForm } from '../components/CaptureForm';
import { TaskRow } from './PendingScreen';
import { activeCategories, catMap, db, entries, finishCheckpoint, go, now, setting, showToast } from '../store';

function quickTaskCategoryId(): string | undefined {
  const cats = catMap.value;
  const preferred = cats.get(seedId(QUICK_TASK_SEED));
  if (preferred && !preferred.deletedAt && !preferred.archived) return preferred.id;
  const active = activeCategories.value;
  return (active.find((c) => c.defaultIsTask) ?? active[0])?.id;
}

function MiniList({ list }: { list: Entry[] }) {
  const cats = catMap.value;
  if (!list.length) return null;
  return (
    <ul class="mini-list">
      {list.map((e) => (
        <li key={e.id}>
          <span class="entry-time">{fmtTime(e.eventAt)}</span>
          <span class="emoji">{cats.get(e.categoryId)?.emoji ?? '•'}</span>
          <span class="grow">{e.text || cats.get(e.categoryId)?.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckpointScreen() {
  const [step, setStep] = useState(1);
  const [taskText, setTaskText] = useState('');
  const nowV = now.value;
  const times = setting<string[]>('checkpointTimes', DEFAULT_CHECKPOINTS);
  const last = setting<number | undefined>('lastCheckpointAt', undefined);
  // Фіксуємо чекпоінт на момент відкриття екрана, щоб заголовок не «стрибав».
  const [cp] = useState(() => dueCheckpoint(Date.now(), times, last));
  const since = last ?? 0;

  const sinceLast = useMemo(
    () => entries.value.filter((e) => !e.deletedAt && e.createdAt > since).sort((a, b) => a.createdAt - b.createdAt),
    [entries.value, since],
  );
  const newTasks = sinceLast.filter((e) => e.isTask);
  const open = useMemo(() => {
    const g = groupPending(entries.value, nowV);
    return { overdue: g.overdue, rest: [...g.today, ...g.dated, ...g.undated] };
  }, [entries.value, nowV]);
  const tomorrow = useMemo(() => (cp?.isEvening ? dueTomorrow(entries.value, nowV) : []), [entries.value, nowV, cp]);

  const addTask = async () => {
    const text = taskText.trim();
    const categoryId = quickTaskCategoryId();
    if (!text || !categoryId) return;
    await createEntry(db, { categoryId, text, isTask: true });
    setTaskText('');
  };

  const done = async () => {
    await finishCheckpoint();
    showToast(t.checkpoint.finished);
  };

  const steps = [t.checkpoint.step1, t.checkpoint.step2, t.checkpoint.step3];

  return (
    <div class="screen checkpoint">
      <header class="header">
        <h1 class="header-title">{cp ? t.checkpoint.title(cp.time) : t.checkpoint.title('')}</h1>
        <button class="btn ghost small" onClick={() => go('capture')}>
          {t.checkpoint.later}
        </button>
      </header>
      <div class="steps" aria-label="Кроки">
        {steps.map((_, i) => (
          <span key={i} class={`step-dot ${i + 1 === step ? 'on' : i + 1 < step ? 'past' : ''}`} />
        ))}
      </div>

      <div class="content">
        <h2 class="step-title">{steps[step - 1]}</h2>

        {step === 1 && (
          <>
            <p class="muted small">{t.checkpoint.step1Hint}</p>
            <CaptureForm draftKey="journal.checkpointDraft" />
            {sinceLast.length > 0 && (
              <section>
                <h3 class="day-title">{t.checkpoint.added(sinceLast.length)}</h3>
                <MiniList list={sinceLast} />
              </section>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p class="muted small">{t.checkpoint.step2Hint}</p>
            <div class="row">
              <input
                type="text"
                value={taskText}
                placeholder={t.checkpoint.step2Placeholder}
                enterkeyhint="done"
                onInput={(e) => setTaskText((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addTask();
                  }
                }}
              />
              <button class="btn primary" disabled={!taskText.trim()} onClick={() => void addTask()}>
                {t.dirs.add}
              </button>
            </div>
            <MiniList list={newTasks} />
          </>
        )}

        {step === 3 && (
          <>
            {tomorrow.length > 0 && (
              <section>
                <h3 class="day-title">
                  {t.checkpoint.tomorrow} <span class="muted">· {tomorrow.length}</span>
                </h3>
                <ul class="entries">
                  {tomorrow.map((e) => (
                    <TaskRow key={e.id} e={e} overdue={false} />
                  ))}
                </ul>
              </section>
            )}
            {open.overdue.length > 0 && (
              <section>
                <h3 class="day-title danger-text">
                  {t.pending.overdue} <span class="muted">· {open.overdue.length}</span>
                </h3>
                <ul class="entries">
                  {open.overdue.map((e) => (
                    <TaskRow key={e.id} e={e} overdue />
                  ))}
                </ul>
              </section>
            )}
            {open.rest.length > 0 && (
              <section>
                <h3 class="day-title">
                  {t.nav.pending} <span class="muted">· {open.rest.length}</span>
                </h3>
                <ul class="entries">
                  {open.rest.map((e) => (
                    <TaskRow key={e.id} e={e} overdue={false} />
                  ))}
                </ul>
              </section>
            )}
            {!open.overdue.length && !open.rest.length && <p class="muted">{t.pending.empty}</p>}
          </>
        )}

        <div class="step-nav">
          {step > 1 && (
            <button class="btn" onClick={() => setStep(step - 1)}>
              {t.checkpoint.back}
            </button>
          )}
          {step < 3 ? (
            <button class="btn primary grow" onClick={() => setStep(step + 1)}>
              {t.checkpoint.next}
            </button>
          ) : (
            <button class="btn primary grow" onClick={() => void done()}>
              {t.checkpoint.done}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
