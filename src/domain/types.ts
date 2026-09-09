export type Locale = 'ru' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface CryptoMeta {
  name: string;
  image: string;
  id: string;
}

export interface RatesPayload {
  base: string;
  date: string;
  fetchedAt: number;
  rates: Record<string, number>;
  cryptoMeta: Record<string, CryptoMeta>;
}

export interface SettingsState {
  theme: ThemeMode;
  locale: Locale;
  base: string;
  amount: string;
  targets: string[];
}
