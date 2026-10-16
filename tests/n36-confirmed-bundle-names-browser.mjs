import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { exportedBundle, owner, foreignOwner } from './n36-receiver-fixture.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const root = resolve('.'), output = resolve('test-results/n36-confirmed-bundle-names');
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-confirmed-bundle-names-import-20261017.json';
const leaseScript = 'C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const runId = 'be501ae3-46fa-4b30-91b3-1e3b4bd40b29';
let service, serviceCalls = 0;
function resetService(ambiguous = false) {
  service = syntheticService();
  service.current.profile[0].teacherName = 'معلم حالي';
  service.current.profile[0].schoolName = 'مدرسة حالية';
  service.current.profile[0].reportPrincipalName = 'مدير حالي';
  service.current.subjects[0].name = 'علوم تجريبية';
  service.current.sections[0].name = 'خامس ألف';
  if (ambiguous) service.current.sections[1].name = 'خامس ألف';
  service.current.students[0].name = 'طالب تجريبي';
  service.current.enrollments = [{id:'synthetic-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',ownerId:owner,status:'active',deleted:false}];
}
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/__n73/')) {
      serviceCalls++; let body = ''; for await (const chunk of req) body += chunk;
      const result = await service.request(pathname.slice('/__n73/'.length), JSON.parse(body || '{}'));
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw new Error('Outside application root');
    res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(error.status || 404, {'Content-Type':'application/json'}); res.end(JSON.stringify({message:error.message})); }
});
const evidence = { runId, checks: [], externalRequests: [], errors: [] };
evidence.productHashes = Object.fromEntries(await Promise.all(['src/lib/teacher-setup-import.js','src/views/teacher-setup-import.js','src/views/class-import-center.js','src/styles/teacher-setup-import.css'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
let browser, leased = false;
const record = (name, detail) => { evidence.checks.push({name,status:'PASS',evidence:detail}); console.log('PASS '+name+' '+detail); };
const lease = action => execFileSync('powershell.exe', ['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'], {encoding:'utf8'}).trim();
await mkdir(output, {recursive:true});
try {
  evidence.lease = lease('acquire'); leased = true;
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  const base = 'http://127.0.0.1:'+server.address().port;
  browser = await chromium.launch({headless:true});
  async function accountPage(width, ambiguous = false, offline = false) {
    resetService(ambiguous);
    const context = await browser.newContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:offline?'allow':'block'});
    await context.route('**/*', route => {
      const url=route.request().url(); if (new URL(url).origin === base) return route.continue();
      evidence.externalRequests.push(url); return route.abort('blockedbyclient');
    });
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror',error=>evidence.errors.push(error.message));
    await openReadyServedDemo(page,base);
    const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
    assert.equal(ready.ready,true); assert.equal(ready.lease.editable,true); assert.deepEqual(ready.outbox,[]);
    await page.goto(base+'/#/classes/koshoof?teaching=n73-source&import=1');
    await page.locator('[data-existing-class]').selectOption('n73-source');
    await page.locator('[data-act="teacher-setup-import"]').waitFor({state:'attached'});
    await page.waitForTimeout(500);
    return {page,context};
  }
  const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
  async function open(page) { await page.locator('.grade-transfer__school summary').click(); await page.locator('[data-act="teacher-setup-import"]').click(); await page.locator('.n36-receiver').waitFor(); await page.waitForFunction(()=>!!document.querySelector('[data-teacher-setup-style]')?.sheet); await page.waitForTimeout(250); }
  async function paste(page,b=exportedBundle) {
    if (!await page.locator('[data-import-source]').evaluate(el=>el.open)) await page.locator('[data-import-source] summary').click();
    await page.locator('[data-import-paste]').fill(typeof b==='string'?b:JSON.stringify(b)); await page.locator('[data-import-parse]').click();
  }
  async function map(page) {
    await page.locator('[data-import-year]').selectOption('n73-year');
    await page.locator('[data-import-term]').selectOption('n73-term');
    await page.locator('[data-import-map="classes"]').selectOption('n73-source-section');
    await page.locator('[data-import-map="subjects"]').selectOption('n73-subject');
  }

  const namesBundle = structuredClone(exportedBundle);
  namesBundle.categories.find(c=>c.category==='students').rows.push({name:'طالب جديد',classroom:'خامس ألف'});
  async function review(page, b=namesBundle) {
    await open(page); await paste(page,b); await map(page);
    assert.equal(await page.locator('[data-names-review]').isDisabled(),true);
    await page.locator('[data-names-target]').selectOption('n73-source');
    await page.locator('[data-names-review]').click();
    await page.locator('[data-names-preview]').waitFor();
  }
  for (const width of [390,1280]) {
    const {page,context}=await accountPage(width);
    try {
      const before=await checkpoint(page); await review(page);
      assert.match(await page.locator('[data-names-preview]').innerText(),/جديدة: 1 · موجودة: 1 · غير صالحة: 0 · ملتبسة: 0/);
      assert.equal(await page.locator('[data-names-confirm]').isDisabled(),true);
      assert.deepEqual(await checkpoint(page),before);
      await page.locator('[data-import-plan]').click();
      await page.waitForFunction(()=>!document.querySelector('[data-import-export]').disabled);
      const download=page.waitForEvent('download'); await page.locator('[data-import-export]').click();
      assert.equal(JSON.parse(await readFile(await (await download).path(),'utf8')).applied,false);
      await page.locator('[data-names-approved]').check();
      await page.screenshot({path:resolve(output,'names-review-'+width+'.png')});
      const bounds=await page.locator('.sheet__body').evaluate(el=>({over:el.scrollWidth>el.clientWidth+1,rtl:getComputedStyle(el).direction}));
      assert.equal(bounds.over,false); assert.equal(bounds.rtl,'rtl');
      await page.locator('[data-names-confirm]').click();
      await page.locator('[data-names-receipt]').waitFor();
      assert.match(await page.locator('[data-names-receipt]').innerText(),/حُفظ محليًا: 1/);
      const after=await checkpoint(page);
      assert.equal(after.students.length,before.students.length+1);
      assert.equal(after.enrollments.length,before.enrollments.length+1);
      assert.ok(after.outbox.length>=2); assert.ok(after.outbox.every(r=>r.ownerId===owner));
      for(const key of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k))) assert.deepEqual(after[key],before[key],key);
      await page.screenshot({path:resolve(output,'names-receipt-'+width+'.png')});
      await page.getByRole('link',{name:'فتح الكشوف للمراجعة',exact:true}).click();
      await page.locator('.n36-receiver').waitFor({state:'detached'});
      assert.deepEqual(await checkpoint(page),after,'navigation preserves saved queue');
      record('actual_confirm_RTL_'+width,'Actual Koshoof app entry, explicit teaching/checkbox, 1 new + 1 existing, read-only plan download, one owner-bound new identity + enrollment/outbox only; receipt and saved queue survive navigation.');
    } finally { await context.close(); }
  }
  for(const scenario of ['multi','duplicate','owner','lease','route','snapshot','category','contents','persisted-drift','write-failure','uncertain','ambiguous-roster','enrollment-failure','outbox-failure','late-file','route-at-commit','plan-at-commit']) {
    const {page,context}=await accountPage(390);
    try {
      if(scenario==='multi') await page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
        const subject={...s.state.subjects[0],id:'n36-subject',name:'مادة أخرى'};await db.put('subjects',subject);s.state.subjects.push(subject);
        const t={...s.state.teachings.find(t=>t.id==='n73-source'),id:'n36-another',subjectId:subject.id};await db.put('teachings',t);s.state.teachings.push(t);
      });
      if(scenario==='ambiguous-roster') await page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
        const student=s.state.students.find(r=>r.id==='n73-student2');student.name='طالب تجريبي';await db.put('students',student);
        const e={id:'n36-ambiguous-enrollment',studentId:student.id,sectionId:'n73-source-section',ownerId:s.getActiveWorkspace().authUserId,status:'active',deleted:false};await db.put('enrollments',e);s.state.enrollments.push(e);
      });
      let b=structuredClone(namesBundle);
      if(scenario==='duplicate') b.categories.find(c=>c.category==='students').rows.push({name:'طَالب جديد',classroom:'خامس ألف'});
      const before=await checkpoint(page);
      if(scenario==='duplicate') {
        await open(page);await paste(page,b);assert.equal(await page.locator('.n36-category').count(),0);
      } else {
        await review(page,b);
        if(scenario==='ambiguous-roster') {
          assert.match(await page.locator('[data-names-preview]').innerText(),/جديدة: 1 · موجودة: 0 · غير صالحة: 0 · ملتبسة: 1/);
          await page.locator('[data-names-approved]').check();assert.equal(await page.locator('[data-names-confirm]').isDisabled(),true);
        } else if(scenario==='late-file') {
          await page.evaluate(()=>{File.prototype.text=async()=>{await new Promise(r=>setTimeout(r,350));return '{}';};});
          await page.locator('[data-import-source] summary').click();
          await page.locator('[data-import-file]').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from('{}')});
          await paste(page,b);await page.waitForTimeout(450);assert.equal(await page.locator('.n36-category').count(),6);
          assert.equal(await page.locator('[data-names-confirm]').count(),0);
        } else if(scenario==='multi') {
          assert.equal(await page.locator('[data-names-target] option').count(),3);
          await page.locator('[data-names-target]').selectOption('n36-another');
          assert.equal(await page.locator('[data-names-confirm]').count(),0);
        } else if(scenario==='owner') {
          await page.evaluate(async id=>(await import('/src/lib/cloud.js')).setMockAuth({id},{user:{id},access_token:'other'}),foreignOwner);
        } else if(scenario==='lease') {
          await context.setOffline(true);
          await page.evaluate(async()=>(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('expired'));
        } else if(scenario==='route') {
          await page.goBack();
        } else if(scenario==='snapshot') {
          await page.evaluate(async()=>(await import('/src/store.js')).state.subjects[0].name='تغيير');
          await page.locator('[data-names-approved]').click();
        } else if(scenario==='category') {
          await page.locator('[data-import-category="students"]').uncheck();
          assert.equal(await page.locator('[data-names-confirm]').count(),0);
        } else if(scenario==='contents') {
          const el=page.locator('[data-edit-category="students"][data-edit-row="1"][data-edit-field="name"]');
          await el.fill('طالب معدل'); await el.dispatchEvent('change');
          assert.equal(await page.locator('[data-names-confirm]').count(),0);
        } else {
          if(scenario==='persisted-drift') await page.evaluate(async()=>{
            const db=await import('/src/lib/db.js'),m=await import('/src/models.js');
            await db.putAcross({students:[m.makeStudent({id:'other-tab',name:'طالب جديد'})],enrollments:[m.makeEnrollment({studentId:'other-tab',sectionId:'n73-source-section',rollNo:3})]});
          });
          if(['write-failure','enrollment-failure','outbox-failure'].includes(scenario)) await page.evaluate(storeName=>{
            const original=IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put=function(...args){if(this.name===storeName) throw Error('synthetic write failure');return original.apply(this,args);};
          }, {'write-failure':'students','enrollment-failure':'enrollments','outbox-failure':'outbox'}[scenario]);
          if(scenario==='uncertain') await page.evaluate(()=>{
            // Fail after the real transaction commits, at store state application.
            const original=Array.prototype.findIndex;let fired=false;
            Array.prototype.findIndex=function(fn,...rest){
              if(!fired && this.some(r=>r?.id==='n73-student1') && new Error().stack.includes('applyCommittedPuts')) { fired=true;throw Error('synthetic post-commit receipt failure'); }
              return original.call(this,fn,...rest);
            };
          });
          if(scenario==='plan-at-commit') {
            await page.evaluate(()=>{const original=SubtleCrypto.prototype.digest;SubtleCrypto.prototype.digest=async function(...args){await new Promise(r=>setTimeout(r,400));return original.apply(this,args);};});
            await page.locator('[data-import-plan]').click();
          }
          if(scenario==='route-at-commit') await page.evaluate(()=>{
            const original=IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction=function(stores,mode,...rest){
              if(mode==='readwrite' && [...stores].includes('students') && [...stores].includes('outbox')) location.hash='#/classes';
              return original.call(this,stores,mode,...rest);
            };
          });
          await page.locator('[data-names-approved]').check();await page.locator('[data-names-confirm]').click();
          if(scenario==='route-at-commit') {
            await page.locator('.n36-receiver').waitFor({state:'detached'});
            assert.deepEqual(await checkpoint(page),before);
            record('guard_route-at-commit','Actual transaction preflight sees route change while opening IndexedDB: no student/enrollment/outbox write.');continue;
          }
          await page.locator('[data-names-receipt]').waitFor();
          assert.equal(await page.locator('[data-names-confirm]').count(),0);
          if(scenario==='plan-at-commit') {
            await page.waitForTimeout(500);assert.equal(await page.locator('[data-import-export]').isDisabled(),true);
            const after=await checkpoint(page);assert.equal(after.students.length,before.students.length+1);assert.ok(after.outbox.length>=2);
            record('guard_plan-at-commit','Delayed actual reviewed-plan digest cannot revive export after a names commit starts; confirmed names and outbox saved.');continue;
          }
          assert.match(await page.locator('[data-names-receipt]').innerText(),/لم تكتمل/);
          if(scenario==='uncertain') {const after=await checkpoint(page);assert.equal(after.students.length,before.students.length+1);assert.equal(after.enrollments.length,before.enrollments.length+1);assert.ok(after.outbox.length>=2);assert.ok(after.outbox.every(r=>r.ownerId===owner));}
          if(scenario==='persisted-drift') {const after=await checkpoint(page);assert.equal(after.students.length,before.students.length+1);assert.deepEqual(after.outbox,before.outbox);}
        }
        if(['owner','lease','route','snapshot'].includes(scenario)) await page.locator('.n36-receiver').waitFor({state:'detached'});
      }
      if(!['persisted-drift','uncertain','multi'].includes(scenario)) assert.deepEqual(await checkpoint(page),before);
      record('guard_'+scenario,'Actual DOM/store synthetic '+scenario+'; stale/invalid confirmation prevented, existing data/outbox retained; no direct replay.');
    } finally {await context.close();}
  }
  assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);
  evidence.status='PASS';
} catch(error) {evidence.status='FAIL';evidence.failure=error.stack;throw error;}
finally {
  await browser?.close(); if(server.listening) await new Promise(done=>server.close(done));
  if(leased) evidence.release=lease('release');
  await writeFile(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));
  await writeFile('tests/n36-confirmed-bundle-names-browser.json',JSON.stringify(evidence,null,2));
}
