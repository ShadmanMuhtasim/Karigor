import { test, expect } from '@playwright/test';

const imagePayload = '<img src="/__security_missing_image__" onerror="window.__karigorXss = true">';
const svgPayload = '<svg onload="window.__karigorXss = true"></svg>';

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

test('GREEN REGRESSION F4: stored map text cannot execute HTML', async ({ page }) => {
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
  expect(executed, 'User-controlled request text must not execute in the browser').toBe(false);
  await expect(page.locator('.leaflet-popup-content')).toContainText('<img src="/__security_missing_image__" onerror="window.__karigorXss = true">');
  await expect(page.locator('.leaflet-popup-content img')).toHaveCount(0);
});

for (const [field, payloadKind] of [['address', 'image'], ['category', 'image'], ['category', 'svg']]) {
  test(`F4: request ${field} ${payloadKind} markup remains literal`, async ({ page }) => {
    const payload = payloadKind === 'svg' ? svgPayload : imagePayload;
    await page.goto(`/e2e/fixtures/map.html?scenario=malicious&field=${field}&payload=${payloadKind}`);
    if (field === 'category') {
      await expect(page.locator('.custom-marker-req-123')).toContainText(payload);
      await expect(page.locator('.custom-marker-req-123 [onload], .custom-marker-req-123 img')).toHaveCount(0);
    }
    await page.locator('.custom-marker-req-123').click();
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toContainText(payload);
    await expect(popup.locator('[onload], img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
    await popup.locator('#quote-btn-123').click();
    await expect(page.getByTestId('quoted-request')).toHaveText('123');
  });
}

for (const [field, payloadKind] of [['email', 'image'], ['skill', 'svg']]) {
  test(`F4: worker ${field} markup remains literal and profile actions work`, async ({ page }) => {
    await page.goto(`/e2e/fixtures/map.html?scenario=worker&field=${field}&payload=${payloadKind}`);
    await page.locator('.custom-marker-worker-456').click();
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toContainText(payloadKind === 'svg' ? svgPayload : imagePayload);
    await expect(popup.locator('[onload], img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
    await expect(page.getByTestId('worker-count')).toHaveText('1');
    await popup.locator('#view-worker-456').click();
    await expect(page.getByTestId('worker-count')).toHaveText('2');
  });
}

test('F4: Bengali quotes ampersands and angle brackets are preserved', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?scenario=text');
  await page.locator('.custom-marker-req-123').click();
  const text = 'বাংলা "কাজ" & <পাইপ> \'মেরামত\' > ঠিক';
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.locator('p')).toHaveText(text);
  await expect(popup.locator('div.text-gray-400 span')).toHaveText(text);
  expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
});

test('F4: translated worker marker label remains literal', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?scenario=worker-label');
  await expect(page.locator('.custom-marker-worker-456')).toContainText(imagePayload);
  await expect(page.locator('.custom-marker-worker-456 img')).toHaveCount(0);
  await page.locator('.custom-marker-worker-456').click();
  await expect(page.locator('.leaflet-popup-content')).toContainText(imagePayload);
  expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
});

test('F4: user and worker-base location popup translations remain literal', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?scenario=locations');
  for (const marker of ['.custom-user-marker', '.custom-worker-base-marker']) {
    await page.locator(marker).click();
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toContainText(imagePayload);
    await expect(popup.locator('img')).toHaveCount(0);
    // Close the first real Leaflet popup before selecting the other location marker.
    await page.locator('.leaflet-popup-close-button').click();
    await expect(popup).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
});

test('F4: picker text remains literal and map selection works', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?scenario=picker');
  await expect(page.locator('.custom-draggable-picker-pin')).toContainText(imagePayload);
  await page.locator('.custom-draggable-picker-pin').click();
  await expect(page.locator('.leaflet-popup-content')).toContainText(imagePayload);
  await expect(page.locator('.custom-draggable-picker-pin img, .leaflet-popup-content img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__karigorXss)).toBe(false);
  await page.locator('.leaflet-container').click({ position: { x: 30, y: 400 } });
  await expect(page.getByTestId('coordinates')).not.toHaveText('none');
});

test('F4: redraw and remount do not accumulate quotation handlers', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html');
  for (let i = 1; i <= 3; i++) {
    await page.locator('.custom-marker-req-123').click();
    await page.locator('#quote-btn-123').click();
    await expect(page.getByTestId('quote-count')).toHaveText(String(i));
    await page.getByRole('button', { name: 'Redraw Markers', exact: true }).click();
    await expect(page.getByTestId('marker-version')).toHaveText(String(i));
  }
  await page.getByRole('button', { name: 'Toggle Map', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle Map', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
  await page.locator('.custom-marker-req-123').click();
  await page.locator('#quote-btn-123').click();
  await expect(page.getByTestId('quote-count')).toHaveText('4');
});

test('F4: quotation button preserves request-selection fallback', async ({ page }) => {
  await page.goto('/e2e/fixtures/map.html?fallback=1');
  await page.locator('.custom-marker-req-123').click();
  await expect(page.getByTestId('request-count')).toHaveText('1');
  await page.locator('#quote-btn-123').click();
  await expect(page.getByTestId('request-count')).toHaveText('2');
  await expect(page.getByTestId('quote-count')).toHaveText('0');
});
