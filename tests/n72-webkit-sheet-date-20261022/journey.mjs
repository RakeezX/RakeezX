import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n72-webkit-sheet-date-20261022.json';
const runId = '977ef580-0c79-4387-9a2f-da73f4abe525';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const relative = new URL(req.url, 'http://127.0.0.1').pathname === '/' ? 'index.html' : decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).slice(1);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !/^(index\.html|manifest\.webmanifest|src\/|assets\/)/.test(relative)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
const port = 43172;
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${port}`;

try {
  await withIsolatedLocalBrowser({ taskFile, runId, url: origin, engine: 'webkit', timeoutMs: 60000 }, async ({ createContext }) => {
    const require = createRequire(new URL('../../package.json', import.meta.url));
    const { expect } = require('@playwright/test');
    const results = [];
    for (const scenario of [
      { name: 'mobile-390', viewport: { width: 390, height: 740 }, compressed: null },
      { name: 'short-sheet-simulated-viewport', viewport: { width: 320, height: 420 }, compressed: { height: 230, top: 0 } },
      { name: 'desktop', viewport: { width: 1280, height: 900 }, compressed: null },
    ]) {
      const context = await createContext({ viewport: scenario.viewport, locale: 'ar-SA', hasTouch: true });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('https://xlrubcwjqktzzunrvuns.supabase.co/**', route => route.fulfill({ status: 200, json: [] }));
        await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'active'));
        await page.goto(`${origin}/`);
        await page.locator('.layout').waitFor({ timeout: 5000 }).catch(async () => { throw new Error(`App boot state: ${JSON.stringify({ errors, body: await page.locator('body').innerText(), routing: await page.evaluate(() => window.__workspaceRouting ?? null), databases: await page.evaluate(() => indexedDB.databases()), resources: await page.evaluate(() => performance.getEntriesByType('resource').map(r => [r.name, r.responseStatus]).slice(-15)) })}`); });
        await page.evaluate(() => { location.hash = '#/calendar'; });
        const opener = page.locator('[data-act="edit-term-in-settings"]').first();
        await opener.click();
        const sheet = page.locator('.sheet-backdrop').last().locator('.sheet');
        const input = sheet.locator('#term-dates [name="startDate"]');
        await expect(input).toHaveAttribute('data-rakeez-date-scope', 'planning');
        await input.focus();
        if (scenario.compressed) {
          await page.evaluate(({ height, top }) => {
            Object.defineProperties(visualViewport, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: top }, scale: { configurable: true, value: 1 } });
            visualViewport.dispatchEvent(new Event('resize'));
          }, scenario.compressed);
          await page.waitForTimeout(80);
        }
        await input.click();
        const picker = page.locator('.flatpickr-calendar.open');
        await expect(picker).toBeVisible();
        const metrics = await page.evaluate(() => {
          const input = document.querySelector('#term-dates [name="startDate"]');
          const picker = document.querySelector('.flatpickr-calendar.open');
          const sheet = input.closest('.sheet');
          const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          return { viewport: { width: innerWidth, height: visualViewport.height, top: visualViewport.offsetTop }, input: box(input), sheet: box(sheet), picker: box(picker), rtl: document.documentElement.dir, inputValue: input.value, focus: document.activeElement === input, pickerPosition: getComputedStyle(picker).position };
        });
        results.push({ scenario: scenario.name, simulatedCompression: Boolean(scenario.compressed), metrics });
        await page.keyboard.press('Escape');
        await expect(picker).toBeHidden();
        await expect(input).toBeFocused();
        await sheet.locator('[data-sheet-close]').click();
        await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
        await expect(opener).toBeFocused();
        expect(errors).toEqual([]);
      } finally { await context.close(); }
    }
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  });
} finally {
  await new Promise(resolve => server.close(resolve));
}
