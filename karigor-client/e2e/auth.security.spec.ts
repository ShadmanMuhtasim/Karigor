import { test, expect, type BrowserContext, type Route } from '@playwright/test';

// Browser cookie/ordering fixture, not a second backend implementation proof.
// The SQL/HTTP suite separately exercises actual rotation and response headers.
async function setup(context: BrowserContext) {
  let current = 'token-0';
  let sequence = 0;
  let revoked = false;
  const presented: string[] = [];
  const paths: string[] = [];
  let pause: (() => Promise<void>) | undefined;
  let protectedPause: (() => Promise<void>) | undefined;
  let fail = false;
  let conflict = false;
  const cookie = (value: string) => `karigor_rt=${value}; Path=/; HttpOnly; SameSite=Lax`;
  const result = () => ({ userId: 'fixture-user', email: 'fixture@security.invalid', role: 'Customer',
    accessToken: `access-${sequence}`, accessTokenExpiry: new Date(Date.now() + 15 * 60_000).toISOString() });
  await context.addCookies([{ name: 'karigor_rt', value: current, url: 'http://127.0.0.1:5179', httpOnly: true, sameSite: 'Lax' }]);
  await context.route('**/api/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    paths.push(path);
    if (path === '/api/fixture/protected') {
      if (protectedPause) await protectedPause();
      return route.fulfill({ status: 401, json: {} });
    }
    expect(route.request().headers()['x-karigor-csrf']).toBe('1');
    expect(route.request().headers().origin).toBe('http://127.0.0.1:5179');
    if (path === '/api/auth/logout') {
      revoked = true;
      return route.fulfill({ headers: { 'set-cookie': cookie('') + '; Max-Age=0' }, json: { message: 'Logged out successfully.' } });
    }
    if (path === '/api/auth/login') {
      revoked = false;
      current = `token-${++sequence}`;
      return route.fulfill({ headers: { 'set-cookie': cookie(current) }, json: result() });
    }
    const raw = /karigor_rt=([^;]+)/.exec(route.request().headers().cookie || '')?.[1] || '';
    presented.push(raw);
    if (pause) await pause();
    if (conflict) return route.fulfill({ status: 409, json: {} });
    if (revoked || raw !== current) { revoked = true; return route.fulfill({ status: 401, json: {} }); }
    current = `token-${++sequence}`;
    if (fail) return route.abort('failed'); // Server commit, entire successful response lost.
    return route.fulfill({ headers: { 'set-cookie': cookie(current) }, json: result() });
  });
  const a = await context.newPage(); const b = await context.newPage();
  await Promise.all([a.goto('/e2e/fixtures/auth.html'), b.goto('/e2e/fixtures/auth.html')]);
  await Promise.all([a.waitForFunction(() => !!window.authFixture), b.waitForFunction(() => !!window.authFixture)]);
  return { a, b, presented, paths, pause: (value: () => Promise<void>) => { pause = value; },
    pauseProtected: (value: () => Promise<void>) => { protectedPause = value; },
    loseResponse: () => { fail = true; }, conflict: () => { conflict = true; }, revoked: () => revoked };
}

test('F6: two tabs serialize cookie rotation while each tab keeps one refresh flight', async ({ context }) => {
  const s = await setup(context);
  const results = await Promise.all([
    s.a.evaluate(() => Promise.all([window.authFixture.refresh(), window.authFixture.refresh()])),
    s.b.evaluate(() => Promise.all([window.authFixture.refresh(), window.authFixture.refresh()])),
  ]);
  expect(results).toEqual([['ok', 'ok'], ['ok', 'ok']]);
  expect(s.presented).toEqual(['token-0', 'token-1']);
  const cookie = (await context.cookies()).find(c => c.name === 'karigor_rt')!;
  expect(cookie.value).toBe('token-2'); expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Lax');
  expect(await s.a.evaluate(() => document.cookie)).not.toContain('karigor_rt');
  for (const page of [s.a, s.b]) {
    const values = await page.evaluate(() => Object.values(localStorage).join(' '));
    expect(values).not.toMatch(/access-|token-/);
  }
});

test('F6: delayed refresh cannot restore state or cookie after another tab logs out', async ({ context }) => {
  const s = await setup(context);
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; }); s.pause(() => gate);
  const refresh = s.a.evaluate(() => window.authFixture.refresh());
  await expect.poll(() => s.presented.length).toBe(1);
  const logout = s.b.evaluate(() => window.authFixture.logout());
  await expect(s.a.locator('#state')).toHaveText('signed out');
  expect(s.paths).toEqual(['/api/auth/refresh']); // Logout cannot send until cookie response is processed.
  release();
  expect(await refresh).toBe('failed'); expect(await logout).toBe('ok');
  expect(s.paths).toEqual(['/api/auth/refresh', '/api/auth/logout']);
  expect((await context.cookies()).find(c => c.name === 'karigor_rt')).toBeUndefined();
  expect(await s.a.evaluate(() => window.authFixture.token())).toBeNull(); expect(s.revoked()).toBe(true);
  expect(await s.a.evaluate(() => window.authFixture.refresh())).toBe('failed');
  expect(s.presented).toHaveLength(1);
});

test('F6: account switch waits for old refresh, revokes it, and ignores its late result', async ({ context }) => {
  const s = await setup(context);
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); s.pause(() => gate);
  const refresh = s.a.evaluate(() => window.authFixture.refresh());
  await expect.poll(() => s.presented.length).toBe(1);
  const login = s.b.evaluate(() => window.authFixture.login('other@security.invalid'));
  await expect(s.a.locator('#state')).toHaveText('signed out'); release();
  expect(await refresh).toBe('failed'); expect(await login).toBe('ok');
  expect(s.paths).toEqual(['/api/auth/refresh', '/api/auth/logout', '/api/auth/login']);
  expect(await s.a.evaluate(() => window.authFixture.token())).toBeNull();
  expect(await s.b.evaluate(() => window.authFixture.token())).toBe('access-2');
  expect((await context.cookies()).find(c => c.name === 'karigor_rt')?.value).toBe('token-2');
});

test('F6: a protected request from the old account is never replayed under the new account', async ({ context }) => {
  const s = await setup(context);
  await s.a.evaluate(() => window.authFixture.refresh());
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); s.pauseProtected(() => gate);
  const oldRequest = s.a.evaluate(() => window.authFixture.protectedRequest());
  await expect.poll(() => s.paths.includes('/api/fixture/protected')).toBe(true);
  expect(await s.b.evaluate(() => window.authFixture.login('other@security.invalid'))).toBe('ok');
  release(); expect(await oldRequest).toBe('failed');
  expect(s.paths.filter(p => p === '/api/fixture/protected')).toHaveLength(1);
  expect(s.presented).toHaveLength(1);
});

test('F6: lost successful response forces reauthentication without retrying the consumed cookie', async ({ context }) => {
  const s = await setup(context); s.loseResponse();
  expect(await s.a.evaluate(() => window.authFixture.refresh())).toBe('failed');
  await expect(s.b.locator('#state')).toHaveText('signed out');
  expect(await s.b.evaluate(() => window.authFixture.refresh())).toBe('failed');
  expect(s.presented).toEqual(['token-0']);
  expect(await s.a.evaluate(() => window.authFixture.token())).toBeNull();
});

test('F6: conflict response does not overwrite the cookie or start a replay loop', async ({ context }) => {
  const s = await setup(context); s.conflict();
  expect(await s.a.evaluate(() => window.authFixture.refresh())).toBe('failed');
  expect((await context.cookies()).find(c => c.name === 'karigor_rt')?.value).toBe('token-0');
  expect(await s.a.evaluate(() => window.authFixture.refresh())).toBe('failed');
  expect(s.presented).toHaveLength(1);
});

test('F6: missing cross-tab lock support fails before a cookie mutation', async ({ context }) => {
  const s = await setup(context);
  await s.a.evaluate(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  expect(await s.a.evaluate(() => window.authFixture.refresh())).toBe('failed');
  expect(s.paths).toHaveLength(0);
});

test('F6: AuthProvider cannot restore a delayed initial session after another tab logs out', async ({ context }) => {
  const s = await setup(context);
  await context.route('**/hubs/**', route => route.fulfill({ status: 401, json: {} }));
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); s.pause(() => gate);
  await s.a.goto('/e2e/fixtures/auth-provider.html');
  await expect.poll(() => s.presented.length).toBe(1);
  const logout = s.b.evaluate(() => window.authFixture.logout());
  await expect.poll(() => s.a.evaluate(() => JSON.parse(localStorage.getItem('karigor.auth.generation')!).signedOut)).toBe(true);
  release(); expect(await logout).toBe('ok');
  await expect(s.a.getByTestId('account')).toHaveText('Guest');
  expect((await context.cookies()).find(c => c.name === 'karigor_rt')).toBeUndefined();
});

test('F6: AuthProvider reports unconfirmed server logout and offers a guarded retry', async ({ context }) => {
  const s = await setup(context);
  await context.route('**/hubs/**', route => route.fulfill({ status: 401, json: {} }));
  await s.a.goto('/e2e/fixtures/auth-provider.html');
  await expect(s.a.getByTestId('account')).toHaveText('fixture-user');
  await context.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: {} }));
  await s.a.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(s.a.getByTestId('account')).toHaveText('Guest');
  await expect(s.a.getByRole('alert')).toContainText('Sign-out could not be confirmed');
  await context.unroute('**/api/auth/logout');
  await s.a.getByRole('button', { name: 'Retry sign-out', exact: true }).click();
  await expect(s.a.getByRole('alert')).toHaveCount(0);
  expect(s.revoked()).toBe(true);
});
