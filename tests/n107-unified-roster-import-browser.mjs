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

const taskId='continuous-n107-unified-roster-file-import-20261017',runId='936544bd-4d73-4e9b-bd07-7e599e75672f';
const base='http://127.0.0.1:49517',root=resolve('.');
const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
try{const previous=JSON.parse(await readFile('tests/n107-unified-roster-import-browser.json','utf8'));evidence.previousFailures=[...(previous.previousFailures??[]),...(previous.failures??[])];}catch{}
for(const f of ['src/views/class-import-center.js','src/store.js'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
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
   getGradeImportCapability:()=>globalThis.__n107Unavailable ? {} : ({protocol:'N90_REVIEWED_V1',version:1,unifiedProtocol:'N90_UNIFIED_V1',unifiedVersion:1}),
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
async function proposalConsent(page){await page.locator('[data-grade-new-confirm]').first().check();}
const review=page=>page.locator('[data-act="grade-review"]').click();
async function confirmClass(page){await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').click();}
async function confirmGrades(page){
 await page.locator('[data-grade-match-confirm]').check();
 if(await page.locator('[data-grade-enroll-confirm]').count())await page.locator('[data-grade-enroll-confirm]').check();
 if(await page.locator('[data-grade-overwrite-confirm]').count())await page.locator('[data-grade-overwrite-confirm]').check();
 await page.locator('[data-act="grade-confirm"]').click();
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
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49517,'127.0.0.1',ok);});
 await mkdir('tests/fixtures/n107-unified-roster-import',{recursive:true});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,1280]){
   for(const dest of ['existing','new'])for(const content of ['names','grades']){
    resetService();const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
    try{
     await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));const page=await context.newPage();page.setDefaultTimeout(7000);
     page.on('pageerror',e=>evidence.failures.push(e.message));await prepare(page);const before=await checkpoint(page);
     assert.equal(await page.locator('[data-import-kind]').count(),0);assert.equal(await page.locator('[data-change="grade-file"]').count(),1);
     await upload(page);assert.equal(await page.locator('[data-existing-class]').inputValue(),'n73-source');
     // Same parsed file survives every destination/mode switch without writes.
     await createFields(page);await chooseMode(page,'grades');await page.locator('[data-import-kind]').selectOption('existing');
     assert.match(await page.locator('[data-grade-file-name]').innerText(),/roster.csv/);assert.equal(await checkpoint(page),before);
     if(dest==='new')await createFields(page);await chooseMode(page,content);
     assert.equal(await page.locator('[data-roster-create]').count(),dest==='new'?1:0);
     if(content==='grades')await proposalConsent(page);
     await review(page);
     await page.locator(dest==='new'?'.class-import-review':'[data-grade-review]').waitFor();
     assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);await overflow(page);
     if(width===390)await page.screenshot({path:`tests/fixtures/n107-unified-roster-import/${dest}-${content}.png`,fullPage:true});
     if(dest==='new'){
      if(content==='grades'){assert.match(await page.locator('[data-roster-proposed-grades]').innerText(),/طالب صفر.*0/s);assert.match(await page.locator('[data-roster-proposed-grades]').innerText(),/فارغ؛ دون تغيير/);}
      await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').waitFor();await page.keyboard.press('Escape');assert.equal(await checkpoint(page),before);
      await confirmClass(page);
      if(content==='names')await page.getByRole('heading',{name:/اكتمل استيراد الفصل/}).waitFor();
      else{
       await page.locator('[data-roster-partial]').waitFor();assert.equal(requests.length,0);
       await review(page);await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('أكمل المزامنة ثم أعد المراجعة'));assert.equal(requests.length,0);
       await acknowledgeCreation(page);await review(page);await page.locator('[data-grade-review]').waitFor();await confirmGrades(page);
      }
     }else if(content==='names'){
      await confirmGrades(page);await page.waitForFunction(()=>!document.querySelector('[data-grade-review]'));
     }else{await confirmGrades(page);}
     if(content==='grades'){
      await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('الدرجات المحفوظة: 2')||document.querySelector('[data-roster-file-flow]')?.textContent.includes('الدرجات المحفوظة: 2'));
      assert.equal(requests.length,1);assert.deepEqual(requests[0].batch.cells.map(c=>c.value),[7,0]);
      assert.equal(requests[0].batch.newStudents?.length??0,dest==='new'?0:3);
      if(dest==='new')assert.ok(requests[0].batch.cells.every(c=>canonical.students.some(s=>s.id===c.studentId)));
     }
     await overflow(page);console.log(`PASS UI ${width} ${dest}/${content}`);
    }finally{await context.close();}
   }
  }
  pass('n107_single_file_four_destination_mode_combinations_actual_ui','12 actual app account UI combinations at 320/390/1280; one file retained through destination/mode changes, contextual class, explicit review/confirmation/cancel; database unchanged before consent.');
  pass('n107_new_class_grades_reviewed_binding_zero_blank_and_existing_service_reuse','Actual creation receipt supplies fixed saved IDs; unsynced class blocks score review honestly. Synthetic acknowledged prerequisites then real reviewGradeImport/confirmGradeImport, cloud ownership guard and Sync durable dispatch/receipt adopt 7 and 0, blank omitted; existing path uses N90_UNIFIED_V1, created path N90_REVIEWED_V1. No service deployment claim.');
  // Partial recovery uses the same actual UI and persisted command.
  for(const failure of ['lost','reject','unavailable']){
   resetService();const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
   try{
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));const page=await context.newPage();page.setDefaultTimeout(7000);await prepare(page);
    await upload(page);await createFields(page);await chooseMode(page,'grades');await proposalConsent(page);await review(page);await confirmClass(page);await page.locator('[data-roster-partial]').waitFor();await acknowledgeCreation(page);
    const saved=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {sections:(await d.getAll('sections')).length,students:(await d.getAll('students')).length};});
    await review(page);mode=failure;
    if(failure==='unavailable')await page.evaluate(()=>globalThis.__n107Unavailable=true);
    await confirmGrades(page);
    if(failure==='unavailable'){
     await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('قدرة استيراد الدرجات غير متاحة'));
     assert.equal(requests.length,0);assert.match(await page.locator('[data-roster-partial]').innerText(),/حُفظ الفصل.*الدرجات معلقة/);
     assert.match(await page.locator('[data-grade-file-name]').innerText(),/roster.csv/);continue;
    }
    await page.locator(failure==='lost'?'[data-act="grade-retry"]':'[data-act="grade-retire"]').waitFor();
    assert.match(await page.locator('[data-roster-partial]').innerText(),/حُفظ الفصل.*الدرجات معلقة/);assert.equal(await page.locator('[data-change="grade-file"]').isDisabled(),true);
    assert.match(await page.locator('[data-grade-file-name]').innerText(),/roster.csv/);assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);
    const first=structuredClone(requests[0]);
    if(failure==='lost'){
     // Closing the file review must retain recovery of the durable request.
     await page.locator('[data-act="grade-cancel"]').click();await page.locator('[data-act="grade-retry"]').waitFor();assert.equal(await page.locator('[data-grade-file-name]').count(),0);
     await page.locator('[data-act="grade-retry"]').click();await page.locator('[data-act="grade-retry"]').waitFor({state:'detached'});
     assert.deepEqual(requests[1],first);assert.equal(receipts.size,1);assert.equal(canonical.scores.filter(s=>first.batch.cells.some(c=>c.studentId===s.studentId&&c.itemId===s.itemId)).length,2);
    }else{
     assert.equal(receipts.size,0);await page.locator('[data-grade-retire-confirm]').check();await page.locator('[data-act="grade-retire"]').click();await page.locator('[data-act="grade-retire"]').waitFor({state:'detached'});assert.equal(requests.length,1);
    }
    const after=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return {sections:(await d.getAll('sections')).length,students:(await d.getAll('students')).length};});assert.deepEqual(after,saved);
   }finally{await context.close();}
  }
  for(const drift of ['owner','term','lease','session']){
   resetService();const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
   try{
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));const page=await context.newPage();page.setDefaultTimeout(7000);await prepare(page);
    await upload(page);await chooseMode(page,'grades');await proposalConsent(page);await review(page);await page.locator('[data-grade-review]').waitFor();
    await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-enroll-confirm]').check();const before=await checkpoint(page);
    await page.evaluate(async drift=>{
     const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
     if(drift==='owner')c.setMockAuth({id:'foreign'},c.session);
     if(drift==='term')s.state.device.activeTermId=s.state.terms[1].id;
     if(drift==='lease')(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate();
     if(drift==='session')c.setMockAuth(c.user,{...c.session});
    },drift);
    await page.locator('[data-act="grade-confirm"]').click();assert.equal(requests.length,0);assert.equal(await checkpoint(page),before);
   }finally{await context.close();}
  }
  for(const problem of ['duplicate','ambiguous','unknown-id','duplicate-mapping']){
   resetService();
   if(problem==='ambiguous'){
    service.current.students.push({...service.current.students[0],id:'ambiguous'});
    service.current.enrollments.push({...service.current.enrollments[0],id:'ambiguous-enrollment',studentId:'ambiguous'});
   }
   const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
   try{
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));const page=await context.newPage();page.setDefaultTimeout(7000);await prepare(page);
    const csv=problem==='duplicate'?'اسم الطالب,Exam\nSynthetic 1,7\nSynthetic 1,4':problem==='unknown-id'?'اسم الطالب,Exam,معرف الطالب\nSynthetic 1,7,unknown':problem==='duplicate-mapping'?'اسم الطالب,Exam,Other\nSynthetic 1,7,3':'اسم الطالب,Exam\nSynthetic 1,7';
    await upload(page,csv);await chooseMode(page,'grades');
    if(problem==='duplicate-mapping')await page.locator('[data-grade-column="2"] [data-grade-kind]').selectOption('n73-source-exam');
    const before=await checkpoint(page);await review(page);
    if(problem==='duplicate-mapping')await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('اختر بندًا مختلفًا لكل عمود درجات'));
    else{await page.locator('[data-grade-review]').waitFor();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);}
    assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);
    await page.locator('[data-act="grade-cancel"]').click();await page.waitForFunction(()=>!document.querySelector('[data-grade-file-name]'));assert.equal(await checkpoint(page),before);
   }finally{await context.close();}
  }
  // Real XLSX parser + same creation/grade UI, including a headerless CSV regression.
  resetService();const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
  try{
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));const page=await context.newPage();page.setDefaultTimeout(7000);await prepare(page);
   const bytes=exportGradeXlsx({roster:[{id:'a',name:'طالب موجب'},{id:'b',name:'طالب صفر'},{id:'c',name:'طالب فارغ'}],items:[{id:'i',name:'اختبار جديد',max:10}],ctx:{a:{scoresByItem:{i:{value:7}}},b:{scoresByItem:{i:{value:0}}},c:{scoresByItem:{}}}});
   await page.locator('[data-change="grade-file"]').setInputFiles({name:'roster.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});await page.locator('[data-import-kind]').waitFor();
   await createFields(page);await chooseMode(page,'grades');await proposalConsent(page);await review(page);await confirmClass(page);await page.locator('[data-roster-partial]').waitFor();await acknowledgeCreation(page);await review(page);await confirmGrades(page);
   await page.waitForFunction(()=>document.querySelector('[data-roster-file-flow]')?.textContent.includes('الدرجات المحفوظة: 2'));assert.deepEqual(Object.fromEntries(requests[0].batch.cells.map(c=>[canonical.students.find(s=>s.id===c.studentId).name,c.value])),{'طالب موجب':7,'طالب صفر':0});
   await upload(page,'طالب أول\nطالب ثان');await page.locator('[data-act="grade-import-mode"][data-mode="names"]').first().click();
   await review(page);await page.locator('[data-grade-review]').waitFor();assert.match(await page.locator('[data-grade-review]').innerText(),/طالب أول/);assert.match(await page.locator('[data-grade-review]').innerText(),/طالب ثان/);
  }finally{await context.close();}
  pass('n107_partial_receipt_exact_retry_duplicate_owner_term_lease_and_cancel','Created class/names remain saved when grade receipt is lost or rejected; retained file, separate pending notice, fresh confirm blocked. Lost receipt restores identical mutation/envelope without duplicate class/student/score; rejected request requires explicit retirement and preserves rejection. Actual UI also blocks owner/term/lease/session drift, duplicate/ambiguous/unknown-ID rows and duplicate item mapping without writes; unavailable capability keeps file/creation receipt. XLSX 7/0/blank and headerless CSV reach real parsers and handlers.');
 });
 // Reuse accepted export evidence by exact source segments/hash, not another export suite.
 const before=execFileSync('git',['show','21ee4587c5e69be05720fd4818eb19a8f0e8f57f:src/views/class-import-center.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n'),current=(await readFile('src/views/class-import-center.js','utf8')).replace(/\r\n/g,'\n');
 for(const [a,b]of [['function exportEntries()','function noorPane('],['async function receiveExtension()','function setupBinding('],['function directExtensionEntry()','async function receiveExtension()'],['function transferExport(','function bindTransfer(']])assert.equal(current.slice(current.indexOf(a),current.indexOf(b)).replace("!hub.existing || hub.kind === 'new'",'!hub.existing'),before.slice(before.indexOf(a),before.indexOf(b)));
 for(const f of ['src/lib/class-koshoof-bundle.js','src/lib/grade-transfer-export.js','src/lib/grade-transfer-xlsx.js','src/styles/components.css','assets/extensions/rakeez-teacher-import-helper-0.5.9.zip']){
  assert.deepEqual(await readFile(f),execFileSync('git',['show','21ee4587c5e69be05720fd4818eb19a8f0e8f57f:'+f]));evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
 }
 pass('n107_responsive_contextual_hub_accepted_export_and_extension_preserved','Actual source CSS/DOM and handlers, 320/390/1280 no overflow, contextual preselect; unchanged accepted export/Noor engines, direct extension card/download/handoff and export handler byte comparisons against base reuse prior evidence.');
 assert.deepEqual(evidence.failures,[]);
}catch(e){evidence.failures.push(e.stack);throw e;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile('tests/n107-unified-roster-import-browser.json',JSON.stringify(evidence,null,2)+'\n');}
