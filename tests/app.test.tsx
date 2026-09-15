import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import App from '../src/App';
import { useSettings } from '../src/store/settings';

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
    image: '',
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

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App rate states and controls', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(
      null,
      '',
      '/?amount=100&from=USD&to=RUB,EUR,BTC&locale=en',
    );
    useSettings.setState({
      amount: '100',
      base: 'fiat:USD',
      targets: ['fiat:RUB', 'fiat:EUR', 'crypto:bitcoin'],
      locale: 'en',
      theme: 'system',
    });
  });

  it('shows successful data and separate freshness timestamps', async () => {
    renderApp();
    expect(await screen.findByText('9,000 RUB')).toBeVisible();
    expect(screen.getByText(/Fiat:/)).toHaveTextContent('Crypto:');
    expect(screen.getByText(/Last checked:/)).toBeVisible();
  });

  it('warns on crypto-only failure and preserves fiat results', async () => {
    server.use(
      http.get(
        'https://api.coingecko.com/api/v3/coins/markets',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    renderApp();
    expect(await screen.findByText('Crypto rates unavailable')).toBeVisible();
    expect(screen.getByText('9,000 RUB')).toBeVisible();
    expect(screen.queryByText('Live rates')).not.toBeInTheDocument();
  });

  it('refreshes and clears a transient provider warning', async () => {
    let calls = 0;
    server.use(
      http.get('https://api.coingecko.com/api/v3/coins/markets', () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(crypto);
      }),
    );
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText('Crypto rates unavailable')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Refresh rates' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Crypto rates unavailable'),
      ).not.toBeInTheDocument(),
    );
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('swaps the base with the first result without losing other targets', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('9,000 RUB');
    await user.click(screen.getByRole('button', { name: 'Swap currencies' }));
    expect(useSettings.getState().base).toBe('fiat:RUB');
    expect(useSettings.getState().targets).toEqual([
      'fiat:USD',
      'fiat:EUR',
      'crypto:bitcoin',
    ]);
    expect(await screen.findByText('1.1111 USD')).toBeVisible();
  });

  it('keeps stale cached results visible when both providers are offline', async () => {
    localStorage.setItem(
      'fx-multi-rates',
      JSON.stringify({
        base: 'fiat:USD',
        date: '2026-01-01',
        fetchedAt: Date.now() - 24 * 60 * 60 * 1000,
        fiatUpdatedAt: '2026-01-01',
        cryptoUpdatedAt: '2026-01-01',
        fiatStatus: 'success',
        cryptoStatus: 'success',
        failedSources: [],
        rates: {
          'fiat:USD': 1,
          'fiat:RUB': 90,
          'fiat:EUR': 0.9,
          'crypto:bitcoin': 0.00001,
        },
        cryptoMeta: {
          'crypto:bitcoin': {
            id: 'bitcoin',
            symbol: 'BTC',
            name: 'Bitcoin',
            image: '',
          },
        },
      }),
    );
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
    renderApp();
    expect(await screen.findByText('9,000 RUB')).toBeVisible();
    expect(
      await screen.findByText(
        'Could not refresh rates. Using saved data.',
        {},
        { timeout: 7000 },
      ),
    ).toBeVisible();
  }, 10000);

  it('shows a total failure when no cache exists', async () => {
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
    renderApp();
    expect(
      await screen.findByText(
        'Could not load rates. Check your connection and try again.',
        {},
        { timeout: 7000 },
      ),
    ).toBeVisible();
  }, 10000);
});
