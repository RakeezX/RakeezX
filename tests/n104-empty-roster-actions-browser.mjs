// AI: focused actual application DOM/CSS and existing synthetic restored-owner fixture.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
const taskId='continuous-n104-empty-roster-clear-actions-20261017',runId='255e13e0-c992-4f29-b579-d5c9d4c7820e';
const taskFile=`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const base='http://127.0.0.1:49134',root=resolve('.'),service=syntheticService();
service.current.teachings=service.current.teachings.filter(row=>row.id!=='n73-second');
service.current.enrollments=[{id:'n104-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',status:'active',ownerId:owner,deleted:false}];
const evidence={taskId,runId,baseSha:'aa6a1843c5102add77d61d1a3777c7916e376bb7',checks:[],screenshots:[],errors:[]};
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,base).pathname;
  if(pathname.startsWith('/__n73/')) {let body='';for await(const chunk of req)body+=chunk;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside app root');
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}
});
async function prepare(page) {
 return page.evaluate(async()=>{
  const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
  const w=await import('/src/lib/workspaces.js');
  const receipt={ownerId:f.owner,protocol:'CORE_V2',restoreId:'n104-real-restore',manifestHash:'n104-real-manifest',completedAt:Date.now()};
  s.state.device.initialRestoreReceipt=receipt;await d.put('device',s.state.device);
  const registry=w.createWorkspaceRegistry();let record,routing;
  try {
   await registry.beginAccountRestore(f.owner,receipt);
   await registry.updateAccountRestore(f.owner,receipt.restoreId,{phase:'RESTORE_COMPLETE'});
   record=await registry.finalizeAccountRestore(f.owner,receipt);
   if(Object.hasOwn(record.restoreReceipt,'ownerId'))throw Error('Real finalizer unexpectedly contains ownerId');
   routing=await (await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner},registry});
  }finally{await registry.close();}
  if(routing.status!=='ready'||routing.mode!=='restored-account')throw Error(JSON.stringify(routing));
  s.activateWorkspace(routing.workspace);
  await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  // The regression must use the actual local create entry, with no fabricated owner.
  const section=s.getSection('n73-second-section');
  const teaching=await s.createTeaching({sectionId:section.id,termId:'n73-term',subjectId:'n73-subject'});
  if(teaching.ownerId!=null)throw Error('Fixture lost the pending ownerless create regression');
  const legacy=s.getTeaching('n73-source');delete legacy.ownerId;await d.put('teachings',legacy);
  (await import('/src/repaint.js')).repaint();
  return {id:teaching.id,owner:teaching.ownerId??null,workspace:s.getActiveWorkspace(),lease:s.getOfflineLeaseStatus()};
 });
}
const checkpoint=page=>page.evaluate(async()=>{
 const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(d.STORES.filter(n=>!['device','profile','meta'].includes(n)).map(n=>d.getAll(n))));
});
async function visit(page,hash,selector){await page.evaluate(async h=>{if(location.hash===h)(await import('/src/repaint.js')).repaint();else location.hash=h;},hash);await page.locator(selector).first().waitFor();}

try {
 await mkdir('test-results/n104-empty-roster',{recursive:true});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49134,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,1280]) {
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
   try {
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>evidence.errors.push(e.message));
    await openReadyServedDemo(page,base);const ready=await prepare(page),id=ready.id;
    assert.equal(ready.lease.editable,true);const before=await checkpoint(page);
    for(const suffix of ['', '/students']) {
     await visit(page,'#/teaching/'+id+suffix,'.roster-entry-empty');
     assert.equal(await page.locator('.empty__title').innerText(),'لا يوجد طلاب في الفصل');
     assert.equal((await page.locator('.empty__text').innerText()).trim(),'الصق الأسماء، أو استورد الطلاب من ملف أو إضافة ركيز، أو أضف طالبًا يدويًا.');
     const buttons=page.locator('.roster-entry-empty .btn');
     assert.deepEqual((await buttons.allTextContents()).map(t=>t.trim()),['لصق الأسماء','إضافة طالب يدويًا','استيراد الطلاب']);
     assert.equal(await page.locator('.fab,#quick-paste-hint,[aria-describedby="quick-paste-hint"]').count(),0);
     assert.doesNotMatch(await page.locator('body').innerText(),/إضافة سريعة/);
     const boxes=await buttons.evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
     for(const b of boxes){assert.ok(b.h>=44);assert.ok(b.x>=0&&b.x+b.w<=width+1);}
     for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
     const screenshot=`test-results/n104-empty-roster/${width}-${suffix?'students':'hub'}.png`;
     await page.screenshot({path:screenshot,fullPage:true});evidence.screenshots.push(screenshot);
     await buttons.nth(0).click();await page.locator('#names-box').waitFor();assert.equal(await page.locator('#new-student').count(),0);await page.locator('[data-sheet-close]').filter({hasText:'إلغاء'}).click();
     await buttons.nth(1).click();await page.locator('#new-student').waitFor();assert.equal(await page.locator('#names-box').count(),0);await page.locator('[data-sheet-close]').filter({hasText:'إلغاء'}).click();
     await buttons.nth(2).click();await page.locator('[data-grade-import-panel]').waitFor();assert.equal(await page.locator('[data-existing-class]').inputValue(),id);
     assert.equal(await checkpoint(page),before);
     evidence.checks.push({name:`empty_${suffix?'students':'hub'}_${width}`,status:'PASS',evidence:'Exact title/guidance, ordered separated 44px actions, RTL without overflow; actual paste/manual sheets cancel and contextual Koshoof preselects owned class. No store writes.'});
    }
    await visit(page,'#/teaching/n73-source/students','.roster-row');
    assert.equal(await page.locator('.fab,#quick-paste-hint,[aria-describedby="quick-paste-hint"]').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/إضافة سريعة/);
    for(const [act,field]of [['import','#names-box'],['add','#new-student']]){await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();await page.locator('[data-sheet-close]').filter({hasText:'إلغاء'}).click();}
    const screenshot=`test-results/n104-empty-roster/${width}-populated.png`;await page.screenshot({path:screenshot,fullPage:true});evidence.screenshots.push(screenshot);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('[data-act="file-import"]').click();await page.locator('[data-grade-import-panel]').waitFor();assert.equal(await page.locator('[data-existing-class]').inputValue(),'n73-source');assert.equal(await checkpoint(page),before);
    evidence.checks.push({name:`populated_${width}`,status:'PASS',evidence:'No quick hint/FAB; top paste/manual/import handlers work on first click, cancel/contextual routing without store writes.'});
   }finally{await context.close();}
  }
 });
 assert.deepEqual(evidence.errors,[]);assert.equal(service.evidence.commits,0);
}catch(error){evidence.failure=error.stack;throw error;}
finally {
 if(server.listening)await new Promise(done=>server.close(done));
 evidence.sourceHashes=Object.fromEntries(await Promise.all(['src/views/students.js','src/views/teaching-hub.js','src/styles/components.css','src/store.js'].map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
 evidence.resources='Canonical isolated local browser owns/closes fresh contexts and browser; task-owned HTTP server closed in finally. No shared/live browser used.';
 await writeFile('tests/n104-empty-roster-actions-browser.json',JSON.stringify(evidence,null,2)+'\n');
}

