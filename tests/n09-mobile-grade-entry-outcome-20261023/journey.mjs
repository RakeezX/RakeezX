// AI-authored bounded actual-app journey. Run: node tests/n09-mobile-grade-entry-outcome-20261023/journey.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';

const output = new URL('./', import.meta.url);
const phase = process.env.N09_PHASE || 'before';
const result = { phase, widths: [], checks: [], errors: [] };
const server = await createServer({ server: { host: '127.0.0.1', port: 5299, strictPort: true }, logLevel: 'error' });
const base = 'http://127.0.0.1:5299';
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n09-mobile-grade-entry-outcome-20261023.json';
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId: 'bdffa863-f649-4ced-8d56-7ae3f32e6867', url: base, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 360, height: 800 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', e => result.errors.push(e.message));
    await openReadyServedDemo(page, base);
    let fixture = await page.evaluate(async () => (await import('/tests/n09-mobile-grade-entry-outcome-20261023/account.mjs')).account({ seed: true }));
    assert.equal(fixture.ready, true); assert.equal(fixture.lease.editable, true);
    const route = `${base}/#/teaching/${fixture.teaching}/grades`;
    const mode = name => page.locator(`[data-act="mode"][data-mode="${name}"]`);
    const pick = id => page.locator(`[data-act="pick"][data-id="${id}"]`);
    const repaintAction = async (locator, action) => {
      const old = await locator.elementHandle();
      await action(locator);
      await page.waitForFunction(el => !el.isConnected, old);
      await old.dispose();
    };
    const selectItem = async id => {
      if (await pick(id).getAttribute('aria-selected') !== 'true') await repaintAction(pick(id), el => el.click());
      await page.waitForFunction(id => document.querySelector(`[data-act="pick"][data-id="${id}"]`)?.getAttribute('aria-selected') === 'true', id);
    };
    const snapshot = () => page.evaluate(async () => {
      const s = await import('/src/store.js'), d = await import('/src/lib/db.js');
      return { owner: s.getActiveWorkspace().authUserId, database: s.getActiveWorkspace().databaseName,
        scores: await d.getAll('scores'), outbox: await d.getAll('outbox'), lease: s.getOfflineLeaseStatus() };
    });
    const saved = async (student, item, value) => {
      await page.waitForFunction(async ({ student, item, value }) => {
        const d = await import('/src/lib/db.js');
        return (await d.getAll('scores')).some(s => s.studentId === student && s.itemId === item && s.value === value && !s.deleted);
      }, { student, item, value });
    };
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 800 });
      await page.goto(route);
      await selectItem(fixture.items[1]);
      await repaintAction(page.locator('[data-change="sort"]'), el => el.selectOption('score_desc'));
      await repaintAction(page.locator('[data-change="sort"]'), el => el.selectOption('default'));
      await repaintAction(page.locator('[data-change="toggle-missing"]'), el => el.check());
      await repaintAction(page.locator('[data-change="toggle-missing"]'), el => el.uncheck());
      const first = page.locator('input.gradein').first();
      const student = await first.getAttribute('data-id'), item = fixture.items[1];
      await first.fill('0'); await first.press('Enter');
      await saved(student, item, 0);
      assert.equal(await page.locator('input.gradein').nth(1).evaluate(el => el === document.activeElement), true, 'Enter moves to next student without repaint focus jump');
      await first.fill('7'); await first.press('Tab'); await saved(student, item, 7);
      await first.fill(''); await first.press('Enter'); await saved(student, item, null);
      await first.fill('0'); await first.press('Enter'); await saved(student, item, 0);
      const blankInput = page.locator('input.gradein').nth(1);
      const blankStudent = await blankInput.getAttribute('data-id');
      assert.notEqual(blankStudent, student, 'zero and blank belong to different students');
      await blankInput.fill(''); await blankInput.press('Enter'); await saved(blankStudent, item, null);
      await repaintAction(mode('table'), el => el.click());
      const tableInput = page.locator(`.gtable input[data-id="${student}"][data-item="${item}"]`);
      assert.equal(Number(await tableInput.inputValue()), 0);
      await tableInput.fill('5'); await tableInput.press('Enter'); await saved(student, item, 5);
      const expectedNext = await tableInput.evaluate(el => {
        const inputs = [...el.closest('table').querySelectorAll('input.gradein')];
        return inputs[inputs.indexOf(el) + 1]?.dataset.fk;
      });
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.fk), expectedNext);
      await tableInput.fill('0'); await tableInput.press('Tab'); await saved(student, item, 0);
      const geometry = await page.evaluate(() => {
        const wrap = document.querySelector('.tablewrap'), sticky = document.querySelector('tbody .gtable__sticky');
        return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
          wrapWidth: wrap.clientWidth, tableWidth: wrap.scrollWidth, stickyWidth: sticky.getBoundingClientRect().width,
          direction: getComputedStyle(document.querySelector('.gtable')).direction,
          inputFont: getComputedStyle(document.querySelector('.gtable input')).fontSize };
      });
      result.widths.push({ width, geometry });
      assert.ok(geometry.documentWidth <= width + 1, 'wide table scroll remains internal');
      assert.equal(geometry.direction, 'rtl'); assert.ok(parseFloat(geometry.inputFont) >= 16);
      // Focus every manual column, including the far edge, and test actual hit reachability.
      for (const input of await page.locator('.gtable tbody tr').first().locator('input.gradein').all()) {
        await input.focus();
        const visible = await input.evaluate(el => {
          const r = el.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { hit: at === el, rect: { x: r.x, right: r.right }, focus: el === document.activeElement };
        });
        assert.equal(visible.hit, true, `${width}px focused table field must not be hidden behind sticky student column: ${JSON.stringify(visible)}`);
        assert.equal(visible.focus, true);
      }
      await page.screenshot({ path: new URL(`${phase}-${width}-table.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
      await repaintAction(mode('item'), el => el.click()); await selectItem(item);
      await page.locator('html').evaluate(el => el.style.fontSize = '125%');
      await page.locator('input.gradein').first().click();
      assert.equal(await page.locator('input.gradein').first().evaluate(el => el === document.activeElement), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'enlarged text stays within page');
      await page.screenshot({ path: new URL(`${phase}-${width}-enlarged.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
      await page.locator('html').evaluate(el => el.style.fontSize = '');
      await page.goto(`${base}/#/teaching/${fixture.teaching}`); await page.goto(route); await selectItem(item);
      assert.equal(Number(await page.locator(`input.gradein[data-id="${student}"]`).inputValue()), 0);
      // Auth boot/service restoration is outside this synthetic local entry check.
      // Remove only this fabricated session, then reopen the same account DB below.
      await page.evaluate(async () => localStorage.removeItem((await import('/src/lib/cloud.js')).AUTH_STORAGE_KEY));
      await page.reload(); await openReadyServedDemo(page, base);
      // Reopen the same fabricated account DB, never reseed or copy saved values.
      const restored = await page.evaluate(async () => (await import('/tests/n09-mobile-grade-entry-outcome-20261023/account.mjs')).account());
      assert.equal(restored.database, fixture.database); assert.equal(restored.owner, fixture.owner);
      const restoredCheckpoint = await snapshot();
      result.widths.at(-1).restoredCheckpoint = { owner: restoredCheckpoint.owner, database: restoredCheckpoint.database,
        zero: restoredCheckpoint.scores.find(s => s.studentId === student && s.itemId === item)?.value,
        blank: restoredCheckpoint.scores.find(s => s.studentId === blankStudent && s.itemId === item)?.value };
      assert.equal(result.widths.at(-1).restoredCheckpoint.zero, 0);
      assert.equal(result.widths.at(-1).restoredCheckpoint.blank, null);
      await page.goto(route); await selectItem(item);
      assert.equal(Number(await page.locator(`input.gradein[data-id="${student}"]`).inputValue()), 0);
      assert.equal(await page.locator(`input.gradein[data-id="${blankStudent}"]`).inputValue(), '');
      const checkpoint = await snapshot();
      assert.equal(checkpoint.owner, fixture.owner); assert.equal(checkpoint.database, fixture.database);
      assert.ok(checkpoint.outbox.length > 0 && checkpoint.outbox.every(r => r.ownerId === fixture.owner));
      assert.equal(checkpoint.lease.editable, true);
      result.widths.at(-1).persistence = { owner: checkpoint.owner, database: checkpoint.database, durableOwnedCommands: checkpoint.outbox.length, zero: true, blank: true, reopen: true, reload: true };
    }
    assert.deepEqual(result.errors, []);
    result.checks = ['n09_grade_mobile_actual_journey', 'n09_grade_focus_values_and_reopen', 'n09_grade_desktop_rtl_semantics'].map(name => ({ name, status: 'PASS' }));
  });
} catch (e) { result.failure = e.stack; process.exitCode = 1; }
finally {
  await server.close();
  result.cleanup = { ownedServerClosed: true, isolatedBrowserFinally: true };
  await mkdir(output, { recursive: true });
  await writeFile(new URL(`${phase}.json`, output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
