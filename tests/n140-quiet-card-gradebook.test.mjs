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
const checkNames = ['n140_quiet_card_clickable_signed_totals_and_student_undo', 'n140_reason_icon_choices_both_kinds_and_gradebook_parity', 'n140_alphabetical_roster_numbers_owner_scoring_and_offline'];
if (process.env.N140_FOCUS && !checkNames.includes(process.env.N140_FOCUS)) throw Error('Unknown focused N140 check');

test('N140 bounded synthetic application checks', async t => {
  const check = async (name, fn) => { if (!process.env.N140_FOCUS || process.env.N140_FOCUS === name) await t.test(name, fn); };
  const { withIsolatedLocalBrowser } = await import('file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs');
  const service = syntheticService();
  const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error',
    server: { host: '127.0.0.1', port: 5143, strictPort: true },
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
    await withIsolatedLocalBrowser({ taskFile, runId, url: 'http://127.0.0.1:5143', timeoutMs: 120000 }, async ({ createContext, url }) => {
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

      await check('n140_quiet_card_clickable_signed_totals_and_student_undo', async () => {
        await counts(fixture.a, 2, 2);
        await counts(fixture.b, 3, 2);
        await counts(fixture.c, 4, 0);
        await expect(card(fixture.a).locator('button')).toHaveCount(3);
        await expect(card(fixture.a).locator('button button, .qlcard__hit, .qlcard__minus')).toHaveCount(0);
        await expect(card(fixture.a).locator('.qlcard__factor')).toHaveCount(0);
        const logCount = () => page.evaluate(async () => (await import('/src/store.js')).state.logs.length);
        const before = await logCount();
        await card(fixture.a).locator('.qlcard__name').click();
        assert.equal(await logCount(), before);
        await card(fixture.a).locator('.qlcard__positive').click();
        await counts(fixture.a, 3, 2);
        assert.equal(await logCount(), before + 1);
        await card(fixture.a).locator('.qlcard__negative').click();
        await counts(fixture.a, 3, 3);
        await card(fixture.a).locator('[data-act="undo"]').dblclick();
        await counts(fixture.a, 3, 2);
        assert.equal(await logCount(), before + 2);
        await expect(card(fixture.d).locator('[data-act="undo"]')).toBeDisabled();
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 844 });
          const geometry = await card(fixture.b).evaluate(el => {
            const box = el.getBoundingClientRect();
            const parts = [...el.querySelectorAll('.qlcard__name, .qlcard__note, button')];
            const inside = parts.every(part => { const r = part.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom; });
            const buttons = [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect());
            return { inside, targets: buttons.every(r => r.width >= 44 && r.height >= 44), separate: buttons.every((r,i) => buttons.every((q,j) => i === j || r.right <= q.left || q.right <= r.left)), rtl: document.documentElement.dir === 'rtl', fit: document.documentElement.scrollWidth <= innerWidth };
          });
          assert.ok(Object.values(geometry).every(Boolean), `${width}px: ${JSON.stringify(geometry)}`);
          const plus = card(fixture.b).locator('.qlcard__positive');
          await plus.focus(); await expect(plus).toBeFocused();
          await page.keyboard.press('Enter'); await counts(fixture.b, width === 320 ? 4 : 5, 2);
          await expect(plus).toBeFocused();
          await page.keyboard.press('Tab'); await expect(card(fixture.b).locator('.qlcard__negative')).toBeFocused();
          await page.keyboard.press('Tab'); await expect(card(fixture.b).locator('.qlcard__undo')).toBeFocused();
        }
      });

      await check('n140_reason_icon_choices_both_kinds_and_gradebook_parity', async () => {
        for (const kind of ['participation', 'behavior']) {
          await page.locator(`[data-act="kind"][data-kind="${kind}"]`).click();
          await page.locator('[data-change="reason"]').check();
          for (const delta of [1, -1]) {
            const selector = delta > 0 ? '.qlcard__positive' : '.qlcard__negative';
            await card(fixture.b).locator(selector).click();
            const dialog = page.getByRole('dialog');
            const choices = dialog.locator('.tag-pick');
            assert.ok(await choices.count() >= (delta > 0 ? 7 : 8));
            assert.equal(await choices.locator('[aria-hidden="true"]').count(), await choices.count());
            await expect(dialog.locator('#tag-go')).toHaveText(kind === 'participation' ? (delta > 0 ? 'رصد عام' : 'خصم عام') : (delta > 0 ? 'سجل سلوك إيجابي عام' : 'سجل سلوك سلبي عام'));
            const chosen = await choices.last().getAttribute('data-tag');
            await choices.last().click();
            await expect(dialog).toHaveCount(0);
            await expect.poll(() => page.evaluate(async ({id,kind,delta,tag}) => (await import('/src/store.js')).state.logs.some(l => l.studentId === id && l.kind === kind && l.delta === delta && l.tag === tag), {id: fixture.b, kind, delta, tag: chosen})).toBe(true);
          }
        }
        await page.evaluate(id => { location.hash = `/teaching/${id}/grades`; }, fixture.teaching);
        await page.locator(`[data-act="pick"][data-id="${fixture.item}"]`).click();
        const group = () => page.locator(`.ql-controls:has([data-student="${fixture.b}"])`);
        await expect(group().locator('button')).toHaveCount(3);
        const before = await page.evaluate(async f => {
          const s = await import('/src/store.js'), m = await import('/src/models.js');
          const {ctx,items} = s.teachingContext(f.teaching), i=items.find(i=>i.id===f.item);
          return {points:m.participationPointProjection(i,ctx[f.b]), count:s.state.logs.length};
        }, fixture);
        await expect(group().locator('.qlcard__positive')).toHaveText(`+${before.points.positive}`);
        await page.locator('[data-change="inline-reason"]').check();
        await group().locator('.qlcard__negative').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.locator('#tag-go')).toHaveText('خصم عام');
        await dialog.locator('[data-tag="لم يشارك"]').click();
        await expect(group().locator('.qlcard__negative')).toHaveText(`−${before.points.negative+1}`);
        await group().locator('.qlcard__undo').click();
        await expect(group().locator('.qlcard__negative')).toHaveText(`−${before.points.negative}`);
        const disposition = await page.evaluate(async f => {
          const s=await import('/src/store.js'); const log=s.state.logs.filter(l=>l.studentId===f.b && l.tag==='لم يشارك').at(-1);
          return {tag:log.tag, deleted:log.deleted, count:s.state.logs.length};
        },fixture);
        assert.deepEqual(disposition,{tag:'لم يشارك',deleted:true,count:before.count+1});
        // Pending picker must not write after a selected-item change.
        await group().locator('.qlcard__positive').click();
        const otherItem = await page.evaluate(async f => (await import('/src/store.js')).items(f.teaching).find(i=>i.id!==f.item).id,fixture);
        await page.evaluate(async id => { const v=(await import('/src/views/grades.js')).default; v.actions.pick({dataset:{id}}); },otherItem);
        await page.getByRole('dialog').locator('#tag-go').click();
        assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).state.logs.length),before.count+1);
        await expect(page.locator('.ql-controls')).toHaveCount(0);
        // Same real controls at both narrow widths, including the score badge.
        await page.locator(`[data-act="pick"][data-id="${fixture.item}"]`).click();
        for (const width of [320,390]) {
          await page.setViewportSize({width,height:844});
          assert.ok(await group().evaluate(el => { const row=el.closest('.graderow'),box=row.getBoundingClientRect();return [...row.querySelectorAll('button,.badge,.graderow__name')].every(p=>{const r=p.getBoundingClientRect();return r.left>=box.left && r.right<=box.right;}) && document.documentElement.scrollWidth<=innerWidth; }), `gradebook ${width}px fits`);
        }
        await page.evaluate(id => { location.hash = `/teaching/${id}/quicklog`; }, fixture.teaching);
        await expect(card(fixture.b)).toBeVisible();
        await page.locator('[data-change="reason"]').check();
        await card(fixture.b).locator('.qlcard__positive').click();
        // Date-bound control captured before midnight cannot save after its day changes.
        await page.evaluate(id => { document.querySelector(`[id="ql-${id}"] .qlcard__positive`).dataset.day='2020-01-01'; },fixture.b);
        await page.getByRole('dialog').locator('#tag-go').click();
        assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).state.logs.length),before.count+1);
      });

      await check('n140_alphabetical_roster_numbers_owner_scoring_and_offline', async () => {
        await expect(card(fixture.b)).toBeVisible();
        const integrity = await page.evaluate(async f => {
          const s=await import('/src/store.js'),m=await import('/src/models.js');
          const {roster,items,ctx}=s.teachingContext(f.teaching),item=items.find(i=>i.id===f.item);
          const original=roster.map(s=>({id:s.id,rollNo:s.rollNo}));
          const displayed=m.displayRoster(roster);
          const numbering=displayed.every(student=>document.querySelector(`[id="ql-${student.id}"] .qlcard__roll`).textContent===String(student.displayNo));
          const oldTags = ['إجابة صحيحة','مشاركة فعّالة','سؤال جيد','ساعد زميله','أنجز التدريب','لم يشارك','لم يحضر الأدوات','التزام ممتاز','تعاون','محافظة على الجهاز','نظام ونظافة','إزعاج','عبث بالجهاز','تأخر عن العمل','مقاطعة'];
          const tags=Object.values(m.LOG_TAGS).flatMap(k=>[...k.up,...k.down]);
          const projections=roster.every(student=>m.participationPointProjection(item,ctx[student.id]).score===m.itemScore(item,ctx[student.id]));
          item.perPoint=2; (await import('/src/repaint.js')).repaint();
          return {numbering,unchanged:JSON.stringify(original)===JSON.stringify(roster.map(s=>({id:s.id,rollNo:s.rollNo}))),oldTags:oldTags.every(tag=>tags.includes(tag)),projections};
        },fixture);
        assert.ok(Object.values(integrity).every(Boolean));
        await expect(card(fixture.b).locator('.qlcard__factor')).toHaveText('كل نقطة = 2 درجة');
        const fs=await import('node:fs/promises');
        const shell=await fs.readFile('sw.js','utf8');
        assert.equal(shell.split("'./src/lib/quicklog-reason-sheet.js'").length-1,1);
        for (const path of ['quicklog','grades']) {
          const source=await fs.readFile(`src/views/${path}.js`,'utf8');
          assert.ok(source.includes("../lib/quicklog-reason-sheet.js"));
        }
        await page.evaluate(async () => { await (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount(); });
        const account = await page.evaluate(async () => {
          const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), m = await import('/src/models.js');
          const f = await import('/tests/n73-account-flow-fixture.mjs');
          const teaching = s.getTeaching(f.source), student = s.state.students[0];
          const enrollment = { id: 'n140-account-enrollment', studentId: student.id, sectionId: teaching.sectionId, status: 'active', deleted: false, ownerId: f.owner, updatedAt: 1 };
          const row = { id: 'n140-account-log', studentId: student.id, teachingId: teaching.id, date: m.todayISO(), delta: -1, kind: 'participation', tag: '', deleted: false, ownerId: f.owner, serverRevision: 1, updatedAt: 100 };
          await db.put('enrollments', enrollment); s.state.enrollments = [enrollment];
          await db.put('logs', row); s.state.logs = [row];
          const participation = { ...m.makeItem({ id: 'n140-account-participation', teachingId: teaching.id, name: 'مشاركة اصطناعية', auto: 'participation', max: 10, perPoint: 1 }), ownerId: f.owner };
          await db.put('items', participation); s.state.items.push(participation);
          const snapshot = async () => JSON.stringify(await Promise.all(['scores', 'items', 'closedTermReports'].map(name => db.getAll(name))));
          return { teaching: teaching.id, student: student.id, item: participation.id, snapshot: await snapshot() };
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
        // The affected account gradebook entry must use the actual owner command guard too.
        await page.evaluate(id => { location.hash = `/teaching/${id}/grades`; },account.teaching);
        await page.locator(`[data-act="pick"][data-id="${account.item}"]`).click();
        const accountGroup=page.locator(`.ql-controls:has([data-student="${account.student}"])`);
        await accountGroup.locator('.qlcard__positive').click();
        await expect(accountGroup.locator('.qlcard__positive')).toHaveText('+1');
        const savedAccount=await page.evaluate(async f=>{
          const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),m=await import('/src/models.js');
          const row=s.state.logs.find(l=>!l.deleted && l.studentId===f.student),durable=await db.get('logs',row.id);
          const {ctx,items}=s.teachingContext(f.teaching);
          return {id:row.id,delta:durable.delta,owner:durable.ownerId,score:m.itemScore(items.find(i=>i.id===f.item),ctx[f.student]),entries:(await db.getAll('outbox')).filter(e=>e.store==='logs'),snapshot:JSON.stringify(await Promise.all(['scores','items','closedTermReports'].map(name=>db.getAll(name))))};
        },account);
        assert.equal(savedAccount.delta,1);assert.equal(savedAccount.score,1);
        assert.equal(savedAccount.entries.length,2);assert.ok(savedAccount.entries.every(e=>e.ownerId===tombstone.owner));
        assert.equal(savedAccount.snapshot,account.snapshot);
        await accountGroup.locator('.qlcard__undo').click();
        await expect(accountGroup.locator('.qlcard__positive')).toHaveText('+0');
        assert.equal(await page.evaluate(async id=>(await (await import('/src/lib/db.js')).get('logs',id)).deleted,savedAccount.id),true);
        // A stale workspace control is a no-op through the actual Gradebook entry.
        await page.evaluate(async f=>{
          const el=document.querySelector(`[data-act="n84-log"][data-student="${f.student}"]`);
          el.dataset.workspace='stale-workspace';
          await (await import('/src/views/grades.js')).recordInlineQuickLog(el,null,{id:f.teaching});
        },account);
        assert.equal(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('logs')).length),2);
        // Other auto items expose no controls and cannot be written through a forged participation entry.
        await page.evaluate(async f=>{
          const s=await import('/src/store.js'),item=s.state.items.find(i=>i.id===f.item);
          const el=document.querySelector(`[data-act="n84-log"][data-student="${f.student}"]`);
          el.dataset.workspace=s.getActiveWorkspace().id;
          item.auto='attendance';
          await (await import('/src/views/grades.js')).recordInlineQuickLog(el,null,{id:f.teaching});
          item.auto='participation';
        },account);
        assert.equal(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('logs')).length),2);
        await page.evaluate(id=>{location.hash=`/teaching/${id}/quicklog`;},account.teaching);
        await expect(card(account.student)).toBeVisible();
        const outboxAfterGrades=await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('outbox')).filter(e=>e.store==='logs').length);
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
        assert.equal(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).filter(e => e.store === 'logs').length), outboxAfterGrades);
        // Synthetic identity mismatch through the real mounted UI preflight.
        await page.evaluate(async f => {
          const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js');
          const row={...s.state.logs[0],id:'n140-denied',deleted:false,updatedAt:200};
          await db.put('logs',row);s.state.logs.push(row);
          (await import('/src/repaint.js')).repaint();
        },account);
        await expect(card(account.student).locator('.qlcard__undo')).toBeEnabled();
        await page.evaluate(async f => {
          const el=document.querySelector(`[id="ql-${f.student}"] .qlcard__undo`);
          const cloud=await import('/src/lib/cloud.js');
          cloud.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{access_token:'synthetic',user:{id:'b7300000-0000-4000-8000-000000000002'}});
          await (await import('/src/views/quicklog.js')).default.actions.undo(el,null,{id:f.teaching});
        },account);
        const denied = await page.evaluate(async () => {
          const db = await import('/src/lib/db.js');
          return { row: await db.get('logs', 'n140-denied'), count: (await db.getAll('outbox')).filter(e => e.store === 'logs').length };
        });
        assert.equal(denied.row.deleted, false); assert.equal(denied.count, outboxAfterGrades);
        assert.deepEqual(errors, []);
      });
    });
  } finally { await server.close(); }
});
