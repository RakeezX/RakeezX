import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { exportedBundle, owner, foreignOwner } from './n36-receiver-fixture.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const root=resolve('.');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-contextual-koshoof-hub-20261015.json';
const runId='4b93857e-4598-4fe3-abdd-c0e0c0d42b4e';
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
const evidence={taskId:'continuous-n36-contextual-koshoof-hub-20261015',runId,baseSha:'67e0f71a54b5374cd1fccbb74f4b6d9666944b56',checks:[],errors:[]};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
try {
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49366,'127.0.0.1',done);});
 const base='http://127.0.0.1:49366';
 await mkdir('test-results/n36-koshoof-context',{recursive:true});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const theme of ['light','dark']) for(const width of [320,390,768,1280]) {
   resetService();
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA',colorScheme:theme});
   try {
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(8000);
    page.on('pageerror',e=>evidence.errors.push(e.message));
    await openReadyServedDemo(page,base);
    const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareAccount());
    assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
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
     await page.screenshot({path:`test-results/n36-koshoof-context/${id}${suffix?'-students':''}-${theme}-${width}.png`,fullPage:true});
     for(const mode of ['import','export']) {
      const link=page.locator(`.roster-entry-actions [data-act="file-${mode}"]`);
      assert.equal(await link.getAttribute('href'),`#/teaching/${id}/koshoof?${mode}=1`);
      await link.click();await page.locator(`[data-grade-${mode}-panel]`).waitFor();
      assert.equal(await page.locator(`[data-grade-${mode==='import'?'export':'import'}-panel]`).isVisible(),false);
      assert.equal(new URL(page.url()).hash,`#/teaching/${id}/koshoof?${mode}=1`);
      assert.equal(await page.locator('.grades-01c,.grades-page-head').count(),0);
      assert.equal(await page.locator('.koshoof-modes a').count(),2);
      for(const btn of await page.locator('.koshoof-modes a').all()) { const b=await btn.boundingBox(); assert.ok(b.height>=44&&b.width>=44); }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`test-results/n36-koshoof-context/workspace-${id}-${mode}-${theme}-${width}.png`,fullPage:true});
      const other=mode==='import'?'export':'import';
      await page.locator(`[data-act="koshoof-mode"][data-panel="${other}"]`).focus();await page.keyboard.press('Enter');
      await page.locator(`[data-grade-${other}-panel]`).waitFor();
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-current')==='page');
      await page.locator(`[data-act="koshoof-mode"][data-panel="${mode}"]`).click();await page.locator(`[data-grade-${mode}-panel]`).waitFor();
      if(mode==='import')assert.equal(await page.locator('[data-act="teacher-setup-import"]').count(),1);
      if(mode==='export'&&id==='n73-target') {
       const event=page.waitForEvent('download');await page.locator('[data-act="grade-template"]').click();
       const csv=await readFile(await (await event).path(),'utf8');assert.match(csv,/اسم الطالب/);assert.match(csv,/Exam/);
       assert.equal(csv.trim().split(/\r?\n/).length,1);
      }
      await page.locator(`[data-grade-${mode}-panel] [data-act="grade-panel-close"]`).click();
      await page.waitForFunction(h=>location.hash===h,path);
      await page.waitForFunction(()=>document.activeElement?.matches('.roster-entry-actions a'));
      await visit();
     }
    }
    for(const origin of ['#/classes','#/teaching/n73-source/grades']) {
     await page.evaluate(h=>location.hash=h,origin);
     const link=page.locator(origin==='#/classes'?'.class-card__actions a[href="#/teaching/n73-source/koshoof"]':'.grade-transfer__toolbar a[href="#/teaching/n73-source/koshoof?import=1"]');
     await link.waitFor();
     assert.equal(await page.locator('[data-grade-transfer]').count(),0);
     const bounds=await link.boundingBox();assert.ok(bounds.height>=44);
     await link.click();await page.locator('[data-grade-import-panel]').waitFor();
     await page.locator('[data-act="app-back"]').click();await page.waitForFunction(h=>location.hash===h,origin);
     await page.waitForFunction(()=>document.activeElement?.getAttribute('href')?.includes('/koshoof'));
    }
    for(const mode of ['import','export']) {
     await page.evaluate(h=>location.hash=h,`#/teaching/n73-source/koshoof?${mode}=1`);
     await page.locator(`[data-grade-${mode}-panel]`).waitFor();
     if(mode==='export') {
      const download=async act=>{const event=page.waitForEvent('download');await page.locator(`[data-act="${act}"]`).click();return readFile(await (await event).path(),'utf8');};
      const blank=await download('grade-template'),filled=await download('grade-export');
      assert.match(blank,/طالب تجريبي/);assert.match(filled,/19/);assert.notEqual(blank,filled);
     } else {
      await page.locator('[data-change="grade-file"]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب,Exam (العظمى 20)\nطالب تجريبي,0\nطالب جديد,25')});
      await page.locator('[data-grade-file-name]').waitFor();
      await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
      assert.match(await page.locator('[data-grade-review]').innerText(),/أسماء جديدة/);
      await page.locator('[data-act="grade-import-mode"][data-mode="grades"]').click();
      await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
      assert.match(await page.locator('[data-grade-review]').innerText(),/25→20/);
      assert.match(await page.locator('[data-grade-review]').innerText(),/19 ← 0/);
      await page.locator('[data-grade-match-confirm]').check();
      await page.locator('[data-act="koshoof-mode"][data-panel="export"]').click();await page.locator('[data-grade-export-panel]').waitFor();
      await page.locator('[data-act="koshoof-mode"][data-panel="import"]').click();await page.locator('[data-grade-import-panel]').waitFor();
      assert.match(await page.locator('[data-grade-review]').innerText(),/25→20/);
      assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`test-results/n36-koshoof-context/grades-review-${theme}-${width}.png`,fullPage:true});
      await page.locator('[data-act="grade-cancel"]').click();
     }
    }
    assert.deepEqual(await checkpoint(page),before);assert.equal(serviceCalls,calls);assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    record('rtl_routes_actions_zero_writes_'+theme+'_'+width,'Actual account app DOM/CSS: empty hub four actions, populated hub and both rosters separate import/export, existing paste/add cancellation, exclusive standalone N90 workspace, review retains across modes with fresh consent, zero/cap review and empty header-only template; 44px labeled entry controls, no overflow, unchanged database/outbox and zero service requests or IDB writes. Screenshots: test-results/n36-koshoof-context/*-'+width+'.png');
    // Exercise stale action handlers under archive and owner drift without writing fixtures.
    const negative=await page.evaluate(async()=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
     const v=(await import('/src/views/students.js')).default,h=(await import('/src/views/teaching-hub.js')).default;
     const k=(await import('/src/views/grades.js')).koshoofView;
     const teaching=s.getTeaching('n73-target'),section=s.getSection(teaching.sectionId),old={...section},hash=location.hash;
     section.archived=true;section.status='archived';
     const archived=s.isTeachingArchived(teaching);
     if(k.render({id:teaching.id}).value.includes('data-grade-transfer'))throw Error('Archived workspace exposed');
     const hidden=!v.topActions({id:teaching.id})&&!h.render({id:teaching.id}).value.includes('data-act="paste-names"');
     for(const view of [v,h])for(const action of ['file-import','file-export'])view.actions[action](null,{preventDefault(){}},{id:teaching.id});
     Object.assign(section,old);delete section.archived;section.status=old.status;
     const session=c.session;c.setMockAuth({id:'foreign'},session);
     const foreignHidden=!v.topActions({id:teaching.id});
     if(k.render({id:teaching.id}).value.includes('data-grade-transfer'))throw Error('Foreign account workspace exposed');
     k.actions['grade-file']({files:[]},null,{id:teaching.id});
     for(const action of ['file-import','file-export','import','add'])await v.actions[action](null,{preventDefault(){}},{id:teaching.id});
     c.setMockAuth(session.user,session);
     const originalOwner=teaching.ownerId;teaching.ownerId='foreign';
     const foreignTeachingHidden=!v.topActions({id:teaching.id});
     if(k.render({id:teaching.id}).value.includes('data-grade-transfer'))throw Error('Foreign teaching exposed');
     if(k.render({id:'unknown'}).value.includes('data-grade-transfer'))throw Error('Unknown teaching exposed');
     for(const action of ['file-import','file-export'])v.actions[action](null,{preventDefault(){}},{id:teaching.id});
     teaching.ownerId=originalOwner;
     return {archived,hidden,foreignHidden,foreignTeachingHidden,unchanged:hash===location.hash,dialogs:document.querySelectorAll('#names-box,#new-student').length};
    });
    assert.deepEqual(negative,{archived:true,hidden:true,foreignHidden:true,foreignTeachingHidden:true,unchanged:true,dialogs:0});
    assert.deepEqual(await checkpoint(page),before);assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    record('archive_owner_stale_navigation_'+theme+'_'+width,'Actual store archive and Auth drift: entry visibility and direct stale handlers refuse navigation or sheets; DB unchanged.');
    // Render real denial states in the actual application, with transient synthetic store drift.
    await page.evaluate(()=>location.hash='#/teaching/n73-target/koshoof?import=1');
    await page.locator('[data-grade-import-panel]').waitFor();
    for(const kind of ['owner','archive','teaching']) {
     await page.evaluate(async kind=>{
      const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
      const teaching=s.getTeaching('n73-target'),section=s.getSection(teaching.sectionId);
      window.restoreKoshoof=()=>{};
      if(kind==='owner') { const session=c.session;c.setMockAuth({id:'foreign'},session);window.restoreKoshoof=()=>c.setMockAuth(session.user,session); }
      if(kind==='archive') { const old={...section};section.archived=true;section.status='archived';window.restoreKoshoof=()=>{delete section.archived;Object.assign(section,old);}; }
      if(kind==='teaching') { const old=teaching.ownerId;teaching.ownerId='foreign';window.restoreKoshoof=()=>{teaching.ownerId=old;}; }
      (await import('/src/repaint.js')).repaint();
     },kind);
     await page.getByText('الكشوف غير متاحة لهذا الفصل',{exact:true}).waitFor();
     assert.equal(await page.locator('[data-grade-transfer]').count(),0);
     await page.evaluate(async()=>{window.restoreKoshoof();(await import('/src/repaint.js')).repaint();});
     await page.locator('[data-grade-import-panel]').waitFor();
    }
    await page.evaluate(()=>location.hash='#/teaching/unknown/koshoof?export=1');
    await page.getByText('الكشوف غير متاحة لهذا الفصل',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-grade-transfer]').count(),0);
    await page.evaluate(async()=>{
     const lease=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();lease.invalidate('synthetic-read-only');
     location.hash='#/teaching/n73-target/koshoof?import=1';
    });
    await page.getByText('الكشوف غير متاحة لهذا الفصل',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-grade-transfer]').count(),0);
    assert.deepEqual(await checkpoint(page),before);assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
    record('rendered_denials_'+theme+'_'+width,'Actual HTTP application paints refusal with no transfer controls for owner/account drift, archived/foreign/unknown teaching and invalid writable lease. No Product writes.');

   } finally {await context.close();}
  }
 });
 const shell=await readFile('sw.js','utf8');
 for(const file of ['src/router.js','src/views/grades.js','src/views/students.js','src/views/teachings.js','src/styles/grades.css','src/styles/components.css']) assert.ok(shell.includes("'./"+file+"'"),file+' missing from existing offline shell');
 record('offline_route_cached_module_composition','New hash route loads the existing precached grades.js named export; all dependencies and changed CSS remain in existing shell. No new runtime module. This is shell coverage, not Service Worker/offline-cache certification.');
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
} catch(error) {evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally {if(server.listening)await new Promise(done=>server.close(done));evidence.ownedServerStopped=!server.listening;evidence.ownedBrowserClosed=true;evidence.sourceSha256={};for(const file of ['src/router.js','src/views/grades.js','src/views/students.js','src/views/teachings.js','src/styles/grades.css','src/styles/components.css','sw.js','tests/n36-koshoof-context-browser.mjs'])evidence.sourceSha256[file]=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile('tests/n36-koshoof-context-browser.json',JSON.stringify(evidence,null,2)+'\n');}

