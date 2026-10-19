import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const root = new URL('../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const base = 'http://127.0.0.1:5120';
const output = new URL('./fixtures/n120-1019/', import.meta.url);
const evidence = [];
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5120, strictPort: true } });
try {
  await server.listen();
  await mkdir(output, { recursive: true });
  await withIsolatedLocalBrowser({
    taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n120-compact-unified-report-filters-20261019.json',
    runId: '8339cba8-3221-44e0-a95f-d74fe35b9c6a', url: base, timeoutMs: 120000,
  }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    await openReadyServedDemo(page, base);
    await page.evaluate(async () => {
      const s = await import('/src/store.js');
      const termId = s.activeTerm().id, yearId = s.activeYear().id;
      await s.save({
        sections: ['a', 'b'].map((id, i) => ({ id: `n120-${id}`, yearId, grade: 9, section: String(i + 1) })),
        subjects: [{ id: 'n120-subject', name: 'مادة الاختبار' }],
        teachings: ['a', 'b'].map(id => ({ id: `n120-t-${id}`, sectionId: `n120-${id}`, subjectId: 'n120-subject', termId })),
        students: [{ id: 'n120-s1', name: 'أحمد اختبار', rollNo: 1 }, { id: 'n120-s2', name: 'بدر اختبار', rollNo: 2 }, { id: 'n120-s3', name: 'جابر اختبار', rollNo: 3 }],
        enrollments: [1, 2, 3].map(i => ({ id: `n120-e${i}`, studentId: `n120-s${i}`, sectionId: i === 3 ? 'n120-b' : 'n120-a', status: 'active' })),
        items: ['a', 'b'].map(id => ({ id: `n120-i-${id}`, teachingId: `n120-t-${id}`, name: 'اختبار', max: 10 })),
        scores: [{ id: 'n120-score1', studentId: 'n120-s1', itemId: 'n120-i-a', value: 8 }, { id: 'n120-score3', studentId: 'n120-s3', itemId: 'n120-i-b', value: 2 }],
      });
    });
    const scoresBefore = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state.scores));
    async function layout(name) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.report-filter-bar')).display === 'flex');
        const info = await page.locator('.report-filter-bar').evaluate(bar => {
          const controls = [...bar.querySelectorAll('select, input:not([type=checkbox]), button, .grades-01c__missing-filter')];
          return { overflow: document.documentElement.scrollWidth > innerWidth, controls: controls.map(el => {
            const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
          }) };
        });
        assert.equal(info.overflow, false, `${name}/${width}: no page overflow`);
        assert.ok(info.controls.every(r => r.left >= 0 && r.right <= width && r.height >= 44), `${name}/${width}: visible 44px controls ${JSON.stringify(info)}`);
        if (width === 1440) assert.ok(Math.max(...info.controls.map(r => r.top)) < Math.min(...info.controls.map(r => r.bottom)), `${name}: one wide row ${JSON.stringify(info)}`);
        await page.screenshot({ fullPage: false, path: new URL(`${name}-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
        evidence.push({ name, width, ...info });
      }
    }
    const go = async path => { await page.goto(`${base}/#/${path}`); await page.locator('.report-filter-bar').waitFor(); };
    await go('teaching/n120-t-a/grades');
    await layout('gradebook');
    await expect(page.locator('.grades-01c__direct-row')).toHaveCount(2);
    await page.locator('[data-change="toggle-missing"]').check();
    await expect(page.locator('.grades-01c__direct-row')).toHaveCount(1);
    assert.match(await page.locator('.grades-01c__score-panel').innerText(), /بدر اختبار/);
    await page.locator('[data-change="toggle-missing"]').uncheck();
    await page.locator('[data-change="sort"]').selectOption('score_asc');
    await expect(page.locator('.grades-01c__direct-row').first()).toContainText('أحمد اختبار');
    await page.locator('[data-input="search"]').fill('لا يطابق');
    await page.getByText('لا يوجد طلاب مطابقين للتصفية', { exact: true }).waitFor();
    await page.locator('[data-input="search"]').fill('بدر');
    await expect(page.locator('.grades-01c__direct-row')).toHaveCount(1);

    await go('reports/grades');
    await layout('aggregate');
    await page.locator('[data-change="n70-grade"]').selectOption('9');
    await page.locator('[data-change="n70-teaching"]').selectOption('n120-t-a');
    await expect(page.locator('.n70-record')).toHaveCount(2);
    await page.locator('[data-change="n70-filter"]').selectOption('missing');
    await expect(page.locator('.n70-record')).toHaveCount(1);
    assert.match(await page.locator('.n70-record').innerText(), /بدر اختبار/);
    await page.locator('[data-input="n70-search"]').fill('لا يطابق');
    await page.getByText('لا نتائج مطابقة', { exact: true }).waitFor();
    await page.locator('[data-act="n70-reset"]').click();
    await expect(page.locator('[data-change="n70-grade"]')).toHaveValue('all');
    await expect(page.locator('[data-change="n70-teaching"]')).toHaveValue('all');
    await expect(page.locator('[data-change="n70-filter"]')).toHaveValue('all');
    await expect(page.locator('[data-input="n70-search"]')).toHaveValue('');
    const total = await page.locator('.n70-record').count();
    assert.equal(await page.locator('[data-n70-count]').innerText(), `${total} نتيجة`);
    await page.locator('[data-change="n70-teaching"]').selectOption('n120-t-b');
    await expect(page.locator('.n70-record')).toHaveCount(1);
    await page.locator('[data-change="n70-grade"]').selectOption('9');
    await expect(page.locator('[data-change="n70-teaching"]')).toHaveValue('all');

    await go('teaching/n120-t-a/reports');
    await page.locator('[data-change="sort"]').selectOption('name');
    await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد اختبار');
    await page.locator('[data-act="tab"][data-tab="attendance"]').click();
    await layout('attendance');
    // The existing adapter remains attached to optional historical ISO fields.
    const start = page.locator('[data-change="filter-start"]');
    await start.evaluate(el => { el.value = '2026-10-01'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect(start).toHaveValue('2026-10-01');
    assert.equal(await start.getAttribute('data-rakeez-date-scope'), 'historical');
    await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
    await expect(start).toHaveValue('2026-10-01');
    assert.equal(await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state.scores)), scoresBefore);
  });
  await writeFile(new URL('./n120-1019-evidence.json', import.meta.url), JSON.stringify({ check: 'n120_existing_filter_semantics_single_compact_responsive_row', status: 'PASS', evidence }, null, 2) + '\n');
  console.log('PASS n120_existing_filter_semantics_single_compact_responsive_row: actual app handlers/CSS; small synthetic fixture; wide/narrow controls; unchanged scores.');
} finally {
  await server.close();
}
