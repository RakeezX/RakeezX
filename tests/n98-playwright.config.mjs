import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'n98-views.e2e.mjs', workers: 1, retries: 0,
  timeout: 90000, reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'rakeez-n98-f9a9be3d-evidence'),
  use: { baseURL: 'http://127.0.0.1:5198', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { cwd: path.resolve(import.meta.dirname, '..'), command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5198 --strictPort', url: 'http://127.0.0.1:5198', reuseExistingServer: false },
});
