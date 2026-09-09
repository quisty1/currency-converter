import { create } from 'zustand';
import type {
  Locale,
  RatesPayload,
  SettingsState,
  ThemeMode,
} from '../domain/types';
import { fiatId, migrateAsset, parseAmount } from '../domain/currency';

const defaults: SettingsState = {
  theme: 'system',
  locale: 'ru',
  base: fiatId('USD'),
  amount: '100',
  targets: [fiatId('RUB'), fiatId('EUR'), 'crypto:bitcoin', 'crypto:ethereum'],
};

let pendingLegacyUrl: { from?: string; targets?: string[] } | undefined;
let pendingLegacyStorage: { from?: string; targets?: string[] } | undefined;

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
    const savedBase = typeof saved.base === 'string' ? saved.base : undefined;
    const savedTargets = Array.isArray(saved.targets)
      ? saved.targets.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const migratedBase = savedBase ? migrateAsset(savedBase) : null;
    const migratedTargets = savedTargets
      .map((value) => migrateAsset(value))
      .filter((value): value is string => Boolean(value));
    if (
      (savedBase && !migratedBase) ||
      savedTargets.some((value) => !migrateAsset(value))
    ) {
      pendingLegacyStorage = {
        from: savedBase && !migratedBase ? savedBase : undefined,
        targets: savedTargets.length ? savedTargets : undefined,
      };
    }
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
      base: migratedBase || defaults.base,
      amount: typeof saved.amount === 'string' ? saved.amount : defaults.amount,
      targets: migratedTargets.length
        ? [...new Set(migratedTargets)]
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
  setBase: (base) =>
    set((state) => ({
      base,
      targets: [
        ...new Set(
          state.targets.map((target) =>
            target === base ? state.base : target,
          ),
        ),
      ].filter((target) => target !== base),
    })),
  setTargets: (targets) => set({ targets: [...new Set(targets)] }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  hydrateFromUrl: () => set((state) => settingsFromUrl(state)),
}));

export function settingsFromUrl(current: SettingsState): SettingsState {
  // URL parameters override persisted settings to make converter states shareable.
  pendingLegacyUrl = undefined;
  const params = new URLSearchParams(location.search);
  if (pendingLegacyStorage) {
    pendingLegacyStorage = {
      from: params.has('from') ? undefined : pendingLegacyStorage.from,
      targets: params.has('to') ? undefined : pendingLegacyStorage.targets,
    };
    if (!pendingLegacyStorage.from && !pendingLegacyStorage.targets) {
      pendingLegacyStorage = undefined;
    }
  }
  const from = params.get('from');
  const to = params
    .get('to')
    ?.split(',')
    .map((code) => migrateAsset(code))
    .filter((code): code is string => Boolean(code));
  const rawTargets = params
    .get('to')
    ?.split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  const unresolvedFrom = from && !migrateAsset(from) ? from : undefined;
  const hasUnresolvedTarget = rawTargets?.some((code) => !migrateAsset(code));
  if (unresolvedFrom || hasUnresolvedTarget) {
    pendingLegacyUrl = {
      from: unresolvedFrom,
      targets: hasUnresolvedTarget ? rawTargets : undefined,
    };
  }
  const locale = params.get('locale');
  const theme = params.get('theme');
  const amount = params.get('amount');
  return {
    ...current,
    amount: params.has('amount')
      ? amount && parseAmount(amount) != null
        ? amount
        : defaults.amount
      : current.amount,
    base: params.has('from')
      ? from
        ? migrateAsset(from) || defaults.base
        : defaults.base
      : current.base,
    targets: to?.length ? [...new Set(to)] : current.targets,
    locale: params.has('locale')
      ? locale === 'ru' || locale === 'en'
        ? locale
        : detectLocale()
      : current.locale,
    theme:
      theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme
        : current.theme,
  };
}

export function resolvePendingLegacyUrl(payload: RatesPayload) {
  const pending = pendingLegacyUrl || pendingLegacyStorage;
  pendingLegacyUrl = undefined;
  pendingLegacyStorage = undefined;
  if (!pending) return undefined;
  return {
    base: pending.from ? migrateAsset(pending.from, payload) : undefined,
    targets: pending.targets
      ? [
          ...new Set(
            pending.targets
              .map((value) => migrateAsset(value, payload))
              .filter((value): value is string => Boolean(value)),
          ),
        ]
      : undefined,
  };
}

export function urlHasInvalidSettings() {
  const params = new URLSearchParams(location.search);
  const from = params.get('from');
  const toRaw =
    params
      .get('to')
      ?.split(',')
      .map((value) => value.trim()) || [];
  const migrated = toRaw.map((value) => migrateAsset(value)).filter(Boolean);
  const locale = params.get('locale');
  const amount = params.get('amount');
  return (
    (params.has('from') && (!from || !migrateAsset(from))) ||
    (params.has('to') &&
      (!toRaw.length ||
        migrated.length !== toRaw.length ||
        new Set(migrated).size !== migrated.length)) ||
    (params.has('amount') && (!amount || parseAmount(amount) == null)) ||
    (params.has('locale') && locale !== 'ru' && locale !== 'en')
  );
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
