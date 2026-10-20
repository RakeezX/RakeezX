// AI: actual HTTP app, IndexedDB, store and authenticated ownership guards.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {workerFixture} from './worker-fixture.mjs';

const taskId='continuous-n36-setup-profile-save-direct-bridge-20261020',runId='3b675661-fb0a-4ca6-851b-9fde523c5ab2';
const base='http://127.0.0.1:49526',root=resolve('.'),service=syntheticService();
// Model a restored old profile: newly introduced defaults are absent on disk.
delete service.current.profile[0].educationDepartment;
delete service.current.profile[0].teacherForm;
service.current.subjects[0].name='علوم تجريبية';
service.current.sections[0].name='الخامس الابتدائي/1';
service.current.sections[1]={...service.current.sections[1],grade:6,label:'7',name:'السادس الابتدائي/7'};
const evidence={taskId,runId,checks:[],errors:[]};
const prior=JSON.parse(await fs.readFile('tests/n36-actual-save-20261020/browser.json','utf8').catch(()=>'{}'));
evidence.preservedFailures=[...(prior.preservedFailures??[]),...(prior.failure?[{failure:prior.failure,debug:prior.debug}]:[])];
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,base).pathname;
 if(pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
 let bytes=await fs.readFile(file);
 // Only origin configuration changes in this local fixture; all receiver,
 // transport, nonce, document, owner and transaction guard code is unmodified.
 if(['/src/lib/n36-extension-protocol.js','/extensions/rakeez-teacher-import-helper/handoff-protocol.js'].includes(pathname))bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(49526,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:950},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  await openReadyServedDemo(page,base);
  const ready=await page.evaluate(async()=> (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
  assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
  const result=await page.evaluate(async()=>{
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
   let root=null;s.onWriteError(e=>root={message:e.message,name:e.name});
   const before=await d.get('profile','profile');let error=null;
   try{await s.importSetupProfile({teacherName:'معلم اصطناعي'},{verifyCurrent(){s.assertClassImportAccess();}});}catch(e){error={message:e.message,code:e.code,phase:e.phase};}
   return {before,after:await d.get('profile','profile'),memory:s.state.profile,error,root};
  });
  if(process.argv.includes('--reproduce')){
   assert.equal(result.root.message,'SETUP_PROFILE_CHANGED');assert.equal(result.error.message,'SETUP_PROFILE_SAVE');assert.deepEqual(result.after,result.before);
   evidence.reproduction={status:'EXPECTED_FAILURE',...result};
  }else{
   assert.equal(result.error,null);assert.equal(result.after.teacherName,'معلم اصطناعي');assert.deepEqual(result.memory,result.after);
   evidence.checks.push({name:'hydrated_profile_transaction',status:'PASS',evidence:'Actual account store and IndexedDB; missing persisted defaults no longer cause a false conflict.'});
   const failures=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    const snap=async()=>({profile:await d.get('profile','profile'),outbox:await d.getAll('outbox'),memory:structuredClone(s.state.profile)});
    const before=await snap(),events=[];const off=s.subscribe(()=>events.push(s.state.profile.schoolName));
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...args){if(this.name==='profile')throw new DOMException('Synthetic storage failure','QuotaExceededError');return put.call(this,value,...args);};
    let rollback;try{await s.importSetupProfile({schoolName:'مدرسة اصطناعية'});}catch(e){rollback={message:e.message,code:e.code,phase:e.phase};}finally{IDBObjectStore.prototype.put=put;}
    const after=await snap();off();
    let conflict;try{await s.importSetupProfile({teacherName:'معلم مختلف'});}catch(e){conflict=e.message;}
    await d.put('profile',{...before.profile,phone:'synthetic-concurrent'});
    let concurrent;try{await s.importSetupProfile({schoolName:'مدرسة اصطناعية'});}catch(e){concurrent={message:e.message,code:e.code};}
    await s.refreshSyncedState();
    let unknown;try{await s.importSetupProfile({schoolName:'مدرسة اصطناعية'},{verifyCurrent(current){if(!current)throw Error('SETUP_PROFILE_OWNER');}});}catch(e){unknown={message:e.message,code:e.code,phase:e.phase};}
    const durable=await d.get('profile','profile'),unknownOutbox=await d.getAll('outbox');
    await s.refreshSyncedState();await s.importSetupProfile({schoolName:'مدرسة اصطناعية'});
    const retryOutbox=await d.getAll('outbox');
    const session=c.session;
    c.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-foreign'});
    let foreign=false;try{await s.importSetupProfile({principalName:'مدير اصطناعي'});}catch{foreign=true;}
    const foreignAfter=await d.get('profile','profile');c.setMockAuth(session.user,session);
    return {before,after,events,rollback,conflict,concurrent,unknown,durable,unknownOutbox,retryOutbox,foreign,foreignAfter};
   });
   assert.deepEqual(failures.after,failures.before);assert.ok(failures.events.every(v=>v===''));
   assert.deepEqual(failures.rollback,{message:'SETUP_PROFILE_SAVE',code:'QuotaExceededError',phase:'transaction'});
   assert.equal(failures.conflict,'SETUP_PROFILE_CONFLICT');assert.equal(failures.concurrent.code,'SETUP_PROFILE_CHANGED');
   assert.equal(failures.unknown.phase,'readback');assert.equal(failures.durable.schoolName,'مدرسة اصطناعية');
   assert.deepEqual(failures.unknownOutbox,failures.retryOutbox);assert.equal(failures.foreign,true);assert.deepEqual(failures.foreignAfter,failures.durable);
   evidence.checks.push({name:'profile_rollback_conflict_unknown_retry_owner',status:'PASS',evidence:'Injected IndexedDB QuotaExceededError aborts profile+outbox with no optimistic singleton notification; real concurrent value and foreign account rejected. Postcommit unknown is preserved, then same-value retry creates no command duplicate.'});
   // Exercise the actual extension controller at its previously qualified
   // collected-source boundary; no school browsing or 303-name collection rerun.
   const worker=await workerFixture(page,base);
   await context.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));
   await context.exposeBinding('fixtureExternal',(_,m)=>worker.external(m));
   await context.addInitScript(({base})=>{
    const source={id:7,url:'https://schools.madrasati.sa/Dashboards/Schools',status:'complete'};
    window.chrome={runtime:{getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,getManifest:()=>({version:'0.5.17'}),sendMessage:(...args)=>typeof args[0]==='string'?void window.fixtureExternal(args[1]).then(args[2]):window.fixtureInternal(args[0])},
     tabs:{get:async()=>source,onRemoved:{addListener(){}},onUpdated:{addListener(){}}},
     scripting:{executeScript:async()=>[{frameId:0,result:{ok:true}}]}};
   },{base});
   // The existing app document receives the same fabricated Chrome callback API.
   await page.evaluate(()=>{window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}};});
   const route=await page.evaluate(()=>location.hash),runner=await context.newPage();
   await runner.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html?run=actual-save');
   await runner.waitForFunction(()=>typeof window.n36BeforeExport==='function');
   const rows=[{name:'طالب اصطناعي ألف',classroom:'خامس1'},{name:'طالب اصطناعي باء',classroom:'سادس7'}];
   const setup=[{category:'teacher',rows:[{name:'معلم اصطناعي'}]},{category:'school',rows:[{name:'مدرسة اصطناعية'}]},{category:'principal',rows:[{name:'مدير اصطناعي'}]},{category:'classes',rows:[{classroom:'خامس1',subject:'علوم تجريبية'},{classroom:'سادس7',subject:'علوم تجريبية'}]},{category:'timetable',rows:[{weekday:'الأحد',period:'1',time:'09:00-09:45',classroom:'خامس1',subject:'علوم تجريبية'}]}];
   const begin=await worker.internal({type:'n36-begin'});assert.equal(begin.ok,true);
   await runner.evaluate(async({rows,setup,batchId})=>{
    window.n36AutomaticBatch=batchId;
    (await import('/extensions/rakeez-teacher-import-helper/run-controller.js')).presentCollectedSource({tabId:7,origin:'https://schools.madrasati.sa',sourceURL:'https://schools.madrasati.sa/Dashboards/Schools',context:{schoolId:'a'.repeat(32)},expires:Date.now()+120000,batchExpires:Date.now()+1800000,sourceRows:rows,categories:setup,warnings:[],excluded:0},{complete:true,coverage:'complete'});
   },{rows,setup,batchId:begin.batchId});
   try{await runner.waitForFunction(()=>document.querySelector('#run-status')?.textContent.includes('وصل إيصال الأسماء المتاحة'),null,{timeout:10000});}
   catch(e){evidence.debug={runner:await runner.locator('#run-status').innerText(),handoff:await runner.locator('#handoff-status').innerText(),app:await page.locator('#toast').innerText(),worker:worker.evidence,records:worker.data};throw e;}
   const saved=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    return {workspace:s.getActiveWorkspace(),device:await d.get('device','device'),sections:await d.getAll('sections'),teachings:await d.getAll('teachings'),students:await d.getAll('students'),enrollments:await d.getAll('enrollments'),profile:await d.get('profile','profile'),slots:await d.getAll('slots'),scores:await d.getAll('scores')};
   });
   assert.equal(await page.evaluate(()=>location.hash),route);assert.deepEqual(worker.evidence.navigation,[]);assert.equal(saved.sections.length,3);
   assert.equal(saved.device.n36NamesBatch.pending,null);assert.equal(saved.profile.principalName,'مدير اصطناعي');assert.equal(saved.slots.length,1);
   assert.equal(saved.students.filter(s=>rows.some(r=>r.name===s.name)).length,2);assert.equal(saved.enrollments.length,2);
   assert.equal(saved.teachings.filter(t=>t.sectionId==='n73-target-section').length,1);
   assert.equal(await page.locator('.layout').count(),1);assert.equal(await page.locator('[data-n36-direct]').count(),0);
   assert.ok(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily.length>0));
   await page.screenshot({path:'tests/n36-actual-save-20261020/app-shell.png',fullPage:false});
   evidence.checks.push({name:'one_start_app_shell_no_navigation',status:'PASS',evidence:'Actual controller collected-source entry → category handlers → real worker → shell nonce receiver → authenticated store/IndexedDB. Two existing canonical destinations, subjects/profile/timetable/names saved; no navigation, new app tab or per-class confirmation. Production origin constant translated to owned loopback only in fixture; real Chrome and live journey NOT_RUN.'});
   evidence.worker=worker.evidence;
   // A profile-wide disk failure must retain the exact batch and safe cause,
   // without claiming every existing destination needs remapping.
   await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    await d.put('profile',{...await d.get('profile','profile'),principalName:'',reportPrincipalName:''});await s.refreshSyncedState();
    window.originalProfilePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...args){if(this.name==='profile')throw new DOMException('Synthetic quota','QuotaExceededError');return window.originalProfilePut.call(this,value,...args);};
   });
   const second=await worker.internal({type:'n36-begin'});assert.equal(second.ok,true);
   await runner.evaluate(async({rows,setup,batchId})=>{
    window.n36AutomaticBatch=batchId;
    (await import('/extensions/rakeez-teacher-import-helper/run-controller.js')).presentCollectedSource({tabId:7,origin:'https://schools.madrasati.sa',sourceURL:'https://schools.madrasati.sa/Dashboards/Schools',context:{schoolId:'a'.repeat(32)},expires:Date.now()+120000,batchExpires:Date.now()+1800000,sourceRows:rows,categories:setup,warnings:[],excluded:0},{complete:true,coverage:'complete'});
   },{rows,setup,batchId:second.batchId});
   await runner.waitForFunction(()=>document.querySelector('#run-status')?.textContent.includes('توقف حفظ إعداد الحساب'),null,{timeout:10000});
   const failText=await runner.locator('#run-status').innerText();assert.match(failText,/QuotaExceededError/);assert.doesNotMatch(failText,/فصول لم يتأكد حفظها/);
   await runner.locator('#copy-safe-report').locator('xpath=ancestor::details').locator('summary').click();
   await runner.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Synthetic clipboard unavailable');}}}));
   await runner.locator('#copy-safe-report').click();
   await runner.waitForFunction(()=>document.querySelector('#safe-report').value.length>0);
   const diag=JSON.parse(await runner.locator('#safe-report').inputValue());
   assert.equal(diag.collection.failure,'QuotaExceededError');assert.equal(diag.collection.failurePhase,'profile');assert.equal(diag.collection.failureStep,'transaction');
   const pendingCheckpoint=await page.evaluate(async()=>{
    IDBObjectStore.prototype.put=window.originalProfilePut;
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    return {workspace:s.getActiveWorkspace(),session:c.session,device:await d.get('device','device'),profile:await d.get('profile','profile'),students:await d.getAll('students'),enrollments:await d.getAll('enrollments'),slots:await d.getAll('slots'),outbox:await d.getAll('outbox')};
   });
   assert.ok(pendingCheckpoint.device.n36NamesBatch.pending);assert.equal(pendingCheckpoint.profile.principalName,'');
   const foreign=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    c.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-foreign'});
    await s.refreshSyncedState();await new Promise(r=>setTimeout(r,100));
    let denied=false;try{window.rakeezBeginNamesBatch();}catch{denied=true;}
    return {denied,device:await d.get('device','device'),profile:await d.get('profile','profile'),outbox:await d.getAll('outbox')};
   });
   assert.equal(foreign.denied,true);assert.deepEqual(foreign.device,pendingCheckpoint.device);assert.deepEqual(foreign.profile,pendingCheckpoint.profile);assert.deepEqual(foreign.outbox,pendingCheckpoint.outbox);
   await runner.close();
   await page.reload();await page.locator('.boot').waitFor({state:'detached'});
   const restored=await page.evaluate(async({workspace,session})=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    s.deactivateWorkspace();localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));c.setMockAuth(session.user,{...session});
    s.activateWorkspace(workspace);
    await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:session.user.id,source:'supabase-auth-user',verifiedAt:Date.now()}));
    await new Promise(r=>setTimeout(r,120));await s.init();
    // Fresh same-document owner, DB and provisioning receipt checkpoint.
    return {owner:s.getActiveWorkspace().authUserId,database:d.getActiveDatabaseName(),receipt:(await d.get('device','device')).accountProvisioningReceipt,ready:s.state.ready};
   },pendingCheckpoint);
   assert.equal(restored.owner,pendingCheckpoint.workspace.authUserId);assert.equal(restored.database,pendingCheckpoint.workspace.databaseName);assert.equal(restored.receipt.ownerId,restored.owner);assert.equal(restored.ready,true);
   await page.waitForFunction(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return s.state.ready&&s.getActiveWorkspace()?.type==='account'&&!(await d.get('device','device')).n36NamesBatch.pending;},null,{timeout:10000});
   const resumed=await page.evaluate(async()=>{
    const d=await import('/src/lib/db.js');return {profile:await d.get('profile','profile'),students:await d.getAll('students'),enrollments:await d.getAll('enrollments'),slots:await d.getAll('slots'),device:await d.get('device','device')};
   });
   assert.equal(resumed.profile.principalName,'مدير اصطناعي');assert.equal(resumed.device.n36NamesBatch.pending,null);
   for(const name of ['students','enrollments','slots'])assert.deepEqual(resumed[name],pendingCheckpoint[name],name+' retry never duplicates');
   assert.equal(await page.evaluate(()=>location.hash),route);
   evidence.checks.push({name:'saved_batch_reload_resume_foreign_fence_and_safe_diagnostics',status:'PASS',evidence:'Actual IndexedDB profile failure returned unknown/profile/transaction/QuotaExceededError through real worker + extension safe report, kept batch, stopped global failure without labelling both classes unresolved. Foreign account denied with unchanged disk/outbox. After actual reload and delayed same-owner hydration, fresh grant automatically resumed saved names/setup without navigation or duplicate student/enrollment/slot writes.'});
   worker.evidence.documentId='synthetic-document-two';
   // Hold only Chrome's delivery callback to inspect the new route-free
   // transport boundary. The positive test above used the actual receiver.
   await page.evaluate(()=>{window.actualReceiver=window.rakeezReceiveNamesBatch;window.rakeezReceiveNamesBatch=()=>true;});
   const third=await worker.internal({type:'n36-begin'});assert.equal(third.ok,true);
   const stamp=Date.now(),envelope={schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',createdAt:stamp,expiresAt:stamp+120000,batchId:third.batchId,complete:true,rows:[rows[0]],setup:[]};
   const created=await worker.internal({type:'n36-create',envelope});assert.equal(created.ok,true);
   const message={type:'n36-claim',nonce:created.actionId};
   assert.equal((await worker.external(message,{origin:'https://foreign.invalid'})).ok,false);
   assert.equal((await worker.external(message,{tab:{id:100}})).ok,false);
   assert.equal((await worker.external(message,{documentId:'synthetic-document-one'})).code,'HANDOFF_DOCUMENT_OR_ROUTE');
   await page.evaluate(()=>location.hash='#/schedule');
   assert.equal((await worker.external(message)).code,'HANDOFF_DOCUMENT_OR_ROUTE');
   await page.evaluate(route=>location.hash=route,route);
   assert.equal((await worker.external(message)).ok,true);assert.equal((await worker.external(message)).ok,false);
   assert.equal((await worker.external({type:'n36-outcome',nonce:created.actionId,outcome:{status:'unknown',added:0,existing:0,remaining:1,total:1,failure:{phase:'profile',step:'transaction',code:'ARBITRARY_PRIVATE_TEXT'}}})).code,'RECEIPT_FAILURE');
   const grants=await page.evaluate(async id=>{
    window.rakeezReceiveNamesBatch=window.actualReceiver;
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),lease=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
    const session=c.session,term=s.state.device.activeTermId;
    c.setMockAuth(session.user,{...session});const sessionDenied=!window.rakeezCheckNamesBatch(id);c.setMockAuth(session.user,session);
    s.state.device.activeTermId=s.state.terms.find(t=>t.id!==term).id;const termDenied=!window.rakeezCheckNamesBatch(id);s.state.device.activeTermId=term;
    lease.invalidate('synthetic-proof-expired');const leaseDenied=!window.rakeezCheckNamesBatch(id);
    await lease.renew(async()=>({id:session.user.id,source:'supabase-auth-user',verifiedAt:Date.now()}));
    return {sessionDenied,termDenied,leaseDenied};
   },third.batchId);
   assert.deepEqual(grants,{sessionDenied:true,termDenied:true,leaseDenied:true});
   worker.data['batch:'+third.batchId].expiresAt=0;
   assert.equal((await worker.internal({type:'n36-create',envelope})).code,'BATCH_EXPIRED');
   await worker.internal({type:'n36-cancel'});
   evidence.checks.push({name:'route_free_transport_fences',status:'PASS',evidence:'Real worker rejects foreign origin/tab, old document, changed current route, nonce replay, expired batch and non-allowlisted receipt code. Actual app grant rejects changed session/term and invalid offline lease.'});
  }
 });
 evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;}
finally{await new Promise(r=>server.close(r));await fs.writeFile('tests/n36-actual-save-20261020/'+(process.argv.includes('--reproduce')?'reproduction':'browser')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}
