import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { exportedBundle, owner, foreignOwner } from './n36-receiver-fixture.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const root=resolve('.');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-unified-import-entry-independent-20261015.json';
const runId='ee2b9354-e23f-43ce-8731-2251203ea73e';
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
const evidence={runId, checks:[], errors:[]};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail}); console.log('PASS '+name);};
const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
try {
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49361,'127.0.0.1',done);});
 const base='http://127.0.0.1:49361';
 await mkdir('test-results/n36-import-location',{recursive:true});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,768,1280]) {
   resetService();
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
   try {
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>evidence.errors.push(error.message));
    await openReadyServedDemo(page,base);
    const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareAccount());
    assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
    await page.goto(base+'/#/settings');
    await page.locator('a[href="#/settings/backup"]').waitFor();
    assert.equal(await page.locator('[data-act="teacher-setup-import"]').count(),0);
    assert.ok(await page.locator('a[href="#/archive"]').count());
    await page.evaluate(()=>location.hash='#/teaching/n73-source/grades?import');
    const entry=page.locator('[data-act="teacher-setup-import"]');await entry.waitFor();
    await page.waitForFunction(()=>!!document.querySelector('#n94-grades-style')?.sheet);
    await page.waitForTimeout(250);
    assert.equal(await entry.count(),1);assert.equal(await entry.innerText(),'بيانات مدرستي');
    assert.equal(await page.locator('[data-change="grade-file"]').getAttribute('accept'),'.csv,.xlsx');
    const before=await checkpoint(page),calls=serviceCalls;
    await page.evaluate(()=>{window.n36Writes=[];for(const name of ['put','add','delete','clear']){const original=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){window.n36Writes.push(this.name+':'+name);return original.apply(this,args);};}});
    const bounds=await entry.boundingBox();assert.ok(bounds.width<220 && bounds.height>=44);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:'test-results/n36-import-location/grades-'+width+'.png',fullPage:true});
    // Existing N90 read/review/cancel and export handlers stay reachable beside the new entry.
    await page.locator('[data-change="grade-import-mode"]').selectOption('grades');
    await page.locator('[data-change="grade-file"]').setInputFiles({name:'grades.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب,Exam\nطالب تجريبي,18')});
    await page.locator('[data-act="grade-review"]').waitFor();
    await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
    await page.locator('[data-act="grade-cancel"]').click();
    await page.locator('[data-grade-export-panel] > summary').click();
    const downloadEvent=page.waitForEvent('download');await page.locator('[data-act="grade-export"]').click();
    const download=await downloadEvent;assert.ok((await readFile(await download.path(),'utf8')).includes('Exam'));
    await page.locator('[data-noor-grouping] > summary').click();
    assert.equal(await page.locator('[data-noor-item] option[value="40"]').count(),1);
    assert.equal(await page.locator('[data-noor-item] option[value="60"]').count(),1);
    await page.locator('[data-act="grade-noor-export"]').click();
    assert.ok(await page.locator('[data-noor-alert]').isVisible(),'Noor explicit confirmation guard remains');
    await page.locator('[data-grade-export-panel] > summary').click();
    await entry.focus();await page.keyboard.press('Enter');
    await page.locator('.n36-receiver').waitFor();
    await page.waitForFunction(()=>!!document.querySelector('[data-teacher-setup-style]')?.sheet);
    assert.equal(await page.locator('.n36-receiver').count(),1);
    assert.ok(await page.locator('[role="dialog"]').evaluate(el=>el.contains(document.activeElement)));
    assert.equal(await page.locator('[data-import-file]').getAttribute('accept'),'.json,application/json');
    await page.locator('[data-import-file]').setInputFiles({name:'reviewed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportedBundle))});
    await page.locator('[data-import-year]').waitFor();
    for(const [selector,value] of [['[data-import-year]','n73-year'],['[data-import-term]','n73-term'],['[data-import-map="classes"]','n73-source-section'],['[data-import-map="subjects"]','n73-subject']]) await page.locator(selector).selectOption(value);
    await page.locator('[data-import-plan]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-import-export]').disabled);
    assert.ok((await page.locator('[data-import-status]').innerText()).includes('لم تُطبّق'));
    const overflow=await page.locator('.sheet__body').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
    await page.screenshot({path:'test-results/n36-import-location/preview-'+width+'.png',fullPage:true});
    await page.keyboard.press('Escape');await page.locator('.n36-receiver').waitFor({state:'detached'});
    assert.ok(await entry.evaluate(el=>el===document.activeElement));
    await entry.click();await page.locator('.n36-receiver').waitFor();
    await page.getByRole('button',{name:'إلغاء',exact:true}).click();await page.locator('.n36-receiver').waitFor({state:'detached'});
    await entry.click();await page.locator('.n36-receiver').waitFor();
    await page.evaluate(()=>location.hash='#/teaching/n73-source');
    await page.locator('.n36-receiver').waitFor({state:'detached'});
    await page.evaluate(()=>history.back());await entry.waitFor();
    assert.equal(await entry.count(),1);
    await entry.click();await page.locator('.n36-receiver').waitFor();
    // An Auth callback refresh with the same identity keeps a valid preview.
    await page.evaluate(async id=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id},{user:{id},access_token:'synthetic-refreshed'});},owner);
    assert.equal(await page.locator('.n36-receiver').count(),1);
    await page.evaluate(async id=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id},{user:{id},access_token:'synthetic-other'});},foreignOwner);
    await page.locator('.n36-receiver').waitFor({state:'detached'});
    await entry.click();assert.equal(await page.locator('.n36-receiver').count(),0);
    assert.deepEqual(await checkpoint(page),before);assert.equal(serviceCalls,calls);
    assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    if(width===390) {
     await page.evaluate(async id=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id},{user:{id},access_token:'synthetic-returned'});},owner);
     await entry.click();await page.locator('.n36-receiver').waitFor();
     await page.evaluate(async()=>{const s=await import('/src/store.js');s.deactivateWorkspace();});
     await page.locator('.n36-receiver').waitFor({state:'detached'});
     assert.equal(await page.locator('[data-import-paste]').count(),0);
     assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
     record('workspace_deactivation_cleanup','Actual store workspace deactivation removes modal and private controls with zero writes.');
    }
    record('placement_preview_owner_zero_writes_'+width,'Actual app RTL grades/settings DOM and source CSS; one secondary entry, JSON parse/map/plan, Escape/cancel focus and back navigation cleanup, CSV review/cancel/export and Noor confirmation guard, same-owner Auth refresh and foreign-owner refusal; database/outbox unchanged, zero IDB writes and zero service calls after setup.');
   } finally {await context.close();}
  }
  // Hold the real lazy module response across owner drift: entry must refuse before opening.
  resetService();const context=await createContext({viewport:{width:390,height:900}});
  try {
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();await openReadyServedDemo(page,base);
   await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareAccount());
   await page.evaluate(()=>location.hash='#/teaching/n73-source/grades?import');
   await page.locator('[data-act="teacher-setup-import"]').waitFor();
   let release,seen;const requested=new Promise(r=>seen=r),gate=new Promise(r=>release=r);
   await context.route(base+'/src/views/teacher-setup-import.js',async route=>{seen();await gate;await route.continue();});
   await page.locator('[data-act="teacher-setup-import"]').click();await requested;
   await page.evaluate(async id=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id},{user:{id},access_token:'synthetic-other'});},foreignOwner);
   release();await page.waitForTimeout(400);assert.equal(await page.locator('.n36-receiver').count(),0);
   record('lazy_owner_drift','Owner switches while real lazy module is held: no receiver opens.');
  } finally {await context.close();}
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
} catch(error) {evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally {if(server.listening)await new Promise(done=>server.close(done));await writeFile('tests/n36-import-location.json',JSON.stringify(evidence,null,2)+'\n');}

