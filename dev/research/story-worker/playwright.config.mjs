import { defineConfig } from '@playwright/test';

// Исследование запускается вручную вне CI и использует обычные настройки безопасности браузеров.
export default defineConfig({
  testDir: '.',
  testMatch: 'probe.spec.mjs',
  outputDir: '../../.playwright/story-worker-research/test-results',
  timeout: 60000,
  workers: 1,
  reporter: [['line']],
  use: { headless: true, launchOptions: { timeout: 30000 } },
  projects: [
    { name: 'chrome-installed', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'chromium-bundled', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox-installed', use: {
      browserName: 'firefox', channel: 'moz-firefox',
      // Отдельный процесс не передаёт запуск уже открытому пользовательскому Firefox.
      launchOptions: { timeout: 30000, args: ['--no-remote'], firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': true } }
    } },
    ...(process.env.VN_RESEARCH_CHROME_EXECUTABLE ? [{
      name: 'chrome-testing',
      use: { browserName: 'chromium', launchOptions: { timeout: 30000, executablePath: process.env.VN_RESEARCH_CHROME_EXECUTABLE } }
    }] : [])
  ]
});
