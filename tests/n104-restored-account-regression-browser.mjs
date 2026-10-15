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
const root=resolve('.'),evidence={taskId:'continuous-n104-restored-account-receipt-access-20261015',runId:'6b10c314-8168-411e-bc76-e0f66a0dff08',baseSha:'b49075222a4192128831297d6e5a863027884ded',baseline,checks:[],measurements:[],errors:[]};
let browser,timer;
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
  if(baseline && pathname==='/src/store.js')body=execFileSync('git',['show','b49075222a4192128831297d6e5a863027884ded:src/store.js']);
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
 const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['students','enrollments','scores','scoreSubitems','scoreSubitemCompletions','outbox'].map(n=>d.getAll(n))));
});
async function visit(page,hash,selector){await page.evaluate(h=>location.hash=h,hash);await page.locator(selector).first().waitFor();}
try {
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49114,'127.0.0.1',done);});
 const base='http://127.0.0.1:49114';await mkdir('test-results/n104',{recursive:true});
 browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),180000);timer.unref();
 for(const width of baseline?[390]:[320,390,1280]) {
  const context=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  try {
   await context.route('**/*',r=>{
    const url=new URL(r.request().url());
    if(url.origin===base)return r.continue();
    // Fulfill locally; never connect to Auth or any real service.
    if(url.origin==='https://xlrubcwjqktzzunrvuns.supabase.co' && url.pathname==='/auth/v1/user' && r.request().method()==='GET'){authReads++;return r.fulfill({json:{id:authOwner}});}
    return r.abort('blockedbyclient');
   });
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>evidence.errors.push(e.message));
   await openReadyServedDemo(page,base);const ready=await prepare(page);assert.equal(ready.lease.editable,true);
   let before=await checkpoint(page);const ids=[ready.id,'n73-source'];
   await visit(page,'#/classes','.class-card__main');await page.waitForTimeout(200);
   const measure=()=>page.locator('.class-card__main').first().evaluate(el=>({paints:window.__n104Paints,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}));
   const start=await measure();
   for(let i=0;i<12;i++){await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({...c.user},{...c.session});c.__n104Notify();});await page.waitForTimeout(25);}
   await page.waitForTimeout(150);const end=await measure();evidence.measurements.push({width,start,end,delta:end.paints-start.paints});
   if(baseline){
    const allowed=await page.evaluate(async id=>(await import('/src/views/students.js')).canOpenRoster({id}),ready.id);assert.equal(allowed,false);
    await visit(page,'#/teaching/'+ready.id+'/students','[data-act="import"]');await page.locator('[data-act="import"]').first().click();
    await page.getByText('تعذّر فتح كشف هذا الفصل. تحقق من الحساب والفصل النشط.').waitFor();assert.equal(await page.locator('#names-box').count(),0);
    await visit(page,'#/teaching/n73-source/koshoof?import=1','.empty__title');assert.equal(await page.locator('[data-grade-import-panel]').count(),0);
    record('baseline_real_restore_denied','Base store with genuine finalizer receipt denies empty paste and populated koshoof; not a fabricated receipt.');continue;
   }
   assert.ok(end.paints-start.paints<=1,JSON.stringify({start,end}));assert.equal(end.y,start.y);assert.equal(end.x,start.x);
   for(const phase of ['initial','reload']) {
   if(phase==='reload') {
    await page.reload({waitUntil:'load'});await page.locator('.boot').waitFor({state:'detached'});
    await page.waitForFunction(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return c.user?.id==='a7300000-0000-4000-8000-000000000001'&&s.state.ready&&s.getActiveWorkspace()?.type==='account'&&s.getOfflineLeaseStatus().editable;});
    const boot=await page.evaluate(async()=>{
     const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),w=await import('/src/lib/workspaces.js'),c=await import('/src/lib/cloud.js');
     const registry=w.createWorkspaceRegistry();try{
      const routing=await (await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:c.user,registry});
      const records=await registry.list();return {routing,workspace:s.getActiveWorkspace(),db:d.getActiveDatabaseName(),device:(await d.get('device','device'))?.initialRestoreReceipt,record:records.find(r=>r.authUserId===s.getActiveWorkspace()?.authUserId),ids:s.state.teachings.map(r=>r.id)};
     }finally{await registry.close();}
    });
    assert.equal(boot.routing.status,'ready');assert.equal(boot.routing.mode,'restored-account');assert.equal(boot.workspace.authUserId,owner);assert.equal(boot.db,boot.workspace.databaseName);assert.equal(boot.device.ownerId,owner);assert.equal(Object.hasOwn(boot.record.restoreReceipt,'ownerId'),false);assert.equal(boot.workspace.leaseGeneration,boot.routing.workspace.leaseGeneration);for(const id of ids)assert.ok(boot.ids.includes(id));
   }
   await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');for(let i=0;i<3;i++)await c.verifyCurrentAuthIdentity(c.user.id);});
   for(const id of ids) {
    await visit(page,'#/classes',`.class-card__main[href="#/teaching/${id}"]`);
    const card=page.locator(`.class-card__main[href="#/teaching/${id}"]`);await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.evaluate(async()=>(await import('/src/lib/cloud.js')).__n104Notify());await page.waitForTimeout(35);await page.mouse.up();await page.locator('.class-hub').waitFor();assert.equal(new URL(page.url()).hash,'#/teaching/'+id);
    if(id===ready.id)for(const [act,field]of [['paste-names','#names-box'],['add-student','#new-student']]){
     await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();await page.keyboard.press('Escape');await page.locator(field).waitFor({state:'detached'});
    }
    for(const suffix of ['', '/students','/grades']) {
     await visit(page,'#/teaching/'+id+suffix,suffix==='/grades'?'.grade-transfer__toolbar':'.roster-entry-actions');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
     if(suffix==='/students')for(const [act,field]of [['import','#names-box'],['add','#new-student']]){
      await page.locator(`[data-act="${act}"]`).first().click();await page.locator(field).waitFor();await page.keyboard.press('Escape');await page.locator(field).waitFor({state:'detached'});
     }
     for(const mode of ['import','export']){
      const path='#/teaching/'+id+suffix;
      await page.locator(`a[href="#/teaching/${id}/koshoof?${mode}=1"]`).first().click();await page.locator(`[data-grade-${mode}-panel]`).waitFor();
      await page.screenshot({path:`test-results/n104/${width}-${phase}-${id===ready.id?'empty':'populated'}-${suffix.replace('/','')||'hub'}-${mode}.png`,fullPage:true});
      await visit(page,path,suffix==='/grades'?'.grade-transfer__toolbar':'.roster-entry-actions');
     }
    }
    await visit(page,'#/classes',`.class-card__actions a[href="#/teaching/${id}/koshoof"]`);
    await page.locator(`.class-card__actions a[href="#/teaching/${id}/koshoof"]`).click();await page.locator('[data-grade-import-panel]').waitFor();
   }
   assert.equal(await checkpoint(page),before);
   record('restored_actions_'+width+'_'+phase,'Real ownerless registry finalizer receipt; actual empty create + preexisting ownerless class. Classes/hub/Students/grades/Koshoof sheets opened by clicks, cancel only; Auth /user refresh passes; the reload phase checks owner/DB/receipt/generation in its own document. Student/grade/outbox checkpoint unchanged.');
   }
   if(width===390) {
    // Guard matrix uses the real store/view entry and rejects before any write.
    const result=await page.evaluate(async({id,owner,foreignOwner})=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),d=await import('/src/lib/db.js');
     const {runtimeSyncOwnershipGuard:g}=await import('/src/lib/sync-ownership.js');
     const {canOpenRoster}=await import('/src/views/students.js');const {koshoofView}=await import('/src/views/grades.js');
     const row=s.getTeaching(id),workspace=s.getActiveWorkspace(),session=c.session,user=c.user,device=structuredClone(s.state.device);
     const results=[];const check=async name=>{location.hash='#/teaching/'+id+'/koshoof?import=1';(await import('/src/repaint.js')).repaint();await new Promise(done=>setTimeout(done,35));results.push({name,roster:canOpenRoster({id}),panel:!!document.querySelector('[data-grade-import-panel]'),denial:document.querySelector('.empty__title')?.textContent});};
     const initial=JSON.stringify(await d.getAll('outbox'));
     const reset=async()=>{Object.assign(row,{termId:'n73-term',deleted:false});delete row.ownerId;c.setMockAuth(user,session);g.setWorkspace(workspace);s.state.device=structuredClone(device);s.getOfflineLeaseStatus();await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));if(!canOpenRoster({id}))throw Error('Negative case did not restore a valid checkpoint');};
     for(const [field,value] of [['protocol','CORE_V1'],['restoreId','wrong-restore'],['manifestHash','wrong-manifest'],['completedAt',device.initialRestoreReceipt.completedAt+1]]){
      s.state.device.initialRestoreReceipt[field]=value;await check('device-'+field);await reset();
     }
     for(const [field,value] of [['ownerId',foreignOwner],['protocol','CORE_V1'],['restoreId','wrong-restore'],['manifestHash','wrong-manifest'],['completedAt',device.initialRestoreReceipt.completedAt+1]]){
      const generation=JSON.parse(workspace.leaseGeneration);generation[2][field]=value;
      s.activateWorkspace({...workspace,leaseGeneration:JSON.stringify(generation)});
      await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
      await check('registry-'+field);s.activateWorkspace(workspace);await reset();
     }
     row.ownerId=foreignOwner;await check('foreign-owner');await reset();
     row.deleted=true;await check('deleted');await reset();
     c.setMockAuth(user,{...session,user:{id:foreignOwner}});await check('wrong-session');await reset();
     c.setMockAuth({id:foreignOwner},session);await check('wrong-user');await reset();
     g.setWorkspace({...workspace,authUserId:foreignOwner});await check('owner-drift');await reset();
     g.setWorkspace({type:'unresolved'});await check('missing-bound-workspace');await reset();
     g.setWorkspace({...workspace,databaseName:'foreign-database'});await check('foreign-db');await reset();
     d.closeDB();d.selectDatabase(await (await import('/src/lib/workspaces.js')).accountWorkspaceDatabaseName(foreignOwner));await check('selected-db-drift');d.closeDB();d.selectDatabase(workspace.databaseName);await reset();
     row.termId='missing-term';await check('wrong-term');await reset();
     const term=s.getTerm('n73-term'),status=term.status;term.status='closed';await check('closed-term');term.status=status;await reset();
     const sec=s.getSection(row.sectionId),statusBefore=sec.status;sec.status='archived';await check('archived');sec.status=statusBefore;await reset();
     sec.ownerId=foreignOwner;await check('foreign-parent');sec.ownerId=owner;await reset();
     c.setMockAuth(user,null);await check('missing-session');await reset();
     s.state.ready=false;await check('not-ready');s.state.ready=true;await reset();
     delete row.ownerId;s.state.device.initialRestoreReceipt.ownerId=foreignOwner;await check('foreign-provenance');await reset();
     delete row.ownerId;delete s.state.device.initialRestoreReceipt;await check('missing-provenance');await reset();
     localStorage.removeItem(c.AUTH_STORAGE_KEY);await check('stale-auth-storage');localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));await reset();
     return {results,outboxUnchanged:initial===JSON.stringify(await d.getAll('outbox'))};
    },{id:ready.id,owner,foreignOwner});
    for(const row of result.results){assert.equal(row.roster,false,JSON.stringify(row));assert.equal(row.panel,false,JSON.stringify(row));assert.equal(row.denial,'الكشوف غير متاحة لهذا الفصل',JSON.stringify(row));}assert.equal(result.outboxUnchanged,true);
    authOwner=foreignOwner;
    const wrongUser=await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');try{await c.verifyCurrentAuthIdentity(c.user.id);return null;}catch(e){return e.code;}});assert.equal(wrongUser,'AUTH_OWNER_MISMATCH');
    assert.equal(await page.evaluate(async id=>(await import('/src/views/students.js')).canOpenRoster({id}),ready.id),false);
    authOwner=owner;await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(()=>c.verifyCurrentAuthIdentity(c.user.id));});
    await context.setOffline(true);
    assert.equal(await page.evaluate(async id=>(await import('/src/views/students.js')).canOpenRoster({id}),ready.id),true);
    await visit(page,'#/teaching/'+ready.id+'/koshoof?export=1','[data-grade-export-panel]');
    await visit(page,'#/teaching/'+ready.id+'/students','[data-act="import"]');await page.locator('[data-act="import"]').first().click();await page.locator('#names-box').waitFor();await page.keyboard.press('Escape');
    await page.clock.setFixedTime(new Date(Date.now()+15*86400000));
    const denied=await page.evaluate(async id=>({roster:(await import('/src/views/students.js')).canOpenRoster({id}),html:String((await import('/src/views/grades.js')).koshoofView.render({id}))}),ready.id);
    assert.equal(denied.roster,false);assert.ok(denied.html.includes('الكشوف غير متاحة'));
    await page.locator('[data-act="import"]').first().click();await page.getByText('تعذّر فتح كشف هذا الفصل. تحقق من الحساب والفصل النشط.').waitFor();assert.equal(await page.locator('#names-box').count(),0);
    assert.equal(await checkpoint(page),before);record('negative_owner_session_term_lease',JSON.stringify(result.results)+'; valid offline lease opens sheet; expired lease denies with visible warning; no write.');
   }
  }finally{await context.close();}
 }
 assert.deepEqual(evidence.errors,[]);assert.equal(service.evidence.commits,0);evidence.authUserReads=authReads;
}catch(error){evidence.failure=error.stack;throw error;}
finally{clearTimeout(timer);if(browser)await browser.close();await new Promise(done=>server.close(done));evidence.sourceHashes=Object.fromEntries(await Promise.all(['src/app.js','src/store.js','src/views/students.js','src/views/grades.js'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));await writeFile(baseline?'test-results/n104/restored-baseline.json':'tests/n104-restored-account-regression.json',JSON.stringify(evidence,null,2)+'\n');}
