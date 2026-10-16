// AI: real restored registry + device metadata, actual app DOM/CSS, synthetic transport only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner,foreignOwner} from './n73-account-flow-fixture.mjs';
const baseline=process.argv.includes('--baseline'), service=syntheticService();
service.current.teachings=service.current.teachings.filter(row=>row.id!=='n73-second');
service.current.enrollments=[{id:'n104-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',status:'active',ownerId:owner,deleted:false}];
let authOwner=owner,authReads=0;
const root=resolve('.'),evidence={taskId:'continuous-n104-post-extension-restored-owner-class-journey-20261017',runId:'578aa07f-9d72-45b2-ba45-1036247a8ca9',baseSha:'a1e593d4fba7a415155256a2ddb222650cc89237',baseline,checks:[],measurements:[],errors:[]};
let browser,timer,leased=false;
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n104-post-extension-restored-owner-class-journey-20261017.json';
const runId='578aa07f-9d72-45b2-ba45-1036247a8ca9';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname.startsWith('/__n73/')) {
   let body='';for await(const chunk of req)body+=chunk;
   const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
  }
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside app root');
  let body=await readFile(file);
  if(baseline && ['/src/store.js','/src/views/students.js','/src/views/teaching-hub.js','/src/views/class-import-center.js'].includes(pathname))body=execFileSync('git',['show',evidence.baseSha+':'+pathname.slice(1)]);
  if(pathname==='/src/app.js')body=body.toString().replace('function paint() {','function paint() { window.__n104Paints=(window.__n104Paints||0)+1;');
  if(pathname==='/src/lib/cloud.js')body=body.toString()+'\nexport function __n104Notify() { notify(); }';
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');res.end(body);
 }catch(error){res.writeHead(404);res.end(error.message);}
});
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
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
 evidence.lease=lease('acquire');leased=true;
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49124,'127.0.0.1',done);});
 const base='http://127.0.0.1:49124';await mkdir('test-results/n104-post-n36',{recursive:true});
 browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),240000);timer.unref();
 for(const width of baseline?[390]:[320,390,768,1280]) {
  const context=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  try {
   await context.route('**/*',r=>{
    const u=new URL(r.request().url());if(u.origin===base)return r.continue();
    if(u.origin==='https://xlrubcwjqktzzunrvuns.supabase.co'&&u.pathname==='/auth/v1/user'&&r.request().method()==='GET'){authReads++;return r.fulfill({json:{id:authOwner}});}
    return r.abort('blockedbyclient');
   });
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>evidence.errors.push(e.message));
   await openReadyServedDemo(page,base);const ready=await prepare(page),id=ready.id;
   assert.equal(ready.lease.editable,true);const before=await checkpoint(page);
   if(baseline){
    await page.evaluate(async id=>{(await import('/src/store.js')).getTeaching(id).ownerId='foreign-synthetic-owner';},id);
    await visit(page,'#/teaching/'+id,'.class-hub');
    assert.equal(await page.locator('[data-act="paste-names"]').count(),0);
    assert.equal(await page.locator('[data-class-access-status]').count(),0);
    await visit(page,'#/teaching/'+id+'/students','[data-act="import"]');
    await page.locator('[data-act="import"]').first().click();assert.equal(await page.locator('#names-box').count(),0);
    await visit(page,'#/classes/koshoof?teaching='+id,'[data-existing-class]');
    assert.equal(await page.locator('[data-existing-class]').inputValue(),'');
    assert.equal(await page.locator('[data-class-access-status]').count(),0);
    await page.evaluate(async id=>{delete (await import('/src/store.js')).getTeaching(id).ownerId;(await import('/src/repaint.js')).repaint();},id);
    await page.waitForTimeout(100);assert.equal(await page.locator('[data-existing-class]').inputValue(),'');
    record('baseline_post_N36_silent_context_loss','Foreign class context silently discarded by central hub; matching restored owner after refresh still has no selected class. Hub hides paste/add without reason; Students renders buttons that only fail on click. No access granted.');
    assert.equal(await checkpoint(page),before);continue;
   }
   for(const phase of ['initial','reload']) {
    if(phase==='reload'){
     await page.reload({waitUntil:'load'});await page.locator('.boot').waitFor({state:'detached'});await page.waitForFunction(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return s.state.ready&&c.user?.id==='a7300000-0000-4000-8000-000000000001'&&s.getActiveWorkspace()?.type==='account'&&s.getOfflineLeaseStatus().editable;});
    }
    const proof=await page.evaluate(async()=>{
     const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),w=await import('/src/lib/workspaces.js'),c=await import('/src/lib/cloud.js');const registry=w.createWorkspaceRegistry();try{
      const authUser=c.user,workspace=s.getActiveWorkspace();if(!authUser||!s.state.ready||workspace?.type!=='account')throw Error('Current document not ready');
      const routing=await (await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser,registry});
      const record=(await registry.list()).find(r=>r.authUserId===authUser.id);
      return {routing,workspace:s.getActiveWorkspace(),database:d.getActiveDatabaseName(),device:(await d.get('device','device')).initialRestoreReceipt,receipt:record.restoreReceipt,ids:s.state.teachings.map(r=>r.id)};
     }finally{await registry.close();}
    });
    assert.equal(proof.routing.mode,'restored-account');assert.equal(proof.workspace.authUserId,owner);assert.equal(proof.database,proof.workspace.databaseName);assert.equal(proof.device.ownerId,owner);assert.equal(Object.hasOwn(proof.receipt,'ownerId'),false);assert.ok(proof.ids.includes(id));
    for(const tid of [id,'n73-source']){
     await visit(page,'#/classes',`.class-card__main[href="#/teaching/${tid}"]`);
     await page.locator(`.class-card__main[href="#/teaching/${tid}"]`).click();await page.locator('.class-hub').waitFor();
     if(tid===id)for(const [act,field]of [['paste-names','#names-box'],['add-student','#new-student']]){await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();await page.keyboard.press('Escape');}
     await visit(page,'#/teaching/'+tid+'/students','[data-act="import"]');
     for(const [act,field]of [['import','#names-box'],['add','#new-student']]){await page.locator(`[data-act="${act}"]`).first().click();await page.locator(field).waitFor();await page.keyboard.press('Escape');}
     await page.locator(`a[href="#/teaching/${tid}/koshoof"]`).first().click();await page.locator('[data-grade-import-panel]').waitFor();
     assert.equal(await page.locator('[data-existing-class]').inputValue(),tid);await page.locator('[data-n36-direct]').waitFor();
     await page.locator('[data-n36-advanced] summary').first().click();await page.locator('[data-change="grade-file"]').waitFor();
     await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();await page.locator('[data-koshoof-all]').waitFor();
     await page.locator('[data-act="koshoof-tab"][data-tab="import"]').click();await page.locator('[data-grade-import-panel]').waitFor();
     await page.goBack();await page.locator('.students-roster-page').waitFor();
    }
    // Same owner notifications and bounded paints must retain a live first-click handler and layout.
    await visit(page,'#/classes/koshoof?teaching='+id,'[data-grade-import-panel]');await page.waitForTimeout(120);
    const measure=()=>page.locator('[data-existing-class]').evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,hash:location.hash,paints:window.__n104Paints}));
    const start=await measure();for(let n=0;n<12;n++){await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({...c.user},{...c.session});c.__n104Notify();(await import('/src/repaint.js')).repaint();});await page.waitForTimeout(20);}
    const end=await measure();assert.equal(end.x,start.x);assert.equal(end.y,start.y);assert.equal(end.hash,start.hash);assert.ok(end.paints-start.paints<=13);evidence.measurements.push({width,phase,start,end});
    await page.locator('[data-existing-class]').selectOption('n73-source');await page.waitForTimeout(80);assert.equal(await page.locator('[data-existing-class]').inputValue(),'n73-source');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(await checkpoint(page),before);record('restored_first_click_navigation_'+width+'_'+phase,'Genuine begin/update/finalize receipt; current-document owner/database/device/registry checkpoint; empty+populated hub/Students paste/add, central N36 entry, file input, export/import/back; 12 stable paints and working change handler. No student/score/outbox changes.');
   }
   // Real denied DOM, no privileged controls, no transport and no student writes.
   await page.evaluate(async id=>{window.__case={row:(await import('/src/store.js')).getTeaching(id)};},id);
   for(const kind of ['foreign-owner','restore-mismatch','archived','closed-term','wrong-session','expired-lease']){
    await visit(page,'#/teaching/'+id,'[data-act="paste-names"]');
    await page.evaluate(async({id,kind})=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),row=s.getTeaching(id);window.__saved={owner:row.ownerId,receipt:structuredClone(s.state.device.initialRestoreReceipt),session:c.session,user:c.user,status:s.getSection(row.sectionId).status,term:s.getTerm(row.termId).status};
     if(kind==='foreign-owner')row.ownerId='foreign-synthetic-owner';if(kind==='restore-mismatch')s.state.device.initialRestoreReceipt.manifestHash='mismatch';
     if(kind==='archived')s.getSection(row.sectionId).status='archived';if(kind==='closed-term')s.getTerm(row.termId).status='closed';
     if(kind==='wrong-session')c.setMockAuth(c.user,{...c.session,user:{id:'foreign-synthetic-owner'}});
    },{id,kind});
    if(kind==='expired-lease')await page.clock.setFixedTime(new Date(Date.now()+15*86400000));
    // Click a still-rendered control after its underlying context has changed.
    // The actual action must reject and replace it with contextual feedback.
    if(['foreign-owner','restore-mismatch','expired-lease'].includes(kind)){
     await page.locator('[data-act="paste-names"]').click();await page.locator('[data-class-access-status]').waitFor();assert.equal(await page.locator('#names-box').count(),0);
    }
    let requests=0;const listener=()=>requests++;page.on('request',listener);
    for(const path of ['#/teaching/'+id,'#/teaching/'+id+'/students','#/classes/koshoof?teaching='+id]){
     evidence.currentCase={width,kind,path};
     await visit(page,path,'[data-class-access-status]');const status=page.locator('[data-class-access-status]');assert.ok((await status.innerText()).includes('العودة للفصول'));
     assert.equal(await page.locator('[data-act="paste-names"],[data-act="add-student"],[data-act="import"],[data-act="add"],[data-grade-import-panel],[data-n36-direct]').count(),0);
     assert.equal(await status.getAttribute('role'),'status');assert.doesNotMatch(await status.innerText(),/a7300000|foreign-synthetic|manifest|rakeezx-account|https?:/);
     assert.equal(await status.getAttribute('data-class-access-status'),kind==='expired-lease'?'lease':kind==='wrong-session'?'verification':['archived','closed-term'].includes(kind)?'archived':'ownership');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    }
    page.off('request',listener);assert.equal(requests,0);
    await page.screenshot({path:`test-results/n104-post-n36/${width}-${kind}.png`,fullPage:true});
    await page.clock.setFixedTime(new Date());
    await page.evaluate(async id=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),row=s.getTeaching(id),v=window.__saved;v.owner===undefined?delete row.ownerId:row.ownerId=v.owner;s.state.device.initialRestoreReceipt=v.receipt;s.getSection(row.sectionId).status=v.status;s.getTerm(row.termId).status=v.term;c.setMockAuth(v.user,v.session);await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:c.user.id,source:'supabase-auth-user',verifiedAt:Date.now()}));(await import('/src/repaint.js')).repaint();},id);
    await page.locator('[data-grade-import-panel]').waitFor();assert.equal(await page.locator('[data-existing-class]').inputValue(),id);assert.equal(await checkpoint(page),before);
    record('denied_and_recovered_'+width+'_'+kind,'One safe status+next action; no class controls, transport or student/score/outbox writes; original requested class reopens on same route after valid context returns.');
   }
   await visit(page,'#/classes/koshoof?import=1&extension='+'a'.repeat(32)+'&handoff='+'a1'.repeat(32),'[data-n36-handoff-status]');
   await page.locator('[data-n36-handoff-status]').filter({hasText:'تعذّر النقل'}).waitFor();
   assert.equal(await page.evaluate(()=>location.hash),'#/classes/koshoof?import=1');assert.equal(await checkpoint(page),before);
   record('direct_extension_entry_unavailable_'+width,'Actual handoff entry/afterPaint executes; loopback correctly refuses extension claim, shows safe fallback and clears nonce. Installed MV3 transport and official portals NOT_RUN; unchanged prior N36 transport evidence retained.');
  }finally{await context.close();}
 }
 assert.deepEqual(evidence.errors,[]);assert.equal(service.evidence.commits,0);evidence.authUserReads=authReads;
}catch(error){evidence.failure=error.stack;throw error;}
finally{
 clearTimeout(timer);if(browser)await browser.close();if(server.listening)await new Promise(done=>server.close(done));if(leased)evidence.release=lease('release');
 evidence.sourceHashes=Object.fromEntries(await Promise.all(['src/app.js','src/store.js','src/views/students.js','src/views/teaching-hub.js','src/views/class-import-center.js'].map(async file=>[file,createHash('sha256').update(baseline&&file!=='src/app.js'?execFileSync('git',['show',evidence.baseSha+':'+file]):await readFile(file)).digest('hex')])));
 await writeFile(baseline?'test-results/n104-post-n36/baseline.json':'tests/n104-post-n36-restored-class-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
