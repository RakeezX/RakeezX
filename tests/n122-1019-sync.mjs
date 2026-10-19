import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import { createSyncV2Engine, SYNC_V2_STORES } from '../src/lib/sync-v2.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { makeSlot, makeYear, makeTerm, makeSection, makeTeaching } from '../src/models.js';
import * as store from '../src/store.js';
import { GenericV2Backend } from './helpers/generic-v2-backend.mjs';
import { planCloudRestore } from '../src/lib/backup-v2.js';
const owner='a7300000-0000-4000-8000-000000000001';

test('N122: actual client refuses wrong ACK, retries same command, preserves canonical kind/term/tombstone',async()=>{
  const workspace={type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true,databaseName:'n122-test'};
  const guard=createSyncOwnershipGuard({workspace});
  const backend=new GenericV2Backend();let saved,wrongAck=true;
  const engine=createSyncV2Engine({database:db,ownershipGuard:guard,currentAuthenticatedUserId:()=>owner,
    transport:{fetchRecords:e=>backend.fetchRecords(e),async applyMutation(envelope){
      saved??=await backend.applySyncV2Mutation(envelope);
      return wrongAck?{...saved,mutationId:'n122-wrong-ack'}:saved;
    }}});
  try{
    await db.clearAll();
    await db.put('terms',{id:'n122-term',ownerId:owner,canonicalId:'n122-term',serverRevision:0,deleted:false});
    const slot=makeSlot({id:'n122-slot',kind:'activity',termId:'n122-term',teachingId:null,weekday:0,period:2});
    const committed=await engine.commitMutation({store:'slots',recordId:slot.id,op:'create',create:slot});
    assert.equal(committed.mutation.ownerId,owner);
    assert.ok(committed.mutation.dependencies.some(d=>d.store==='terms'&&d.recordId==='n122-term'));
    const blocked=await engine.dispatchPending();assert.equal(blocked.acknowledged,0);assert.equal(blocked.blocked,1);
    await db.put('terms',{id:'n122-term',ownerId:owner,canonicalId:'n122-term',serverRevision:1,deleted:false});
    const failed=await engine.dispatchPending();assert.equal(failed.acknowledged,0);
    assert.equal((await db.getAll('outbox')).length,1);assert.equal((await db.get('slots',slot.id)).serverRevision,0);
    assert.match((await db.getAll('outbox'))[0].lastError.message,/receipt mutationId mismatch/);
    assert.equal((await db.getAll('outbox'))[0].mutationId,committed.mutation.mutationId);
    wrongAck=false;
    const ack=await engine.dispatchPending();assert.equal(ack.acknowledged,1,JSON.stringify({ack,outbox:await db.getAll('outbox')}));
    assert.equal((await db.getAll('outbox')).length,0);
    const canonical=await db.get('slots',slot.id);assert.equal(canonical.kind,'activity');assert.equal(canonical.termId,'n122-term');
    const pulled={...saved.canonical,revision:2,deleted_at:'2027-05-02T00:00:00Z'};
    await engine.reconcilePull('slots',[pulled]);
    assert.equal((await db.get('slots',slot.id)).deleted,true);
    assert.equal((await db.get('slots',slot.id)).kind,'activity');
  }finally{await db.closeDB();}
});

test('N122: restore planner preserves new fields and authoritative tombstones; legacy defaults do not create edits',()=>{
  const empty=()=>Object.fromEntries(SYNC_V2_STORES.map(n=>[n,[]]));
  const slot=makeSlot({id:'n122-restore',teachingId:null,kind:'waiting',termId:'n122-term',weekday:1,period:3});
  const data={...empty(),slots:[slot],terms:[{id:'n122-term',deleted:false,status:'active'}]};
  const payload={version:5,sourceOwnerId:owner,data,baselines:{}};
  const initial=planCloudRestore(payload,empty(),{ownerId:owner,ownerHistoryRevision:'0'});
  const operation=initial.operations.find(o=>o.entity==='slots');
  assert.equal(operation.patch.kind,'waiting');assert.equal(operation.patch.term_id,'n122-term');assert.equal(operation.patch.teaching_id,null);
  const server={...empty(),slots:[{...slot,deleted:true,serverRevision:2}],terms:data.terms};
  const retained=planCloudRestore(payload,server,{ownerId:owner,ownerHistoryRevision:'1'});
  assert.equal(retained.operations.some(o=>o.entity==='slots'),false);
  assert.equal(retained.entries.find(e=>e.entity==='slots').classification,'KEEP_SERVER');
  assert.equal(retained.entries.find(e=>e.entity==='slots').reason,'server-tombstone');
  const academic={id:'n122-legacy',teachingId:'n122-tch',weekday:0,period:1,serverRevision:1};
  const legacyPayload={version:5,sourceOwnerId:owner,data:{...empty(),slots:[academic]},baselines:{slots:[{id:academic.id,value:academic}]}};
  const unchanged=planCloudRestore(legacyPayload,{...empty(),slots:[{...academic,kind:'teaching',termId:null}],teachings:[{id:'n122-tch'}]},{ownerId:owner,ownerHistoryRevision:'1'});
  assert.equal(unchanged.operations.some(o=>o.entity==='slots'),false);
});

test('N122: actual class-reopen guard reserves independent slots only in the relevant term',()=>{
  const names=['years','terms','sections','teachings','slots'];
  const previous=Object.fromEntries(names.map(n=>[n,store.state[n]]));
  try{
    store.state.years=[makeYear({id:'n122-y',status:'active'})];
    store.state.terms=[makeTerm({id:'n122-term',yearId:'n122-y',status:'active'})];
    store.state.sections=[makeSection({id:'n122-sec',yearId:'n122-y',status:'archived',archivedAt:'2027-05-01T00:00:00Z',archiveDate:'2027-05-01'})];
    store.state.teachings=[makeTeaching({id:'n122-tch',termId:'n122-term',sectionId:'n122-sec'})];
    store.state.slots=[makeSlot({id:'academic',teachingId:'n122-tch',weekday:0,period:1}),makeSlot({id:'activity',teachingId:null,kind:'activity',termId:'n122-term',weekday:0,period:1})];
    assert.deepEqual(store.validateSectionReopen('n122-sec'),{ok:false,reason:'slot-conflict',slotId:'academic'});
    store.state.slots[1]={...store.state.slots[1],termId:'other-term'};
    assert.deepEqual(store.validateSectionReopen('n122-sec'),{ok:true});
  }finally{Object.assign(store.state,previous);}
});
