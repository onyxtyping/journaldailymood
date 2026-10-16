import { t } from '../../i18n/uk';
import type { Entry, Priority } from '../../domain/types';
import { fromLocalInput, toLocalInput } from '../../domain/time';
import { parseTags } from '../../db/repo';

/** Стан форми запису (і для нового, і для редагування). Дати — рядки datetime-local. */
export interface EntryDraft {
  categoryId: string | null;
  text: string;
  tags: string;
  isTask: boolean;
  /** Користувач сам перемкнув «це задача» — тоді вибір категорії його не перезаписує. */
  isTaskTouched: boolean;
  dueAt: string;
  priority: Priority;
  /** Порожньо = «зараз». */
  eventAt: string;
  fields: Record<string, unknown>;
}

export function emptyDraft(): EntryDraft {
  return { categoryId: null, text: '', tags: '', isTask: false, isTaskTouched: false, dueAt: '', priority: 'normal', eventAt: '', fields: {} };
}

export function draftFromEntry(e: Entry): EntryDraft {
  return {
    categoryId: e.categoryId,
    text: e.text,
    tags: e.tags.join(', '),
    isTask: e.isTask,
    isTaskTouched: true,
    dueAt: toLocalInput(e.dueAt),
    priority: e.priority ?? 'normal',
    eventAt: toLocalInput(e.eventAt),
    fields: { ...e.fields },
  };
}

export function draftIsEmpty(d: EntryDraft): boolean {
  return !d.text.trim() && !d.tags.trim() && !d.dueAt && !d.eventAt && !Object.keys(d.fields).length;
}

export function draftToInput(d: EntryDraft) {
  return {
    categoryId: d.categoryId!,
    text: d.text,
    tags: parseTags(d.tags),
    fields: d.fields,
    eventAt: fromLocalInput(d.eventAt),
    isTask: d.isTask,
    dueAt: d.isTask ? fromLocalInput(d.dueAt) : undefined,
    priority: d.isTask && d.priority !== 'normal' ? d.priority : undefined,
  };
}

const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

export function EntryDetails({ draft, onChange }: { draft: EntryDraft; onChange: (patch: Partial<EntryDraft>) => void }) {
  return (
    <div class="details-body">
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={draft.isTask}
          onChange={(e) => onChange({ isTask: (e.target as HTMLInputElement).checked, isTaskTouched: true })}
        />
        <span>{t.capture.isTask}</span>
      </label>

      {draft.isTask && (
        <>
          <label class="field">
            <span class="field-label">{t.capture.due}</span>
            <div class="row">
              <input
                type="datetime-local"
                value={draft.dueAt}
                onInput={(e) => onChange({ dueAt: (e.target as HTMLInputElement).value })}
              />
              {draft.dueAt && (
                <button class="icon-btn" aria-label={t.common.cancel} onClick={() => onChange({ dueAt: '' })}>
                  ×
                </button>
              )}
            </div>
          </label>
          <div class="field">
            <span class="field-label">{t.capture.priority}</span>
            <div class="segmented" role="radiogroup">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={draft.priority === p}
                  class={draft.priority === p ? 'on' : ''}
                  onClick={() => onChange({ priority: p })}
                >
                  {t.capture.priorities[p]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <label class="field">
        <span class="field-label">{t.capture.eventAt}</span>
        <div class="row">
          <input
            type="datetime-local"
            value={draft.eventAt}
            placeholder={t.capture.eventAtNow}
            onInput={(e) => onChange({ eventAt: (e.target as HTMLInputElement).value })}
          />
          {draft.eventAt && (
            <button class="btn small" onClick={() => onChange({ eventAt: '' })}>
              {t.capture.eventAtNow}
            </button>
          )}
        </div>
      </label>

      <label class="field">
        <span class="field-label">{t.capture.tags}</span>
        <input
          type="text"
          value={draft.tags}
          autocapitalize="off"
          autocomplete="off"
          placeholder={t.capture.tagsPlaceholder}
          onInput={(e) => onChange({ tags: (e.target as HTMLInputElement).value })}
        />
      </label>
    </div>
  );
}
