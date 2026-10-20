import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { fixture, syntheticService, owner } from '../n73-account-flow-fixture.mjs';
import { GenericV2Backend } from '../helpers/generic-v2-backend.mjs';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from '../../src/lib/sync-v2.js';

// AI-authored N125: real app/handlers/CSS, only transport and visibility are synthetic.
const taskId='continuous-n125-revision-validation-actual-evidence-20261020';
const runId='39b4f257-9d29-4a9a-a8b9-8acb4ae1a8d4';
const baseSha='01940ee3a6fe0f4c79e0ad50c9209662a7ef7517';
const baseline=process.env.N125_BASELINE==='1', root=resolve('.');
const service=syntheticService(),backend=new GenericV2Backend();
for(const [name,rows] of Object.entries(fixture())) if(SYNC_V2_SCHEMAS[name]) backend.records[SYNC_V2_SCHEMAS[name].entity]=rows.map(row=>({...encodeSyncV2Patch(name,row),id:row.id,owner_id:owner,revision:1,deleted_at:null}));
for(const entity of ['teachings','sections']){const id=entity==='teachings'?'n73-second':'n73-second-section';const row=backend.table(entity).find(r=>r.id===id);backend.table(entity).push({...row,id:entity==='teachings'?'n125-empty':'n125-empty-section',...(entity==='teachings'?{section_id:'n125-empty-section'}:{})});}
let revision=1;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control','no-store');
  if(pathname.startsWith('/__n125/')){
   let text='';for await(const part of req)text+=part;const input=JSON.parse(text||'{}');let result;
   if(pathname.endsWith('/marker')) result={protocol:'OWNER_SIGNAL_V1',ownerId:owner,revision:String(revision)};
   else if(pathname.endsWith('/delete')){revision++;for(const entity of ['teachings','sections']){const id=entity==='teachings'?input.id:input.id+'-section';const row=backend.table(entity).find(r=>r.id===id);row.deleted_at='2026-10-20T10:00:00Z';row.revision=revision;}result={revision};}
   else if(pathname.endsWith('/read')){await pause(20);result=await backend.fetchRecords(input.entity);}
   else result=await backend.applySyncV2Mutation(input);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  if(pathname==='/__n123/auth'||pathname==='/__n123/refresh'){await pause(600);res.end('{}');return;}
  if(pathname.startsWith('/__n73/')||pathname.startsWith('/__n123/')){
   let body='';for await(const part of req)body+=part;const input=JSON.parse(body||'{}');let result;
   if(pathname.startsWith('/__n73/'))result=await service.request(pathname.slice(7),input);
   else if(pathname.endsWith('/read')){await pause(140);result=await backend.fetchRecords(input.entity);}
   else result=await backend.applySyncV2Mutation(input);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside task root');
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream');
  let content=baseline&&['/src/lib/sync.js','/src/lib/remote-sync.js','/src/lib/sync-operational-ui.js'].includes(pathname)?execFileSync('git',['show',baseSha+':'+pathname.slice(1)],{encoding:'utf8'}):await readFile(file);
  if(pathname==='/')content=String(content).replace("import('./src/lib/app-update.js');","await import('./tests/n125-revision-20261020/bootstrap.mjs'); if (!new URL(location.href).searchParams.has('seed')) import('./src/lib/app-update.js');");
  res.end(content);
 }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
const evidence={taskId,runId,baseSha,baseline,checks:[]};
try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const checkpoint=()=>page.evaluate(()=>window.checkpoint());
  const healthy=async()=>{for(let i=0;i<100;i++){const c=await checkpoint();if(c.summary.cloudSyncHealthy&&!c.summary.automaticSyncActive){await pause(100);const next=await checkpoint();if(next.summary.cloudSyncHealthy&&!next.summary.automaticSyncActive&&next.reads===c.reads)return;}await pause(50);}throw Error('No stable complete coordinator checkpoint');};
  await page.goto(url+'/?seed=1');await page.waitForFunction(()=>window.seedReady);
  await page.goto(url+'/#/classes');await page.waitForSelector('.layout');await healthy();
  assert.ok(await page.evaluate(()=>document.styleSheets.length>0));
  await page.locator('.topbar__teacher-btn[data-act="open-teacher-mini-hub"]').click();
  await page.waitForSelector('.mini-hub-sync .sync-dot--synced');
  if(!baseline){
   await page.evaluate(()=>window.arm('fail-validation'));
   await page.locator('[data-act="mini-hub-sync-now"]').click();
   await page.waitForSelector('.mini-hub-sync .sync-dot--error');
   evidence.genuineFailure=await checkpoint();
   assert.equal(evidence.genuineFailure.summary.lastSafeFailure.phase,'revision_validation');
   assert.equal(evidence.genuineFailure.summary.lastSafeFailure.code,'HTTP_503');
   assert.equal(evidence.genuineFailure.summary.cloudSyncHealthy,false);
   await page.evaluate(()=>{window.probe.mode='normal';});
   await page.locator('[data-act="mini-hub-sync-now"]').click();await healthy();
  }
  await page.evaluate(()=>fetch('/__n125/delete',{method:'POST',body:JSON.stringify({id:'n73-second'})}));
  await page.evaluate(async()=>{await window.arm('hold-validation');const button=document.querySelector('[data-act="mini-hub-sync-now"]');if(!button||button.disabled)throw Error('Manual Sync entry not ready');button.click();});
  await page.waitForFunction(()=>window.probe.validationStarted);
  evidence.beforeWake=await checkpoint();
  // Commit another empty class tombstone AFTER the pull, BEFORE validation.
  await page.evaluate(()=>fetch('/__n125/delete',{method:'POST',body:JSON.stringify({id:'n125-empty'})}));
  await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));
   document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));
  });
  await pause(100);evidence.afterWake=await checkpoint();
  if(baseline){
   const events=await page.evaluate(()=>window.probe.events);evidence.events=events;
   assert.ok(events.some(e=>e.error==='Remote Sync revision validation unavailable'));
   evidence.checks.push({name:'baseline_revision_validation_cancellation',status:'PASS',evidence:'Actual current coordinator reports revision_validation UNKNOWN after hidden/rapid visible stops the held marker validation, even though no marker transport failure occurred.'});
   await page.evaluate(()=>{window.probe.mode='normal';window.probe.releaseValidation();});return;
  }
  assert.ok(!evidence.afterWake.error,'visibility cancellation must not fabricate a transport failure');
  await page.evaluate(()=>{window.probe.mode='normal';window.probe.releaseValidation();});
  await page.waitForFunction(async()=>{const c=await window.checkpoint();return c.summary.cloudSyncHealthy&&!c.summary.automaticSyncActive&&c.tombstones.every(t=>t?.deleted)&&c.sections.every(t=>t?.deleted);},{},{timeout:15000});
  await pause(450);evidence.final=await checkpoint();evidence.events=await page.evaluate(()=>window.probe.events);
  assert.ok(!evidence.events.some(e=>e.status==='error'||e.error==='Remote Sync revision validation unavailable'));
  assert.equal(evidence.final.owner,owner);assert.equal(evidence.final.workspace.authUserId,owner);
  assert.equal(evidence.final.score.value,18);assert.equal(evidence.final.outbox.length,0);
  assert.ok(evidence.final.reads>evidence.beforeWake.reads,'later revision needs a subsequent authoritative pull');
  assert.deepEqual(evidence.final.summary.lastSafeFailure,evidence.genuineFailure.summary.lastSafeFailure,'harmless lifecycle and recovery do not overwrite last real failure');
  evidence.checks.push({name:'n125_actual_revision_validation_race_and_genuine_failure',status:'PASS',evidence:'Actual HTTP app coordinator/CSS: held final validation survives rapid hidden/visible teardown, newer committed teaching/section tombstones require trailing pull, grade/outbox/owner preserved; genuine HTTP503 validation remains red and retains original safe diagnostic through recovery.'});
 });
}catch(error){evidence.checks.push({name:'scenario',status:'FAIL',evidence:error.stack});process.exitCode=1;}
finally{await new Promise(done=>server.close(done));evidence.cleanup='Owned fresh isolated contexts/browser and loopback server closed in finally.';await writeFile('tests/n125-revision-20261020/'+(baseline?'baseline':'result')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence.checks));}
