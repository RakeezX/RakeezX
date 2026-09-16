import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.RAKEEZX_E2E_BASE_URL || 'http://127.0.0.1:5173';

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
    baseURL,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.RAKEEZX_E2E_SERVER ? {} : {
    webServer: {
      command: 'npx vite --host 127.0.0.1',
      url: baseURL,
      reuseExistingServer: false,
    },
  }),
});
