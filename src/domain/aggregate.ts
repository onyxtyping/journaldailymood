import type { Category, Entry, FieldType } from './types';
import { toNumber } from './fields';

/**
 * Числові підсумки для «Вибірки». Категорія бере участь за своєю роллю (kind),
 * а потрібні поля шукаються за ключем, інакше — за типом (щоб працювало і з власними категоріями).
 */

function fieldKey(cat: Category, key: string, type?: FieldType): string | undefined {
  if (cat.fieldSchema.some((f) => f.key === key)) return key;
  return type ? cat.fieldSchema.find((f) => f.type === type)?.key : undefined;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : v != null && v !== '' ? String(v) : fallback;
}

const NONE = '—';

export type FuelOp = 'received' | 'issued' | 'fueled' | 'other';

export function fuelOp(v: unknown): FuelOp {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('отрим')) return 'received';
  if (s.startsWith('вида')) return 'issued';
  if (s.startsWith('запр')) return 'fueled';
  return 'other';
}

export interface FuelRow {
  vehicle: string;
  fuelType: string;
  received: number;
  issued: number;
  fueled: number;
  other: number;
}

export interface KmRow {
  vehicle: string;
  km: number;
  trips: number;
}

export interface PropertyRow {
  item: string;
  received: number;
  issued: number;
  writtenOff: number;
}

export interface FaultStats {
  total: number;
  closed: number;
  open: number;
  /** Середній час від події до закриття, мс; null — закритих немає. */
  avgCloseMs: number | null;
}

export interface Totals {
  fuel: FuelRow[];
  km: KmRow[];
  property: PropertyRow[];
  faults: FaultStats;
}

const byName = <T>(get: (x: T) => string) => (a: T, b: T) => get(a).localeCompare(get(b), 'uk');

export function computeTotals(entries: Entry[], cats: Map<string, Category>): Totals {
  const fuel = new Map<string, FuelRow>();
  const km = new Map<string, KmRow>();
  const property = new Map<string, PropertyRow>();
  const faults: FaultStats = { total: 0, closed: 0, open: 0, avgCloseMs: null };
  let closeSum = 0;

  for (const e of entries) {
    if (e.deletedAt) continue;
    const cat = cats.get(e.categoryId);
    if (!cat?.kind) continue;
    const f = e.fields;

    switch (cat.kind) {
      case 'fuel': {
        const liters = toNumber(f[fieldKey(cat, 'liters', 'number') ?? '']);
        if (liters == null) break;
        const vehicle = str(f[fieldKey(cat, 'vehicle', 'vehicle') ?? ''], NONE);
        const fuelType = str(f[fieldKey(cat, 'fuelType') ?? ''], NONE);
        const key = `${vehicle}\u0000${fuelType}`;
        const row = fuel.get(key) ?? { vehicle, fuelType, received: 0, issued: 0, fueled: 0, other: 0 };
        row[fuelOp(f[fieldKey(cat, 'operation', 'select') ?? ''])] += liters;
        fuel.set(key, row);
        break;
      }
      case 'trip': {
        const dist = toNumber(f[fieldKey(cat, 'km', 'number') ?? '']);
        const vehicle = str(f[fieldKey(cat, 'vehicle', 'vehicle') ?? ''], NONE);
        const row = km.get(vehicle) ?? { vehicle, km: 0, trips: 0 };
        row.trips++;
        if (dist != null) row.km += dist;
        km.set(vehicle, row);
        break;
      }
      case 'propIn':
      case 'propOut':
      case 'propOff': {
        const item = str(f[fieldKey(cat, 'item', 'item') ?? ''], '');
        if (!item) break;
        const qty = toNumber(f[fieldKey(cat, 'qty', 'number') ?? '']) ?? 1;
        const row = property.get(item.toLowerCase()) ?? { item, received: 0, issued: 0, writtenOff: 0 };
        if (cat.kind === 'propIn') row.received += qty;
        else if (cat.kind === 'propOut') row.issued += qty;
        else row.writtenOff += qty;
        property.set(item.toLowerCase(), row);
        break;
      }
      case 'fault': {
        faults.total++;
        if (e.isTask && e.status === 'done' && e.closedAt != null) {
          faults.closed++;
          closeSum += Math.max(0, e.closedAt - e.eventAt);
        } else if (!e.isTask || e.status === 'open') {
          faults.open++;
        }
        break;
      }
    }
  }
  faults.avgCloseMs = faults.closed ? closeSum / faults.closed : null;

  return {
    fuel: [...fuel.values()].sort((a, b) => byName<FuelRow>((r) => r.vehicle)(a, b) || a.fuelType.localeCompare(b.fuelType, 'uk')),
    km: [...km.values()].sort(byName<KmRow>((r) => r.vehicle)),
    property: [...property.values()].sort(byName<PropertyRow>((r) => r.item)),
    faults,
  };
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} д`);
  if (h) parts.push(`${h} год`);
  if (m || !parts.length) parts.push(`${m} хв`);
  return parts.join(' ');
}
