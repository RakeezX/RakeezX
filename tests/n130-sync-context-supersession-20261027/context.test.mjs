// AI-authored N130: real coordinator/engine/owner guard, synthetic transport only.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as sync from '../../src/lib/sync.js';
import * as cloud from '../../src/lib/cloud.js';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import {authenticate,renew} from '../n107-focus-sync-stability-20261020/authenticated-fixture.mjs';
import {GenericV2Backend} from '../helpers/generic-v2-backend.mjs';
import {activateSyntheticAccountWorkspace,SYNTHETIC_WORKSPACE_OWNER as owner} from '../helpers/synthetic-workspace.mjs';
const foreign='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
globalThis.document={visibilityState:'visible',addEventListener(){},documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
globalThis.matchMedia=()=>({matches:false});
globalThis.fetch=()=>{throw Error('Real network forbidden');};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
after(async()=>{await sync.suspendForWorkspaceDeactivation();cloud.setMockAuth(null,null);cloud.setMockBackend(null);store.closeChannel();db.closeDB();});

test('N130 guarded coordinator supersession, durable truth and fresh success',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 authenticate(owner);await activateSyntheticAccountWorkspace();await db.clearAll();await store.init();await renew(owner);await db.clearStore('outbox');
 // The initialized profile is already canonical in this fabricated account.
 await db.put('profile',{...store.state.profile,serverRevision:1});
 let onMarker=null,onRead=null,markerCount=0,reads=0,sends=0;
 const backend={fetchRecords:async()=>{reads++;if(onRead)await onRead();return [];},
  fetchOwnerSyncMarker:async()=>{markerCount++;if(onMarker)await onMarker();return {protocol:'OWNER_SIGNAL_V1',ownerId:cloud.user?.id,revision:'10'};},
  getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null,
  applySyncV2Mutation:async()=>{sends++;throw Error('No mutation authorized in clean fixture');}};
 cloud.setMockBackend(backend);sync.init();await new Promise(r=>setImmediate(r));
 const summary=()=>sync.getSyncOperationalSummarySnapshot();
 await t.test('same owner session renewal ends old run without success then exactly one fresh full pass',async()=>{
  assert.equal(await sync.syncAll(),true);const before=sync.state.lastSyncedAt;
  let renewed=false;
  onMarker=()=>{if(markerCount>0&&reads>0&&!renewed){renewed=true;cloud.setMockAuth(cloud.user,{...cloud.session});}};
  // Select final validation (capture occurs before the first read).
  reads=0;markerCount=0;
  assert.equal(await sync.syncAll(),false);assert.equal(renewed,true);
  assert.equal(sync.state.lastSyncedAt,before);assert.equal(summary().state,'pending');assert.equal(summary().presentationSeverity.hardFailure,false);assert.equal(sends,0);
  onMarker=null;reads=0;markerCount=0;
  t.mock.timers.tick(325);await new Promise(r=>setTimeoutUnmocked(r));
  for(let i=0;i<500&&summary().automaticSyncActive;i++)await new Promise(r=>setImmediate(r));
  assert.equal(summary().automaticSyncActive,false);
  assert.equal(summary().state,'synced');assert.equal(summary().lastSafeFailure,null);assert.equal(markerCount,2,'one capture + one validation, exactly one fresh pass');
 });
 await t.test('changed token is supersession only with current proven owner',async()=>{
  reads=0;let changed=false;onMarker=()=>{if(reads&&!changed){changed=true;authenticate(owner,'renewed-token');}};
  assert.equal(await sync.syncAll(),false);assert.equal(summary().state,'pending');assert.equal(summary().presentationSeverity.hardFailure,false);
  onMarker=null;await renew(owner);assert.equal(await sync.syncAll(),true);
 });
 await t.test('in-place token change cannot slip through object identity fencing',async()=>{
  reads=0;let changed=false;onMarker=()=>{if(reads&&!changed){changed=true;cloud.session.access_token='synthetic-in-place';}};
  const before=sync.state.lastSyncedAt;assert.equal(await sync.syncAll(),false);assert.equal(summary().state,'pending');assert.equal(sync.state.lastSyncedAt,before);
  onMarker=null;authenticate(owner);await renew(owner);await store.patchDevice({}, {queue:false});await new Promise(r=>setImmediate(r));assert.equal(await sync.syncAll(),true);
 });
 await t.test('real 403/401/marker errors never become harmless supersession',async()=>{
  for(const error of [Object.assign(Error('Denied'),{status:403}),Object.assign(Error('Sign in'),{code:'AUTH_REQUIRED',status:401}),Object.assign(Error('Regressed'),{code:'REMOTE_REVISION_REGRESSED'})]){
   onRead=()=>{throw error;};assert.equal(await sync.syncAll(),false);
   const s=summary();assert.ok(['error','auth_required'].includes(s.state));assert.ok(s.lastSafeFailure);
   onRead=null;assert.equal(await sync.syncAll(),true);assert.equal(summary().lastSafeFailure,null);
  }
 });
 await t.test('full success cannot mask durable failed rejected or blocked outbox; conflicts are history',async()=>{
  for(const state of ['failed','rejected','blocked']){
   const handle=await db.openDB();await new Promise((ok,fail)=>{const tx=handle.transaction('outbox','readwrite');tx.objectStore('outbox').put({id:'n130-'+state,protocol:'v2',state,store:'students',recordId:'missing-synthetic',sequence:1,ownerId:owner});tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);});
   const s=await sync.getSyncOperationalSummary();assert.ok(s[state+'Count']>0);assert.notEqual(s.state,'synced');await db.clearStore('outbox');
  }
  assert.equal(await sync.syncAll(),true);
 });
 await t.test('a hard diagnostic survives supersession and a partial pass until matching full success',async()=>{
  onRead=()=>{throw Object.assign(Error('Denied'),{status:403});};assert.equal(await sync.syncAll(),false);
  const diagnostic=summary().lastSafeFailure;onRead=null;
  assert.equal(await sync.syncAll({full:false}),true);assert.deepEqual(summary().lastSafeFailure,diagnostic);
  onRead=()=>{throw Object.assign(Error('Denied'),{status:403});};assert.equal(await sync.syncAll(),false);onRead=null;
  const latestDiagnostic=summary().lastSafeFailure;
  reads=0;let changed=false;onMarker=()=>{if(reads&&!changed){changed=true;cloud.setMockAuth(cloud.user,{...cloud.session});}};
  assert.equal(await sync.syncAll(),false);assert.deepEqual(summary().lastSafeFailure,latestDiagnostic);assert.equal(summary().state,'error');
  onMarker=null;
  assert.equal(await sync.syncAll(),true);assert.equal(summary().lastSafeFailure,null);
 });
 await t.test('logout and owner switch during read do not dispatch or certify',async()=>{
  for(const action of [()=>cloud.setMockAuth(null,null),()=>authenticate(foreign)]){
   let once=false;onRead=()=>{if(!once){once=true;action();}};const before=sync.state.lastSyncedAt;
   assert.equal(await sync.syncAll(),false);assert.equal(sync.state.lastSyncedAt,before);assert.equal(sends,0);assert.notEqual(summary().state,'synced');
   onRead=null;authenticate(owner);await renew(owner);await store.patchDevice({}, {queue:false});await new Promise(r=>setImmediate(r));assert.equal(await sync.syncAll(),true);
  }
 });
 await t.test('uncertain receipt on changed auth retains same envelope and cannot ACK or duplicate a commit',async()=>{
  const server=new GenericV2Backend(),receipts=new Map(),ids=[];let commits=0,acks=0,first=true;
  const unsubscribe=sync.subscribeAcknowledged(()=>acks++);
  backend.fetchRecords=entity=>server.fetchRecords(entity);
  backend.applySyncV2Mutation=async envelope=>{
   ids.push(envelope.mutationId);
   if(!receipts.has(envelope.mutationId)){receipts.set(envelope.mutationId,await server.applySyncV2Mutation(envelope));commits++;}
   if(first){first=false;authenticate(owner,'synthetic-during-send');throw new TypeError('Failed to fetch');}
   return receipts.get(envelope.mutationId);
  };
  await store.patchProfile({teacherName:'N130 synthetic only'});
  const queued=await db.getAll('outbox');assert.equal(queued.length,1);
  const before=sync.state.lastSyncedAt;assert.equal(await sync.syncAll(),false);
  assert.equal(acks,0);assert.equal(commits,1);assert.equal(ids.length,1);assert.equal(sync.state.lastSyncedAt,before);
  assert.equal((await db.getAll('outbox'))[0].mutationId,queued[0].mutationId);
  assert.notEqual(summary().state,'synced');
  await renew(owner);await store.patchDevice({}, {queue:false});await new Promise(r=>setImmediate(r));
  assert.equal(await sync.syncAll(),true);assert.equal(commits,1);assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(acks,1);assert.equal((await db.getAll('outbox')).length,0);
  unsubscribe();
 });
});
function setTimeoutUnmocked(resolve){setImmediate(resolve);}
