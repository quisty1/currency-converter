import { expect, test } from '@playwright/test';

const fiat = {
  result: 'success',
  base_code: 'USD',
  time_last_update_utc: 'Thu, 01 Jan 2026 00:00:00 +0000',
  rates: { USD: 1, EUR: 0.9, RUB: 90, VND: 25932.753 },
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

test('removes a currency directly from the results list', async ({ page }) => {
  await page.getByRole('button', { name: 'Убрать EUR' }).click();

  await expect(page.getByText('EUR', { exact: true })).not.toBeVisible();
  await expect(page).toHaveURL(/to=RUB%2Ccrypto%3Abitcoin/);
});

test('swaps the base with the first result and keeps the old base visible', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Поменять местами' }).click();

  await expect(page).toHaveURL(/from=RUB/);
  await expect(page).toHaveURL(/to=USD%2CEUR%2Ccrypto%3Abitcoin/);
  await expect(page.getByText('1,1111 USD')).toBeVisible();
});

test('fits long results on an iPhone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(
    '/?amount=1000000&from=USD&to=RUB,EUR,BTC,ETH,VND&locale=en&theme=dark',
  );

  await expect(page.getByText('25,932,753,000 VND')).toBeVisible();
  const cryptoTags = page.getByText('crypto', { exact: true });
  await expect(cryptoTags.first()).toBeHidden();
  await expect(cryptoTags.last()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Remove BTC' })).toBeVisible();
  const btcCard = page.getByRole('listitem').filter({ hasText: 'BTC' }).first();
  const avatarBox = await btcCard.locator('.MuiAvatar-root').boundingBox();
  const codeBox = await btcCard.getByText('BTC', { exact: true }).boundingBox();
  if (!avatarBox || !codeBox) throw new Error('BTC card layout is not visible');
  expect(avatarBox.y + avatarBox.height).toBeLessThanOrEqual(codeBox.y);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test('has no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?amount=1000000&from=USD&to=RUB,EUR,BTC&locale=ru');
  await expect(page.getByText('90 000 000 RUB')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('supports keyboard reordering without duplicates', async ({ page }) => {
  const handle = page.getByRole('button', { name: 'Изменить порядок RUB' });
  await handle.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page).toHaveURL(/to=EUR%2CRUB%2Ccrypto%3Abitcoin/);
});
