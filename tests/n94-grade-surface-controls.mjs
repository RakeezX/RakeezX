import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n94-grade-strip-controls-20261013.json';
const runId = '161ea1b0-afeb-4f62-9d98-51faf734fd17';
const port = 5194;
const base = `http://127.0.0.1:${port}`;
const require = createRequire(resolve(root, 'package.json'));
const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Owned Vite server exited: ${server.exitCode}`);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, 'owned Vite server ready on task-unique port');
  await withIsolatedLocalBrowser({ taskFile, runId, url: base, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1200, height: 900 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    await openReadyServedDemo(page, base);
    const fixture = await page.evaluate(async () => {
      const store = await import('/src/store.js');
      const teaching = store.teachings().find(t => store.items(t.id).some(i => i.auto === 'participation') && store.items(t.id).some(i => i.scoreMode === 'subitems' && store.scoreSubitemsOf(i.id).length));
      if (!teaching) throw new Error('Demo fixture needs a participation item and configured subitem item');
      return { teachingId: teaching.id,
        autoId: store.items(teaching.id).find(i => i.auto === 'participation').id,
        subitemId: store.items(teaching.id).find(i => i.scoreMode === 'subitems' && store.scoreSubitemsOf(i.id).length).id };
    });
    await page.goto(`${base}/#/teaching/${fixture.teachingId}/grades`);
    await page.locator(`[data-act="pick"][data-id="${fixture.autoId}"]`).click();
    await page.locator('[data-act="mode"][data-mode="table"]').click();
    await page.locator('table.gtable').waitFor();
    assert.ok(await page.locator('td.is-auto').count() > 0, 'actual grades table contains automatic cells');
    assert.equal(await page.locator('td.is-auto [data-act="n84-log"]').count(), 0, 'table cells have no quick-log controls');
    await page.locator('[data-act="mode"][data-mode="item"]').click();
    await page.locator('.graderow__auto').first().waitFor();
    assert.ok(await page.locator('.graderow__auto [data-act="n84-log"]').count() > 0, 'individual automatic item retains quick-log handlers');
    const minus = page.locator('.graderow__auto [data-act="n84-log"][data-delta="-1"]').first();
    assert.ok((await minus.getAttribute('aria-label'))?.includes('خصم نقطة'), 'minus has an accessible label');
    const minusStyle = await minus.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, background: getComputedStyle(el).backgroundColor }));
    assert.ok(minusStyle.width >= 44 && minusStyle.height >= 44);
    assert.notEqual(minusStyle.background, 'rgba(0, 0, 0, 0)');

    await page.locator(`[data-act="pick"][data-id="${fixture.subitemId}"]`).click();
    const toolbar = page.locator('.n94-subscore-toolbar');
    await toolbar.waitFor();
    assert.equal(await toolbar.locator('.grades-01c__provenance-key').count(), 1);
    assert.equal(await toolbar.locator('.n94-completion-legend span').count(), 3);
    for (const width of [1200, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await toolbar.evaluate(el => {
        const bounds = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const equation = bounds(el.querySelector('.grades-01c__provenance-key'));
        const legend = bounds(el.querySelector('.n94-completion-legend'));
        return { equation, legend, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false, `${width}px page has no horizontal overflow`);
      assert.ok(layout.equation.left >= 0 && layout.equation.right <= width && layout.legend.left >= 0 && layout.legend.right <= width, `${width}px toolbar content remains visible`);
      if (width >= 1000) assert.ok(layout.equation.top < layout.legend.bottom && layout.legend.top < layout.equation.bottom, 'desktop equation and legend share a row');
    }
    console.log('PASS: actual app DOM, handlers and CSS; table/item quick-log scope; N94 toolbar at 1200/390/320px; visible minus touch target');
  });
} finally {
  if (server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(3000)]); }
}
