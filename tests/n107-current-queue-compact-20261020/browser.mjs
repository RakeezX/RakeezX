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

const taskId='continuous-n107-current-background-queue-compact-ux-20261020',runId='9702c98f-2efb-4e10-9c09-90c89b4b151a';
const base='http://127.0.0.1:49779',root=resolve('.');

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
   if(name==='grade' && (mode==='delay'||mode==='delay-second'&&requests.length===1))await new Promise(r=>{releaseGrade=r;gradeArrived.resolve();});
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
const until=async(check,label)=>{for(let n=0;n<160;n++){if(await check())return;await new Promise(r=>setTimeout(r,75));}throw Error('Timed out: '+label);};
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49779,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:90000},async({createContext})=>{
  const {context,page}=await fresh(createContext);
  try{
   await page.evaluate(async()=>{(await import('/src/lib/sync.js')).init();(await import('/src/lib/class-import-background.js')).installImportBackground();});
   await until(()=>page.evaluate(async()=>!!(await import('/src/lib/sync.js')).state.lastSyncedAt),'fixture startup Sync');creationMode='delay';
   await approve(page);await creationArrived.promise;assert.equal(requests.length,0);
   await page.evaluate(()=>location.hash='#/classes');await visit(page,'#/classes/koshoof');await approve(page,'4');assert.equal((await plans(page)).length,2);
   mode='delay-second';creationMode=null;releaseCreation();await gradeArrived.promise;
   await until(async()=>{const p=await plans(page);return p.filter(p=>p.state==='cloud_confirmed').length===1;},'first durable receipt');
   assert.equal(await page.locator('[data-local-import-plans]').getAttribute('data-active-import-count'),'1');assert.match(await page.locator('[data-local-import-saved]').innerText(),/حُفظ على هذا الجهاز/);await until(async()=>/جارٍ مزامنة الدرجات/.test(await page.locator('[data-local-import-saved]').innerText()),'durable queued grade stage');
   for(const [name,width]of [['desktop',1100],['mobile',390]]){await page.setViewportSize({width,height:900});await page.screenshot({path:'tests/n107-current-queue-compact-20261020/'+name+'.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   mode=null;releaseGrade();
   await until(async()=>{const p=await plans(page);return p.length===2&&p.every(p=>p.state==='cloud_confirmed');},'automatic two-plan confirmation');
   assert.equal(requests.length,2);assert.equal(new Set(requests.map(r=>r.mutationId)).size,2);assert.ok(requests.every(r=>r.batch.cells.length===4));
   evidence.plans=(await plans(page)).map(p=>({state:p.state}));
   const snap=await snapshot(page);for(const request of requests){const items=snap.items.filter(i=>i.teachingId===request.batch.teachingId),scores=snap.scores.filter(s=>items.some(i=>i.id===s.itemId));assert.equal(scores.length,4);assert.deepEqual(scores.map(s=>s.value).sort((a,b)=>a-b),[0,9,9,17]);assert.equal(items.find(i=>i.name==='الواجبات').max,20);assert.ok(receipts.has(request.mutationId));assert.ok(!snap.outbox.some(r=>r.mutationId===request.mutationId));}
   await page.locator('[data-local-import-plans]').waitFor({state:'detached'});assert.equal((await plans(page)).length,2);
   pass('n107_two_imports_background_receipts_grades_and_terminal_active_count','Installed automatic Sync/coordinator completes two independent real IndexedDB plans without manual drains; exact four grades and max ACKs each, two durable receipts once; terminal plans leave active count.');
   await page.locator('[data-act="local-import-next"]').click();await page.locator('[data-local-import-saved]').waitFor({state:'detached'});assert.equal(await page.locator('[data-local-import-saved]').count(),0);assert.equal(await page.locator('[data-local-import-plans]').count(),0);assert.equal(await page.locator('[data-act="import-duration-copy"]').count(),0);
   await upload(page);await chooseMode(page,'grades');
   await page.locator('[data-grade-mapping-details] > summary').click();const advanced=page.locator('[data-grade-identity-optional]');assert.equal(await advanced.getAttribute('open'),null);await advanced.locator('summary').click();await page.locator('[data-grade-id]').waitFor({state:'visible'});assert.match(await advanced.innerText(),/لا تحتاج معرف ركيز عادة/);assert.equal(await page.locator('[data-grade-id]').count(),1);
   await advanced.locator('summary').click();await page.locator('[data-grade-id]').waitFor({state:'hidden'});assert.equal(await advanced.getAttribute('open'),null);
   await page.evaluate(async()=>{const s=await import('/src/store.js');await s.updateLocalImportPlans(plans=>{const p=Object.values(plans)[0];return {...plans,'synthetic-review':{...p,id:'synthetic-review',state:'needs_review'},'synthetic-cancelled':{...p,id:'synthetic-cancelled',state:'cancelled'}};});});
   await page.locator('[data-local-import-plans][open]').waitFor();assert.equal(await page.locator('[data-local-import-plans]').getAttribute('data-active-import-count'),'1');assert.equal(await page.locator('[data-act="local-import-retry"]').count(),1);assert.equal(await page.locator('[data-act="local-import-cancel"]').count(),1);
   await page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');s.deactivateWorkspace();c.setMockAuth({id:'synthetic-other'},{user:{id:'synthetic-other'}});(await import('/src/repaint.js')).repaint();});await page.locator('[data-local-import-plans]').waitFor({state:'detached'});
   pass('n107_compact_success_optional_diagnostics_advanced_identity_ui','Actual source UI inspected at 390/1100 widths with no overflow; concise local/cloud status, active-only collapsed queue, clean next-file action, advanced identity remains optional and collapsed with ordinary-name guidance.');
  }catch(e){evidence.lastPlans=await plans(page);evidence.lastUi=await page.locator('[data-roster-file-flow]').innerText().catch(()=>'');throw e;}
  finally{releaseCreation?.();releaseMaximum?.();releaseGrade?.();await context.close();}
 });
}catch(e){evidence.failures.push(e.stack);console.error(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile('tests/n107-current-queue-compact-20261020/result.json',JSON.stringify(evidence,null,2));}
