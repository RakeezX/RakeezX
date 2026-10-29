// AI-authored N140: real app, delegated handlers, IndexedDB and source CSS; synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';

const taskFile = process.env.N140_BROWSER_TASK_FILE;
const runId = process.env.N140_BROWSER_RUN_ID;
if (!taskFile || !runId) throw Error('Active task identity required');
test('N140 stable taps — affected application checks', async t => {
  const { withIsolatedLocalBrowser } = await import('file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs');
  const service = syntheticService();
  const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { host: '127.0.0.1', port: 5147, strictPort: true },
    plugins: [{name:'n140-existing-synthetic-account',configureServer(vite) {
      vite.middlewares.use('/__n73',async (req,res) => {
        try {let body='';for await (const part of req) body+=part;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await service.request(req.url.slice(1),JSON.parse(body||'{}'))));}
        catch (e) {res.statusCode=500;res.end(JSON.stringify({message:e.message}));}
      });
    }}] });
  try {
    await server.listen();
    await withIsolatedLocalBrowser({ taskFile, runId, url: 'http://127.0.0.1:5147', timeoutMs: 120000 }, async ({createContext, url}) => {
      const context = await createContext({ viewport: {width: 390, height: 844}, locale: 'ar-SA', timezoneId: 'Asia/Riyadh', reducedMotion: 'reduce' });
      await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await openReadyServedDemo(page, url);
      const fixture = await page.evaluate(async () => {
        const s = await import('/src/store.js');
        const teaching = s.teachings().find(c => s.students(c.id).length >= 3);
        const [a,b] = s.students(teaching.id);
        const item = s.items(teaching.id).find(i => i.auto === 'participation');
        s.state.logs = [];
        await s.save({logs:[{id:'n140-sync',studentId:b.id,teachingId:teaching.id,kind:'behavior',delta:1,date:'2020-01-01',tag:'إشعار اصطناعي',deleted:false,updatedAt:1}]});
        return {teaching: teaching.id, a: a.id, b: b.id, item: item.id};
      });
      const group = id => page.locator(`.ql-controls:has([data-student="${id}"])`);
      const point = (delta, id = fixture.a) => group(id).locator(`[data-delta="${delta}"]`);
      const rows = () => page.evaluate(async () => {
        const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
        return Promise.all(s.state.logs.filter(l => !l.deleted).map(l => db.get('logs', l.id)));
      });
      const quicklog = async kind => {
        await page.evaluate(id => {location.hash = `/teaching/${id}/quicklog`;}, fixture.teaching);
        await expect(group(fixture.a)).toBeVisible();
        await page.locator(`[data-act="kind"][data-kind="${kind}"]`).click();
      };
      const grades = async () => {
        await page.evaluate(id => {location.hash = `/teaching/${id}/grades`;}, fixture.teaching);
        await page.locator(`[data-act="pick"][data-id="${fixture.item}"]`).click();
        await expect(group(fixture.a)).toBeVisible();
      };
      const check = async (name, fn) => { if (!process.env.N140_FOCUS || process.env.N140_FOCUS === name) await t.test(name, fn); };
      await check('n140_cancel_reason_sheet_unlocks_each_student_and_gradebook', async () => {
        for (const surface of ['participation','behavior','grades']) {
          if (surface === 'grades') await grades(); else await quicklog(surface);
          const reason = page.locator(surface === 'grades' ? '[data-change="inline-reason"]' : '[data-change="reason"]');
          await reason.check();
          for (const delta of [1,-1]) for (const cancel of ['Escape','X','backdrop','إلغاء']) {
            const id = ['X','إلغاء'].includes(cancel) ? fixture.b : fixture.a;
            const before = (await rows()).length;
            await point(delta,id).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            if (cancel === 'backdrop') await page.evaluate(async () => {
              const s=await import('/src/store.js'); const row=s.state.logs.find(l=>l.id==='n140-sync');
              await s.patch('logs',row.id,{delta:row.delta===-1?-2:-1});
              (await import('/src/repaint.js')).repaint();
            });
            if (cancel === 'Escape') await page.keyboard.press('Escape');
            if (cancel === 'X') await page.getByRole('dialog').getByRole('button', {name:'إغلاق', exact:true}).click();
            if (cancel === 'backdrop') await page.locator('.sheet-backdrop').click({position:{x:2,y:2}});
            if (cancel === 'إلغاء') await page.getByRole('dialog').getByRole('button', {name:'إلغاء', exact:true}).click();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(point(delta,id), `${surface}/${delta}/${cancel} unlocks`).toBeEnabled({timeout:1000});
            assert.equal((await rows()).length,before,'cancel must not write');
            await expect(point(delta, fixture.b)).toBeEnabled();
            await point(delta,id).click(); // exactly one new tap, same route, same reason setting
            await page.getByRole('dialog').locator('.tag-pick').first().click();
            await expect.poll(async () => (await rows()).length).toBe(before+1);
            const saved = (await rows()).at(-1);
            assert.equal(saved.studentId,id); assert.equal(saved.delta,delta);
            assert.equal(saved.kind,surface === 'behavior' ? 'behavior' : 'participation');
          }
          const before=(await rows()).length;
          // Retain the actual command's opener; the live replacement is a different element.
          await page.evaluate(()=>document.addEventListener('click',e=>{window.n140DayControl=e.target.closest('.ql-point');},{capture:true,once:true}));
          await point(1).click();
          await page.evaluate(()=>{window.n140DayControl.dataset.day='2020-01-01';});
          await page.getByRole('dialog').locator('#tag-go').click();
          assert.equal((await rows()).length,before,'a stale day control must still reject a reason choice');
          await expect(point(1)).toBeEnabled();
        }
      });
      await check('n140_repeated_taps_during_repaint_save_and_sync_reliably_commit', async () => {
        for (const surface of ['participation','behavior','grades']) {
          if (surface === 'grades') await grades(); else await quicklog(surface);
          await page.locator(surface === 'grades' ? '[data-change="inline-reason"]' : '[data-change="reason"]').uncheck();
          const before = (await rows()).length;
          // Delay actual local persistence; notifications/repaint happen while a second pointer is held.
          await page.evaluate(async () => {
            // Delay readback (actual db.get uses a readonly IDB request); retain real writes.
            window.n140OriginalGet = IDBObjectStore.prototype.get;
            IDBObjectStore.prototype.get = function (...args) {
              const request = window.n140OriginalGet.apply(this,args);
              if (this.name !== 'logs' || this.transaction.mode !== 'readonly') return request;
              return new Proxy(request,{get(target,key) {
                const value = Reflect.get(target,key,target);
                return typeof value === 'function' ? value.bind(target) : value;
              },set(target,key,value) {
                if (key === 'onsuccess') { target[key] = event => setTimeout(()=>value(event),120); return true; }
                return Reflect.set(target,key,value,target);
              }});
            };
          });
          await page.evaluate(() => {
            window.n140PointerTrace=[];
            document.addEventListener('pointerdown', e=>window.n140PointerTrace.push({type:e.type,primary:e.isPrimary,button:e.button,x:e.clientX,y:e.clientY,scrollY,target:e.target.outerHTML?.slice(0,250)}),true);
          });
          for (const delta of [1,-1,1,-1,1,-1]) {
            const button = point(delta);
            await expect(button).toBeVisible();
            const box = await page.evaluate(({id,delta}) => {const el=document.querySelector(`.ql-point[data-student="${id}"][data-delta="${delta}"]`); el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); window.n140Box={x:r.x,y:r.y,width:r.width,height:r.height,scrollY};return window.n140Box;},{id:fixture.a,delta});
            await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
            await page.mouse.down();
            await page.evaluate(async f => {
              window.n140Pressed = document.querySelector(`[data-student="${f.a}"][data-delta="${f.delta}"]`);
              const s = await import('/src/store.js');
              // A material synthetic incoming Sync projection, through actual store notification.
              const row = s.state.logs.find(l=>l.id==='n140-sync');
              await s.patch('logs',row.id,{tag: row.tag ? '' : 'إشعار اصطناعي',delta:row.delta===-1?-2:-1,kind:f.kind});
              (await import('/src/repaint.js')).repaint();
            }, {...fixture,delta,kind:surface==='behavior'?'behavior':'participation'});
            await page.waitForTimeout(25);
            assert.ok(await page.evaluate(()=>window.n140Pressed?.isConnected),`${surface}/${delta}: incoming update must retain held control; ${JSON.stringify(await page.evaluate(()=>({trace:window.n140PointerTrace,box:window.n140Box,now:window.n140Pressed?.getBoundingClientRect().toJSON(),scrollY})))}`);
            await page.mouse.up();
            await expect(group(fixture.a).locator('.ql-save-status')).toContainText('جارٍ الحفظ');
          }
          await expect.poll(async () => (await rows()).filter(Boolean).length,{timeout:6000}).toBe(before+6);
          const saved = (await rows()).filter(Boolean).slice(before);
          assert.deepEqual(saved.map(l=>l.delta),[1,-1,1,-1,1,-1]);
          assert.ok(saved.every(l=>l.studentId===fixture.a && l.teachingId===fixture.teaching && l.kind===(surface==='behavior'?'behavior':'participation') && l.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh'}).format(new Date())));
          // Cancel a picker queued behind an in-flight save, then accept one new choice.
          await point(1).click();
          const reason=page.locator(surface==='grades'?'[data-change="inline-reason"]':'[data-change="reason"]');
          await reason.check();
          await point(-1).click();await page.keyboard.press('Escape');await expect(point(-1)).toBeEnabled();
          await point(-1).click();await page.getByRole('dialog').locator('#tag-go').click();
          await expect.poll(async()=>(await rows()).filter(Boolean).length).toBe(before+8);
          await page.evaluate(() => {IDBObjectStore.prototype.get=window.n140OriginalGet;});
        }
        // Targeted current-owner UI entry; reuse the earlier broad owner/grade/tombstone proof.
        const accountContext=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
        await accountContext.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
        const accountPage=await accountContext.newPage();
        accountPage.on('pageerror',e=>errors.push(e.message));
        await openReadyServedDemo(accountPage,url);
        await accountPage.evaluate(async()=>{await (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount();});
        const account=await accountPage.evaluate(async()=>{
          const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),m=await import('/src/models.js'),f=await import('/tests/n73-account-flow-fixture.mjs');
          const teaching=s.getTeaching(f.source),student=s.state.students[0];
          const enrollment={id:'n140-stable-enrollment',studentId:student.id,sectionId:teaching.sectionId,status:'active',deleted:false,ownerId:f.owner,updatedAt:1};
          await db.put('enrollments',enrollment);s.state.enrollments=[enrollment];
          const item={...m.makeItem({id:'n140-stable-participation',teachingId:teaching.id,name:'مشاركة اصطناعية',auto:'participation',max:10,perPoint:1}),ownerId:f.owner};
          await db.put('items',item);s.state.items.push(item);
          return {teaching:teaching.id,student:student.id,item:item.id,owner:f.owner};
        });
        await accountPage.evaluate(id=>{location.hash=`/teaching/${id}/grades`;},account.teaching);
        await accountPage.locator(`[data-act="pick"][data-id="${account.item}"]`).click();
        const accountPlus=accountPage.locator(`.ql-point[data-student="${account.student}"][data-delta="1"]`);
        await accountPage.locator('[data-change="inline-reason"]').check();
        await accountPlus.click();await accountPage.keyboard.press('Escape');await expect(accountPlus).toBeEnabled();
        await accountPage.locator('[data-change="inline-reason"]').uncheck();
        await accountPlus.dblclick();
        await expect(accountPlus).toHaveText('+2');
        const ownership=await accountPage.evaluate(async()=>{
          const db=await import('/src/lib/db.js');return {logs:await db.getAll('logs'),commands:(await db.getAll('outbox')).filter(e=>e.store==='logs')};
        });
        assert.equal(ownership.logs.length,2);assert.ok(ownership.logs.every(l=>l.studentId===account.student && l.teachingId===account.teaching && l.delta===1));
        assert.equal(ownership.commands.length,2);assert.ok(ownership.commands.every(e=>e.ownerId===account.owner));
        await accountPage.evaluate(()=>{document.querySelector('.ql-point[data-delta="1"]').dataset.workspace='stale-workspace';});
        await accountPlus.click();
        assert.equal(await accountPage.evaluate(async()=>(await (await import('/src/lib/db.js')).getAll('logs')).length),2);
        await accountContext.close();
      });
      await check('n140_stable_cards_one_line_behavior_and_useful_reasons', async () => {
        await quicklog('behavior');
        await page.locator('[data-change="reason"]').uncheck();
        for (const width of [320,360,390]) {
          await page.setViewportSize({width,height:844});
          const tab = page.locator('[data-act="kind"][data-kind="behavior"]');
          assert.ok(await tab.evaluate(el => {
            const range=document.createRange(); range.selectNodeContents(el);
            return range.getClientRects().length===1 && el.scrollWidth<=el.clientWidth && document.documentElement.scrollWidth<=innerWidth;
          }),`${width}px readable single line`);
          const rects = () => page.locator('.qlcard').evaluateAll(els=>els.map(el=> {
            const r=el.getBoundingClientRect(), b=el.querySelector('.ql-controls').getBoundingClientRect();
            return [r.x,r.y,r.width,r.height,b.x,b.y,b.width,b.height];
          }));
          const before=await rects();
          assert.ok(await page.locator('.qlcard').evaluateAll(els=>els.every(el=> {
            const box=el.getBoundingClientRect();
            return [...el.querySelectorAll('button,.qlcard__name,.qlcard__note')].every(part=> {
              const r=part.getBoundingClientRect();return r.left>=box.left && r.right<=box.right && r.top>=box.top && r.bottom<=box.bottom && (part.tagName!=='BUTTON'||r.width>=44 && r.height>=44);
            });
          })),`${width}px card content and touch targets fit`);
          await point(-1).click();
          await expect(point(-1)).toBeEnabled();
          await page.waitForTimeout(180);
          assert.deepEqual(await rects(),before,`${width}px no card/control displacement on first negative`);
        }
        await page.locator('[data-change="reason"]').check();
        await point(-1).click();
        const choices=await page.getByRole('dialog').locator('[data-tag]').evaluateAll(els=>els.map(el=>({tag:el.dataset.tag,icon:el.querySelector('[aria-hidden]').textContent})));
        assert.deepEqual(choices.slice(0,9).map(c=>c.tag),['إزعاج','عبث بالجهاز','تأخر عن العمل','مقاطعة','عدم انتظار الدور','استخدام غير مناسب للأدوات','ترك المكان دون ترتيب','عدم اتباع تعليمات السلامة','حديث جانبي أثناء الشرح']);
        assert.ok(choices.length>=11 && choices.length<=13);
        assert.equal(choices.find(c=>c.tag==='النوم أثناء الحصة')?.icon,'😴');
        assert.equal(new Set(choices.map(c=>c.tag)).size,choices.length);
        assert.ok(choices.every(c=>c.icon && c.icon!=='undefined'));
        await page.keyboard.press('Escape');
      });
      assert.deepEqual(errors,[]);
    });
  } finally { await server.close(); }
});
