// AI: actual store entry, coordinator/default RPC, owned fake-IDB; every fetch intercepted.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as s from '../../src/store.js';
import * as d from '../../src/lib/db.js';
import * as c from '../../src/lib/cloud.js';
import * as sync from '../../src/lib/sync.js';
import {runtimeOfflineLease} from '../../src/lib/offline-lease.js';
import {accountWorkspaceDatabaseName} from '../../src/lib/workspaces.js';
import {fixture,owner,foreignOwner} from '../n73-account-flow-fixture.mjs';
import {SYNC_V2_SCHEMAS,encodeSyncV2Patch} from '../../src/lib/sync-v2.js';
const storage = new Map();
global.localStorage = { getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;} };
async function prepare() {
  s.state.ready=false;s.closeChannel();d.closeDB();storage.clear();
  const rows=fixture(),receipt={ownerId:owner,contractVersion:1,foundationHash:'n107-synthetic'};
  rows.device[0].accountProvisioningReceipt=receipt;
  const session={access_token:'synthetic-only',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{id:owner}};
  localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));c.setMockAuth(session.user,session);
  s.activateWorkspace({id:'account:n107',type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true,
    databaseName:await accountWorkspaceDatabaseName(owner),broadcastChannelName:'n107-unit',workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([owner,null,null,receipt])});
  await d.clearAll();
  for(const name of d.STORES) {
    const records=rows[name]??[];
    s.state[name]=name==='device'||name==='profile'?records[0]:records;
    if(records.length)await d.putMany(name,records);
  }
  await runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));s.state.ready=true;
}


const scenario=process.argv[2]??'order',events=[],originalFetch=globalThis.fetch;
let canonical,receipts=new Map(),sends=[],active=0,maxActive=0,studentStarts=0;
const held=Promise.withResolvers(),both=Promise.withResolvers();
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const wire=(name,r)=>({...encodeSyncV2Patch(name,r),id:r.id,owner_id:owner,revision:r.serverRevision,deleted_at:null});
globalThis.fetch=async(url,options={})=>{
 const path=new URL(url).pathname,input=JSON.parse(options.body??'{}');
 if(path.endsWith('/score_foundation_capability')||path.endsWith('/n71_restore_capability'))return response({});
 if(path.endsWith('/apply_sync_v2_mutation')){
  sends.push(input);const isStudent=input.p_entity==='students',ordinal=isStudent?++studentStarts:0;
  if(!isStudent)assert.equal(active,0,'Enrollment/other commands cannot overlap students');
  if(isStudent){active++;maxActive=Math.max(maxActive,active);events.push({start:ordinal,active,operation:input.p_operation});assert.ok(active<=2);}
  try{
   if(isStudent&&['owner','lease'].includes(scenario)&&ordinal<=2){if(ordinal===2)both.resolve();await held.promise;}
   else if(isStudent)await new Promise(r=>setTimeout(r,ordinal===1?45:5));
   if(receipts.has(input.p_mutation_id))return response(receipts.get(input.p_mutation_id));
   const name=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===input.p_entity);
   const old=canonical[name]?.find(r=>r.id===input.p_record_id),revision=(old?.serverRevision??0)+1;
   const row={...old&&wire(name,old),...input.p_patch,id:input.p_record_id,owner_id:owner,revision,deleted_at:null};
   const receipt={mutationId:input.p_mutation_id,outcome:'applied',canonicalId:row.id,resultRevision:revision,canonical:row};receipts.set(input.p_mutation_id,receipt);
   const local={...row,...Object.fromEntries(Object.entries(SYNC_V2_SCHEMAS[name].fields).map(([k,v])=>[k,row[v]])),serverRevision:revision};
   canonical[name]??=[];const idx=canonical[name].findIndex(r=>r.id===local.id);if(idx<0)canonical[name].push(local);else canonical[name][idx]=local;
   if(scenario==='lost'&&ordinal===1)throw new TypeError('Synthetic committed sibling lost response');
   return response(receipt);
  }finally{if(isStudent){active--;events.push({finish:ordinal,active});}}
 }
 if(path.includes('/rpc/'))throw Error('Unexpected fixture RPC '+path);
 const entity=path.split('/').at(-1),name=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===entity);assert.ok(name);
 const rows=(c.user?.id===owner?canonical[name]??[]:[]).map(r=>wire(name,r));return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','content-range':rows.length?'0-'+(rows.length-1)+'/'+rows.length:'*/0'}});
};
const report={scenario,checks:[],failures:[]};
try{
 await prepare();c.setMockBackend(null);canonical=fixture();
 const imported=await s.importStudents('n73-source-section',['Synthetic A','Synthetic B','Synthetic C'],{verifyCurrent:()=>s.assertClassImportAccess()});
 const originals=(await d.getAll('outbox')).filter(r=>r.store==='students').sort((a,b)=>a.sequence-b.sequence);assert.equal(originals.length,3);
 if(scenario==='same-id'){
  const first=originals[0];await d.put('outbox',{...first,id:'v2:synthetic-successor',mutationId:'synthetic-successor',sequence:Math.max(...originals.map(r=>r.sequence))+1,op:'patch',patch:{note:'Synthetic successor'},localPatch:{note:'Synthetic successor'},fields:['note']});
 }
 const running=sync.syncAll({full:false});
 if(['owner','lease'].includes(scenario)){
  await Promise.race([both.promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Pair not started')),3000);t.unref();})]);
  if(scenario==='owner')c.setMockAuth({id:foreignOwner},{access_token:'synthetic-other',expires_at:9999999999,user:{id:foreignOwner}});
  else runtimeOfflineLease().invalidate('synthetic-pair-retirement');held.resolve();
 }
 await running;
 const outbox=await d.getAll('outbox');
 if(['owner','lease'].includes(scenario)){
  assert.equal(studentStarts,2);for(const original of originals)assert.ok(outbox.some(r=>r.mutationId===original.mutationId));
  assert.equal(outbox.find(r=>r.id===originals[2].id).attemptCount,0);
 }else{
  if(scenario==='same-id'){assert.equal(events[0].active,1);assert.ok(events.findIndex(e=>e.finish===1)<events.findIndex(e=>e.start===2),'First same-ID chain excluded from pair');}
  else assert.equal(maxActive,2);
  if(scenario==='order')assert.ok(events.findIndex(e=>e.finish===2)<events.findIndex(e=>e.finish===1));
  if(scenario==='lost'){
   assert.ok(outbox.some(r=>r.mutationId===originals[0].mutationId));assert.ok(!outbox.some(r=>r.mutationId===originals[1].mutationId));
   await sync.syncAll({full:false});const replay=sends.filter(e=>e.p_mutation_id===originals[0].mutationId);assert.equal(replay.length,2);assert.deepEqual(replay[0],replay[1]);
  }
  const final=await d.getAll('outbox');for(const original of originals)assert.ok(!final.some(r=>r.mutationId===original.mutationId));
  assert.equal(canonical.students.filter(r=>imported.students.some(s=>s.id===r.id)).length,3);
 }
 report.checks.push({name:'changed_pair_boundary',status:'PASS'});report.maxInFlight=maxActive;report.events=events;console.log(JSON.stringify(report));
}catch(error){report.failures.push(error.stack);console.error(error);process.exitCode=1;}
finally{held.resolve();await sync.suspendForWorkspaceDeactivation();s.deactivateWorkspace();c.setMockAuth(null,null);globalThis.fetch=originalFetch;await writeFile('tests/n107-independent-create-20261020/'+scenario+'.json',JSON.stringify(report,null,2));}
