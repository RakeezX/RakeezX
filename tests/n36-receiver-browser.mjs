import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { exportedBundle, owner, foreignOwner } from './n36-receiver-fixture.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const root = resolve('.'), output = resolve('test-results/n36-receiver');
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-rakeez-bundle-receiver-20261014.json';
const leaseScript = 'C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const runId = 'a4aaa3d0-0802-4be0-acc8-ed3373a03ae0';
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
  service.current.enrollments = [{id:'synthetic-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',ownerId:owner,deleted:false}];
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
    const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareAccount());
    assert.equal(ready.ready,true); assert.equal(ready.lease.editable,true); assert.deepEqual(ready.outbox,[]);
    await page.goto(base+'/#/settings');
    await page.locator('[data-act="teacher-setup-import"]').waitFor();
    await page.waitForTimeout(500);
    return {page,context};
  }
  const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
  async function open(page) { await page.locator('[data-act="teacher-setup-import"]').click(); await page.locator('.n36-receiver').waitFor(); await page.waitForFunction(()=>!!document.querySelector('[data-teacher-setup-style]')?.sheet); await page.waitForTimeout(250); }
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
  for (const width of [390,1280]) {
    const {page,context}=await accountPage(width);
    try {
      const before=await checkpoint(page), calls=serviceCalls;
      await open(page);
      const initialHeight = await page.locator('.n36-sheet').evaluate(el=>el.getBoundingClientRect().height);
      assert.equal(await page.locator('[data-import-review]').innerText(),'');
      await page.locator('[data-import-file]').setInputFiles({name:'exported-v1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportedBundle))});
      await page.locator('[data-import-year]').waitFor();
      assert.equal(await page.locator('.n36-category').count(),6);
      assert.ok((await page.locator('[data-import-review]').innerText()).includes('معلم حالي'));
      await map(page);
      assert.equal(await page.locator('[data-import-plan]').isEnabled(),true);
      assert.ok((await page.locator('[data-import-review]').innerText()).includes('اسم موجود؛ مراجعة يدوية'));
      const bounds=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,dialog:document.querySelector('.n36-sheet').getBoundingClientRect().toJSON(),overflow:document.querySelector('.sheet__body').scrollWidth>document.querySelector('.sheet__body').clientWidth+1}));
      assert.ok(bounds.body<=width+1); assert.equal(bounds.overflow,false); assert.ok(bounds.dialog.x>=0 && bounds.dialog.right<=width+1);
      assert.ok(Math.abs(initialHeight-bounds.dialog.height)<2,'stable modal height from parse to review');
      const edit=page.locator('[data-edit-category="teacher"][data-edit-field="name"]');
      await edit.fill('معلم مراجَع'); await edit.dispatchEvent('change');
      await page.locator('[data-import-category="principal"]').uncheck();
      await page.locator('[data-import-plan]').click();
      await page.waitForFunction(()=>!document.querySelector('[data-import-export]').disabled);
      assert.ok((await page.locator('[data-import-status]').innerText()).includes('لم تُطبّق'));
      const downloadPromise=page.waitForEvent('download'); await page.locator('[data-import-export]').click();
      const download=await downloadPromise; const plan=JSON.parse(await readFile(await download.path(),'utf8'));
      assert.equal(plan.applied,false); assert.equal(plan.ownerId,owner); assert.match(plan.currentStateSha256,/^[a-f0-9]{64}$/);
      assert.equal(plan.yearId,'n73-year'); assert.equal(plan.categories.length,5);
      assert.equal(plan.categories[0].rows[0].proposed.name,'معلم مراجَع');
      assert.equal(plan.categories.find(c=>c.category==='students').rows[0].references.studentMatch,'manual-review-existing-name');
      assert.ok(!JSON.stringify(plan).includes('synthetic-local-only')); assert.ok(!JSON.stringify(plan).includes('معلم حالي'));
      const heightAfter = await page.locator('.n36-sheet').evaluate(el=>el.getBoundingClientRect().height);
      assert.ok(Math.abs(initialHeight-heightAfter)<2,'no modal resize after edit/plan');
      await page.locator('.sheet__body').evaluate(el=>el.scrollTop=0);
      await page.screenshot({path:resolve(output,'review-'+width+'.png')});
      await page.locator('[data-edit-category="teacher"][data-edit-field="name"]').scrollIntoViewIfNeeded();
      await page.screenshot({path:resolve(output,'category-'+width+'.png')});
      await page.getByRole('button',{name:'إلغاء',exact:true}).click();
      assert.equal(await page.locator('.n36-receiver').count(),0);
      assert.deepEqual(await checkpoint(page),before); assert.equal(serviceCalls,calls);
      record('n36_real_account_bundle_preview_'+width,'Actual settings action, canonical v1 file, six groups, edits/deselection/mapping/download; all DB stores/outbox and service calls unchanged; no horizontal overflow.');
      await open(page); await paste(page);
      const missing=structuredClone(exportedBundle); delete missing.categories[5].rows[0].period; delete missing.categories[5].rows[0].time;
      await paste(page,missing); await map(page); assert.equal(await page.locator('[data-import-plan]').isDisabled(),true);
      assert.ok((await page.locator('[data-import-issues]').innerText()).includes('غير متوفر'));
      // Real central adapter edits restore missing time and period, never synthesized.
      const period=page.locator('[data-edit-field="period"]'); await period.fill('2'); await period.dispatchEvent('change');
      await page.waitForFunction(()=>!!document.querySelector('[data-time-part="start"]')?._flatpickr);
      await page.evaluate(()=>{const el=document.querySelector('[data-time-part="start"]');el._flatpickr.setDate('10:00',false);el.dispatchEvent(new Event('change',{bubbles:true}));});
      assert.equal(await page.locator('[data-import-plan]').isEnabled(),true);
      const bad=structuredClone(exportedBundle); bad.categories[0].rows[0].phone='0500000000';
      await paste(page,bad); assert.equal(await page.locator('.n36-category').count(),0);
      assert.ok((await page.locator('[data-import-status]').innerText()).includes('مرفوضة'));
      const duplicate=structuredClone(exportedBundle);duplicate.categories[4].rows.push(duplicate.categories[4].rows[0]);
      await paste(page,duplicate);assert.equal(await page.locator('.n36-category').count(),0);
      await paste(page,'{"__proto__":{}}'); assert.equal(await page.locator('.n36-category').count(),0);
      await page.locator('[data-import-file]').setInputFiles({name:'oversized.json',mimeType:'application/json',buffer:Buffer.alloc(100001,32)});
      assert.ok((await page.locator('[data-import-status]').innerText()).includes('أكبر'));
      await paste(page); await page.evaluate(()=>location.hash='#/classes');
      await page.locator('.n36-receiver').waitFor({state:'detached'});
      assert.deepEqual(await checkpoint(page),before); assert.equal(serviceCalls,calls);
      record('n36_validated_plan_and_source_limits_'+width,'Actual paste rejects unexpected/prototype/duplicate/oversized inputs; missing time/period blocks plan and approved adapter permits explicit correction; navigation cleans receiver.');
      await page.goto(base+'/#/settings'); await open(page); await paste(page);
      await page.evaluate(async other=>{const cloud=await import('/src/lib/cloud.js');cloud.setMockAuth({id:other},{user:{id:other},access_token:'synthetic-other'});},foreignOwner);
      await page.locator('.n36-receiver').waitFor({state:'detached'});
      assert.ok(!(await page.locator('#modal-root').innerText()).includes('معلم حالي'));
      await page.locator('[data-act="teacher-setup-import"]').click();
      assert.equal(await page.locator('.n36-receiver').count(),0,'foreign owner cannot reopen current account preview');
      assert.deepEqual(await checkpoint(page),before);
      record('n36_owner_switch_cancel_no_mutation_'+width,'A/B authenticated owner mismatch closes and erases preview; actual DB and outbox unchanged.');
    } finally { await context.close(); }
  }
  {
    const {page,context}=await accountPage(390);
    try {
      // Malformed current fixture text is rendered as literal text, never executable markup.
      await page.evaluate(async()=>{(await import('/src/store.js')).state.profile.schoolName='مدرسة <img src=x onerror=window.n36Injected=true>';});
      const before=await checkpoint(page); await open(page); await paste(page);
      assert.ok((await page.locator('[data-import-review]').innerText()).includes('<img src=x'));
      assert.equal(await page.locator('[data-import-review] img').count(),0);
      assert.equal(await page.evaluate(()=>window.n36Injected),undefined);
      await page.evaluate(async()=>{(await import('/src/store.js')).state.subjects[0].name='حالة أحدث';});
      // The in-memory fixture deliberately has no store notification. The next
      // controlled action must still check the full current-state binding.
      // A normal click is sufficient: the ownership/state guard removes the
      // entire control, so an uncheck postcondition would wait for a gone node.
      await page.locator('[data-import-category="teacher"]').click();
      await page.locator('.n36-receiver').waitFor({state:'detached'});
      assert.deepEqual(await checkpoint(page),before);
      record('n36_escape_and_current_state','Actual current private text escaped; a changed state invalidates and erases the receiver with no database/outbox write.');
    } finally { await context.close(); }
  }
  {
    const {page,context}=await accountPage(390,true);
    try {
      const before=await checkpoint(page); await open(page); await paste(page);
      await page.locator('[data-import-year]').selectOption('n73-year'); await page.locator('[data-import-term]').selectOption('n73-term');
      assert.equal(await page.locator('[data-import-map="classes"] option[value="n73-source-section"]').count(),0);
      assert.equal(await page.locator('[data-import-plan]').isDisabled(),true);
      await page.evaluate(async()=>{(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('synthetic-expired');});
      await page.locator('.n36-receiver').waitFor({state:'detached'}); assert.deepEqual(await checkpoint(page),before);
      record('n36_ambiguous_and_expired','Duplicate current class names excluded from mapping; actual lease invalidation closes without mutation.');
    } finally { await context.close(); }
  }
  {
    const {page,context}=await accountPage(390,false,true);
    try {
      await page.evaluate(()=>navigator.serviceWorker.ready); await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      const assets=['src/lib/teacher-setup-import.js','src/views/teacher-setup-import.js','src/styles/teacher-setup-import.css'];
      await page.waitForFunction(async assets=>(await Promise.all(assets.map(p=>caches.match(new URL(p,location.origin).href)))).every(Boolean),assets);
      // The receiver has never been opened. Its actual modules/CSS must come from the installed shell.
      const before=await checkpoint(page), calls=serviceCalls;
      await context.setOffline(true); await open(page); await paste(page); await map(page);
      await page.locator('[data-import-plan]').click(); await page.waitForFunction(()=>!document.querySelector('[data-import-export]').disabled);
      await page.waitForFunction(()=>!!document.querySelector('[data-teacher-setup-style]')?.sheet);
      await page.screenshot({path:resolve(output,'offline-first-preview.png'),fullPage:true});
      await page.getByRole('button',{name:'إلغاء',exact:true}).click();
      assert.deepEqual(await checkpoint(page),before); assert.equal(serviceCalls,calls);
      record('n36_receiver_offline_shell','Actual installed SW caches all three receiver assets before first controlled interaction; offline settings→parse→map→reviewed plan works with source CSS; DB/outbox unchanged.');
    } finally { await context.close(); }
  }
  assert.deepEqual(evidence.errors,[],'no app exceptions');
  evidence.status='PASS';
} catch(error) { evidence.status='FAIL'; evidence.failure=error.stack; throw error; }
finally {
  await browser?.close(); if(server.listening) await new Promise(done=>server.close(done));
  if(leased) evidence.release=lease('release');
  await writeFile(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));
}
