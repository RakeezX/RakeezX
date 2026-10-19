// AI-authored N119: exact option semantics in the actual app; disposable local Demo only.
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';
const taskId = 'continuous-n119-all-filter-sort-dedup-close-20261019';
const runId = '483179a4-5613-4143-b281-f8009d070277';
const evidence = { check: 'n119_all_duplicated_sort_options_removed_meaningful_orders_preserved', taskId, runId, options: [], actions: [] };
// Inventory only affected entry points: the other filters offer no student sort choices.
for (const name of ['students', 'attendance', 'cross-class-reports', 'execution-report', 'teaching-hub', 'former-students']) {
  const text = await readFile(new URL(`../../src/views/${name}.js`, import.meta.url), 'utf8');
  assert.doesNotMatch(text, /<option[^>]*value="(?:default|roll|name|score_desc|score_asc)"/);
}
assert.doesNotMatch(await readFile(new URL('../../src/lib/student-search-ui.js', import.meta.url), 'utf8'), /<option/);
evidence.inventory = 'Only grades.js and reports.js define student sort menus in the scoped entry points; shared student search has none.';
const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 5197, strictPort: true } });
try {
  await server.listen();
  const base = 'http://127.0.0.1:5197';
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: base, timeoutMs: 90000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    await openReadyServedDemo(page, base);
    await page.evaluate(async () => {
      const s = await import('/src/store.js'), yearId = s.activeYear().id, termId = s.activeTerm().id;
      await s.save({
        sections: [{ id: 'ds-sec', yearId, grade: 9, label: '1' }], subjects: [{ id: 'ds-sub', name: 'مادة الترتيب' }],
        teachings: [{ id: 'ds-t', sectionId: 'ds-sec', subjectId: 'ds-sub', termId }],
        students: [{ id: 'ds-a', name: 'أحمد ترتيب' }, { id: 'ds-b', name: 'بدر ترتيب' }],
        enrollments: [{ id: 'ds-ea', studentId: 'ds-a', sectionId: 'ds-sec', rollNo: 9, status: 'active' }, { id: 'ds-eb', studentId: 'ds-b', sectionId: 'ds-sec', rollNo: 1, status: 'active' }],
        items: [{ id: 'ds-i', teachingId: 'ds-t', name: 'اختبار', max: 10 }],
        scores: [{ id: 'ds-sa', studentId: 'ds-a', itemId: 'ds-i', value: 9 }, { id: 'ds-sb', studentId: 'ds-b', itemId: 'ds-i', value: 2 }],
        sessions: [{ id: 'ds-session', teachingId: 'ds-t', date: '2026-10-01', period: 1 }],
      });
      await s.fillAttendance('ds-session', 'present');
    });
    const records = () => page.evaluate(async () => {
      const s = await import('/src/store.js');
      return JSON.stringify([s.state.students, s.state.enrollments, s.state.scores, s.state.sessions, s.state.attendance]);
    });
    const before = await records();
    const select = () => page.locator('[data-change="sort"]');
    async function options(name, expected) {
      await select().waitFor();
      await expect.poll(() => select().locator('option').evaluateAll(els => els.map(el => el.value))).toEqual(expected);
      const actual = await select().locator('option').evaluateAll(els => els.map(el => ({ value: el.value, label: el.textContent })));
      assert.deepEqual(actual.map(o => o.value), expected, name);
      evidence.options.push({ name, actual });
    }
    const go = async suffix => { await page.goto(`${base}/#/teaching/ds-t/${suffix}`); await select().waitFor(); };
    await go('grades');
    await options('gradebook', ['default', 'score_desc', 'score_asc']);
    assert.notEqual(await select().evaluate(el => getComputedStyle(el).display), 'none');
    await select().selectOption('score_asc');
    await expect(page.locator('.grades-01c__direct-row').first()).toContainText('بدر ترتيب');
    await select().selectOption('default');
    await expect(page.locator('.grades-01c__direct-row').first()).toContainText('أحمد ترتيب');
    for (const value of ['name', 'roll']) {
      await page.evaluate(async value => (await import('/src/views/grades.js')).default.actions.sort({ value }), value);
      await expect(select()).toHaveValue('default');
    }
    await go('reports');
    for (const [tab, expected] of [
      ['roster', ['default']], ['grades', ['default', 'score_desc', 'score_asc']],
      ['attendance', ['default', 'absent_desc']], ['support', ['default', 'name', 'score_desc', 'score_asc', 'absent_desc']],
    ]) {
      await page.locator(`[data-act="tab"][data-tab="${tab}"]`).click();
      await expect(page.locator(`[data-act="tab"][data-tab="${tab}"]`)).toHaveClass(/is-on/);
      await options(`live-${tab}`, expected);
      for (const value of ['name', 'roll']) {
        await page.evaluate(async value => (await import('/src/views/reports.js')).default.actions.sort({ value }, null, { id: 'ds-t' }), value);
        await expect(select()).toHaveValue(tab === 'support' ? 'name' : 'default');
      }
    }
    await page.locator('[data-act="tab"][data-tab="support"]').click();
    await expect(page.locator('.support-report-screen .row').first()).toContainText('بدر ترتيب');
    await select().selectOption('name');
    await expect(page.locator('.support-report-screen .row').first()).toContainText('أحمد ترتيب');
    await select().selectOption('score_desc');
    await expect(page.locator('.support-report-screen .row').first()).toContainText('أحمد ترتيب');
    assert.equal(await records(), before, 'sort controls do not change records');
    evidence.actions.push('Actual gradebook and support handlers: default/name/legacy roll and grade orders; student/enrollment/grade/attendance records unchanged.');
    // Build a frozen historical fixture from the app, without server/close operations.
    await page.evaluate(async () => {
      const s = await import('/src/store.js');
      const termId = s.getTeaching('ds-t').termId;
      s.state.closedTermReports.push({ id: 'ds-closed', termId, version: 1, createdAt: 1, payload: s.buildClosedTermReportPayload(termId) });
    });
    await page.locator('[data-act="tab"][data-tab="roster"]').click();
    await options('historical-roster', ['default', 'name', 'roll']);
    await select().selectOption('roll');
    await expect(page.locator('.report-document tbody tr').first()).toContainText('بدر ترتيب');
    await select().selectOption('name');
    await expect(page.locator('.report-document tbody tr').first()).toContainText('أحمد ترتيب');
    evidence.actions.push('Frozen historical roll remains different from alphabetical and both handlers work.');
    // Local-only in-memory attendance fixture: a former member with saved number.
    await page.evaluate(async () => {
      const s = await import('/src/store.js');
      s.state.closedTermReports = s.state.closedTermReports.filter(r => r.id !== 'ds-closed');
      s.state.students.push({ id: 'ds-former', name: 'جابر سابق' });
      const snapshot = s.state.sessionRosterSnapshots.find(r => r.sessionId === 'ds-session');
      assertSnapshot(snapshot);
      function assertSnapshot(snapshot) { if (!snapshot) throw Error('Expected actual fillAttendance roster snapshot'); }
      snapshot.members.push({ studentId: 'ds-former', rollNo: 0 });
    });
    await page.locator('[data-act="tab"][data-tab="attendance"]').click();
    await options('live-attendance-with-former-saved-number', ['default', 'roll', 'absent_desc']);
    await select().selectOption('roll');
    await expect(page.locator('.report-document tbody tr').first()).toContainText('جابر سابق');
    evidence.actions.push('Attendance retains explicit saved-roll order only when it differs from the default.');
  });
  evidence.status = 'PASS';
  await writeFile(new URL('./evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PASS ${evidence.check}: actual app DOM/handlers/CSS on loopback; resources closed in finally.`);
} finally { await server.close(); }

