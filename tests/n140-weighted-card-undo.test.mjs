// AI-authored: three focused checks against real app modules, DOM, handlers and CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';

const taskFile = process.env.N140_BROWSER_TASK_FILE;
const runId = process.env.N140_BROWSER_RUN_ID;
if (!taskFile || !runId) throw Error('Active N140 taskFile/runId required; checks must not silently skip');

test('N140 bounded synthetic application checks', async t => {
  const { withIsolatedLocalBrowser } = await import('file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs');
  const service = syntheticService();
  const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error',
    server: { host: '127.0.0.1', port: 5141, strictPort: true },
    plugins: [{ name: 'n140-existing-synthetic-account', configureServer(vite) {
      vite.middlewares.use('/__n73', async (req, res) => {
        try {
          let body = ''; for await (const part of req) body += part;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(await service.request(req.url.slice(1), JSON.parse(body || '{}'))));
        } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ message: error.message })); }
      });
    } }],
  });
  try {
    await server.listen();
    await withIsolatedLocalBrowser({ taskFile, runId, url: 'http://127.0.0.1:5141', timeoutMs: 120000 }, async ({ createContext, url }) => {
      const context = await createContext({ viewport: { width: 320, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh', reducedMotion: 'reduce' });
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await openReadyServedDemo(page, url);
      const fixture = await page.evaluate(async () => {
        const s = await import('/src/store.js'), m = await import('/src/models.js');
        const teaching = s.teachings().find(c => s.students(c.id).length >= 4);
        const [a, b, c, d] = s.students(teaching.id);
        const item = s.items(teaching.id).find(i => i.auto === 'participation');
        Object.assign(item, { perPoint: 1, max: 10, portabilityGroupId: 'n140-compatible' });
        const section = s.getSection(teaching.sectionId);
        s.state.sections.push({ ...section, id: 'n140-prior-section' });
        s.state.teachings.push({ ...teaching, id: 'n140-prior-teaching', sectionId: 'n140-prior-section' });
        s.state.items.push({ ...item, id: 'n140-prior-item', teachingId: 'n140-prior-teaching' });
        s.state.enrollments.push({ id: 'n140-transfer', studentId: c.id, sectionId: 'n140-prior-section', status: 'transferred', deleted: false });
        const date = m.todayISO();
        const row = (id, studentId, delta, extra = {}) => ({ id, studentId, teachingId: teaching.id, date,
          delta, kind: 'participation', tag: '', sessionId: null, deleted: false, updatedAt: 100, ...extra });
        const logs = [row('n140-a1', a.id, 1), row('n140-a2', a.id, 1), row('n140-a3', a.id, -1), row('n140-a4', a.id, -1, { updatedAt: 110 }),
          row('n140-b1', b.id, 2), row('n140-b2', b.id, 1), row('n140-b3', b.id, -1), row('n140-b4', b.id, -1),
          row('n140-c1', c.id, 1), row('n140-carry', c.id, 2, { teachingId: 'n140-prior-teaching' }),
          row('n140-unlinked', c.id, 50, { teachingId: 'n140-unlinked-teaching' }),
          row('n140-tombstone', c.id, 50, { deleted: true, updatedAt: 900 }),
          row('n140-kind', a.id, -5, { kind: 'behavior', updatedAt: 1000 }),
          row('n140-old', d.id, 1, { date: '2020-01-01', updatedAt: 2000 }),
          row('n140-other-student', c.id, 1, { updatedAt: 3000 })];
        s.state.logs = [];
        if (!await s.save({ logs })) throw Error('Synthetic fixture failed');
        // Duplicate same ID is deliberately injected into the read projection, never persisted twice.
        s.state.logs.push({ ...s.state.logs.find(l => l.id === 'n140-carry') });
        return { teaching: teaching.id, a: a.id, b: b.id, c: c.id, d: d.id, item: item.id };
      });
      await page.evaluate(id => { location.hash = `/teaching/${id}/quicklog`; }, fixture.teaching);
      const card = id => page.locator(`[id="ql-${id}"]`);
      const counts = async (id, positive, negative) => {
        await expect(card(id).locator('.qlcard__positive')).toHaveText(`+${positive}`);
        await expect(card(id).locator('.qlcard__negative')).toHaveText(`−${negative}`);
      };

      await t.test('n140_weighted_points_match_participation_item_for_same_eligible_logs', async () => {
        await counts(fixture.a, 2, 2);
        await counts(fixture.b, 3, 2); // Four rows, net 1: old +2/-2 badges were misleading.
        await counts(fixture.c, 4, 0); // Compatible transfer included once; unlinked/deleted excluded.
        await expect(card(fixture.a).locator('.qlcard__factor')).toContainText('0/10');
        await expect(card(fixture.b).locator('.qlcard__factor')).toContainText('1/10');
        const projection = await page.evaluate(async f => {
          const s = await import('/src/store.js'), m = await import('/src/models.js');
          const { items, ctx, roster } = s.teachingContext(f.teaching);
          const item = items.find(i => i.id === f.item);
          const scores = [f.a, f.b, f.c].map(id => m.itemScore(item, ctx[id]));
          const checks = roster.every(student => {
            const p = m.participationPointProjection(item, ctx[student.id]);
            return p.score === m.itemScore(item, ctx[student.id]);
          });
          const nullCtx = { automaticByItem: { [item.id]: { logs: [], classHasParticipation: false } } };
          const zeroCtx = { automaticByItem: { [item.id]: { logs: [], classHasParticipation: true } } };
          const unavailable = m.participationPointProjection(item, { automaticByItem: { [item.id]: null } });
          item.perPoint = 2;
          (await import('/src/repaint.js')).repaint();
          return { scores, checks, empty: m.itemScore(item, nullCtx), zero: m.itemScore(item, zeroCtx), unavailable };
        }, fixture);
        assert.deepEqual(projection.scores, [0, 1, 4]);
        assert.equal(projection.checks, true);
        assert.equal(projection.empty, null); assert.equal(projection.zero, 0);
        assert.equal(projection.unavailable.positive, null); assert.equal(projection.unavailable.score, null);
        await expect(card(fixture.b).locator('.qlcard__factor')).toContainText('×2');
        await expect(card(fixture.b).locator('.qlcard__factor')).toContainText('2/10');
        // Mismatched transferred-item configuration is uncertain, never guessed as zero.
        await expect(card(fixture.c).locator('.qlcard__positive')).toHaveText('—');
        await expect(card(fixture.c).locator('.qlcard__factor')).toContainText('—/10');
        await page.evaluate(async () => {
          const s = await import('/src/store.js'); s.state.items.find(i => i.id === 'n140-prior-item').perPoint = 2;
          (await import('/src/repaint.js')).repaint();
        });
        await counts(fixture.c, 4, 0);
        await expect(page.locator('.topbar [data-act="undo"]')).toHaveCount(0);
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 844 });
          const geometry = await card(fixture.b).evaluate(el => {
            const box = el.getBoundingClientRect();
            const inside = [...el.querySelectorAll('.qlcard__name, .qlcard__counts, .qlcard__undo, .qlcard__minus, .qlcard__factor')].every(part => {
              const r = part.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
            });
            const name = el.querySelector('.qlcard__name').getBoundingClientRect(), undo = el.querySelector('.qlcard__undo').getBoundingClientRect(), minus = el.querySelector('.qlcard__minus').getBoundingClientRect();
            return { inside, undoClear: undo.top >= name.bottom, minusClear: name.top >= minus.bottom, nameTop: name.top, minusBottom: minus.bottom, rtl: document.documentElement.dir === 'rtl', viewportFit: document.documentElement.scrollWidth <= innerWidth };
          });
          assert.ok(geometry.inside && geometry.undoClear && geometry.minusClear && geometry.rtl && geometry.viewportFit, `${width}px actual source CSS must fit: ${JSON.stringify(geometry)}`);
        }
      });

      await t.test('n140_student_card_undo_only_own_latest_event_no_compensating_log', async () => {
        const before = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state.logs));
        await expect(card(fixture.d).locator('[data-act="undo"]')).toBeDisabled();
        // Hold the real IndexedDB transaction to exercise a second handler call before completion.
        await page.evaluate(async f => {
          const db = await import('/src/lib/db.js');
          const connection = await db.openDB();
          const tx = connection.transaction(['logs', 'outbox'], 'readwrite');
          let holding = true;
          const spin = () => { if (holding) tx.objectStore('logs').get('n140-a4').onsuccess = spin; };
          spin();
          const view = (await import('/src/views/quicklog.js')).default;
          const el = document.querySelector(`[id="ql-${f.a}"] [data-act="undo"]`);
          const first = view.actions.undo(el, null, { id: f.teaching });
          await view.actions.undo(el, null, { id: f.teaching });
          holding = false;
          await first;
        }, fixture);
        await counts(fixture.a, 2, 1);
        let after = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state.logs));
        const changed = JSON.parse(after).filter((l, i) => JSON.stringify(l) !== JSON.stringify(JSON.parse(before)[i]));
        assert.equal(changed.length, 1); assert.equal(changed[0].id, 'n140-a4'); assert.equal(changed[0].deleted, true);
        assert.equal(JSON.parse(after).length, JSON.parse(before).length);
        await card(fixture.a).locator('[data-act="undo"]').dblclick(); // A double tap must undo only one minus.
        await counts(fixture.a, 2, 0);
        await card(fixture.a).locator('[data-act="undo"]').click(); // Plus is actionable too.
        await counts(fixture.a, 1, 0);
        await page.locator('[data-kind="behavior"]').click();
        await counts(fixture.a, 0, 5);
        await card(fixture.a).locator('[data-act="undo"]').click();
        await counts(fixture.a, 0, 0);
        await expect(card(fixture.a).locator('[data-act="undo"]')).toBeDisabled();
        await expect(page.locator('.quicklog-page')).toContainText('لا يُخصم من الدرجات');
        await page.locator('[data-kind="participation"]').click();
        await counts(fixture.a, 1, 0);
      });

      await t.test('n140_preserve_owner_scoring_history_and_sync_tombstone', async () => {
        await page.evaluate(async () => { await (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount(); });
        const account = await page.evaluate(async () => {
          const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), m = await import('/src/models.js');
          const f = await import('/tests/n73-account-flow-fixture.mjs');
          const teaching = s.getTeaching(f.source), student = s.state.students[0];
          const enrollment = { id: 'n140-account-enrollment', studentId: student.id, sectionId: teaching.sectionId, status: 'active', deleted: false, ownerId: f.owner, updatedAt: 1 };
          const row = { id: 'n140-account-log', studentId: student.id, teachingId: teaching.id, date: m.todayISO(), delta: -1, kind: 'participation', tag: '', deleted: false, ownerId: f.owner, serverRevision: 1, updatedAt: 100 };
          await db.put('enrollments', enrollment); s.state.enrollments = [enrollment];
          await db.put('logs', row); s.state.logs = [row];
          const snapshot = async () => JSON.stringify(await Promise.all(['scores', 'items', 'closedTermReports'].map(name => db.getAll(name))));
          return { teaching: teaching.id, student: student.id, snapshot: await snapshot() };
        });
        await page.evaluate(id => { location.hash = `/teaching/${id}/quicklog`; }, account.teaching);
        await card(account.student).locator('[data-act="undo"]').click();
        await expect(card(account.student).locator('[data-act="undo"]')).toBeDisabled();
        const tombstone = await page.evaluate(async () => {
          const db = await import('/src/lib/db.js'), s = await import('/src/store.js');
          const row = await db.get('logs', 'n140-account-log');
          const entries = (await db.getAll('outbox')).filter(e => e.store === 'logs');
          return { deleted: row.deleted, count: (await db.getAll('logs')).length, entries, owner: s.getActiveWorkspace().authUserId,
            snapshot: JSON.stringify(await Promise.all(['scores', 'items', 'closedTermReports'].map(name => db.getAll(name)))) };
        });
        assert.equal(tombstone.deleted, true); assert.equal(tombstone.count, 1);
        assert.equal(tombstone.entries.length, 1); assert.equal(tombstone.entries[0].op, 'delete');
        assert.equal(tombstone.entries[0].ownerId, tombstone.owner); assert.equal(tombstone.snapshot, account.snapshot);
        // A missing durable row makes patch return null: rollback, truthful failure and retry enabled.
        await page.evaluate(async () => {
          const s = await import('/src/store.js');
          s.state.logs.push({ ...s.state.logs[0], id: 'n140-missing', deleted: false, updatedAt: 150 });
          (await import('/src/repaint.js')).repaint();
        });
        await card(account.student).locator('[data-act="undo"]').click();
        await expect(page.locator('#toast')).toContainText('تعذّر التراجع');
        await expect(card(account.student).locator('[data-act="undo"]')).toBeEnabled();
        assert.equal(await page.evaluate(async () => (await import('/src/store.js')).state.logs.find(l => l.id === 'n140-missing').deleted), false);
        assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).filter(e => e.store === 'logs').length), 1);
        // Simulated account mismatch exercises the real mounted UI → store.patch lease/owner guard.
        await page.evaluate(async () => {
          const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), cloud = await import('/src/lib/cloud.js');
          const row = { ...s.state.logs[0], id: 'n140-denied', deleted: false, updatedAt: 200 };
          await db.put('logs', row); s.state.logs.push(row);
          cloud.setMockAuth({ id: 'b7300000-0000-4000-8000-000000000002' }, { access_token: 'synthetic', user: { id: 'b7300000-0000-4000-8000-000000000002' } });
          (await import('/src/repaint.js')).repaint();
        });
        // Call the same real UI action if the app appropriately removes the card after owner mismatch.
        await page.evaluate(async f => {
          const view = (await import('/src/views/quicklog.js')).default;
          const el = document.createElement('button'); el.dataset.id = f.student;
          await view.actions.undo(el, null, { id: f.teaching });
        }, account);
        await expect(page.locator('#toast')).toContainText('تعذّر التراجع');
        const denied = await page.evaluate(async () => {
          const db = await import('/src/lib/db.js');
          return { row: await db.get('logs', 'n140-denied'), count: (await db.getAll('outbox')).filter(e => e.store === 'logs').length };
        });
        assert.equal(denied.row.deleted, false); assert.equal(denied.count, 1);
        assert.deepEqual(errors, []);
      });
    });
  } finally { await server.close(); }
});
