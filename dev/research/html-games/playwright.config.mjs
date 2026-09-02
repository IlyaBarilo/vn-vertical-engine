import workerResearch from '../story-worker/playwright.config.mjs';

// Использует ту же матрицу установленных браузеров и строгую файловую политику Firefox.
export default {
  ...workerResearch,
  testDir: '.',
  outputDir: '../../.playwright/html-game-research/test-results'
};
