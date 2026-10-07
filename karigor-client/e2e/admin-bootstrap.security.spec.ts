import { test, expect } from '@playwright/test';

test('F2: login page offers no default administrator demo credentials', async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5179') return route.abort();
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ status: 401, json: {} });
    if (url.pathname === '/api/auth/config') return route.fulfill({ json: { googleClientId: '' } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
    return route.continue();
  });
  await page.goto('/e2e/fixtures/payment.html?page=login');
  await expect(page.getByRole('button', { name: 'Customer Demo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Worker Demo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin Demo', exact: true })).toHaveCount(0);
});
