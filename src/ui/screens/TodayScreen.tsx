import { useMemo } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Entry } from '../../domain/types';
import { todayOverview } from '../../domain/today';
import { Header } from '../components/Header';
import { TaskRow } from './PendingScreen';
import { catMap, entries, now } from '../store';

const dateFmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

function Section({ title, list, overdue, danger }: { title: string; list: Entry[]; overdue?: boolean; danger?: boolean }) {
  if (!list.length) return null;
  return (
    <section>
      <h2 class={`day-title ${danger ? 'danger-text' : ''}`}>
        {title} <span class="muted">· {list.length}</span>
      </h2>
      <ul class="entries">
        {list.map((e) => (
          <TaskRow key={e.id} e={e} overdue={!!overdue} />
        ))}
      </ul>
    </section>
  );
}

export function TodayScreen() {
  const nowV = now.value;
  const o = useMemo(() => todayOverview(entries.value, nowV), [entries.value, nowV]);
  const cats = catMap.value;
  // «Вчорашні відкриті» без тих, що вже показані як прострочені/на сьогодні.
  const shown = new Set([...o.overdue, ...o.dueToday].map((e) => e.id));
  const fromYesterday = o.fromYesterday.filter((e) => !shown.has(e.id));
  const nothing = !o.overdue.length && !o.dueToday.length && !fromYesterday.length;

  return (
    <div class="screen today">
      <Header title={t.today.title} />
      <div class="content">
        <p class="today-date">{dateFmt.format(nowV)}</p>
        {nothing && <p class="muted">{t.today.allClear}</p>}
        <Section title={t.today.overdue} list={o.overdue} overdue danger />
        <Section title={t.today.dueToday} list={o.dueToday} />
        <Section title={t.today.fromYesterday} list={fromYesterday} />

        <section>
          <h2 class="day-title">
            {t.today.yesterday}
            {o.yesterdayTotal ? <span class="muted"> · {t.today.entries(o.yesterdayTotal)}</span> : null}
          </h2>
          {o.yesterdayTotal === 0 ? (
            <p class="muted small">{t.today.yesterdayEmpty}</p>
          ) : (
            <div class="cat-strip">
              {o.yesterdayByCategory.map(({ categoryId, count }) => {
                const c = cats.get(categoryId);
                return (
                  <span key={categoryId} class="cat-count" title={c?.name}>
                    <span class="emoji">{c?.emoji ?? '•'}</span>
                    <span class="cat-count-name">{c?.name ?? '—'}</span>
                    <b>{count}</b>
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
