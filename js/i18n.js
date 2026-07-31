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
    names: {
      USD: 'Доллар США',
      EUR: 'Евро',
      RUB: 'Российский рубль',
      TRY: 'Турецкая лира',
      GBP: 'Фунт стерлингов',
      JPY: 'Японская иена',
      CNY: 'Китайский юань',
      CHF: 'Швейцарский франк',
      PLN: 'Польский злотый',
      CAD: 'Канадский доллар',
      AUD: 'Австралийский доллар',
      UAH: 'Украинская гривна',
      KZT: 'Казахстанский тенге',
      BYN: 'Белорусский рубль',
      SEK: 'Шведская крона',
      NOK: 'Норвежская крона',
      DKK: 'Датская крона',
      CZK: 'Чешская крона',
      HUF: 'Венгерский форинт',
      RON: 'Румынский лей',
      BGN: 'Болгарский лев',
      INR: 'Индийская рупия',
      BRL: 'Бразильский реал',
      MXN: 'Мексиканский песо',
      KRW: 'Южнокорейская вона',
      SGD: 'Сингапурский доллар',
      HKD: 'Гонконгский доллар',
      NZD: 'Новозеландский доллар',
      ZAR: 'Южноафриканский рэнд',
      AED: 'Дирхам ОАЭ',
      THB: 'Тайский бат',
      ILS: 'Израильский шекель',
    },
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
    names: {
      USD: 'US Dollar',
      EUR: 'Euro',
      RUB: 'Russian Ruble',
      TRY: 'Turkish Lira',
      GBP: 'British Pound',
      JPY: 'Japanese Yen',
      CNY: 'Chinese Yuan',
      CHF: 'Swiss Franc',
      PLN: 'Polish Zloty',
      CAD: 'Canadian Dollar',
      AUD: 'Australian Dollar',
      UAH: 'Ukrainian Hryvnia',
      KZT: 'Kazakhstani Tenge',
      BYN: 'Belarusian Ruble',
      SEK: 'Swedish Krona',
      NOK: 'Norwegian Krone',
      DKK: 'Danish Krone',
      CZK: 'Czech Koruna',
      HUF: 'Hungarian Forint',
      RON: 'Romanian Leu',
      BGN: 'Bulgarian Lev',
      INR: 'Indian Rupee',
      BRL: 'Brazilian Real',
      MXN: 'Mexican Peso',
      KRW: 'South Korean Won',
      SGD: 'Singapore Dollar',
      HKD: 'Hong Kong Dollar',
      NZD: 'New Zealand Dollar',
      ZAR: 'South African Rand',
      AED: 'UAE Dirham',
      THB: 'Thai Baht',
      ILS: 'Israeli Shekel',
    },
  },
};

export function t(locale, key, vars = {}) {
  const dict = messages[locale] || messages.ru;
  let text = dict[key] ?? messages.ru[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function currencyName(locale, code) {
  const dict = messages[locale] || messages.ru;
  return dict.names[code] || code;
}

export function formatAmount(locale, amount, currency) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  try {
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      maximumFractionDigits: 2,
    });
  }
}

/** компактный курс без символа валюты в стиле "92,45 RUB" */
export function formatRateValue(locale, amount, currency) {
  if (amount == null || !Number.isFinite(amount)) {
    return t(locale, 'emptyAmount');
  }

  const digits =
    currency === 'JPY' || currency === 'KRW'
      ? 0
      : amount >= 100
        ? 2
        : amount >= 1
          ? 4
          : 6;

  try {
    const num = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
    return `${num} ${currency}`;
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatRateDate(locale, dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
