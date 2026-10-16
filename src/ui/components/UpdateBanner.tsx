import { useRegisterSW } from 'virtual:pwa-register/preact';
import { signal } from '@preact/signals';
import { t } from '../../i18n/uk';

/** Чи зараз фокус у полі введення: оновлення не пропонуємо посеред набору тексту. */
const typing = signal(false);
document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  typing.value = el.matches?.('input, textarea, select, [contenteditable]') ?? false;
});
document.addEventListener('focusout', () => (typing.value = false));

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Перевіряти оновлення при поверненні в застосунок (без таймерів у фоні).
      if (!reg) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void reg.update().catch(() => {});
      });
    },
  });

  if (!needRefresh || typing.value) return null;
  return (
    <div class="update-banner" role="status">
      <span>{t.update.available}</span>
      <button class="btn small primary" onClick={() => void updateServiceWorker(true)}>
        {t.update.apply}
      </button>
    </div>
  );
}
