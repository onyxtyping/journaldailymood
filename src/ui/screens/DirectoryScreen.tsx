import { useState } from 'preact/hooks';
import { t } from '../../i18n/uk';
import { addDirectoryName, saveNamed, softDeleteNamed, type DirectoryTable } from '../../db/repo';
import { Header } from '../components/Header';
import { db, directories, showToast } from '../store';

/** Додаткове поле кожного довідника (посада, номер, серійний). */
const EXTRA_KEY: Record<DirectoryTable, string | null> = { people: 'role', vehicles: 'plate', items: 'serial', locations: null };
const TABLES: DirectoryTable[] = ['people', 'vehicles', 'items', 'locations'];

type Rec = { id: string; name: string; updatedAt: number; deviceId: string; [k: string]: unknown };

function Row({ table, rec }: { table: DirectoryTable; rec: Rec }) {
  const extraKey = EXTRA_KEY[table];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(rec.name);
  const [extra, setExtra] = useState(extraKey ? String(rec[extraKey] ?? '') : '');

  if (!editing) {
    return (
      <li class="dir-row">
        <button class="dir-row-main" onClick={() => setEditing(true)}>
          <span>{rec.name}</span>
          {extraKey && rec[extraKey] ? <span class="muted small">{String(rec[extraKey])}</span> : null}
        </button>
      </li>
    );
  }
  return (
    <li class="dir-row editing">
      <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      {extraKey && (
        <input type="text" value={extra} placeholder={t.dirs.extra[table]} onInput={(e) => setExtra((e.target as HTMLInputElement).value)} />
      )}
      <div class="row">
        <button
          class="btn primary"
          onClick={async () => {
            if (!name.trim()) return;
            await saveNamed(db, table, { ...rec, name, ...(extraKey ? { [extraKey]: extra.trim() } : {}) });
            setEditing(false);
          }}
        >
          {t.common.save}
        </button>
        <button class="btn" onClick={() => setEditing(false)}>
          {t.common.cancel}
        </button>
        <span class="grow" />
        <button
          class="btn danger"
          onClick={async () => {
            await softDeleteNamed(db, table, rec.id);
            showToast(t.journal.moved);
          }}
        >
          {t.common.delete}
        </button>
      </div>
    </li>
  );
}

export function DirectoryScreen({ table: raw }: { table: string }) {
  const table = (TABLES.includes(raw as DirectoryTable) ? raw : 'people') as DirectoryTable;
  const extraKey = EXTRA_KEY[table];
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [q, setQ] = useState('');
  const list = directories[table].value as unknown as Rec[];
  const shown = q ? list.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : list;

  const add = async () => {
    if (!name.trim()) return;
    await addDirectoryName(db, table, name, extraKey && extra.trim() ? { [extraKey]: extra.trim() } : {});
    setName('');
    setExtra('');
  };

  return (
    <div class="screen directory">
      <Header title={t.dirs[table]} onBack />
      <div class="content">
        <div class="add-box">
          <input
            type="text"
            value={name}
            placeholder={t.dirs.namePlaceholder[table]}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
          />
          {extraKey && (
            <input
              type="text"
              value={extra}
              placeholder={t.dirs.extra[table]}
              onInput={(e) => setExtra((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
            />
          )}
          <button class="btn primary" disabled={!name.trim()} onClick={() => void add()}>
            {t.dirs.add}
          </button>
        </div>
        {list.length > 8 && (
          <input type="search" value={q} placeholder={t.journal.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        )}
        {list.length === 0 && <p class="muted small">{t.dirs.empty}</p>}
        <ul class="entries">
          {shown.map((r) => (
            <Row key={r.id} table={table} rec={r} />
          ))}
        </ul>
      </div>
    </div>
  );
}
