// AI: actual account store + fake IndexedDB; no service, credentials or real data.
import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/store.js';
import * as d from '../src/lib/db.js';
import * as c from '../src/lib/cloud.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { accountWorkspaceDatabaseName } from '../src/lib/workspaces.js';
import { fixture, owner, foreignOwner } from './n73-account-flow-fixture.mjs';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
const storage = new Map();
global.localStorage = { getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;} };
async function prepare() {
  s.state.ready=false;s.closeChannel();d.closeDB();storage.clear();
  const rows=fixture(),receipt={ownerId:owner,contractVersion:1,foundationHash:'n107-synthetic'};
  rows.device[0].accountProvisioningReceipt=receipt;
  const session={access_token:'synthetic-only',user:{id:owner}};
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

after(()=>{s.closeChannel();d.closeDB();});
// Persisted historical fixtures intentionally model the pre-fix snapshot disposition.
async function pendingFixture({locked=false,drift=false}={}){
 await prepare();const item=s.state.items.find(i=>i.id==='n73-source-exam');item.max=10;await d.put('items',item);
 // Keep grades below10 so this fixture tests recovery, not lower-max policy.
 s.state.scores=s.state.scores.map(r=>r.itemId===item.id?{...r,value:5}:r);await d.putMany('scores',s.state.scores);
 const input={rows:[['اسم الطالب','Exam (العظمى 20)'],['Synthetic 2','0']],nameColumn:0,idColumn:-1,mappings:[{kind:'ignore'},{kind:'existing',itemId:item.id,fileMax:20}]};
 const review=s.reviewGradeImport('n73-source',input),stage={...review.maxChanges[0],mutationId:'n107-1019-original'};
 const value={version:1,ownerId:owner,databaseName:s.getActiveWorkspace().databaseName,created:{teachingId:'n73-source',existing:true},input:JSON.stringify(input),maximumReview:review,maxProgress:[stage]};
 await s.saveClassFileImportContinuation(value);
 await d.put('outbox',{id:'v2:'+stage.mutationId,mutationId:stage.mutationId,protocol:'v2',deviceId:'synthetic',importMaximum:true,ownerId:owner,store:'items',entity:'items',recordId:item.id,serverRecordId:item.id,canonicalId:item.id,logicalRecordKey:'items:'+item.id,op:'patch',baseRevision:1,patch:{max:20},localPatch:{max:20},fields:['max'],groups:[],dependencies:[],sequence:1,state:'blocked',envelopeLocked:locked,attemptCount:locked?1:0});
 if(drift){await d.put('items',{...item,name:'Unrelated edit'});s.state.items.find(i=>i.id===item.id).name='Unrelated edit';}
 return {review,stage,item};
}
test('persisted erased max overlay recovers through original store command and genuine receipt, same identity',async()=>{
 const {review,stage,item}=await pendingFixture({locked:true});const {encodeSyncV2Patch}=await import('../src/lib/sync-v2.js');let sent=[];
 c.setMockBackend({applySyncV2Mutation:async e=>{sent.push(e);const canonical={...item,max:20,serverRevision:2};return {mutationId:e.mutationId,outcome:'applied',canonicalId:item.id,resultRevision:2,canonical:{...encodeSyncV2Patch('items',canonical),id:item.id,owner_id:owner,revision:2,deleted_at:null}};}});
 const grades=JSON.stringify(await d.getAll('scores'));await s.confirmImportMaximums(review);
 assert.deepEqual(sent.map(e=>e.mutationId),[stage.mutationId]);assert.equal((await d.get('items',item.id)).max,20);assert.equal((await d.get('items',item.id)).importMaximumReceipt.revision,2);assert.equal(JSON.stringify(await d.getAll('scores')),grades);
 s.assertImportMaximumReviewCurrent(review);assert.equal((await d.getAll('outbox')).length,0);
});
test('unattempted cancellation retires only its own command with audit and preserves grades',async()=>{
 for(const max of [10,20]){
 const {stage,item}=await pendingFixture();await d.put('items',{...item,max});const grades=JSON.stringify(await d.getAll('scores'));
 await s.cancelClassFileImportContinuation('n73-source');assert.equal((await d.get('items',item.id)).max,10);assert.equal((await d.get('outbox','v2:'+stage.mutationId)).state,'superseded');assert.equal((await d.get('device','device')).classFileImportContinuation,null);assert.equal(JSON.stringify(await d.getAll('scores')),grades);
 }
});
test('legacy recovery refuses unrelated item/owner drift, retains original request and grade marks',async()=>{
 const {review,stage}=await pendingFixture({locked:true,drift:true});let sent=0;c.setMockBackend({applySyncV2Mutation:async()=>{sent++;throw Error('Must not send');}});
 await assert.rejects(s.confirmImportMaximums(review),/IMPORT_CHANGED/);assert.equal(sent,0);await assert.rejects(s.cancelClassFileImportContinuation('n73-source'));assert.equal((await d.get('outbox','v2:'+stage.mutationId)).state,'blocked');
 c.setMockAuth({id:foreignOwner},{access_token:'synthetic',user:{id:foreignOwner}});await assert.rejects(s.cancelClassFileImportContinuation('n73-source'));assert.ok((await d.get('device','device')).classFileImportContinuation);
});
test('cancellation winning the atomic send lock cannot resurrect or dispatch a retired maximum',async()=>{
 const {stage,item}=await pendingFixture();await d.put('items',{...item,max:20});let sent=0,intercepted=false;
 const database={...d,async applyBatch(batch,options){
   if(batch.years && batch.teachings && !intercepted){intercepted=true;await s.cancelClassFileImportContinuation('n73-source');}
   return d.applyBatch(batch,options);
 }};
 const engine=createSyncV2Engine({database,ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>c.user?.id,transport:{applyMutation:async()=>{sent++;throw Error('Retired command must not send');}}});
 await engine.dispatchPending({onlyMutationId:stage.mutationId});assert.equal(intercepted,true);assert.equal(sent,0);assert.equal((await d.get('outbox','v2:'+stage.mutationId)).state,'superseded');
});
