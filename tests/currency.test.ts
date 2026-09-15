import { describe, expect, it, vi } from 'vitest';
import {
  convert,
  isCacheStale,
  isCurrencyCode,
  parseAmount,
  unitRate,
  migrateAsset,
  urlAsset,
} from '../src/domain/currency';
import type { RatesPayload } from '../src/domain/types';
import { currencyCountry, flagUrl } from '../src/domain/currencyCountry';

const payload: RatesPayload = {
  base: 'fiat:USD',
  date: '2026-01-01',
  fetchedAt: Date.now(),
  fiatStatus: 'success',
  cryptoStatus: 'success',
  failedSources: [],
  rates: {
    'fiat:USD': 1,
    'fiat:EUR': 0.9,
    'fiat:RUB': 90,
    'crypto:bitcoin': 1 / 100_000,
  },
  cryptoMeta: {
    'crypto:bitcoin': {
      symbol: 'BTC',
      name: 'Bitcoin',
      image: '',
      id: 'bitcoin',
    },
  },
};

describe('currency domain', () => {
  it('parses localized amounts', () => {
    expect(parseAmount('1 234,50', 'ru')).toBe(1234.5);
    expect(parseAmount('1.234,50', 'ru')).toBe(1234.5);
    expect(parseAmount('1,234.50', 'en')).toBe(1234.5);
    expect(parseAmount('1,000', 'en')).toBe(1000);
    expect(parseAmount('1,000', 'ru')).toBe(1);
    expect(parseAmount('12.5', 'ru')).toBe(12.5);
    expect(parseAmount(',5', 'ru')).toBe(0.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('not a number')).toBeNull();
    expect(parseAmount('-10', 'ru')).toBeNull();
    expect(parseAmount('1e3', 'en')).toBeNull();
    expect(parseAmount('1,23,4', 'en')).toBeNull();
  });
  it('converts direct, inverse, cross and crypto rates', () => {
    expect(convert(100, 'USD', 'EUR', payload)).toBe(90);
    expect(convert(90, 'EUR', 'USD', payload)).toBe(100);
    expect(convert(1, 'EUR', 'RUB', payload)).toBe(100);
    expect(convert(1, 'crypto:bitcoin', 'fiat:USD', payload)).toBeCloseTo(
      100_000,
    );
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
  it('migrates legacy tickers deterministically and keeps URL IDs readable', () => {
    const colliding = {
      ...payload,
      cryptoMeta: {
        'crypto:zeta': { id: 'zeta', symbol: 'SAME', name: 'Zeta', image: '' },
        'crypto:alpha': {
          id: 'alpha',
          symbol: 'SAME',
          name: 'Alpha',
          image: '',
        },
      },
    };
    expect(migrateAsset('USD', payload)).toBe('fiat:USD');
    expect(migrateAsset('BTC', payload)).toBe('crypto:bitcoin');
    expect(migrateAsset('SAME', colliding)).toBe('crypto:alpha');
    expect(migrateAsset('INVALID', payload)).toBeNull();
    expect(urlAsset('fiat:EUR')).toBe('EUR');
    expect(urlAsset('crypto:bitcoin')).toBe('crypto:bitcoin');
  });
});
