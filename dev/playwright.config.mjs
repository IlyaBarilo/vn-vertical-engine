import { defineConfig } from '@playwright/test';

// Настраивает изолированный Chromium-контур с перехватом HTTP и диагностикой только при сбоях.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  outputDir: '.playwright/test-results',
  timeout: 20_000,
  expect: {
    timeout: 7_000
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: '.playwright/report' }]]
    : [['line']],
  use: {
    baseURL: 'http://e2e.local',
    headless: true,
    viewport: { width: 412, height: 915 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  }
});
