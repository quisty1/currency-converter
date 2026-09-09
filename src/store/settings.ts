import { create } from 'zustand';
import type { Locale, SettingsState, ThemeMode } from '../domain/types';
import { isCurrencyCode } from '../domain/currency';

const defaults: SettingsState = {
  theme: 'system',
  locale: 'ru',
  base: 'USD',
  amount: '100',
  targets: ['RUB', 'EUR', 'BTC', 'ETH'],
};

export function detectLocale(): Locale {
  return navigator.languages?.some((lang) =>
    lang.toLowerCase().startsWith('ru'),
  )
    ? 'ru'
    : 'en';
}

export function readSettings(): SettingsState {
  try {
    const saved = JSON.parse(
      localStorage.getItem('fx-multi-state') || '{}',
    ) as Partial<SettingsState>;
    return {
      // Validate persisted values independently so one bad field cannot reset all settings.
      theme:
        saved.theme === 'light' ||
        saved.theme === 'dark' ||
        saved.theme === 'system'
          ? saved.theme
          : 'system',
      locale:
        saved.locale === 'ru' || saved.locale === 'en'
          ? saved.locale
          : detectLocale(),
      base: isCurrencyCode(saved.base) ? saved.base : defaults.base,
      amount: typeof saved.amount === 'string' ? saved.amount : defaults.amount,
      targets:
        Array.isArray(saved.targets) && saved.targets.some(isCurrencyCode)
          ? saved.targets.filter(isCurrencyCode)
          : defaults.targets,
    };
  } catch {
    return { ...defaults, locale: detectLocale() };
  }
}

interface SettingsActions {
  setAmount: (amount: string) => void;
  setBase: (base: string) => void;
  setTargets: (targets: string[]) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  hydrateFromUrl: () => void;
}

export const useSettings = create<SettingsState & SettingsActions>((set) => ({
  ...settingsFromUrl(readSettings()),
  setAmount: (amount) => set({ amount }),
  setBase: (base) => set({ base }),
  setTargets: (targets) => set({ targets: [...new Set(targets)] }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  hydrateFromUrl: () => set((state) => settingsFromUrl(state)),
}));

export function settingsFromUrl(current: SettingsState): SettingsState {
  // URL parameters override persisted settings to make converter states shareable.
  const params = new URLSearchParams(location.search);
  const from = params.get('from')?.toUpperCase();
  const to = params
    .get('to')
    ?.split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(isCurrencyCode);
  const locale = params.get('locale');
  const theme = params.get('theme');
  return {
    ...current,
    amount: params.has('amount') ? params.get('amount') || '' : current.amount,
    base: isCurrencyCode(from) ? from : current.base,
    targets: to?.length ? [...new Set(to)] : current.targets,
    locale: locale === 'ru' || locale === 'en' ? locale : current.locale,
    theme:
      theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme
        : current.theme,
  };
}

useSettings.subscribe((state) => {
  // Persist only serializable user settings, not Zustand actions.
  const settings: SettingsState = {
    amount: state.amount,
    base: state.base,
    targets: state.targets,
    locale: state.locale,
    theme: state.theme,
  };
  try {
    localStorage.setItem('fx-multi-state', JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private browsing.
  }
});
