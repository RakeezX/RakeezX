import { defineConfig } from '@playwright/test';
// The pilot's localhost-only demo fixtures must never target Production by default.
process.env.RAKEEZX_E2E_BASE_URL ??= 'http://127.0.0.1:5194';
export default defineConfig({
  testDir: './tests',
  testMatch: ['ux-skills-*.spec.mjs', 'schedule-mobile-today.e2e.mjs', 'n132-home-compact-labels.e2e.mjs'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5194', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5194 --strictPort', url: 'http://127.0.0.1:5194', reuseExistingServer: false, timeout: 60000 }
});
