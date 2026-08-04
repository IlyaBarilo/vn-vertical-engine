import { defineConfig } from '@playwright/test';

// Настраивает одинаковый изолированный E2E-контур для Chromium и Firefox с диагностикой только при сбоях.
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
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' }
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:41739',
    headless: true,
    viewport: { width: 412, height: 915 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  }
});
