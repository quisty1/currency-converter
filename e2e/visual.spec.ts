import { expect, test } from '@playwright/test';

test('converter visual baseline', async ({ page }) => {
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
        {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          image: '',
          current_price: 4000,
        },
      ],
    }),
  );
  await page.route('https://flagcdn.com/**', (route) => route.abort());
  await page.goto('/?amount=100&from=USD&to=RUB,EUR,BTC&locale=en&theme=light');
  await expect(page.getByText('9,000 RUB')).toBeVisible();
  await expect(page).toHaveScreenshot('converter.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
