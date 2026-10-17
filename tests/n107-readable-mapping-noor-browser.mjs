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

const taskId='continuous-n107-readable-mapping-noor-responsive-tabs-20261017',runId='77244486-2720-4d11-a881-16eae1cb396f';
const base='http://127.0.0.1:49727',root=resolve('.');
const evidence={taskId,runId,checks:[],failures:[],testedFiles:{}};
for(const f of ['src/views/class-import-center.js','src/styles/components.css','src/lib/grade-transfer.js','src/lib/grade-transfer-export.js','src/store.js'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
evidence.previousFailures=['Initial development check found an unclosed new-item fields div (fixed), then a clipped 320px appbar title (scoped CSS fixed). Harness waits were corrected for asynchronous repaint, focus was explicitly placed before selection, and unknown-max error expectation matched the preserved engine error. Original prior-task failures remain in tests/n107-calm-single-review-import-browser.json.'];
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
const chooseMode=async(page,mode)=>{await page.locator('[data-act="grade-import-mode"][data-mode="'+mode+'"]').first().click();await page.waitForFunction(mode=>document.querySelector('[data-act="grade-import-mode"][data-mode="'+mode+'"]')?.getAttribute('aria-pressed')==='true',mode);};
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
}// AI: reuse the established account fixture/transport above, with only changed DOM scenarios.
async function teacherItems(page){
 await page.evaluate(async()=>{
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),m=await import('/src/models.js');
  const spec=[['participation','المشاركة والتفاعل',10,'participation'],['homework','الواجبات',10,null],['projects','الأنشطة والمشاريع',20,null],['short','الاختبارات القصيرة',20,null],['final','الاختبار النهائي',40,null]];
  const items=spec.map(([id,name,max,auto],order)=>({...m.makeItem({id,teachingId:'n73-source',name,max,auto,order}),ownerId:s.getActiveWorkspace().authUserId,serverRevision:1}));
  await d.applyBatch({items:{put:items,remove:['n73-source-exam']},scores:{remove:['n73-source-score']}});
  await d.putMany('scores',[['projects',0],['short',7],['final',0]].map(([itemId,value])=>({id:'noor-'+itemId,itemId,studentId:'n73-student1',value,ownerId:s.getActiveWorkspace().authUserId,serverRevision:1})));
  await s.refreshSyncedState();(await import('/src/repaint.js')).repaint();
 });
 canonical.items=canonical.items.filter(i=>i.teachingId!=='n73-source').concat(await page.evaluate(async()=>(await(await import('/src/lib/db.js')).getAll('items')).filter(i=>i.teachingId==='n73-source')));
}
const headers='اسم الطالب,المشاركة والتفاعل (العظمى 20),الأنشطة والمشاريع (العظمى 20),الواجبات (العظمى 20),الاختبار الفتري الاول (العظمى 20),الاختبار الفتري الثاني (العظمى 20)';
const snapDir='tests/fixtures/n107-readable-mapping-noor';
try{
 const baseSha='3246572025788e2df46bc7be682c64e0b39bde92';
 const atBase=f=>execFileSync('git',['show',baseSha+':'+f],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const current=(await readFile('src/views/class-import-center.js','utf8')).replaceAll('\r\n','\n');
 const original=atBase('src/views/class-import-center.js');
 evidence.reusedFunctions={};
 for(const [start,end] of [['function reviewNewRoster()', 'function rosterFilePane('],['async function transferConfirm(', 'function transferExport('],['function transferExport(', 'function bindTransfer('],['const importChanged =','const accessible ='],['function directExtensionEntry()', 'async function receiveExtension()']]){
  const segment=text=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
  assert.ok(segment(original).length>0);assert.equal(segment(current),segment(original));
  evidence.reusedFunctions[start]=createHash('sha256').update(segment(current)).digest('hex');
 }
 for(const f of ['src/lib/grade-transfer.js','src/lib/grade-transfer-export.js','src/lib/grade-transfer-xlsx.js','src/store.js'])assert.equal((await readFile(f,'utf8')).replaceAll('\r\n','\n'),atBase(f));
 pass('unchanged_core_and_single_consent_evidence_reused','Exact base comparison: review/plan/owner/term/lease/receipt and compact-preview functions plus core mapping, Noor CSV, XLSX and store are unchanged; prior negative and blank-versus-zero evidence retained. Extension remains 0.5.11.');
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49727,'127.0.0.1',ok);});
 await mkdir(snapDir,{recursive:true});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,1280]){
   const {context,page}=await fresh(createContext,width);
   try{
    await teacherItems(page);const before=await checkpoint(page);
    await upload(page,headers+'\nطالب مصطنع,7,7,7,0,');await chooseMode(page,'grades');
    await page.locator('[data-grade-ignored]').waitFor();
    assert.equal(await page.locator('[data-grade-ignored]').count(),1);
    assert.equal(await page.locator('[data-grade-column]').count(),4);
    assert.equal(await page.locator('[data-grade-identity-optional]').getAttribute('open'),null);
    assert.equal(await page.locator('[data-grade-name]').inputValue(),'0');
    assert.equal(await page.locator('#grade-column-2').inputValue(),'projects');
    assert.equal(await page.locator('#grade-column-3').inputValue(),'ignore');
    assert.match(await page.locator('[data-grade-column="3"]').innerText(),/الملف 20، البند 10/);
    assert.equal(await page.locator('[data-grade-column="4"] [data-grade-new-name]').inputValue(),'الاختبار الفتري الاول');
    assert.equal(await page.locator('[data-grade-column="4"] [data-grade-new-max]').inputValue(),'20');
    assert.equal(await checkpoint(page),before);assert.equal(requests.length,0);
    assert.equal(await page.locator('h1.topbar__title').innerText(),'استيراد وتصدير الكشوف');
    assert.equal(await page.getByRole('heading',{name:'استيراد وتصدير الكشوف',exact:true}).count(),1);
    await overflow(page);
    const sizes=await page.locator('.koshoof-modes button').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(sizes.every(s=>s.h>=44));assert.ok(Math.abs(sizes[0].w-sizes[1].w)<1);
    assert.equal(await page.locator('.topbar__title').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${snapDir}/mapping-${width}.png`,fullPage:true});
    await page.setViewportSize({width:width+1,height:900});assert.match(await page.locator('[data-grade-file-name]').innerText(),/roster.csv/);await page.setViewportSize({width,height:900});
    // Same controls survive repaint, preserving semantic stable item IDs and focus.
    await page.locator('#grade-column-3').selectOption('new');
    assert.equal(await page.locator('[data-grade-column="3"] [data-grade-new-name]').inputValue(),'الواجبات');
    assert.equal(await page.locator('[data-grade-column="3"] [data-grade-new-max]').inputValue(),'20');
    await page.locator('#grade-column-3').focus();await page.locator('#grade-column-3').selectOption('homework');
    await page.waitForFunction(()=>document.querySelector('#grade-column-3')?.value==='homework' && !document.querySelector('[data-grade-column="3"] [data-grade-new-name]'));
    assert.equal(await page.locator('[data-grade-column="3"] [data-grade-new-name]').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'grade-column-3');
    await page.locator('#grade-column-4').selectOption('projects');await page.locator('[data-act="grade-review"]').click();
    await page.getByRole('alert').filter({hasText:'لا يمكن ربط عمودين'}).waitFor();
    assert.equal(requests.length,0);await page.locator('#grade-column-4').selectOption('new');
    await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
    await page.locator('[data-noor-grouping] > summary').click();
    assert.equal(await page.locator('[data-grade-export-item]').count(),5);assert.equal(await page.locator('.n107-noor-row').count(),5);
    assert.equal(await page.locator('.grade-transfer__chips').count(),0);
    assert.deepEqual(await page.locator('[data-noor-totals] bdi').allTextContents(),['40/40','60/60']);
    await overflow(page);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${snapDir}/noor-${width}.png`,fullPage:true});
    await page.locator('[data-noor-confirm]').check();
    await page.locator('[data-grade-export-item][value="homework"]').uncheck();
    await page.waitForFunction(()=>document.querySelector('#noor-homework')?.disabled);
    assert.equal(await page.locator('[data-noor-confirm]').isChecked(),false);
    assert.equal(await page.locator('#noor-homework').isDisabled(),true);
    assert.deepEqual(await page.locator('[data-noor-totals] bdi').allTextContents(),['30/40','60/60']);
    await page.locator('[data-noor-confirm]').check();await page.locator('[data-act="grade-noor-export"]').click();
    assert.match(await page.locator('[data-noor-alert]').innerText(),/يجب أن يساوي/);
    await page.locator('[data-grade-export-item][value="homework"]').check();
    await page.waitForFunction(()=>!document.querySelector('#noor-homework')?.disabled);
    for(const group of ['', '60']){
     await page.locator('[data-noor-confirm]').check();await page.locator('#noor-homework').selectOption(group);
     await page.waitForFunction(()=>!document.querySelector('[data-noor-confirm]')?.checked);
     assert.equal(await page.locator('[data-noor-confirm]').isChecked(),false);
     await page.locator('[data-noor-confirm]').check();await page.locator('[data-act="grade-noor-export"]').click();
     assert.ok((await page.locator('[data-noor-alert]').innerText()).length>0);
    }
    await page.locator('#noor-homework').selectOption('40');
    await page.waitForFunction(()=>document.querySelector('[data-noor-totals] bdi')?.textContent==='40/40');
    await page.locator('[data-noor-confirm]').check();
    // Capture the actual Blob requested by the real export handler.
    await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){globalThis.__csv=blob.text();return original.call(this,blob);};});
    await page.locator('[data-act="grade-noor-export"]').click();
    const csv=await page.evaluate(()=>globalThis.__csv);assert.match(csv,/المهام الأدائية والمشاركة والتفاعل \(40\)/);
    assert.match(csv,/"Synthetic 1","",7/);assert.equal(await page.locator('[data-noor-alert]').isHidden(),true);
    await page.locator('#noor-projects').selectOption('60');
    await page.waitForFunction(()=>!document.querySelector('[data-noor-confirm]')?.checked);
    await page.locator('#noor-short').selectOption('40');
    await page.waitForFunction(()=>document.querySelector('[data-noor-totals] bdi')?.textContent==='40/40');
    await page.locator('[data-noor-confirm]').check();await page.locator('[data-act="grade-noor-export"]').click();
    assert.match(await page.evaluate(()=>globalThis.__csv),/"Synthetic 1","",0/);
    await page.locator('[data-act="koshoof-tab"][data-tab="import"]').click();
    await page.locator('[data-roster-file-flow]').waitFor();
   }finally{await context.close();}
  }
  pass('n107_readable_mapping_true_status_new_item_optional_id_and_same_payload_guards','Real account app at 320/390/1280: fabricated six headers, readonly visible/ignored, 20-v-10 explicit mismatch, matched stable ID, proposed name/max, optional ID collapsed once, new/existing repaint/focus retained, duplicate destination refused, no pre-confirm writes.');
  pass('n107_one_noor_item_list_actual_group_selection_totals_confirmation_and_export','Real checkbox/select handlers: five items once, exact 40/40 and 60/60; deselect disables group and resets approval, unassigned/over/wrong totals refuse actual export, corrected selection requests actual CSV Blob; swapping the two 20-point groups changes actual 60-group value from 7 to 0 while preserving blank 40-group marks and headers.');
  pass('n107_responsive_tabs_and_single_actual_appbar_title_mobile_desktop','Source CSS and real app DOM screenshots at 320/390/1280, equal >=44px tabs, one actual appbar heading with no clipping/page overflow, file retained on resize; existing tab reset behavior preserved.');
  // One changed mapping-to-confirm account flow: 7 / 0 / blank, actual guarded transport.
  const {context,page}=await fresh(createContext);
  try{
   await upload(page);await chooseMode(page,'grades');
   await page.locator('[data-grade-mapping-details]').evaluate(e=>e.open=true);
   await page.locator('[data-grade-new-name]').fill('بند مصطنع');await page.locator('[data-grade-new-name]').dispatchEvent('change');
   await review(page);assert.equal(requests.length,0);assert.equal(await page.locator('[data-act="grade-confirm"]').count(),1);
   await confirm(page);await done(page);assert.equal(requests.length,1);assert.deepEqual(requests[0].batch.cells.map(c=>c.value),[7,0]);assert.equal(requests[0].batch.newItems[0].name,'بند مصطنع');
   const scores=await page.evaluate(async()=>(await(await import('/src/lib/db.js')).getAll('scores')));
   for(const c of requests[0].batch.cells)assert.ok(scores.some(s=>s.studentId===c.studentId&&s.itemId===c.itemId&&s.value===c.value));
   await upload(page,'اسم الطالب,عمود مجهول\nطالب مصطنع,7');await chooseMode(page,'grades');
   await page.locator('[data-grade-mapping-details]').evaluate(e=>e.open=true);await page.locator('[data-grade-kind]').selectOption('new');
   assert.equal(await page.locator('[data-grade-new-max]').inputValue(),'');await page.locator('[data-act="grade-review"]').click();
   await page.getByRole('alert').filter({hasText:/أكد إنشاء|راجع الأعمدة/}).waitFor();assert.equal(requests.length,1);
  }finally{await context.close();}
  pass('n107_accepted_single_review_extension_export_score_semantics_preserved','Changed mapping UI -> real account store -> owner-bound durable command -> synthetic canonical receipt: only 7 and 0 persisted after one precise consent; blank omitted. Unknown max remains blank and refuses review. Core import/export/plan guard hashes compared with base separately; prior negative evidence reused.');
 });
 assert.deepEqual(evidence.failures,[]);
}catch(e){evidence.failures.push(e.stack);throw e;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile('tests/n107-readable-mapping-noor-browser.json',JSON.stringify(evidence,null,2)+'\n');}
