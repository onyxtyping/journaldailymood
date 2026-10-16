/** Усі тексти інтерфейсу. Правити тут. */
export const t = {
  appName: 'Журнал',

  nav: {
    capture: 'Запис',
    journal: 'Журнал',
    pending: 'Висить',
    today: 'Сьогодні',
    report: 'Вибірка',
    settings: 'Налаштування',
  },

  common: {
    save: 'Зберегти',
    cancel: 'Скасувати',
    back: 'Назад',
    delete: 'Видалити',
    undo: 'Повернути',
    close: 'Закрити',
    more: 'ще…',
    less: 'згорнути',
    yes: 'Так',
    no: 'Ні',
    today: 'Сьогодні',
    yesterday: 'Вчора',
    none: '—',
    nightOn: 'Нічний режим',
    nightOff: 'Темна тема',
  },

  capture: {
    title: 'Новий запис',
    placeholder: 'Що сталося?',
    chooseCategory: 'Оберіть категорію',
    allCategories: 'Усі категорії',
    details: 'Деталі',
    isTask: 'Це задача',
    due: 'Термін',
    priority: 'Пріоритет',
    priorities: { low: 'низький', normal: 'звичайний', high: 'високий' },
    eventAt: 'Коли сталося',
    eventAtNow: 'зараз',
    tags: 'Теги',
    tagsPlaceholder: 'через кому або пробіл',
    saved: 'Збережено',
    needCategory: 'Спершу оберіть категорію',
    needText: 'Порожній запис',
    draftRestored: 'Чернетку відновлено',
  },

  journal: {
    search: 'Пошук по тексту й полях',
    periods: { all: 'Усе', today: 'Сьогодні', yesterday: 'Вчора', week: '7 днів', month: '30 днів' },
    onlyTasks: 'Лише задачі',
    categories: 'Категорії',
    tags: 'Теги',
    resetFilters: 'Скинути',
    empty: 'Записів немає',
    emptyFiltered: 'Нічого не знайдено',
    makeTask: 'Зробити задачею',
    moved: 'У кошику',
    madeTask: 'Тепер це задача',
    count: (n: number) => `${n} ${plural(n, 'запис', 'записи', 'записів')}`,
  },

  task: {
    open: 'відкрита',
    done: 'виконано',
    cancelled: 'скасовано',
    due: 'до',
    overdue: 'прострочено',
    closeNote: 'Як закрив (необов’язково)',
    closeWithNote: 'Закрити з приміткою',
    cancelTask: 'Скасувати задачу',
    reopen: 'Відкрити знову',
    closed: 'Закрито',
    cancelledToast: 'Задачу скасовано',
  },

  pending: {
    overdue: 'Прострочено',
    today: 'На сьогодні',
    dated: 'З терміном',
    undated: 'Без терміну',
    empty: 'Нічого не висить 👌',
  },

  edit: {
    title: 'Редагування',
    notFound: 'Запис не знайдено',
    created: 'Створено',
    updated: 'Змінено',
    status: 'Стан задачі',
    deleted: 'Запис переміщено в кошик',
  },

  settings: {
    device: 'Пристрій',
    deviceName: 'Назва пристрою',
    deviceNameHint: 'Потрібна для синхронізації між пристроями',
    look: 'Вигляд',
    theme: 'Тема',
    themes: { dark: 'Темна', night: 'Нічна (червона)' },
    backup: 'Бекап',
    backupExport: 'Експорт бекапу',
    backupImport: 'Імпорт бекапу',
    lastBackup: 'Останній бекап',
    never: 'ніколи',
    backupHint:
      'iOS може стерти дані веб-застосунку. Робіть бекап регулярно і зберігайте файл у «Файлах» або на ноутбуці.',
    importChoose: 'Як імпортувати?',
    importMerge: 'Злити за id',
    importMergeHint: 'Нове додається, новіші версії замінюють старі, нічого не видаляється',
    importReplace: 'Замінити все',
    importReplaceHint: 'Усі поточні дані буде видалено й замінено даними з файлу',
    importReplaceConfirm:
      'Видалити ВСІ поточні записи, категорії та довідники і замінити їх даними з файлу? Це не можна скасувати.',
    importFileInfo: (n: number, device: string, date: string) => `У файлі ${n} записів · ${device} · ${date}`,
    importDone: (a: number, u: number, d: number, s: number) =>
      `Додано ${a}, оновлено ${u}, видалено ${d}, без змін ${s}`,
    importErrors: {
      'not-json': 'Файл пошкоджений або це не бекап',
      'wrong-format': 'Це не файл бекапу Журналу',
      'too-new': 'Бекап з новішої версії застосунку. Спершу оновіть застосунок.',
      'bad-version': 'У файлі некоректна версія схеми',
      'no-migration': 'Не вдалося перетворити бекап зі старої версії',
    } as Record<string, string>,
    storage: 'Сховище',
    persisted: 'Постійне сховище',
    persistedYes: 'надано',
    persistedNo: 'не надано',
    persistedUnknown: 'невідомо',
    persistAsk: 'Попросити ще раз',
    persistHint:
      'Без постійного сховища браузер може видалити дані при нестачі місця. На iPhone найкраще працює застосунок, доданий на початковий екран.',
    entriesCount: 'Записів',
    categoriesCount: 'Категорій',
    usage: 'Обсяг',
    about: 'Про застосунок',
    privacy: 'Дані зберігаються лише на цьому пристрої. Застосунок не робить жодних мережевих запитів.',
    version: 'Версія',
  },

  update: {
    available: 'Є оновлення',
    apply: 'Оновити',
    offlineReady: 'Готово до роботи без мережі',
  },
};

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
