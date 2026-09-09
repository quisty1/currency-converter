import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has no serious accessibility violations', async ({ page }) => {
  await page.route('https://open.er-api.com/**', (route) =>
    route.fulfill({
      json: {
        result: 'success',
        base_code: 'USD',
        time_last_update_utc: 'Thu, 01 Jan 2026 00:00:00 +0000',
        rates: { USD: 1, EUR: 0.9, RUB: 90, GBP: 0.8 },
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

test('localizes controls, exposes checkbox actions and keeps mobile touch targets large', async ({
  page,
}) => {
  await page.route('https://open.er-api.com/**', (route) =>
    route.fulfill({
      json: {
        result: 'success',
        base_code: 'USD',
        time_last_update_utc: 'Thu, 01 Jan 2026 00:00:00 +0000',
        rates: { USD: 1, EUR: 0.9, RUB: 90, GBP: 0.8 },
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
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/?amount=100&from=USD&to=RUB,EUR,BTC&locale=ru');
  await expect(page.getByRole('button', { name: 'Очистить' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть' })).toBeVisible();
  for (const name of ['Изменить порядок EUR', 'Копировать EUR', 'Убрать EUR']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Настроить список' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Убрать EUR' }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Добавить GBP' }),
  ).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
