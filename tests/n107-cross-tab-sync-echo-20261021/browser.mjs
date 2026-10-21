// AI-authored: real two-tab store/broadcast/scheduler regression, synthetic owner only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
const taskId='continuous-n107-cross-tab-sync-echo-20261021',runId='a321339f-42fe-41ab-a761-a391577d44e4';
const baseline=process.env.N107_BASELINE==='1',base='http://127.0.0.1:49861',root=resolve('.'),out='tests/n107-cross-tab-sync-echo-20261021/';
const service=syntheticService(),result={baseline,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(body||'{}'))));return;}
 const file=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');
 res.end(baseline&&path==='/src/store.js'?execFileSync('git',['show','ebb8aa4daf5c71f255941c9ffb71fae91c18a155:src/store.js']):await readFile(file));
}catch(e){res.writeHead(500);res.end(e.message);}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49861,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:100000},async({createContext})=>{
  const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const pages=[await context.newPage(),await context.newPage()];
  for(const page of pages){
   await openReadyServedDemo(page,base);
   await page.evaluate(async()=>{
    const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),y=await import('/src/lib/sync.js');
    globalThis.__reads=0;globalThis.__stamps=[];globalThis.__updates=[];
    c.setMockBackend({fetchRecords:async()=>{__reads++;return [];},fetchProfile:async()=>null,getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null});
    s.subscribe((_state,update)=>__updates.push({...update,lastSyncAt:s.state.device.lastSyncAt}));
    y.subscribe(()=>{if(y.state.lastSyncedAt&&!__stamps.includes(y.state.lastSyncedAt))__stamps.push(y.state.lastSyncedAt);});
    y.init();
    if(!await y.syncAll())throw Error('Initial synthetic Sync failed: '+JSON.stringify(y.getSyncOperationalSummarySnapshot()));
    location.hash='#/classes';(await import('/src/repaint.js')).repaint();
   });
  }
  await pages[0].waitForTimeout(700);
  const snapshot=async()=>Promise.all(pages.map(p=>p.evaluate(async()=>({reads:__reads,stamps:[...__stamps],updates:[...__updates],lastSyncAt:(await import('/src/store.js')).state.device.lastSyncAt,outbox:await(await import('/src/lib/db.js')).getAll('outbox')}))));
  if(process.env.N107_QUEUED_ONLY!=='1'){
  const before=await snapshot();
  assert.ok(before.every(p=>p.outbox.length===0),'no Product/outbox change is needed');
  // This successful real coordinator pass writes and broadcasts lastSyncAt.
  await pages[0].evaluate(async()=>{await(await import('/src/lib/sync.js')).syncAll({full:false});});
  await pages[0].waitForTimeout(1800);
  const after=await snapshot();result.deviceOnly={before,after};
  const delta=after.map((p,i)=>p.stamps.length-before[i].stamps.length);
  if(baseline){assert.ok(delta[0]>=2&&delta[1]>=2,'baseline must ping-pong successful passes');result.checks.push({name:'baseline_device_only_echo',status:'PASS',delta});return;}
  assert.deepEqual(delta,[1,0],'only the explicitly requested pass may run');
  assert.equal(after[1].reads,before[1].reads,'peer must not read cloud');
  assert.equal(after[1].lastSyncAt,after[0].lastSyncAt,'peer display state still refreshes');
  assert.ok(after[1].updates.some(u=>u.render&&!u.syncReady&&u.lastSyncAt===after[0].lastSyncAt));
  assert.ok(after.every(p=>p.outbox.length===0));
  result.checks.push({name:'n107_two_tab_device_only_sync_echo_reproduced_then_stopped',status:'PASS',delta});
  }
  // Stop only the writer scheduler, then use its real durable Product entry.
  // The peer must wake, read the owner-bound outbox, and expose a failed dispatch.
  await pages[0].evaluate(async()=>{await(await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();});
  const queuedBefore=await snapshot();
  await pages[0].evaluate(async()=>{
   const s=await import('/src/store.js');const saved=await s.patchProfile({teacherName:'Synthetic cross-tab queued edit'});
   if(!saved)throw Error('Product save failed');
  });
  await pages[1].waitForTimeout(800);
  const queuedAfter=await snapshot();result.queued={before:queuedBefore,after:queuedAfter};
  assert.ok(queuedAfter[1].reads>queuedBefore[1].reads,'real durable Product broadcast wakes peer scheduler');
  assert.ok(queuedAfter[1].updates.slice(queuedBefore[1].updates.length).some(u=>u.syncReady));
  assert.ok(queuedAfter[1].outbox.some(r=>r.ownerId==='a7300000-0000-4000-8000-000000000001'&&r.store==='profile'));
  const summary=await pages[1].evaluate(async()=>{const y=await import('/src/lib/sync.js');const summary=await y.getSyncOperationalSummary();(await import('/src/repaint.js')).repaint();return summary;});
  assert.equal(summary.cloudSyncHealthy,false);
  assert.equal(summary.state,'error');
  assert.ok(queuedAfter[1].outbox.some(r=>r.state==='failed'&&r.lastError?.message.includes('Mock backend')));
  result.failureSummary=summary;
  result.checks.push({name:'real_queued_cross_tab_wake_and_durable_dispatch_failure',status:'PASS',evidence:'Real patchProfile durably queues owner-bound outbox, peer reads and attempts dispatch; missing synthetic RPC yields durable failed outbox and unhealthy error summary.'});
  // Outbox-only metadata remains a scheduler wake without a page rerender.
  const count=await pages[1].evaluate(()=>__updates.length);
  await pages[0].evaluate(async()=>{
   const s=await import('/src/store.js');await s.queueClosedTermReport({termId:'n73-term'});
  });
  await pages[1].waitForTimeout(100);
  assert.ok(await pages[1].evaluate(count=>__updates.slice(count).some(u=>!u.render&&u.syncReady),count));
  result.checks.push({name:'outbox_only_cross_tab_wake',status:'PASS',evidence:'Real queueClosedTermReport persists an owner-bound command and its render:false broadcast still notifies peer with syncReady:true.'});
  assert.equal(service.evidence.commits,0);
  for(const page of pages)await page.evaluate(async()=>{await(await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();(await import('/src/store.js')).closeChannel();(await import('/src/lib/db.js')).closeDB();});
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile(out+(baseline?'baseline-result.json':process.env.N107_QUEUED_ONLY==='1'?'queued-result.json':'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({baseline,checks:result.checks,failures:result.failures}));}
