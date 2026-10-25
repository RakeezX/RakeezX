import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: /attendance-evidence\.e2e\.mjs$/,
  workers: 1, retries: 0, timeout: 60000, reporter: 'list',
  outputDir: '../node_modules/.cache/attendance-evidence-preview-tests',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5297',
    locale: 'ar-SA', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5297 --strictPort',
    cwd: '..', url: 'http://127.0.0.1:5297', timeout: 45000, reuseExistingServer: false },
});