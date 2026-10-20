// AI: exact N36 deleted-destination regression. Real HTTP app/DOM/store/IDB;
// existing synthetic account + Chrome transport helpers, no school collection.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService,owner,foreignOwner} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {workerFixture} from '../n36-actual-save-20261020/worker-fixture.mjs';
const taskId='continuous-n36-deleted-source-class-reimport-20261020',runId='afe3e92c-362b-4c23-94a2-ca382929c050',baseSha='01940ee3a6fe0f4c79e0ad50c9209662a7ef7517';
const base='http://127.0.0.1:49538',root=resolve('.'),folder='tests/n36-deleted-reimport-20261020/',reproduce=process.argv.includes('--reproduce');
const evidence={taskId,runId,baseSha,checks:[],errors:[],scope:'Synthetic local app only; original actual 0.5.17 journey remains FAILED. No extension changes, school browsing, service mutation or deployment.'};
const previous=JSON.parse(await fs.readFile(folder+'browser.json','utf8').catch(()=>'{}'));
evidence.preservedFailures=[...(previous.preservedFailures??[]),...(previous.failure?[{failure:previous.failure,phase:previous.phase}]:[])];
let service;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,base).pathname;
 if(pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
 let bytes=reproduce&&pathname==='/src/views/class-import-center.js'?execFileSync('git',['show',baseSha+':src/views/class-import-center.js']):await fs.readFile(file);
 // Same previously qualified loopback transport fixture: translate only the
 // production origin constant, not nonce/owner/lease/document guard code.
 if(pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(49538,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const scenarios=reproduce?['deleted']:['deleted','deleted-setup','active','ambiguous','archived','mapped-foreign','foreign-account','other-term','race-active','race-archive','race-mapping'];
  for(const scenario of scenarios){
   evidence.phase=scenario;service=syntheticService();
   const old=service.current.sections[0];old.deleted=true;old.status='active';old.name='الخامس الابتدائي/1';
   service.current.teachings[0].deleted=true;service.current.students[0].deleted=true;service.current.students[0].name='طالب اصطناعي ألف';
   service.current.subjects[0].name='علوم تجريبية';
   service.current.enrollments=[{id:'prior-deleted-enrollment',sectionId:old.id,studentId:service.current.students[0].id,status:'active',deleted:true,ownerId:owner}];
   service.current.outbox=[{id:'prior-delete-command',protocol:'v2',mutationId:'synthetic-original-delete',store:'sections',entity:'sections',recordId:old.id,canonicalId:old.id,op:'delete',ownerId:owner,baseRevision:1,patch:{},fields:[],state:'pending'}];
   if(['active','ambiguous','archived'].includes(scenario))service.current.sections.push({...old,id:'existing-live-destination',deleted:false,status:scenario==='archived'?'archived':'active'});
   if(scenario==='ambiguous')service.current.sections.push({...old,id:'second-live-destination',deleted:false});
   if(scenario==='mapped-foreign')old.ownerId=foreignOwner;
   const context=await createContext({viewport:{width:1280,height:900},locale:'ar-SA'});
   try{
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
    await openReadyServedDemo(page,base);
    const ready=await page.evaluate(async()=> (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
    const worker=await workerFixture(page,base);
    await context.exposeBinding('fixtureExternal',(_,m)=>worker.external(m));
    await page.evaluate(()=>{window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}};});
    const route=await page.evaluate(()=>location.hash);
    const checkpoint=()=>page.evaluate(async()=> (await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
    const before=await checkpoint();
    const seeded=await page.evaluate(async({scenario,reproduce})=>{
     const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
     const rows=[{name:'طالب اصطناعي ألف',classroom:'خامس1'}];
     const setup=scenario==='deleted-setup'?[{category:'classes',provenance:['teacher-readonly-run'],rows:[{classroom:'خامس1',subject:'علوم تجريبية'}]},{category:'timetable',provenance:['teacher-readonly-run'],rows:[{weekday:'الأحد',period:'1',time:'09:00-09:45',classroom:'خامس1',subject:'علوم تجريبية'}]}]:null;
     const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(setup?{rows,setup}:rows))))].map(n=>n.toString(16).padStart(2,'0')).join('');
     const p={batchId:'a'.repeat(64),ownerId:s.getActiveWorkspace().authUserId,yearId:s.activeYear().id,termId:scenario==='other-term'?'foreign-term':s.activeTerm().id,pending:{[digest]:{rows,complete:true,...(setup?{setup}:{})}},receipts:{},classMappings:{}};
     if(!reproduce&&['deleted','deleted-setup','active','mapped-foreign'].includes(scenario)){
      p.classMappings['خامس1']='n73-source-section';
      p.receipts[digest]={status:'saved',added:1,existing:0,remaining:0,total:1};
      p.receiptTargets={[digest]:{'خامس1':'n73-source-section'}};
     }
     const device={...s.state.device,n36NamesBatch:p};await d.put('device',device);s.state.device=device;
     window.writeFailures=[];s.onWriteError(e=>window.writeFailures.push(e.message));
     return {rows,setup,digest,batchId:p.batchId};
    },{scenario,reproduce});
    if(scenario==='foreign-account')await page.evaluate(async foreign=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id:foreign},{user:{id:foreign},access_token:'synthetic-foreign'});},foreignOwner);
    if(scenario.startsWith('race-'))await page.evaluate(async scenario=>{
     const d=await import('/src/lib/db.js'),s=await import('/src/store.js'),old=s.state.sections.find(r=>r.id==='n73-source-section');
     const original=IDBDatabase.prototype.transaction;
     IDBDatabase.prototype.transaction=function(names,mode,...args){
      if(mode==='readwrite'&&Array.from(names).includes('sections')&&Array.from(names).includes('outbox')){
       IDBDatabase.prototype.transaction=original;
       // A separate, earlier queued IDB transaction commits the competing
       // destination before the real create transaction reads its snapshot.
       if(scenario==='race-mapping'){
        const competing=original.call(this,['device'],'readwrite'),read=competing.objectStore('device').get('device');
        read.onsuccess=()=>{const device=read.result;competing.objectStore('device').put({...device,n36NamesBatch:{...device.n36NamesBatch,classMappings:{'خامس1':'n73-target-section'}}});};
       }else{
        const competing=original.call(this,['sections'],'readwrite');
        competing.objectStore('sections').put({...old,id:'concurrent-destination',deleted:false,status:scenario==='race-archive'?'archived':'active'});
       }
      }
      return original.call(this,names,mode,...args);
     };
    },scenario);
    const start=await worker.internal({type:'n36-begin'});
    if(['foreign-account','other-term'].includes(scenario)){
     assert.equal(start.ok,false);const after=await checkpoint();
     for(const key of ['sections','students','enrollments','outbox','scores'])assert.deepEqual(after[key],before[key]);
     record(scenario,'Explicit Start denied with unchanged Product disk/outbox.');continue;
    }
    assert.equal(start.ok,true);assert.equal(start.batchId,seeded.batchId,'Start resumes same saved batch');
    const envelope={schema:'rakeez-extension-names',version:seeded.setup?3:2,source:'madrasati',scope:'reviewed-run',createdAt:Date.now(),expiresAt:Date.now()+120000,batchId:start.batchId,complete:true,rows:seeded.rows,...(seeded.setup?{setup:seeded.setup}:{})};envelope.expiresAt=envelope.createdAt+120000;
    const send=async()=>{
     const result=await worker.internal({type:'n36-create',envelope});assert.equal(result.ok,true);
     let receipt;for(let n=0;n<80;n++){receipt=await worker.internal({type:'n36-result',actionId:result.actionId});if(receipt.ok&&!['pending','expired'].includes(receipt.status))return receipt;await new Promise(r=>setTimeout(r,25));}throw Error('No actual app outcome: '+JSON.stringify(receipt));
    };
    const outcome=await send(),after=await checkpoint();
    if(reproduce){
     assert.equal(outcome.status,'unknown');assert.equal(outcome.failure.code,'CLASS_ARCHIVED_OR_AMBIGUOUS');
     for(const key of ['sections','students','enrollments','outbox','scores'])assert.deepEqual(after[key],before[key]);
     evidence.reproduction={outcome,originalSourceSha:baseSha};record('original_deleted_rejection','Frozen base application served over HTTP reproduces unknown / CLASS_ARCHIVED_OR_AMBIGUOUS; no new destination or roster written.');continue;
    }
    if(['deleted','deleted-setup','active'].includes(scenario)){
     assert.ok(['saved','existing'].includes(outcome.status));
     const target=after.sections.find(s=>!s.deleted&&s.yearId===old.yearId&&s.grade===5&&s.label==='1'&&s.status!=='archived');
     assert.ok(target);assert.notEqual(target.id,old.id);if(scenario==='active')assert.equal(target.id,'existing-live-destination');
     assert.deepEqual(after.sections.find(s=>s.id===old.id),before.sections.find(s=>s.id===old.id));
     for(const row of before.teachings)assert.deepEqual(after.teachings.find(t=>t.id===row.id),row);
     for(const row of before.items)assert.deepEqual(after.items.find(i=>i.id===row.id),row);
     assert.deepEqual(after.scores,before.scores);assert.deepEqual(after.profile,before.profile);
     if(seeded.setup){
      assert.equal(outcome.setup.unresolved,0);assert.deepEqual(outcome.setup.missing,['teacher','school','principal']);
      const teaching=after.teachings.find(t=>!t.deleted&&t.sectionId===target.id);assert.ok(teaching);assert.notEqual(teaching.id,before.teachings[0].id);
      assert.equal(after.slots.length,1);assert.equal(after.slots[0].teachingId,teaching.id);
     }else{assert.deepEqual(after.teachings,before.teachings);assert.deepEqual(after.slots,before.slots);}
     assert.deepEqual(after.enrollments.find(e=>e.id==='prior-deleted-enrollment'),before.enrollments.find(e=>e.id==='prior-deleted-enrollment'));
     assert.deepEqual(after.students.find(s=>s.id===before.students[0].id),before.students[0]);
     assert.deepEqual(after.outbox.find(c=>c.id==='prior-delete-command'),before.outbox[0]);
     for(const command of after.outbox.filter(c=>c.id!=='prior-delete-command')){
      assert.notEqual(command.recordId,old.id);assert.notEqual(command.localPatch?.sectionId,old.id);assert.notEqual(command.patch?.section_id,old.id);
      assert.equal(command.ownerId,owner);
     }
     assert.equal(after.enrollments.filter(e=>!e.deleted&&e.sectionId===target.id).length,1);
     const p=after.device[0].n36NamesBatch;assert.equal(p.pending,null);assert.equal(p.classMappings['خامس1'],old.id);assert.equal(p.receiptTargets[seeded.digest]['خامس1'],target.id);assert.equal(p.receiptHistory[0].targets['خامس1'],old.id);
     const again=await send(),retried=await checkpoint();assert.equal(again.status,'existing');assert.equal(again.added,0);
     for(const key of ['sections','students','enrollments','outbox','scores','teachings','items','slots'])assert.deepEqual(retried[key],after[key],key+' retry must not duplicate or revive');
     assert.equal(retried.device[0].n36NamesBatch.receiptHistory.length,1);
     assert.equal(await page.evaluate(()=>location.hash),route);assert.deepEqual(worker.evidence.navigation,[]);
     if(scenario==='deleted'){
      assert.equal(await page.locator('.layout').count(),1);assert.equal(await page.locator('[data-n36-direct]').count(),0);
      await page.screenshot({path:folder+'fresh-class.png',fullPage:false});
      evidence.freshIdentity={old:old.id,new:target.id,owner:owner,receiptTargets:p.receiptTargets,oldHistoryUnchanged:true,retryAdded:again.added};
     }
     record(scenario,'Actual saved batch + stale mapping/receipt requalified; fresh destination or unique active reused, old tombstones/history unchanged; identical retry adds no section/student/enrollment/command. No navigation or dummy subject.');
    }else{
     assert.equal(outcome.status,'unknown');
     for(const key of ['students','enrollments','outbox','scores','teachings'])assert.deepEqual(after[key],before[key],scenario+' '+key);
     if(['race-active','race-archive'].includes(scenario)){assert.equal(after.sections.length,before.sections.length+1);assert.ok(after.sections.some(s=>s.id==='concurrent-destination'));}else assert.deepEqual(after.sections,before.sections);
     assert.ok(after.device[0].n36NamesBatch.pending);
     record(scenario,{outcome:outcome.failure,root:await page.evaluate(()=>window.writeFailures),effect:'No child/outbox writes, pending batch retained; persisted competing row preserved where applicable.'});
    }
   }finally{await context.close();}
  }
 });
 evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;}
finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+(reproduce?'reproduction':'browser')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}
