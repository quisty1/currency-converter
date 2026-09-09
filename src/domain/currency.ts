import type { RatesPayload } from './types';

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const FIAT_SEED = [
  'USD',
  'EUR',
  'RUB',
  'TRY',
  'GBP',
  'JPY',
  'CNY',
  'CHF',
  'PLN',
  'CAD',
  'AUD',
  'UAH',
  'KZT',
  'BYN',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'INR',
  'BRL',
  'MXN',
  'KRW',
  'SGD',
  'HKD',
  'NZD',
  'ZAR',
  'AED',
  'THB',
  'ILS',
];
export const CRYPTO_SEED = [
  'BTC',
  'ETH',
  'USDT',
  'BNB',
  'SOL',
  'XRP',
  'USDC',
  'DOGE',
  'TON',
  'ADA',
];

export function parseAmount(value: string): number | null {
  // Accept spaces and decimal commas commonly used in localized numeric input.
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function convert(
  amount: number,
  from: string,
  to: string,
  payload?: RatesPayload | null,
): number | null {
  if (!payload?.rates || !Number.isFinite(amount)) return null;
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return amount;
  const fromRate = fromCode === payload.base ? 1 : payload.rates[fromCode];
  const toRate = toCode === payload.base ? 1 : payload.rates[toCode];
  if (fromRate == null || toRate == null || fromRate === 0) return null;
  // Normalize through the provider's base currency to support every cross-rate.
  return (amount / fromRate) * toRate;
}

export const unitRate = (
  from: string,
  to: string,
  payload?: RatesPayload | null,
) => convert(1, from, to, payload);
export const isCurrencyCode = (code: unknown): code is string =>
  typeof code === 'string' && /^[A-Z0-9]{2,10}$/.test(code);
export const isCacheStale = (payload?: RatesPayload | null) =>
  !payload?.fetchedAt || Date.now() - payload.fetchedAt > CACHE_TTL_MS;

export function fiatCodes(payload?: RatesPayload | null) {
  if (!payload) return FIAT_SEED;
  return [
    ...new Set([
      payload.base,
      ...Object.keys(payload.rates).filter((code) => !payload.cryptoMeta[code]),
    ]),
  ].sort();
}

export function cryptoCodes(payload?: RatesPayload | null) {
  return payload && Object.keys(payload.cryptoMeta).length
    ? Object.keys(payload.cryptoMeta).sort()
    : CRYPTO_SEED;
}
