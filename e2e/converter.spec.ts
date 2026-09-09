import { expect, test } from '@playwright/test';

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
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    image: '',
    current_price: 4000,
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://open.er-api.com/**', (route) =>
    route.fulfill({ json: fiat }),
  );
  await page.route('https://api.coingecko.com/**', (route) =>
    route.fulfill({ json: crypto }),
  );
  await page.goto('/?amount=100&from=USD&to=RUB,EUR,BTC&locale=ru');
});

test('converts, updates URL and opens currency manager', async ({ page }) => {
  await expect(page.getByText('9 000 RUB')).toBeVisible();
  await page.getByLabel('Сумма').fill('200');
  await expect(page).toHaveURL(/amount=200/);
  await expect(page.getByText('18 000 RUB')).toBeVisible();
  await page.getByRole('button', { name: 'Настроить список' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder('Название или код валюты').fill('EUR');
  await page.getByRole('dialog').getByRole('button', { name: /^EUR / }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByText('EUR', { exact: true })).not.toBeVisible();
});
