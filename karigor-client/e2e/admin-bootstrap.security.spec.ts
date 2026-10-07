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

test('F2: legitimate LoginPage sends the guarded cookie-auth contract and signs in', async ({ page, context }) => {
  const mutations: string[] = [];
  let restored = false;
  let authorizedRead = false;
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:5179') return route.abort();
    if (url.pathname === '/api/auth/config') return route.fulfill({ json: { googleClientId: '' } });
    if (url.pathname === '/api/auth/refresh') {
      restored = true;
      return route.fulfill({ status: 401, json: {} });
    }
    if (url.pathname === '/api/auth/logout' || url.pathname === '/api/auth/login') {
      expect(request.method()).toBe('POST');
      expect(request.headers().origin).toBe('http://127.0.0.1:5179');
      expect(request.headers()['x-karigor-csrf']).toBe('1');
      mutations.push(url.pathname);
      if (url.pathname === '/api/auth/logout') return route.fulfill({ json: { message: 'Logged out successfully.' } });
      expect(request.postDataJSON()).toEqual({ email: 'operator@security.invalid', password: 'FixtureOnly123!' });
      return route.fulfill({ headers: { 'set-cookie': 'karigor_rt=fixture-refresh; Path=/; HttpOnly; SameSite=Lax' }, json: {
        userId: 'fixture-admin', email: 'operator@security.invalid', role: 'Admin', sessionId: 'fixture-session',
        accessToken: 'fixture-access', accessTokenExpiry: new Date(Date.now() + 15 * 60_000).toISOString(),
      } });
    }
    if (url.pathname.startsWith('/api/notifications')) {
      expect(request.headers().authorization).toBe('Bearer fixture-access');
      authorizedRead = true;
      return route.fulfill({ json: [] });
    }
    if (url.pathname.startsWith('/hubs/')) return route.fulfill({ status: 401, json: {} });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
    return route.continue();
  });
  await page.goto('/e2e/fixtures/payment.html?page=login');
  await expect.poll(() => restored).toBe(true);
  await page.locator('#login-email').fill('operator@security.invalid');
  await page.locator('#login-password').fill('FixtureOnly123!');
  await page.locator('#login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(mutations).toEqual(['/api/auth/logout', '/api/auth/login']);
  await expect.poll(() => authorizedRead).toBe(true);
  const cookie = (await context.cookies()).find(c => c.name === 'karigor_rt')!;
  expect(cookie.value).toBe('fixture-refresh');
  expect(cookie.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('karigor_rt');
});
