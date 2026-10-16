import { useMemo, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { t } from '../../i18n/uk';
import { periodRange } from '../../domain/filters';
import { buildReport, reportCsv, reportJson, reportText, totalsLines, type ReportQuery } from '../../domain/report';
import { addDays, dayKey, fmtTime, startOfDay } from '../../domain/time';
import { fieldsShort } from '../../domain/fields';
import { shareOrDownload } from '../../io/share';
import { Header } from '../components/Header';
import { groupCategories } from '../components/CategoryGrid';
import { TaskBadge } from '../components/EntryRow';
import { categories, catMap, entries, go, now, showToast } from '../store';

type Kind = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
const KINDS: Kind[] = ['today', 'yesterday', 'week', 'month', 'custom'];

interface ReportState {
  kind: Kind;
  from: string;
  to: string;
  categoryIds: string[];
}

// Стан вибірки живе поза компонентом — не скидається при переході між екранами.
const state = signal<ReportState>({ kind: 'today', from: '', to: '', categoryIds: [] });

function dateToMs(s: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : undefined;
}

function queryOf(s: ReportState, nowV: number): ReportQuery {
  if (s.kind === 'custom') {
    const from = dateToMs(s.from);
    const toDay = dateToMs(s.to);
    return { from, to: toDay != null ? addDays(startOfDay(toDay), 1) - 1 : undefined, categoryIds: s.categoryIds };
  }
  return { ...periodRange(s.kind, nowV), categoryIds: s.categoryIds };
}

function fileBase(q: ReportQuery): string {
  const a = q.from != null ? dayKey(q.from) : 'start';
  const b = q.to != null ? dayKey(q.to) : 'now';
  return a === b ? `journal-${a}` : `journal-${a}_${b}`;
}

const dayFmt = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' });

export function ReportScreen() {
  const s = state.value;
  const nowV = now.value;
  const cats = catMap.value;
  const [catsOpen, setCatsOpen] = useState(false);
  const set = (p: Partial<ReportState>) => (state.value = { ...state.value, ...p });

  const q = useMemo(() => queryOf(s, nowV), [s, nowV]);
  const report = useMemo(() => buildReport(entries.value, cats, q), [entries.value, cats, q]);
  const totals = totalsLines(report.totals);
  const multiDay = q.from == null || q.to == null || q.to - q.from > 86_400_000;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(report));
      showToast(t.report.copied);
    } catch {
      showToast(t.report.copyFailed);
    }
  };

  const save = (ext: 'txt' | 'csv' | 'json') => {
    const content = ext === 'txt' ? reportText(report) : ext === 'csv' ? reportCsv(report) : reportJson(report);
    const mime = ext === 'txt' ? 'text/plain' : ext === 'csv' ? 'text/csv' : 'application/json';
    void shareOrDownload(`${fileBase(q)}.${ext}`, content, `${mime};charset=utf-8`);
  };

  const toggleCat = (id: string) =>
    set({ categoryIds: s.categoryIds.includes(id) ? s.categoryIds.filter((x) => x !== id) : [...s.categoryIds, id] });

  return (
    <div class="screen report">
      <Header title={t.report.title} />
      <div class="filters">
        <div class="chips scroll-x">
          {KINDS.map((k) => (
            <button key={k} class={`chip ${s.kind === k ? 'on' : ''}`} onClick={() => set({ kind: k })}>
              {t.report.periods[k]}
            </button>
          ))}
        </div>
        {s.kind === 'custom' && (
          <div class="row">
            <label class="field grow">
              <span class="field-label">{t.report.from}</span>
              <input type="date" value={s.from} onInput={(e) => set({ from: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="field grow">
              <span class="field-label">{t.report.to}</span>
              <input type="date" value={s.to} onInput={(e) => set({ to: (e.target as HTMLInputElement).value })} />
            </label>
          </div>
        )}
        <div class="chips">
          <button class={`chip ${s.categoryIds.length ? 'on' : ''}`} onClick={() => setCatsOpen(!catsOpen)}>
            {s.categoryIds.length ? `${t.journal.categories} · ${s.categoryIds.length}` : t.report.allCategories} ▾
          </button>
          {s.categoryIds.length > 0 && (
            <button class="chip ghost" onClick={() => set({ categoryIds: [] })}>
              {t.journal.resetFilters}
            </button>
          )}
        </div>
        {catsOpen && (
          <div class="filter-panel">
            {groupCategories(categories.value.filter((c) => !c.deletedAt)).map(([g, list]) => (
              <div key={g} class="chips wrap">
                {list.map((c) => (
                  <button key={c.id} class={`chip ${s.categoryIds.includes(c.id) ? 'on' : ''}`} onClick={() => toggleCat(c.id)}>
                    <span class="emoji">{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="content">
        <div class="report-actions">
          <button class="btn primary" disabled={!report.entries.length} onClick={() => void copy()}>
            {t.report.copy}
          </button>
          <button class="btn" disabled={!report.entries.length} onClick={() => save('txt')}>
            {t.report.exportTxt}
          </button>
          <button class="btn" disabled={!report.entries.length} onClick={() => save('csv')}>
            {t.report.exportCsv}
          </button>
          <button class="btn" disabled={!report.entries.length} onClick={() => save('json')}>
            {t.report.exportJson}
          </button>
        </div>

        {!report.entries.length && <p class="empty">{t.report.empty}</p>}

        {report.entries.length > 0 && <p class="muted small">{t.report.count(report.entries.length)}</p>}

        {totals.length > 0 && (
          <section class="totals">
            <h2 class="day-title">{t.report.totals}</h2>
            {totals.map((block) => (
              <div key={block.title} class="totals-block">
                <div class="totals-title">{block.title}</div>
                {block.lines.map((l) => (
                  <div key={l} class="totals-line">
                    {l}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {report.groups.map((g) => (
          <section key={g.categoryId}>
            <h2 class="day-title">
              {g.cat ? `${g.cat.emoji} ${g.cat.name}` : '—'} <span class="muted">· {g.items.length}</span>
            </h2>
            <ul class="entries">
              {g.items.map((e) => {
                const short = fieldsShort(e, g.cat);
                return (
                  <li key={e.id} class="entry report-entry" style={{ '--cat': g.cat?.color ?? '#888' }}>
                    <button class="entry-main plain" onClick={() => go('edit', e.id)}>
                      <span class="entry-time">
                        {multiDay && <span class="entry-date">{dayFmt.format(e.eventAt)}</span>}
                        {fmtTime(e.eventAt)}
                      </span>
                      <div class="entry-body">
                        {e.text && <div class="entry-text">{e.text}</div>}
                        {short && <div class={e.text ? 'entry-fields' : 'entry-text'}>{short}</div>}
                        {e.isTask && (
                          <div class="entry-meta">
                            <TaskBadge e={e} now={nowV} />
                            {e.closeNote && <span>— {e.closeNote}</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
