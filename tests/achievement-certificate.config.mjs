import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.RAKEEZ_CERTIFICATE_PREVIEW_URL || 'http://127.0.0.1:5287';
const target = new URL(baseURL);
if (!(['127.0.0.1', 'localhost'].includes(target.hostname) || /^[a-f0-9]{8}\.rakeezx\.pages\.dev$/.test(target.hostname))) {
  throw new Error('Certificate checks require an owned loopback server or immutable Rakeez Preview');
}

export default defineConfig({
  testDir: '.',
  testMatch: /(?:achievement-certificate|certificate-center|n87-achievements)\.e2e\.mjs$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  // Keep transient trace files outside Vite's watched source tree on Windows.
  outputDir: '../node_modules/.cache/certificate-preview-test',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    locale: 'ar-SA',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  ...(process.env.RAKEEZ_CERTIFICATE_PREVIEW_URL ? {} : {
    webServer: {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5287 --strictPort',
      cwd: '..',
      url: baseURL,
      timeout: 20000,
      reuseExistingServer: false,
    },
  }),
});
