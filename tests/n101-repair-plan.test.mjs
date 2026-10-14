// AI: focused planning/enqueue negative cases; native acceptance is in n101-repair-native.mjs.
import 'fake-indexeddb/auto';
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import {createSyncV2Engine} from '../src/lib/sync-v2.js';
import {createSyncOwnershipGuard} from '../src/lib/sync-ownership.js';
import {buildSessionRepairPlan,REPAIR_STORES} from '../src/lib/session-recovery.js';
const A='a5800000-0000-4000-8000-000000000001', B='b5800000-0000-4000-8000-000000000002';
const auth=x=>({...x,serverRevision:1,deleted:false});
function fixture(){
 const data=Object.fromEntries(REPAIR_STORES.map(s=>[s,[]]));
 data.years=[auth({id:'y',hijriStart:1448,hijriEnd:1449,label:'1448',calendarPresetId:'sa-western-1448-1449',fieldRevisions:{calendar_selection:3}})];
 data.terms=[auth({id:'term',yearId:'y',name:'term',startDate:'2026-08-01',endDate:'2026-12-31'})];
 data.sections=[auth({id:'section',yearId:'y',name:'class'})];data.subjects=[auth({id:'subject'})];
 data.teachings=[auth({id:'teaching',termId:'term',sectionId:'section',subjectId:'subject'})];
 data.sessions=[{id:'session',canonicalId:'session',teachingId:'teaching',date:'2026-10-14',period:1,status:'planned',serverRevision:0,deleted:false}];
 data.outbox=[{id:'v2:original',protocol:'v2',entity:'sessions',store:'sessions',recordId:'session',serverRecordId:'session',logicalRecordKey:'sessions:session',
  ownerId:A,mutationId:'original',deviceId:'synthetic',op:'create',state:'rejected',baseRevision:0,queuedAt:2,sequence:1,envelopeLocked:true,attemptCount:1,
  localPatch:{teachingId:'teaching',date:'2026-10-14',period:1,status:'planned'},patch:{teaching_id:'teaching',date:'2026-10-14',period:1,status:'planned'},
  lastError:{code:'22023',message:'N58_SESSION_CONTEXT_REQUIRED',at:3},dependencies:[]}];return data;
}
async function engineFor(data, transport={}){
 await db.clearAll();for(const [s,rows]of Object.entries(data))if(rows.length)await db.putMany(s,rows);
 const guard=createSyncOwnershipGuard({workspace:{id:'account:A',type:'account',authUserId:A,ownershipState:'claimed',syncEligible:true,databaseName:'unit-only'}});
 return createSyncV2Engine({database:db,ownershipGuard:guard,currentAuthenticatedUserId:()=>A,transport:{fetchRecords:async()=>[],...transport}});
}
after(()=>db.closeDB());
test('only exact owner CREATE/base0/missing-context rejection qualifies; no grade or other protocol entry',()=>{
 const d=fixture();assert.equal(buildSessionRepairPlan(d,A).entries[0].status,'review');
 for(const patch of [{ownerId:B},{protocol:'v1'},{store:'scores'},{entity:'scores'},{op:'patch'},{op:'delete'},{baseRevision:1},{state:'pending'},
  {lastError:{code:'22023',message:'OTHER'}},{lastError:{code:'OTHER',message:'N58_SESSION_CONTEXT_REQUIRED'}},{patch:{calendar_context:{yearId:'y'}}}]){
   const x=structuredClone(d);Object.assign(x.outbox[0],patch);assert.equal(buildSessionRepairPlan(x,A).entries.length,0,JSON.stringify(patch));
 }
});
test('missing/deleted/stale parents, changed session, dependent operation and ambiguous date context fail closed',()=>{
 const transforms=[d=>d.sessions[0].deleted=true,d=>d.sessions[0].serverRevision=1,d=>d.sessions[0].date='2026-10-15',d=>d.terms[0].yearId='missing',
  d=>d.sections[0].deleted=true,d=>d.years[0].fieldRevisions.calendar_selection=0,d=>d.terms[0].endDate='2026-09-01',
  d=>d.outbox.push({id:'dependent',protocol:'v2',store:'attendance',state:'pending',dependencies:[{store:'sessions',recordId:'session'}]}),
  d=>{d.calendars=[{id:'c',yearId:'y',presetId:'sa-western-1448-1449',source:'custom'}];d.calendarDays=[{id:'1',calendarId:'c',date:'2026-10-14'},{id:'2',calendarId:'c',date:'2026-10-14'}];}];
 for(const change of transforms){const d=fixture();change(d);assert.equal(buildSessionRepairPlan(d,A).entries[0].status,'blocked');}
});
test('explicit confirmation only; stale review and mixed invalid selections abort whole transaction; repeat reuses identity',async()=>{
 const d=fixture(),engine=await engineFor(d),plan=await engine.reviewSessionRepairs();
 await assert.rejects(engine.confirmSessionRepairs(plan,['v2:original'],false));assert.deepEqual(await db.getAll('outbox'),d.outbox);
 await assert.rejects(engine.confirmSessionRepairs(plan,['v2:original','unknown'],true));assert.deepEqual(await db.getAll('outbox'),d.outbox);
 await db.put('years',{...d.years[0],fieldRevisions:{calendar_selection:4}});
 await assert.rejects(engine.confirmSessionRepairs(plan,['v2:original'],true));assert.deepEqual(await db.getAll('outbox'),d.outbox);
 await db.put('years',d.years[0]);const ids=await engine.confirmSessionRepairs(plan,['v2:original'],true);
 assert.deepEqual(await engine.confirmSessionRepairs(plan,['v2:original'],true),ids);assert.equal((await db.getAll('outbox')).length,3);
 assert.deepEqual(await db.get('outbox','v2:original'),d.outbox[0]);
});
test('normal owner-scoped existing canonical row or tombstone blocks first replay without a write',async()=>{
 for(const deleted_at of [null,'2026-10-14T00:00:00Z']){
  let writes=0;const d=fixture(),engine=await engineFor(d,{fetchRecords:async()=>[{id:'session',owner_id:A,deleted_at}],applyMutation:async()=>{writes++;throw Error('must not call');}});
  const plan=await engine.reviewSessionRepairs(),[id]=await engine.confirmSessionRepairs(plan,['v2:original'],true);
  assert.equal((await engine.dispatchPending({onlyMutationId:id})).attempted,0);assert.equal(writes,0);assert.deepEqual(await db.get('outbox','v2:original'),d.outbox[0]);
 }
});
test('parent change during server preflight is revalidated before locking/enqueuing wire request',async()=>{
 let writes=0;const d=fixture(),engine=await engineFor(d,{fetchRecords:async()=>{await db.put('terms',{...d.terms[0],deleted:true});return [];},applyMutation:async()=>{writes++;}});
 const plan=await engine.reviewSessionRepairs(),[id]=await engine.confirmSessionRepairs(plan,['v2:original'],true);
 assert.equal((await engine.dispatchPending({onlyMutationId:id})).attempted,0);assert.equal(writes,0);
 assert.deepEqual(await db.get('outbox','v2:original'),d.outbox[0]);
});
test('account switch during repair preflight leaves all old-owner envelopes untouched',async()=>{
 const d=fixture();await engineFor(d);
 const guard=createSyncOwnershipGuard({workspace:{id:'A',type:'account',authUserId:A,ownershipState:'claimed',syncEligible:true,databaseName:'unit-only'}});
 let user=A,writes=0;
 const engine=createSyncV2Engine({database:db,ownershipGuard:guard,currentAuthenticatedUserId:()=>user,transport:{
  fetchRecords:async()=>{user=B;guard.setWorkspace({id:'B',type:'account',authUserId:B,ownershipState:'claimed',syncEligible:true,databaseName:'other'});return [];},
  applyMutation:async()=>{writes++;}
 }});
 const plan=await engine.reviewSessionRepairs(),[id]=await engine.confirmSessionRepairs(plan,['v2:original'],true),before=await db.getAll('outbox');
 assert.equal((await engine.dispatchPending({onlyMutationId:id})).attempted,0);assert.equal(writes,0);assert.deepEqual(await db.getAll('outbox'),before);
});
test('foreign/mismatched receipts cannot supersede an original rejection',async()=>{
 for(const change of [r=>r.canonical.owner_id=B,r=>r.canonical.calendar_context.presetId='wrong',r=>r.canonical.deleted_at='2026-10-14T00:00:00Z',r=>r.outcome='conflict',r=>r.canonical.start_time='07:00:30']){
  const d=fixture();d.sessions[0].startTime='07:00';d.outbox[0].localPatch.startTime='07:00';d.outbox[0].patch.start_time='07:00';
  const engine=await engineFor(d,{applyMutation:async envelope=>{
   const result={mutationId:envelope.mutationId,outcome:'applied',canonicalId:envelope.recordId,resultRevision:1,
    canonical:{...structuredClone(envelope.patch),id:envelope.recordId,owner_id:A,revision:1,deleted_at:null}};
   change(result);return result;
  }});
  const plan=await engine.reviewSessionRepairs(),[id]=await engine.confirmSessionRepairs(plan,['v2:original'],true);
  assert.equal((await engine.dispatchPending({onlyMutationId:id})).acknowledged,0);assert.deepEqual(await db.get('outbox','v2:original'),d.outbox[0]);
  assert.equal((await db.get('outbox','session-repair:v2:original')).state,'pending');
 }
});
