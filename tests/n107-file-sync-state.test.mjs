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
const checkpoint=async()=>JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));
after(()=>{s.closeChannel();d.closeDB();});
test('local continuation is owner/database bound, durable and cannot replace or erase another teaching draft',async()=>{
 await prepare();const baseline=JSON.stringify(await d.getAll('outbox'));
 const value={version:1,ownerId:owner,databaseName:s.getActiveWorkspace().databaseName,created:{teachingId:'one'},input:'fabricated-only'};
 await s.saveClassFileImportContinuation(value);
 assert.deepEqual((await d.get('device','device')).classFileImportContinuation,value);
 assert.equal(JSON.stringify(await d.getAll('outbox')),baseline);
 await assert.rejects(s.saveClassFileImportContinuation({...value,ownerId:foreignOwner}));
 await assert.rejects(s.saveClassFileImportContinuation({...value,databaseName:'foreign'}));
 await assert.rejects(s.saveClassFileImportContinuation({...value,created:{teachingId:'two'}}));
 await assert.rejects(s.saveClassFileImportContinuation(null,{expectedTeachingId:'two'}));
 assert.deepEqual((await d.get('device','device')).classFileImportContinuation,value);
 await s.saveClassFileImportContinuation(null,{expectedTeachingId:'one'});
 assert.equal((await d.get('device','device')).classFileImportContinuation,null);
 assert.equal(JSON.stringify(await d.getAll('outbox')),baseline);
});
test('continuation rechecks foreground/session in the actual durable transaction',async()=>{
 await prepare();const before=await d.get('device','device');
 const value={version:1,ownerId:owner,databaseName:s.getActiveWorkspace().databaseName,created:{teachingId:'one'}};
 await assert.rejects(s.saveClassFileImportContinuation(value,{verifyCurrent(){c.setMockAuth(c.user,{...c.session});}}));
 assert.deepEqual(await d.get('device','device'),before);
 await assert.rejects(s.saveClassFileImportContinuation(value,{verifyCurrent(){throw Error('expired or cancelled review');}}));
 assert.deepEqual(await d.get('device','device'),before);
});
test('canonical metadata can change during creation but persisted foreign parent still rejects',async()=>{
 await prepare();let review=s.reviewClassImport(group());
 // These are synthetic cache snapshots, not acknowledgments or server revisions.
 for(const name of ['years','terms']){
  const row=s.state[name][0],next={...row,canonicalId:row.id,serverCanonical:{id:row.id},fieldRevisions:{label:1}};
  s.state[name][0]=next;await d.put(name,next);
 }
 assert.equal((await s.confirmClassImport(review,true)).added,1);
 await prepare();review=s.reviewClassImport(group());
 await d.put('years',{...s.state.years[0],ownerId:foreignOwner});
 const before=await checkpoint();await assert.rejects(s.confirmClassImport(review,true));
 assert.equal(await checkpoint(),before);
});
