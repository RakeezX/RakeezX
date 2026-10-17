// AI-authored: actual app, source CSS, account store/ownership and Sync handlers.
// Only disposable loopback fixtures; no hosted backend or real account data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner,capability} from './n73-account-flow-fixture.mjs';
import {encodeSyncV2Patch} from '../src/lib/sync-v2.js';
import {makeEnrollment,makeItem,makeStudent} from '../src/models.js';
import {exportGradeXlsx} from '../src/lib/grade-transfer-xlsx.js';

const taskId='continuous-n107-calm-single-review-import-20261017',runId='dbae21a6-10e7-4500-a33e-e8c87a4fb8ec';
const base='http://127.0.0.1:49617',root=resolve('.');
const screenshotsOnly=process.argv.includes('--screenshots-only');
const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
try{const previous=JSON.parse(await readFile('tests/n107-calm-single-review-import-browser.json','utf8'));evidence.previousFailures=[...(previous.previousFailures??[]),...(previous.failures??[])];}catch{}
for(const f of ['src/views/class-import-center.js','src/store.js','src/styles/components.css'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
if(screenshotsOnly){
 const previous=JSON.parse(await readFile('tests/n107-calm-single-review-import-browser.json','utf8'));
 assert.deepEqual(previous.testedFiles,evidence.testedFiles);assert.deepEqual(previous.failures,[]);
 evidence.checks=previous.checks; // reuse actual passing behavior evidence for identical Product source
}
const pass=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
let service,mode=null,requests=[],receipts=new Map(),canonical;
function resetService(){
 service=syntheticService();requests=[];receipts=new Map();mode=null;
 service.current.enrollments=service.current.students.map((s,i)=>({...makeEnrollment({id:'e'+i,studentId:s.id,sectionId:'n73-source-section'}),ownerId:owner,serverRevision:1}));
 canonical=service.current;
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
  changed.scores.push({id:c.scoreId??`sc:${c.studentId}:${c.itemId}`,itemId:c.itemId,studentId:c.studentId,value:c.value,deleted:false,ownerId:owner,serverRevision:(old?.serverRevision??0)+1});
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
   const result=name==='grade'?apply(input):name==='adopt'?(canonical=input,true):await service.request(name,input);
   res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
  }
  const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
  res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(await readFile(f));
 }catch(e){res.writeHead(e.status??500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message,status:e.status??500,code:e.code}));}
});
async function prepare(page){
 await openReadyServedDemo(page,base);
 await page.evaluate(async()=>{
  const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
  const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-roster-local'};
  s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
  const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
  try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
  const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
  if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
  await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  c.setMockBackend({getScoreFoundationCapability:()=>({scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1}),
   getGradeImportCapability:async()=>{if(globalThis.__gate)await new Promise(r=>globalThis.__releaseCapability=r);return globalThis.__n107Unavailable ? {} : ({protocol:'N90_REVIEWED_V1',version:1,unifiedProtocol:'N90_UNIFIED_V1',unifiedVersion:1});},
   async applyReviewedGradeImport(input){
    const durable=(await d.getAll('outbox')).find(r=>r.mutationId===input.mutationId);
    if(durable?.ownerId!==f.owner||durable.command!=='score:grade_import')throw Error('Missing actual owner-bound command');
    const r=await fetch('/__n73/grade',{method:'POST',body:JSON.stringify(input)}),data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),data);return data;
   }});
  s.assertClassImportAccess();(await import('/src/repaint.js')).repaint();
 });
 await visit(page,'#/classes/koshoof?teaching=n73-source');
}
async function visit(page,hash){await page.evaluate(hash=>location.hash=hash,hash);await page.locator('[data-roster-file-flow]').waitFor();await page.waitForFunction(hash=>location.hash===hash,hash);}
const checkpoint=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
const upload=async(page,text='اسم الطالب,اختبار جديد (العظمى 10)\nطالب موجب,7\nطالب صفر,0\nطالب فارغ,')=>{
 await page.locator('[data-change="grade-file"]').setInputFiles({name:'roster.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await page.locator('[data-import-kind]').waitFor();
};
const chooseMode=async(page,mode)=>page.locator('[data-act="grade-import-mode"][data-mode="'+mode+'"]').first().click();
async function createFields(page,label='أ'){
 await page.locator('[data-import-kind]').selectOption('new');
 await page.locator('[data-roster-field="grade"]').selectOption('4');await page.locator('[data-roster-field="label"]').fill(label);await page.locator('[data-roster-field="label"]').dispatchEvent('change');
 await page.locator('[data-roster-field="subject"]').selectOption({label:'الرياضيات'});
}
// A fixture acknowledgment of creation prerequisites, not a live Sync claim.
async function acknowledgeCreation(page){
 return page.evaluate(async()=>{
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),owner=s.getActiveWorkspace().authUserId,rows={};
  for(const name of ['years','terms','subjects','sections','teachings','students','enrollments','items','scores']){
   rows[name]=(await d.getAll(name)).map(r=>({...r,ownerId:owner,serverRevision:Math.max(1,r.serverRevision??0),syncCreatePending:false}));await d.putMany(name,rows[name]);
  }
  for(const row of await d.getAll('outbox')){if(row.command==='score:grade_import')throw Error('Cannot erase a grade command');await d.applyBatch({outbox:{remove:[row.id]}});}
  await fetch('/__n73/adopt',{method:'POST',body:JSON.stringify(rows)});await s.refreshSyncedState();(await import('/src/repaint.js')).repaint();
  return rows;
 });
}
const overflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
const review=async page=>{await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();};
const confirm=async page=>page.locator('[data-act="class-import-confirm"],[data-act="grade-confirm"]').click();
const done=async page=>{try{await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الأسماء المحفوظة:'));}catch(e){console.log('FAIL UI '+await page.locator('[data-roster-file-flow]').innerText());throw e;}};
async function fresh(createContext,width=390){
 resetService();const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>evidence.failures.push(e.message));await prepare(page);return {context,page};
}
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49617,'127.0.0.1',ok);});
 await mkdir('tests/fixtures/n107-calm-single-review-import',{recursive:true});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  if(screenshotsOnly){
   for(const width of [320,390,1280]){
    const {context,page}=await fresh(createContext,width);
    try{
     await upload(page,'اسم الطالب,اختبار أول (العظمى 10),اختبار ثان (العظمى 20)\n'+Array.from({length:28},(_,i)=>`طالب مصطنع ${i+1},,`).join('\n'));
     await createFields(page);await chooseMode(page,'grades');await review(page);await overflow(page);
     await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`tests/fixtures/n107-calm-single-review-import/blank28-${width}.png`,fullPage:true});
    }finally{await context.close();}
   }
   for(const dest of ['existing','new'])for(const content of ['names','grades']){
    const {context,page}=await fresh(createContext);
    try{
     await upload(page);if(dest==='new')await createFields(page);await chooseMode(page,content);await review(page);await overflow(page);
     await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`tests/fixtures/n107-calm-single-review-import/${dest}-${content}-390.png`,fullPage:true});
    }finally{await context.close();}
   }
   evidence.visualCapture='Same actual Product source; full-page captures refreshed at document top to avoid a scrolled fixed-header screenshot artifact. Behavior checks reused by exact SHA256.';
   return;
  }
  for(const dest of ['existing','new'])for(const content of ['names','grades']){
   const {context,page}=await fresh(createContext);
   try{
    const before=await checkpoint(page);
    assert.equal(await page.locator('[data-change="grade-file"]').count(),1);
    assert.equal(await page.locator('[data-n36-direct]').evaluate(el=>el.compareDocumentPosition(document.querySelector('[data-roster-file-flow]'))&Node.DOCUMENT_POSITION_FOLLOWING),4);
    assert.equal(await page.locator('[data-act="teacher-setup-import"]').count(),0);
    assert.doesNotMatch(await page.locator('[data-roster-file-flow]').innerText(),/JSON|300|1 MB/);
    assert.match(await page.locator('[data-n36-direct] a').getAttribute('href'),/0.5.10.zip$/);
    await upload(page);await createFields(page);await chooseMode(page,'grades');await page.locator('[data-import-kind]').selectOption('existing');
    assert.equal(await checkpoint(page),before);assert.equal(await page.locator('[data-grade-file-name]').count(),1);
    if(dest==='new')await createFields(page);await chooseMode(page,content);
    await review(page);assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);
    assert.equal(await page.locator('[data-roster-preview] tbody tr').count(),3);
    assert.equal(await page.locator('[data-grade-review] ul').count(),0);
    assert.equal(await page.locator('[data-grade-new-confirm]').count(),0);
    assert.equal(await page.locator('[data-grade-reviewed-mapping]').evaluate(el=>el.open),false);
    await overflow(page);await page.screenshot({path:`tests/fixtures/n107-calm-single-review-import/${dest}-${content}-390.png`,fullPage:true});
    await confirm(page);
    if(dest==='new'&&content==='grades'){
     await page.locator('[data-roster-partial]').waitFor();assert.equal(requests.length,0);
     assert.equal(await page.locator('[data-act="grade-confirm"]').count(),0);
     await acknowledgeCreation(page);
    }
    await done(page);
    if(content==='grades'){
     await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الدرجات المحفوظة: 2'));
     assert.equal(requests.length,1);assert.deepEqual(requests[0].batch.cells.map(c=>c.value),[7,0]);
     assert.equal(requests[0].batch.newStudents?.length??0,dest==='new'?0:3);
     const dbscores=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return d.getAll('scores');});
     for(const c of requests[0].batch.cells)assert.ok(dbscores.some(s=>s.studentId===c.studentId&&s.itemId===c.itemId&&s.value===c.value));
     assert.equal(canonical.scores.filter(s=>requests[0].batch.cells.some(c=>c.studentId===s.studentId&&c.itemId===s.itemId)).length,2);
    }else assert.equal(requests.length,0);
    evidence.checks.push({name:`actual_${dest}_${content}`,status:'PASS',evidence:'Actual account app UI/store, one final confirmation, no second review. Grades use owner-bound outbox + cloud transport + canonical receipt; 7/0 saved, blank omitted.'});
   }finally{await context.close();}
  }
  pass('n107_direct_extension_first_concise_file_entry_no_obsolete_json_or_duplicate_panels','Actual app DOM/handlers: extension 0.5.10 first, one filename, short CSV/XLSX hint, obsolete JSON entry removed; same parsed file retained across destination/mode changes; no write before confirmation.');
  for(const width of [320,390,1280])for(const dest of ['new','existing']){
   const {context,page}=await fresh(createContext,width);
   try{
    await upload(page,'اسم الطالب,اختبار أول (العظمى 10),اختبار ثان (العظمى 20)\n'+Array.from({length:28},(_,i)=>`طالب مصطنع ${i+1},,`).join('\n'));
    if(dest==='new')await createFields(page);await chooseMode(page,'grades');await review(page);
    const pane=page.locator('[data-roster-file-flow]');
    assert.match(await pane.innerText(),/لا توجد درجات مدخلة في الملف/);
    assert.equal(await page.locator('[data-roster-preview] tbody tr').count(),10);
    assert.equal(await page.locator('[data-roster-preview] thead th').count(),2);
    assert.equal(await page.locator('[data-grade-review] ul').count(),0);
    let names=[];for(let i=0;i<3;i++){
     names.push(...await page.locator('[data-roster-preview] tbody th').allTextContents());
     if(i<2){await page.getByRole('button',{name:'التالي',exact:true}).click();await page.waitForFunction(n=>document.querySelector('[data-roster-preview] tbody th')?.textContent===`طالب مصطنع ${n}`,(i+1)*10+1);}
    }
    assert.equal(new Set(names).size,28);await overflow(page);
    if(dest==='new'){
     await page.getByRole('button',{name:'السابق',exact:true}).click();await page.getByRole('button',{name:'السابق',exact:true}).click();
     await page.screenshot({path:`tests/fixtures/n107-calm-single-review-import/blank28-${width}.png`,fullPage:true});
    }
    await confirm(page);await done(page);assert.equal(requests.length,0);
    assert.equal(await page.locator('[data-roster-partial]').count(),0);assert.doesNotMatch(await pane.innerText(),/درجات معلقة/);
    const saved=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {students:await d.getAll('students'),items:await d.getAll('items')};});
    assert.equal(saved.students.filter(s=>s.name.startsWith('طالب مصطنع')).length,28);
    assert.ok(!saved.items.some(i=>i.name==='اختبار أول'||i.name==='اختبار ثان'));
   }finally{await context.close();}
  }
  pass('n107_single_compact_preview_28_blank_grade_roster_and_four_modes_responsive','Four real app combinations plus both destinations with 28 fabricated names/two all-blank grade columns at 320/390/1280: 10 rows/page, all 28 accessible, one table, no blank-cell UL, no grade request/item creation/false pending. Source CSS overflow + screenshots.');
  for(const failure of ['lost','reject','unavailable','timeout','cancel','route','semantic','foreign-id','added-student','expired']){
   console.log('CASE '+failure);
   const {context,page}=await fresh(createContext);
   try{
    await upload(page);await createFields(page);await chooseMode(page,'grades');await review(page);
    mode=['lost','reject'].includes(failure)?failure:null;
    if(failure==='unavailable')await page.evaluate(()=>globalThis.__n107Unavailable=true);
    await confirm(page);await page.locator('[data-roster-partial]').waitFor();
    const saved=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {sections:(await d.getAll('sections')).length,students:(await d.getAll('students')).length};});
    if(failure==='cancel')await page.locator('[data-act="grade-cancel"]').click();
    if(failure==='route')await page.evaluate(()=>location.hash='#/classes');
    if(failure==='semantic')await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const item={...s.state.items.find(i=>!i.auto),id:'unexpected-item',name:'اختبار جديد',max:20,teachingId:s.state.teachings.find(t=>s.getSection(t.sectionId)?.grade===4&&s.getSection(t.sectionId)?.label==='أ').id,ownerId:s.getActiveWorkspace().authUserId,serverRevision:1};await d.put('items',item);s.state.items.push(item);});
    if(failure==='foreign-id')await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const student=s.state.students.find(s=>s.name==='طالب موجب');const foreign={...student,id:'foreign-in-receipt'};s.state.students=s.state.students.map(r=>r.id===student.id?foreign:r);await d.put('students',foreign);for(const e of s.state.enrollments.filter(e=>e.studentId===student.id))await d.put('enrollments',{...e,studentId:foreign.id});});
    if(failure==='added-student')await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const section=s.state.sections.find(r=>r.grade===4&&r.label==='أ');const e=s.state.enrollments.find(e=>e.sectionId===section.id);const student={...s.state.students.at(-1),id:'extra',name:'طالب إضافي'};await d.put('students',student);await d.put('enrollments',{...e,id:'extra-e',studentId:'extra'});});
    if(failure==='expired')await page.evaluate(()=>{const now=Date.now();Date.now=()=>now+11*60*1000;});
    if(failure==='timeout'){
     await page.locator('[data-act="roster-resume"]').waitFor({timeout:8500});assert.equal(requests.length,0);
     await acknowledgeCreation(page);assert.equal(requests.length,0);await page.locator('[data-act="roster-resume"]').click();await done(page);assert.equal(requests.length,1);
    }else{
     await acknowledgeCreation(page);
     if(['cancel','route','semantic','foreign-id','added-student','expired'].includes(failure)){
      await page.waitForTimeout(80);assert.equal(requests.length,0);
      if(['semantic','foreign-id','added-student','expired'].includes(failure)){
       assert.match(await page.locator('[data-roster-file-flow]').innerText(),/يلزم مراجعة جديدة/);
       assert.equal(await page.locator('[data-act="grade-confirm"]').count(),0);
       await page.locator('[data-act="roster-changed-review"]').click();
       await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('راجع الأثر الحالي'));
       assert.equal(requests.length,0);
       if(failure==='foreign-id')assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);
       else{await confirm(page);await done(page);assert.equal(requests.length,1);}
      }
     }else if(failure==='unavailable'){
      await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('قدرة استيراد الدرجات غير متاحة'));
      assert.equal(requests.length,0);await page.evaluate(()=>globalThis.__n107Unavailable=false);await page.locator('[data-act="roster-resume"]').click();await done(page);assert.equal(requests.length,1);
     }else{
      await page.locator(failure==='lost'?'[data-act="grade-retry"]':'[data-act="grade-retire"]').waitFor();
      const first=structuredClone(requests[0]);assert.equal(requests.length,1);
      if(failure==='lost'){
       await page.locator('[data-act="grade-cancel"]').click();await page.locator('[data-act="grade-retry"]').click();await page.locator('[data-act="grade-retry"]').waitFor({state:'detached'});
       assert.deepEqual(requests[1],first);assert.equal(receipts.size,1);
      }else{
       const rejected=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return (await d.getAll('outbox')).find(r=>r.command==='score:grade_import');});assert.equal(rejected.state,'rejected');
       await page.locator('[data-grade-retire-confirm]').check();await page.locator('[data-act="grade-retire"]').click();await page.locator('[data-act="grade-retire"]').waitFor({state:'detached'});assert.equal(requests.length,1);
       const retired=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return (await d.getAll('outbox')).find(r=>r.command==='score:grade_import');});assert.equal(retired.state,'superseded');assert.deepEqual(retired.lastError,rejected.lastError);assert.deepEqual(retired.error,rejected.error);assert.equal(retired.recoveryReason,'n90-explicit-rejected-disposition');
      }
     }
    }
    if(!['added-student','foreign-id'].includes(failure)){
     const after=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {sections:(await d.getAll('sections')).length,students:(await d.getAll('students')).length};});assert.deepEqual(after,saved);
    }
   }finally{await context.close();}
  }
  pass('n107_one_bound_consent_new_class_grades_ack_progress_and_semantic_drift_refusal','Original precise consent continues after delayed acknowledged parents; timeout/capability recovery resumes same plan without reupload/remapping/review. Changed item/max, foreign identity or extra student refuses; cancel/route stops future grade stages.');
 });
 if(!screenshotsOnly) await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const dest of ['existing','new'])for(const drift of ['owner','term','lease','session']){
   const {context,page}=await fresh(createContext);
   try{
    await upload(page);if(dest==='new')await createFields(page);await chooseMode(page,'grades');await review(page);
    await page.evaluate(()=>globalThis.__gate=true);await confirm(page);
    if(dest==='new'){await page.locator('[data-roster-partial]').waitFor();await acknowledgeCreation(page);}
    await page.waitForFunction(()=>!!globalThis.__releaseCapability);
    const before=await checkpoint(page);
    await page.evaluate(async drift=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
     if(drift==='owner')c.setMockAuth({id:'foreign'},c.session);
     if(drift==='term')s.state.device.activeTermId=s.state.terms[1].id;
     if(drift==='lease')(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate();
     if(drift==='session')c.setMockAuth(c.user,{...c.session});
     globalThis.__releaseCapability();
    },drift);
    await page.waitForTimeout(60);assert.equal(requests.length,0);assert.equal(await checkpoint(page),before);
   }finally{await context.close();}
  }
  for(const problem of ['duplicate','ambiguous','unknown-id','duplicate-mapping']){
   const {context,page}=await fresh(createContext);
   try{
    if(problem==='ambiguous')await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const student={...s.state.students[0],id:'ambiguous'};const e={...s.state.enrollments[0],id:'ambiguous-e',studentId:'ambiguous'};await d.put('students',student);await d.put('enrollments',e);await s.refreshSyncedState();});
    await upload(page,problem==='duplicate'?'اسم الطالب,Exam\nSynthetic 1,7\nSynthetic 1,4':problem==='unknown-id'?'اسم الطالب,Exam,معرف الطالب\nSynthetic 1,7,unknown':problem==='duplicate-mapping'?'اسم الطالب,Exam,Other\nSynthetic 1,7,3':'اسم الطالب,Exam\nSynthetic 1,7');await chooseMode(page,'grades');
    if(problem==='duplicate-mapping')await page.locator('[data-grade-column="2"] [data-grade-kind]').selectOption('n73-source-exam');
    const before=await checkpoint(page);await page.locator('[data-act="grade-review"]').click();
    if(problem==='duplicate-mapping')await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('اختر بندًا مختلفًا'));
    else {await page.locator('[data-grade-review]').waitFor();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);}
    assert.equal(requests.length,0);assert.equal(await checkpoint(page),before);
   }finally{await context.close();}
  }
  for(const fault of ['class-failure','overwrite','xlsx','cancel-preview']){
   const {context,page}=await fresh(createContext);
   try{
    if(fault==='overwrite')await upload(page,'اسم الطالب,Exam\nSynthetic 1,0');
    else if(fault==='xlsx'){
     const bytes=exportGradeXlsx({roster:[{id:'a',name:'طالب موجب'},{id:'b',name:'طالب صفر'},{id:'c',name:'طالب فارغ'}],items:[{id:'i',name:'اختبار جديد',max:10}],ctx:{a:{scoresByItem:{i:{value:7}}},b:{scoresByItem:{i:{value:0}}},c:{scoresByItem:{}}}});
     await page.locator('[data-change="grade-file"]').setInputFiles({name:'roster.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});await page.locator('[data-import-kind]').waitFor();
    }else await upload(page);
    if(fault!=='overwrite')await createFields(page);await chooseMode(page,'grades');await review(page);
    const before=await checkpoint(page);
    if(fault==='cancel-preview'){await page.locator('[data-act="grade-cancel"]').click();assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);continue;}
    if(fault==='overwrite'){
     assert.match(await page.locator('[data-roster-preview]').innerText(),/19.*←.*0/s);
     await confirm(page);assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);
     await page.locator('[data-grade-overwrite-confirm]').check();await confirm(page);await done(page);assert.equal(requests[0].batch.overwriteConfirmed,true);assert.equal(requests[0].batch.cells[0].value,0);continue;
    }
    if(fault==='class-failure')await page.evaluate(async()=>{
     const d=await import('/src/lib/db.js'),db=await d.openDB(),original=db.transaction.bind(db);let fail=true;
     db.transaction=function(names,...args){if(fail&&args[0]==='readwrite'&&Array.from(names).includes('items')){fail=false;throw Error('N107 synthetic UI teaching failure');}return original(names,...args);};
    });
    await confirm(page);await page.locator('[data-roster-partial]').waitFor();
    if(fault==='class-failure'){
     await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('لم تكتمل العملية'));
     const partial=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {sections:(await d.getAll('sections')).length,students:(await d.getAll('students')).length};});
     await confirm(page);await page.waitForFunction(()=>document.querySelector('[data-roster-partial]')?.textContent.includes('حُفظ الفصل والمادة و3'));
     assert.equal(await page.evaluate(async()=>(await(await import('/src/lib/db.js')).getAll('sections')).length),partial.sections);
    }
    await acknowledgeCreation(page);await done(page);assert.equal(requests.length,1);
    const values=Object.fromEntries(requests[0].batch.cells.map(c=>[canonical.students.find(s=>s.id===c.studentId).name,c.value]));assert.deepEqual(values,{'طالب موجب':7,'طالب صفر':0});
    await upload(page,'طالب أول\nطالب ثان');await chooseMode(page,'names');await review(page);assert.match(await page.locator('[data-roster-preview]').innerText(),/طالب أول/);assert.match(await page.locator('[data-roster-preview]').innerText(),/طالب ثان/);
   }finally{await context.close();}
  }
  pass('n107_partial_cancel_exact_receipt_retry_no_duplicate_owner_term_lease_preserved','Lost receipt retries identical durable mutation/envelope with one canonical receipt; rejected request retained until explicit retirement; no duplicate class/student/score. Actual post-preflight owner/term/lease/session drift refuses in both destinations. Duplicate/ambiguous/foreign-ID/mapping errors remain blocking.');
 });
 assert.deepEqual(evidence.failures,[]);
}catch(e){evidence.failures.push(e.stack);throw e;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile('tests/n107-calm-single-review-import-browser.json',JSON.stringify(evidence,null,2)+'\n');}
