// AI: focused provenance branches; real DOM entry coverage is in the browser check.
import 'fake-indexeddb/auto';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/store.js';
import * as d from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import {runtimeOfflineLease} from '../src/lib/offline-lease.js';
import {fixture,owner,foreignOwner} from './n73-account-flow-fixture.mjs';
import {accountWorkspaceDatabaseName,createWorkspaceRegistry} from '../src/lib/workspaces.js';
import {resolveWorkspaceForBoot} from '../src/lib/workspace-routing.js';
const storage=new Map();
global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;}};
async function context(kind) {
 s.state.ready=false;s.closeChannel();d.closeDB();storage.clear();
 const rows=fixture();for(const [key,value]of Object.entries(rows))s.state[key]=key==='device'||key==='profile'?value[0]:value;
 const claim=kind==='claim'?'n104-claim':null;
 const restore=kind==='restore'?{ownerId:owner,protocol:'CORE_V2',restoreId:'n104-restore',manifestHash:'n104-manifest',completedAt:1}:null;
 const provision=kind==='provision'?{ownerId:owner,contractVersion:1,foundationHash:'n104-foundation'}:null;
 let workspace={id:'account:n104',type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true,
  databaseName:kind==='claim'?'rakeezx':await accountWorkspaceDatabaseName(owner),broadcastChannelName:'n104-unit',
  leaseGeneration:JSON.stringify([1,claim,restore,provision]),
  ...(claim?{workspaceKind:'legacy-in-place',claimId:claim}:provision?{workspaceKind:'account-provisioned'}:{})};
 s.state.device.workspaceClaim=claim?{version:1,state:'claimed',claimId:claim,ownerId:owner,databaseName:workspace.databaseName}:null;
 s.state.device.initialRestoreReceipt=restore;s.state.device.accountProvisioningReceipt=provision;
 if(kind==='restore') {
  // Previous fixture incorrectly put the device receipt (with ownerId) in the
  // registry generation. Use the actual finalizer and boot metadata read instead.
  d.selectDatabase(workspace.databaseName);await d.put('device',s.state.device);
  const registry=createWorkspaceRegistry();
  try {
   await registry.beginAccountRestore(owner,restore);
   await registry.updateAccountRestore(owner,restore.restoreId,{phase:'RESTORE_COMPLETE'});
   const record=await registry.finalizeAccountRestore(owner,restore);
   assert.equal(Object.hasOwn(record.restoreReceipt,'ownerId'),false);
   const routing=await resolveWorkspaceForBoot({authUser:{id:owner},registry});
   assert.equal(routing.status,'ready',JSON.stringify(routing));assert.equal(routing.mode,'restored-account');
   workspace=routing.workspace;
  }finally{await registry.close();}
 }
 const session={access_token:'synthetic-only',user:{id:owner}};localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);
 s.activateWorkspace(workspace);await runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));s.state.ready=true;
 const teaching=s.getTeaching('n73-source');delete teaching.ownerId;return teaching;
}
after(()=>{s.closeChannel();d.closeDB();});
for(const kind of ['claim','restore','provision'])test('ownerless '+kind+' rows require exact local provenance; explicit conflicts always reject',async()=>{
 const teaching=await context(kind);assert.equal(s.assertClassOperationsAccess(teaching.id),teaching);
 teaching.ownerId=foreignOwner;assert.throws(()=>s.assertClassOperationsAccess(teaching.id));delete teaching.ownerId;
 if(kind==='claim')s.state.device.workspaceClaim.state='registry_pending';
 if(kind==='restore')s.state.device.initialRestoreReceipt.ownerId=foreignOwner;
 if(kind==='provision')s.state.device.accountProvisioningReceipt.ownerId=foreignOwner;
 assert.throws(()=>s.assertClassOperationsAccess(teaching.id));
});
test('an ownerless row in an account descriptor with no provenance is never authorized',async()=>{
 const teaching=await context('none');assert.throws(()=>s.assertClassOperationsAccess(teaching.id));
});
