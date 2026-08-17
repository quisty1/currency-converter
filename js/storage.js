// localStorage key for the whole UI state
const STORAGE_KEY = 'fx-multi-state';

// defaults until the first save / on broken JSON
const defaults = {
  theme: 'system',
  locale: 'ru',
  base: 'USD',
  amount: '100',
  targets: ['RUB', 'EUR', 'BTC', 'ETH'],
  ratesCache: null,
};

// ru* → ru, otherwise en (from navigator.languages)
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

// load state from localStorage; on error / first visit — defaults + system locale
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
      // reject empty/broken targets — fall back to the default list
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

// merge a partial into current state without re-reading localStorage
export function saveState(state, partial) {
  const next = { ...state, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
