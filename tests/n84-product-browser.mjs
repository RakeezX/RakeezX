// Run only while holding the card's browser lease. No hosted requests or data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = process.env.N84_BROWSER_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/n84-fixture') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/components.css"><body><main style="padding:12px;max-width:1000px;margin:auto" id="main"></main></body></html>');
      return;
    }
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root)) throw new Error('Invalid path');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(path)] ?? 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  for (const [name, browserType] of Object.entries({ chromium, webkit })) {
    browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function mount() {
      await page.goto(base + '/n84-fixture');
      await page.evaluate(async () => {
        const store = await import('/src/store.js');
        const db = await import('/src/lib/db.js');
        const models = await import('/src/models.js');
        const { createWorkspaceRegistry, resolveWorkspace } = await import('/src/lib/workspaces.js');
        const registry = createWorkspaceRegistry();
        const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        await registry.registerAccount(owner);
        const resolution = await resolveWorkspace({ type: 'account', authUserId: owner }, { registry });
        await registry.close();
        store.activateWorkspace(resolution.workspace);
        await store.init();
        if (!store.getTeaching('n84-t')) {
          const y = models.makeYear({ id: 'n84-y' });
          const term = models.makeTerm({ id: 'n84-term', yearId: y.id });
          const subject = models.makeSubject({ id: 'n84-subject' });
          const section = models.makeSection({ id: 'n84-section', yearId: y.id, grade: 4 });
          const teaching = models.makeTeaching({ id: 'n84-t', sectionId: section.id, termId: term.id, subjectId: subject.id });
          const students = ['n84-s', 'n84-other'].map((id, index) => models.makeStudent({ id, name: index ? 'طالب آخر' : 'عبدالرحمن أحمد محمد الطويل' }));
          await store.save({ years: [y], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students,
            enrollments: students.map((student, index) => models.makeEnrollment({ id: 'n84-e' + index, sectionId: section.id, studentId: student.id, rollNo: index + 1 })),
            items: [models.makeItem({ id: 'n84-p', teachingId: teaching.id, name: 'مشاركة', auto: 'participation', max: 10, perPoint: 2 }),
              models.makeItem({ id: 'n84-a', teachingId: teaching.id, name: 'حضور', auto: 'attendance' }),
              models.makeItem({ id: 'n84-m', teachingId: teaching.id, name: 'يدوي' })] });
          await store.setScore('n84-s', 'n84-m', 7);
        }
        const { default: grades } = await import('/src/views/grades.js');
        const { render, delegate } = await import('/src/lib/dom.js');
        const { setRepaint } = await import('/src/repaint.js');
        const main = document.getElementById('main');
        const params = { id: 'n84-t' };
        function paint() { render(main, grades.render(params)); grades.afterPaint?.(main, params); }
        grades.onMount();
        setRepaint(paint);
        store.subscribe((_state, update) => { if (update.render !== false) paint(); });
        // The production delegate and view action map, without account shell/Auth.
        delegate(main, () => Object.fromEntries(Object.entries(grades.actions).map(([key, action]) => [key, (el, event) => action(el, event, params)])));
        window.n84 = { store, db, models, grades, paint };
        paint();
      });
      await page.locator('[data-act="pick"][data-id="n84-p"]').click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.n84-step')).width === '44px');
    }
    await mount();
    const plus = '[data-act="n84-log"][data-student="n84-s"][data-delta="1"]';
    const minus = '[data-act="n84-log"][data-student="n84-s"][data-delta="-1"]';
    for (const width of [1200, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => {
          document.documentElement.setAttribute('data-theme', theme);
        }, theme);
        await page.waitForFunction(theme => getComputedStyle(document.body).color ===
          (theme === 'dark' ? 'rgb(238, 241, 245)' : 'rgb(21, 37, 61)'), theme);
        await page.evaluate(() => window.n84.paint());
        // Wait for the existing theme color transition before visual evidence.
        await page.waitForFunction(theme => getComputedStyle(document.querySelector('.n84-step')).color ===
          (theme === 'dark' ? 'rgb(163, 173, 186)' : 'rgb(51, 65, 85)'), theme);
        await page.waitForFunction(theme => getComputedStyle(document.querySelector('.n84-step svg')).stroke ===
          (theme === 'dark' ? 'rgb(163, 173, 186)' : 'rgb(51, 65, 85)'), theme);
        await page.waitForFunction(theme => getComputedStyle(document.querySelector('.graderow__name')).color ===
          (theme === 'dark' ? 'rgb(238, 241, 245)' : 'rgb(21, 37, 61)'), theme);
        const layout = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.grades-01c__direct-row')];
          return rows.map(row => {
            const r = row.getBoundingClientRect();
            const student = row.querySelector('.graderow__name').getBoundingClientRect();
            const score = row.querySelector('.graderow__auto').getBoundingClientRect();
            return { row: { left: r.left, right: r.right }, sameRow: student.top < score.bottom && score.top < student.bottom,
              controls: [...row.querySelectorAll('.n84-step')].map(button => { const b = button.getBoundingClientRect(); return { width: b.width, height: b.height, left: b.left, right: b.right }; }) };
          });
        });
        for (const row of layout) {
          assert.ok(row.sameRow, `${name}/${width}/${theme}: score in same row`);
          assert.ok(row.row.left >= 0 && row.row.right <= width, 'row within viewport');
          for (const button of row.controls) {
            assert.equal(button.width, 44); assert.equal(button.height, 44);
            assert.ok(button.left >= row.row.left && button.right <= row.row.right, 'reachable controls');
          }
        }
        if (evidence) await page.screenshot({ path: join(evidence, `${name}-${width}-${theme}.png`), fullPage: true });
      }
    }
    await page.locator(plus).click();
    await page.waitForFunction(() => window.n84.store.state.logs.length === 1 && window.n84.models.itemScore(window.n84.store.state.items.find(i => i.id === 'n84-p'), window.n84.store.teachingContext('n84-t').ctx['n84-s']) === 2);
    await page.locator(minus).click();
    await page.waitForFunction(() => window.n84.store.state.logs.length === 2 && !document.querySelector('.n84-step').disabled);
    await mount();
    const state = await page.evaluate(async () => {
      const { store, db, models } = window.n84;
      const ctx = store.teachingContext('n84-t').ctx['n84-s'];
      return { logs: await db.getAll('logs'), outbox: (await db.getAll('outbox')).filter(r => r.store === 'logs'),
        participation: models.itemScore(store.state.items.find(i => i.id === 'n84-p'), ctx),
        manual: models.itemScore(store.state.items.find(i => i.id === 'n84-m'), ctx), autoScores: store.state.scores.filter(s => s.itemId === 'n84-p') };
    });
    assert.equal(state.logs.length, 2); assert.equal(state.outbox.length, 2);
    assert.ok(state.logs.every(log => log.studentId === 'n84-s' && log.kind === 'participation'));
    assert.equal(state.participation, 0); assert.equal(state.manual, 7); assert.equal(state.autoScores.length, 0);
    await page.locator('[data-act="pick"][data-id="n84-a"]').click();
    assert.equal(await page.locator('[data-act="n84-log"]').count(), 0);
    await page.locator('[data-act="pick"][data-id="n84-m"]').click();
    assert.equal(await page.locator('[data-act="n84-log"]').count(), 0);
    await page.locator('[data-act="mode"][data-mode="table"]').click();
    assert.equal(await page.locator('[data-act="n84-log"]').count(), 4);
    assert.deepEqual(errors, []);
    console.log(`${name}: Product view/delegate/account fixture +/-/reload and 1200/390/320 RTL light/dark 44px single-row PASS; attendance/manual exclusion and table wiring PASS`);
    await context.close(); await browser.close(); browser = null;
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
