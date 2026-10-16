import type { Category, FieldDef } from '../domain/types';

/**
 * Стартовий набір категорій.
 * id детерміновані: однакові на всіх пристроях, тож після синхро категорії не дублюються.
 * updatedAt фіксований і старий: будь-яка правка користувача перемагає seed.
 */
const SEED_TIME = Date.UTC(2026, 0, 1);
const SEED_DEVICE = 'seed';

const G = {
  tasks: 'Задачі та управління',
  comms: "Зв'язок і обладнання",
  vehicles: 'Техніка та пальне',
  property: 'Майно',
  personnel: 'Особовий склад',
  other: 'Інше',
} as const;

const COLORS: Record<string, string> = {
  [G.tasks]: '#f2a33a',
  [G.comms]: '#4f9cff',
  [G.vehicles]: '#3fbf7f',
  [G.property]: '#b48cff',
  [G.personnel]: '#ff7a8a',
  [G.other]: '#9aa3ad',
};

const f = {
  text: (key: string, label: string): FieldDef => ({ key, label, type: 'text' }),
  num: (key: string, label: string, unit?: string): FieldDef => (unit ? { key, label, type: 'number', unit } : { key, label, type: 'number' }),
  date: (key: string, label: string): FieldDef => ({ key, label, type: 'date' }),
  select: (key: string, label: string, options: string[]): FieldDef => ({ key, label, type: 'select', options }),
  person: (key: string, label: string): FieldDef => ({ key, label, type: 'person' }),
  vehicle: (key = 'vehicle', label = 'Авто'): FieldDef => ({ key, label, type: 'vehicle' }),
  item: (key: string, label: string): FieldDef => ({ key, label, type: 'item' }),
  location: (key: string, label: string): FieldDef => ({ key, label, type: 'location' }),
};

type SeedDef = [emoji: string, name: string, group: string, defaultIsTask: boolean, fields: FieldDef[]];

const DEFS: SeedDef[] = [
  ['📌', 'Задача від командування', G.tasks, true, [f.person('from', 'Від кого'), f.date('deadline', 'Термін')]],
  ['✅', 'Власна задача / нагадування', G.tasks, true, []],
  ['🗣', 'Нарада / вказівки', G.tasks, false, [f.person('who', 'Хто'), f.text('said', 'Що сказали')]],
  ['🤝', 'Домовленість', G.tasks, false, [f.person('with', 'З ким'), f.date('deadline', 'Термін')]],
  [
    '📄',
    'Документи',
    G.tasks,
    false,
    [
      f.select('docType', 'Тип', ['Рапорт', 'Наказ', 'Розпорядження', 'Інше']),
      f.select('direction', 'Напрям', ['Вхідний', 'Вихідний']),
      f.date('signBy', 'Підписати до'),
    ],
  ],

  [
    '📡',
    'Несправність / аварія зв’язку',
    G.comms,
    true,
    [f.item('equipment', 'Обладнання'), f.location('node', 'Лінія / вузол'), f.date('since', 'З якого часу'), f.text('cause', 'Причина')],
  ],
  ['🔧', 'Ремонт / обслуговування обладнання', G.comms, false, [f.item('equipment', 'Обладнання'), f.text('done', 'Що зроблено')]],
  ['🛰', 'Starlink', G.comms, false, [f.item('terminal', 'Термінал'), f.text('event', 'Подія')]],
  ['📶', 'РРЛ / PtP / WiFi / mesh', G.comms, false, [f.text('link', 'Лінк'), f.text('event', 'Подія')]],
  ['📻', 'Радіостанції', G.comms, false, [f.item('station', 'Станція'), f.text('event', 'Подія')]],
  ['🔋', 'Живлення: АКБ, генератори, ДБЖ', G.comms, false, [f.item('equipment', 'Обладнання'), f.text('event', 'Подія')]],
  ['💻', 'Мережа / ПК / ПЗ', G.comms, false, []],
  ['🏗', 'Розгортання / згортання', G.comms, false, [f.location('node', 'Вузол / лінія')]],

  ['🚙', 'Техніка: несправність', G.vehicles, true, [f.vehicle(), f.text('description', 'Опис')]],
  ['🛠', 'Техніка: ТО / ремонт', G.vehicles, false, [f.vehicle(), f.text('done', 'Що зроблено'), f.num('odometer', 'Пробіг', 'км')]],
  [
    '⛽',
    'Пальне',
    G.vehicles,
    false,
    [
      f.select('operation', 'Операція', ['Отримано', 'Видано', 'Заправлено']),
      f.vehicle(),
      f.select('fuelType', 'Тип пального', ['ДП', 'А-95', 'А-92', 'Газ']),
      f.num('liters', 'Літри', 'л'),
      f.num('odometer', 'Пробіг', 'км'),
    ],
  ],
  [
    '🛣',
    'Виїзд / переміщення',
    G.vehicles,
    false,
    [f.vehicle(), f.text('route', 'Маршрут (умовно)'), f.num('km', 'Відстань', 'км'), f.text('purpose', 'Мета')],
  ],

  ['📦', 'Майно отримано', G.property, false, [f.item('item', 'Найменування'), f.num('qty', 'Кількість', 'шт'), f.person('from', 'Від кого')]],
  ['📤', 'Майно видано / передано', G.property, false, [f.item('item', 'Найменування'), f.num('qty', 'Кількість', 'шт'), f.person('to', 'Кому')]],
  [
    '♻️',
    'Майно: ремонт / списання / втрата',
    G.property,
    false,
    [f.item('item', 'Найменування'), f.num('qty', 'Кількість', 'шт'), f.text('reason', 'Причина')],
  ],
  ['🧾', 'Потреба / заявка / закупівля', G.property, true, [f.item('item', 'Що'), f.num('qty', 'Кількість', 'шт'), f.person('submittedTo', 'Кому подано')]],

  [
    '👥',
    'Наявність / відсутність',
    G.personnel,
    false,
    [
      f.person('person', 'Особа'),
      f.select('reason', 'Причина', ['Відпустка', 'Відрядження', 'Лікування', 'Інше']),
      f.date('from', 'З'),
      f.date('to', 'По'),
    ],
  ],
  ['🪖', 'Наряд / чергування', G.personnel, false, [f.person('who', 'Хто'), f.location('where', 'Де'), f.date('date', 'Дата')]],
  ['📚', 'Заняття / навчання', G.personnel, false, [f.text('topic', 'Тема'), f.person('who', 'Хто')]],
  ['⚠️', 'Інцидент / порушення', G.personnel, false, [f.person('who', 'Хто'), f.text('description', 'Опис')]],
  ['🏅', 'Заохочення / подання', G.personnel, false, [f.person('who', 'Кого')]],

  ['📝', 'Нотатка / різне', G.other, false, []],
  ['💡', 'Ідея / покращення', G.other, false, []],
];

export function seedId(n: number): string {
  return `c0ffee00-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function seedCategories(): Category[] {
  return DEFS.map(([emoji, name, group, defaultIsTask, fieldSchema], i) => ({
    id: seedId(i + 1),
    name,
    emoji,
    group,
    color: COLORS[group],
    order: (i + 1) * 10,
    archived: false,
    defaultIsTask,
    fieldSchema,
    updatedAt: SEED_TIME,
    deviceId: SEED_DEVICE,
  }));
}

/** Порядок груп на екрані. */
export const GROUP_ORDER: string[] = Object.values(G);
