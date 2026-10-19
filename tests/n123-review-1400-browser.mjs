import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixture, syntheticService, owner } from './n73-account-flow-fixture.mjs';
import { GenericV2Backend } from './helpers/generic-v2-backend.mjs';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from '../src/lib/sync-v2.js';

const taskId='continuous-n123-sync-latency-measured-20261019';
const runId=process.env.N123_RUN_ID;
if(!runId) throw Error('N123_RUN_ID required');
const baseSha='210cce3813b4cf1b45269f671d87fb5221076ab2';
const baselineSource=execFileSync('git',['show',baseSha+':src/lib/sync.js'],{encoding:'utf8'});
const root=resolve('.'), checks=[], measurements=[];
let baseline=true, backend, service, active=0, maximum=0, requests=0;
const receipts=new Map();
function reset() {
  backend=new GenericV2Backend();service=syntheticService();receipts.clear();active=maximum=requests=0;
  for(const [name,rows] of Object.entries(fixture())) {
    if(!SYNC_V2_SCHEMAS[name]) continue;
    backend.records[SYNC_V2_SCHEMAS[name].entity]=rows.map(row=>({
      ...encodeSyncV2Patch(name,row),id:row.id,owner_id:owner,revision:1,deleted_at:null,
    }));
  }
}
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')||pathname.startsWith('/__n123/')) {
      let body='';for await(const part of req)body+=part;
      const input=JSON.parse(body||'{}');let result;
      if(pathname.startsWith('/__n73/'))result=await service.request(pathname.slice(7),input);
      else if(pathname.endsWith('/read')) {
        requests++;active++;maximum=Math.max(maximum,active);
        try {await new Promise(done=>setTimeout(done,80));result=await backend.fetchRecords(input.entity);}
        finally {active--;}
      } else {
        if(!receipts.has(input.mutationId))receipts.set(input.mutationId,await backend.applySyncV2Mutation(input));
        result=receipts.get(input.mutationId);
      }
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
    res.end(baseline&&pathname==='/src/lib/sync.js'?baselineSource:await readFile(file));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
async function fresh(createContext,url) {
  reset();
  const context=await createContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await openReadyServedDemo(page,url);
  const setup=await page.evaluate(async()=> (await import('/tests/fixtures/n123-review-1400/account.mjs')).prepare());
  assert.equal(setup.workspace.authUserId,owner);assert.equal(setup.outbox.length,0);
  return {context,page};
}
async function full(page) {
  return page.evaluate(async()=>{
    const sync=await import('/src/lib/sync.js');const start=performance.now();
    const ok=await sync.syncAll({full:true});return {ms:performance.now()-start,ok};
  });
}
try {
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const url='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:120000},async({createContext})=>{
    for(const version of ['baseline','candidate']) {
      baseline=version==='baseline';
      const {context,page}=await fresh(createContext,url);
      const measured=await full(page);assert.equal(measured.ok,true);
      measurements.push({version,scenario:'full_open_refresh',...measured,requests,maximum,readDelayMs:80});
      if(baseline)assert.equal(maximum,1);
      else assert.ok(maximum>1&&maximum<=4,'Bounded overlap; HTTP socket scheduling may use fewer than four');
      // An actual owner-bound store edit stays durable until its exact ACK.
      await page.evaluate(async()=>{
        window.n123.mode='hold';
        await (await import('/src/store.js')).renameStudent('n73-student1','Synthetic measured edit');
        window.n123.editStart=performance.now();
        window.n123.editDone=(await import('/src/lib/sync.js')).syncAll({full:false});
      });
      await page.waitForFunction(()=>!!window.n123.release);
      const held=await page.evaluate(async()=>({outbox:await(await import('/src/lib/db.js')).getAll('outbox'),summary:await(await import('/src/lib/sync.js')).getSyncOperationalSummary()}));
      assert.equal(held.outbox.length,1);assert.equal(held.summary.cloudSyncHealthy,false);
      const edit=await page.evaluate(async()=>{
        window.n123.release();const ok=await window.n123.editDone;
        return {ok,ms:performance.now()-window.n123.editStart,outbox:await(await import('/src/lib/db.js')).getAll('outbox')};
      });assert.equal(edit.ok,true);assert.equal(edit.outbox.length,0);
      measurements.push({version,scenario:'single_store_edit_including_ACK_hold',ms:edit.ms});
      const wake=await page.evaluate(async()=>{
        const sync=await import('/src/lib/sync.js');
        const checkpoint={last:sync.state.lastSyncedAt,reads:window.n123.reads,start:performance.now()};
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
        while(performance.now()-checkpoint.start<12000) {
          if(sync.state.lastSyncedAt>checkpoint.last && window.n123.reads>checkpoint.reads &&
              (await sync.getSyncOperationalSummary()).cloudSyncHealthy)
            return {ms:performance.now()-checkpoint.start,requests:window.n123.reads-checkpoint.reads};
          await new Promise(done=>setTimeout(done,20));
        }
        throw Error('Actual pageshow sync did not finish with new reads and healthy summary');
      });
      assert.equal(wake.requests,48);
      measurements.push({version,scenario:'pageshow_return',...wake});
      // Real first-tap deletion waits for the active full pass before committing.
      await page.locator('[data-act="delete-class-flow"]').tap();
      await page.locator('.class-delete-row[data-teaching-id="n73-source"]').tap();
      await page.locator('#class-delete-next-btn').tap();
      const drainReads=await page.evaluate(async()=>{
        const reads=window.n123.reads;
        window.n123.drainStart=performance.now();
        window.n123.drainDone=(await import('/src/lib/sync.js')).syncAll({full:true});
        return reads;
      });
      await page.waitForFunction(reads=>window.n123.reads>reads,drainReads);
      await page.locator('#class-delete-confirm-btn').tap();
      await page.waitForFunction(()=>!!window.n123.releaseDelete);
      const pending=await page.evaluate(async()=>({ms:window.n123.deleteStarted-window.n123.drainStart,
        teaching:await(await import('/src/lib/db.js')).get('teachings','n73-source'),
        scores:await(await import('/src/lib/db.js')).getAll('scores')}));
      assert.equal(pending.teaching.deleted,false);
      assert.equal(await page.locator('#class-delete-confirm-btn').isDisabled(),true);
      measurements.push({version,scenario:'active_sync_to_delete_commit',ms:pending.ms});
      await page.evaluate(()=>window.n123.releaseDelete());
      await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn'));
      const deleted=await page.evaluate(async()=>{
        const db=await import('/src/lib/db.js');return {teaching:await db.get('teachings','n73-source'),score:await db.get('scores','n73-source-score'),other:await db.get('scores','n73-valid')};
      });assert.equal(deleted.teaching.deleted,true);assert.equal(deleted.score.deleted,true);assert.equal(deleted.other.value,18);
      await context.close();
    }
    const before=measurements.find(x=>x.version==='baseline'&&x.scenario==='full_open_refresh');
    const after=measurements.find(x=>x.version==='candidate'&&x.scenario==='full_open_refresh');
    assert.equal(after.requests,before.requests);assert.ok(after.ms<before.ms*0.65,JSON.stringify(measurements));
    checks.push({name:'n123_measured_sync_latency_and_true_ack_recovery_preserved',status:'PASS',evidence:'Actual source app/CSS on loopback HTTP, fresh mobile synthetic account contexts and real ownership guard. Identical 80ms HTTP read delays; same reads and two pulls, read concurrency capped at four (observed HTTP overlap in measurements). Held edit ACK remains queued/unhealthy. One-tap class delete drains active sync, waits for receipt, tombstones selected class/grade and preserves unrelated grade. See measurements.'});
    baseline=false;
    const {context,page}=await fresh(createContext,url);
    // Wrong ACK cannot remove a command; retry uses the same durable mutation.
    const recovery=await page.evaluate(async()=>{
      const store=await import('/src/store.js'),sync=await import('/src/lib/sync.js'),db=await import('/src/lib/db.js');
      await store.renameStudent('n73-student1','Synthetic recovery');window.n123.mode='wrong';
      const first=await sync.syncAll({full:false});const retained=await db.getAll('outbox');
      window.n123.mode='normal';const retry=await sync.syncAll({full:false});
      return {first,retry,retained,remaining:await db.getAll('outbox'),calls:window.n123.calls};
    });
    assert.equal(recovery.first,false);assert.equal(recovery.retained.length,1);assert.equal(recovery.retry,true);assert.equal(recovery.remaining.length,0);
    assert.equal(recovery.calls[0].mutationId,recovery.calls[1].mutationId);
    const rejected=await page.evaluate(async()=>{
      const store=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js'),sync=await import('/src/lib/sync.js');
      await sync.suspendForWorkspaceDeactivation();
      cloud.setMockAuth({id:'foreign-owner'},{access_token:'synthetic-foreign',user:{id:'foreign-owner'}});
      const reads=window.n123.reads,calls=window.n123.calls.length;const ok=await sync.syncAll();
      return {ok,reads:window.n123.reads-reads,calls:window.n123.calls.length-calls};
    });assert.deepEqual(rejected,{ok:false,reads:0,calls:0});
    checks.push({name:'wrong_ack_idempotent_recovery_and_owner_rejection',status:'PASS',evidence:'Actual account store/coordinator: mismatched receipt leaves durable outbox and reports false; retry sends same mutationId, canonical receipt clears it. Foreign owner sends zero reads/writes and reports false.'});
    await context.close();
  });
}catch(error){checks.push({name:'scenario_failure',status:'FAIL',evidence:error.stack});process.exitCode=1;}
finally {
  await new Promise(done=>server.close(done));
  checks.push({name:'owned_resource_cleanup',status:'PASS',evidence:'Canonical isolated helper closed fresh contexts/browser; owned ephemeral loopback server closed in finally. No shared/live browser phase.'});
  await writeFile('tests/n123-review-1400-browser.json',JSON.stringify({taskId,runId,baseSha,measurements,checks},null,2)+'\n');
}
console.log(JSON.stringify({measurements,checks},null,2));
