// строки UI: ru / en; плейсхолдеры вида {date}, {from}, {rate}
const messages = {
  ru: {
    appName: 'FX Multi',
    tagline: 'Сумма сразу во многих валютах',
    amountLabel: 'Сумма',
    baseLabel: 'Из валюты',
    resultsTitle: 'Результат',
    manageTitle: 'Валюты в списке',
    manageHint: 'Выберите фиат и криптовалюты для списка',
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
    removeCurrency: 'Убрать из списка',
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
    tabFiat: 'Фиат',
    tabCrypto: 'Крипто',
    groupFiat: 'Фиат',
    groupCrypto: 'Крипто',
    clearAmount: 'Очистить сумму',
    skipToContent: 'К основному содержимому',
    metaDescription:
      'FX Multi — конвертер валют и криптовалют с несколькими целями сразу. Быстро, без регистрации',
  },
  en: {
    appName: 'FX Multi',
    tagline: 'One amount, many currencies at once',
    amountLabel: 'Amount',
    baseLabel: 'From',
    resultsTitle: 'Results',
    manageTitle: 'Currencies in list',
    manageHint: 'Pick fiat and crypto to show',
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
    removeCurrency: 'Remove from list',
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
    tabFiat: 'Fiat',
    tabCrypto: 'Crypto',
    groupFiat: 'Fiat',
    groupCrypto: 'Crypto',
    clearAmount: 'Clear amount',
    skipToContent: 'Skip to main content',
    metaDescription:
      'FX Multi — convert one amount into many fiat and crypto currencies at once. Fast, no sign-up',
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

// локализованное имя: cryptoMeta → Intl.DisplayNames → код
export function currencyName(locale, code, cryptoMeta = null) {
  const upper = String(code || '').toUpperCase();
  const cryptoName = cryptoMeta?.[upper]?.name;
  if (cryptoName) return cryptoName;

  const dn = currencyDisplayNames(locale);
  try {
    const name = dn?.of(upper);
    if (name && name !== upper) return name;
  } catch {
    // неизвестный код
  }
  return upper || code;
}

// знаки после запятой для крипты (мелкие суммы — до 8)
function cryptoFractionDigits(amount) {
  if (amount >= 1000) return 2;
  if (amount >= 1) return 4;
  if (amount >= 0.01) return 6;
  return 8;
}

// fallback, когда narrowSymbol всё ещё отдаёт ISO-код
const CURRENCY_SYMBOLS = {
  AED: 'د.إ',
  ALL: 'L',
  BGN: 'лв.',
  BHD: '.د.ب',
  BYN: 'Br',
  CHF: 'Fr.',
  ETB: 'Br',
  IQD: 'ع.د',
  IRR: '﷼',
  JOD: 'د.ا',
  KES: 'KSh',
  KWD: 'د.ك',
  MAD: 'د.م.',
  MDL: 'L',
  MKD: 'ден',
  MVR: 'Rf',
  OMR: 'ر.ع.',
  PAB: 'B/.',
  PEN: 'S/',
  QAR: 'ر.ق',
  RSD: 'дин.',
  SAR: '﷼',
  SCR: '₨',
  SDG: 'ج.س.',
  SOS: 'Sh.So.',
  TJS: 'ЅМ',
  TMT: 'm',
  TND: 'د.ت',
  TZS: 'TSh',
  UGX: 'USh',
  UZS: "so'm",
  VES: 'Bs.',
  YER: '﷼',
};

// Intl currency options: узкий значок вместо ISO-кода
function currencyFormatOptions(currency) {
  return {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  };
}

// если Intl вернул код — подставляем значок из карты
function applyCurrencySymbol(parts, currency) {
  const mapped = CURRENCY_SYMBOLS[currency];
  if (!mapped) return parts.map((p) => p.value).join('');

  return parts
    .map((p) => {
      if (p.type !== 'currency') return p.value;
      if (p.value.toUpperCase() === currency) return mapped;
      return p.value;
    })
    .join('');
}

// сумма в стиле валюты локали; крипта — число + код; null/NaN → emptyAmount
export function formatAmount(locale, amount, currency, cryptoMeta = null) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  const upper = String(currency || '').toUpperCase();
  if (cryptoMeta?.[upper]) {
    const digits = cryptoFractionDigits(Math.abs(amount));
    const num = new Intl.NumberFormat(localeTag(locale), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
    return `${num} ${upper}`;
  }

  try {
    const parts = new Intl.NumberFormat(
      localeTag(locale),
      currencyFormatOptions(upper),
    ).formatToParts(amount);
    return applyCurrencySymbol(parts, upper);
  } catch {
    const mapped = CURRENCY_SYMBOLS[upper];
    const prefix = mapped || upper;
    return `${prefix} ${amount.toLocaleString(localeTag(locale), {
      maximumFractionDigits: 2,
    })}`;
  }
}

// только число без символа/кода валюты (для копирования)
export function formatAmountNumber(
  locale,
  amount,
  currency,
  cryptoMeta = null,
) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  const upper = String(currency || '').toUpperCase();
  if (cryptoMeta?.[upper]) {
    const digits = cryptoFractionDigits(Math.abs(amount));
    return new Intl.NumberFormat(localeTag(locale), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
  }

  try {
    const parts = new Intl.NumberFormat(
      localeTag(locale),
      currencyFormatOptions(upper),
    ).formatToParts(amount);
    return parts
      .filter((p) => p.type !== 'currency')
      .map((p) => p.value)
      .join('')
      .trim();
  } catch {
    return amount.toLocaleString(localeTag(locale), {
      maximumFractionDigits: 2,
    });
  }
}

// компактный курс без символа валюты в стиле "92,45 RUB"
export function formatRateValue(locale, amount, currency, cryptoMeta = null) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  const upper = String(currency || '').toUpperCase();
  const isCrypto = Boolean(cryptoMeta?.[upper]);
  const currencyDigits = isCrypto
    ? cryptoFractionDigits(Math.abs(amount))
    : currencyFractionDigits(locale, upper);

  // больше знаков для мелких курсов, меньше для крупных
  const digits = isCrypto
    ? currencyDigits
    : currencyDigits === 0 && amount >= 1
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
    return `${num} ${upper}`;
  } catch {
    return `${amount} ${upper}`;
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
