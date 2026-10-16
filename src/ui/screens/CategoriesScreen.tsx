import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import { CATEGORY_KINDS, type Category, type FieldDef, type FieldType } from '../../domain/types';
import { makeFieldKey } from '../../domain/fields';
import { uuid } from '../../domain/uuid';
import { currentDeviceId, removeCategory, reorderCategories, saveCategory } from '../../db/repo';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { back, categories, db, go, showToast } from '../store';

const PALETTE = ['#f2a33a', '#4f9cff', '#3fbf7f', '#b48cff', '#ff7a8a', '#9aa3ad', '#e2584f', '#5cc8c8'];
const FIELD_TYPES: FieldType[] = ['text', 'number', 'date', 'select', 'person', 'vehicle', 'item', 'location'];

/* ---------- Список із перетягуванням ---------- */

export function CategoriesScreen() {
  const all = categories.value.filter((c) => !c.deletedAt);
  const active = all.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
  const archived = all.filter((c) => c.archived).sort((a, b) => a.order - b.order);
  const [order, setOrder] = useState<string[]>(active.map((c) => c.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const byId = new Map(all.map((c) => [c.id, c]));

  // Синхронізуємо локальний порядок зі сховищем, коли не тягнемо.
  const activeKey = active.map((c) => c.id).join();
  useEffect(() => {
    if (!dragId) setOrder(active.map((c) => c.id));
  }, [activeKey]);

  const onMove = (clientY: number) => {
    if (!dragId || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('[data-id]')];
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    setOrder((cur) => {
      const from = cur.indexOf(dragId);
      if (from === target || from < 0) return cur;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(target, 0, dragId);
      return next;
    });
  };

  const onDrop = async () => {
    if (!dragId) return;
    setDragId(null);
    await reorderCategories(db, order);
  };

  const row = (c: Category, draggable: boolean) => (
    <li key={c.id} data-id={c.id} class={`cat-row ${dragId === c.id ? 'dragging' : ''}`} style={{ '--cat': c.color }}>
      {draggable && (
        <span
          class="drag-handle"
          aria-label="Перетягнути"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragId(c.id);
          }}
          onPointerMove={(e) => dragId && onMove(e.clientY)}
          onPointerUp={() => void onDrop()}
          onPointerCancel={() => void onDrop()}
        >
          <Icon name="drag" size={20} />
        </span>
      )}
      <button class="cat-row-main" onClick={() => go('category', c.id)}>
        <span class="emoji">{c.emoji}</span>
        <span class="grow">
          {c.name}
          <span class="muted small block">
            {[c.group, c.defaultIsTask ? 'задача' : '', c.fieldSchema.length ? `полів: ${c.fieldSchema.length}` : ''].filter(Boolean).join(' · ')}
          </span>
        </span>
        <Icon name="next" size={18} />
      </button>
    </li>
  );

  return (
    <div class="screen categories">
      <Header title={t.catEditor.title} onBack />
      <div class="content">
        <button class="btn wide" onClick={() => go('category', 'new')}>
          + {t.catEditor.newCategory}
        </button>
        <p class="muted small">{t.catEditor.dragHint}</p>
        <ul class="entries" ref={listRef}>
          {order.map((id) => byId.get(id)).filter((c): c is Category => !!c && !c.archived).map((c) => row(c, true))}
        </ul>
        {archived.length > 0 && (
          <section>
            <h2 class="day-title">{t.catEditor.archivedSection}</h2>
            <ul class="entries">{archived.map((c) => row(c, false))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Редагування однієї категорії ---------- */

interface FieldDraft extends FieldDef {
  optionsText: string;
  isNew: boolean;
}

function toDraft(f: FieldDef): FieldDraft {
  return { ...f, optionsText: (f.options ?? []).join(', '), isNew: false };
}

export function CategoryEditScreen({ id }: { id: string }) {
  const existing = id === 'new' ? undefined : categories.value.find((c) => c.id === id);
  const groups = [...new Set(categories.value.filter((c) => !c.deletedAt).map((c) => c.group).filter(Boolean))];
  const [cat, setCat] = useState<Category>(
    () =>
      existing ?? {
        id: uuid(),
        name: '',
        emoji: '📝',
        color: PALETTE[5],
        group: groups[groups.length - 1] ?? '',
        order: Math.max(0, ...categories.value.map((c) => c.order)) + 10,
        archived: false,
        defaultIsTask: false,
        fieldSchema: [],
        updatedAt: 0,
        deviceId: currentDeviceId(),
      },
  );
  const [fields, setFields] = useState<FieldDraft[]>(() => (existing?.fieldSchema ?? []).map(toDraft));
  const [err, setErr] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <div class="screen">
        <Header title={t.catEditor.edit} onBack />
        <p class="empty">{t.edit.notFound}</p>
      </div>
    );
  }

  const set = (p: Partial<Category>) => setCat((c) => ({ ...c, ...p }));
  const setField = (i: number, p: Partial<FieldDraft>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const moveField = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    if (!cat.name.trim()) {
      setErr(t.catEditor.needName);
      return;
    }
    // Ключі існуючих полів не змінюються — інакше старі записи «загублять» значення.
    const keys: string[] = fields.filter((f) => !f.isNew).map((f) => f.key);
    const schema: FieldDef[] = [];
    for (const f of fields) {
      if (!f.label.trim()) continue;
      let key = f.key;
      if (f.isNew) {
        key = makeFieldKey(f.label, keys);
        keys.push(key);
      }
      const def: FieldDef = { key, label: f.label.trim(), type: f.type };
      if (f.type === 'number' && f.unit?.trim()) def.unit = f.unit.trim();
      if (f.type === 'select') {
        const opts = f.optionsText.split(',').map((s) => s.trim()).filter(Boolean);
        if (opts.length) def.options = opts;
      }
      schema.push(def);
    }
    const next: Category = { ...cat, name: cat.name.trim(), emoji: cat.emoji.trim() || '•', group: cat.group.trim(), fieldSchema: schema };
    if (!next.kind) delete next.kind;
    await saveCategory(db, next);
    showToast(t.capture.saved);
    back();
  };

  const remove = async () => {
    if (!confirm(t.catEditor.removeConfirm)) return;
    const r = await removeCategory(db, cat.id);
    showToast(r === 'archived' ? t.catEditor.archivedToast : t.catEditor.removed, undefined, 3000);
    back();
  };

  return (
    <div class="screen category-edit">
      <Header title={existing ? t.catEditor.edit : t.catEditor.newCategory} onBack />
      <div class="content">
        <div class="row">
          <label class="field emoji-field">
            <span class="field-label">{t.catEditor.emoji}</span>
            <input type="text" value={cat.emoji} maxLength={8} onInput={(e) => set({ emoji: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field grow">
            <span class="field-label">{t.catEditor.name}</span>
            <input type="text" value={cat.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
          </label>
        </div>
        {err && <p class="hint warn">{err}</p>}

        <div class="field">
          <span class="field-label">{t.catEditor.color}</span>
          <div class="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                class={`swatch ${cat.color === c ? 'on' : ''}`}
                style={{ '--swatch': c }}
                aria-label={c}
                onClick={() => set({ color: c })}
              />
            ))}
            <input type="color" class="swatch-input" value={cat.color} onInput={(e) => set({ color: (e.target as HTMLInputElement).value })} />
          </div>
        </div>

        <label class="field">
          <span class="field-label">{t.catEditor.group}</span>
          <input type="text" list="cat-groups" value={cat.group} onInput={(e) => set({ group: (e.target as HTMLInputElement).value })} />
          <datalist id="cat-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={cat.defaultIsTask} onChange={(e) => set({ defaultIsTask: (e.target as HTMLInputElement).checked })} />
          <span>{t.catEditor.defaultIsTask}</span>
        </label>
        {existing && (
          <label class="toggle-row">
            <input type="checkbox" checked={cat.archived} onChange={(e) => set({ archived: (e.target as HTMLInputElement).checked })} />
            <span>{t.catEditor.archived}</span>
          </label>
        )}

        <label class="field">
          <span class="field-label">{t.catEditor.kind}</span>
          <select value={cat.kind ?? ''} onChange={(e) => set({ kind: ((e.target as HTMLSelectElement).value || undefined) as Category['kind'] })}>
            {['', ...CATEGORY_KINDS].map((k) => (
              <option key={k} value={k}>
                {t.catEditor.kinds[k]}
              </option>
            ))}
          </select>
        </label>

        <section class="field-editor">
          <h2 class="day-title">{t.catEditor.fields}</h2>
          {fields.map((f, i) => (
            <div key={i} class="field-def">
              <div class="row">
                <input
                  type="text"
                  class="grow"
                  placeholder={t.catEditor.fieldLabel}
                  value={f.label}
                  onInput={(e) => setField(i, { label: (e.target as HTMLInputElement).value })}
                />
                <select class="type-select" value={f.type} onChange={(e) => setField(i, { type: (e.target as HTMLSelectElement).value as FieldType })}>
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {t.catEditor.types[ft]}
                    </option>
                  ))}
                </select>
              </div>
              {f.type === 'number' && (
                <input
                  type="text"
                  placeholder={t.catEditor.fieldUnit}
                  value={f.unit ?? ''}
                  onInput={(e) => setField(i, { unit: (e.target as HTMLInputElement).value })}
                />
              )}
              {f.type === 'select' && (
                <input
                  type="text"
                  placeholder={t.catEditor.fieldOptions}
                  value={f.optionsText}
                  onInput={(e) => setField(i, { optionsText: (e.target as HTMLInputElement).value })}
                />
              )}
              <div class="row field-def-actions">
                <button class="icon-btn small" aria-label="Вгору" disabled={i === 0} onClick={() => moveField(i, -1)}>
                  <Icon name="up" size={18} />
                </button>
                <button class="icon-btn small" aria-label="Вниз" disabled={i === fields.length - 1} onClick={() => moveField(i, 1)}>
                  <Icon name="down" size={18} />
                </button>
                <span class="grow" />
                <button class="btn ghost small" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
                  {t.common.delete}
                </button>
              </div>
            </div>
          ))}
          <button
            class="btn wide"
            onClick={() => setFields((fs) => [...fs, { key: '', label: '', type: 'text', optionsText: '', isNew: true }])}
          >
            + {t.catEditor.addField}
          </button>
        </section>

        <button class="btn primary big" onClick={() => void save()}>
          {t.common.save}
        </button>
        {existing && (
          <button class="btn danger wide" onClick={() => void remove()}>
            {t.catEditor.remove}
          </button>
        )}
      </div>
    </div>
  );
}
