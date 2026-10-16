import { t } from '../../i18n/uk';
import type { Category, FieldDef } from '../../domain/types';
import { DIRECTORY_OF } from '../../domain/fields';
import { directories } from '../store';

/**
 * Поля за схемою категорії. Усі необов'язкові.
 * Поля-довідники — звичайний input з <datalist>: на iOS підказки з'являються над клавіатурою.
 */
export function CategoryFields({
  cat,
  values,
  onChange,
}: {
  cat: Category;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!cat.fieldSchema.length) return null;
  return (
    <div class="cat-fields">
      {cat.fieldSchema.map((def) => (
        <FieldInput key={def.key} def={def} catId={cat.id} value={values[def.key]} onChange={(v) => onChange(def.key, v)} />
      ))}
    </div>
  );
}

function FieldInput({ def, catId, value, onChange }: { def: FieldDef; catId: string; value: unknown; onChange: (v: unknown) => void }) {
  const label = def.unit ? `${def.label}, ${def.unit}` : def.label;
  const str = value == null ? '' : String(value);
  const dir = DIRECTORY_OF[def.type];

  if (def.type === 'select' && def.options?.length) {
    // До 4 варіантів — кнопки (один натиск), більше — випадний список.
    if (def.options.length <= 4) {
      return (
        <div class="field">
          <span class="field-label">{label}</span>
          <div class="segmented wrap" role="radiogroup">
            {def.options.map((o) => (
              <button key={o} role="radio" aria-checked={str === o} class={str === o ? 'on' : ''} onClick={() => onChange(str === o ? '' : o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label class="field">
        <span class="field-label">{label}</span>
        <select value={str} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
          <option value="">{t.fields.choose}</option>
          {def.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (def.type === 'number') {
    return (
      <label class="field">
        <span class="field-label">{label}</span>
        <input
          type="text"
          inputMode="decimal"
          autocomplete="off"
          value={str}
          onInput={(e) => {
            const raw = (e.target as HTMLInputElement).value;
            const n = Number(raw.replace(',', '.'));
            // Зберігаємо число, коли воно валідне; інакше — рядок як є (щоб не губити набране).
            onChange(raw.trim() === '' ? '' : Number.isFinite(n) && !/[.,]$/.test(raw) ? n : raw);
          }}
        />
      </label>
    );
  }

  if (def.type === 'date') {
    return (
      <label class="field">
        <span class="field-label">{label}</span>
        <input type="date" value={str} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
      </label>
    );
  }

  const listId = dir ? `dl-${catId}-${def.key}` : undefined;
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <input
        type="text"
        list={listId}
        autocomplete="off"
        autocapitalize="sentences"
        value={str}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      />
      {dir && (
        <datalist id={listId}>
          {directories[dir].value.map((r) => (
            <option key={r.id} value={r.name} />
          ))}
        </datalist>
      )}
    </label>
  );
}
