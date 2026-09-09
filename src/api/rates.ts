import { z } from 'zod';
import type { CryptoMeta, RatesPayload } from '../domain/types';
import { cryptoId, fiatId } from '../domain/currency';

const fiatSchema = z.object({
  result: z.literal('success'),
  base_code: z.string(),
  time_last_update_utc: z.string(),
  rates: z.record(z.string(), z.number().positive()),
});

const coinSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  current_price: z.number().positive(),
});

const cryptoSchema = z.array(coinSchema).min(1);

async function getJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function fetchRates(
  signal?: AbortSignal,
  savedCryptoIds: string[] = [],
): Promise<RatesPayload> {
  // Providers are independent, so retain useful partial data if either one fails.
  const [fiatResult, cryptoResult] = await Promise.allSettled([
    getJson('https://open.er-api.com/v6/latest/USD', signal).then((value) =>
      fiatSchema.parse(value),
    ),
    getJson(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1',
      signal,
    ).then((value) => cryptoSchema.parse(value)),
  ]);

  if (fiatResult.status === 'rejected' && cryptoResult.status === 'rejected') {
    throw new AggregateError(
      [fiatResult.reason, cryptoResult.reason],
      'Could not load currency rates',
    );
  }

  const cached = loadRatesCache();
  const rates: Record<string, number> = { ...(cached?.rates || {}) };
  const cryptoMeta: Record<string, CryptoMeta> = {
    ...(cached?.cryptoMeta || {}),
  };
  let date = new Date().toUTCString();

  if (fiatResult.status === 'fulfilled') {
    for (const [code, rate] of Object.entries(fiatResult.value.rates)) {
      rates[fiatId(code)] = rate;
    }
    rates[fiatId('USD')] = 1;
    date = fiatResult.value.time_last_update_utc;
  }

  if (cryptoResult.status === 'fulfilled') {
    let coins = cryptoResult.value;
    const missing = savedCryptoIds.filter(
      (id) => !coins.some((coin) => coin.id === id),
    );
    if (missing.length) {
      try {
        const extra = await getJson(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(missing.join(','))}`,
          signal,
        );
        coins = [...coins, ...cryptoSchema.parse(extra)];
      } catch {
        /* top-list data remains usable */
      }
    }
    for (const coin of coins) {
      const code = cryptoId(coin.id);
      // Store crypto as units per USD to match the fiat provider's rate direction.
      rates[code] = 1 / coin.current_price;
      cryptoMeta[code] = {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
      };
    }
  }

  const payload: RatesPayload = {
    base: fiatId('USD'),
    date,
    fetchedAt: Date.now(),
    fiatUpdatedAt:
      fiatResult.status === 'fulfilled'
        ? fiatResult.value.time_last_update_utc
        : cached?.fiatUpdatedAt,
    cryptoUpdatedAt:
      cryptoResult.status === 'fulfilled'
        ? new Date().toISOString()
        : cached?.cryptoUpdatedAt,
    fiatStatus: fiatResult.status === 'fulfilled' ? 'success' : 'error',
    cryptoStatus: cryptoResult.status === 'fulfilled' ? 'success' : 'error',
    failedSources: [
      fiatResult.status === 'rejected' ? 'fiat' : null,
      cryptoResult.status === 'rejected' ? 'crypto' : null,
    ].filter((x): x is 'fiat' | 'crypto' => x !== null),
    rates,
    cryptoMeta,
  };
  saveRatesCache(payload);
  return payload;
}

const RATES_KEY = 'fx-multi-rates';

export function loadRatesCache(): RatesPayload | undefined {
  try {
    const own = localStorage.getItem(RATES_KEY);
    if (own) return migrateCachedPayload(JSON.parse(own) as RatesPayload);
    const legacy = JSON.parse(
      localStorage.getItem('fx-multi-state') || '{}',
    ) as { ratesCache?: RatesPayload };
    if (legacy.ratesCache) {
      // Migrate cache data written by versions that embedded it in app settings.
      localStorage.setItem(RATES_KEY, JSON.stringify(legacy.ratesCache));
      return migrateCachedPayload(legacy.ratesCache);
    }
  } catch {
    return undefined;
  }
}

function migrateCachedPayload(payload: RatesPayload): RatesPayload {
  if (payload.base.includes(':')) return payload;
  const rates: Record<string, number> = {};
  const cryptoMeta: Record<string, CryptoMeta> = {};
  for (const [code, rate] of Object.entries(payload.rates || {})) {
    const meta = payload.cryptoMeta?.[code];
    const id = meta ? cryptoId(meta.id) : fiatId(code);
    rates[id] = rate;
    if (meta) cryptoMeta[id] = { ...meta, symbol: meta.symbol || code };
  }
  return {
    ...payload,
    base: fiatId(payload.base),
    rates,
    cryptoMeta,
    fiatUpdatedAt: payload.fiatUpdatedAt || payload.date,
    cryptoUpdatedAt:
      payload.cryptoUpdatedAt || new Date(payload.fetchedAt).toISOString(),
    fiatStatus: payload.fiatStatus || 'success',
    cryptoStatus: payload.cryptoStatus || 'success',
    failedSources: payload.failedSources || [],
  };
}

export function saveRatesCache(payload: RatesPayload) {
  try {
    localStorage.setItem(RATES_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
