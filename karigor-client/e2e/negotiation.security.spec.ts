import { test, expect, type Page } from '@playwright/test';

const conflict = 'This negotiation changed. The latest offers have been refreshed. Review them before trying again.';

async function fixture(page: Page, role: 'Customer' | 'Worker' = 'Customer', dashboard = false, unknown = false) {
  let changed = false;
  let mutationCount = 0;
  let quotationReads = 0;
  let workerReads = 0;
  const actions: Array<{ path: string; body: Record<string, unknown> }> = [];
  const request = { id: 123, customerId: 7, categoryName: 'Plumber', customerName: 'Fixture customer',
    description: 'Repair tap', address: 'Fixture address', preferredDate: '2026-11-01T10:00:00Z', status: 'Open' };
  const author = role === 'Worker' ? 'Customer' : 'Worker';
  const quote = (id: number, price: number, status = 'Pending') => ({
    id, serviceRequestId: 123, workerId: 11, workerName: 'Fixture worker', averageRating: 0,
    proposedPrice: price, status, proposedBy: unknown ? 'Unknown' : author,
    proposedByUserId: unknown ? null : role === 'Worker' ? 'customer' : 'worker',
    version: id === 1 ? 'AAAAAAAAAAE=' : 'AAAAAAAAAAI=', message: 'Submitted terms',
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5179') return route.abort();
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      userId: role.toLowerCase(), role, email: 'fixture@security.invalid', accessToken: 'fixture-token',
      accessTokenExpiry: new Date(Date.now() + 3600000).toISOString(),
    } });
    if (url.pathname === '/api/quotations/request/123/details') return route.fulfill({ json: request });
    if (url.pathname === '/api/quotations/request/123') {
      quotationReads++;
      return route.fulfill({ json: changed ? [quote(1, role === 'Worker' ? 800 : 1000, 'Countered'), quote(2, 900)] : [quote(1, role === 'Worker' ? 800 : 1000)] });
    }
    if (url.pathname === '/api/quotations/worker') {
      workerReads++;
      return route.fulfill({ json: changed ? [{ quotationId: 2, serviceRequestId: 123, categoryName: 'Plumber', customerName: 'Fixture customer',
        address: 'Fixture address', requestStatus: 'Open', myInitialPrice: 1000, latestPrice: 800, latestStatus: 'Pending',
        latestProposedBy: 'Customer', latestProposedByUserId: 'customer', version: 'AAAAAAAAAAI=', negotiationStepsCount: 2, preferredDate: request.preferredDate }] : [] });
    }
    if (url.pathname === '/api/quotations' || /\/api\/quotations\/\d+\/(accept|counter)$/.test(url.pathname)) {
      actions.push({ path: url.pathname, body: route.request().postDataJSON() });
      mutationCount++;
      if (mutationCount === 1) {
        changed = true;
        return route.fulfill({ status: 409, json: { code: 'negotiation_conflict', error: 'Refresh current offer.' } });
      }
      return route.fulfill({ json: { id: 55, agreedPrice: 900 } });
    }
    if (url.pathname === '/api/quotations/available-requests') return route.fulfill({ json: [request] });
    if (url.pathname === '/api/worker/profile') return route.fulfill({ json: { id: 11, serviceRadiusKm: 10, skills: [] } });
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/')) return route.fulfill({ json: [] });
    return route.continue();
  });
  await page.goto('/e2e/fixtures/negotiation.html' + (dashboard ? '?view=dashboard' : ''));
  return { actions, reads: () => quotationReads, workerReads: () => workerReads };
}

for (const role of ['Customer', 'Worker'] as const) {
  test(`F5: ${role} acceptance conflict refreshes and retry uses the new displayed version`, async ({ page }) => {
    const calls = await fixture(page, role);
    const button = page.getByRole('button', { name: role === 'Worker' ? /Accept Counter/ : /Accept Offer/ });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('alert')).toHaveText(conflict);
    await expect(button).toContainText('900');
    await expect.poll(calls.reads).toBeGreaterThan(1);
    expect(calls.actions[0].body.expectedVersion).toBe('AAAAAAAAAAE=');
    await button.click();
    await expect(page.getByText('Agreement booking opened')).toBeVisible();
    expect(calls.actions[1]).toEqual({ path: '/api/quotations/2/accept', body: { expectedVersion: 'AAAAAAAAAAI=' } });
  });

  test(`F5: ${role} counter conflict discards stale form and displays authoritative offer`, async ({ page }) => {
    const calls = await fixture(page, role);
    await page.getByRole('button', { name: role === 'Worker' ? 'Counter Back' : 'Counter-Offer', exact: true }).click();
    await page.getByPlaceholder('e.g. 1200').fill('700');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(conflict);
    await expect(page.getByPlaceholder('e.g. 1200')).toHaveCount(0);
    await expect(page.getByRole('button', { name: role === 'Worker' ? /Accept Counter/ : /Accept Offer/ })).toContainText('900');
    expect(calls.actions[0].body).toMatchObject({ expectedVersion: 'AAAAAAAAAAE=', proposedPrice: 700 });
  });
}

test('F5: worker dashboard initial conflict visibly refreshes current negotiation summaries', async ({ page }) => {
  const calls = await fixture(page, 'Worker', true);
  await page.getByRole('button', { name: 'List View', exact: true }).click();
  await page.getByRole('button', { name: 'Send quote', exact: true }).click();
  await page.getByRole('spinbutton').fill('5000');
  await page.getByRole('button', { name: 'Submit quotation', exact: true }).click();
  await expect(page.getByText(conflict)).toBeVisible();
  await expect(page.getByText('Latest: ৳800')).toBeVisible();
  await expect.poll(calls.workerReads).toBeGreaterThan(1);
});

test('F5: unknown legacy author exposes no acceptance or counter action', async ({ page }) => {
  await fixture(page, 'Customer', false, true);
  await expect(page.getByText('Submitted terms')).toBeVisible();
  await expect(page.getByRole('button', { name: /Accept Offer|Counter-Offer/ })).toHaveCount(0);
});
