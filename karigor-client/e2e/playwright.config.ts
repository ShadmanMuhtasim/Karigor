import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.security.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: resolve(import.meta.dirname, '../test-results/security-browser/results.json') }]],
  outputDir: resolve(import.meta.dirname, '../test-results/security-browser/artifacts'),
  use: {
    baseURL: 'http://127.0.0.1:5179',
    browserName: 'chromium',
    channel: process.env.KARIGOR_TEST_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:security',
    url: 'http://127.0.0.1:5179/e2e/fixtures/map.html',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
