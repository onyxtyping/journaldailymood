import { useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { TaskStatus } from '../../domain/types';
import { fmtDateTime } from '../../domain/time';
import { restoreEntry, setTaskStatus, softDeleteEntry, updateEntry } from '../../db/repo';
import { Header } from '../components/Header';
import { EntryDetails, draftFromEntry, draftToInput, type EntryDraft } from '../components/EntryDetails';
import { groupCategories } from '../components/CategoryGrid';
import { back, categories, catMap, db, entries, showToast } from '../store';

export function EditScreen({ id }: { id: string }) {
  const entry = entries.value.find((e) => e.id === id);
  const [draft, setDraft] = useState<EntryDraft | null>(() => (entry ? draftFromEntry(entry) : null));
  const [note, setNote] = useState(entry?.closeNote ?? '');

  if (!entry || !draft) {
    return (
      <div class="screen">
        <Header title={t.edit.title} onBack />
        <p class="empty">{t.edit.notFound}</p>
      </div>
    );
  }

  const patch = (p: Partial<EntryDraft>) => setDraft((d) => ({ ...d!, ...p }));
  const cat = catMap.value.get(draft.categoryId ?? '');
  // У виборі — активні категорії плюс поточна, навіть якщо вона архівована.
  const selectable = categories.value.filter((c) => !c.deletedAt && (!c.archived || c.id === entry.categoryId));

  const save = async () => {
    const input = draftToInput(draft);
    await updateEntry(db, entry.id, {
      categoryId: input.categoryId,
      text: input.text.trim(),
      tags: input.tags,
      fields: input.fields,
      eventAt: input.eventAt ?? entry.eventAt,
      isTask: input.isTask,
      dueAt: input.dueAt,
      priority: input.priority,
      ...(entry.isTask && entry.status !== 'open' ? { closeNote: note.trim() || undefined } : {}),
      ...(input.isTask && !entry.isTask ? { status: 'open' as TaskStatus } : {}),
    });
    showToast(t.capture.saved);
    back();
  };

  const remove = async () => {
    await softDeleteEntry(db, entry.id);
    showToast(t.edit.deleted, { label: t.common.undo, run: () => void restoreEntry(db, entry.id) });
    back();
  };

  const setStatus = async (s: TaskStatus) => {
    await setTaskStatus(db, entry.id, s, s === 'open' ? undefined : note);
  };

  return (
    <div class="screen edit">
      <Header title={t.edit.title} onBack />
      <div class="content">
        <label class="field">
          <span class="field-label">Категорія</span>
          <select
            value={draft.categoryId ?? ''}
            style={{ '--cat': cat?.color ?? '#888' }}
            onChange={(e) => patch({ categoryId: (e.target as HTMLSelectElement).value })}
          >
            {groupCategories(selectable).map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <textarea
          class="capture-text"
          rows={5}
          value={draft.text}
          placeholder={t.capture.placeholder}
          onInput={(e) => patch({ text: (e.target as HTMLTextAreaElement).value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save();
            }
          }}
        />

        <EntryDetails draft={draft} onChange={patch} />

        {entry.isTask && (
          <div class="field">
            <span class="field-label">{t.edit.status}</span>
            <div class="segmented">
              {(['open', 'done', 'cancelled'] as TaskStatus[]).map((s) => (
                <button key={s} class={entry.status === s ? 'on' : ''} onClick={() => void setStatus(s)}>
                  {t.task[s]}
                </button>
              ))}
            </div>
            {entry.status !== 'open' && (
              <input
                type="text"
                value={note}
                placeholder={t.task.closeNote}
                onInput={(e) => setNote((e.target as HTMLInputElement).value)}
              />
            )}
            {entry.closedAt && <span class="muted small">{fmtDateTime(entry.closedAt)}</span>}
          </div>
        )}

        <button class="btn primary big" onClick={() => void save()}>
          {t.common.save}
        </button>

        <p class="muted small meta-line">
          {t.edit.created}: {fmtDateTime(entry.createdAt)} · {t.edit.updated}: {fmtDateTime(entry.updatedAt)}
        </p>

        <button class="btn danger wide" onClick={() => void remove()}>
          {t.common.delete}
        </button>
      </div>
    </div>
  );
}
