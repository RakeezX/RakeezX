// AI-authored: actual app, source CSS, account store/ownership and Sync handlers.
// Only disposable loopback fixtures; no hosted backend or real account data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
import {decodeSyncV2Canonical,SYNC_V2_SCHEMAS,encodeSyncV2Patch} from '../src/lib/sync-v2.js';
import {makeEnrollment,makeItem,makeStudent,makeTeaching,defaultItemsFor} from '../src/models.js';

const taskId='continuous-n107-name-match-file-maximum-20261018',runId='5a197e3e-6537-4e50-b57e-6e303d020622';
const base='http://127.0.0.1:49728',root=resolve('.');

const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
try{const previous=JSON.parse(await readFile('tests/n107-name-max-browser.json','utf8'));evidence.previousFailures=[...(previous.previousFailures??[]),...(previous.failures??[])];}catch{}
for(const f of ['src/views/class-import-center.js','src/store.js','src/lib/sync.js','src/lib/sync-v2.js','src/lib/grade-transfer.js','src/models.js','src/styles/components.css','tests/n107-name-max-browser.mjs'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
const pass=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
let service,mode=null,requests=[],receipts=new Map(),canonical;
function resetService(){
 service=syntheticService();requests=[];receipts=new Map();mode=null;
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
   const result=name==='sync'?await syncService(input):name==='grade'?apply(input):name==='adopt'?(canonical=input,true):await service.request(name,input);
   res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
  }
  const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
  res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(await readFile(f));
 }catch(e){res.writeHead(e.status??500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message,status:e.status??500,code:e.code}));}
});
async function prepare(page,reuse=false){
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
 await visit(page,'#/classes/koshoof?teaching=n73-source');
}
async function visit(page,hash){await page.evaluate(hash=>location.hash=hash,hash);await page.locator('[data-roster-file-flow]').waitFor();await page.waitForFunction(hash=>location.hash===hash,hash);}
const checkpoint=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
const upload=async(page,text='اسم الطالب,اختبار جديد (العظمى 10)\nطالب موجب,7\nطالب صفر,0\nطالب فارغ,')=>{
 await page.locator('[data-change="grade-file"]').setInputFiles({name:'roster.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await page.locator('[data-import-kind]').waitFor();
};
const chooseMode=async(page,mode)=>page.locator('[data-act="grade-import-mode"][data-mode="'+mode+'"]').first().click();
let syncCalls=[],creationMode=null,partialId=null;
async function syncService({kind,entity,envelope:e}) {
 const store=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===entity);
 if(kind==='pull')return (canonical[store]??[]).map(r=>wire(store,r));
 if(kind==='snapshot')return Object.fromEntries([['items','items'],['scoreSubitems','score_subitems'],['scoreSubitemCompletions','score_subitem_completions'],['scores','scores']].map(([n,k])=>[k,(canonical[n]??[]).map(r=>wire(n,r))]));
 syncCalls.push({kind,mutationId:e.mutationId});
 if(receipts.has(e.mutationId))return receipts.get(e.mutationId);
 if(e.entity==='items' && maxMode==='reject')throw Object.assign(Error('Synthetic max rejection'),{status:409,code:'PT409'});
 if(e.entity==='items' && maxMode==='delay')await new Promise(r=>setTimeout(r,700));
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
  if(creationMode==='delay')await new Promise(r=>setTimeout(r,1200));
  for(const [n,id]of [['sections',e.sectionId],['subjects',e.subjectId],['terms',e.termId]])assert.ok(canonical[n].some(r=>r.id===id&&r.serverRevision>0),'parent ACK '+n);
  const t={...makeTeaching({id:e.teachingId,sectionId:e.sectionId,subjectId:e.subjectId,termId:e.termId,order:e.order}),serverRevision:1};
  const items=defaultItemsFor(t.id).map((r,i)=>({...r,id:e.itemIds[i],serverRevision:1}));canonical.teachings.push(t);canonical.items.push(...items);
  result={mutationId:e.mutationId,canonicalTeaching:wire('teachings',t),items:items.map(r=>wire('items',r))};
 }else throw Error('Unknown sync operation');
 receipts.set(e.mutationId,result);if(e.entity==='items' && (maxMode==='lost' || maxMode==='lost-second' && e.recordId==='second-max')){maxMode=null;throw Object.assign(Error('Synthetic lost max ACK'),{status:503});}return result;
}

let maxMode=null;
async function fresh(createContext,scenario){
 resetService();syncCalls=[];creationMode=null;maxMode=null;
 if(scenario==='partial-max')canonical.items.push({...makeItem({id:'second-max',name:'Second',teachingId:'n73-source',max:5}),ownerId:owner,serverRevision:1});
 // Add an untouched student's zero; existing first student's 19 must remain unchanged for a blank.
 canonical.scores.push({id:'untouched-zero',itemId:'n73-source-exam',studentId:'n73-student2',value:0,manualValue:0,derivedValue:0,ownerId:owner,serverRevision:1});
 const context=await createContext({viewport:{width:1000,height:900},locale:'ar-SA'});
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>evidence.failures.push(e.message));
 await prepare(page);return {context,page};
}
const existingCsv='اسم الطالب,Exam (العظمى 30)\nSynthetic 1,\nSynthetic 2,0\nطالب مصطنع جديد,29';
async function review(page,csv=existingCsv){await upload(page,csv);await chooseMode(page,'grades');await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();}
const snapshot=page=>page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return {items:await d.getAll('items'),scores:await d.getAll('scores'),outbox:await d.getAll('outbox'),saved:(await d.get('device','device')).classFileImportContinuation};});
const sync=page=>page.evaluate(async()=>await(await import('/src/lib/sync.js')).syncAll({full:true}));
const complete=page=>page.waitForFunction(()=>{const text=document.querySelector('[data-roster-file-flow]')?.textContent;return text?.includes('الدرجات المحفوظة:')});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49728,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const scenario of ['existing','partial-max','lost-reload','rejected','delayed-double','lower-conflict','owner','term','session-during-ack','item-drift','blank-only','new-default','new-default-blank']){
   console.log('SCENARIO '+scenario);const {context,page}=await fresh(createContext,scenario);
   try{
    if(scenario==='lower-conflict'){
     await upload(page,'اسم الطالب,Exam (العظمى 10)\nSynthetic 2,0');await chooseMode(page,'grades');await page.locator('[data-act="grade-review"]').click();
     await page.waitForFunction(()=>document.body.textContent.includes('لا يمكن خفض العظمى'));
     assert.equal(requests.length,0);assert.equal(syncCalls.length,0);assert.equal((await snapshot(page)).scores.find(s=>s.id==='n73-source-score').value,19);
     pass(scenario,'Absent student score19 blocks max10 before any mutation; no clamp/rescale or duplicate.');continue;
    }
    if(scenario.startsWith('new-default')){
     await upload(page,scenario==='new-default-blank'?'اسم الطالب,الواجبات (العظمى 20)\nطالب مصطنع فارغ,':'اسم الطالب,الواجبات (العظمى 20)\nطالب مصطنع موجب,17\nطالب مصطنع صفر,0\nطالب مصطنع فارغ,');
     await page.locator('[data-import-kind]').selectOption('new');await page.locator('[data-roster-field="grade"]').selectOption('11');
     await page.locator('[data-roster-field="label"]').fill('2');await page.locator('[data-roster-field="label"]').dispatchEvent('change');
     await page.locator('[data-roster-field="subject"]').selectOption({label:'البدنية'});await chooseMode(page,'grades');await page.locator('[data-act="grade-review"]').click();
     await page.locator('[data-grade-max-impact]').waitFor();assert.match(await page.locator('[data-grade-max-impact]').innerText(),/10→20/);
     await page.locator('[data-act="class-import-confirm"]').click();await page.waitForFunction(()=>document.querySelector('[data-roster-partial]')?.textContent.includes('انتظار المزامنة'));
     await sync(page);await complete(page);const snap=await snapshot(page),t=canonical.teachings.find(t=>canonical.sections.find(s=>s.id===t.sectionId)?.grade===11);
     const items=snap.items.filter(i=>i.teachingId===t.id);assert.equal(items.length,5);assert.equal(items.find(i=>i.name==='الواجبات').max,20);
     assert.deepEqual(snap.scores.filter(s=>s.itemId===items.find(i=>i.name==='الواجبات').id).map(s=>s.value).sort((a,b)=>a-b),scenario==='new-default-blank'?[]:[0,17]);
     assert.equal(syncCalls.filter(r=>r.kind==='teaching').length,1);assert.equal(requests.length,scenario==='new-default-blank'?0:1);
     pass(scenario,'Same defaultItemsFor: actual creation ACK then unique created homework ID max10→20 ACK then one grade receipt; zero/blank preserved.');continue;
    }
    if(scenario==='partial-max'){
     await review(page,'اسم الطالب,Exam (العظمى 30),Second (العظمى 10)\nSynthetic 1,,4\nطالب مصطنع جديد,29,7');
     maxMode='lost-second';await page.locator('[data-act="grade-confirm"]').click();await page.locator('[data-act="roster-resume"]').waitFor();
     assert.equal(requests.length,0);let snap=await snapshot(page);assert.equal(snap.saved.maxProgress.length,2);
     const stages=snap.saved.maxProgress;assert.ok(snap.items.find(i=>i.id==='n73-source-exam').importMaximumReceipt);
     await prepare(page,true);await page.locator('[data-act="roster-resume"]').waitFor();assert.equal(requests.length,0);assert.equal(syncCalls.length,2);
     await page.locator('[data-act="roster-resume"]').click();await complete(page);snap=await snapshot(page);
     assert.equal(syncCalls.filter(r=>r.mutationId===stages[0].mutationId).length,1);assert.equal(syncCalls.filter(r=>r.mutationId===stages[1].mutationId).length,2);
     assert.equal(requests.length,1);assert.equal(snap.items.find(i=>i.id==='second-max').max,10);assert.equal(snap.saved,null);
     pass(scenario,'Two exact max stages: first ACK survives second lost ACK/reload, only second immutable request replays, all max ACKs precede one grade receipt.');continue;
    }
    if(scenario==='blank-only'){await review(page,'اسم الطالب,Exam (العظمى 30)\nSynthetic 1,');await page.locator('[data-act="grade-confirm"]').click();await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الأسماء المعلقة: 0'));const snap=await snapshot(page);assert.equal(snap.items.find(i=>i.id==='n73-source-exam').max,30);assert.equal(snap.scores.find(s=>s.id==='n73-source-score').value,19);assert.equal(requests.length,0);pass(scenario,'Declared maximum applies with blank file cells; canonical max ACK, unchanged19/zero and no unnecessary grade command.');continue;}
    await review(page);assert.equal(await page.locator('.n107-review').count(),1);assert.match(await page.locator('[data-grade-max-impact]').innerText(),/20→30/);
    assert.equal(await page.locator('[data-grade-proposed-items]').count(),0);
    if(scenario==='owner'||scenario==='term'){
     const before=await checkpoint(page);await page.evaluate(async scenario=>{if(scenario==='term'){const s=await import('/src/store.js');s.state.device.activeTermId=s.state.terms.find(t=>t.id!=='n73-term').id;return;}const c=await import('/src/lib/cloud.js');c.setMockAuth({id:'foreign-synthetic'}, {...c.session,user:{id:'foreign-synthetic'}});},scenario);
     await page.locator('[data-act="grade-confirm"]').click();assert.equal(requests.length,0);assert.equal(syncCalls.length,0);assert.equal(await checkpoint(page),before);pass(scenario,'Actual UI confirmation with changed owner dispatches neither max nor grade.');continue;
    }
    if(scenario==='existing'){await mkdir('tests/fixtures/n107-name-max',{recursive:true});await page.setViewportSize({width:390,height:844});await page.locator('.n107-review').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/fixtures/n107-name-max/existing-preview.png'});await page.setViewportSize({width:1000,height:900});}
    if(scenario==='item-drift')await page.evaluate(()=>globalThis.__gate=true);
    maxMode=scenario==='lost-reload'?'lost':scenario==='rejected'?'reject':['delayed-double','session-during-ack'].includes(scenario)?'delay':null;
    await page.locator('[data-act="grade-confirm"]').click();
    if(scenario==='session-during-ack'){await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,{...c.session});});await page.waitForTimeout(900);assert.equal(requests.length,0);pass(scenario,'Session changes while normal max transport is in flight: no grade dispatch/success.');continue;}
    if(scenario==='item-drift'){await page.waitForFunction(()=>!!globalThis.__releaseCapability);await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.items.find(i=>i.id==='n73-source-exam').name='Drifted';globalThis.__releaseCapability();});await page.waitForFunction(()=>document.body.textContent.includes('تغيّر أثر الاستيراد'));assert.equal(requests.length,0);pass(scenario,'Item changes during asynchronous grade preflight after max ACK: fresh UI/store check blocks grade command.');continue;}
    if(scenario==='delayed-double')await page.evaluate(()=>document.querySelector('[data-act="grade-confirm"]')?.click());
    if(scenario==='lost-reload'||scenario==='rejected'){
     await page.locator('[data-act="roster-resume"]').waitFor();assert.equal(requests.length,0);const pending=(await snapshot(page)).saved.maxProgress;assert.equal(pending.length,1);
     if(scenario==='lost-reload'){await page.locator('[data-act="grade-cancel"]').click();await page.waitForFunction(()=>document.body.textContent.includes('طلب تغيير العظمى المعلّق'));assert.equal((await snapshot(page)).saved.maxProgress[0].mutationId,pending[0].mutationId);}
     await prepare(page,true);await page.locator('[data-act="roster-resume"]').waitFor();assert.equal(requests.length,0);assert.equal(syncCalls.length,1);
     if(scenario==='lost-reload'){await sync(page);assert.equal(syncCalls.length,1,'background Sync must not replay foreground max stage');assert.equal(requests.length,0);}
     await page.locator('[data-act="roster-resume"]').click();
     if(scenario==='rejected'){await page.locator('[data-act="roster-resume"]').waitFor();assert.equal(syncCalls.length,1);assert.equal(requests.length,0);pass(scenario,'Durable max rejection survives reload and explicit resume sends no retry/grade.');continue;}
     await complete(page);assert.equal(new Set(syncCalls.filter(r=>r.kind==='mutation').map(r=>r.mutationId)).size,1);
    }else await complete(page);
    const snap=await snapshot(page);assert.equal(snap.items.find(i=>i.id==='n73-source-exam').max,30);assert.equal(snap.items.filter(i=>i.teachingId==='n73-source').length,1);
    assert.equal(snap.scores.find(s=>s.id==='n73-source-score').value,19);assert.equal(snap.scores.find(s=>s.id==='untouched-zero').value,0);
    assert.equal(snap.scores.filter(s=>s.itemId==='n73-source-exam').length,3);assert.equal(requests.length,1);assert.equal(snap.saved,null);
    pass(scenario,'Actual single preview/handlers/source CSS and owned account: same item exact max30 canonical request ACK before one durable grade receipt; old19 blank and untouched zero unchanged.');
   }catch(e){console.log(await page.locator('[data-roster-file-flow]').innerText());console.log(JSON.stringify(syncCalls));throw e;}finally{await context.close();}
  }
 });
 for(const [file,hash]of Object.entries(evidence.testedFiles))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,'Affected source changed during check: '+file);
}catch(e){evidence.failures.push(e.stack);process.exitCode=1;console.log(e.stack);}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile('tests/n107-name-max-browser.json',JSON.stringify(evidence,null,2)+'\n');}
