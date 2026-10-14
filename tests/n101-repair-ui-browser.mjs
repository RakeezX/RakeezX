// AI: actual HTTP app/CSS/handlers and real owner-guarded store on disposable IndexedDB.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n101-repair-entry-eligibility-ui-20261014', runId='9afdbe60-025a-4e98-8f55-9a99e5f24e48';
const root=resolve('.'), A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bridge='\nexport const repairUITest={refresh:refreshSyncOperationalUI,open:openSessionRepairReview,hub:openTeacherMiniHubSheet,resolve,actions:GLOBAL_ACTIONS,setSync(value){syncModule=value;}};';
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname, file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');
 const source=await readFile(file);res.end(pathname==='/src/app.js'?source.toString()+bridge:source);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
await mkdir('test-results',{recursive:true});
try {await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:120000},async({createContext})=>{
for(const width of [390,1280]){
 const context=await createContext({viewport:{width,height:844},locale:'ar-SA'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('[data-workspace-login]').waitFor();
 await page.evaluate(async({A})=>{
  const app=await import('/src/app.js'),s=await import('/src/store.js'),db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
  const dom=await import('/src/lib/dom.js'),router=await import('/src/router.js');
  window.h=app.repairUITest;window.s=s;window.db=db;window.c=c;
  c.setMockAuth({id:A},{access_token:'synthetic-only',user:{id:A}});localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(c.session));
  db.selectDatabase(await (await import('/src/lib/workspaces.js')).accountWorkspaceDatabaseName(A));await db.openDB();
  s.activateWorkspace({id:'synthetic-A',type:'account',authUserId:A,databaseName:db.getActiveDatabaseName(),broadcastChannelName:'synthetic-n101-ui-'+innerWidth,ownershipState:'claimed',syncEligible:true,leaseGeneration:JSON.stringify(['synthetic',null,null,null])});
  s.getOfflineLeaseStatus();await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async owner=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  s.state.ready=true;s.state.profile={id:'profile',teacherName:'Synthetic Teacher',schoolName:'Synthetic',phone:'0500000001'};s.state.device={id:'device',theme:'light'};
  window.summary={state:'rejected',rejectedCount:1,blockedCount:63,pendingCount:0,failedCount:0,queuedCount:64,affectedCategories:['academic'],actionableSyncIssue:true,localWorkSaved:true};
  window.mode='false';window.h.setSync({getSyncOperationalSummary:async()=>summary,getSyncOperationalSummarySnapshot:()=>summary,syncAll:async()=>{
   if(mode==='delayed')await new Promise(r=>window.releaseRetry=r);
   if(mode==='error')throw Error('خطأ مصطنع في الاتصال');
   if(mode==='success'){
    const audit=(await db.getAll('outbox')).find(r=>r.id==='session-repair:v2:original');await db.put('outbox',{...audit,state:'verified'});
   }
   return mode==='success'||mode==='unverified';
  }});
  dom.delegate(document.getElementById('app'),()=>h.actions);dom.delegate(document.getElementById('modal-root'),()=>h.actions);
  router.onNavigate(h.resolve);location.hash='/classes';await h.resolve();
  await db.put('outbox',{id:'year-rejected',ownerId:A,protocol:'v2',store:'years',entity:'years',state:'rejected',lastError:{message:'YEAR',code:'22023'}});
  for(let i=0;i<63;i++)await db.put('outbox',{id:'blocked-'+i,ownerId:A,store:'calendarDays',state:'blocked'});
  await h.refresh();
 },{A});
 await page.locator('.layout').waitFor();
 await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();
 await page.locator('.mini-hub-sync').waitFor();
 assert.equal(await page.locator('[data-act="review-session-repair"]').count(),0);
 assert.match(await page.locator('.mini-hub-sync').innerText(),/تعذر اعتماد|الدعم/);
 assert.equal(await page.locator('.mini-hub-sync a[href="#/support"]').count(),1);
 await page.locator('.mini-hub-sync summary').click();assert.match(await page.locator('.mini-hub-sync').innerText(),/63/);
 await page.screenshot({path:`test-results/n101-repair-ui-year-${width}.png`});
 // A stale entry is deliberately invoked via the real action, with the actual empty store plan.
 await page.evaluate(()=>{void h.actions['review-session-repair']();});
 await page.locator('[data-session-repair-review]').waitFor();
 assert.match(await page.locator('[data-session-repair-review]').innerText(),/لا توجد حصص مؤهلة/);
 assert.equal(await page.locator('[data-confirm-session-repair]').count(),0);
 assert.equal(await page.locator('[data-retry-session-repairs]').isVisible(),false);
 await page.locator('[data-repair-support]').click();await page.waitForURL('**/#/support');await page.locator('#main .page').waitFor();
 await page.waitForFunction(()=>document.activeElement?.id==='main');
 assert.equal(await page.locator('.sheet-backdrop').count(),0);assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
 // Qualifying session fixture follows the existing engine fixture exactly; no mock plan.
 await page.evaluate(async({A})=>{
  await db.clearAll();const auth=x=>({...x,serverRevision:1,deleted:false});
  const data={years:[auth({id:'y',hijriStart:1448,hijriEnd:1449,label:'1448',calendarPresetId:'sa-western-1448-1449',fieldRevisions:{calendar_selection:3}})],terms:[auth({id:'term',yearId:'y',name:'term',startDate:'2026-08-01',endDate:'2026-12-31'})],sections:[auth({id:'section',yearId:'y',name:'class'})],subjects:[auth({id:'subject'})],teachings:[auth({id:'teaching',termId:'term',sectionId:'section',subjectId:'subject'})],sessions:[{id:'session',canonicalId:'session',teachingId:'teaching',date:'2026-10-14',period:1,status:'planned',serverRevision:0,deleted:false}],outbox:[{id:'v2:original',protocol:'v2',entity:'sessions',store:'sessions',recordId:'session',serverRecordId:'session',logicalRecordKey:'sessions:session',ownerId:A,mutationId:'original',deviceId:'synthetic',op:'create',state:'rejected',baseRevision:0,queuedAt:Date.parse('2026-10-14T12:00:00Z'),sequence:1,envelopeLocked:true,attemptCount:1,localPatch:{teachingId:'teaching',date:'2026-10-14',period:1,status:'planned'},patch:{teaching_id:'teaching',date:'2026-10-14',period:1,status:'planned'},lastError:{code:'22023',message:'N58_SESSION_CONTEXT_REQUIRED',at:3},dependencies:[]}]};
  for(const [name,rows]of Object.entries(data))await db.putMany(name,rows);
  window.original=await db.get('outbox','v2:original');window.plan=await s.reviewRejectedSessionRepairs();
  if(plan.entries[0]?.status!=='review')throw Error('fixture not eligible');await h.refresh();
 },{A});
 await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();
 await page.locator('[data-act="review-session-repair"]').click();await page.locator('[data-confirm-session-repair]').waitFor();
 assert.equal(await page.locator('[data-confirm-session-repair]').isDisabled(),true);
 assert.equal(await page.locator('[data-repair-entry]').isChecked(),false);
 assert.equal(await page.locator('[data-retry-session-repairs]').isVisible(),false);
 await page.locator('[data-confirm-session-repair]').evaluate(e=>e.click());
 assert.equal(await page.evaluate(async()=>(await db.getAll('outbox')).length),1);
 await page.locator('[data-repair-entry]').check();assert.equal(await page.locator('[data-confirm-session-repair]').isEnabled(),true);
 await page.locator('[data-repair-entry]').uncheck();assert.equal(await page.locator('[data-confirm-session-repair]').isDisabled(),true);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.dataset.act==='review-session-repair');
 assert.equal(await page.evaluate(async()=>(await db.getAll('outbox')).length),1);
 await page.locator('[data-act="review-session-repair"]').click();await page.locator('[data-repair-entry]').check();
 await page.screenshot({path:`test-results/n101-repair-ui-review-${width}.png`});
 await page.evaluate(()=>window.mainBeforeConfirm=document.getElementById('main'));
 await page.locator('[data-confirm-session-repair]').click();await page.waitForFunction(()=>document.querySelector('[data-repair-message]')?.textContent.includes('حُفظ'));
 await page.locator('[data-retry-session-repairs]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-confirm-session-repair]').isDisabled(),true);
 assert.equal(await page.evaluate(async()=>(await db.getAll('outbox')).length),3);
 assert.equal(await page.evaluate(()=>mainBeforeConfirm===document.getElementById('main')),true);
 assert.deepEqual(await page.evaluate(()=>db.get('outbox','v2:original')),await page.evaluate(()=>original));
 // A pending linked receipt remains reachable after closing and reopening.
 await page.locator('.sheet-backdrop').last().locator('.sheet__foot [data-sheet-close]').click();
 await page.locator('[data-act="review-session-repair"]').click();
 await page.locator('[data-retry-session-repairs]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-confirm-session-repair]').count(),0);
 // Repeat real store confirmation retains identity, with no duplicate replacement.
 assert.equal(await page.evaluate(async()=>{await s.confirmRejectedSessionRepairs(plan,['v2:original'],true);return(await db.getAll('outbox')).length;}),3);
 await page.evaluate(()=>window.mode='delayed');await page.locator('[data-retry-session-repairs]').click();
 assert.match(await page.locator('[data-retry-session-repairs]').innerText(),/جارٍ/);assert.equal(await page.locator('[data-retry-session-repairs]').isDisabled(),true);
 await page.evaluate(()=>{window.mode='false';releaseRetry();});await page.waitForFunction(()=>document.querySelector('[data-repair-message]')?.textContent.includes('تعذرت'));
 assert.equal(await page.locator('[data-retry-session-repairs]').isEnabled(),true);
 await page.evaluate(()=>window.mode='error');await page.locator('[data-retry-session-repairs]').click();await page.waitForFunction(()=>document.querySelector('[data-repair-message]')?.textContent.includes('خطأ مصطنع'));
 assert.equal(await page.locator('[data-retry-session-repairs]').isEnabled(),true);
 await page.evaluate(()=>window.mode='unverified');await page.locator('[data-retry-session-repairs]').click();await page.waitForFunction(()=>document.querySelector('[data-repair-message]')?.textContent.includes('لم يتأكد اكتمال'));
 await page.evaluate(()=>window.mode='success');await page.locator('[data-retry-session-repairs]').click();await page.waitForFunction(()=>document.querySelector('[data-repair-message]')?.textContent.startsWith('تأكد اكتمال'));
 assert.equal(await page.locator('[data-retry-session-repairs]').isVisible(),false);
 await page.locator('[data-repair-support]').click();await page.waitForFunction(()=>!document.querySelector('.sheet-backdrop')&&!document.getElementById('app').inert&&document.activeElement?.id==='main');
 // Rejected/blocked linked replacements retain explanations without an inapplicable retry.
 await page.evaluate(async()=>{
  const audit=await db.get('outbox','session-repair:v2:original');
  await db.put('outbox',{...audit,state:'pending'});
  const replacement=(await db.getAll('outbox')).find(r=>r.sessionRepairOf==='v2:original');
  window.replacement=replacement;
 });
 for(const state of ['rejected','blocked']){
  await page.evaluate(async state=>{await db.put('outbox',{...replacement,state});void h.open();},state);
  await page.locator('[data-session-repair-review]').waitFor();
  assert.equal(await page.locator('[data-retry-session-repairs]').isVisible(),false);
  assert.equal(await page.locator('[data-confirm-session-repair]').count(),0);
  await page.keyboard.press('Escape');
 }
 // Restore the qualifying fixture before racing both actual reads with an owner change.
 await page.evaluate(async()=>{await db.remove('outbox','session-repair:v2:original');await db.remove('outbox',replacement.id);await h.refresh();});
 // Delay the actual IndexedDB API callbacks, then switch the authenticated owner.
 await page.evaluate(async({B})=>{
  const descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess');window.restoreRead=()=>Object.defineProperty(IDBRequest.prototype,'onsuccess',descriptor);
  const waiting=new Promise(r=>window.releaseRead=r);
  Object.defineProperty(IDBRequest.prototype,'onsuccess',{...descriptor,set(fn){descriptor.set.call(this,async event=>{await waiting;fn.call(this,event);});}});
  window.pendingRefresh=h.refresh();window.pendingOpen=h.actions['review-session-repair']();await new Promise(r=>setTimeout(r,30));c.setMockAuth({id:B},{access_token:'synthetic-B',user:{id:B}});
  restoreRead();releaseRead();await Promise.all([pendingRefresh,pendingOpen]);
  void h.hub();
 },{B});
 await page.locator('.mini-hub-sync').waitFor();assert.equal(await page.locator('[data-act="review-session-repair"]').count(),0);
 await page.evaluate(()=>{void h.actions['review-session-repair']();});await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.length>0);
 assert.equal(await page.locator('[data-session-repair-review]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 assert.deepEqual(errors,[]);
 console.log(`PASS ${width}: n101_unrelated_year_rejection_no_session_action; n101_eligible_session_and_empty_selection; n101_repair_support_and_retry_feedback; actual owner read guard and delayed stale response`);
 await context.close();
}
});}finally{server.closeAllConnections();await new Promise((r,j)=>server.close(e=>e?j(e):r()));}




