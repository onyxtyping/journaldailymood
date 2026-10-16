import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Category, Entry } from '../../domain/types';
import { createEntry, rememberDirectoryValues } from '../../db/repo';
import { Icon } from './Icon';
import { CategoryGrid } from './CategoryGrid';
import { EntryDetails, draftIsEmpty, draftToInput, emptyDraft, hasFieldValues, type EntryDraft } from './EntryDetails';
import { catMap, db, showToast } from '../store';

function loadDraft(key: string): EntryDraft {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch {
    /* сховище недоступне — починаємо з порожньої чернетки */
  }
  return emptyDraft();
}

function storeDraft(key: string, d: EntryDraft): void {
  try {
    if (draftIsEmpty(d) && !d.categoryId) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* ігноруємо */
  }
}

/**
 * Швидкий ввід запису: категорія → текст → «Зберегти». Деталі (поля, теги, задача) згорнуті.
 * Чернетка зберігається на кожну зміну під ключем draftKey.
 */
export function CaptureForm({ draftKey, onSaved }: { draftKey: string; onSaved?: (e: Entry) => void }) {
  const [draft, setDraft] = useState<EntryDraft>(() => loadDraft(draftKey));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cat = draft.categoryId ? catMap.value.get(draft.categoryId) : undefined;
  const filled = Object.values(draft.fields).filter((v) => v != null && String(v).trim() !== '').length;

  useEffect(() => storeDraft(draftKey, draft), [draft]);

  const patch = (p: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...p }));

  const pickCategory = (c: Category) => {
    setHint(null);
    setDraft((d) => ({
      ...d,
      categoryId: c.id,
      isTask: d.isTaskTouched ? d.isTask : c.defaultIsTask,
      // Поля попередньої категорії не переносимо.
      fields: d.categoryId === c.id ? d.fields : {},
    }));
    // Фокус у межах натиску — на iOS це відкриває клавіатуру.
    textRef.current?.focus();
  };

  const save = async () => {
    if (saving) return;
    if (!draft.categoryId || !cat) {
      setHint(t.capture.needCategory);
      return;
    }
    if (!draft.text.trim() && !hasFieldValues(draft.fields)) {
      setHint(t.capture.needText);
      textRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const input = draftToInput(draft, cat);
      const e = await createEntry(db, input);
      await rememberDirectoryValues(db, cat, input.fields);
      setDraft(emptyDraft());
      setDetailsOpen(false);
      setHint(null);
      showToast(`${t.capture.saved}: ${cat.emoji} ${cat.name}`);
      onSaved?.(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CategoryGrid selectedId={draft.categoryId} onPick={pickCategory} />

      <div class="capture-box">
        {cat ? (
          <div class="selected-cat" style={{ '--cat': cat.color }}>
            <span class="emoji">{cat.emoji}</span>
            <span class="grow">{cat.name}</span>
            {draft.isTask && <span class="pill task">задача</span>}
            <button class="icon-btn small" aria-label={t.common.cancel} onClick={() => patch({ categoryId: null, fields: {} })}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : (
          <div class={`selected-cat placeholder ${hint === t.capture.needCategory ? 'warn' : ''}`}>{t.capture.chooseCategory}</div>
        )}
        <textarea
          ref={textRef}
          class="capture-text"
          rows={4}
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
        {hint && <p class="hint warn">{hint}</p>}
        <button class="btn primary big" disabled={saving} onClick={() => void save()}>
          {t.common.save}
        </button>
      </div>

      <details class="details" open={detailsOpen} onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}>
        <summary>
          <span>
            {t.capture.details}
            {cat?.fieldSchema.length ? <span class="muted"> · {filled ? `${filled}/${cat.fieldSchema.length}` : `${cat.fieldSchema.length} полів`}</span> : null}
          </span>
        </summary>
        <EntryDetails draft={draft} cat={cat} onChange={patch} />
      </details>
    </>
  );
}
