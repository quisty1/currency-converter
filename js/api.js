const API_BASE = 'https://open.er-api.com/v6/latest';

/** кэш старше 6 часов считаем устаревшим */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

export function isCacheStale(cache, ttlMs = CACHE_TTL_MS) {
  if (!cache?.rates || !cache.fetchedAt) return true;
  return Date.now() - cache.fetchedAt > ttlMs;
}

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
        await sleep(300 * 2 ** attempt, signal);
      }
    }
  }

  throw lastError;
}

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

  // если кэш от другой базы — через кросс-курс к текущей базе кэша
  const fromRate =
    fromCode === ratesPayload.base ? 1 : ratesPayload.rates[fromCode];
  const toRate = toCode === ratesPayload.base ? 1 : ratesPayload.rates[toCode];
  if (fromRate == null || toRate == null || fromRate === 0) return null;
  return (amount / fromRate) * toRate;
}

/** курс 1 единицы from в to */
export function unitRate(from, to, ratesPayload) {
  return convert(1, from, to, ratesPayload);
}
