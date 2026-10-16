import { useMemo, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { t } from '../../i18n/uk';
import { allTags, filterEntries, groupByDay, periodRange, type PeriodKind } from '../../domain/filters';
import { fmtDayHeader } from '../../domain/time';
import { makeTask, restoreEntry, softDeleteEntry } from '../../db/repo';
import { Header } from '../components/Header';
import { EntryRow } from '../components/EntryRow';
import { groupCategories } from '../components/CategoryGrid';
import { activeCategories, catMap, db, entries, go, liveEntries, now, showToast } from '../store';

interface JournalFilters {
  q: string;
  period: PeriodKind;
  onlyTasks: boolean;
  categoryIds: string[];
  tags: string[];
}

const emptyFilters: JournalFilters = { q: '', period: 'all', onlyTasks: false, categoryIds: [], tags: [] };

// Фільтри живуть поза компонентом — не скидаються при переході в запис і назад.
const filters = signal<JournalFilters>(emptyFilters);

const PERIODS: PeriodKind[] = ['all', 'today', 'yesterday', 'week', 'month'];
const PAGE = 200;

export function JournalScreen() {
  const f = filters.value;
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [panel, setPanel] = useState<'cats' | 'tags' | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const cats = catMap.value;
  const nowV = now.value;

  const set = (p: Partial<JournalFilters>) => {
    filters.value = { ...filters.value, ...p };
    setLimit(PAGE);
  };

  const list = useMemo(() => {
    const range = periodRange(f.period, nowV);
    return filterEntries(liveEntries.value, { ...range, q: f.q, onlyTasks: f.onlyTasks, categoryIds: f.categoryIds, tags: f.tags }, cats);
  }, [entries.value, f, cats, nowV]);

  const days = useMemo(() => groupByDay(list), [list]);
  const tags = useMemo(() => allTags(entries.value), [entries.value]);
  const hasFilters = f.q || f.period !== 'all' || f.onlyTasks || f.categoryIds.length || f.tags.length;

  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  let shown = 0;

  return (
    <div class="screen journal">
      <Header title={t.nav.journal} />
      <div class="filters">
        <input
          type="search"
          class="search"
          value={f.q}
          placeholder={t.journal.search}
          enterkeyhint="search"
          onInput={(e) => set({ q: (e.target as HTMLInputElement).value })}
        />
        <div class="chips scroll-x">
          {PERIODS.map((p) => (
            <button key={p} class={`chip ${f.period === p ? 'on' : ''}`} onClick={() => set({ period: p })}>
              {t.journal.periods[p]}
            </button>
          ))}
        </div>
        <div class="chips">
          <button class={`chip ${f.onlyTasks ? 'on' : ''}`} onClick={() => set({ onlyTasks: !f.onlyTasks })}>
            {t.journal.onlyTasks}
          </button>
          <button class={`chip ${f.categoryIds.length ? 'on' : ''}`} onClick={() => setPanel(panel === 'cats' ? null : 'cats')}>
            {t.journal.categories}
            {f.categoryIds.length ? ` · ${f.categoryIds.length}` : ''} ▾
          </button>
          {tags.length > 0 && (
            <button class={`chip ${f.tags.length ? 'on' : ''}`} onClick={() => setPanel(panel === 'tags' ? null : 'tags')}>
              {t.journal.tags}
              {f.tags.length ? ` · ${f.tags.length}` : ''} ▾
            </button>
          )}
          {hasFilters ? (
            <button class="chip ghost" onClick={() => (filters.value = emptyFilters)}>
              {t.journal.resetFilters}
            </button>
          ) : null}
        </div>
        {panel === 'cats' && (
          <div class="filter-panel">
            {groupCategories([...activeCategories.value, ...[...cats.values()].filter((c) => c.archived && !c.deletedAt)]).map(([g, list]) => (
              <div key={g} class="chips wrap">
                {list.map((c) => (
                  <button
                    key={c.id}
                    class={`chip ${f.categoryIds.includes(c.id) ? 'on' : ''}`}
                    onClick={() => set({ categoryIds: toggleIn(f.categoryIds, c.id) })}
                  >
                    <span class="emoji">{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {panel === 'tags' && (
          <div class="filter-panel chips wrap">
            {tags.map((tag) => (
              <button key={tag} class={`chip ${f.tags.includes(tag) ? 'on' : ''}`} onClick={() => set({ tags: toggleIn(f.tags, tag) })}>
                #{tag}
              </button>
            ))}
          </div>
        )}
        {hasFilters ? <div class="muted small">{t.journal.count(list.length)}</div> : null}
      </div>

      <div class="content">
        {days.length === 0 && <p class="empty">{hasFilters ? t.journal.emptyFiltered : t.journal.empty}</p>}
        {days.map((d) => {
          if (shown >= limit) return null;
          const items = d.items.slice(0, limit - shown);
          shown += items.length;
          return (
            <section key={d.key} class="day">
              <h2 class="day-title">
                {fmtDayHeader(d.start, nowV, { today: t.common.today, yesterday: t.common.yesterday })}
                <span class="muted"> · {d.items.length}</span>
              </h2>
              <ul class="entries">
                {items.map((e) => (
                  <EntryRow
                    key={e.id}
                    e={e}
                    cat={cats.get(e.categoryId)}
                    now={nowV}
                    actionsOpen={actionsFor === e.id}
                    onOpen={() => go('edit', e.id)}
                    onActions={(open) => setActionsFor(open ? e.id : null)}
                    onDelete={async () => {
                      setActionsFor(null);
                      await softDeleteEntry(db, e.id);
                      showToast(t.journal.moved, { label: t.common.undo, run: () => void restoreEntry(db, e.id) });
                    }}
                    onMakeTask={async () => {
                      setActionsFor(null);
                      await makeTask(db, e.id);
                      showToast(t.journal.madeTask);
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {list.length > limit && (
          <button class="btn wide" onClick={() => setLimit(limit + PAGE)}>
            {t.common.more}
          </button>
        )}
      </div>
    </div>
  );
}
