import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const base = process.env.N86_PREVIEW_URL || 'http://127.0.0.1:5186';
let server, browser;
try {
  if (!process.env.N86_PREVIEW_URL) {
    server = spawn(process.execPath, [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '5186', '--strictPort'], { stdio: 'pipe' });
    server.stderr.on('data', data => process.stderr.write(data));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, 'owned server ready');
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('rakeezx-demo-session-v1')) sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  if (process.env.N86_PREVIEW_URL) await page.evaluate(async () => {
    // Raw ESM Pages does not expose the development-only test hook. Attach it only
    // inside this disposable browser context, after opening the synthetic Demo.
    const store = await import('/src/store.js');
    const { repaint } = await import('/src/repaint.js');
    window.store = { ...store, repaint };
  });
  await page.waitForFunction(() => window.store?.state.ready, { timeout: 30000 });
  await page.evaluate(() => {
    const s = window.store.state;
    Object.assign(s, {
      years: [{ id: 'n86:y', label: '1448-1449', status: 'active' }],
      terms: [{ id: 'n86:tm', yearId: 'n86:y', name: 'الفصل الدراسي الأول', status: 'active' }],
      subjects: [{ id: 'n86:math', name: 'الرياضيات' }],
      sections: ['a', 'b'].map((id, i) => ({ id, name: `الرابع / ${i+1}`, label: String(i+1), grade: 4, yearId: 'n86:y', status: 'active' })),
      teachings: ['a', 'b'].map(id => ({ id, sectionId: id, subjectId: 'n86:math', termId: 'n86:tm' })),
      students: ['a', 'b', 'negative'].map(id => ({ id, name: id === 'negative' ? 'طالب سالب مخفي' : 'طالب اصطناعي متطابق الاسم', status: 'active', note: 'PRIVATE_NOTE', score: 98765 })),
      enrollments: ['a', 'b', 'negative'].map(id => ({ id, studentId: id, sectionId: id === 'a' ? 'a' : 'b', status: 'active', rollNo: 1 })),
      logs: [
        { teachingId: 'a', studentId: 'a', kind: 'participation', date: '2026-10-11', delta: 3 },
        { teachingId: 'b', studentId: 'b', kind: 'participation', date: '2026-10-11', delta: 5 },
        { teachingId: 'b', studentId: 'negative', kind: 'participation', date: '2026-10-11', delta: -8 },
        { teachingId: 'b', studentId: 'b', kind: 'behavior', date: '2026-10-11', delta: 2 },
      ],
    });
    s.device.activeYearId = 'n86:y'; s.device.activeTermId = 'n86:tm';
    location.hash = '#/teaching/a/board';
    window.store.repaint();
  });
  await page.locator('.board__row').first().waitFor();
  assert.equal(await page.locator('.board__row').count(), 1);
  const snapshot = await page.evaluate(() => JSON.stringify(window.store.state));
  await page.locator('[data-audience="grade"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.board__row').length === 2);
  assert.deepEqual(await page.locator('.board__pts').allTextContents(), ['+5', '+3']);
  assert.match(await page.locator('.board-context').innerText(), /تختلف فرص المشاركة/);
  assert.doesNotMatch(await page.locator('.excellence-board-page').innerText(), /PRIVATE_|98765|طالب سالب مخفي/);
  assert.equal(await page.locator('.board__section').count(), 2);
  const outputDir = process.env.N86_ARTIFACT_DIR || 'test-results/n86';
  await mkdir(outputDir, { recursive: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    for (const button of await page.locator('.board-controls button').all()) {
      const box = await button.boundingBox(); assert.ok(box && box.height >= 44, `44px control: ${await button.innerText()} / ${box?.height}`);
    }
    await page.screenshot({ path: `${outputDir}/grade-${width}.png`, fullPage: true });
  }
  await page.locator('[data-kind="behavior"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.board__row').length === 1);
  assert.deepEqual(await page.locator('.board__pts').allTextContents(), ['+2']);
  await page.locator('[data-scope="today"]').click();
  assert.deepEqual(await page.locator('.board__pts').allTextContents(), ['+2']);
  await page.locator('[data-audience="class"]').click();
  await page.locator('.empty__title').waitFor();
  await page.locator('[data-kind="participation"]').click();
  await page.locator('.board__row').waitFor();
  assert.deepEqual(await page.locator('.board__pts').allTextContents(), ['+3']);
  await page.locator('[data-act="fullscreen"]').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.locator('[data-act="fullscreen"]').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.evaluate(() => JSON.stringify(window.store.state)), snapshot, 'read-only controls preserve data');
  assert.deepEqual(errors, []);
  console.log('PASS: synthetic real board class/grade, distinct IDs, positive-only grade, kind/today/fullscreen, 390/1280 RTL, privacy, unchanged state');
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
}
