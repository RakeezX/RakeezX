// AI: actual store entry, coordinator/default RPC, owned fake-IDB; every fetch intercepted.
import 'fake-indexeddb/auto';
import {IDBDatabase} from 'fake-indexeddb';
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

const baseline=process.argv.includes('--baseline'),scenario=process.argv.find(a=>a.startsWith('--scenario='))?.split('=')[1]??'owner401',observations=[];let mode,arrived,release,mutations=[],canonical,receipts=new Map();
const originalFetch=globalThis.fetch;
const originalTransaction=IDBDatabase.prototype.transaction;let receiptReady=false,atomicRetired=false;
IDBDatabase.prototype.transaction=function(names,...args){
 if(scenario==='atomic'&&receiptReady&&!atomicRetired&&Array.from(names).length>20&&Array.from(names).includes('outbox')){
  atomicRetired=true;c.setMockAuth({id:foreignOwner},{access_token:'synthetic-other',expires_at:9999999999,user:{id:foreignOwner}});
 }
 return originalTransaction.call(this,names,...args);
};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const wire=(name,r)=>({...encodeSyncV2Patch(name,r),id:r.id,owner_id:owner,revision:r.serverRevision,deleted_at:null});
globalThis.fetch=async(url,options={})=>{
 const path=new URL(url).pathname;const input=JSON.parse(options.body??'{}');
 if(path==='/auth/v1/token')return response({access_token:'synthetic-refreshed',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{id:owner}});
 if(path.endsWith('/score_foundation_capability')||path.endsWith('/n71_restore_capability'))return response({});
 if(path.endsWith('/apply_sync_v2_mutation')){
  mutations.push(input);if(input.p_entity==='students'&&mutations.filter(e=>e.p_entity==='students').length===1){arrived.resolve();await release.promise;if(mode==='owner401'||mode==='refresh')return response({},401);}
  if(receipts.has(input.p_mutation_id))return response(receipts.get(input.p_mutation_id));
  const name=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===input.p_entity);
  const row={...input.p_patch,id:input.p_record_id,owner_id:owner,revision:1,deleted_at:null};
  const receipt={mutationId:input.p_mutation_id,outcome:'applied',canonicalId:row.id,resultRevision:1,canonical:row};receipts.set(input.p_mutation_id,receipt);
  // Canonical service projection needed by the unchanged post-pull.
  canonical[name]??=[];canonical[name].push({...row,...Object.fromEntries(Object.entries(SYNC_V2_SCHEMAS[name].fields).map(([k,v])=>[k,row[v]])),serverRevision:1});
  receiptReady=true;
  if(mode==='lost'&&mutations.filter(e=>e.p_entity==='students').length===1)throw new TypeError('Synthetic lost response after commit');
  return response(receipt);
 }
 if(path.includes('/rpc/'))throw Error('Unexpected synthetic RPC '+path);
 const entity=path.split('/').at(-1),name=Object.keys(SYNC_V2_SCHEMAS).find(n=>SYNC_V2_SCHEMAS[n].entity===entity);
 assert.ok(name,'Only expected existing table reads');const rows=(c.user?.id===owner?canonical[name]??[]:[]).map(r=>wire(name,r));return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','content-range':rows.length?'0-'+(rows.length-1)+'/'+rows.length:'*/0'}});
};
async function runOwnerRetirement(){
 await prepare();c.setMockBackend(null);canonical=fixture();mode=scenario;mutations=[];receipts=new Map();arrived=Promise.withResolvers();release=Promise.withResolvers();
 const imported=await s.importStudents('n73-source-section',['Synthetic new'],{verifyCurrent:()=>s.assertClassImportAccess()});
 const studentId=imported.students[0].id;const original=(await d.getAll('outbox')).find(r=>r.store==='students');
 const running=sync.syncAll({full:false});await Promise.race([arrived.promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Bounded fixture arrival timeout')),4000);timer.unref();})]);
 if(scenario==='owner401'||scenario==='ownerack')c.setMockAuth({id:foreignOwner},{access_token:'synthetic-other',refresh_token:'synthetic-other-refresh',expires_at:9999999999,user:{id:foreignOwner}});
 if(scenario==='session'){const session=c.session;c.setMockAuth(null,null);c.setMockAuth(session.user,session);}
 if(scenario==='lease')runtimeOfflineLease().invalidate('synthetic-retirement');
 if(scenario==='workspace'){
  s.deactivateWorkspace();const receipt={ownerId:foreignOwner,contractVersion:1,foundationHash:'synthetic-foreign'};
  c.setMockAuth({id:foreignOwner},{access_token:'synthetic-other',expires_at:9999999999,user:{id:foreignOwner}});
  localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(c.session));
  s.activateWorkspace({id:'account:foreign',type:'account',authUserId:foreignOwner,ownershipState:'claimed',syncEligible:true,databaseName:await accountWorkspaceDatabaseName(foreignOwner),broadcastChannelName:'n107-foreign',workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([foreignOwner,null,null,receipt])});
  await d.clearAll();await d.put('device',{id:'device',accountProvisioningReceipt:receipt});
  await runtimeOfflineLease().renew(async()=>({id:foreignOwner,source:'supabase-auth-user',verifiedAt:Date.now()}));await d.put('outbox',{id:original.id,mutationId:original.mutationId,protocol:'synthetic-sentinel',untouched:true});
 }
 release.resolve();const completed=await running;
 if(scenario==='workspace'){
  assert.equal((await d.get('outbox',original.id)).untouched,true);assert.equal(await d.get('students',studentId),undefined);
  s.deactivateWorkspace();d.selectDatabase(await accountWorkspaceDatabaseName(owner));
 }
 let student=await d.get('students',studentId),remaining=(await d.getAll('outbox')).find(r=>r.mutationId===original.mutationId);
 const actual={studentRequests:mutations.filter(r=>r.p_entity==='students').length,adopted:Number(student.serverRevision)>0,envelopeRetained:!!remaining};
 if(!baseline){
  if(scenario==='atomic')assert.equal(atomicRetired,true);
  if(['normal','refresh'].includes(scenario)){assert.equal(completed,true);assert.equal(actual.adopted,true);assert.equal(actual.envelopeRetained,false);assert.equal(actual.studentRequests,scenario==='refresh'?2:1);}
  else {assert.equal(actual.studentRequests,1);assert.equal(actual.adopted,false);assert.equal(actual.envelopeRetained,true);assert.equal(remaining.mutationId,original.mutationId);assert.equal(remaining.envelopeLocked,true);}
  if(scenario==='lost'){
   await sync.syncAll({full:false});const sends=mutations.filter(e=>e.p_entity==='students');assert.equal(sends.length,2);assert.equal(sends[0].p_mutation_id,sends[1].p_mutation_id);assert.deepEqual(sends[0],sends[1]);
   assert.equal((await d.getAll('outbox')).some(r=>r.mutationId===original.mutationId),false);assert.equal((await d.get('students',studentId)).serverRevision,1);actual.sameEnvelopeRecovered=true;
  }
 }

 observations.push({name:'actual_store_coordinator_'+scenario,...actual});
}
try{await runOwnerRetirement();console.log(JSON.stringify(observations));}
catch(error){console.error(error);process.exitCode=1;observations.push({failure:error.stack});}
finally{release?.resolve();await sync.suspendForWorkspaceDeactivation();s.deactivateWorkspace();c.setMockAuth(null,null);globalThis.fetch=originalFetch;IDBDatabase.prototype.transaction=originalTransaction;await writeFile('tests/n107-owned-context-20261020/'+(baseline?'baseline':scenario)+'.json',JSON.stringify(observations,null,2));}
