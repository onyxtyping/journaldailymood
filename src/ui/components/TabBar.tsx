import { t } from '../../i18n/uk';
import { go, overdueCount, route, type ScreenName } from '../store';
import { Icon, type IconName } from './Icon';

const TABS: { name: ScreenName; icon: IconName; label: string }[] = [
  { name: 'capture', icon: 'pen', label: t.nav.capture },
  { name: 'journal', icon: 'list', label: t.nav.journal },
  { name: 'pending', icon: 'clock', label: t.nav.pending },
  { name: 'today', icon: 'calendar', label: t.nav.today },
  { name: 'report', icon: 'doc', label: t.nav.report },
];

export function TabBar() {
  const r = route.value.name;
  const cur = r === 'edit' ? 'journal' : r === 'checkpoint' ? 'capture' : r;
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
          <span class="tab-icon">
            <Icon name={tab.icon} />
            {tab.name === 'pending' && overdue > 0 && <span class="badge">{overdue}</span>}
          </span>
          <span class="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
