import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConverterHero } from '../src/components/ConverterHero';
import { CurrencyManager } from '../src/components/CurrencyManager';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { createAppTheme } from '../src/theme';
import { useSettings } from '../src/store/settings';
import type { RatesPayload } from '../src/domain/types';

const payload: RatesPayload = {
  base: 'USD',
  date: '2026-01-01',
  fetchedAt: Date.now(),
  rates: { USD: 1, EUR: 0.9, RUB: 90, BTC: 0.00001 },
  cryptoMeta: { BTC: { name: 'Bitcoin', image: '', id: 'bitcoin' } },
};
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={createAppTheme('light')}>
    <I18nProvider locale="ru">{children}</I18nProvider>
  </ThemeProvider>
);

beforeEach(() =>
  useSettings.setState({
    amount: '100',
    base: 'USD',
    targets: ['RUB', 'EUR', 'BTC'],
    locale: 'ru',
    theme: 'system',
  }),
);

describe('converter UI', () => {
  it('accepts localized input and can clear it', async () => {
    const user = userEvent.setup();
    render(
      <ConverterHero
        payload={payload}
        codes={['USD', 'EUR', 'RUB', 'BTC']}
        onSwap={() => {}}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByLabelText('Сумма');
    await user.clear(input);
    await user.type(input, '12,5');
    expect(useSettings.getState().amount).toBe('12,5');
    await user.click(screen.getByLabelText('Clear'));
    expect(useSettings.getState().amount).toBe('');
  });
  it('filters and selects currencies in the manager', async () => {
    const user = userEvent.setup();
    render(<CurrencyManager open onClose={() => {}} payload={payload} />, {
      wrapper: Wrapper,
    });
    await user.type(screen.getByLabelText('Название или код валюты'), 'EUR');
    await user.click(screen.getByText('EUR'));
    expect(useSettings.getState().targets).toEqual(['RUB', 'BTC']);
  });
});
