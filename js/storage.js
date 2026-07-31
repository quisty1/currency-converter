const STORAGE_KEY = 'fx-multi-state';

const defaults = {
  theme: 'system',
  locale: 'ru',
  base: 'USD',
  amount: '100',
  targets: ['RUB', 'EUR', 'TRY', 'GBP'],
  ratesCache: null,
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults, targets: [...defaults.targets] };
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      targets:
        Array.isArray(parsed.targets) && parsed.targets.length
          ? parsed.targets
          : [...defaults.targets],
    };
  } catch {
    return { ...defaults, targets: [...defaults.targets] };
  }
}

/** мержит partial в текущий state без повторного чтения localStorage */
export function saveState(state, partial) {
  const next = { ...state, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
