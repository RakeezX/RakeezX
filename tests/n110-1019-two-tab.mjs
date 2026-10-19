// AI: actual application, shared storage/IndexedDB/BroadcastChannel/Web Locks;
// only the service transport is replaced with a loopback synthetic service.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId='continuous-n110-two-tab-runtime-stability-20261019';
const runId='6463f4ca-f30b-41b2-8301-4ad7197a784e';
const base='81b892cc81a6622c05fcc291e9d7cfa00611245b';
const baseline=process.argv.includes('--baseline'),root=resolve('.');
const owner='a1100000-0000-4000-8000-000000000001';
const session={access_token:'synthetic-n110-only',refresh_token:'synthetic-n110-refresh',expires_at:4102444800,user:{id:owner,email:'n110@example.test'}};
const evidence={taskId,runId,base,baseline,checks:[],errors:[],serviceWrites:0};
const record=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/__service/')){
  res.setHeader('Content-Type','application/json');
  if(pathname.endsWith('/auth/v1/user'))return res.end(JSON.stringify(session.user));
  if(req.method!=='GET')evidence.serviceWrites++;
  // No invented ACK/capability. Unavailable Sync remains unavailable.
  return res.writeHead(503).end(JSON.stringify({message:'N110 synthetic service unavailable'}));
 }
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('Outside app root');
 let body=await readFile(file);
 if(pathname==='/src/app.js'){
  if(baseline)body=execFileSync('git',['show',base+':src/app.js']);
  body=body.toString().replace('function paint() {','function paint() { window.__n110.paints++;');
 }
 if(pathname==='/src/lib/cloud.js')body=body.toString().replace("export const SUPABASE_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co';","export const SUPABASE_URL = location.origin + '/__service';");
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(body);
}catch{res.writeHead(404).end();}});
const ready=page=>page.waitForFunction(async()=>{
 const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId==='a1100000-0000-4000-8000-000000000001'&&s.getOfflineLeaseStatus().state==='NORMAL';
});
const snapshot=page=>page.evaluate(async()=>{
 const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
 return {owner:s.getActiveWorkspace().authUserId,database:s.getActiveWorkspace().databaseName,actual:db.getActiveDatabaseName(),receipt:(await db.get('device','device')).initialRestoreReceipt,
  rows:await Promise.all(['students','scores','sessions','logs','outbox'].map(n=>db.getAll(n)))};
});
const metrics=pages=>Promise.all(pages.map(p=>p.evaluate(()=>({...window.__n110}))));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
try{
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>{
   window.__n110={paints:0,storage:0,clocks:0,messages:0};
   addEventListener('storage',e=>{window.__n110.storage++;if(e.key?.includes(':clock:'))window.__n110.clocks++;});
  });
  const a=await context.newPage();a.setDefaultTimeout(10000);
  await a.goto(url);await a.locator('[data-workspace-login]').waitFor();
  // Existing restored-account registry and DB APIs (same preparation as N112).
  await a.evaluate(async({owner,session})=>{
   const w=await import('/src/lib/workspaces.js'),db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
   db.selectDatabase(await w.accountWorkspaceDatabaseName(owner));await db.openDB();
   const receipt={ownerId:owner,protocol:'CORE_V2',restoreId:'n110-restore',manifestHash:'n110-manifest',completedAt:Date.now()};
   await db.put('device',{id:'device',deviceId:'n110-device',initialRestoreReceipt:receipt});
   const registry=w.createWorkspaceRegistry();try{
    await registry.beginAccountRestore(owner,receipt);await registry.updateAccountRestore(owner,receipt.restoreId,{phase:'RESTORE_COMPLETE'});await registry.finalizeAccountRestore(owner,receipt);
   }finally{await registry.close();}
   localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));
  },{owner,session});
  await a.reload();await ready(a);await a.locator('.layout').waitFor();
  const b=await context.newPage();b.setDefaultTimeout(10000);
  for(const p of [a,b])p.on('pageerror',e=>evidence.errors.push(e.message));
  await b.goto(url);await ready(b);await b.locator('.layout').waitFor();
  const pages=[a,b];
  // Observe the actual workspace channel, without substituting its handler.
  await b.evaluate(async()=>{const s=await import('/src/store.js');const channel=new BroadcastChannel(s.getActiveWorkspace().broadcastChannelName);channel.onmessage=()=>window.__n110.messages++;window.__n110Channel=channel;});
  await a.waitForTimeout(700);
  const start=await metrics(pages);await a.waitForTimeout(1000);const end=await metrics(pages);
  evidence.idle={start,end,deltas:end.map((v,i)=>({paints:v.paints-start[i].paints,clocks:v.clocks-start[i].clocks}))};
  if(baseline){
   assert.ok(start.every(d=>d.paints>20&&d.clocks>20),'Original app must reproduce the cross-tab paint/clock storm during second-tab boot');
   record('baseline_reproduced',evidence.idle);return;
  }
  assert.ok(evidence.idle.deltas.every(d=>d.paints<=2&&d.clocks<=4),'Both tabs settle without feedback');
  assert.ok(start.every(d=>d.paints<20),'Second-tab boot must not produce a repaint storm');
  // Small synthetic protected rows; actual app boot already queued uncommitted
  // owner-bound bootstrap commands. No service ACK exists.
  await a.evaluate(async({owner})=>{
   const db=await import('/src/lib/db.js');
   await db.put('students',{id:'n110-student',ownerId:owner,name:'Synthetic',deleted:false});
   await db.put('scores',{id:'n110-grade',ownerId:owner,studentId:'n110-student',value:7});
   await db.put('sessions',{id:'n110-history',ownerId:owner,date:'2026-10-18',status:'completed'});
   await db.put('logs',{id:'n110-tombstone',ownerId:owner,deleted:true,updatedAt:100});
  },{owner});
  const before=await snapshot(a);assert.equal(before.owner,owner);assert.equal(before.database,before.actual);assert.equal(before.receipt.ownerId,owner);
  assert.ok(before.rows[4].length>0&&before.rows[4].every(row=>row.ownerId===owner&&row.state==='pending'));
  assert.deepEqual(await snapshot(b),before);
  // Store write -> real BroadcastChannel -> peer absorb, without echo.
  await a.evaluate(async()=>{await (await import('/src/store.js')).patchDevice({sound:'off'});});
  await b.waitForFunction(async()=>(await import('/src/store.js')).state.device.sound==='off'&&window.__n110.messages>0);
  record('real_workspace_broadcast','Device preference propagated through the actual store/channel/absorb path.');
  // A control remains usable while clock events occur; actual source CSS is loaded.
  await a.evaluate(()=>{location.hash='#/settings';});await a.locator('[data-settings-profile]').waitFor();
  const profile=a.locator('[data-settings-profile]');
  await profile.locator(':scope > summary').click();
  const open=await profile.evaluate(e=>e.open);
  const paints=await a.evaluate(()=>window.__n110.paints);
  for(let i=0;i<4;i++)await b.evaluate(async()=>{(await import('/src/store.js')).getOfflineLeaseStatus();});
  await a.waitForTimeout(400);
  assert.equal(await profile.evaluate(e=>e.open),open);
  assert.equal(await a.evaluate(()=>window.__n110.paints),paints);
  assert.equal(await a.locator('.layout').evaluate(e=>getComputedStyle(e).display),'grid');
  // Genuine notification preference changes must still repaint the peer UI.
  await b.evaluate(async()=>{
   const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),n=await import('/src/lib/notification-events.js'),v=await import('/src/lib/notification-state.js');
   v.writeNotificationCategory(n.currentNotificationContext(s,c),'lesson',false);
  });
  await a.waitForFunction(p=>window.__n110.paints>p,paints);
  // Actual remote receiver leadership implementation, sharing browser Web Locks.
  for(const p of pages)await p.evaluate(async()=>{
   const s=await import('/src/store.js'),r=await import('/src/lib/remote-sync.js');
   window.__n110Leader=0;window.__n110Release=r.browserRemoteLeadership(s.getActiveWorkspace().databaseName,()=>window.__n110Leader++);
  });
  await a.waitForFunction(()=>window.__n110Leader===1);assert.equal(await b.evaluate(()=>window.__n110Leader),0);
  await a.evaluate(()=>window.__n110Release());await b.waitForFunction(()=>window.__n110Leader===1);
  await b.evaluate(()=>window.__n110Release());
  record('single_receiver_leader_recovery','Real browserRemoteLeadership/Web Locks allowed one receiver, then transferred leadership after the owner released it.');
  // Renewal stays guarded and peer receipt processing settles; no Auth purge.
  await a.evaluate(async()=>{await (await import('/src/store.js')).renewOfflineLease();});
  await ready(b);await a.waitForTimeout(600);
  const settled=await metrics(pages);await a.waitForTimeout(700);const later=await metrics(pages);
  assert.ok(later.every((v,i)=>v.paints-settled[i].paints<=2&&v.clocks-settled[i].clocks<=4));
  assert.deepEqual(await snapshot(a),before);assert.deepEqual(await snapshot(b),before);
  const guard=await a.evaluate(async()=>{
   const s=await import('/src/store.js'),g=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;
   let rejected=false;try{g.bindNewCommand({ownerId:'b1100000-0000-4000-8000-000000000002'});}catch(e){rejected=e.code==='SYNC_OWNERSHIP_BLOCKED';}
   return {rejected,lease:s.getOfflineLeaseStatus().editable,summary:await (await import('/src/lib/sync.js')).getSyncOperationalSummary()};
  });
  assert.equal(guard.rejected,true);assert.equal(guard.lease,true);
  assert.equal(guard.summary.state,'error');assert.equal(guard.summary.cloudSyncHealthy,false);
  assert.equal(guard.summary.lastSuccessfulSyncAt,null);
  record('owner_grade_history_pending_preserved',{
   owner:before.owner,database:before.database,receiptOwner:before.receipt.ownerId,
   protectedRowCounts:before.rows.map(rows=>rows.length),
   beforeAndAfterSHA256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),
   wrongOwnerRejected:guard.rejected,leaseEditable:guard.lease,
   syncState:guard.summary.state,pendingCount:guard.summary.pendingCount,
   lastSuccessfulSyncAt:guard.summary.lastSuccessfulSyncAt,cloudSyncHealthy:guard.summary.cloudSyncHealthy
  });
  // Real peer sign-out storage event must still retire the old account and reload.
  let reloads=0;a.on('framenavigated',f=>{if(f===a.mainFrame())reloads++;});
  await b.evaluate(async()=>{const c=await import('/src/lib/cloud.js');localStorage.removeItem(c.AUTH_STORAGE_KEY);});
  await a.locator('[data-workspace-login]').waitFor();assert.equal(reloads,1);
  await a.waitForTimeout(500);assert.equal(reloads,1);
  record('peer_account_transition','Peer sign-out removed the private account UI and reloaded exactly once into login.');
  record('n110_two_same_browser_tabs_no_refresh_lease_feedback_loop',evidence.idle);
  assert.deepEqual(evidence.errors,[]);
 });
}catch(error){evidence.failure=error.stack;throw error;}
finally{await new Promise(done=>server.close(done));await writeFile('tests/n110-1019'+(baseline?'-baseline':'-browser')+'.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence,null,2));
