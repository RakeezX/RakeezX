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
const taskId='continuous-n125-actual-window-return-error-20261019';
const runId='0ecd9e4b-29fe-4656-bba1-f4b223a9c942';
const baseSha='a0490e3e54b11498406bad71c70ab5485920f26e';
const baseline=process.env.N125_BASELINE==='1', root=resolve('.');
const service=syntheticService(),backend=new GenericV2Backend();
for(const [name,rows] of Object.entries(fixture())) if(SYNC_V2_SCHEMAS[name]) backend.records[SYNC_V2_SCHEMAS[name].entity]=rows.map(row=>({...encodeSyncV2Patch(name,row),id:row.id,owner_id:owner,revision:1,deleted_at:null}));
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control','no-store');
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
  let content=baseline&&['/src/lib/sync.js','/src/app.js','/src/lib/cloud.js','/src/lib/sync-operational-ui.js'].includes(pathname)?execFileSync('git',['show',baseSha+':'+pathname.slice(1)],{encoding:'utf8'}):await readFile(file);
  if(pathname==='/')content=String(content).replace("import('./src/lib/app-update.js');","await import('./tests/n125-1837/bootstrap.mjs'); if (!new URL(location.href).searchParams.has('seed')) import('./src/lib/app-update.js');");
  res.end(content);
 }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
const evidence={taskId,runId,baseSha,baseline,checks:[],returns:[]};
try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844}}),page=await context.newPage(),failures=[];
  page.on('console',msg=>{if(msg.text().includes('Automatic sync failed'))failures.push(msg.text());});
  const checkpoint=()=>page.evaluate(async()=>{const sync=await import('/src/lib/sync.js');return {...await window.checkpoint(),error:sync.state.lastError,reads:window.probe.reads,authReads:window.probe.authReads,dots:[...document.querySelectorAll('[data-sync-status]')].map(x=>x.className)};});
  const healthy=async()=>{
   const deadline=Date.now()+20000;let previous=false;
   while(Date.now()<deadline){const value=await checkpoint();const ready=value.summary.cloudSyncHealthy&&!value.summary.automaticSyncActive;
    if(ready&&previous)return value;previous=ready;await pause(50);
   }throw Error('Actual app did not reach a settled healthy checkpoint');
  };
  await page.goto(url+'/?seed=1');await page.waitForFunction(()=>window.seedReady);
  await page.goto(url+'/#/classes');await page.waitForSelector('.layout');await healthy();
  // Settings has a real owner-verification return handler for a pending email.
  await page.evaluate(()=>{location.hash='#/settings';});
  await page.waitForSelector('[data-settings-profile]');await pause(1800);await healthy();
  failures.length=0;
  for(let cycle=1;cycle<=2;cycle++){
   // Advance only the test clock to allow the existing 30s email return guard.
   await page.evaluate(cycle=>{window.testNow??=Date.now.bind(Date);Date.now=()=>window.testNow()+cycle*31000;},cycle);
   const before=await checkpoint();
   await page.evaluate(()=>{
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    if(document.visibilityState!=='visible')throw Error('Window-only fixture must remain visible');
   });
   // Duplicate wake notifications in a later task, while renewal remains unsettled.
   await pause(50);await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});
   const early=await checkpoint();
   const states=[early];let final;const deadline=Date.now()+16000;
   while(Date.now()<deadline){const value=await checkpoint();states.push(value);if(value.summary.cloudSyncHealthy&&value.authReads>before.authReads){final=value;break;}await pause(25);}
   assert.ok(final,'return must eventually reach verified complete sync');
   assert.equal(final.owner,owner);assert.equal(final.workspace.authUserId,owner);assert.equal(final.score.value,18);assert.equal(final.outbox.length,0);
   const red=states.some(x=>x.dots.some(d=>d.includes('sync-dot--error')));
   evidence.returns.push({cycle,beforeReads:before.reads,afterReads:final.reads,authReads:final.authReads-before.authReads,red,states:states.map(x=>({state:x.summary.state,reason:x.summary.reasonCategory,reads:x.reads,authReads:x.authReads,error:x.error,dots:x.dots})).filter((x,i,a)=>i===0||JSON.stringify(x)!==JSON.stringify(a[i-1]))});
   if(!baseline){assert.equal(early.reads,before.reads,'no cloud records before return readiness');assert.equal(early.summary.state,'pending');assert.ok(!red,'return preparation must not generate red');assert.equal(final.authReads-before.authReads,1,'same return coalesces identity verification');}
   await pause(500);const settled=await checkpoint();if(!baseline)assert.equal(settled.reads,final.reads,'no duplicate trailing pass from same return');
  }
  if(baseline){evidence.failures=failures;evidence.checks.push({name:'n125_current_source_focus_only_diagnosis',status:'PASS',evidence:'Pure window blur/focus, unchanged visible document, rapid repeated returns and 600ms readiness did not reproduce reported red on current source. Actual user cause remains unknown.'});return;}
  assert.equal(failures.length,0);
  assert.ok(await page.evaluate(()=>document.styleSheets.length>0));
  await page.evaluate(()=>{location.hash='#/classes';});await page.waitForFunction(()=>!document.querySelector('[data-settings-profile]'));
  await page.locator('.topbar__teacher-btn[data-act="open-teacher-mini-hub"]').click();
  await page.waitForSelector('.mini-hub-sync .sync-dot--synced');
  // Focus return during an active pull must drain it before identity renewal.
  await page.evaluate(()=>{window.probe.mode='hold-read';});await page.locator('[data-act="mini-hub-sync-now"]').click();
  await page.waitForFunction(()=>typeof window.probe.releaseRead==='function');const active=await checkpoint();
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await pause(100);
  evidence.activeFocus=await checkpoint();
  assert.equal((await checkpoint()).authReads,active.authReads,'no renewal under the active capture');
  await page.evaluate(()=>{window.probe.mode='normal';window.probe.releaseRead();});
  await page.waitForFunction(before=>window.probe.authReads>before,active.authReads,{timeout:10000});await healthy();await pause(500);
  assert.equal(failures.length,0,'active pass must not be invalidated by focus return');
  evidence.activeReturn={authReads:(await checkpoint()).authReads-active.authReads,noFailure:true,checkpoint:await checkpoint()};
  assert.equal(evidence.activeReturn.authReads,1);
  // A genuinely changed session during a read still fails the exact context guard.
  await page.evaluate(()=>{window.probe.mode='replace-session';});await page.locator('[data-act="mini-hub-sync-now"]').click();
  await page.waitForSelector('.mini-hub-sync .sync-dot--error');const changed=await checkpoint();
  assert.ok(changed.error.includes('sync-context-changed'));assert.equal(changed.summary.cloudSyncHealthy,false);
  assert.equal(changed.summary.lastSafeFailure.code,'CONTEXT_CHANGED');
  evidence.realContextChange={state:changed.summary.state,error:changed.error,diagnostic:changed.summary.lastSafeFailure};
  await page.locator('[data-act="mini-hub-sync-now"]').click();await healthy();
  // A real read failure must remain red across another preparation cycle.
  await page.evaluate(()=>{window.probe.mode='read-fail';});await page.locator('[data-act="mini-hub-sync-now"]').click();
  await page.waitForSelector('.mini-hub-sync .sync-dot--error');const failed=await checkpoint();assert.ok(failed.error.includes('Synthetic read failure'));assert.equal(failed.summary.lastSafeFailure.phase,'pull');assert.equal(failed.summary.lastSafeFailure.code,'HTTP_503');
  await page.locator('.mini-hub-sync__details summary').click();
  await page.waitForSelector('[data-sync-safe-failure]');
  assert.ok((await page.locator('[data-sync-safe-failure]').innerText()).includes('HTTP_503'));
  assert.ok(!(await page.locator('[data-sync-safe-failure]').innerText()).includes('pupil-secret'));
  evidence.serverFailure={diagnostic:failed.summary.lastSafeFailure,rendered:await page.locator('[data-sync-safe-failure]').innerText()};assert.equal(failed.summary.cloudSyncHealthy,false);
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await pause(100);
  assert.equal((await checkpoint()).summary.state,'error','preparation cannot hide established error');
  await page.waitForFunction(()=>window.probe.authReads>0);await pause(1800);
  assert.equal((await checkpoint()).summary.state,'error');assert.ok(await page.locator('.mini-hub-sync a[href="#/support"]').isVisible());
  // Failed readiness is recorded even when a later real guarded pull recovers.
  await page.evaluate(()=>{window.probe.mode='normal';});
  await page.locator('[data-act="mini-hub-sync-now"]').click();await healthy();
  const priorAuth=(await checkpoint()).authReads;
  await page.evaluate(()=>{window.probe.mode='auth-fail';window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  await page.waitForFunction(before=>window.probe.authReads>before,priorAuth);
  await page.waitForFunction(async()=>{const s=await window.checkpoint();return s.summary.lastSafeFailure?.phase==='resume_readiness';});
  await healthy();
  evidence.readinessFailure=(await checkpoint()).summary.lastSafeFailure;
  assert.equal(evidence.readinessFailure.code,'HTTP_503');
  assert.equal(evidence.readinessFailure.event,'focus');
  assert.ok(evidence.readinessFailure.elapsedMs>=500);
  assert.ok(!JSON.stringify(evidence.readinessFailure).includes('private'));
  await page.evaluate(()=>{window.probe.mode='normal';});
  // Real manual UI entry with the actual owner guard, no foreign network reads.
  await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');cloud.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{access_token:'synthetic-foreign'});});
  const before=await checkpoint();await page.locator('[data-act="mini-hub-sync-now"]').click();await pause(100);const blocked=await checkpoint();
  assert.equal(blocked.reads,before.reads);assert.equal(blocked.summary.reasonCategory,'workspace_ownership_blocked');assert.equal(blocked.summary.cloudSyncHealthy,false);assert.equal(blocked.score.value,18);assert.equal(blocked.outbox.length,0);
  evidence.checks.push({name:'n125_actual_window_focus_readiness_and_safe_error_phase',status:'PASS',evidence:'Actual HTTP app/CSS: two pure visible-window delayed return renewals plus rapid blur/focus stay pending with zero premature reads, one verification/pass per return, green only after completed guarded sync; HTTP503 read failure remains red with finite safe diagnostics across return, foreign-owner manual UI makes zero reads, grade 18 and empty outbox preserved.'});
 });
}catch(error){evidence.checks.push({name:'scenario',status:'FAIL',evidence:error.stack});process.exitCode=1;}
finally{await new Promise(done=>server.close(done));evidence.cleanup='Owned isolated contexts/browser and loopback server closed in finally; external requests and Service Workers blocked.';await writeFile('tests/n125-1837/'+(baseline?'baseline':'result')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence.checks));}
