import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Category } from '../../domain/types';
import { createEntry } from '../../db/repo';
import { Header } from '../components/Header';
import { CategoryGrid } from '../components/CategoryGrid';
import { EntryDetails, draftIsEmpty, draftToInput, emptyDraft, type EntryDraft } from '../components/EntryDetails';
import { catMap, db, showToast } from '../store';

const DRAFT_KEY = 'journal.captureDraft';

function loadDraft(): EntryDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch {
    /* сховище недоступне — починаємо з порожньої чернетки */
  }
  return emptyDraft();
}

function storeDraft(d: EntryDraft): void {
  try {
    if (draftIsEmpty(d) && !d.categoryId) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ігноруємо */
  }
}

export function CaptureScreen() {
  const [draft, setDraft] = useState<EntryDraft>(loadDraft);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cat = draft.categoryId ? catMap.value.get(draft.categoryId) : undefined;

  // Чернетка зберігається на кожну зміну — якщо застосунок закриють посеред набору.
  useEffect(() => storeDraft(draft), [draft]);

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
    if (!draft.text.trim() && !Object.keys(draft.fields).length) {
      setHint(t.capture.needText);
      textRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await createEntry(db, draftToInput(draft));
      setDraft(emptyDraft());
      setDetailsOpen(false);
      setHint(null);
      showToast(`${t.capture.saved}: ${cat.emoji} ${cat.name}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="screen capture">
      <Header title={t.capture.title} />
      <div class="content">
        <CategoryGrid selectedId={draft.categoryId} onPick={pickCategory} />

        <div class="capture-box">
          {cat ? (
            <div class="selected-cat" style={{ '--cat': cat.color }}>
              <span class="emoji">{cat.emoji}</span>
              <span class="grow">{cat.name}</span>
              {draft.isTask && <span class="pill task">задача</span>}
              <button class="icon-btn small" aria-label={t.common.cancel} onClick={() => patch({ categoryId: null, fields: {} })}>
                ×
              </button>
            </div>
          ) : (
            <div class={`selected-cat placeholder ${hint === t.capture.needCategory ? 'warn' : ''}`}>
              {t.capture.chooseCategory}
            </div>
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
          <summary>{t.capture.details}</summary>
          <EntryDetails draft={draft} onChange={patch} />
        </details>
      </div>
    </div>
  );
}
