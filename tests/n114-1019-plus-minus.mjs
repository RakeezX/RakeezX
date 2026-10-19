// AI-authored: bounded real application event path, disposable local account and transport.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
import {makeEnrollment,makeItem} from '../src/models.js';

const taskId='continuous-n114-quick-score-undefined-guard-20261019';
const runId='78e4d164-0c2d-4cf1-8111-142a764b43d2';
const baseSha='3fce1195b9c840259e0acea6973efd1436288c29';
const baseline=process.argv.includes('--baseline'),base='http://127.0.0.1:49114',root=resolve('.');
const service=syntheticService(),data=service.current;
data.teachings=data.teachings.slice(0,1);data.students=data.students.slice(0,1);
data.items=data.items.slice(0,1);data.scores=data.scores.slice(0,1);
data.items.push({...makeItem({id:'n114-participation',teachingId:'n73-source',name:'مشاركة',auto:'participation',max:10,perPoint:2,order:1}),ownerId:owner,serverRevision:1});
data.enrollments=[{...makeEnrollment({id:'n114-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',rollNo:1}),ownerId:owner,serverRevision:1}];
const evidence={taskId,runId,baseSha,mode:baseline?'original-source-reproduction':'candidate',checks:[],errors:[]};
if(!baseline){try{const previous=JSON.parse(await readFile('tests/n114-1019-plus-minus.json','utf8'));evidence.previousFailures=[...(previous.previousFailures??[]),...(previous.failure?[previous.failure]:[])];}catch{}}
const original=baseline?execFileSync('git',['show',baseSha+':src/views/grades.js']):null;
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,base).pathname;
  if(pathname.startsWith('/__n73/')){let body='';for await(const chunk of req)body+=chunk;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside app root');
  res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');
  res.end(original&&pathname==='/src/views/grades.js'?original:await readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}
});
const checkpoint=page=>page.evaluate(async()=>{
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),m=await import('/src/models.js');
 return {logs:await d.getAll('logs'),outbox:await d.getAll('outbox'),scores:await d.getAll('scores'),
  preserved:await Promise.all(['students','enrollments','teachings','items','scores'].map(n=>d.getAll(n))),
  projected:m.itemScore(s.items('n73-source').find(i=>i.id==='n114-participation'),s.teachingContext('n73-source').ctx['n73-student1'])};
});
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49114,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url:base,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1000,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>evidence.errors.push(e.message));
  await openReadyServedDemo(page,base);
  const ready=await page.evaluate(async()=>{const f=await import('/tests/n73-account-flow-fixture.mjs');return f.prepareAccount();});
  assert.equal(ready.lease.editable,true);assert.equal(ready.workspace.authUserId,owner);
  await page.evaluate(()=>location.hash='#/teaching/n73-source/grades');
  // Real grade view chooses a direct item initially; select automatic participation.
  await page.locator('[data-act="pick"][data-id="n114-participation"]').click();
  const plus='[data-act="n84-log"][data-delta="1"]',minus='[data-act="n84-log"][data-delta="-1"]';
  await page.locator(plus).waitFor();
  assert.ok(await page.locator(plus).evaluate(el=>el.getBoundingClientRect().height>0&&getComputedStyle(el).display!=='none'));
  const before=await checkpoint(page);assert.equal(before.logs.length,0);assert.equal(before.projected,null);
  await page.locator(plus).click();
  if(baseline){
   await page.waitForFunction(()=>document.body.textContent.includes('runtimeSyncOwnershipGuard is not defined'));
   assert.equal((await checkpoint(page)).logs.length,0);
   evidence.checks.push({name:'original_undefined_guard_reproduced',status:'PASS',evidence:'Original immutable grades.js, real + click: runtimeSyncOwnershipGuard is not defined; zero logs.'});return;
  }
  await page.waitForFunction(async()=> (await import('/src/store.js')).state.logs.length===1);
  await page.locator(plus).waitFor({state:'visible'});
  await page.waitForFunction(sel=>!document.querySelector(sel)?.disabled,plus);
  let cp=await checkpoint(page);assert.equal(cp.projected,2);assert.equal(cp.logs[0].delta,1);
  await page.locator(minus).click();
  await page.waitForFunction(async()=> (await import('/src/store.js')).state.logs.length===2);
  await page.waitForFunction(sel=>!document.querySelector(sel)?.disabled,minus);
  // IndexedDB getAll uses random record IDs, not insertion order.
  cp=await checkpoint(page);assert.equal(cp.projected,0);assert.deepEqual(cp.logs.map(l=>l.delta).sort((a,b)=>a-b),[-1,1]);
  assert.deepEqual(cp.preserved,before.preserved);assert.equal(cp.outbox.length,2);
  assert.ok(cp.outbox.every(r=>r.ownerId===owner&&r.store==='logs'&&r.state==='pending'));
  // Same real UI rejects unresolved ownership and a foreign bound owner.
  for(const bad of ['unresolved','foreign']){
   await page.evaluate(async bad=>{const s=await import('/src/store.js'),{runtimeSyncOwnershipGuard:g}=await import('/src/lib/sync-ownership.js');g.setWorkspace(bad==='unresolved'?{type:'unresolved',ownershipState:'unresolved'}:{...s.getActiveWorkspace(),authUserId:'b7300000-0000-4000-8000-000000000002'});},bad);
   await page.locator(plus).click();
   assert.deepEqual(await checkpoint(page),cp);
  }
  const ack=await page.evaluate(async()=>{
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),{runtimeSyncOwnershipGuard:g}=await import('/src/lib/sync-ownership.js');g.setWorkspace(s.getActiveWorkspace());
   const {GenericV2Backend}=await import('/tests/helpers/generic-v2-backend.mjs'),{createSyncV2Engine}=await import('/src/lib/sync-v2.js');
   const backend=new GenericV2Backend();let calls=0,authenticatedOwner='b7300000-0000-4000-8000-000000000002';
   const engine=createSyncV2Engine({database:d,ownershipGuard:g,currentAuthenticatedUserId:()=>authenticatedOwner,transport:{async applyMutation(e){calls++;return backend.applySyncV2Mutation(e);}}});
   const denied=await engine.dispatchPending(),callsWhileDenied=calls,pendingAfterDenied=await d.getAll('outbox');
   authenticatedOwner=s.getActiveWorkspace().authUserId;
   const result=await engine.dispatchPending(),repeat=await engine.dispatchPending();
   return {denied,callsWhileDenied,pendingAfterDenied,result,repeat,calls,remote:backend.table('logs'),outbox:await d.getAll('outbox')};
  });
  assert.ok(ack.denied.ownershipBlocked>0);assert.equal(ack.callsWhileDenied,0);
  assert.ok(ack.pendingAfterDenied.every(r=>r.state==='blocked'&&r.blockedReason==='ownership:authenticated-user-owner-mismatch'&&r.lastError.code==='SYNC_OWNERSHIP_BLOCKED'));
  const commandOnly=rows=>rows.map(({state,blockedReason,lastError,...command})=>command);
  assert.deepEqual(commandOnly(ack.pendingAfterDenied),commandOnly(cp.outbox));
  assert.equal(ack.result.acknowledged,2);assert.equal(ack.result.failed+ack.result.blocked,0);assert.equal(ack.repeat.attempted,0);
  assert.equal(ack.calls,2);assert.equal(ack.remote.length,2);assert.equal(new Set(ack.remote.map(r=>r.id)).size,2);assert.equal(ack.outbox.length,0);
  const after=await checkpoint(page);assert.deepEqual(after.preserved,before.preserved);assert.equal(after.logs.length,2);assert.equal(after.projected,0);
  assert.doesNotMatch(await page.locator('body').innerText(),/runtimeSyncOn?wershipGuard is not defined|runtimeSyncOwnershipGuard is not defined/);
  assert.deepEqual(evidence.errors,[]);
  evidence.checks.push({name:'n114_actual_plus_minus_owned_score_ack_no_undefined_guard',status:'PASS',evidence:'Actual HTTP application grades DOM/CSS/router + and − clicks: exactly two durable participation events, projection null→2→0, original manual score/identities/history unchanged. Actual guard rejects unresolved/foreign owner UI and foreign authenticated dispatch (zero transport calls); two owner-bound pending commands receive two synthetic canonical ACKs, empty outbox, repeat dispatch zero attempts. No real account/service data.'});
  evidence.observed={deltas:after.logs.map(l=>l.delta),projection:after.projected,acknowledged:ack.result.acknowledged,transportCalls:ack.calls};
 });
}catch(error){evidence.failure=error.stack;throw error;}
finally{
 if(server.listening)await new Promise(done=>server.close(done));
 evidence.gradeSourceSha256=createHash('sha256').update(original??await readFile('src/views/grades.js')).digest('hex');
 evidence.resources='Canonical isolated local browser closed owned contexts/browser in finally; owned loopback server closed. External requests and Service Workers blocked; no live phase.';
 await writeFile(`tests/n114-1019-${baseline?'baseline':'plus-minus'}.json`,JSON.stringify(evidence,null,2)+'\n');
}
