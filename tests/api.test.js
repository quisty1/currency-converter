import assert from 'node:assert/strict';
import { convert, isCacheStale, unitRate, CACHE_TTL_MS } from '../js/api.js';

const rates = {
  base: 'USD',
  date: 'Thu, 31 Jul 2026 00:00:00 +0000',
  fetchedAt: Date.now(),
  rates: {
    EUR: 0.9,
    RUB: 90,
    JPY: 150,
    USD: 1,
  },
};

assert.equal(convert(100, 'USD', 'EUR', rates), 90);
assert.equal(convert(90, 'EUR', 'USD', rates), 100);
assert.equal(convert(1, 'EUR', 'RUB', rates), 100);
assert.equal(convert(10, 'USD', 'USD', rates), 10);
assert.equal(convert(NaN, 'USD', 'EUR', rates), null);
assert.equal(convert(10, 'USD', 'EUR', null), null);
assert.equal(unitRate('USD', 'RUB', rates), 90);

assert.equal(isCacheStale(null), true);
assert.equal(isCacheStale({ rates: {}, fetchedAt: Date.now() }), false);
assert.equal(
  isCacheStale({ rates: {}, fetchedAt: Date.now() - CACHE_TTL_MS - 1 }),
  true,
);

console.log('ok — api tests passed');
