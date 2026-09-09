import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchRates } from '../src/api/rates';

const fiat = {
  result: 'success',
  base_code: 'USD',
  time_last_update_utc: 'Thu, 01 Jan 2026 00:00:00 +0000',
  rates: { USD: 1, EUR: 0.9, RUB: 90 },
};
const crypto = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://example.com/btc.png',
    current_price: 100000,
  },
];
const server = setupServer(
  http.get('https://open.er-api.com/v6/latest/USD', () =>
    HttpResponse.json(fiat),
  ),
  http.get('https://api.coingecko.com/api/v3/coins/markets', () =>
    HttpResponse.json(crypto),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

describe('rates API', () => {
  it('validates and merges fiat and crypto', async () => {
    const result = await fetchRates();
    expect(result.base).toBe('fiat:USD');
    expect(result.rates['fiat:EUR']).toBe(0.9);
    expect(result.rates['crypto:bitcoin']).toBeCloseTo(0.00001);
    expect(result.cryptoMeta['crypto:bitcoin'].name).toBe('Bitcoin');
    expect(result.failedSources).toEqual([]);
  });
  it('keeps useful partial data when one provider fails', async () => {
    server.use(
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const result = await fetchRates();
    expect(result.rates['fiat:RUB']).toBe(90);
    expect(result.cryptoStatus).toBe('error');
    expect(result.failedSources).toEqual(['crypto']);
  });
  it('reports a fiat-only failure while retaining crypto', async () => {
    server.use(
      http.get(
        'https://open.er-api.com/v6/latest/USD',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const result = await fetchRates();
    expect(result.fiatStatus).toBe('error');
    expect(result.cryptoStatus).toBe('success');
    expect(result.rates['crypto:bitcoin']).toBeCloseTo(0.00001);
    expect(result.failedSources).toEqual(['fiat']);
  });
  it('keeps cached provider data during a partial refresh', async () => {
    await fetchRates();
    server.use(
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const result = await fetchRates();
    expect(result.cryptoStatus).toBe('error');
    expect(result.rates['crypto:bitcoin']).toBeCloseTo(0.00001);
  });
  it('keeps colliding crypto symbols as separate CoinGecko IDs', async () => {
    server.use(
      http.get('https://api.coingecko.com/api/v3/coins/markets', () =>
        HttpResponse.json([
          crypto[0],
          { ...crypto[0], id: 'bitcoin-2', name: 'Bitcoin 2' },
        ]),
      ),
    );
    const result = await fetchRates();
    expect(Object.keys(result.cryptoMeta)).toEqual([
      'crypto:bitcoin',
      'crypto:bitcoin-2',
    ]);
  });
  it('loads a saved crypto ID outside the top list', async () => {
    server.use(
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        ({ request }) => {
          const requested = new URL(request.url).searchParams.get('ids');
          return HttpResponse.json(
            requested
              ? [
                  {
                    ...crypto[0],
                    id: 'rare-coin',
                    symbol: 'rare',
                    name: 'Rare Coin',
                  },
                ]
              : crypto,
          );
        },
      ),
    );
    const result = await fetchRates(undefined, ['rare-coin']);
    expect(result.cryptoMeta['crypto:rare-coin'].symbol).toBe('RARE');
  });
  it('fails when both providers fail', async () => {
    server.use(
      http.get(
        'https://open.er-api.com/v6/latest/USD',
        () => new HttpResponse(null, { status: 503 }),
      ),
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await expect(fetchRates()).rejects.toThrow('Could not load currency rates');
  });
});
