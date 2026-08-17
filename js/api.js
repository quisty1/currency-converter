// Open Exchange Rates API base URL (v6 latest)
const API_BASE = 'https://open.er-api.com/v6/latest';

// CoinGecko top coins by market cap (no API key)
const CRYPTO_API =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=1000&page=1';

// cache older than 6 hours is stale
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// fiat seed until the first rates load / with no cache
export const CURRENCIES = [
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

// crypto seed until the first CoinGecko load
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

// codes from the API response; without rates, fiat + crypto seed
export function currencyCodesFromRates(ratesPayload) {
  if (!ratesPayload?.rates) return [...CURRENCIES, ...CRYPTO_SEED].sort();
  const codes = new Set(Object.keys(ratesPayload.rates));
  if (ratesPayload.base) codes.add(String(ratesPayload.base).toUpperCase());
  return [...codes].sort();
}

// fiat = everything not in cryptoMeta (not just the seed)
export function fiatCodes(ratesPayload) {
  const meta = ratesPayload?.cryptoMeta || {};
  if (!ratesPayload?.rates) return [...CURRENCIES];
  return Object.keys(ratesPayload.rates)
    .filter((code) => !meta[code])
    .sort();
}

// whether loaded crypto is present in cache/payload
export function hasCryptoMeta(cache) {
  return Boolean(cache?.cryptoMeta && Object.keys(cache.cryptoMeta).length);
}

// crypto from meta; without meta, seed (incl. fiat-only cache before fetch)
export function cryptoCodes(ratesPayload) {
  if (!hasCryptoMeta(ratesPayload)) return [...CRYPTO_SEED];
  return Object.keys(ratesPayload.cryptoMeta).sort();
}

export function isCryptoCode(code, ratesPayload) {
  const upper = String(code || '').toUpperCase();
  return Boolean(ratesPayload?.cryptoMeta?.[upper]);
}

// fiat ISO + crypto tickers (2–10 chars)
export function isCurrencyCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{2,10}$/.test(code);
}

// delay with AbortSignal (backoff between retries)
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// true if there is no cache or fetchedAt is older than TTL
export function isCacheStale(cache, ttlMs = CACHE_TTL_MS) {
  if (!cache?.rates || !cache.fetchedAt) return true;
  return Date.now() - cache.fetchedAt > ttlMs;
}

// fetch fiat rates vs base (always USD when merging)
// retries with exponential backoff; AbortError is rethrown immediately
export async function fetchRates(base, { signal, retries = 2 } = {}) {
  const code = String(base || 'USD').toUpperCase();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(code)}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.result !== 'success' || !data.rates) {
        throw new Error(data['error-type'] || 'bad_response');
      }

      return {
        base: data.base_code,
        date: data.time_last_update_utc,
        rates: data.rates,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
      if (attempt < retries) {
        // 300ms, 600ms, …
        await sleep(300 * 2 ** attempt, signal);
      }
    }
  }

  throw lastError;
}

// top-200 crypto in USD; rates[SYMBOL] = coins per 1 USD
// duplicate tickers: keep the first (higher market cap)
export async function fetchCryptoMarkets({ signal, retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(CRYPTO_API, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || !data.length) {
        throw new Error('bad_crypto_response');
      }

      const rates = {};
      const meta = {};

      for (const coin of data) {
        const symbol = String(coin.symbol || '').toUpperCase();
        const price = Number(coin.current_price);
        if (!symbol || !Number.isFinite(price) || price <= 0) continue;
        // ticker already present with a higher market cap — skip
        if (meta[symbol]) continue;

        rates[symbol] = 1 / price;
        meta[symbol] = {
          name: coin.name || symbol,
          image: coin.image || '',
          id: coin.id || symbol.toLowerCase(),
        };
      }

      if (!Object.keys(rates).length) {
        throw new Error('empty_crypto_rates');
      }

      return { rates, meta, fetchedAt: Date.now() };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
      if (attempt < retries) {
        await sleep(300 * 2 ** attempt, signal);
      }
    }
  }

  throw lastError;
}

// merge fiat + crypto into one USD-based payload
// partial: fiat-only or crypto-only is allowed
export function mergeRates(fiatPayload, cryptoResult) {
  const rates = {};
  let date = null;
  let fetchedAt = Date.now();
  const cryptoMeta = {};

  if (fiatPayload?.rates) {
    Object.assign(rates, fiatPayload.rates);
    if (fiatPayload.base) {
      rates[String(fiatPayload.base).toUpperCase()] = 1;
    }
    date = fiatPayload.date || date;
    fetchedAt = fiatPayload.fetchedAt || fetchedAt;
  }

  if (cryptoResult?.rates) {
    // crypto does not overwrite fiat on a ticker collision
    for (const [symbol, rate] of Object.entries(cryptoResult.rates)) {
      if (rates[symbol] != null) continue;
      rates[symbol] = rate;
      if (cryptoResult.meta?.[symbol]) {
        cryptoMeta[symbol] = cryptoResult.meta[symbol];
      }
    }
    fetchedAt = Math.max(fetchedAt, cryptoResult.fetchedAt || 0);
  }

  if (!Object.keys(rates).length) return null;

  return {
    base: 'USD',
    date: date || new Date().toUTCString(),
    rates,
    fetchedAt,
    cryptoMeta,
  };
}

// convert amount from → to using ratesPayload
// direct rate if cache base matches; otherwise a cross rate
export function convert(amount, from, to, ratesPayload) {
  if (!ratesPayload?.rates) return null;
  if (!Number.isFinite(amount)) return null;

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();

  if (fromCode === toCode) return amount;

  if (ratesPayload.base === fromCode) {
    const rate = ratesPayload.rates[toCode];
    return rate == null ? null : amount * rate;
  }

  // if the cache uses another base, cross through the cache base
  const fromRate =
    fromCode === ratesPayload.base ? 1 : ratesPayload.rates[fromCode];
  const toRate = toCode === ratesPayload.base ? 1 : ratesPayload.rates[toCode];
  if (fromRate == null || toRate == null || fromRate === 0) return null;
  return (amount / fromRate) * toRate;
}

// rate of 1 unit from → to
export function unitRate(from, to, ratesPayload) {
  return convert(1, from, to, ratesPayload);
}
