import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConverterHero } from '../src/components/ConverterHero';
import { CurrencyManager } from '../src/components/CurrencyManager';
import { ResultsList } from '../src/components/ResultsList';
import { Header } from '../src/components/Header';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { createAppTheme } from '../src/theme';
import { useSettings } from '../src/store/settings';
import type { RatesPayload } from '../src/domain/types';

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
    'fiat:GBP': 0.8,
    'crypto:bitcoin': 0.00001,
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
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={createAppTheme('light', 'ru')}>
    <I18nProvider locale="ru">{children}</I18nProvider>
  </ThemeProvider>
);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  useSettings.setState({
    amount: '100',
    base: 'fiat:USD',
    targets: ['fiat:RUB', 'fiat:EUR', 'crypto:bitcoin'],
    locale: 'ru',
    theme: 'system',
  });
});

describe('converter UI', () => {
  it('accepts localized input and can clear it', async () => {
    const user = userEvent.setup();
    render(
      <ConverterHero
        payload={payload}
        codes={['fiat:USD', 'fiat:EUR', 'fiat:RUB', 'crypto:bitcoin']}
        onSwap={() => {}}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByLabelText('Сумма');
    await user.clear(input);
    await user.type(input, '12,5');
    expect(useSettings.getState().amount).toBe('12,5');
    await user.click(screen.getByLabelText('Очистить'));
    expect(useSettings.getState().amount).toBe('');
  });
  it('filters and selects currencies in the manager', async () => {
    const user = userEvent.setup();
    render(<CurrencyManager open onClose={() => {}} payload={payload} />, {
      wrapper: Wrapper,
    });
    await user.type(screen.getByLabelText('Название или код валюты'), 'EUR');
    await user.click(screen.getByText('EUR'));
    expect(useSettings.getState().targets).toEqual([
      'fiat:RUB',
      'crypto:bitcoin',
    ]);
  });
  it('removes a currency directly from the results list', async () => {
    const user = userEvent.setup();
    render(<ResultsList payload={payload} loading={false} />, {
      wrapper: Wrapper,
    });

    await user.click(screen.getByRole('button', { name: 'Убрать EUR' }));

    expect(useSettings.getState().targets).toEqual([
      'fiat:RUB',
      'crypto:bitcoin',
    ]);
    expect(screen.queryByText('EUR', { exact: true })).not.toBeInTheDocument();
  });
  it('copies exactly the localized card value and announces success', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    render(<ResultsList payload={payload} loading={false} />, {
      wrapper: Wrapper,
    });
    await user.click(screen.getByRole('button', { name: 'Копировать EUR' }));
    expect(writeText).toHaveBeenCalledWith('90 EUR');
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent === 'Скопировано'),
    ).toBe(true);
  });
  it('announces a Clipboard API failure without an unhandled error', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('denied'),
    );
    render(<ResultsList payload={payload} loading={false} />, {
      wrapper: Wrapper,
    });
    await user.click(screen.getByRole('button', { name: 'Копировать EUR' }));
    expect(
      screen
        .getAllByRole('status')
        .some(
          (node) => node.textContent === 'Не удалось скопировать результат',
        ),
    ).toBe(true);
  });
  it('labels selected and unselected manager checkboxes as actions', () => {
    render(<CurrencyManager open onClose={() => {}} payload={payload} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByRole('checkbox', { name: 'Убрать EUR' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Добавить GBP' }),
    ).not.toBeChecked();
  });
  it('replaces a newly selected base with the old base without duplicates', () => {
    useSettings.getState().setBase('fiat:EUR');
    expect(useSettings.getState().base).toBe('fiat:EUR');
    expect(useSettings.getState().targets).toEqual([
      'fiat:RUB',
      'fiat:USD',
      'crypto:bitcoin',
    ]);
  });
  it('changes language and cycles through theme choices in Header', async () => {
    const user = userEvent.setup();
    render(<Header />, { wrapper: Wrapper });
    await user.click(screen.getByRole('combobox', { name: 'Язык' }));
    await user.click(screen.getByRole('option', { name: 'EN' }));
    expect(useSettings.getState().locale).toBe('en');
    await user.click(screen.getByRole('button', { name: 'Тема: Системная' }));
    expect(useSettings.getState().theme).toBe('light');
  });
  it('localizes Autocomplete service labels through the MUI locale', () => {
    render(
      <ConverterHero
        payload={payload}
        codes={['fiat:USD', 'fiat:EUR']}
        onSwap={() => {}}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByRole('button', { name: 'Открыть' })).toBeVisible();
  });
});
