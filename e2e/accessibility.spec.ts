import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no serious accessibility violations', async ({ page }) => {
  await page.route('https://open.er-api.com/**', (route) =>
    route.fulfill({
      json: {
        result: 'success',
        base_code: 'USD',
        time_last_update_utc: 'Thu, 01 Jan 2026 00:00:00 +0000',
        rates: { USD: 1, EUR: 0.9, RUB: 90 },
      },
    }),
  );
  await page.route('https://api.coingecko.com/**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          image: '',
          current_price: 100000,
        },
      ],
    }),
  );
  await page.goto('/?locale=en');
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((issue) =>
      ['serious', 'critical'].includes(issue.impact || ''),
    ),
  ).toEqual([]);
});
