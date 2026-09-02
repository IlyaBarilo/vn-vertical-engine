import runtimeConfig from '../../playwright.config.mjs';
import browserMatrix from '../story-worker/playwright.config.mjs';

// Повторяет продуктовые проверки на установленных браузерах со строгой политикой file:// Firefox.
export default {
  ...runtimeConfig,
  testDir: '../../tests/e2e',
  outputDir: '../../.playwright/html-game-runtime/test-results',
  use: { ...runtimeConfig.use, launchOptions: { timeout: 30000 } },
  projects: browserMatrix.projects
};
