import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.mjs',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The isolated runner binds IPv4 explicitly so another local Vite server on
    // IPv6 localhost cannot leak a different RAKEEZ worktree into this gate.
    baseURL: process.env.RAKEEZX_E2E_SERVER ? 'http://127.0.0.1:5173' : 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.RAKEEZX_E2E_SERVER ? {} : {
    webServer: {
      command: 'npx vite',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  }),
});
