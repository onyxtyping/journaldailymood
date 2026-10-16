import type { ComponentChildren } from 'preact';
import { t } from '../../i18n/uk';
import { back, go, theme, toggleTheme } from '../store';
import { Icon } from './Icon';

export function Header({ title, onBack, children }: { title: string; onBack?: boolean; children?: ComponentChildren }) {
  const night = theme.value === 'night';
  return (
    <header class="header">
      {onBack ? (
        <button class="icon-btn back-btn" aria-label={t.common.back} onClick={() => back()}>
          <Icon name="back" />
        </button>
      ) : null}
      <h1 class="header-title">{title}</h1>
      <div class="header-actions">
        {children}
        <button
          class="icon-btn"
          aria-label={night ? t.common.nightOff : t.common.nightOn}
          title={night ? t.common.nightOff : t.common.nightOn}
          onClick={() => void toggleTheme()}
        >
          <Icon name={night ? 'sun' : 'moon'} />
        </button>
        <button class="icon-btn" aria-label={t.nav.settings} title={t.nav.settings} onClick={() => go('settings')}>
          <Icon name="gear" />
        </button>
      </div>
    </header>
  );
}
