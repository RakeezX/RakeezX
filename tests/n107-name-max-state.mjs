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
import { classGroups, detectClassColumns } from '../src/lib/class-import-file.js';
const storage = new Map();
global.localStorage = { getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;} };
const group = (label='أ', name='طالب اصطناعي', grade=4) => {
  const rows = [['الصف','الفصل','المادة','اسم الطالب'],[grade,label,'الرياضيات',name]];
  return classGroups(rows,detectClassColumns(rows))[0];
};
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
test('maximum continuation preserves immutable progress across stale same-plan saves and prevents cancellation orphaning pending/rejected commands',async()=>{
 await prepare();const value={version:1,ownerId:owner,databaseName:s.getActiveWorkspace().databaseName,created:{teachingId:'one'},input:'fabricated-plan',maximumReview:{teachingId:'one'},maxProgress:[{mutationId:'immutable'}]};
 await s.saveClassFileImportContinuation(value);
 const stale={...value};delete stale.maxProgress;await s.saveClassFileImportContinuation(stale);
 assert.deepEqual((await d.get('device','device')).classFileImportContinuation.maxProgress,value.maxProgress);
 await assert.rejects(s.saveClassFileImportContinuation({...stale,input:'different-plan'}),/CHANGED/);
 await d.put('outbox',{id:'v2:immutable',mutationId:'immutable',state:'failed',ownerId:owner});
 await assert.rejects(s.saveClassFileImportContinuation(null,{expectedTeachingId:'one'}),/المعلّق/);
 await d.put('outbox',{id:'v2:immutable',mutationId:'immutable',state:'rejected',ownerId:owner});
 await assert.rejects(s.saveClassFileImportContinuation(null,{expectedTeachingId:'one'}),/المعلّق/);
 assert.equal((await d.get('device','device')).classFileImportContinuation.maxProgress[0].mutationId,'immutable');
 await d.remove('outbox','v2:immutable');await s.saveClassFileImportContinuation(null,{expectedTeachingId:'one'});
 assert.equal((await d.get('device','device')).classFileImportContinuation,null);
});
test('preservation binding tolerates ordinary canonical metadata, but detects absent-student grade or revision changes',async()=>{
 const {importScoreBinding}=await import('../src/lib/grade-transfer.js');
 const row={id:'synthetic',itemId:'manual',studentId:'absent',value:0,serverRevision:2};
 const bind=importScoreBinding([row]);assert.equal(importScoreBinding([{...row,updatedAt:3,canonicalId:'synthetic',serverCanonical:row}]),bind);
 assert.notEqual(importScoreBinding([{...row,value:1}]),bind);assert.notEqual(importScoreBinding([{...row,serverRevision:3}]),bind);
});
