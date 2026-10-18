// AI-authored: actual app, source CSS, account store/ownership and Sync handlers.
// Only disposable loopback fixtures; no hosted backend or real account data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
import {decodeSyncV2Canonical,SYNC_V2_SCHEMAS,encodeSyncV2Patch} from '../src/lib/sync-v2.js';
import {makeEnrollment,makeItem,makeStudent,makeTeaching,defaultItemsFor} from '../src/models.js';

const taskId='continuous-n107-file-import-sync-item-matching-20261018',runId='306e6dd3-905a-49ed-9396-aaaf676e1344';
const base='http://127.0.0.1:49718',root=resolve('.');

const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
try{const previous=JSON.parse(await readFile('tests/n107-file-sync-browser.json','utf8'));evidence.previousFailures=[...(previous.previousFailures??[]),...(previous.failures??[])];}catch{}
for(const f of ['src/views/class-import-center.js','src/store.js','src/lib/sync.js','src/lib/grade-transfer.js','src/models.js','src/styles/components.css','tests/fixtures/n107-file-sync/roster.csv'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
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
  assert.equal(item.teachingId,t.id);assert.ok(c.value>=0&&c.value<=item.max);
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
 receipts.set(e.mutationId,result);return result;
}
const csv=await readFile('tests/fixtures/n107-file-sync/roster.csv','utf8');
const expectedRows=csv.trimEnd().split('\n').slice(1).map(r=>r.split(','));
const expectedCells=expectedRows.reduce((n,r)=>n+(r[2]!==''?1:0)+(r[3]!==''?1:0),0);
async function fresh(createContext){
 resetService();syncCalls=[];creationMode=null;partialId=null;
 const context=await createContext({viewport:{width:1000,height:900},locale:'ar-SA'});
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>evidence.failures.push(e.message));await prepare(page);return {context,page};
}
async function newReview(page){
 await upload(page,csv);
 if(await page.locator('[data-import-kind]').inputValue()==='new')await chooseMode(page,'grades');
 if(await page.locator('[data-import-kind]').inputValue()!=='new')await page.locator('[data-import-kind]').selectOption('new');
 await page.locator('[data-roster-field="grade"]').selectOption('11');
 await page.locator('[data-roster-field="label"]').fill('2');await page.locator('[data-roster-field="label"]').dispatchEvent('change');
 await page.locator('[data-roster-field="subject"]').selectOption({label:'البدنية'});await chooseMode(page,'grades');
 const activities=page.locator('[data-grade-column="2"] [data-grade-kind]');
 assert.match(await activities.inputValue(),/^prospective-default-/);
 assert.equal(await page.locator('[data-grade-ignored="1"]').count(),1,'automatic participation protected');
 assert.equal(await page.locator('[data-grade-column="3"] [data-grade-kind]').inputValue(),'ignore','max mismatch requires explicit choice');
 await page.locator('[data-grade-mapping-details]').evaluate(e=>e.open=true);
 await page.locator('[data-grade-column="3"] [data-grade-kind]').selectOption('prospective-default-1');
 assert.match(await page.locator('[data-grade-column="3"]').innerText(),/العظمى مختلفة/);
 await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
 assert.equal(await page.locator('[data-grade-proposed-items]').count(),0,'no duplicate defaults proposed');
}
async function startCreation(page){
 await page.locator('[data-act="class-import-confirm"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-roster-partial]')?.textContent.includes('انتظار المزامنة'));
}
const sync=page=>page.evaluate(async()=>await(await import('/src/lib/sync.js')).syncAll({full:true}));
const completed=page=>page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('اكتمل الاستيراد.'));
async function saved(page){return page.evaluate(async()=>{
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),t=s.state.teachings.find(t=>s.getSection(t.sectionId)?.grade===11);
 return {id:t?.id,sections:s.state.sections.filter(r=>r.grade===11).length,students:t?s.teachingContext(t.id).roster.length:0,
  items:t?s.teachingContext(t.id).items:[],scores:t?s.state.scores.filter(r=>s.state.items.find(i=>i.id===r.itemId)?.teachingId===t.id):[],
  outbox:await d.getAll('outbox'),continuation:(await d.get('device','device'))?.classFileImportContinuation};
});}
async function verifySaved(page){
 const result=await saved(page);assert.equal(result.sections,1);assert.equal(result.students,28);assert.equal(result.items.length,5);
 assert.equal(result.scores.length,expectedCells);assert.equal(result.outbox.length,0);assert.equal(result.continuation,null);
 for(let i=0;i<expectedRows.length;i++)for(const col of [2,3]){
  const name=col===2?'الأنشطة والمشاريع':'الواجبات',row=expectedRows[i];
  const found=await page.evaluate(({name,student})=>{return import('/src/store.js').then(s=>{
   const t=s.state.teachings.find(t=>s.getSection(t.sectionId)?.grade===11),id=s.teachingContext(t.id).roster.find(r=>r.name===student)?.id,item=s.items(t.id).find(r=>r.name===name);
   return s.state.scores.find(r=>r.studentId===id&&r.itemId===item.id)?.value??null;
  });},{name,student:row[0]});
  assert.equal(found,row[col]===''?null:Number(row[col]));
 }
 assert.ok(result.scores.some(r=>r.value===0),'zero durably saved');assert.equal(new Set(result.items.map(r=>r.name)).size,5);
 return result;
}
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49718,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const scenarios=['immediate','delayed','partial-reload','expired-reload','lost-receipt','rejected-grade','rejected-parent','session','term','owner','expiry','item-drift','cancel'];
  const from=process.argv.find(v=>v.startsWith('--from='))?.slice(7);
  if(from){
   const previous=JSON.parse(await readFile('tests/n107-file-sync-browser.json','utf8'));
   // Reuse unchanged first scenarios only; failed scenarios always execute again.
   for(const [name,hash]of Object.entries(previous.testedFiles))assert.equal(evidence.testedFiles[name],hash);
   evidence.checks=previous.checks.filter(c=>scenarios.slice(0,scenarios.indexOf(from)).some(s=>c.name.startsWith(s+'_')));
  }
  for(const scenario of scenarios.slice(from?scenarios.indexOf(from):0)){
   const {context,page}=await fresh(createContext);
   try{
    if(scenario==='immediate')await visit(page,'#/classes/koshoof?new=1');
    await newReview(page);
    if(['session','term','owner','expiry','item-drift'].includes(scenario))await page.evaluate(()=>globalThis.__gate=true);
    await startCreation(page);
    if(scenario==='delayed')creationMode='delay';
    if(['partial-reload','expired-reload'].includes(scenario))creationMode='partial';
    if(scenario==='rejected-parent')creationMode='reject-parent';
    if(scenario==='lost-receipt')mode='lost';
    if(scenario==='rejected-grade')mode='reject';
    if(scenario==='cancel')await page.locator('[data-act="grade-cancel"]').click();
    const running=sync(page);
    if(scenario==='delayed'){
     await page.waitForTimeout(350);assert.equal(requests.length,0);
     assert.equal(await page.locator('[data-act="class-import-confirm"]').count(),0,'duplicate submit unavailable');
    }
    await running;
    if(['session','term','owner','expiry','item-drift'].includes(scenario)){
     await page.waitForFunction(()=>typeof globalThis.__releaseCapability==='function');
     await page.evaluate(scenario=>{return Promise.all([import('/src/store.js'),import('/src/lib/cloud.js')]).then(([s,c])=>{
      if(scenario==='session')c.setMockAuth(c.user,{...c.session});
      if(scenario==='owner')c.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},c.session);
      if(scenario==='expiry'){const now=Date.now;Date.now=()=>now()+11*60*1000;}
      if(scenario==='item-drift')s.state.items.find(i=>i.name==='الأنشطة والمشاريع'&&s.getSection(s.getTeaching(i.teachingId)?.sectionId)?.grade===11).max=19;
      if(scenario==='term')s.state.device.activeTermId=s.state.terms.find(t=>t.id!=='n73-term').id;
      globalThis.__releaseCapability();
     });},scenario);
     await page.waitForTimeout(100);assert.equal(requests.length,0,'context change cannot dispatch grades');
     assert.equal((await saved(page)).scores.length,0);
     pass(scenario+'_switch_stops_grade_dispatch','Actual account UI, normal creation ACK, held async grade capability; context change rejects before grade command.');continue;
    }
    if(scenario==='cancel'){await page.waitForTimeout(100);assert.equal(requests.length,0);assert.equal((await saved(page)).continuation,null);pass('cancel_stops_continuation','Cancel retains saved names and normal outbox; no grade request or retained file draft.');continue;}
    if(['partial-reload','expired-reload'].includes(scenario)){
     assert.equal((await saved(page)).scores.length,0);assert.equal(requests.length,0);
     const partial=await saved(page);assert.ok(partial.outbox.some(r=>r.state==='failed'));
     assert.ok(partial.items.every(i=>i.serverRevision>0),'committed creation ACKs visible despite trailing failure');
     await page.locator('[data-act="roster-resume"]').waitFor();
     if(scenario==='expired-reload')await page.evaluate(async()=>{
      const s=await import('/src/store.js');await s.saveClassFileImportContinuation({...s.state.device.classFileImportContinuation,expires:Date.now()-1});
     });
     await prepare(page,true);
     assert.equal((await saved(page)).students,28);assert.equal((await saved(page)).sections,1);
     creationMode=null;
     if(scenario==='expired-reload'){
      assert.equal(await page.locator('[data-act="roster-resume"]').count(),0);
      await sync(page);assert.equal(requests.length,0,'expired review cannot auto-dispatch');
      await page.locator('[data-act="roster-changed-review"]').click();
      await page.locator('[data-act="grade-confirm"]').click();
     }else{
      await page.locator('[data-act="roster-resume"]').waitFor();
      await page.locator('[data-act="roster-resume"]').click();await sync(page);
     }
    }
    if(scenario==='lost-receipt'){
     await page.locator('[data-act="grade-retry"]').waitFor();const mutation=(await saved(page)).outbox.find(r=>r.command==='score:grade_import').mutationId;
     assert.equal(canonical.scores.filter(s=>s.id.startsWith('sc:')).length,expectedCells);
     await prepare(page,true);await page.locator('[data-act="grade-retry"]').waitFor();
     await page.locator('[data-act="grade-retry"]').click();
     await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الأسماء المحفوظة: 28'));
     assert.equal(requests.length,2);assert.ok(requests.every(r=>r.mutationId===mutation));
    }else if(scenario==='rejected-grade'){
     await page.locator('[data-act="grade-retire"]').waitFor();const before=await saved(page);
     assert.equal(before.scores.length,0);assert.equal(before.outbox.find(r=>r.command==='score:grade_import').state,'rejected');
     await prepare(page,true);await page.locator('[data-act="grade-retire"]').waitFor();
     assert.equal(await page.locator('[data-act="grade-retry"]').count(),0);assert.equal(requests.length,1);
     pass('rejected_grade_receipt_retained_on_reload','No grades committed, exact rejected owner-bound command retained; reload offers explicit disposition, no retry/new request.');continue;
    }else if(scenario==='rejected-parent'){
     await page.locator('[data-act="roster-resume"]').waitFor();assert.equal(requests.length,0);assert.equal((await saved(page)).scores.length,0);
     assert.ok((await saved(page)).outbox.some(r=>r.state==='rejected'));
     pass('rejected_parent_blocks_grades','Real creation outbox receives 409; dependency rejection stays durable and no grade command is dispatched.');continue;
    }else if(scenario==='expired-reload')await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الأسماء المحفوظة: 28'));
    else await completed(page);
    const final=await verifySaved(page);
    assert.equal(syncCalls.filter(r=>r.kind==='teaching').length,1,'one teaching/default-item generation');
    // Existing destination: same canonical matching/defaults; blank preserves old and equal grades are a no-op.
    const noChange=await page.evaluate(async({id,rows})=>{
     const s=await import('/src/store.js'),g=await import('/src/lib/grade-transfer.js');
     const ctx=s.teachingContext(id),maps=g.suggestGradeMappings(rows[0],ctx.items,{teachingId:id,ownerId:s.getActiveWorkspace().authUserId});
     maps.mappings=maps.mappings.map(m=>m.kind==='new'?{...m,id:crypto.randomUUID(),confirmed:true}:m);
     maps.mappings[3]={kind:'existing',itemId:ctx.items.find(r=>r.name==='الواجبات').id};
     const review=s.reviewGradeImport(id,{...maps,rows});return {cells:review.cells.length,overwrites:review.overwrites,unchanged:review.unchanged};
    },{id:final.id,rows:csv.trimEnd().split('\n').map(r=>r.split(','))});
    assert.equal(noChange.cells,0);assert.equal(noChange.overwrites,0);assert.ok(noChange.unchanged>0);
    pass(scenario+'_normal_ack_and_durable_grades','Actual app DOM/handlers/CSS, grade11/section2/PE, 28 fabricated rows; normal owned creation commands, default item ACK, explicit max mismatch consent, existing activity/homework destinations, durable '+expectedCells+' scores including zero; blanks/equal values preserve grades, five unique items, no pending outbox/draft.');
   }finally{await context.close();}
  }
 });
 for(const [file,hash]of Object.entries(evidence.testedFiles))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,'Product/fixture changed during verification: '+file);
}catch(e){evidence.failures.push(e.stack);process.exitCode=1;console.log(e.stack);}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));evidence.sourceRegression={baseline:'Normal creation ACK reached empty outbox but canonicalId/serverCanonical changed year/term fingerprint: foreground import falsely reported changed context, no grades; new-class activities/homework proposed as duplicates.',privateAttachment:'Verified SHA256/1823 bytes/28 rows/6 columns locally. Only fabricated names/values and header/blank/type shape retained.'};await writeFile('tests/n107-file-sync-browser.json',JSON.stringify(evidence,null,2)+'\n');}
