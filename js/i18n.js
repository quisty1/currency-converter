// строки UI: ru / en; плейсхолдеры вида {date}, {from}, {rate}
const messages = {
  ru: {
    appName: 'FX Multi',
    tagline: 'Сумма сразу во многих валютах',
    amountLabel: 'Сумма',
    baseLabel: 'Из валюты',
    resultsTitle: 'Результат',
    manageTitle: 'Валюты в списке',
    manageHint: 'Выберите, какие валюты показывать',
    ratesUpdated: 'Курс обновлён: {date}',
    ratesCached: 'Показан сохранённый курс: {date}',
    ratesStale: 'Курс устарел: {date}',
    ratesError: 'Не удалось загрузить курсы',
    ratesLoading: 'Загрузка курсов…',
    refreshRates: 'Обновить',
    invalidAmount: 'Введите число',
    unitRate: '1 {from} = {rate}',
    copyAmount: 'Копировать',
    copied: 'Скопировано',
    swapCurrencies: 'Поменять',
    moveUp: 'Выше',
    moveDown: 'Ниже',
    dragHandle: 'Перетащить',
    themeLabel: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    themeSystem: 'Системная',
    langLabel: 'Язык',
    emptyAmount: '—',
    openManage: 'Настроить список',
    closeManage: 'Готово',
    searchCurrencies: 'Поиск валюты',
    searchPlaceholder: 'Поиск…',
    searchEmpty: 'Ничего не найдено',
    clearAmount: 'Очистить сумму',
    skipToContent: 'К основному содержимому',
    metaDescription:
      'FX Multi — конвертер валют с несколькими целями сразу. Быстро, без регистрации',
  },
  en: {
    appName: 'FX Multi',
    tagline: 'One amount, many currencies at once',
    amountLabel: 'Amount',
    baseLabel: 'From',
    resultsTitle: 'Results',
    manageTitle: 'Currencies in list',
    manageHint: 'Pick which currencies to show',
    ratesUpdated: 'Rates updated: {date}',
    ratesCached: 'Showing saved rates: {date}',
    ratesStale: 'Rates outdated: {date}',
    ratesError: 'Could not load exchange rates',
    ratesLoading: 'Loading rates…',
    refreshRates: 'Refresh',
    invalidAmount: 'Enter a number',
    unitRate: '1 {from} = {rate}',
    copyAmount: 'Copy',
    copied: 'Copied',
    swapCurrencies: 'Swap',
    moveUp: 'Move up',
    moveDown: 'Move down',
    dragHandle: 'Drag to reorder',
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    langLabel: 'Language',
    emptyAmount: '—',
    openManage: 'Edit list',
    closeManage: 'Done',
    searchCurrencies: 'Search currencies',
    searchPlaceholder: 'Search…',
    searchEmpty: 'Nothing found',
    clearAmount: 'Clear amount',
    skipToContent: 'Skip to main content',
    metaDescription:
      'FX Multi — convert one amount into many currencies at once. Fast, no sign-up',
  },
};

// кэш Intl.DisplayNames по BCP 47 тегу
const displayNamesCache = new Map();

function localeTag(locale) {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

// DisplayNames для названий валют; при недоступности Intl — null
function currencyDisplayNames(locale) {
  const tag = localeTag(locale);
  let dn = displayNamesCache.get(tag);
  if (!dn) {
    try {
      dn = new Intl.DisplayNames(tag, { type: 'currency' });
    } catch {
      dn = null;
    }
    displayNamesCache.set(tag, dn);
  }
  return dn;
}

// дробная часть валюты из NumberFormat (fallback 2)
function currencyFractionDigits(locale, currency) {
  try {
    const digits = new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
    return typeof digits === 'number' ? digits : 2;
  } catch {
    return 2;
  }
}

// перевод ключа с подстановкой vars; fallback: ru → сам ключ
export function t(locale, key, vars = {}) {
  const dict = messages[locale] || messages.ru;
  let text = dict[key] ?? messages.ru[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

// локализованное имя валюты или ISO-код
export function currencyName(locale, code) {
  const dn = currencyDisplayNames(locale);
  try {
    const name = dn?.of(code);
    if (name && name !== code) return name;
  } catch {
    // неизвестный код
  }
  return code;
}

// сумма в стиле валюты локали; null/NaN → emptyAmount
export function formatAmount(locale, amount, currency) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return amount.toLocaleString(localeTag(locale), {
      maximumFractionDigits: 2,
    });
  }
}

// компактный курс без символа валюты в стиле "92,45 RUB"
export function formatRateValue(locale, amount, currency) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  const currencyDigits = currencyFractionDigits(locale, currency);
  // больше знаков для мелких курсов, меньше для крупных
  const digits =
    currencyDigits === 0 && amount >= 1
      ? 0
      : amount >= 100
        ? Math.max(currencyDigits, 2)
        : amount >= 1
          ? Math.max(currencyDigits, 4)
          : 6;

  try {
    const num = new Intl.NumberFormat(localeTag(locale), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
    return `${num} ${currency}`;
  } catch {
    return `${amount} ${currency}`;
  }
}

// дата/время обновления курса; битая строка — как есть
export function formatRateDate(locale, dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
