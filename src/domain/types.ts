export type Locale = 'ru' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface CryptoMeta {
  symbol: string;
  name: string;
  image: string;
  id: string;
}

export type SourceStatus = 'success' | 'error';

export interface RatesPayload {
  base: string;
  date: string;
  fetchedAt: number;
  fiatUpdatedAt?: string;
  cryptoUpdatedAt?: string;
  fiatStatus: SourceStatus;
  cryptoStatus: SourceStatus;
  failedSources: Array<'fiat' | 'crypto'>;
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
