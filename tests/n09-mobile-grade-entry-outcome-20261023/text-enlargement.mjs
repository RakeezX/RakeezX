// AI-authored: additional text-only enlargement concern, reusing unchanged journey evidence.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';
const server = await createServer({ server: { host: '127.0.0.1', port: 5299, strictPort: true }, logLevel: 'error' });
const base = 'http://127.0.0.1:5299', results = [];
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n09-mobile-grade-entry-outcome-20261023.json',
    runId: 'bdffa863-f649-4ced-8d56-7ae3f32e6867', url: base, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 360, height: 800 }, locale: 'ar-SA' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    await openReadyServedDemo(page, base);
    const fixture = await page.evaluate(async () => (await import('/tests/n09-mobile-grade-entry-outcome-20261023/account.mjs')).account({ seed: true }));
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/#/teaching/${fixture.teaching}/grades`);
      await page.locator('[data-act="mode"][data-mode="table"]').click();
      await page.locator('.gtable').waitFor();
      await page.evaluate(() => {
        const fonts = [...document.querySelectorAll('.grades-01c, .grades-01c *')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
        for (const [el, size] of fonts) el.style.fontSize = `${size * 1.25}px`;
      });
      for (const field of await page.locator('.gtable tbody tr').first().locator('input').all()) {
        await field.focus();
        assert.ok(await field.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el === document.activeElement && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
        }), `${width}px enlarged field remains visible above sticky column`);
      }
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        inputFont: getComputedStyle(document.querySelector('.gtable input')).fontSize }));
      assert.equal(geometry.inputFont, '20px'); assert.ok(geometry.documentWidth <= width + 1);
      await page.screenshot({ path: new URL(`text125-${width}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
      results.push({ width, status: 'PASS', ...geometry });
      await page.locator('[data-act="mode"][data-mode="item"]').click();
      await page.locator('.grades-01c__score-panel').waitFor();
    }
  });
} finally {
  await server.close();
  await writeFile(new URL('text-enlargement.json', import.meta.url), JSON.stringify({ results, cleanup: true }, null, 2));
}
console.log(JSON.stringify(results));
