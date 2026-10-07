import { test, expect, type Page } from '@playwright/test';

const payment = {
  id: 1, bookingId: 123, transactionId: 'backend-transaction', totalAmount: 1000,
  currency: 'BDT', status: 'Initiated', paidAt: null,
};

async function fixture(page: Page, responses: Array<{ status: number; body: unknown }>, guest = false) {
  const calls: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5179') return route.abort();
    if (url.pathname === '/api/auth/refresh') return route.fulfill({
      status: guest ? 401 : 200, json: guest ? {} : {
        userId: 'fixture-customer', email: 'fixture@security.invalid', role: 'Customer',
        accessToken: 'fixture-access-token', accessTokenExpiry: '2099-01-01T00:00:00Z',
      },
    });
    if (url.pathname === '/api/payments/booking/123') {
      calls.push(route.request().headers().authorization ?? '');
      const result = responses[Math.min(calls.length - 1, responses.length - 1)];
      return route.fulfill({ status: result.status, json: result.body });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
    return route.continue();
  });
  return calls;
}

test('F1: forged success URL cannot confirm an unresolved payment', async ({ page }) => {
  const calls = await fixture(page, [{ status: 200, body: payment }]);
  await page.goto('/e2e/fixtures/payment.html?status=success&bookingId=123&amount=999999&tranId=forged-transaction');
  await expect(page.getByRole('heading', { name: 'Payment Not Confirmed', exact: true })).toBeVisible();
  await expect(page.locator('dl')).toContainText('Initiated');
  await expect(page.locator('main')).not.toContainText('forged-transaction');
  await expect(page.locator('main')).not.toContainText('999999');
  expect(calls).toEqual(['Bearer fixture-access-token']);
});

test('F1: backend completion wins over failure URL and forged receipt details', async ({ page }) => {
  await fixture(page, [{ status: 200, body: { ...payment, status: 'Completed', paidAt: '2026-10-07T00:00:00Z' } }]);
  await page.goto('/e2e/fixtures/payment.html?status=failed&bookingId=123&amount=999999&tranId=forged-transaction');
  await expect(page.getByRole('heading', { name: 'Payment Confirmed', exact: true })).toBeVisible();
  await expect(page.locator('dl')).toContainText('backend-transaction');
  await expect(page.locator('dl')).toContainText('BDT 1,000');
  await expect(page.locator('main')).not.toContainText('forged-transaction');
  await expect(page.locator('main')).not.toContainText('999999');
  await expect(page.locator('main')).toContainText('does not confirm an artisan payout');
});

test('F1: backend outage remains unconfirmed and an explicit status retry can recover', async ({ page }) => {
  const calls = await fixture(page, [
    { status: 503, body: {} },
    { status: 200, body: { ...payment, status: 'Completed', paidAt: '2026-10-07T00:00:00Z' } },
  ]);
  await page.goto('/e2e/fixtures/payment.html?status=success&bookingId=123');
  await expect(page.getByRole('heading', { name: 'Payment Not Confirmed', exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('No charges');
  await page.getByRole('button', { name: 'Check Status Again' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Confirmed', exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
});

test('F1: denied summary cannot be replaced by URL success', async ({ page }) => {
  await fixture(page, [{ status: 403, body: {} }]);
  await page.goto('/e2e/fixtures/payment.html?status=success&bookingId=123');
  await expect(page.getByRole('heading', { name: 'Payment Not Confirmed', exact: true })).toBeVisible();
  await expect(page.locator('dl')).toHaveCount(0);
});

test('F1: signed-out return asks for sign-in and does not fetch payment details', async ({ page }) => {
  const calls = await fixture(page, [{ status: 200, body: payment }], true);
  await page.goto('/e2e/fixtures/payment.html?status=success&bookingId=123');
  await expect(page.getByRole('heading', { name: 'Payment Not Confirmed', exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  expect(calls).toHaveLength(0);
});
