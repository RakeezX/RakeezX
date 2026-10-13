// AI: the live runner's complete suppression path against real app + native SQL.
import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withNativeRestore} from './n71-live/native-fixture.mjs';
import {ownerCheckpoint,ordinarySyncCheckpoint,payload,restore,suppressionSequence} from './n71-live/runner.mjs';
import {fixtureIds,portableFixture} from './n71-live/fixture.mjs';
import {createCloud} from './helpers/remote-sync-browser.mjs';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../src/lib/cloud.js';
import {SYNC_V2_SCHEMAS} from '../src/lib/sync-v2.js';
import {buildAccountFoundationDefaults} from '../src/lib/account-provisioning.js';
const run=process.env.N71_RUN_ID;
const evidenceRoot=`coverage/n71-live/${run}${process.env.N71_EVIDENCE_SUBDIR?'/'+process.env.N71_EVIDENCE_SUBDIR:''}`;
const existing=await fs.readFile(new URL('./initial-restore.e2e.mjs',import.meta.url),'utf8');
const auth=existing.slice(existing.indexOf('async function installAuth('),existing.indexOf('async function installRestoreCloud('));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
test('complete valid deletion graph reaches canonical reconcile and ordinary A2 equality',async({browser,page})=>{
 test.setTimeout(150000);
 await fs.mkdir(evidenceRoot,{recursive:true});
 const files=['src/lib/backup-v2.js','src/lib/cloud.js','src/lib/initial-restore.js','src/lib/sync.js','src/lib/sync-v2.js','src/lib/restore-deletion-scope.js','src/store.js','src/lib/export.js','src/lib/score-foundation.js','tests/n71-live/fixture.mjs','tests/n71-live/runner.mjs','tests/n71-live/native-fixture.mjs','tests/n71-valid-deletion.e2e.mjs'];
 const sourceHashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex')])));
 await withNativeRestore(async(pg,owner)=>{
  const cloud=createCloud();
  const rpc=async(name,args={})=>{
   assert.ok(['stage_n71_restore','finalize_n71_restore','n71_restore_manifest','sync_v2_restore_manifest_score_v2','apply_sync_v2_mutation','owner_sync_change_marker','score_foundation_capability','sync_v2_score_domain_snapshot','n71_restore_capability','account_contract'].includes(name),name);
   const entries=Object.entries(args);
   return (await pg.query(`select rakeezx.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(',')}) result`,entries.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v))).rows[0].result;
  };
  const foundation=buildAccountFoundationDefaults();
  await pg.query('select rakeezx.provision_account_profile()');
  await pg.query("select rakeezx.complete_account_profile('N71 local fixture','0500000000','masculine','N71 local fixture')");
  await pg.query('select rakeezx.begin_account_provisioning()');
  await pg.query('select rakeezx.provision_account_workspace($1)',[JSON.stringify(foundation)]);
  const session={access_token:'initial-restore-access',refresh_token:'initial-restore-refresh',expires_at:4102444800,user:{id:owner,email:'restore@example.test'}};
  const installAuth=await new AsyncFunction('AUTH_STORAGE_KEY','SUPABASE_URL','session',auth+'\nreturn installAuth;')(AUTH_STORAGE_KEY,SUPABASE_URL,session);
  const calls=[];let syncGate;
  const setup=async target=>{
   await target.route('https://**',route=>route.abort());
   await target.routeWebSocket('wss://*.supabase.co/**',socket=>socket.close());
   await cloud.route(target);await installAuth(target);
   await target.route('**/rest/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);
    try{
     let value;
     if(url.pathname.includes('/rpc/')){
      calls.push(name);value=await rpc(name,request.postDataJSON()??{});
     }else{
      assert.ok(Object.values(SYNC_V2_SCHEMAS).some(s=>s.entity===name),'Unexpected table '+name);
      assert.equal(request.method(),'GET');
      if(syncGate?.page===target&&name==='students'){const gate=syncGate;syncGate=null;gate.started();await gate.wait;}
      // Match PostgREST's SQL JSON encoding (date strings and numeric bigint),
      // rather than node-pg's Date/int8 driver representation.
      const all=(await pg.query(`select to_jsonb(t) result from rakeezx."${name}" t where owner_id=$1 order by ${name==='profile'?'owner_id':'id'}`,[owner])).rows.map(r=>r.result);
      const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??500);
      value=all.slice(offset,offset+limit);
      return route.fulfill({json:value,headers:{'Content-Range':value.length?`${offset}-${offset+value.length-1}/${all.length}`:`*/${all.length}`,'Access-Control-Expose-Headers':'Content-Range'}});
     }
     return route.fulfill({json:value});
    }catch(error){return route.fulfill({status:error.code==='42501'?403:400,json:{code:error.code,message:error.message}});}
   });
   await target.goto('/#/');await ownerCheckpoint(target,owner);
  };
  await setup(page);
  const ids=fixtureIds(run),fixture=portableFixture(ids,foundation,new Date().toISOString());
  const seed=await payload(page,fixture);
  try{await restore(page,seed,'local:'+run+':seed');}catch(error){
   const canonical=(await pg.query('select rakeezx.n71_restore_canonical($1) result',[owner])).rows[0].result;
   const diagnostic=await page.evaluate(async({backup,canonical})=>{const b=await import('/src/lib/backup-v2.js'),c=await import('/src/lib/cloud.js');
    try{await b.reconcileCanonicalRestore(backup,canonical,{expectedOwnerId:c.user.id});return {unexpected:true};}catch(e){return {code:e.code,message:e.message,cause:e.cause?.code,causeMessage:e.cause?.message};}
   },{backup:seed,canonical}).catch(e=>({diagnosticError:e.message}));
   console.log('LOCAL_SEED_DIAGNOSTIC',JSON.stringify(diagnostic));throw error;
  }
  const exported=await payload(page);
  assert.equal(exported.data.scoreSubitems.find(r=>r.id===ids.subitem).createdAt,fixture.scoreSubitems[0].createdAt);
  for(const [name,rows]of Object.entries(exported.data))assert.ok(rows.length,name);
  const secondContext=await browser.newContext({serviceWorkers:'block',baseURL:process.env.RAKEEZX_E2E_BASE_URL});
  try{
   const second=await secondContext.newPage();await setup(second);
   await ownerCheckpoint(second,owner,{studentId:ids.student});
   const changed=await payload(page,{}, {store:'students',id:ids.student,patch:{note:'after canonical restore'}});
   await restore(page,changed,'local:'+run+':resume');
   // Exercise the original invalid parent-only graph through actual ordinary Sync
   // and the real ancestry guard. A local savepoint restores this owned fixture.
   await pg.query('savepoint invalid_graph').catch(async()=>{await pg.query('begin;savepoint invalid_graph');});
   const row=await page.evaluate(async id=>await(await import('/src/lib/db.js')).get('assignments',id),ids.deletedAssignment);
   await rpc('apply_sync_v2_mutation',{p_entity:'assignments',p_record_id:ids.deletedAssignment,p_mutation_id:'local:invalid-parent',p_device_id:'local-fixture',p_base_revision:row.serverRevision,p_patch:{},p_operation:'delete',p_client_updated_at:Date.now()});
   const invalid=(await pg.query('select rakeezx.n71_restore_canonical($1) result',[owner])).rows[0].result;
   const denial=await page.evaluate(async({backup,canonical,owner})=>{
    const b=await import('/src/lib/backup-v2.js');
    try{await b.reconcileCanonicalRestore(backup,canonical,{expectedOwnerId:owner});return 'UNEXPECTED_SUCCESS';}catch(e){return e.code;}
   },{backup:exported,canonical:invalid,owner});
   assert.equal(denial,'RESTORE_CANONICAL_DELETED_DESCENDANT');
   assert.equal(await page.evaluate(async id=>(await(await import('/src/lib/db.js')).get('assignments',id)).deleted,ids.deletedAssignment),false);
   await pg.query('rollback to savepoint invalid_graph;commit');
   const sequenceState={ownerId:owner,productIds:ids,foundation:{A:foundation},liveDeadline:new Date(Date.now()+90000).toISOString()};
   const final=await suppressionSequence(page,second,sequenceState,exported,{beforeA2Pull:async()=>{
    let started,release;const pending=new Promise(r=>{started=r;}),wait=new Promise(r=>{release=r;});
    syncGate={page:second,started,wait};
    await second.evaluate(async()=>{window.__n71RealPull=(await import('/src/lib/sync.js')).syncAll({full:true});});
    await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('Actual background Sync did not reach the held student read')),10000))]);
    setTimeout(release,500);
   }});
   assert.equal(sequenceState.a2ConvergenceCheckpoint.directResult,false,'Reproduce the actual busy Sync false return');
   assert.ok(sequenceState.a2ConvergenceCheckpoint.checkpoint.lastSyncedAt>sequenceState.a2ConvergenceCheckpoint.before);
   await assert.rejects(ordinarySyncCheckpoint(second,'99999999-9999-4999-8999-999999999999',{studentId:ids.student,timeout:300}),/owner checkpoint mismatch/);
   const savedDevice=await second.evaluate(async()=>await(await import('/src/lib/db.js')).get('device','device'));
   await second.evaluate(async device=>{delete device.initialRestoreReceipt;await(await import('/src/lib/db.js')).put('device',device);},structuredClone(savedDevice));
   await assert.rejects(ordinarySyncCheckpoint(second,owner,{studentId:ids.student,timeout:300}),/owner-bound Initial Restore receipt/);
   await second.evaluate(async device=>await(await import('/src/lib/db.js')).put('device',device),savedDevice);
   await second.evaluate(async()=>await(await import('/src/lib/db.js')).put('outbox',{id:'n71:busy:rejected',protocol:'v2',store:'students',state:'rejected',sequence:1}));
   await assert.rejects(ordinarySyncCheckpoint(second,owner,{studentId:ids.student,timeout:300}),/unresolved local work/);
   await second.evaluate(async()=>await(await import('/src/lib/db.js')).remove('outbox','n71:busy:rejected'));
   const a=await payload(page),a2=await payload(second);
   assert.equal(await page.evaluate(async p=>(await(await import('/src/lib/export.js')).validateBackupIntegrity(p)).ok,a),true);
   const a2Validation=await second.evaluate(async p=>(await import('/src/lib/export.js')).validateBackupIntegrity(p),a2);
   assert.equal(a2Validation.ok,true,JSON.stringify(a2Validation));
   assert.deepEqual(a2.data,a.data);assert.deepEqual(a2.baselines,a.baselines);
   assert.equal(final.scoreSubitems.find(r=>r.id===ids.subitem).createdAt,fixture.scoreSubitems[0].createdAt);
   await page.goto('/#/settings/backup');await expect(page.locator('[data-act="export"]')).toBeVisible();
   await page.screenshot({path:evidenceRoot+'/valid-deletion-ui.png',fullPage:true});
   await fs.writeFile(evidenceRoot+'/valid-deletion-preflight.json',JSON.stringify({runId:run,status:'PASS',actualApp:true,nativeSql:true,sharedLiveSequence:true,sourceHashes,busySyncCheckpoint:sequenceState.a2ConvergenceCheckpoint,invalidGraphDenial:denial,calls,counts:Object.fromEntries(Object.entries(final).map(([s,r])=>[s,r.length])),createdAt:fixture.scoreSubitems[0].createdAt,grades:final.scores,observedAt:new Date().toISOString()},null,2));
  }finally{await secondContext.close();}
 });
});
