import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'n13-product.e2e.mjs', workers: 1, retries: 0, timeout: 45000, reporter: 'list',
  outputDir: '../test-results/n13',
  use: { baseURL: 'http://127.0.0.1:5193', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5193 --strictPort', cwd: fileURLToPath(new URL('..', import.meta.url)), url: 'http://127.0.0.1:5193', reuseExistingServer: false },
});
