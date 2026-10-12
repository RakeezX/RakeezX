import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'n49-product.e2e.mjs', fullyParallel: false,
  workers: 1, retries: 0, timeout: 120000, reporter: 'list',
  outputDir: process.env.N49_EVIDENCE_DIR || path.join(os.tmpdir(), 'rakeez-n49-browser-evidence'),
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
