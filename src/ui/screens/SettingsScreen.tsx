import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import type { Theme } from '../../domain/types';
import { fmtDateTime } from '../../domain/time';
import {
  BACKUP_EXT,
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '../../io/backup';
import { pickFile, shareOrDownload } from '../../io/share';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { checkpointsIcs } from '../../io/ics';
import { DEFAULT_CHECKPOINTS, normalizeTimes } from '../../domain/checkpoints';
import { activeCategories, categories, db, directories, entries, go, saveSetting, setting, showToast, theme } from '../store';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

export function SettingsScreen() {
  const [usage, setUsage] = useState<number | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceName, setDeviceName] = useState(setting('deviceName', ''));

  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null));
  }, [entries.value.length]);

  const times = normalizeTimes(setting<string[]>('checkpointTimes', DEFAULT_CHECKPOINTS));
  const saveTimes = (list: string[]) => saveSetting('checkpointTimes', normalizeTimes(list));
  const persisted = setting<boolean | null>('persisted', null);
  const lastBackupAt = setting<number | null>('lastBackupAt', null);

  const doExport = async () => {
    setBusy(true);
    try {
      const b = await exportBackup(db);
      const ok = await shareOrDownload(backupFileName(), serializeBackup(b), 'application/json');
      if (ok) await saveSetting('lastBackupAt', Date.now());
    } finally {
      setBusy(false);
    }
  };

  const doPick = async () => {
    const file = await pickFile(`${BACKUP_EXT},.json,application/json`);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'not-json';
      showToast(t.settings.importErrors[code] ?? String(e), undefined, 4000);
    }
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !confirm(t.settings.importReplaceConfirm)) return;
    setBusy(true);
    try {
      const r = await importBackup(db, pending, mode);
      setPending(null);
      showToast(t.settings.importDone(r.added, r.updated, r.deleted, r.skipped), undefined, 5000);
    } finally {
      setBusy(false);
    }
  };

  const askPersist = async () => {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    await saveSetting('persisted', ok);
  };

  return (
    <div class="screen settings">
      <Header title={t.nav.settings} onBack />
      <div class="content">
        <section class="card">
          <h2>{t.settings.device}</h2>
          <label class="field">
            <span class="field-label">{t.settings.deviceName}</span>
            <input
              type="text"
              value={deviceName}
              onInput={(e) => setDeviceName((e.target as HTMLInputElement).value)}
              onBlur={() => deviceName.trim() && void saveSetting('deviceName', deviceName.trim())}
            />
            <span class="muted small">{t.settings.deviceNameHint}</span>
          </label>
        </section>

        <section class="card">
          <h2>{t.settings.look}</h2>
          <div class="segmented">
            {(['dark', 'night'] as Theme[]).map((th) => (
              <button key={th} class={theme.value === th ? 'on' : ''} onClick={() => void saveSetting('theme', th)}>
                {t.settings.themes[th]}
              </button>
            ))}
          </div>
        </section>

        <section class="card">
          <h2>{t.settings.data}</h2>
          <button class="link-row" onClick={() => go('categories')}>
            <span class="grow">{t.settings.categories}</span>
            <span class="muted">{activeCategories.value.length}</span>
            <Icon name="next" size={18} />
          </button>
          {(['people', 'vehicles', 'items', 'locations'] as const).map((d) => (
            <button key={d} class="link-row" onClick={() => go('directory', d)}>
              <span class="grow">{t.dirs[d]}</span>
              <span class="muted">{directories[d].value.length}</span>
              <Icon name="next" size={18} />
            </button>
          ))}
        </section>

        <section class="card">
          <h2>{t.settings.checkpoints}</h2>
          <p class="muted small">{t.settings.checkpointsHint}</p>
          <div class="times">
            {times.map((tm, i) => (
              <div key={`${i}-${tm}`} class="time-chip">
                <input
                  type="time"
                  value={tm}
                  onChange={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    void saveTimes(times.map((x, j) => (j === i ? v : x)));
                  }}
                />
                <button class="icon-btn small" aria-label={t.common.delete} onClick={() => void saveTimes(times.filter((_, j) => j !== i))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <button class="btn small" onClick={() => void saveTimes([...times, '18:00'])}>
              + {t.settings.addTime}
            </button>
          </div>
          <p class="muted small">{t.calendar.hint}</p>
          <button
            class="btn"
            disabled={!times.length}
            onClick={() => void shareOrDownload('journal-checkpoints.ics', checkpointsIcs(times), 'text/calendar')}
          >
            {t.calendar.addCheckpoints}
          </button>
        </section>

        <section class="card">
          <h2>{t.settings.backup}</h2>
          <p class="muted small">{t.settings.backupHint}</p>
          <div class="kv">
            <span>{t.settings.lastBackup}</span>
            <b>{lastBackupAt ? fmtDateTime(lastBackupAt) : t.settings.never}</b>
          </div>
          <div class="row wrap">
            <button class="btn primary" disabled={busy} onClick={() => void doExport()}>
              {t.settings.backupExport}
            </button>
            <button class="btn" disabled={busy} onClick={() => void doPick()}>
              {t.settings.backupImport}
            </button>
          </div>
          {pending && (
            <div class="import-box">
              <p>
                {t.settings.importFileInfo(
                  pending.data.entries.length,
                  pending.deviceName || pending.deviceId,
                  fmtDateTime(pending.exportedAt),
                )}
              </p>
              <p class="field-label">{t.settings.importChoose}</p>
              <button class="btn wide" disabled={busy} onClick={() => void doImport('merge')}>
                {t.settings.importMerge}
                <span class="muted small block">{t.settings.importMergeHint}</span>
              </button>
              <button class="btn danger wide" disabled={busy} onClick={() => void doImport('replace')}>
                {t.settings.importReplace}
                <span class="small block">{t.settings.importReplaceHint}</span>
              </button>
              <button class="btn ghost wide" onClick={() => setPending(null)}>
                {t.common.cancel}
              </button>
            </div>
          )}
        </section>

        <section class="card">
          <h2>{t.settings.storage}</h2>
          <div class="kv">
            <span>{t.settings.persisted}</span>
            <b class={persisted ? 'ok-text' : 'danger-text'}>
              {persisted == null ? t.settings.persistedUnknown : persisted ? t.settings.persistedYes : t.settings.persistedNo}
            </b>
          </div>
          {!persisted && (
            <>
              <p class="muted small">{t.settings.persistHint}</p>
              <button class="btn" onClick={() => void askPersist()}>
                {t.settings.persistAsk}
              </button>
            </>
          )}
          <div class="kv">
            <span>{t.settings.entriesCount}</span>
            <b>{entries.value.filter((e) => !e.deletedAt).length}</b>
          </div>
          <div class="kv">
            <span>{t.settings.categoriesCount}</span>
            <b>{categories.value.filter((c) => !c.deletedAt).length}</b>
          </div>
          <div class="kv">
            <span>{t.settings.usage}</span>
            <b>{usage == null ? '—' : fmtBytes(usage)}</b>
          </div>
        </section>

        <section class="card">
          <h2>{t.settings.about}</h2>
          <p class="muted small">{t.settings.privacy}</p>
          <div class="kv">
            <span>{t.settings.version}</span>
            <b>{__APP_VERSION__}</b>
          </div>
        </section>
      </div>
    </div>
  );
}
