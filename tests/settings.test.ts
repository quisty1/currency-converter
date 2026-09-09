import { beforeEach, describe, expect, it } from 'vitest';
import {
  readSettings,
  resolvePendingLegacyUrl,
  settingsFromUrl,
  urlHasInvalidSettings,
} from '../src/store/settings';
import type { SettingsState } from '../src/domain/types';

const current: SettingsState = {
  amount: '25',
  base: 'fiat:GEL',
  targets: ['fiat:USD', 'fiat:EUR'],
  locale: 'ru',
  theme: 'system',
};

describe('URL settings normalization', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['en-US'],
    });
  });

  it('drops unknown and duplicate targets and falls back for an invalid base', () => {
    history.replaceState(
      null,
      '',
      '/?amount=abc&from=XXX&to=USD,USD,INVALID&locale=xx',
    );
    const result = settingsFromUrl(current);
    expect(result.amount).toBe('100');
    expect(result.base).toBe('fiat:USD');
    expect(result.targets).toEqual(['fiat:USD']);
    expect(result.locale).toBe('en');
    expect(urlHasInvalidSettings()).toBe(true);
  });

  it('handles empty query values predictably', () => {
    history.replaceState(null, '', '/?amount=&from=&to=');
    const result = settingsFromUrl(current);
    expect(result.amount).toBe('100');
    expect(result.base).toBe('fiat:USD');
    expect(result.targets).toEqual(current.targets);
    expect(urlHasInvalidSettings()).toBe(true);
  });

  it('accepts canonical fiat and crypto IDs', () => {
    history.replaceState(
      null,
      '',
      '/?amount=12.5&from=EUR&to=USD,crypto:bitcoin&locale=ru',
    );
    expect(settingsFromUrl(current)).toMatchObject({
      amount: '12.5',
      base: 'fiat:EUR',
      targets: ['fiat:USD', 'crypto:bitcoin'],
      locale: 'ru',
    });
    expect(urlHasInvalidSettings()).toBe(false);
  });

  it('migrates a legacy symbol after the provider catalog arrives', () => {
    history.replaceState(null, '', '/?from=USD&to=SAME');
    settingsFromUrl(current);
    const result = resolvePendingLegacyUrl({
      base: 'fiat:USD',
      date: '2026-01-01',
      fetchedAt: 1,
      fiatStatus: 'success',
      cryptoStatus: 'success',
      failedSources: [],
      rates: { 'fiat:USD': 1, 'crypto:zeta': 1, 'crypto:alpha': 2 },
      cryptoMeta: {
        'crypto:zeta': { id: 'zeta', symbol: 'SAME', name: 'Zeta', image: '' },
        'crypto:alpha': {
          id: 'alpha',
          symbol: 'SAME',
          name: 'Alpha',
          image: '',
        },
      },
    });
    expect(result?.targets).toEqual(['crypto:alpha']);
  });

  it('defers legacy localStorage ticker migration until catalog load', () => {
    history.replaceState(null, '', '/');
    localStorage.setItem(
      'fx-multi-state',
      JSON.stringify({
        base: 'USD',
        targets: ['RUB', 'SAME'],
        amount: '1',
        locale: 'en',
        theme: 'light',
      }),
    );
    readSettings();
    const result = resolvePendingLegacyUrl({
      base: 'fiat:USD',
      date: '2026-01-01',
      fetchedAt: 1,
      fiatStatus: 'success',
      cryptoStatus: 'success',
      failedSources: [],
      rates: { 'fiat:USD': 1, 'fiat:RUB': 90, 'crypto:alpha': 2 },
      cryptoMeta: {
        'crypto:alpha': {
          id: 'alpha',
          symbol: 'SAME',
          name: 'Alpha',
          image: '',
        },
      },
    });
    expect(result?.targets).toEqual(['fiat:RUB', 'crypto:alpha']);
  });
});
