import { test, expect } from '@playwright/test';

// No third-party tiles/provider requests are allowed from these fixtures.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:5179') await route.continue();
    else await route.abort();
  });
});

test('GREEN BASELINE: plain request popup and quote callback work', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html');
  await page.locator('.custom-marker-req-123').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('Repair fixture tap');
  await popup.locator('#quote-btn-123').click();
  await expect(page.getByTestId('quoted-request')).toHaveText('123');
});

test('EXPECTED-FAIL REGRESSION F4: stored map text cannot execute HTML', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?scenario=malicious');
  await page.locator('.custom-marker-req-123').click();
  await expect(page.locator('.leaflet-popup-content')).toBeVisible();
  // Wait for the harmless probe image's completion, not an arbitrary sleep.
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('.leaflet-popup-content img');
    return !image || image.complete;
  });
  const executed = await page.evaluate(() => window.__karigorXss);
  expect(typeof executed, 'The isolated fixture must initialize its harmless execution probe').toBe('boolean');
  // Annotate only after navigation/mount/action complete: setup errors remain blocking.
  test.fail(true, 'F4_MAP_XSS: known unsafe dynamic HTML; remove annotation after remediation.');
  expect(executed, 'User-controlled request text must not execute in the browser').toBe(false);
});
