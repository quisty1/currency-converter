// smoke-тесты api.js: convert, unitRate, isCacheStale, mergeRates, коды
// запуск: npm test
import assert from 'node:assert/strict';
import {
  CACHE_TTL_MS,
  CRYPTO_SEED,
  convert,
  cryptoCodes,
  fiatCodes,
  hasCryptoMeta,
  isCacheStale,
  isCurrencyCode,
  mergeRates,
  unitRate,
} from '../js/api.js';

// фикстура курсов относительно USD (фиат + крипта)
const rates = {
  base: 'USD',
  date: 'Thu, 31 Jul 2026 00:00:00 +0000',
  fetchedAt: Date.now(),
  rates: {
    EUR: 0.9,
    RUB: 90,
    JPY: 150,
    USD: 1,
    // 1 BTC = 100_000 USD → 1/100000 BTC за 1 USD
    BTC: 1 / 100_000,
    ETH: 1 / 4_000,
  },
  cryptoMeta: {
    BTC: {
      name: 'Bitcoin',
      image: 'https://example.com/btc.png',
      id: 'bitcoin',
    },
    ETH: {
      name: 'Ethereum',
      image: 'https://example.com/eth.png',
      id: 'ethereum',
    },
  },
};

// прямой курс, обратный, кросс-курс EUR→RUB, same currency
assert.equal(convert(100, 'USD', 'EUR', rates), 90);
assert.equal(convert(90, 'EUR', 'USD', rates), 100);
assert.equal(convert(1, 'EUR', 'RUB', rates), 100);
assert.equal(convert(10, 'USD', 'USD', rates), 10);
// невалидные входы
assert.equal(convert(NaN, 'USD', 'EUR', rates), null);
assert.equal(convert(10, 'USD', 'EUR', null), null);
assert.equal(unitRate('USD', 'RUB', rates), 90);

// крипта ↔ фиат и crypto↔crypto через USD
assert.ok(Math.abs(convert(1, 'BTC', 'USD', rates) - 100_000) < 1e-6);
assert.ok(Math.abs(convert(100_000, 'USD', 'BTC', rates) - 1) < 1e-12);
assert.ok(Math.abs(convert(1, 'BTC', 'RUB', rates) - 9_000_000) < 1e-3);
assert.ok(
  Math.abs(convert(2, 'ETH', 'BTC', rates) - 2 * (4_000 / 100_000)) < 1e-12,
);

// TTL: свежий / старше CACHE_TTL_MS
assert.equal(isCacheStale(null), true);
assert.equal(isCacheStale({ rates: {}, fetchedAt: Date.now() }), false);
assert.equal(
  isCacheStale({ rates: {}, fetchedAt: Date.now() - CACHE_TTL_MS - 1 }),
  true,
);

// валидация кодов
assert.equal(isCurrencyCode('USD'), true);
assert.equal(isCurrencyCode('BTC'), true);
assert.equal(isCurrencyCode('USDT'), true);
assert.equal(isCurrencyCode('DOGE'), true);
assert.equal(isCurrencyCode('A'), false);
assert.equal(isCurrencyCode('TOOLONGCODE'), false);

// mergeRates: фиат + крипта, коллизия тикера не затирает фиат
const merged = mergeRates(
  {
    base: 'USD',
    date: 'Thu, 31 Jul 2026 00:00:00 +0000',
    fetchedAt: 1000,
    rates: { EUR: 0.9, RUB: 90 },
  },
  {
    rates: { BTC: 0.00001, EUR: 999 },
    meta: {
      BTC: { name: 'Bitcoin', image: '', id: 'bitcoin' },
      EUR: { name: 'Fake Euro', image: '', id: 'fake-eur' },
    },
    fetchedAt: 2000,
  },
);

assert.ok(merged);
assert.equal(merged.base, 'USD');
assert.equal(merged.rates.EUR, 0.9);
assert.equal(merged.rates.BTC, 0.00001);
assert.equal(merged.rates.USD, 1);
assert.ok(merged.cryptoMeta.BTC);
assert.equal(merged.cryptoMeta.EUR, undefined);
assert.equal(merged.fetchedAt, 2000);

assert.deepEqual(fiatCodes(rates).sort(), ['EUR', 'JPY', 'RUB', 'USD']);
assert.deepEqual(cryptoCodes(rates).sort(), ['BTC', 'ETH']);

// фиат-only кэш: meta нет → seed, не пустой список
assert.equal(hasCryptoMeta(null), false);
assert.equal(hasCryptoMeta({ rates: { EUR: 1 } }), false);
assert.equal(hasCryptoMeta({ rates: { EUR: 1 }, cryptoMeta: {} }), false);
assert.equal(hasCryptoMeta(rates), true);
assert.deepEqual(
  cryptoCodes({ rates: { EUR: 1 } }).sort(),
  [...CRYPTO_SEED].sort(),
);
assert.deepEqual(cryptoCodes(null).sort(), [...CRYPTO_SEED].sort());

console.log('ok — api tests passed');
