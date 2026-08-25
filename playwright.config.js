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
    baseURL: 'http://localhost:5173', // Vite default, we'll start a local server
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
