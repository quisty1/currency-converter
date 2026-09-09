import { describe, expect, it, vi } from 'vitest';
import {
  convert,
  isCacheStale,
  isCurrencyCode,
  parseAmount,
  unitRate,
} from '../src/domain/currency';
import type { RatesPayload } from '../src/domain/types';
import { currencyCountry, flagUrl } from '../src/domain/currencyCountry';

const payload: RatesPayload = {
  base: 'USD',
  date: '2026-01-01',
  fetchedAt: Date.now(),
  rates: { USD: 1, EUR: 0.9, RUB: 90, BTC: 1 / 100_000 },
  cryptoMeta: { BTC: { name: 'Bitcoin', image: '', id: 'bitcoin' } },
};

describe('currency domain', () => {
  it('parses localized amounts', () => {
    expect(parseAmount('1 234,50')).toBe(1234.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('not a number')).toBeNull();
  });
  it('converts direct, inverse, cross and crypto rates', () => {
    expect(convert(100, 'USD', 'EUR', payload)).toBe(90);
    expect(convert(90, 'EUR', 'USD', payload)).toBe(100);
    expect(convert(1, 'EUR', 'RUB', payload)).toBe(100);
    expect(convert(1, 'BTC', 'USD', payload)).toBeCloseTo(100_000);
    expect(unitRate('USD', 'RUB', payload)).toBe(90);
  });
  it('rejects unavailable data and bad codes', () => {
    expect(convert(1, 'USD', 'AAA', payload)).toBeNull();
    expect(isCurrencyCode('USDT')).toBe(true);
    expect(isCurrencyCode('x')).toBe(false);
  });
  it('detects stale cache', () => {
    vi.setSystemTime(new Date('2026-01-02T12:00:00Z'));
    expect(isCacheStale({ ...payload, fetchedAt: Date.now() })).toBe(false);
    expect(
      isCacheStale({ ...payload, fetchedAt: Date.now() - 21_600_001 }),
    ).toBe(true);
    vi.useRealTimers();
  });
  it('maps common and less common fiat currencies to flag URLs', () => {
    expect(currencyCountry('USD')).toBe('US');
    expect(currencyCountry('afn')).toBe('AF');
    expect(flagUrl('ALL')).toBe('https://flagcdn.com/w80/al.png');
    expect(flagUrl('AMD')).toBe('https://flagcdn.com/w80/am.png');
    expect(flagUrl('XAU')).toBeUndefined();
    expect(flagUrl('BTC')).toBeUndefined();
  });
});
