// AI-authored: actual app, source CSS, account store/ownership and Sync handlers.
// Only disposable loopback fixtures; no hosted backend or real account data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from '../n73-account-flow-fixture.mjs';
import {decodeSyncV2Canonical,SYNC_V2_SCHEMAS,encodeSyncV2Patch} from '../../src/lib/sync-v2.js';
import {makeEnrollment,makeItem,makeStudent,makeTeaching,defaultItemsFor} from '../../src/models.js';

const taskId='continuous-n107-durable-local-import-background-sync-20261020',runId='5853408a-7cd2-4fe9-8fd1-b8eb965afaf7';
const base='http://127.0.0.1:49767',root=resolve('.');

const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
const pass=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
let service,mode=null,requests=[],receipts=new Map(),canonical,domainReads=0;
function resetService(){
 service=syntheticService();requests=[];receipts=new Map();mode=null;domainReads=0;
 service.current.enrollments=service.current.students.map((s,i)=>({...makeEnrollment({id:'e'+i,studentId:s.id,sectionId:'n73-source-section'}),ownerId:owner,serverRevision:1}));
 canonical=service.current;canonical.scores=canonical.scores.map(r=>({...r,manualValue:r.value,derivedValue:0}));
}
resetService();
const wire=(store,row)=>({...encodeSyncV2Patch(store,row),id:row.id,owner_id:owner,revision:row.serverRevision,deleted_at:null});
function apply(input){
 requests.push(structuredClone(input));
 if(receipts.has(input.mutationId))return receipts.get(input.mutationId);
 if(mode==='reject')throw Object.assign(Error('Synthetic reviewed grade rejected'),{status:409,code:'PT409'});
 const b=input.batch,t=canonical.teachings.find(t=>t.id===b.teachingId);
 assert.equal(input.ownerId,owner);assert.equal(t.serverRevision,b.teachingRevision);
 const changed={items:[],scores:[],students:[],enrollments:[]};
 for(const n of b.newStudents??[]) {
  changed.students.push({...makeStudent({id:n.id,name:n.name}),ownerId:owner,serverRevision:1});
  changed.enrollments.push({...makeEnrollment({id:n.enrollmentId,studentId:n.id,sectionId:b.sectionId}),ownerId:owner,serverRevision:1});
 }
 for(const n of b.newItems)changed.items.push({...makeItem({...n,teachingId:t.id}),ownerId:owner,serverRevision:1});
 for(const c of b.cells){
  const item=changed.items.find(i=>i.id===c.itemId)??canonical.items.find(i=>i.id===c.itemId);
  assert.equal(item.teachingId,t.id);assert.equal(c.itemRevision,item.serverRevision);assert.equal(c.max,item.max);assert.ok(c.value>=0&&c.value<=item.max);
  if(!changed.items.some(i=>i.id===item.id))changed.items.push(item);
  const old=canonical.scores.find(s=>s.id===c.scoreId);
  changed.scores.push({id:c.scoreId??`sc:${c.studentId}:${c.itemId}`,itemId:c.itemId,studentId:c.studentId,value:c.value,manualValue:c.value,derivedValue:0,deleted:false,ownerId:owner,serverRevision:(old?.serverRevision??0)+1});
 }
 const receipt={mutationId:input.mutationId,teachingId:t.id,protocol:b.newStudents?.length?'N90_UNIFIED_V1':'N90_REVIEWED_V1',score_subitems:[],score_subitem_completions:[]};
 for(const [store,rows]of Object.entries(changed)){
  canonical[store]??=[];
  for(const row of rows){const i=canonical[store].findIndex(r=>r.id===row.id);if(i<0)canonical[store].push(row);else canonical[store][i]=row;}
  receipt[store]=rows.map(row=>wire(store,row));
 }
 receipts.set(input.mutationId,receipt);
 if(mode==='lost'){mode=null;throw Object.assign(Error('Synthetic lost receipt after commit'),{status:503});}
 return receipt;
}
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,base).pathname;
  if(path.startsWith('/__n73/')){
   let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body||'{}'),name=path.slice(7);
   if(name==='grade' && mode==='delay')await new Promise(r=>{releaseGrade=r;gradeArrived.resolve();});
   const result=name==='sync'?await syncService(input):name==='grade'?apply(input):name==='adopt'?(canonical=input,true):await service.request(name,input);
   res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
  }
  const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
  res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(await readFile(f));
 }catch(e){res.writeHead(e.status??500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message,status:e.status??500,code:e.code}));}
});
async function prepare(page,reuse=false,coordinatorOnly=false){
 if(!reuse)await openReadyServedDemo(page,base);
 else {await page.reload({waitUntil:'domcontentloaded'});await page.locator('.boot').waitFor({state:'detached'});}
 await page.evaluate(async reuse=>{
  const f=await import('/tests/n73-account-flow-fixture.mjs');if(!reuse)await f.prepareAccount();
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
  if(reuse){const session=JSON.parse(localStorage.getItem(c.AUTH_STORAGE_KEY));s.deactivateWorkspace();c.setMockAuth(session.user,session);}
  const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-roster-local'};
  if(!reuse){s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);}
  const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
  try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
  const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
  if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);if(reuse)await s.init();
  await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  const gradeBackend={getScoreFoundationCapability:()=>({scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1}),
   getGradeImportCapability:async()=>{if(globalThis.__gate)await new Promise(r=>globalThis.__releaseCapability=r);return globalThis.__n107Unavailable ? {} : ({protocol:'N90_REVIEWED_V1',version:1,unifiedProtocol:'N90_UNIFIED_V1',unifiedVersion:1});},
   async applyReviewedGradeImport(input){
    const durable=(await d.getAll('outbox')).find(r=>r.mutationId===input.mutationId);
    if(durable?.ownerId!==f.owner||durable.command!=='score:grade_import')throw Error('Missing actual owner-bound command');
    const r=await fetch('/__n73/grade',{method:'POST',body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),data);return data;
   }};
  const http=async input=>{const r=await fetch('/__n73/sync',{method:'POST',body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),data);return data;};
  const sendOwned=async(kind,envelope)=>{
   const row=(await d.getAll('outbox')).find(r=>r.mutationId===envelope.mutationId);
   if(row?.ownerId!==f.owner || row.protocol!=='v2')throw Error('Creation transport requires actual owned command');
   return http({kind,envelope});
  };
  c.setMockBackend({...gradeBackend,fetchRecords:entity=>http({kind:'pull',entity}),getScoreDomainSnapshot:()=>http({kind:'snapshot'}),
   getUnifiedRestoreCapability:()=>({}),getOwnerRevision:()=>({revision:1}),
   applySyncV2Mutation:envelope=>sendOwned('mutation',envelope),applySyncV2TeachingCreationCommand:envelope=>sendOwned('teaching',envelope)});
  s.assertClassImportAccess();(await import('/src/repaint.js')).repaint();
 },reuse);
 if(!coordinatorOnly)await visit(page,'#/classes/koshoof?teaching=n73-source');
}
async function visit(page,hash){await page.evaluate(hash=>location.hash=hash,hash);await page.locator('[data-roster-file-flow]').waitFor();await page.waitForFunction(hash=>location.hash===hash,hash);}
const checkpoint=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
const upload=async(page,text='اسم الطالب,اختبار جديد (العظمى 10)\nطالب موجب,7\nطالب صفر,0\nطالب فارغ,')=>{
 await page.locator('[data-change="grade-file"]').setInputFiles({name:'roster.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await page.locator('[data-import-kind]').waitFor();
};
const chooseMode=async(page,mode)=>page.locator('[data-act="grade-import-mode"][data-mode="'+mode+'"]').first().click();
const maximumArrived=Promise.withResolvers(),gradeArrived=Promise.withResolvers();
let creationArrived=Promise.withResolvers();
let syncCalls=[],creationMode=null,partialId=null,releaseCreation,releaseMaximum,releaseGrade;
async function syncService({kind,entity,envelope:e}) {
 const store=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===entity);
 if(kind==='pull')return (canonical[store]??[]).map(r=>wire(store,r));
 if(kind==='snapshot'){domainReads++;return Object.fromEntries([['items','items'],['scoreSubitems','score_subitems'],['scoreSubitemCompletions','score_subitem_completions'],['scores','scores']].map(([n,k])=>[k,(canonical[n]??[]).map(r=>wire(n,r))]));}
 syncCalls.push({kind,mutationId:e.mutationId});
 if(receipts.has(e.mutationId))return receipts.get(e.mutationId);
 if(e.entity==='items' && maxMode==='unavailable')throw Object.assign(Error('Synthetic max transport unavailable'),{status:503});
 if(e.entity==='items' && maxMode==='reject')throw Object.assign(Error('Synthetic max rejection'),{status:409,code:'PT409'});
 if(e.entity==='items' && maxMode==='delay')await new Promise(r=>{releaseMaximum=r;maximumArrived.resolve();});
 let result;
 if(kind==='mutation'){
  if(creationMode==='partial' && e.entity==='enrollments') {partialId??=e.recordId;if(e.recordId===partialId)throw Object.assign(Error('Synthetic enrollment ACK delayed'),{status:503});}
  if(creationMode==='reject-parent' && e.entity==='subjects')throw Object.assign(Error('Synthetic parent rejected'),{status:409,code:'PT409'});
  const n=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===e.entity);
  const old=canonical[n]?.find(r=>r.id===e.recordId);
  const raw={...old&&wire(n,old),...e.patch,id:e.recordId,owner_id:owner,revision:(old?.serverRevision??0)+1,deleted_at:null};
  const row=decodeSyncV2Canonical(n,raw);canonical[n]??=[];
  const idx=canonical[n].findIndex(r=>r.id===row.id);if(idx<0)canonical[n].push(row);else canonical[n][idx]=row;
  result={mutationId:e.mutationId,outcome:'applied',canonicalId:row.id,resultRevision:row.serverRevision,canonical:raw};
 }else if(kind==='teaching'){
  if(creationMode==='delay')await new Promise(r=>{releaseCreation=r;creationArrived.resolve();});
  for(const [n,id]of [['sections',e.sectionId],['subjects',e.subjectId],['terms',e.termId]])assert.ok(canonical[n].some(r=>r.id===id&&r.serverRevision>0),'parent ACK '+n);
  const t={...makeTeaching({id:e.teachingId,sectionId:e.sectionId,subjectId:e.subjectId,termId:e.termId,order:e.order}),serverRevision:1};
  const items=defaultItemsFor(t.id).map((r,i)=>({...r,id:e.itemIds[i],serverRevision:1}));canonical.teachings.push(t);canonical.items.push(...items);
  result={mutationId:e.mutationId,canonicalTeaching:wire('teachings',t),items:items.map(r=>wire('items',r))};
 }else throw Error('Unknown sync operation');
 receipts.set(e.mutationId,result);if(e.entity==='items' && (maxMode==='lost' || maxMode==='lost-second' && e.recordId==='second-max')){maxMode=null;throw Object.assign(Error('Synthetic lost max ACK'),{status:503});}return result;
}

let maxMode=null;
async function fresh(createContext,scenario){
 resetService();syncCalls=[];creationMode=null;maxMode=null;releaseCreation=releaseMaximum=releaseGrade=undefined;creationArrived=Promise.withResolvers();
 if(scenario==='partial-max')canonical.items.push({...makeItem({id:'second-max',name:'Second',teachingId:'n73-source',max:5}),ownerId:owner,serverRevision:1});
 // Add an untouched student's zero; existing first student's 19 must remain unchanged for a blank.
 canonical.scores.push({id:'untouched-zero',itemId:'n73-source-exam',studentId:'n73-student2',value:0,manualValue:0,derivedValue:0,ownerId:owner,serverRevision:1});
 const context=await createContext({viewport:{width:1000,height:900},locale:'ar-SA'});
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>evidence.failures.push(e.message));
 await prepare(page);return {context,page};
}
const snapshot=page=>page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),f=await import('/tests/n73-account-flow-fixture.mjs');const w=s.assertClassImportAccess(),device=await d.get('device','device');if(w.authUserId!==f.owner || w.databaseName!==d.getActiveDatabaseName() || device.accountProvisioningReceipt.ownerId!==f.owner)throw Error('Current document owner/database/receipt mismatch');return {items:await d.getAll('items'),scores:await d.getAll('scores'),outbox:await d.getAll('outbox'),saved:device.classFileImportContinuation};});
const complete=page=>page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الدرجات المحفوظة: 31'));
async function approve(page,label='3',saved=true){
 const csv='اسم الطالب,الواجبات (العظمى 20),الاختبارات القصيرة (العظمى 20)\n'+Array.from({length:2},(_,i)=>`طالب مصطنع ${i+1},${i===0?0:17},${i<3?9:''}`).join('\n');
 await upload(page,csv);
 await page.locator('[data-import-kind]').selectOption('new');
 await page.locator('[data-roster-field="grade"]').selectOption('12');
 await page.locator('[data-roster-field="label"]').fill(label);
 await page.locator('[data-roster-field="label"]').dispatchEvent('change');
 await page.locator('[data-roster-subject]').selectOption({label:'التفكير الناقد'});
 await chooseMode(page,'grades');await page.locator('[data-act="grade-review"]').click();
 await page.locator('[data-roster-preview]').waitFor();
 await page.locator('[data-act="class-import-confirm"]').click();
 if(saved)await page.locator('[data-local-import-saved]').waitFor();
}
async function assertResult(page){
 const snap=await snapshot(page),t=canonical.teachings.find(t=>canonical.sections.find(s=>s.id===t.sectionId)?.grade===12);
 assert.ok(t);const items=snap.items.filter(i=>i.teachingId===t.id),scores=snap.scores.filter(s=>items.some(i=>i.id===s.itemId));
 assert.equal(canonical.sections.filter(s=>s.grade===12).length,1);
 assert.equal(syncCalls.filter(c=>c.kind==='teaching').length,1);assert.equal(items.length,5);
 assert.equal(canonical.enrollments.filter(e=>e.sectionId===t.sectionId).length,28);
 assert.equal(new Set(canonical.enrollments.filter(e=>e.sectionId===t.sectionId).map(e=>e.studentId)).size,28);
 assert.equal(scores.length,31);assert.equal(new Set(scores.map(s=>s.id)).size,31);
 assert.equal(scores.filter(s=>s.value===0).length,1);
 assert.equal(items.find(i=>i.name==='الواجبات').max,20);
 assert.equal(snap.scores.find(s=>s.id==='n73-source-score').value,19);
 assert.equal(snap.scores.find(s=>s.id==='untouched-zero').value,0);
 assert.equal(snap.saved,null);assert.equal(snap.outbox.filter(r=>r.command==='score:grade_import').length,0);
 assert.equal(requests.length,1);assert.equal(requests[0].batch.cells.length,31);
 assert.ok(receipts.has(requests[0].mutationId));
 assert.match(await page.locator('[data-roster-file-flow]').innerText(),/الأسماء المحفوظة: 28/);
 return {teachingId:t.id,gradeMutationId:requests[0].mutationId,scores:scores.map(s=>[s.id,s.value])};
}

const plans=page=>page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),f=await import('/tests/n73-account-flow-fixture.mjs');const w=s.assertClassImportAccess();if(w.authUserId!==f.owner||w.databaseName!==d.getActiveDatabaseName()||s.state.device.accountProvisioningReceipt.ownerId!==f.owner)throw Error('Current document owner/DB mismatch');return Object.values((await d.get('device','device')).classFileImportPlans??{}).map(p=>({id:p.id,state:p.state,teachingId:p.created.teachingId,gradeMutationId:p.gradeMutationId}));});
const drain=page=>page.evaluate(async()=>{const sync=await import('/src/lib/sync.js'),bg=await import('/src/lib/class-import-background.js');bg.installImportBackground();await sync.syncAll({full:false});await bg.drainImportBackground();});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49767,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const {context,page}=await fresh(createContext);
  try{
   creationMode='delay';await approve(page);assert.equal(requests.length,0);assert.equal(await page.locator('[data-import-success]').count(),0);assert.equal((await plans(page)).length,1);
   await page.evaluate(async()=>{globalThis.__drain=(await import('/src/lib/sync.js')).syncAll({full:false});});await creationArrived.promise;
   const mirror=await context.newPage();await mirror.goto(base+'/src/store.js');await prepare(mirror,true,true);await mirror.evaluate(async()=>{(await import('/src/lib/class-import-background.js')).installImportBackground();});
   await page.evaluate(()=>location.hash='#/classes');await visit(page,'#/classes/koshoof');
   await approve(page,'4');assert.equal((await plans(page)).length,2);assert.equal(requests.length,0);
   creationMode=null;releaseCreation();await page.evaluate(()=>globalThis.__drain);await Promise.all([drain(page),drain(mirror)]);await mirror.close();
   await drain(page);await drain(page);assert.ok((await plans(page)).every(p=>p.state==='cloud_confirmed'));
   assert.equal(requests.length,2);assert.equal(new Set(requests.map(r=>r.mutationId)).size,2);assert.ok(requests.every(r=>r.batch.cells.length===4));
   const result=await plans(page);evidence.multiple=result.map(p=>({state:p.state}));
   await page.setViewportSize({width:390,height:900});await page.screenshot({path:'tests/n107-local-background-1522-20261020/local.png',fullPage:true});
   pass('n107_durable_local_plan_navigation_multiple_imports_background_ack','Actual DOM local completion before held creation ACK; leave view and create second class with independent durable plan; global runner adopts two exact grade receipts once, max ACK before scoring.');
  }catch(error){console.error(JSON.stringify(await plans(page).catch(()=>[])));console.error(await page.locator('[data-grade-transfer]').innerText().catch(()=>''));throw error;}
  finally{releaseCreation?.();releaseMaximum?.();releaseGrade?.();await context.close();}
  // Reload preserves the reviewed plan and a lost genuine receipt keeps its exact envelope.
  const recovery=await fresh(createContext);
  try{
   await approve(recovery.page);await prepare(recovery.page,true);assert.equal((await plans(recovery.page)).length,1);
   mode='lost';await drain(recovery.page);await drain(recovery.page);
   const pending=await plans(recovery.page);assert.equal(pending[0].state,'uncertain');const mutation=pending[0].gradeMutationId;assert.ok(mutation);
   await prepare(recovery.page,true);await recovery.page.evaluate(async()=>{(await import('/src/lib/class-import-background.js')).requestImportBackground(true);});await drain(recovery.page);await drain(recovery.page);
   const recovered=await plans(recovery.page);assert.equal(recovered[0].state,'cloud_confirmed');assert.equal(recovered[0].gradeMutationId,mutation);assert.equal(new Set(requests.map(r=>r.mutationId)).size,1);
   evidence.recovery={reloadPlan:true,sameMutation:true,attempts:requests.length};
  }finally{await recovery.context.close();}
  // Abort the actual local plan write: the UI must never display local success.
  const failure=await fresh(createContext);
  try{
   await failure.page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='device'&&Object.keys(value.classFileImportPlans??{}).length)throw new DOMException('Synthetic plan transaction failure','DataCloneError');return original.call(this,value,...args);};});
   await approve(failure.page,'5',false);await failure.page.locator('.grade-transfer__message.is-error').waitFor();assert.equal(await failure.page.locator('[data-local-import-saved]').count(),0);assert.equal((await plans(failure.page)).length,0);assert.equal(requests.length,0);
  }finally{await failure.context.close();}
  // Delayed actual grade transport ACK after workspace retirement cannot adopt or remove its command.
  const retirement=await fresh(createContext);
  try{
   await approve(retirement.page);mode='delay';
   await retirement.page.evaluate(()=>{globalThis.__retireDrain=(async()=>{const s=await import('/src/lib/sync.js'),b=await import('/src/lib/class-import-background.js');await s.syncAll({full:false});await b.drainImportBackground();})();});
   await gradeArrived.promise;
   const before=await retirement.page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {scores:await d.getAll('scores'),device:await d.get('device','device'),outbox:await d.getAll('outbox')};});
   await retirement.page.evaluate(async()=>{(await import('/src/store.js')).deactivateWorkspace();(await import('/src/lib/cloud.js')).setMockAuth({id:'synthetic-foreign-owner'},{user:{id:'synthetic-foreign-owner'}});});
   mode=null;releaseGrade();await retirement.page.evaluate(()=>globalThis.__retireDrain);
   const after=await retirement.page.evaluate(async()=>{const d=await import('/src/lib/db.js'),b=await import('/src/lib/class-import-background.js');return {scores:await d.getAll('scores'),device:await d.get('device','device'),outbox:await d.getAll('outbox'),visible:b.localImportPlans()};});
   assert.deepEqual(after.scores,before.scores);assert.equal(after.visible.length,0);assert.equal(after.outbox.find(r=>r.command==='score:grade_import').mutationId,before.outbox.find(r=>r.command==='score:grade_import').mutationId);assert.notEqual(Object.values(after.device.classFileImportPlans)[0].state,'cloud_confirmed');
   pass('n107_reload_unknown_result_owner_and_local_failure','Real owned IndexedDB reload recovers exact unknown grade envelope; transaction abort never reports local success; retired workspace hides plans and denies delayed grade ACK adoption/outbox deletion.');
  }finally{releaseGrade?.();await retirement.context.close();}
 });
}catch(error){evidence.failures.push(error.stack);console.error(error.stack);process.exitCode=1;}
finally{releaseCreation?.();releaseMaximum?.();releaseGrade?.();server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile('tests/n107-local-background-1522-20261020/result.json',JSON.stringify(evidence,null,2));}



