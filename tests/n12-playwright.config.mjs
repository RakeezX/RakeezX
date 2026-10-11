import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'n12-import.e2e.mjs', workers: 1, retries: 0, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.N12_PREVIEW_URL || 'http://127.0.0.1:5271', trace: 'off', screenshot: 'off' },
  ...(process.env.N12_PREVIEW_URL ? {} : { webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'node tests/n12-static-server.mjs', url: 'http://127.0.0.1:5271', reuseExistingServer: false } }),
});
