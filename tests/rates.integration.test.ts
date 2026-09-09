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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('rates API', () => {
  it('validates and merges fiat and crypto', async () => {
    const result = await fetchRates();
    expect(result.base).toBe('USD');
    expect(result.rates.EUR).toBe(0.9);
    expect(result.rates.BTC).toBeCloseTo(0.00001);
    expect(result.cryptoMeta.BTC.name).toBe('Bitcoin');
  });
  it('keeps useful partial data when one provider fails', async () => {
    server.use(
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const result = await fetchRates();
    expect(result.rates.RUB).toBe(90);
    expect(result.cryptoMeta).toEqual({});
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
