import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { buildBackup, DEVICE_ONLY_STORES, validateBackupIntegrity } from '../src/lib/export.js';
import { SYNC_V2_SCHEMAS, SYNC_V2_STORES, createSyncV2Engine } from '../src/lib/sync-v2.js';
import { PORTABLE_CLOUD_RESTORE_STORES, planCloudRestore, reconcileCanonicalRestore, restoreBackupToCloud, resumeCloudRestore, getCloudRestoreResumeState } from '../src/lib/backup-v2.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import { filterCoreRestoreManifest, manifestForCanonicalSnapshot, SCORE_RESTORE_PROTOCOL } from '../src/lib/initial-restore.js';
globalThis.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector(){return null;}};
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
globalThis.matchMedia=()=>({matches:false});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
const OWNER='11111111-1111-4111-8111-111111111111';
after(()=>{db.closeDB();store.closeChannel();});
test('every portable store has the same manifest/stage/finalize/reconcile/ordinary-Sync domain; interrupted stage resumes exact intent',async()=>{
  cloud.setMockAuth({id:OWNER},{access_token:'synthetic',user:{id:OWNER}});
  localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(cloud.session));
  await activateSyntheticAccountWorkspace({ownerId:OWNER});await store.init();
  const lease=runtimeOfflineLease();lease.setContext(store.getActiveWorkspace(),OWNER);
  await lease.renew(async()=>({id:OWNER,source:'supabase-auth-user',verifiedAt:Date.now()}));
  const portable=db.STORES.filter(name=>!DEVICE_ONLY_STORES.includes(name));
  assert.deepEqual([...PORTABLE_CLOUD_RESTORE_STORES].sort(),[...portable].sort());
  assert.deepEqual([...SYNC_V2_STORES].sort(),[...portable].sort());
  const rows={units:[{id:'unit',subjectId:'subject',grade:5,termIndex:1,name:'Unit'}],lessons:[{id:'lesson',unitId:'unit',name:'Lesson'}],
    years:[{id:'year',status:'active'}],terms:[{id:'term',yearId:'year',status:'active'}],subjects:[{id:'subject'}],
    sections:[{id:'section',yearId:'year'}],teachings:[{id:'teaching',sectionId:'section',subjectId:'subject',termId:'term'}],students:[{id:'student'}],
    assignments:[{id:'assignment',teachingId:'teaching',lessonId:'lesson',title:'Assignment',assignedDate:'2026-10-12',max:10}],
    submissions:[{id:'submission',assignmentId:'assignment',studentId:'student',status:'submitted',score:7}]};
  for(const [name,data]of Object.entries(rows))await db.putMany(name,data);
  const payload=await buildBackup({sourceOwnerId:OWNER});
  const server=Object.fromEntries(portable.map(name=>[name,[]]));
  const plan=planCloudRestore(payload,server,{ownerId:OWNER,ownerHistoryRevision:'0'});assert.equal(plan.ready,true,JSON.stringify(plan.entries.filter(e=>e.classification==='INVALID')));
  for(const name of Object.keys(rows))assert.ok(plan.operations.some(op=>op.entity===SYNC_V2_SCHEMAS[name].entity));
  const calls=[];let staged=null;
  const transport={async stageUnifiedRestore(envelope){calls.push(structuredClone(envelope));
    if(!staged){staged={restoreId:envelope.restoreId,backupHash:envelope.backupHash,stageHash:'synthetic-stage'};throw Error('Synthetic lost stage response');}return staged;},
    async finalizeUnifiedRestore(envelope){return {restoreId:envelope.restoreId,backupHash:envelope.backupHash,stageHash:envelope.expectedStageHash,receipt:{restoreId:envelope.restoreId,status:'finalized'},canonical:{}};}};
  const coordinator={async assertCloudRestoreReady(){},async runCloudRestoreExclusive(fn){return fn();}};
  const ownerVerifier=async()=>OWNER,historyFetcher=async()=>({ownerId:OWNER,revision:'0'});
  await assert.rejects(restoreBackupToCloud(payload,{restoreId:'synthetic-restore',transport,coordinator,ownerVerifier,historyFetcher,sourceFetcher:async()=>server}),/lost stage/);
  assert.equal((await getCloudRestoreResumeState()).state,'staging');
  assert.equal(await sync.syncAll(),false,'ordinary Sync cannot reconcile an ambiguous restore');
  await assert.rejects(restoreBackupToCloud(payload,{transport,coordinator}),{code:'CLOUD_RESTORE_RESUME_REQUIRED'});
  const canonical=Object.fromEntries(portable.map(name=>[SYNC_V2_SCHEMAS[name].entity,[]]));
  for(const [name,data]of Object.entries(rows))canonical[SYNC_V2_SCHEMAS[name].entity]=data.map(row=>({id:row.id,owner_id:OWNER,revision:1,deleted_at:null,
    ...Object.fromEntries(Object.entries(SYNC_V2_SCHEMAS[name].fields).filter(([field])=>field in row).map(([field,column])=>[column,row[field]]))}));
  await resumeCloudRestore({transport,coordinator,ownerVerifier,canonicalFetcher:async()=>canonical,
    reconciler:(payload,rows,options)=>reconcileCanonicalRestore(payload,rows,{...options,verifyOwner:ownerVerifier})});
  assert.deepEqual(calls[0],calls[1]);assert.equal(await getCloudRestoreResumeState(),null);
  for(const name of Object.keys(rows))assert.equal((await db.getAll(name)).length,1);
  const immediateExport=await buildBackup({sourceOwnerId:OWNER});
  assert.equal((await validateBackupIntegrity(immediateExport)).ok,true,'Canonical reconcile must export a valid V5 backup before another ordinary Sync');
  for(const name of Object.keys(rows))assert.ok(immediateExport.baselines[name][0].value);
  const manifest=filterCoreRestoreManifest([...Object.entries(canonical).flatMap(([entity,list])=>list.map(row=>({entity,id:row.id,revision:1,deleted:false}))),{entity:'__n71__',id:'N71_V1',revision:1,deleted:false}],{protocol:SCORE_RESTORE_PROTOCOL,portable:true});
  assert.deepEqual(manifest,manifestForCanonicalSnapshot(Object.fromEntries(await Promise.all(portable.map(async name=>[name,await db.getAll(name)]))),{protocol:SCORE_RESTORE_PROTOCOL,portable:true}));
  const reads=[];const engine=createSyncV2Engine({transport:{async fetchRecords(entity){reads.push(entity);return canonical[entity];}}});
  const pulled=await engine.pullAll({stores:Object.keys(rows)});assert.deepEqual(pulled.failures,[]);
  assert.deepEqual(reads.sort(),Object.keys(rows).map(name=>SYNC_V2_SCHEMAS[name].entity).sort());
});

test('deleted parent and immutable closed-term scopes suppress backup-only descendants',()=>{
  const base={version:5,sourceOwnerId:OWNER,data:{teachings:[{id:'teaching',termId:'term',sectionId:'section',subjectId:'subject'}],
    assignments:[{id:'a',teachingId:'teaching'}],submissions:[{id:'s',assignmentId:'a',studentId:'student'}]},baselines:{}};
  for(const changes of [{terms:[{id:'term',status:'closed'}]},{sections:[{id:'section',deleted:true}]}]){
    const canonical={...Object.fromEntries(PORTABLE_CLOUD_RESTORE_STORES.map(name=>[name,[]])),
      sections:[{id:'section'}],subjects:[{id:'subject'}],terms:[{id:'term',status:'active'}],...changes};
    const plan=planCloudRestore(base,canonical,{ownerId:OWNER,ownerHistoryRevision:'1'});
    assert.equal(plan.operations.length,0);assert.equal(plan.ready,true);
    assert.ok(plan.entries.filter(row=>['a','s','teaching'].includes(row.id)).every(row=>row.classification==='KEEP_SERVER'));
  }
});
