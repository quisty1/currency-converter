// ключ localStorage для всего UI-состояния приложения
const STORAGE_KEY = 'fx-multi-state';

// значения по умолчанию до первого сохранения / при битом JSON
const defaults = {
  theme: 'system',
  locale: 'ru',
  base: 'USD',
  amount: '100',
  targets: ['RUB', 'EUR', 'BTC', 'ETH'],
  ratesCache: null,
};

// ru* → ru, иначе en (из navigator.languages)
export function detectSystemLocale() {
  const langs = [
    ...(typeof navigator !== 'undefined' && navigator.languages
      ? navigator.languages
      : []),
    typeof navigator !== 'undefined' ? navigator.language : '',
  ].filter(Boolean);

  for (const lang of langs) {
    if (String(lang).toLowerCase().startsWith('ru')) return 'ru';
  }
  return 'en';
}

// читает state из localStorage; при ошибке / первом визите — defaults + системная локаль
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaults,
        locale: detectSystemLocale(),
        targets: [...defaults.targets],
      };
    }
    const parsed = JSON.parse(raw);
    const locale =
      parsed.locale === 'ru' || parsed.locale === 'en'
        ? parsed.locale
        : detectSystemLocale();
    return {
      ...defaults,
      ...parsed,
      locale,
      // пустой/битый targets не принимаем — откат к дефолтному списку
      targets:
        Array.isArray(parsed.targets) && parsed.targets.length
          ? parsed.targets
          : [...defaults.targets],
    };
  } catch {
    return {
      ...defaults,
      locale: detectSystemLocale(),
      targets: [...defaults.targets],
    };
  }
}

// мержит partial в текущий state без повторного чтения localStorage
export function saveState(state, partial) {
  const next = { ...state, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
