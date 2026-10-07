import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.7\nfixture document\n%%EOF');
const filePath = '/uploads/worker-documents/11/1234567890abcdef1234567890abcdef';

declare global {
  interface Window { documentUrls: { created: string[]; revoked: string[] } }
}

async function fixture(page: Page, options: { admin?: boolean; pdf?: boolean; denied?: boolean; refresh?: boolean; late?: Promise<void>; unsafe?: boolean } = {}) {
  const requests: Array<{ path: string; authorization: string }> = [];
  const uploads: number[] = [];
  let completedDocuments = 0;
  let account = 'first-account';
  let refreshes = 0;
  await page.addInitScript(() => {
    window.documentUrls = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); window.documentUrls.created.push(url); return url; };
    URL.revokeObjectURL = url => { window.documentUrls.revoked.push(url); revoke(url); };
  });
  const user = () => ({ userId: account, email: 'fixture@security.invalid', role: options.admin ? 'Admin' : 'Worker',
    accessToken: refreshes > 1 ? 'refreshed-token' : 'fixture-token',
    accessTokenExpiry: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  const doc = { id: 1, documentType: 'NationalId', status: 'Pending',
    fileUrl: options.unsafe ? 'https://untrusted.invalid/private.pdf' : filePath + (options.pdf ? '.pdf' : '.png') };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5179') return route.abort();
    if (url.pathname === '/api/auth/refresh') { refreshes++; return route.fulfill({ json: user() }); }
    if (url.pathname === '/api/auth/login') { account = 'next-account'; return route.fulfill({ json: user() }); }
    if (url.pathname === '/api/auth/logout') return route.fulfill({ json: {} });
    if (url.pathname === '/api/worker/documents') {
      if (route.request().method() === 'POST') {
        uploads.push(route.request().postDataBuffer()?.length || 0);
        return route.fulfill({ status: 201, json: doc });
      }
      return route.fulfill({ json: account === 'first-account' ? [doc] : [] });
    }
    if (url.pathname === '/api/admin/workers/pending') return route.fulfill({ json: account === 'first-account' ? [{
      workerId: 11, userId: 'worker-fixture', email: 'worker@security.invalid', verificationStatus: 'Pending',
      hourlyRate: 100, averageRating: 0, serviceRadiusKm: 10, skills: [], documents: [doc],
    }] : [] });
    if (url.pathname.startsWith('/uploads/worker-documents/')) {
      requests.push({ path: url.pathname + url.search, authorization: route.request().headers().authorization || '' });
      if (options.refresh && requests.length === 1) return route.fulfill({ status: 401, json: {} });
      if (options.late) await options.late;
      try { return await route.fulfill({ status: options.denied ? 404 : 200,
        contentType: options.pdf ? 'application/pdf' : 'image/png', body: options.denied ? Buffer.from('') : options.pdf ? pdf : png }); }
      catch { /* The real Axios request may already have been canceled by close/unmount. */ }
      finally { completedDocuments++; }
      return;
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/')) return route.fulfill({ status: 404, json: {} });
    return route.continue();
  });
  await page.goto('/e2e/fixtures/documents.html');
  await expect(page.getByTestId('account')).toHaveText('first-account');
  return { requests, uploads, completedDocuments: () => completedDocuments };
}

async function open(page: Page, admin = false) {
  await page.getByRole('button', { name: admin ? 'Inspect' : 'View File', exact: true }).click();
}

test('F7: worker image retrieval and byte-exact download use Bearer bytes and release object URLs on close', async ({ page }) => {
  const calls = await fixture(page);
  await open(page);
  const image = page.getByRole('img', { name: 'NationalId' });
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  expect(calls.requests).toEqual([{ path: filePath + '.png', authorization: 'Bearer fixture-token' }]);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download document' }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!)).toEqual(png);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.documentUrls.revoked.length)).toBe(1);
  expect(await page.evaluate(() => window.documentUrls.revoked)).toEqual(await page.evaluate(() => window.documentUrls.created));
  await expect(image).toHaveCount(0);
});

test('F7: admin preview uses authenticated image bytes', async ({ page }) => {
  const calls = await fixture(page, { admin: true });
  await open(page, true);
  await expect(page.getByRole('img', { name: 'NationalId' })).toHaveAttribute('src', /^blob:/);
  expect(calls.requests[0].authorization).toBe('Bearer fixture-token');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.documentUrls.revoked.length)).toBe(1);
});

test('F7: PDF uses an authenticated download fallback with exact bytes', async ({ page }) => {
  const calls = await fixture(page, { admin: true, pdf: true });
  await open(page, true);
  await expect(page.getByText('PDF ready. Download it to view safely.')).toBeVisible();
  await expect(page.locator('iframe, object, embed')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download document' }).click();
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(pdf);
  expect(calls.requests[0].authorization).toBe('Bearer fixture-token');
});

test('F7: denied retrieval renders an error without creating a document object URL', async ({ page }) => {
  await fixture(page, { denied: true });
  await open(page);
  await expect(page.getByRole('alert')).toContainText('Unable to retrieve');
  await expect(page.getByRole('link', { name: 'Download document' })).toHaveCount(0);
  expect(await page.evaluate(() => window.documentUrls.created)).toEqual([]);
});

test('F7: expired access uses the existing refresh interceptor and retries with the new Bearer token', async ({ page }) => {
  const calls = await fixture(page, { refresh: true });
  await open(page);
  await expect(page.getByRole('img', { name: 'NationalId' })).toHaveAttribute('src', /^blob:/);
  expect(calls.requests.map(r => r.authorization)).toEqual(['Bearer fixture-token', 'Bearer refreshed-token']);
  expect(calls.requests.every(r => !r.path.includes('?'))).toBe(true);
});

test('F7: closing while retrieval is pending ignores late bytes', async ({ page }) => {
  let release!: () => void;
  const late = new Promise<void>(resolve => { release = resolve; });
  const calls = await fixture(page, { late });
  const requested = page.waitForRequest(r => r.url().includes('/uploads/worker-documents/'));
  await open(page);
  await requested;
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  release();
  await expect.poll(calls.completedDocuments).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.documentUrls.created)).toEqual([]);
});

test('F7: changing accounts clears the preview and revokes previous-account bytes', async ({ page }) => {
  await fixture(page);
  await open(page);
  await expect(page.getByRole('img', { name: 'NationalId' })).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(page.getByTestId('account')).toHaveText('next-account');
  await expect(page.getByRole('img', { name: 'NationalId' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View File', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.documentUrls.revoked.length)).toBe(1);
});

test('F7: an account switch during retrieval cannot display a late previous-user response', async ({ page }) => {
  let release!: () => void;
  const late = new Promise<void>(resolve => { release = resolve; });
  const calls = await fixture(page, { late });
  const requested = page.waitForRequest(r => r.url().includes('/uploads/worker-documents/'));
  await open(page);
  await requested;
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(page.getByTestId('account')).toHaveText('next-account');
  release();
  await expect.poll(calls.completedDocuments).toBe(1);
  await expect(page.getByRole('img', { name: 'NationalId' })).toHaveCount(0);
  expect(await page.evaluate(() => window.documentUrls.created)).toEqual([]);
});

test('F7: unmount and sign-out revoke object URLs', async ({ page }) => {
  await fixture(page);
  await open(page);
  await expect(page.getByRole('link', { name: 'Download document' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle documents' }).click();
  await expect.poll(() => page.evaluate(() => window.documentUrls.revoked.length)).toBe(1);
  await page.getByRole('button', { name: 'Toggle documents' }).click();
  await open(page);
  await expect(page.getByRole('link', { name: 'Download document' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByTestId('account')).toHaveText('guest');
  await expect.poll(() => page.evaluate(() => window.documentUrls.revoked.length)).toBe(2);
  await expect(page.getByRole('link', { name: 'Download document' })).toHaveCount(0);
});

test('F7: private document paths reject an arbitrary origin before authenticated retrieval', async ({ page }) => {
  const calls = await fixture(page, { unsafe: true });
  await open(page);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(calls.requests).toEqual([]);
  expect(await page.evaluate(() => window.documentUrls.created)).toEqual([]);
});

test('F7: client upload uses the same 5 MiB boundary as the backend', async ({ page }) => {
  const calls = await fixture(page);
  await expect(page.getByText('File (PDF/JPG/PNG, max 5 MiB)', { exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText('File exceeds the 5 MiB limit.', { exact: true })).toBeVisible();
  expect(calls.uploads).toEqual([]);
  await page.locator('input[type=file]').setInputFiles({ name: 'boundary.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024) });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText('Document uploaded successfully!', { exact: true })).toBeVisible();
  expect(calls.uploads).toHaveLength(1);
  expect(calls.uploads[0]).toBeGreaterThan(5 * 1024 * 1024);
  expect(calls.uploads[0]).toBeLessThanOrEqual(5 * 1024 * 1024 + 64 * 1024);
});
