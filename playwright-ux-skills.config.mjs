import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'ux-skills-pilot.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5194', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5194 --strictPort', url: 'http://127.0.0.1:5194', reuseExistingServer: false, timeout: 60000 }
});
