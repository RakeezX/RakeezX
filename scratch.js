import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:5173/#/teaching/tch1');
  
  await page.waitForSelector('[data-act="edit-sec"]', { timeout: 10000 });
  console.log("Found button. Clicking...");
  await page.click('[data-act="edit-sec"]');
  
  try {
    await page.waitForSelector('.sheet', { timeout: 5000 });
    console.log("Sheet opened successfully!");
  } catch (e) {
    console.log("Sheet failed to open:", e.message);
  }

  await browser.close();
})();
