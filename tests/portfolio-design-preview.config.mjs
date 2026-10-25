import { defineConfig, devices } from '@playwright/test';
const baseURL=process.env.RAKEEZ_PORTFOLIO_PREVIEW_URL || 'http://127.0.0.1:5307';
const target=new URL(baseURL);
if(!(['127.0.0.1','localhost'].includes(target.hostname) || /^[a-f0-9]{8}\.rakeezx\.pages\.dev$/.test(target.hostname)))
  throw new Error('Portfolio checks must target owned localhost or immutable Preview');
export default defineConfig({
  testDir:'.', testMatch:/portfolio-design-preview\.e2e\.mjs$/,
  fullyParallel:false, workers:1,retries:0,timeout:65000,reporter:'list',
  outputDir:'../node_modules/.cache/portfolio-preview-e2e',
  use:{...devices['Desktop Chrome'],baseURL,locale:'ar-SA',serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'},
  ...(process.env.RAKEEZ_PORTFOLIO_PREVIEW_URL?{}:{
    webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5307 --strictPort',
      cwd:'..',url:baseURL,timeout:40000,reuseExistingServer:false},
  }),
});
