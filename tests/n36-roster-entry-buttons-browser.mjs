import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { exportedBundle, owner, foreignOwner } from './n36-receiver-fixture.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const root=resolve('.');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-class-roster-import-export-entries-20261015.json';
const runId='89d274f4-677e-4900-b7dd-274a6a98e36a';
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
  service.current.enrollments = [{id:'synthetic-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',status:'active',ownerId:owner,deleted:false}];
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
const evidence={runId,checks:[],errors:[]};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
try {
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49362,'127.0.0.1',done);});
 const base='http://127.0.0.1:49362';
 await mkdir('test-results/n36-roster-entries',{recursive:true});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,768,1280]) {
   resetService();
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
   try {
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(8000);
    page.on('pageerror',e=>evidence.errors.push(e.message));
    await openReadyServedDemo(page,base);
    const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareAccount());
    assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
    const before=await checkpoint(page),calls=serviceCalls;
    await page.evaluate(()=>{window.n36Writes=[];for(const name of ['put','add','delete','clear']){const original=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){window.n36Writes.push(this.name+':'+name);return original.apply(this,args);};}});
    for(const [id,suffix] of [['n73-target',''],['n73-source',''],['n73-source','/students'],['n73-target','/students']]) {
     const path=`#/teaching/${id}${suffix}`;
     const visit=async()=>{await page.evaluate(hash=>location.hash=hash,path);await page.locator('.roster-entry-actions').first().waitFor();};
     await visit();
     if(id==='n73-source')assert.equal(await page.locator(suffix?'.roster-row':'.class-stats-section').count(),1);
     const entry=page.locator('.roster-entry-actions');
     assert.equal(await entry.locator('[data-act="file-import"]').count(),1);
     assert.equal(await entry.locator('[data-act="file-export"]').count(),1);
     if(id==='n73-target'&&!suffix) {
      assert.equal(await page.locator('.roster-entry-empty a,.roster-entry-empty button').count(),4);
      for(const [act,field] of [['paste-names','#names-box'],['add-student','#new-student']]) {
       await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();
       if(act==='paste-names')await page.locator(field).fill('طالب اصطناعي للإلغاء');
       await page.getByRole('button',{name:'إلغاء',exact:true}).click();await page.locator(field).waitFor({state:'detached'});
      }
     }
     if(suffix)for(const [act,field] of [['import','#names-box'],['add','#new-student']]) {
      await page.locator(`[data-act="${act}"]`).first().click();await page.locator(field).waitFor();
      await page.getByRole('button',{name:'إلغاء',exact:true}).click();await page.locator(field).waitFor({state:'detached'});
     }
     for(const btn of await entry.locator('a,button').all()) {
      const b=await btn.boundingBox();assert.ok(b.height>=44&&b.width>=44,JSON.stringify(b));
      assert.ok(await btn.getAttribute('aria-label'));
     }
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await page.screenshot({path:`test-results/n36-roster-entries/${id}${suffix?'-students':''}-${width}.png`,fullPage:true});
     for(const mode of ['import','export']) {
      const link=page.locator(`.roster-entry-actions [data-act="file-${mode}"]`);
      assert.equal(await link.getAttribute('href'),`#/teaching/${id}/grades?${mode}=1`);
      await link.click();await page.locator(`[data-grade-${mode}-panel]`).waitFor();
      assert.equal(await page.locator(`[data-grade-${mode==='import'?'export':'import'}-panel]`).isVisible(),false);
      assert.equal(new URL(page.url()).hash,`#/teaching/${id}/grades?${mode}=1`);
      if(mode==='import')assert.equal(await page.locator('[data-act="teacher-setup-import"]').count(),1);
      if(mode==='export'&&id==='n73-target') {
       const event=page.waitForEvent('download');await page.locator('[data-act="grade-template"]').click();
       const csv=await readFile(await (await event).path(),'utf8');assert.match(csv,/اسم الطالب/);assert.match(csv,/Exam/);
       assert.equal(csv.trim().split(/\r?\n/).length,1);
      }
      await page.locator(`[data-grade-${mode}-panel] [data-act="grade-panel-close"]`).click();
      await visit();
     }
    }
    assert.deepEqual(await checkpoint(page),before);assert.equal(serviceCalls,calls);assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    record('rtl_routes_actions_zero_writes_'+width,'Actual account app DOM/CSS: empty hub four actions, populated hub and both rosters separate import/export, existing paste/add cancellation, exclusive N90 panels and empty header-only template; 44px labeled entry controls, no overflow, unchanged database/outbox and zero service requests or IDB writes. Screenshots: test-results/n36-roster-entries/*-'+width+'.png');
    // Exercise stale action handlers under archive and owner drift without writing fixtures.
    const negative=await page.evaluate(async()=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
     const v=(await import('/src/views/students.js')).default,h=(await import('/src/views/teaching-hub.js')).default;
     const teaching=s.getTeaching('n73-target'),section=s.getSection(teaching.sectionId),old={...section},hash=location.hash;
     section.archived=true;section.status='archived';
     const archived=s.isTeachingArchived(teaching);
     const hidden=!v.topActions({id:teaching.id})&&!h.render({id:teaching.id}).value.includes('data-act="paste-names"');
     for(const view of [v,h])for(const action of ['file-import','file-export'])view.actions[action](null,{preventDefault(){}},{id:teaching.id});
     Object.assign(section,old);delete section.archived;section.status=old.status;
     const session=c.session;c.setMockAuth({id:'foreign'},session);
     const foreignHidden=!v.topActions({id:teaching.id});
     for(const action of ['file-import','file-export','import','add'])await v.actions[action](null,{preventDefault(){}},{id:teaching.id});
     c.setMockAuth(session.user,session);
     const originalOwner=teaching.ownerId;teaching.ownerId='foreign';
     const foreignTeachingHidden=!v.topActions({id:teaching.id});
     for(const action of ['file-import','file-export'])v.actions[action](null,{preventDefault(){}},{id:teaching.id});
     teaching.ownerId=originalOwner;
     return {archived,hidden,foreignHidden,foreignTeachingHidden,unchanged:hash===location.hash,dialogs:document.querySelectorAll('#names-box,#new-student').length};
    });
    assert.deepEqual(negative,{archived:true,hidden:true,foreignHidden:true,foreignTeachingHidden:true,unchanged:true,dialogs:0});
    assert.deepEqual(await checkpoint(page),before);assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    record('archive_owner_stale_navigation_'+width,'Actual store archive and Auth drift: entry visibility and direct stale handlers refuse navigation or sheets; DB unchanged.');
   } finally {await context.close();}
  }
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
} catch(error) {evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally {if(server.listening)await new Promise(done=>server.close(done));evidence.ownedServerStopped=!server.listening;evidence.ownedBrowserClosed=true;await writeFile('tests/n36-roster-entry-buttons.json',JSON.stringify(evidence,null,2)+'\n');}

