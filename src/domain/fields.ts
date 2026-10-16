import type { Category, Entry, FieldDef, FieldType } from './types';

/** Типи полів, що беруть значення з довідників (і поповнюють їх). */
export const DIRECTORY_OF: Partial<Record<FieldType, 'people' | 'vehicles' | 'items' | 'locations'>> = {
  person: 'people',
  vehicle: 'vehicles',
  item: 'items',
  location: 'locations',
};

export function isEmptyValue(v: unknown): boolean {
  return v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));
}

export function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

/** «2026-10-16» → «16.10.2026». */
export function fmtDateValue(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
}

export function fmtFieldValue(def: FieldDef | undefined, v: unknown): string {
  if (isEmptyValue(v)) return '';
  if (def?.type === 'number') {
    const n = toNumber(v);
    if (n == null) return String(v);
    return def.unit ? `${fmtNum(n)} ${def.unit}` : fmtNum(n);
  }
  if (def?.type === 'date' && typeof v === 'string') return fmtDateValue(v);
  return String(v);
}

/** Пари «поле — значення» за схемою категорії; поля поза схемою (з минулих версій) — в кінці. */
export function fieldPairs(e: Entry, cat?: Category): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const def of cat?.fieldSchema ?? []) {
    seen.add(def.key);
    const value = fmtFieldValue(def, e.fields[def.key]);
    if (value) out.push({ label: def.label, value });
  }
  for (const [key, v] of Object.entries(e.fields)) {
    if (seen.has(key)) continue;
    const value = fmtFieldValue(undefined, v);
    if (value) out.push({ label: key, value });
  }
  return out;
}

/** Компактний рядок для журналу: «Пікап-12 · ДП · 40 л». */
export function fieldsShort(e: Entry, cat?: Category): string {
  return fieldPairs(e, cat)
    .map((p) => p.value)
    .join(' · ');
}

/** Перед збереженням: числові поля — у числа (кома як десятковий роздільник). */
export function coerceFields(cat: Category | undefined, fields: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fields };
  for (const def of cat?.fieldSchema ?? []) {
    if (def.type !== 'number' || isEmptyValue(out[def.key])) continue;
    const n = toNumber(out[def.key]);
    if (n != null) out[def.key] = n;
  }
  return out;
}

/** Стабільний ключ поля з назви (латиницею), унікальний у межах схеми. */
export function makeFieldKey(label: string, existing: string[]): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya',
  };
  const base =
    label
      .toLowerCase()
      .split('')
      .map((ch) => map[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'field';
  let key = base;
  for (let i = 2; existing.includes(key); i++) key = `${base}_${i}`;
  return key;
}
