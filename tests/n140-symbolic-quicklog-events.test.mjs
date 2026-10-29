// AI-authored: actual application UI in an owned synthetic loopback phase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const taskFile = process.env.N140_BROWSER_TASK_FILE;
const runId = process.env.N140_BROWSER_RUN_ID;

test('N140 affected synthetic application checks', { skip: !taskFile || !runId }, async t => {
  const { withIsolatedLocalBrowser } = await import('file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs');
  const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 5140, strictPort: true }, logLevel: 'error' });
  try {
    await server.listen();
    await withIsolatedLocalBrowser({ taskFile, runId, url: 'http://127.0.0.1:5140', timeoutMs: 120000 }, async ({ createContext, url }) => {
      const context = await createContext({ viewport: { width: 320, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh', reducedMotion: 'reduce' });
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await openReadyServedDemo(page, url);
      const fixture = await page.evaluate(async () => {
        const s = await import('/src/store.js');
        const { todayISO, LOG_TAGS } = await import('/src/models.js');
        const teaching = s.teachings().find(c => s.students(c.id).length >= 3);
        const [a, b, c] = s.students(teaching.id);
        const date = todayISO();
        const logs = s.state.logs.filter(l => l.teachingId === teaching.id).map(l => ({ ...l, deleted: true }));
        const row = (id, studentId, delta, extra = {}) => ({ id, teachingId: teaching.id, studentId, kind: 'participation', delta, date, tag: '', updatedAt: 100, deleted: false, sessionId: null, ...extra });
        logs.push(row('n140-a-plus', a.id, 1), row('n140-a-minus', a.id, -1, { updatedAt: 101 }));
        for (let i = 0; i < 5; i++) logs.push(row(`n140-b-plus-${i}`, b.id, 1));
        logs.push(row('n140-b-minus', b.id, -1, { tag: LOG_TAGS.participation.down[0] }));
        // More recent hidden kinds, teaching, day and tombstone must never win Undo.
        logs.push(row('n140-behavior', a.id, -1, { kind: 'behavior', updatedAt: 500 }),
          row('n140-old', c.id, -1, { date: '2026-01-01', updatedAt: 600 }),
          row('n140-deleted', a.id, -1, { deleted: true, updatedAt: 700 }),
          row('n140-other', a.id, -1, { teachingId: s.teachings().find(x => x.id !== teaching.id).id, updatedAt: 800 }));
        assertSave(await s.save({ logs }));
        function assertSave(ok) { if (!ok) throw Error('Synthetic log seed failed'); }
        return { teaching: teaching.id, a: a.id, b: b.id, c: c.id, date, scores: JSON.stringify(s.state.scores), items: JSON.stringify(s.state.items) };
      });
      await page.goto(`${url}/#/teaching/${fixture.teaching}/quicklog`);
      await page.locator(`[id="ql-${fixture.a}"]`).waitFor();
      const card = id => page.locator(`[id="ql-${id}"]`);
      const counts = async (id, positive, negative) => {
        await expect(card(id).locator('.qlcard__positive')).toHaveText(`+${positive}`);
        await expect(card(id).locator('.qlcard__negative')).toHaveText(`−${negative}`);
      };
      await t.test('n140_positive_negative_indicators_separate_even_if_net_zero', async () => {
        await counts(fixture.a, 1, 1); // Net zero still retains both event counts.
        await counts(fixture.b, 5, 1);
        await expect(card(fixture.a).locator('[data-act="plus"]')).toHaveAccessibleDescription(/1 رصدات إيجابية.*1 رصدات سلبية.*آخر رصدة سلبية.*بلا سبب/);
        assert.match(await card(fixture.a).locator('.qlcard__incident').innerText(), new RegExp(`بلا سبب.*${fixture.date}`));
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 844 });
          const fit = await card(fixture.b).evaluate(el => {
            const box = el.getBoundingClientRect();
            const parts = [...el.querySelectorAll('.qlcard__counts, .qlcard__today, .qlcard__incident, .qlcard__name, .qlcard__minus')];
            return document.documentElement.dir === 'rtl' && document.documentElement.scrollWidth <= innerWidth && parts.every(part => {
              const r = part.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            });
          });
          assert.equal(fit, true, `${width}px RTL card content must fit`);
          if (process.env.N140_SCREENSHOT_DIR) {
            await mkdir(process.env.N140_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: `${process.env.N140_SCREENSHOT_DIR}/n140-${width}.png`, fullPage: true });
          }
        }
      });
      await t.test('n140_logged_today_filter_counts_events_not_net_and_undo_respects_kind', async () => {
        await page.locator('[data-status="logged"]').click();
        await expect(card(fixture.a)).toHaveCount(1);
        await expect(card(fixture.c)).toHaveCount(0);
        await page.locator('[data-status="unlogged"]').click();
        await expect(card(fixture.a)).toHaveCount(0);
        await expect(card(fixture.c)).toHaveCount(1);
        await page.locator('[data-status="all"]').click();
        await expect(page.locator('[data-status="all"]')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('[data-act="undo"]').click();
        await page.waitForFunction(async () => (await import('/src/store.js')).state.logs.find(l => l.id === 'n140-a-minus').deleted);
        const hidden = await page.evaluate(async () => (await import('/src/store.js')).state.logs.filter(l => ['n140-behavior', 'n140-old', 'n140-other'].includes(l.id)).map(l => l.deleted));
        assert.deepEqual(hidden, [false, false, false]);
        await page.locator('[data-kind="behavior"]').click();
        await counts(fixture.a, 0, 1);
        await page.locator('[data-act="undo"]').click();
        await page.waitForFunction(async () => (await import('/src/store.js')).state.logs.find(l => l.id === 'n140-behavior').deleted);
        await counts(fixture.a, 0, 0);
        assert.equal(await card(fixture.a).locator('.qlcard__incident').count(), 0);
      });
      await t.test('n140_teacher_only_readonly_ui_and_event_details_no_score_change', async () => {
        await expect(page.locator('.quicklog-page')).toContainText('لا يُخصم من الدرجات');
        await page.locator('[data-change="reason"]').check();
        await card(fixture.c).locator('[data-act="minus"]').click();
        await page.locator('[data-tag="إزعاج"]').click();
        await page.waitForFunction(async id => (await import('/src/store.js')).state.logs.some(l => l.studentId === id && l.kind === 'behavior' && l.tag === 'إزعاج'), fixture.c);
        await counts(fixture.c, 0, 1);
        await page.locator('[data-change="reason"]').uncheck();
        for (let i = 0; i < 5; i++) {
          await card(fixture.c).locator('[data-act="plus"]').click();
          await page.waitForFunction(({ id, count }) => document.querySelector(`#${CSS.escape(`ql-${id}`)} .qlcard__positive`)?.textContent === `+${count}`, { id: fixture.c, count: i + 1 });
        }
        await counts(fixture.c, 5, 1);
        assert.match(await card(fixture.c).locator('.qlcard__incident').innerText(), /إزعاج/);
        const unchanged = await page.evaluate(async () => { const s = await import('/src/store.js'); return { scores: JSON.stringify(s.state.scores), items: JSON.stringify(s.state.items), workspace: s.getActiveWorkspace().type }; });
        assert.deepEqual(unchanged, { scores: fixture.scores, items: fixture.items, workspace: 'demo' });
        assert.deepEqual(errors, []);
      });
    });
  } finally {
    await server.close();
  }
});
