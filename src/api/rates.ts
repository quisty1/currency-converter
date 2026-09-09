import { z } from 'zod';
import type { CryptoMeta, RatesPayload } from '../domain/types';

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

export async function fetchRates(signal?: AbortSignal): Promise<RatesPayload> {
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

  const rates: Record<string, number> = {};
  const cryptoMeta: Record<string, CryptoMeta> = {};
  let date = new Date().toUTCString();

  if (fiatResult.status === 'fulfilled') {
    Object.assign(rates, fiatResult.value.rates, { USD: 1 });
    date = fiatResult.value.time_last_update_utc;
  }

  if (cryptoResult.status === 'fulfilled') {
    for (const coin of cryptoResult.value) {
      const code = coin.symbol.toUpperCase();
      // Fiat symbols take precedence when a crypto token reuses the same ticker.
      if (!code || rates[code] != null || cryptoMeta[code]) continue;
      // Store crypto as units per USD to match the fiat provider's rate direction.
      rates[code] = 1 / coin.current_price;
      cryptoMeta[code] = { id: coin.id, name: coin.name, image: coin.image };
    }
  }

  const payload = {
    base: 'USD',
    date,
    fetchedAt: Date.now(),
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
    if (own) return JSON.parse(own) as RatesPayload;
    const legacy = JSON.parse(
      localStorage.getItem('fx-multi-state') || '{}',
    ) as { ratesCache?: RatesPayload };
    if (legacy.ratesCache) {
      // Migrate cache data written by versions that embedded it in app settings.
      localStorage.setItem(RATES_KEY, JSON.stringify(legacy.ratesCache));
      return legacy.ratesCache;
    }
  } catch {
    return undefined;
  }
}

export function saveRatesCache(payload: RatesPayload) {
  try {
    localStorage.setItem(RATES_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
