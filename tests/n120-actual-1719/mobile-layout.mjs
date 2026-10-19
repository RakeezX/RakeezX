// AI-authored N120: actual application, existing served Demo helper, local only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { withIsolatedLocalBrowser } from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';

const base = 'http://127.0.0.1:5148';
const output = new URL('./', import.meta.url);
const baseSha = '0b4e841ca9447373add29c0a62876494a81ecdb8';
const evidence = { check: 'n120_mobile_filters_no_horizontal_drag_desktop_preserved', baseSha, layouts: [], actions: [] };
const original = execFileSync('git', ['show', baseSha + ':src/styles/filters.css']);
const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 5148, strictPort: true } });
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  await withIsolatedLocalBrowser({
    taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n120-mobile-visible-filter-layout-20261019.json',
    runId: 'baf665ec-a79e-484b-9e9c-e42f8ee9ac5c', url: base, timeoutMs: 120000,
  }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    await openReadyServedDemo(page, base);
    // Reuse the small existing N120 report fixture; all writes are disposable Demo.
    await page.evaluate(async () => {
      const s = await import('/src/store.js'), yearId = s.activeYear().id, termId = s.activeTerm().id;
      await s.save({
        sections: [{ id: 'rf-sec', yearId, grade: 9, label: '1' }],
        subjects: [{ id: 'rf-sub', name: 'مادة الفلاتر' }],
        teachings: [{ id: 'rf-t', sectionId: 'rf-sec', subjectId: 'rf-sub', termId }],
        students: [{ id: 'rf-b', name: 'بدر اختبار' }, { id: 'rf-a', name: 'أحمد اختبار' }],
        enrollments: [{ id: 'rf-eb', studentId: 'rf-b', sectionId: 'rf-sec', rollNo: 1, status: 'active' }, { id: 'rf-ea', studentId: 'rf-a', sectionId: 'rf-sec', rollNo: 2, status: 'active' }],
        items: [{ id: 'rf-i', teachingId: 'rf-t', name: 'اختبار', max: 10 }],
        scores: [{ id: 'rf-sa', studentId: 'rf-a', itemId: 'rf-i', value: 2 }, { id: 'rf-sb', studentId: 'rf-b', itemId: 'rf-i', value: 9 }],
        sessions: [{ id: 'rf-d1', teachingId: 'rf-t', date: '2026-09-01', period: 1 }],
      });
      await s.fillAttendance('rf-d1', 'present');
    });
    const records = () => page.evaluate(async () => { const s = await import('/src/store.js'); return JSON.stringify([s.state.students, s.state.enrollments, s.state.scores, s.state.sessions, s.state.attendance]); });
    const before = await records();
    const settle = () => page.evaluate(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, 140)); });
    const select = key => page.locator(`[data-change="${key}"]`);
    async function geometry() {
      await settle();
      return page.locator('.report-filter-bar').evaluate(bar => {
        const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }; };
        return { ...box(bar), display: getComputedStyle(bar).display, pageOverflow: document.documentElement.scrollWidth > innerWidth, barOverflow: bar.scrollWidth > bar.clientWidth + 1,
          controls: [...bar.querySelectorAll('input:not([type="hidden"]):not(.flatpickr-mobile),select,button,.grades-01c__missing-filter')].filter(e => e.getBoundingClientRect().height > 0 && e.type !== 'checkbox').map(box) };
      });
    }
    async function stable(name, action) {
      const a = await geometry(); await action(); const b = await geometry();
      for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[k] - b[k]) <= 1, `${name}: stable ${k}`);
      assert.deepEqual(b.controls, a.controls, name + ': stable control geometry');
      evidence.actions.push(name);
    }
    const pages = [
      ['gradebook', 'teaching/rf-t/grades'],
      ...['roster', 'grades', 'attendance', 'support'].map(tab => [tab, 'teaching/rf-t/reports', tab]),
      ['aggregate-grades', 'reports/grades'], ['aggregate-followup', 'reports/followup'], ['execution', 'reports/execution'],
    ];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [name, path, tab] of pages) {
        await page.goto(base + '/#/reports');
        await page.locator('.reports-index-page').waitFor();
        await page.goto(base + '/#/' + path);
        await page.locator('.report-filter-bar').waitFor();
        if (tab) await page.locator(`[data-tab="${tab}"]`).click();
        const g = await geometry();
        assert.equal(g.pageOverflow, false, `${name}/${width}: page overflow`);
        assert.equal(g.barOverflow, false, `${name}/${width}: bar overflow`);
        assert.ok(g.controls.every(c => c.x >= 0 && c.x + c.width <= width + 1 && c.height >= 44 && c.width >= 44), `${name}/${width}: visible 44px controls ${JSON.stringify(g)}`);
        if (width === 1440) {
          assert.ok(Math.max(...g.controls.map(c => c.y)) < Math.min(...g.controls.map(c => c.y + c.height)), name + ': desktop single row');
          // Compare only affected layout with the exact base stylesheet in the same app.
          const baselineStyle = await page.addStyleTag({ content: original.toString() });
          const old = await geometry();
          await baselineStyle.evaluate(el => el.remove());
          assert.deepEqual(g, old, name + ': accepted desktop geometry unchanged');
        }
        await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}.png`, output)) });
        evidence.layouts.push({ name, viewportWidth: width, ...g });
        if (name === 'roster') {
          assert.deepEqual(await select('sort').locator('option').evaluateAll(es => es.map(e => e.value)), ['default', 'name']);
          await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد');
          if (width === 390) {
            await stable('390 roster sort', () => select('sort').selectOption('name'));
            await expect(select('sort')).toHaveValue('name');
            // Exercise the old value through the real handler, not a lookalike UI.
            await select('sort').evaluate(el => {
              el.add(new Option('legacy roll', 'roll')); el.value = 'roll';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await expect(select('sort')).toHaveValue('default');
            await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد');
            evidence.actions.push('legacy roll aliases identical live default');
          }
        }
        if (name === 'grades') {
          assert.deepEqual(await select('sort').locator('option').evaluateAll(es => es.map(e => e.value)), ['default', 'name', 'score_desc', 'score_asc']);
          if (width === 390) {
            await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد');
            await stable('390 explicit descending grade sort', () => select('sort').selectOption('score_desc'));
            await expect(page.locator('.report-document tbody tr').first()).toContainText('بدر');
            await page.locator('[data-act="reset-filters"]').click();
            await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد');
          }
        }
        if (name === 'attendance' && width === 390) {
          await stable('390 attendance mode', () => page.locator('[data-mode="detailed"]').click());
          await stable('390 attendance reset', () => page.locator('[data-act="reset-filters"]').click());
        }
        if (name === 'aggregate-grades' && width === 320) {
          await select('n70-teaching').selectOption('rf-t');
          await stable('320 filter to empty', () => select('n70-filter').selectOption('missing'));
          await expect(page.locator('.n70-record')).toHaveCount(0);
          await stable('320 reset results', () => page.locator('[data-act="n70-reset"]').click());
          await expect(select('n70-teaching')).toHaveValue('all');
          await expect(select('n70-filter')).toHaveValue('all');
        }
      }
    }
    assert.equal(await records(), before, 'read-only controls preserve fixture identities, grades, enrollment, attendance and sessions');
    await context.close();
  });
  evidence.status = 'PASS';
  await writeFile(new URL('evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
  console.log('PASS ' + evidence.check);
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  await writeFile(new URL('failure.json', output), JSON.stringify(evidence, null, 2) + '\n');
  throw error;
} finally {
  await server.close();
}
