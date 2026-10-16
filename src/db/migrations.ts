import { SEED_KINDS, seedId } from './seed';

/**
 * Чисті функції перетворення даних між версіями схеми.
 * Використовуються і в Dexie upgrade(), і в міграціях бекапу — щоб логіка була одна.
 */

const KIND_BY_ID = new Map(Object.entries(SEED_KINDS).map(([n, kind]) => [seedId(Number(n)), kind]));

/** v1 → v2: seed-категоріям проставляється роль для підсумків (пальне, майно, несправності…). */
export function v2AddSeedKind<T extends { id: string; kind?: string }>(c: T): T {
  if (c.kind) return c;
  const kind = KIND_BY_ID.get(c.id);
  return kind ? { ...c, kind } : c;
}
