import { test, expect, type Page } from '@playwright/test';

async function booking(page: Page, status: number, body: unknown) {
  const commands: unknown[] = [];
  const external: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5179') { external.push(url.origin); return route.abort(); }
    if (url.pathname === '/e2e/fixtures/bookings/123') return route.fulfill({
      response: await route.fetch({ url: 'http://127.0.0.1:5179/e2e/fixtures/payment.html' }),
    });
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      userId: 'fixture-customer', email: 'fixture@security.invalid', role: 'Customer',
      accessToken: 'fixture-access-token', accessTokenExpiry: '2099-01-01T00:00:00Z',
    } });
    if (url.pathname === '/api/bookings/123') return route.fulfill({ json: {
      id: 123, workerName: 'Fixture worker', customerName: 'Fixture customer', categoryName: 'Plumbing',
      agreedPrice: 1000, scheduledDate: '2026-10-07T00:00:00Z', status: 'Completed', paymentStatus: 'Unpaid',
    } });
    if (url.pathname === '/api/payments/initiate') {
      expect(route.request().headers().authorization).toBe('Bearer fixture-access-token');
      commands.push(route.request().postDataJSON()); return route.fulfill({ status, json: body });
    }
    if (url.pathname === '/api/notifications' || url.pathname.startsWith('/api/messages/')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
    return route.continue();
  });
  await page.goto('/e2e/fixtures/bookings/123?page=booking');
  return { commands, external };
}

test('F1 initiation: unresolved outcome stays visible and repeated command uses the same booking intent', async ({ page }) => {
  const { commands, external } = await booking(page, 202, { initiationState: 'Unknown', transactionId: 'same-intent',
    gatewayUrl: 'https://fixture.invalid/unusable', message: 'Payment initiation is unresolved. Check this booking before paying again; retrying reuses this intent.' });
  const pay = page.getByRole('button', { name: /Now via SSLCommerz/ });
  await pay.click();
  await expect(page.getByText('Payment initiation is unresolved.', { exact: false })).toBeVisible();
  await expect(pay).toBeEnabled(); await pay.click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands).toEqual([{ bookingId: 123 }, { bookingId: 123 }]); expect(external).toEqual([]);
  await expect(page).toHaveURL(/bookings\/123/);
});

for (const status of [409, 503]) {
  test(`F1 initiation: ${status} response displays authoritative conflict or unresolved guidance`, async ({ page }) => {
    const message = status === 409 ? 'Payment state changed. Refresh the authoritative payment status before retrying.'
      : 'Payment initiation is unresolved. Check booking payment status before retrying.';
    const { commands, external } = await booking(page, status, { message });
    await page.getByRole('button', { name: /Now via SSLCommerz/ }).click();
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    expect(commands).toEqual([{ bookingId: 123 }]); expect(external).toEqual([]);
  });
}
