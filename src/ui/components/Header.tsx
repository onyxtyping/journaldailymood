import type { ComponentChildren } from 'preact';
import { t } from '../../i18n/uk';
import { back, go, theme, toggleTheme } from '../store';

export function Header({ title, onBack, children }: { title: string; onBack?: boolean; children?: ComponentChildren }) {
  return (
    <header class="header">
      {onBack ? (
        <button class="icon-btn" aria-label={t.common.back} onClick={() => back()}>
          ‹
        </button>
      ) : null}
      <h1 class="header-title">{title}</h1>
      <div class="header-actions">
        {children}
        <button
          class="icon-btn"
          aria-label={theme.value === 'night' ? t.common.nightOff : t.common.nightOn}
          title={theme.value === 'night' ? t.common.nightOff : t.common.nightOn}
          onClick={() => void toggleTheme()}
        >
          {theme.value === 'night' ? '☀' : '🌙'}
        </button>
        <button class="icon-btn" aria-label={t.nav.settings} title={t.nav.settings} onClick={() => go('settings')}>
          ⚙
        </button>
      </div>
    </header>
  );
}
