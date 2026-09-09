import type { RatesPayload } from './types';
import { KNOWN_FIAT_CODES } from './currencyCountry';

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
  'bitcoin',
  'ethereum',
  'tether',
  'binancecoin',
  'solana',
  'ripple',
  'usd-coin',
  'dogecoin',
  'the-open-network',
  'cardano',
];
export const CRYPTO_SEED_SYMBOLS: Readonly<Record<string, string>> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  tether: 'USDT',
  binancecoin: 'BNB',
  solana: 'SOL',
  ripple: 'XRP',
  'usd-coin': 'USDC',
  dogecoin: 'DOGE',
  'the-open-network': 'TON',
  cardano: 'ADA',
};

export const fiatId = (code: string) => `fiat:${code.toUpperCase()}`;
export const cryptoId = (id: string) => `crypto:${id.toLowerCase()}`;
export const isAssetId = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^(fiat:[A-Z]{3}|crypto:[a-z0-9-]{1,100})$/.test(value);
export const assetCode = (id: string, payload?: RatesPayload | null) =>
  id.startsWith('fiat:')
    ? id.slice(5)
    : payload?.cryptoMeta[id]?.symbol ||
      CRYPTO_SEED_SYMBOLS[id.replace('crypto:', '')] ||
      id.replace('crypto:', '');

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
  const fromCode = from.includes(':') ? from : fiatId(from);
  const toCode = to.includes(':') ? to : fiatId(to);
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
  if (!payload) return FIAT_SEED.map(fiatId);
  return [
    ...new Set([
      payload.base,
      ...Object.keys(payload.rates).filter((id) => id.startsWith('fiat:')),
    ]),
  ].sort();
}

export function cryptoCodes(payload?: RatesPayload | null) {
  return payload && Object.keys(payload.cryptoMeta).length
    ? Object.keys(payload.cryptoMeta).sort()
    : CRYPTO_SEED.map(cryptoId);
}

export function migrateAsset(
  value: string,
  payload?: RatesPayload | null,
): string | null {
  const raw = value.trim();
  if (isAssetId(raw)) return raw;
  const upper = raw.toUpperCase();
  if (
    KNOWN_FIAT_CODES.includes(upper) ||
    payload?.rates[fiatId(upper)] != null
  ) {
    return fiatId(upper);
  }
  const matches = Object.entries(payload?.cryptoMeta || {})
    .filter(([, meta]) => meta.symbol === upper)
    .map(([id]) => id)
    .sort();
  if (matches.length) return matches[0];
  const seed = CRYPTO_SEED.find((id) => CRYPTO_SEED_SYMBOLS[id] === upper);
  return seed ? cryptoId(seed) : null;
}

export const urlAsset = (id: string) =>
  id.startsWith('fiat:') ? id.slice(5) : id;
