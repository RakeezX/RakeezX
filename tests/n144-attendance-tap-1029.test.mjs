// AI N144: real mounted app/store/CSS; only synthetic local workspace and fault fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {fixture,owner,foreignOwner} from './n73-account-flow-fixture.mjs';

test('N144 attendance interaction', {timeout:120000}, async t => {
  const url='http://127.0.0.1:53144';
  // Delay only entry to the actual store operation; production guards/transactions stay intact.
  const server=await createServer({plugins:[{name:'n144-store-delay',enforce:'pre',configureServer(server){
    server.middlewares.use('/__n73',async(req,res)=>{
      const name=req.url.split('?')[0].slice(1);
      const rows=fixture();
      rows.enrollments=[1,2].map(i=>({id:`n144-account-en${i}`,studentId:`n73-student${i}`,sectionId:'n73-source-section',status:'active',rollNo:i}));
      rows.sessions=[{id:'n144-account-session',teachingId:'n73-source',date:'2026-10-29',period:1,status:'scheduled',startTime:'15:00',endTime:'15:45'}].map(r=>({...r,ownerId:owner,serverRevision:1}));
      const value=name==='fixture'?rows:name==='auth'?{id:owner,source:'supabase-auth-user',verifiedAt:Date.parse('2026-10-29T09:00:00+03:00')}:{};
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));
    });
  },transform(code,id){
    if(process.env.N144_BASELINE==='1' && id.replaceAll('\\','/').endsWith('/src/views/attendance.js')) return execFileSync('git',['show','d684828e76b17dc576bc956f7e14f5a4f1772a23:src/views/attendance.js'],{encoding:'utf8'});
    if(id.replaceAll('\\','/').endsWith('/src/store.js')) return code.replace(
      'export async function setAttendance(sesId, studentId, status) {',
      `export async function setAttendance(sesId, studentId, status) {
        if (globalThis.__n144Gate) { globalThis.__n144Calls.push({sesId,studentId,status}); await globalThis.__n144Gate; }
      `);
  }}],server:{host:'127.0.0.1',port:53144,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n144-attendance-tap-1029.json',runId:'ec72dfd5-8dff-4843-8bc9-f35b77214513',url,timeoutMs:115000},async({createContext})=>{
      const context=await createContext({viewport:{width:320,height:850},locale:'ar-SA',timezoneId:'Asia/Riyadh',hasTouch:true});
      await context.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-10-29T09:00:00+03:00'));
      await openReadyServedDemo(page,url);
      await page.evaluate(async()=>{
        const s=await import('/src/store.js');
        if(s.getActiveWorkspace()?.type!=='demo')throw Error('SYNTHETIC_ONLY');
        const section=await s.createSection({grade:5,label:'144'});
        await s.save({subjects:[{id:'n144-sub',name:'اختبار الحضور'}],teachings:[{id:'n144-t',sectionId:section.id,subjectId:'n144-sub',termId:s.activeTerm().id}],
          students:Array.from({length:4},(_,i)=>({id:`n144-st${i}`,name:`طالب اصطناعي ${i}`,status:'active'})),
          enrollments:Array.from({length:4},(_,i)=>({id:`n144-en${i}`,studentId:`n144-st${i}`,sectionId:section.id,status:'active',rollNo:i+1})),
          sessions:[1,2].map(period=>({id:`n144-s${period}`,teachingId:'n144-t',date:'2026-10-29',period,startTime:'15:00',endTime:'15:45',status:'scheduled'}))});
      });
      const open=async()=>{
        await page.goto(`${url}/#/classes`);await expect(page.locator('.att-row')).toHaveCount(0);
        await page.goto(`${url}/#/teaching/n144-t/attendance?session=n144-s1`);
        await expect(page.locator('.att-row')).toHaveCount(4);
        if(process.env.N144_BASELINE!=='1')await expect(page.locator('[data-act="set"]').first()).toHaveAttribute('data-session','n144-s1');
      };
      const button=(status,student=0)=>page.locator(`[data-act="set"][data-id="n144-st${student}"][data-status="${status}"]`);
      const records=()=>page.evaluate(async()=>{const s=await import('/src/store.js'),db=await import('/src/lib/db.js');return {memory:s.attendanceIn('n144-s1'),disk:(await db.getAll('attendance')).filter(r=>r.sessionId==='n144-s1'&&!r.deleted)};});
      const churn=()=>page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
        await db.putMany('notes',[{id:crypto.randomUUID(),studentId:'n144-st1',teachingId:'n144-t',text:'إعادة رسم اصطناعية',date:'2026-10-29',updatedAt:Date.now()}]);
        await s.refreshSyncedState(); // Actual post-reconciliation render notification.
      });
      const gate=()=>page.evaluate(()=>{globalThis.__n144Calls=[];globalThis.__n144Gate=new Promise(resolve=>globalThis.__n144Release=resolve);});
      const release=()=>page.evaluate(()=>{globalThis.__n144Release();globalThis.__n144Gate=null;});
      await open();
      if(process.env.N144_BASELINE==='1'){
        const target=button('present');await target.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await target.boundingBox();
        assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.dataset.status,{x:box.x+box.width/2,y:box.y+box.height/2}),'present');
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        await churn();await expect(page.locator('.att-row__note.has-notes')).toHaveCount(1);
        await page.mouse.up();await page.waitForTimeout(100);
        assert.equal((await records()).memory.length,0);
        await gate();await button('present').click();await button('present').click();await button('absent').click();
        assert.equal(await page.evaluate(()=>__n144Calls.length),3);
        console.log('BASELINE: replaced button between down/up loses tap; three pending taps enter store three times; no row acknowledgement.');
        await release();return;
      }
      await t.test('n144_single_tap_present_absent_late_excused_durable_feedback',async()=>{
        for(const [i,status] of ['present','absent','late','excused'].entries()){
          await gate();await button(status,i).tap();
          await expect(page.locator(`[data-feedback="n144-st${i}"]`)).toContainText('جارٍ الحفظ');
          assert.equal(await page.evaluate(()=>__n144Calls.length),1);
          await release();await expect(button(status,i)).toHaveAttribute('aria-pressed','true');
          await expect(page.locator(`[data-feedback="n144-st${i}"]`)).toContainText('حُفظ');
          const r=await records();assert.equal(r.memory.find(r=>r.studentId===`n144-st${i}`).status,status);assert.equal(r.disk.find(r=>r.studentId===`n144-st${i}`).status,status);
        }
        await page.reload();await expect(button('excused',3)).toHaveAttribute('aria-pressed','true');
        for(const width of [320,390]){
          await page.setViewportSize({width,height:850});
          const geometry=await button('present').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,fits:r.left>=0&&r.right<=innerWidth};});
          assert.ok(geometry.width>=40&&geometry.height>=40&&geometry.fits,JSON.stringify(geometry));
        }
        await gate();await button('absent',1).focus();await page.keyboard.press('Enter');
        await expect(page.locator('[data-feedback="n144-st1"]')).toContainText('جارٍ الحفظ');
        await expect(button('absent',1)).toBeFocused();await release();
        await expect(page.locator('[data-feedback="n144-st1"]')).toContainText('حُفظ');
        await expect(button('absent',1)).toBeFocused();
      });
      await t.test('n144_attendance_sync_repaint_rapid_choice_session_owner_fence',async()=>{
        const target=button('late');await target.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await target.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        const old=await target.elementHandle();await churn();await expect.poll(()=>old.evaluate(el=>el.isConnected)).toBe(false);
        await page.mouse.up();await expect(button('late')).toHaveAttribute('aria-pressed','true');
        // A drag away and back is not a deliberate tap.
        const drag=button('present');await drag.evaluate(el=>el.scrollIntoView({block:'center'}));const d=await drag.boundingBox();
        await page.mouse.move(d.x+d.width/2,d.y+d.height/2);await page.mouse.down();await page.mouse.move(d.x+d.width/2+20,d.y+d.height/2);await page.mouse.move(d.x+d.width/2,d.y+d.height/2);await page.mouse.up();
        await expect(button('late')).toHaveAttribute('aria-pressed','true');
        await gate();await button('present').click();await churn();await button('present').click();await button('absent').click();await button('excused').click();
        assert.equal(await page.evaluate(()=>__n144Calls.length),1);
        await expect(page.locator('[data-feedback="n144-st0"]')).toContainText('مستأذن');
        // Keep the gate resolved for counting the queued entry, then remove it.
        await page.evaluate(()=>__n144Release());
        await expect(button('excused')).toHaveAttribute('aria-pressed','true');
        assert.deepEqual(await page.evaluate(()=>__n144Calls.map(c=>c.status)),['present','excused']);
        await page.evaluate(()=>{__n144Gate=null;});
        assert.equal((await records()).disk.find(r=>r.studentId==='n144-st0').status,'excused');
      });
      await t.test('n144_no_status_overwrite_from_stale_session_or_discarded_click',async()=>{
        // Keep an actual old button, switch context and attempt its old handler.
        await page.evaluate(async()=>{globalThis.__oldButton=document.querySelector('[data-act="set"]');const v=(await import('/src/views/attendance.js')).default;await v.actions['pick-session']({dataset:{id:'n144-s2'}},null,{id:'n144-t'});await v.actions.set(__oldButton,null,{id:'n144-t'});});
        assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).attendanceIn('n144-s2').length),0);
        await page.locator('[data-act="fill-remaining"]').click();
        await expect(page.locator('[data-attendance-choice]')).toHaveText(['حاضرين','غائبين']);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.locator('.attendance-prestart')).toBeVisible();
        const beforeDate=await records();
        await page.evaluate(async()=>{const old=document.querySelector('[data-act="set"]');const v=(await import('/src/views/attendance.js')).default;await v.actions['prev-day'](null,null,{id:'n144-t'});await v.actions.set(old,null,{id:'n144-t'});});
        assert.deepEqual(await records(),beforeDate);
        await open();await gate();await button('present').click();await button('absent').click();
        await page.locator('[data-act="pick-session"][data-id="n144-s2"]').click();
        await expect(page.locator('#toast')).toContainText('لم يُرسل الاختيار المنتظر');
        await page.locator('[data-act="pick-session"][data-id="n144-s1"]').click();await release();
        await expect.poll(async()=> (await records()).disk.find(r=>r.studentId==='n144-st0')?.status).toBe('present');
        assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).attendanceIn('n144-s2').length),0);
        await open();
        // Actual IndexedDB rejection causes the real store to return null.
        await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;globalThis.__restore=()=>IDBDatabase.prototype.transaction=original;IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite'&&Array.from(names).includes('attendance'))throw Error('N144 synthetic storage rejection');return original.call(this,names,mode,...rest);};});
        await button('absent').click();await expect(page.locator('[data-feedback="n144-st0"]')).toContainText('تعذّر');
        await expect(button('present')).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>__restore());
        // Unknown result never retries queued status, even after the fixture recovers.
        await gate();await button('late').click();await button('absent').click();
        await page.evaluate(async()=>{const s=await import('/src/store.js');s.deactivateWorkspace('n144-synthetic-owner-loss');});
        await release();await page.waitForTimeout(100);
        assert.equal(await page.evaluate(()=>__n144Calls.length),1);
      });
      await t.test('actual synthetic account entry retains native owner/lease/outbox guards',async()=>{
        const ready=await page.evaluate(async()=> (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
        assert.equal(ready.lease.editable,true);assert.equal(ready.workspace.type,'account');
        await page.evaluate(()=>{location.hash='#/teaching/n73-source/attendance?session=n144-account-session';});
        const choice=status=>page.locator(`[data-act="set"][data-id="n73-student1"][data-status="${status}"]`);
        await expect(choice('present')).toBeVisible();await choice('present').tap();
        await expect(choice('present')).toHaveAttribute('aria-pressed','true');
        const checkpoint=()=>page.evaluate(async()=>{const db=await import('/src/lib/db.js'),s=await import('/src/store.js');return {workspace:s.getActiveWorkspace(),rows:await db.getAll('attendance'),outbox:await db.getAll('outbox')};});
        const before=await checkpoint();assert.equal(before.workspace.authUserId,owner);
        assert.equal(before.rows[0].status,'present');assert.ok(!before.rows[0].ownerId||before.rows[0].ownerId===owner);
        assert.ok(before.outbox.some(r=>r.command==='attendance:record'&&r.ownerId===owner));
        await gate();await choice('late').click();await choice('absent').click();
        await page.evaluate(async foreignOwner=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id:foreignOwner},{user:{id:foreignOwner},access_token:'synthetic-foreign-only'});},foreignOwner);
        await release();await expect(page.locator('[data-feedback="n73-student1"]')).toContainText('تعذّر');
        assert.equal(await page.evaluate(()=>__n144Calls.length),1);
        const after=await checkpoint();assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.outbox,before.outbox);
      });
      assert.deepEqual(errors,[]);
    });
  }finally{await server.close();}
});
