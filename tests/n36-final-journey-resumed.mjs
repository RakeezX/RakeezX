// AI: resumed exact N36 journey. Only source/network/Chrome APIs are fabricated.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService,owner,foreignOwner} from './n73-account-flow-fixture.mjs';
import {encodeSyncV2Patch,SYNC_V2_SCHEMAS} from '../src/lib/sync-v2.js';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

const taskId='continuous-n36-final-receiver-journey-20261018',runId='006e830c-a452-47e6-8a89-358ca35024b8';
const canonical='C:/Users/Abody/Projects/RakeezX',base='http://127.0.0.1:49483',app='https://rakeezx.com',root=resolve('.');
const extension='extensions/rakeez-teacher-import-helper/',fixture='/tests/fixtures/n36-final-journey/account.mjs';
const classes=['خامس1','خامس2','خامس3','خامس4','خامس5','خامس6','خامس7','خامس8','سادس6','سادس7'],counts=[28,28,29,28,30,28,29,31,34,38],alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const rows=[...classes].reverse().flatMap(classroom=>Array.from({length:counts[classes.indexOf(classroom)]},(_,i)=>({classroom,name:'طالب اصطناعي '+alphabet[Math.floor(i/alphabet.length)]+alphabet[i%alphabet.length]})));
const evidence={taskId,runId,baseSha:'f2395c4841db30fb29e5908fe30e6154a925116a',checks:[],operations:[],errors:[],initialEvidence:'tests/n36-final-journey-browser.json',preservedFailures:[],facade:'Canonical helper GET/HEAD-only local-byte HTTPS origin; DNS failclosed, external HTTP/WebSockets/SW blocked; no remote/native proof'};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const hash=b=>createHash('sha256').update(b).digest('hex');
let phase='setup',route=null,sendInternal,sendExternal,lastEnvelope,dropOutcome=false;
const service=syntheticService(),tables=new Map(),receipts=new Map(),mutations=[];
for(let i=0;i<classes.length;i++){
 service.current.sections.push({...service.current.sections[0],id:'journey-section-'+i,grade:i<8?5:6,label:classes[i].replace(/[^0-9]/g,''),name:classes[i]});
 service.current.teachings.push({...service.current.teachings[0],id:'journey-teaching-'+i,sectionId:'journey-section-'+i});
}
for(const [store,records] of Object.entries(service.current))if(SYNC_V2_SCHEMAS[store])tables.set(SYNC_V2_SCHEMAS[store].entity,new Map(records.map(r=>[r.id,{...encodeSyncV2Patch(store,r),id:r.id,owner_id:owner,revision:r.serverRevision??1,deleted_at:null}])));
async function network(name,input){
 if(name==='records')return [...(tables.get(input.entity)?.values()??[])];
 if(name!=='mutation')return service.request(name,input);
 mutations.push(structuredClone(input));
 if(receipts.has(input.mutationId))return receipts.get(input.mutationId);
 assert.ok(['students','enrollments'].includes(input.entity),'This journey may sync only its names and enrollments');
 const table=tables.get(input.entity)??new Map();tables.set(input.entity,table);
 if(input.entity==='enrollments'){
  assert.ok(tables.get('students').has(input.patch.student_id),'Normal parent ACK precedes child');
  assert.ok(tables.get('sections').has(input.patch.section_id),'Owned destination exists');
 }
 const revision=(table.get(input.recordId)?.revision??0)+1;
 const canonical={...table.get(input.recordId),...input.patch,id:input.recordId,owner_id:owner,revision,field_revisions:Object.fromEntries(Object.keys(input.patch).map(k=>[k,revision])),deleted_at:null,client_updated_at:input.clientUpdatedAt};
 table.set(input.recordId,canonical);
 const receipt={mutationId:input.mutationId,entity:input.entity,recordId:input.recordId,canonicalId:input.recordId,outcome:'applied',appliedGroups:Object.keys(input.patch),conflictedGroups:[],resultRevision:revision,canonical};
 receipts.set(input.mutationId,receipt);return receipt;
}
async function prepareWorker(){
 const data={},listeners={},id='a'.repeat(32);
 const chrome={runtime:{id,getURL:p=>'chrome-extension://'+id+'/'+p,onMessage:{addListener:f=>listeners.internal=f},onMessageExternal:{addListener:f=>listeners.external=f}},storage:{session:{get:async k=>structuredClone(k===null?data:Object.hasOwn(data,k)?{[k]:data[k]}:{}),set:async o=>Object.assign(data,structuredClone(o)),remove:async k=>{delete data[k];}}},alarms:{create:async()=>{},clear:async()=>true,onAlarm:{addListener:f=>listeners.alarm=f}},tabs:{create:async()=>({id:99}),update:async(_,o)=>{route=o.url;},remove:async()=>{},onRemoved:{addListener:f=>listeners.remove=f}}};
 const realm=vm.createContext({URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console});
 vm.runInContext((await fs.readFile(extension+'handoff-protocol.js','utf8')).replaceAll('export ',''),realm);
 vm.runInContext((await fs.readFile(extension+'handoff-worker.js','utf8')).replace(/^import .*?;\r?\n/m,''),realm);
 const send=(kind,message,sender)=>new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome fixture deadline')),5000);realm.messageJSON=JSON.stringify(message);const accepted=listeners[kind](vm.runInContext('JSON.parse(messageJSON)',realm),sender,result=>{clearTimeout(timer);done(JSON.parse(JSON.stringify(result)));});if(!accepted){clearTimeout(timer);done({ok:false});}});
 sendInternal=m=>{if(m.type==='n36-create')lastEnvelope=structuredClone(m.envelope);return send('internal',m,{id,url:chrome.runtime.getURL('popup.html')+'?run=journey',tab:{id:7,windowId:1}});};
 sendExternal=(m,sender)=>send('external',m,sender);
}
const server=createServer(async(req,res)=>{try{assert.ok(['GET','HEAD'].includes(req.method));const p=new URL(req.url,base).pathname,file=resolve(root,p==='/'?'index.html':'.'+decodeURIComponent(p));if(!file.startsWith(root+sep))throw Error('Outside root');res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch(e){res.writeHead(404);res.end(e.message);}});
try{
 const prior=JSON.parse(await fs.readFile('tests/n36-final-journey-resumed.json','utf8').catch(()=>'{}'));
 evidence.preservedFailures=[...(prior.preservedFailures??[]),...(prior.failure?[{phase:prior.phase,failure:prior.failure,operations:prior.operations,correction:prior.failure.includes('s.ownerId===owner')?'Local student records carry ownership through the workspace/database and durable command, not an ownerId field. Assert actual workspace identity, durable owner guard, canonical network receipt owner and positive reconciled revision instead. Product guard unchanged.':null}]:[])];
 evidence.reusedChecks=JSON.parse(await fs.readFile('tests/n36-final-journey-browser.json','utf8')).checks.filter(c=>c.status==='PASS');
 await prepareWorker();await new Promise((r,j)=>{server.once('error',j);server.listen(49483,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile:canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,syntheticAppOrigin:app,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:950},locale:'ar-SA'});
  try{
   await context.exposeBinding('journeyNetwork',(_,name,input)=>network(name,input));
   await context.exposeBinding('journeyInternal',(_,message)=>sendInternal(message));
   await context.exposeBinding('journeyExternal',({page},message)=>{
    if(dropOutcome&&message.type==='n36-outcome')return {ok:false};
    return sendExternal(message,{url:page.url(),origin:new URL(page.url()).origin,tab:{id:99}});
   });
   await context.addInitScript(({base,rows})=>{
    sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
    const original=window.fetch;window.fetch=async(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.pathname.startsWith('/__n73/'))return new Response(JSON.stringify(await window.journeyNetwork(url.pathname.slice(7),JSON.parse(options?.body??'{}'))),{status:200,headers:{'content-type':'application/json'}});return original(input,options);};
    const source={id:7,url:base+'/Dashboards/Schools',status:'complete'},report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'a'.repeat(32);
    window.chrome={runtime:{getManifest:()=>({version:'0.5.11'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:(...args)=>{if(typeof args[0]==='string'){window.journeyExternal(args[1]).then(args[2]);return;}return window.journeyInternal(args[0]);}},tabs:{get:async()=>source,onRemoved:{addListener(){}},onUpdated:{addListener(){}}},scripting:{executeScript:async input=>{
     if(input.files)return [];let result={ok:true};
     if(input.args?.[0]==='home')result={ok:true,runContext:{schoolId:'a'.repeat(32)},tables:[],warnings:[],links:[{kind:'students',path:report}]};
     if(input.args?.[0]==='fetch')result={ok:true,tables:[{category:'students',text:'اسم الطالب\tالفصل\n'+rows.map(r=>r.name+'\t'+r.classroom).join('\n')}],warnings:[{category:'students',code:'PAGINATION_MISSING_NEXT'}],links:[],pagination:{series:'synthetic',current:1,total:1,terminal:true}};
     return [{frameId:0,result}];
    }}};
   },{base,rows});
   const page=await context.newPage(),runner=await context.newPage();
   for(const p of [page,runner]){p.setDefaultTimeout(10000);p.on('pageerror',e=>evidence.errors.push(e.message));}
   phase='account-ready';await openReadyServedDemo(page,app);
   const ready=await page.evaluate(async f=>(await import(f)).prepare(),fixture);assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);assert.deepEqual(ready.outbox,[]);
   const checkpoint=()=>page.evaluate(async f=>(await import(f)).checkpoint(),fixture);
   const before=await checkpoint();
   phase='controller';await runner.goto(base+'/'+extension+'popup.html?run=journey');await runner.waitForFunction(()=>typeof window.n36BeforeExport==='function');
   await runner.evaluate(()=>{const c=new BroadcastChannel('rakeez-private-one-start');c.postMessage({type:'launch',token:'journey',tabId:7});c.close();});await runner.locator('#source-class-select').waitFor();
   assert.deepEqual(await runner.locator('#source-class-select option').evaluateAll(es=>es.slice(1).map(e=>e.value)),classes);
   const openReceiver=async(i)=>{
    assert.ok(route?.startsWith(app+'/#/classes/koshoof?import=1&extension='));
    await page.evaluate(h=>location.hash=h,new URL(route).hash);
    await page.locator('[data-n36-handoff-status]').filter({hasText:'استُلمت المعاينة'}).waitFor();
    await page.locator('[data-existing-class]').selectOption('journey-teaching-'+i);
    await page.locator('[data-act="n36-extension-review"]').click();await page.locator('.n36-receiver').waitFor();
    await page.waitForFunction(()=>!!document.querySelector('[data-teacher-setup-style]')?.sheet);
    await page.locator('[data-import-map="classes"]').selectOption('journey-section-'+i);
    await page.locator('[data-names-target]').selectOption('journey-teaching-'+i);
    await page.locator('[data-names-review]').click();await page.locator('[data-names-preview]').waitFor();
    assert.equal(await page.locator('[data-names-confirm]').isDisabled(),true);
   };
   const sendSelected=async(i)=>{
    await runner.locator('#source-class-select').selectOption(classes[i]);
    assert.deepEqual(await runner.locator('#source-class-names li').allTextContents(),rows.filter(r=>r.classroom===classes[i]).map(r=>r.name));
    assert.equal(await runner.locator('#partial-approval').isVisible(),true);assert.equal(await runner.locator('#partial-approval').isChecked(),false);
    assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);await runner.locator('#partial-approval').check();
    route=null;await runner.locator('#handoff-transfer').click();await runner.waitForFunction(()=>document.querySelector('#source-class-select').disabled);await runner.locator('#handoff-status').filter({hasText:'فُتح'}).waitFor();
    assert.deepEqual(lastEnvelope.rows,rows.filter(r=>r.classroom===classes[i]));
   };
   for(let i=0;i<classes.length;i++){
    phase='class-'+i;const previous=await checkpoint(),mutationStart=mutations.length;
    await sendSelected(i);await openReceiver(i);assert.deepEqual(await checkpoint(),previous,'Claim/map/preview cannot save');
    const nonce=new URLSearchParams(new URL(route).hash.split('?')[1]).get('handoff');
    assert.equal((await sendExternal({type:'n36-claim',nonce},{url:route,origin:app,tab:{id:99}})).ok,false,'Already-claimed nonce is one-use');
    if(i===0)dropOutcome=true;
    await page.locator('[data-names-approved]').check();await page.locator('[data-names-confirm]').click();await page.locator('[data-names-receipt]').waitFor();
    assert.match(await page.locator('[data-names-receipt]').innerText(),new RegExp('حُفظ محليًا: '+counts[i]));
    const synced=await page.evaluate(async f=>(await import(f)).syncCheckpoint(),fixture);
    assert.equal(synced.dispatch.failed,0);assert.equal(synced.dispatch.blocked,0);assert.deepEqual(synced.outbox,[]);
    const saved=await checkpoint();
    assert.equal(saved.students.length-previous.students.length,counts[i]);assert.equal(saved.enrollments.length-previous.enrollments.length,counts[i]);
    const section='journey-section-'+i,enrollments=saved.enrollments.filter(e=>e.sectionId===section&&!e.deleted),ids=new Set(enrollments.map(e=>e.studentId));
    assert.deepEqual(saved.students.filter(s=>ids.has(s.id)).map(s=>s.name).sort(),rows.filter(r=>r.classroom===classes[i]).map(r=>r.name).sort());
    assert.equal(synced.workspace.authUserId,owner);assert.equal(synced.lease.editable,true);
    for(const s of saved.students.filter(s=>ids.has(s.id)))assert.ok(s.serverRevision>0&&!s.syncCreatePending);
    for(const e of enrollments)assert.ok(e.serverRevision>0&&!e.syncCreatePending);
    const actualReceipts=mutations.slice(mutationStart).map(m=>receipts.get(m.mutationId));assert.equal(new Set(actualReceipts.map(r=>r.mutationId)).size,counts[i]*2);assert.ok(actualReceipts.every(r=>r.canonical.owner_id===owner));
    evidence.operations.push({classroom:classes[i],selected:counts[i],added:counts[i],acknowledged:actualReceipts.length,remaining:0,normalSync:true});
    // A real canonical Sync refresh changes the snapshot and the receiver may
    // already have closed itself through its existing current-state guard.
    if(await page.locator('[data-sheet-close]').count())await page.locator('[data-sheet-close]').first().click();await page.locator('.n36-receiver').waitFor({state:'detached'});
    if(i===0){
     assert.equal(await runner.locator('#source-class-select').isDisabled(),true);dropOutcome=false;
     await runner.locator('#source-retry').click();assert.deepEqual(await runner.locator('#source-class-names li').allTextContents(),lastEnvelope.rows.map(r=>r.name));
     await runner.locator('#partial-approval').check();route=null;await runner.locator('#handoff-transfer').click();await runner.locator('#handoff-status').filter({hasText:'فُتح'}).waitFor();
     await openReceiver(i);assert.match(await page.locator('[data-names-preview]').innerText(),/جديدة: 0 · موجودة: 28/);
     await page.locator('[data-names-approved]').check();await page.locator('[data-names-confirm]').click();await page.locator('[data-names-receipt]').waitFor();
     assert.deepEqual(await checkpoint(),saved,'Lost transport receipt retry must not create duplicate writes');
     await page.locator('[data-sheet-close]').first().click();record('n36_lost_receipt_exact_batch_existing_retry','Actual local save + normal Sync ACK followed by dropped extension outcome; controller retained batch, explicit same-batch retry returned existing without DB/outbox mutation.');
    }
    await runner.waitForFunction(()=>!document.querySelector('#source-class-select').disabled);
    assert.equal(await runner.locator('#source-class-names li').count(),0,'Only receipt advances reviewed batch');
    console.log('ACK '+classes[i]+' '+counts[i]);
   }
   phase='full-readback';const final=await checkpoint();
   assert.equal(final.students.length-before.students.length,303);assert.equal(final.enrollments.length-before.enrollments.length,303);
   for(const key of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k)))assert.deepEqual(final[key],before[key],key+' unchanged');
   assert.equal(tables.get('students').size-before.students.length,303);assert.equal(tables.get('enrollments').size-(before.enrollments?.length??0),303);
   record('n36_actual_extension_to_actual_receiver_full_roster_explicit_save_and_ack',{total:303,classes:10,operations:evidence.operations,scope:'Actual controller/worker, exact origin-bound app receiver, explicit existing owned destination/mapping/confirmation, actual persisted DB + normal Sync engine canonical ACKs. Fabricated network only; no personal save claim.'});
   phase='negative-guards';
   const envelope={...lastEnvelope,createdAt:Date.now(),expiresAt:Date.now()+120000,rows:rows.filter(r=>r.classroom===classes[0])};envelope.expiresAt=envelope.createdAt+120000;
   assert.equal((await sendInternal({type:'n36-create',envelope:{...envelope,rows:[envelope.rows[0],envelope.rows[0]]}})).ok,false);
   assert.equal((await sendInternal({type:'n36-create',envelope:{...envelope,createdAt:envelope.createdAt-120001,expiresAt:envelope.expiresAt-120001}})).ok,false);
   await sendInternal({type:'n36-create',envelope});
   const nonce=new URLSearchParams(new URL(route).hash.split('?')[1]).get('handoff');
   assert.equal((await sendExternal({type:'n36-claim',nonce},{url:route,origin:app,tab:{id:100}})).ok,false,'Wrong receiver tab rejected without consuming claim');
   await openReceiver(0);await page.clock.install();await page.clock.fastForward(120001);await page.locator('.n36-receiver').waitFor({state:'detached'});assert.deepEqual(await checkpoint(),final,'Expiry erases review without writes');
   await page.clock.setSystemTime(new Date());
   const fresh={...envelope,createdAt:Date.now(),expiresAt:Date.now()+120000};fresh.expiresAt=fresh.createdAt+120000;await sendInternal({type:'n36-create',envelope:fresh});await openReceiver(0);
   await page.evaluate(async other=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id:other},{user:{id:other},access_token:'synthetic-other'});},foreignOwner);
   await page.locator('.n36-receiver').waitFor({state:'detached'});assert.deepEqual(await checkpoint(),final,'Owner change closes preview without writes');
   await runner.locator('#run-cancel').click();
   record('n36_receiver_owner_ttl_duplicate_partial_and_final_package_guards','Actual receiver TTL/owner change erase preview without writes; worker duplicate/expired/wrong-tab/replay denied. All ten partial transfers required fresh approval. Lost receipt retained exact batch. Unchanged 0.5.11 package evidence reused from initial run.');
   evidence.final={studentsAdded:303,enrollmentsAdded:303,networkReceipts:receipts.size,dbOutboxEmpty:true,otherStoresUnchanged:true};
  }finally{await context.close();}
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.phase=phase;evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally{
 if(server.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}
 evidence.cleanup='Canonical helper closed disposable contexts/browser; task-owned server closed; no live lease, user profile, remote request, updater invocation, or Product policy change.';
 evidence.nativeActionPopup={status:'NOT_RUN',evidence:'Origin facade/HTTP and worker VM are not native extension proof.'};
 evidence.sourceHashes={};for(const p of ['src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','src/views/class-import-center.js','src/views/teacher-setup-import.js',extension+'categories-popup.js',extension+'handoff-worker.js'])evidence.sourceHashes[p]=hash(await fs.readFile(p));
 await fs.writeFile('tests/n36-final-journey-resumed.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:evidence.status,phase:evidence.phase,checks:evidence.checks.length}));
}
