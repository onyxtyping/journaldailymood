import { useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Category } from '../../domain/types';
import { GROUP_ORDER } from '../../db/seed';
import { recentCategoryIds } from '../../domain/filters';
import { activeCategories, catMap, entries } from '../store';

const RECENT_LIMIT = 8;

function CatButton({ c, selected, onPick }: { c: Category; selected: boolean; onPick: (c: Category) => void }) {
  return (
    <button
      class={`cat-btn ${selected ? 'selected' : ''}`}
      style={{ '--cat': c.color }}
      aria-pressed={selected}
      onClick={() => onPick(c)}
    >
      <span class="emoji" aria-hidden="true">
        {c.emoji}
      </span>
      <span class="cat-name">{c.name}</span>
    </button>
  );
}

export function groupCategories(cats: Category[]): [string, Category[]][] {
  const map = new Map<string, Category[]>();
  for (const c of cats) {
    const g = c.group || '';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(c);
  }
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i < 0 ? GROUP_ORDER.length : i;
  };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'uk'));
}

export function CategoryGrid({ selectedId, onPick }: { selectedId: string | null; onPick: (c: Category) => void }) {
  const [expanded, setExpanded] = useState(false);
  const active = activeCategories.value;
  const cats = catMap.value;

  // Останні використані; якщо їх мало — доповнюємо першими за порядком.
  const recent = recentCategoryIds(entries.value, cats, RECENT_LIMIT).map((id) => cats.get(id)!);
  for (const c of active) {
    if (recent.length >= RECENT_LIMIT) break;
    if (!recent.includes(c)) recent.push(c);
  }

  const pick = (c: Category) => {
    onPick(c);
    setExpanded(false);
  };

  return (
    <div class="cat-grid-wrap">
      <div class="cat-grid">
        {recent.map((c) => (
          <CatButton key={c.id} c={c} selected={c.id === selectedId} onPick={pick} />
        ))}
      </div>
      <button class="more-btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? t.common.less : `${t.capture.allCategories} ${t.common.more}`}
      </button>
      {expanded &&
        groupCategories(active).map(([group, list]) => (
          <section key={group} class="cat-group">
            <h3 class="cat-group-title">{group}</h3>
            <div class="cat-grid">
              {list.map((c) => (
                <CatButton key={c.id} c={c} selected={c.id === selectedId} onPick={pick} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
