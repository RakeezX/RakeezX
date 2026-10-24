// AI-authored: actual mounted application, extension .41 popup/worker and native IndexedDB.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
import {html,dash,home,report,meta,classes,timetable,roster,rows} from '../n36-fresh-account-start-20261023/source-fixture.mjs';
import {provisioningServer} from './server-fixture.mjs';
const taskId='continuous-n36-fresh-academic-recurrence-20261024',runId='1ee94e6d-6fdf-4e7f-afec-36c16a8d1026',baseSha='3b6dfe789297c98e4a6ff1b977e098796a633b37';
const base='http://127.0.0.1:49948',root=resolve('.'),folder='tests/n36-fresh-recurrence-20261024/',baseline=process.argv.includes('--baseline');let requests=[];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);if([dash,home,report,meta,classes,new URL(timetable,base).pathname,new URL(roster,base).pathname].includes(u.pathname)){requests.push(u.pathname);res.setHeader('content-type','text/html;charset=utf-8');return res.end(html(u));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));
 let bytes=baseline&&u.pathname==='/src/store.js'?execFileSync('git',['show',baseSha+':src/store.js']):await fs.readFile(f);
 if(u.pathname==='/')bytes=Buffer.from(bytes.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="/tests/n36-fresh-recurrence-20261024/bootstrap.mjs"></script>'));
 if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,baseSha,baseline,storeHash:createHash('sha256').update(baseline?execFileSync('git',['show',baseSha+':src/store.js']):await fs.readFile('src/store.js')).digest('hex'),cases:[]};let worker,pg;
try{pg=await provisioningServer();result.serviceSourceHashes=pg.hashes;await new Promise(r=>server.listen(49948,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
for(const scenario of (process.env.N36_CASES??(baseline?'fresh':'fresh,nondefault,refused,mature,ambiguous,foreign,selection-race,owner-race,session-race,lease-race,transaction-abort,academic-edit,calendar-later,term-edit,prior-unknown,profile-sync,term-drift,unknown,rendered')).split(',')){
const owner=randomUUID();await pg.newOwner(owner);const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});let row={scenario};requests=[];
try{
 await c.exposeBinding('fixtureRPC',async(_,name,args)=>{const response=await pg.rpc(owner,name,args.map(a=>typeof a==='object'&&a!==null?JSON.stringify(a):a));if(name==='provision_account_workspace')row.provisionedRevisions=Object.fromEntries(Object.entries(response.snapshot).map(([k,rows])=>[k,rows.map(r=>r.revision)]));return response;});
 const app=await c.newPage();app.on('pageerror',e=>console.log('PAGE '+e.message));await app.goto(base+'/?case='+scenario+'&owner='+owner+'#/classes/koshoof?import=1');await app.locator('[data-account-profile-form]').waitFor();await app.locator('[name=teacherName]').fill('معلم اصطناعي');await app.locator('[name=phone]').fill('0500000001');await app.locator('[name=educationDepartment]').selectOption('الإدارة العامة للتعليم بمنطقة الرياض');await app.locator('[data-account-profile-form] [type=submit]').click();await app.waitForFunction(()=>window.fixtureReady&&window.releaseAuth);
 const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
 if(scenario==='already-ready')await app.waitForFunction(async()=>(await import('/src/store.js')).state.ready);const before=await disk();if(scenario!=='nondefault'){assert.equal(before.device[0].activeYearId,scenario==='already-ready'?before.years[0].id:null);assert.equal(before.device[0].activeTermId,scenario==='already-ready'?before.terms.find(t=>t.index===1).id:null);}assert.equal(before.sections.length,0);assert.equal(before.terms.length,2);
 row.initialFieldRevisions={year:before.years[0].fieldRevisions,profile:before.profile[0].fieldRevisions};
 row.preReadiness={year:before.device[0].activeYearId,term:before.device[0].activeTermId};
 await app.evaluate(()=>{window.initialWrites=[];const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){window.initialWrites.push(this.name);return put.apply(this,args);};});
 await app.evaluate(async scenario=>{
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
 if(scenario==='refused')window.refuseAuth=true;
 if(['academic-edit','calendar-later'].includes(scenario)){const record={...s.state.years[0],serverRevision:scenario==='academic-edit'?2:3,fieldRevisions:{...s.state.years[0].fieldRevisions,...(scenario==='academic-edit'?{label:2}:{calendar_selection:3})}};await d.put('years',record);s.state.years=[record];}
 if(scenario==='term-edit'){const record={...s.state.terms[0],serverRevision:2};await d.put('terms',record);s.state.terms=s.state.terms.map(t=>t.id===record.id?record:t);}
 if(scenario==='prior-unknown'){const record={...s.state.device,n36NamesBatch:{pending:true,ownerId:s.getActiveWorkspace().authUserId,id:'preserved-unknown'}};await d.put('device',record);s.state.device=record;}
 if(scenario==='mature'){const record={id:'mature-section',yearId:s.state.years[0].id};await d.put('sections',record);s.state.sections.push(record);}
 if(scenario==='ambiguous'){const record={...s.state.terms[0],id:'ambiguous-term'};await d.put('terms',record);s.state.terms.push(record);}
 if(scenario==='foreign'){const record={...s.state.terms[0],ownerId:'b7300000-0000-4000-8000-000000000002'};await d.put('terms',record);s.state.terms=s.state.terms.map(t=>t.id===record.id?record:t);}
 if(['selection-race','owner-race','session-race','lease-race','transaction-abort'].includes(scenario)){
 const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){
  if(mode==='readwrite'&&Array.isArray(names)&&names.includes('outbox')&&names.includes('calendarDays')&&!window.raced){window.raced=true;
   if(scenario==='selection-race'){const tx=original.call(this,['device'],'readwrite');const r=tx.objectStore('device').get('device');r.onsuccess=()=>tx.objectStore('device').put({...r.result,activeYearId:s.state.years[0].id,activeTermId:s.state.terms.find(t=>t.index===2).id});}
   const cloud=window.fixtureCloud;
   if(scenario==='owner-race')cloud.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{...cloud.session,user:{id:'b7300000-0000-4000-8000-000000000002'}});
   if(scenario==='session-race')cloud.setMockAuth(cloud.user,{...cloud.session,access_token:'changed-synthetic'});
   if(scenario==='lease-race')(awaitLease=>awaitLease.invalidate('synthetic-expiry'))(window.fixtureLease);
   if(scenario==='transaction-abort'){const tx=original.call(this,names,mode,...args);queueMicrotask(()=>tx.abort());return tx;}
  }return original.call(this,names,mode,...args);
 };
 }
 window.initialWrites=[];window.authReleased=true;window.releaseAuth?.();
},scenario);
if(scenario==='refused'){
 await app.waitForFunction(async()=>{const s=await import('/src/store.js');return window.trace.includes('auth-end')&&!s.getOfflineLeaseStatus().editable;});
 await app.waitForTimeout(100);const denied=await disk();assert.deepEqual(denied.device,before.device);assert.deepEqual(denied.outbox,[]);row.denied=true;row.status='PASS';console.log('PASS '+scenario);continue;
}
 await app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&(['owner-race','lease-race'].includes(new URL(location.href).searchParams.get('case'))||s.getOfflineLeaseStatus().editable)&&typeof window.rakeezBeginNamesBatch==='function';});
 if(!['foreign','owner-race','session-race','lease-race','transaction-abort'].includes(scenario))await app.locator('[data-n36-direct]').waitFor();const ready=await disk();row.initialWrites=await app.evaluate(()=>window.initialWrites);if(!['already-ready','nondefault'].includes(scenario))assert.ok(row.initialWrites.every(name=>name==='device'));if(scenario==='fresh'&&!baseline)assert.deepEqual(row.initialWrites,['device']);
 if(scenario==='nondefault'){
  await app.evaluate(()=>location.hash='#/calendar');await app.locator('[data-act=open-settings]').click();await app.locator('[data-settings-tab=terms]').click();
  await app.locator('[data-act=use-term]').first().click();
  await app.evaluate(async()=>{window.autoAuth=true;await(await import('/src/store.js')).renewOfflineLease();});row.explicitTermDOM=true;
 }
 if(scenario==='rendered'){
 const check=async()=>{await app.evaluate(()=>location.hash='#/calendar');await app.locator('[data-act=open-settings]').click();await app.locator('[data-settings-tab=terms]').click();const selected=app.locator('.cal-settings-term').filter({has:app.locator('.badge--brand')});assert.equal(await selected.locator('.row__title').innerText(),before.terms.find(t=>t.index===1).name);const actual=await disk();assert.equal(actual.device[0].activeTermId,before.terms.find(t=>t.index===1).id);assert.ok(await app.locator('[data-settings-panel=years]').innerText().then(t=>t.includes(before.years[0].label)));};
 await check();await app.screenshot({path:folder+'rendered-defaults.png',fullPage:true});await app.reload();await app.waitForFunction(()=>window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});await app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable;});await check();row.renderedDefaultsAndReload=true;row.status='PASS';console.log('PASS '+scenario);continue;
 }
 if(!['fresh','profile-sync'].includes(scenario)){

 await app.waitForTimeout(150);
 const current=await disk();
 if(scenario.endsWith('-race')||scenario==='transaction-abort')assert.equal(await app.evaluate(()=>window.raced),true);
 if(['already-ready','nondefault'].includes(scenario)){
 assert.equal(current.device[0].activeTermId,before.terms.find(t=>t.index===(scenario==='nondefault'?2:1)).id);
 const batch=await app.evaluate(()=>window.rakeezBeginNamesBatch());assert.equal(typeof batch,'string');await app.evaluate(id=>window.rakeezCancelNamesBatch(id),batch);
 }else if(scenario==='selection-race'){
 assert.equal(current.device[0].activeTermId,before.terms.find(t=>t.index===2).id);const start=await app.evaluate(()=>window.rakeezBeginNamesBatch());if(typeof start==='string'){assert.equal(await app.evaluate(async()=>(await import('/src/store.js')).state.device.activeTermId),current.device[0].activeTermId);await app.evaluate(id=>window.rakeezCancelNamesBatch(id),start);}else assert.equal(start.code,'APP_ACADEMIC_SELECTION_REQUIRED');
 }else if(!['term-drift','unknown'].includes(scenario)){
 assert.equal(current.device[0].activeTermId,null);assert.equal(current.device[0].activeYearId,null);
 const denial=await app.evaluate(async()=>{try{return await window.rakeezBeginNamesBatch();}catch{return 'DENIED';}});assert.ok(denial==='DENIED'||denial.code==='APP_ACADEMIC_SELECTION_REQUIRED');
 }
 if(!['term-drift','unknown'].includes(scenario)){if(!['academic-edit','calendar-later'].includes(scenario))assert.deepEqual(current.years,before.years);if(scenario==='prior-unknown')assert.equal(current.device[0].n36NamesBatch.id,'preserved-unknown');assert.deepEqual(current.outbox,[]);row.status='PASS';console.log('PASS '+scenario);continue;}
 }

 if(scenario==='profile-sync')row.syncCheckpoint=await app.evaluate(async()=>{const cloud=window.fixtureCloud;await cloud.completeAccountProfile({teacherName:'معلم معدل اصطناعي',phone:'0500000001',teacherForm:'masculine',schoolName:''});const sync=await import('/src/lib/sync.js'),s=await import('/src/store.js');const deadline=Date.now()+8000;while(Date.now()<deadline){await sync.syncProfile();if(sync.displayState().detailStatus!=='syncing'&&s.state.profile.teacherName==='معلم معدل اصطناعي')break;await new Promise(r=>setTimeout(r,50));}if(s.state.profile.teacherName!=='معلم معدل اصطناعي')throw Error('Profile Sync did not settle: '+sync.state.lastError);return {profile:s.state.profile,reads:window.syncReads,status:sync.displayState()};});
 row.trace=await app.evaluate(()=>window.trace);row.selection=await app.evaluate(async()=>{const s=await import('/src/store.js');return {year:s.activeYear().id,term:s.activeTerm().id,device:s.state.device};});
 await app.evaluate(()=>history.replaceState(null,'','/'+location.hash));const source=await c.newPage();await source.goto(base+dash);
 await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});
 if(scenario==='unknown')await app.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='device'&&value.n36NamesBatch?.receipts&&Object.keys(value.n36NamesBatch.receipts).length&&!window.receiptFault){window.receiptFault=true;throw new DOMException('Synthetic receipt failure','AbortError');}return put.call(this,value,...args);};});
 worker=await backgroundFixture({app,source,base,onRead:async input=>{
 if(scenario==='term-drift'&&input.args?.[0]?.nonce)await app.evaluate(async()=>{const d=await import('/src/lib/db.js');const device=await d.get('device','device');const term=(await d.getAll('terms')).find(t=>t.index===2);await d.put('device',{...device,activeTermId:term.id});});
 }});
 await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
 await c.addInitScript(()=>{window.chrome={runtime:{getManifest:()=>({version:'0.5.41'}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};});
 const popup=await c.newPage();await popup.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();
 await worker.wait(d=>['complete','stopped'].includes(d['n36:background-view']?.phase)||d['n36:background-view']?.phase==='receipt'&&!!d['n36:background-view']?.code||Object.entries(d).some(([k,v])=>k.startsWith('receipt:')&&v.outcome?.status==='unknown'),25000);
 if(['term-drift','unknown'].includes(scenario)){
 await worker.wait(d=>Object.entries(d).some(([k,v])=>k.startsWith('receipt:')&&v.outcome?.status==='unknown'));await worker.wake();
 const current=await disk();assert.equal(worker.evidence.outcomes.at(-1).status,'unknown');assert.equal(current.students.length,scenario==='unknown'?2:0);if(scenario==='unknown')assert.ok(current.device[0].n36NamesBatch.pending);else assert.equal(current.device[0].n36NamesBatch,undefined);
 const reads=worker.evidence.reads,nonce=worker.data['n36:background-job'].pending.actionId;await worker.internal({type:'n36-job-start',sourceTabId:7});assert.equal(worker.evidence.reads,reads);assert.equal(worker.data['n36:background-job'].pending.actionId,nonce);assert.deepEqual((await disk()).students,current.students);
 row.unknownReceipt=true;row.repeatStartPreservedNonce=true;row.status='PASS';row.outcomes=structuredClone(worker.evidence.outcomes);console.log('PASS '+scenario);continue;
 }
 row.view=structuredClone(worker.data['n36:background-view']);row.metrics=worker.metrics();row.requests=requests;row.outcomes=structuredClone(worker.evidence.outcomes);const after=await disk();
 assert.deepEqual(ready.years,before.years);assert.deepEqual(ready.terms,before.terms);assert.deepEqual(ready.outbox,[]);
 if(baseline){assert.equal(row.view.code,'APP_ACADEMIC_SELECTION_REQUIRED');assert.equal(worker.evidence.reads,0);assert.equal(after.students.length,0);assert.equal(ready.device[0].activeTermId,null);}
 else{assert.equal(row.view.phase,'complete',JSON.stringify(row.view));assert.equal(after.students.length,2);assert.equal(row.outcomes[0].status,'saved');assert.equal(ready.device[0].activeTermId,row.selection.term);assert.equal(ready.device[0].activeYearId,row.selection.year);assert.ok(worker.evidence.reads>0);
 await worker.internal({type:'n36-job-start',sourceTabId:7});await worker.wait(d=>d['n36:background-view']?.phase==='complete'&&worker.evidence.outcomes.length===2);assert.deepEqual((await disk()).students,after.students);assert.equal(worker.evidence.outcomes.at(-1).status,'existing');row.repeatStartNoDuplicates=true;
 await app.screenshot({path:folder+'fresh-receiver.png',fullPage:true});await popup.screenshot({path:folder+'fresh-popup.png',fullPage:true});
 await app.reload();await app.waitForFunction(()=>window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});await app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable;});
 const reloaded=await disk();assert.deepEqual(reloaded.students,after.students);assert.equal(reloaded.device[0].activeTermId,ready.device[0].activeTermId);row.reloadReceipt=reloaded.device[0].n36NamesBatch;assert.equal(Object.keys(row.reloadReceipt.receipts).length,1);
 const displayed=await app.evaluate(async()=>{const s=await import('/src/store.js');return [s.activeYear().id,s.activeTerm().id];});assert.deepEqual(displayed,[ready.device[0].activeYearId,ready.device[0].activeTermId]);row.renderedAfterReload=displayed;
 }
 row.status='PASS';console.log('PASS '+scenario);
}catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();worker=null;await c.close();result.cases.push(row);}
}
});}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));await pg?.close();result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true};await fs.writeFile(folder+(process.env.N36_LABEL??(baseline?'baseline':'candidate'))+'.json',JSON.stringify(result,null,2)+'\n');}
