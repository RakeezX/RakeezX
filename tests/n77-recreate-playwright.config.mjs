import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'n77-recreate-ui.e2e.mjs', workers: 1, retries: 0, outputDir: '../test-results/n77-recreate-ui',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite --host 127.0.0.1 --port 5187 --strictPort', cwd: fileURLToPath(new URL('../', import.meta.url)), url: 'http://127.0.0.1:5187', reuseExistingServer: false },
});
