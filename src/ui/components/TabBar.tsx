import { t } from '../../i18n/uk';
import { go, overdueCount, route, type ScreenName } from '../store';

const TABS: { name: ScreenName; icon: string; label: string }[] = [
  { name: 'capture', icon: '✍️', label: t.nav.capture },
  { name: 'journal', icon: '📖', label: t.nav.journal },
  { name: 'pending', icon: '⏳', label: t.nav.pending },
];

export function TabBar() {
  const cur = route.value.name === 'edit' ? 'journal' : route.value.name;
  const overdue = overdueCount.value;
  return (
    <nav class="tabbar" aria-label="Навігація">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          class={`tab ${cur === tab.name ? 'active' : ''}`}
          aria-current={cur === tab.name ? 'page' : undefined}
          onClick={() => go(tab.name)}
        >
          <span class="tab-icon" aria-hidden="true">
            {tab.icon}
            {tab.name === 'pending' && overdue > 0 && <span class="badge">{overdue}</span>}
          </span>
          <span class="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
