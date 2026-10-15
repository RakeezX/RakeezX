import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixedNow, owner } from './n44-fixture.mjs';

const taskId = 'continuous-n44-rtl-due-reminder-visual-order-20261015';
const runId = process.env.N44_RUN_ID;
assert.ok(runId, 'N44_RUN_ID is required');
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const root = path.resolve('.');
const mime = { '.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2' };
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const file = path.resolve(root, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  await withIsolatedLocalBrowser({ taskFile, runId, url: base, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Riyadh', locale: 'ar-SA', colorScheme: 'light' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    await page.clock.install({ time: fixedNow });
    await openReadyServedDemo(page, base);
    await page.evaluate(async user => { await (await import('/tests/n44-fixture.mjs')).prepareAccount(user); }, owner);
    await page.goto(`${base}/#/settings/notifications`);
    await page.locator('.n44-settings-page').waitFor();
    const expected = ['3', '2', '1', '0'];
const labels = ['قبل 3 أيام', 'قبل يومين', 'قبل يوم', 'يوم التسليم'];
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.locator('.n44-day-grid').evaluate(grid => {
        const buttons = [...grid.querySelectorAll('button')];
        return {
          direction: getComputedStyle(grid).direction,
          items: buttons.map(button => { const r = button.getBoundingClientRect(); return { day: button.dataset.day, left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: button.innerText, role: button.getAttribute('role'), checked: button.getAttribute('aria-checked'), scrollWidth: button.scrollWidth, clientWidth: button.clientWidth }; }),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 || grid.scrollWidth > grid.clientWidth + 1
        };
      });
      assert.equal(layout.direction, 'rtl');
      assert.deepEqual(layout.items.map(item => item.day), expected, 'DOM/focus order preserves configured day IDs');
      assert.deepEqual(layout.items.map(item => item.text), labels);
      assert.ok(layout.items.every(item => item.role === 'switch' && ['true', 'false'].includes(item.checked)), 'switch semantics preserved');
      for (let i = 1; i < layout.items.length; i++) {
        assert.ok(layout.items[i].top >= layout.items[i - 1].top - 1, `${width}px row-major DOM order: ${JSON.stringify(layout.items)}`);
        if (Math.abs(layout.items[i].top - layout.items[i - 1].top) <= 1) assert.ok(layout.items[i].left < layout.items[i - 1].left, `${width}px RTL within row: ${JSON.stringify(layout.items)}`);
      }
      assert.equal(layout.overflow, false, `${width}px overflow`);
      assert.ok(layout.items.every(item => item.scrollWidth <= item.clientWidth + 1), `${width}px clipped label`);
      const rows = [...new Set(layout.items.map(item => Math.round(item.top)))];
      if (width <= 390) assert.ok(rows.length >= 1 && rows.length <= 2, `${width}px rows: ${rows.length}`);
      if (width >= 768) assert.equal(rows.length, 1, `${width}px should display a single row`);
      console.log(JSON.stringify({ width, rows: rows.length, x: layout.items.map(item => ({ day: item.day, x: item.left })), noOverflow: !layout.overflow }));
    }
    const buttons = page.locator('.n44-day-grid button');
    for (let index = 0; index < 4; index++) {
      await buttons.nth(index).focus();
      assert.equal(await buttons.nth(index).evaluate(el => el === document.activeElement), true, `keyboard focus index ${index}`);
      assert.equal(await buttons.nth(index).getAttribute('data-day'), expected[index]);
    }
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      for (const width of [768, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.deepEqual(await page.locator('.n44-day-grid button').evaluateAll(buttons => buttons.map(button => button.dataset.day)), expected);
        const direction = await page.locator('.n44-day-grid').evaluate(el => getComputedStyle(el).direction);
        assert.ok(direction === 'rtl' || direction === '', `RTL inherited from app root is acceptable, got ${direction}`);
      }
    }
    for (const width of [640, 320]) {
      await page.setViewportSize({ width, height: 900 }); // 200% and 400% effective CSS viewport widths
      const clipped = await page.locator('.n44-day-grid button').evaluateAll(buttons => buttons.some(button => button.scrollWidth > button.clientWidth + 1));
      assert.equal(clipped, false, `zoom-equivalent ${width}px labels`);
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
