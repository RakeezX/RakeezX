import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { lifecycleServer, academicFixture, LifecycleBackend, OWNER, evidence } from './helpers/student-lifecycle-server.mjs';
let pg,backend,previews=0;
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
before(async()=>{
  pg=await lifecycleServer({migration32:true}); backend=new LifecycleBackend(pg);
  const original=backend.previewStudentRemoval.bind(backend);
  backend.previewStudentRemoval=async(...args)=>{previews++;return original(...args);}; cloud.setMockBackend(backend);
});
after(async()=>{cloud.setMockBackend(null);cloud.setMockAuth(null,null);store.closeChannel();db.closeDB();await pg?.close();});
const dump=async()=>Object.fromEntries(await Promise.all(db.STORES.map(async name=>[name,await db.getAll(name)])));
async function device(factory=new IDBFactory()) {
  db.closeDB();global.indexedDB=factory;cloud.setMockAuth({id:OWNER},{access_token:'synthetic'});
  store.state.ready=false;await store.init();assert.equal(await sync.syncAll({full:true}),true);return factory;
}
const preview=f=>store.previewStudentRemoval(f.student,f.enrollment,store.activeEnrollment(f.student)?.serverRevision??1);

test('signed-out local student reports authentication before missing canonical revision',async()=>{
  const f=await academicFixture(pg,'integration-auth');await device();
  cloud.setMockAuth(null,null);const before=await dump(),count=previews;
  assert.deepEqual(await store.previewStudentRemoval(f.student,f.enrollment,undefined),{outcome:'blocked',reason:'auth_required',retryable:true});
  assert.equal(previews,count);assert.deepEqual(await dump(),before);
});

test('unacknowledged locally added student requires Sync, never guessed pristine or sent to preview RPC',async()=>{
  const f=await academicFixture(pg,'integration-unsynced');await device();
  const student=await store.addStudent(f.section,'طالب محلي اصطناعي');
  const en=store.activeEnrollment(student.id),before=await dump(),count=previews;
  assert.equal(store.getStudent(student.id).serverRevision,0);assert.equal(en.serverRevision,0);
  assert.deepEqual(await store.previewStudentRemoval(student.id,en.id,en.serverRevision),{outcome:'blocked',reason:'student_not_synced',retryable:true});
  assert.equal(previews,count);assert.deepEqual(await dump(),before);
  assert.equal(await sync.syncAll({full:true}),true);
  assert.deepEqual(await store.previewStudentRemoval(student.id,en.id,store.activeEnrollment(student.id).serverRevision),{outcome:'delete_pristine',reason:'pristine',retryable:false});
});

test('real Demo package and ordinary-ID student in its Demo class never use server lifecycle preview',async()=>{
  const f=await academicFixture(pg,'integration-demo');await device();
  await store.patchDevice({activeYearId:f.year,activeTermId:f.term});
  const {createDemoPackage}=await import('../src/lib/demo.js');const pkg=await createDemoPackage();
  const ordinary=await store.addStudent(pkg.section.id,'طالب تجريبي مضاف');
  const student=store.state.students.find(row=>row.id.startsWith('demo:')&&store.activeEnrollment(row.id)?.sectionId===pkg.section.id);
  for(const id of [student.id,ordinary.id]){
    const en=store.activeEnrollment(id),before=await dump(),count=previews;
    assert.deepEqual(await store.previewStudentRemoval(id,en.id,en.serverRevision),{outcome:'blocked',reason:'demo_local_only',retryable:false});
    assert.equal(previews,count);assert.deepEqual(await dump(),before);
  }
});
test('runtime pristine preview is disk/server authoritative, sanitized and performs ZERO writes or command calls',async()=>{
  const f=await academicFixture(pg,'client-preview-pristine');await device();
  const before=await dump(),calls=backend.calls.length,ops=backend.operations.length;
  const handle=await db.openDB(),transaction=handle.transaction.bind(handle),modes=[];
  handle.transaction=(names,mode,...args)=>{modes.push(mode);return transaction(names,mode,...args);};
  try {assert.deepEqual(await preview(f),{outcome:'delete_pristine',reason:'pristine',retryable:false});}
  finally {handle.transaction=transaction;}
  assert.equal(modes.every(mode=>mode==='readonly'),true);
  assert.deepEqual(await dump(),before);assert.equal(backend.calls.length,calls);assert.equal(backend.operations.length,ops);
});
test('N27: synced V2 with retained superseded evidence previews and completes removal without rewriting the evidence',async()=>{
  const f=await academicFixture(pg,'client-preview-n27');await device();
  const superseded={id:'synthetic-n27-superseded',protocol:'v2',store:'scores',recordId:'synthetic-old-score',
    state:'superseded',supersededByMutationId:'synthetic-replacement',recoveryReason:'score-create-identity-01c'};
  await db.put('outbox',superseded);
  const summary=await sync.getSyncOperationalSummary();
  assert.equal(summary.state,'synced');assert.equal(summary.queuedCount,0);assert.equal(summary.cloudSyncHealthy,true);
  const before=await dump();
  assert.deepEqual(await preview(f),{outcome:'delete_pristine',reason:'pristine',retryable:false});
  assert.deepEqual(await dump(),before,'preview is read-only, including superseded evidence');
  assert.equal((await store.deletePristineStudent(f.student)).ok,true);
  assert.deepEqual(await db.get('outbox',superseded.id),superseded,'historical evidence remains unchanged after command and reconciliation');
});
test('server history and this-device protected local-only/retained evidence select end enrollment',async()=>{
  const f=await academicFixture(pg,'client-preview-local');await device();
  await db.put('submissions',{id:'synthetic-local-submission',studentId:f.student,content:'private fixture',deleted:true});
  const before=await dump();
  assert.deepEqual(await preview(f),{outcome:'end_enrollment',reason:'local_protected_evidence',retryable:false});
  assert.deepEqual(await dump(),before);
  await assert.rejects(store.deletePristineStudent(f.student),{code:'NOT_PRISTINE'});
  await evidence(pg,f,'scores');
  assert.deepEqual(await preview(f),{outcome:'end_enrollment',reason:'history_exists',retryable:false});
});
test('local-only evidence arriving DURING RPC is reread from disk, not stale in-memory state',async()=>{
  const f=await academicFixture(pg,'client-preview-during');await device();
  const original=backend.previewStudentRemoval;
  backend.previewStudentRemoval=async(...args)=>{
    const result=await original(...args);
    await db.put('submissions',{id:'synthetic-during-preview',studentId:f.student});return result;
  };
  try {assert.equal((await preview(f)).reason,'local_protected_evidence');}
  finally {backend.previewStudentRemoval=original;}
  assert.equal(store.state.submissions.some(row=>row.id==='synthetic-during-preview'),false,'not reading stale memory');
});
test('offline, auth, pending/rejected/blocked work and restore checkpoint never guess or trigger Sync',async()=>{
  const f=await academicFixture(pg,'client-preview-ready');await device();const count=previews;
  cloud.setMockAuth(null,null);assert.equal((await preview(f)).reason,'auth_required');
  cloud.setMockAuth({id:OWNER},{access_token:'synthetic'});
  Object.defineProperty(global.navigator,'onLine',{value:false,configurable:true});
  try {assert.equal((await preview(f)).reason,'offline');}finally{delete global.navigator.onLine;}
  for(const state of ['pending','blocked','rejected','failed','error']) {
    await db.put('outbox',{id:'synthetic-preview-pending',protocol:'v2',store:'students',state});
    const before=await dump();assert.equal((await preview(f)).reason,'sync_not_ready');assert.deepEqual(await dump(),before);
  }
  assert.equal(previews,count);
  await device();const deviceRow=await db.get('device','device');
  await db.put('device',{...deviceRow,cloudRestoreResume:{version:1}});
  const before=await dump();assert.equal((await preview(f)).reason,'sync_not_ready');assert.deepEqual(await dump(),before);
});
test('N27: superseded history does not mask active or unknown outbox work',async()=>{
  const f=await academicFixture(pg,'client-preview-n27-unsafe');await device();const count=previews;
  const history={id:'synthetic-n27-history',protocol:'v2',store:'scores',state:'superseded'};
  await db.put('outbox',history);
  for(const state of ['pending','blocked','rejected','failed','error','unknown']) {
    const active={id:'synthetic-n27-active',protocol:'v2',store:'students',state};
    await db.put('outbox',active);
    const before=await dump();
    assert.equal((await preview(f)).reason,'sync_not_ready',state);
    assert.deepEqual(await dump(),before,state);
  }
  await db.remove('outbox','synthetic-n27-active');
  const previousStatus=sync.state.status;
  try {
    sync.state.status='error';
    assert.equal((await preview(f)).reason,'sync_not_ready','coordinator failure blocks even with only superseded history');
  } finally {sync.state.status=previousStatus;}
  await db.put('outbox',{id:'synthetic-n27-legacy',store:'students',state:'pending'});
  assert.equal((await preview(f)).reason,'sync_not_ready','unknown protocol remains fail-closed');
  assert.deepEqual(await db.get('outbox',history.id),history);
  assert.equal(previews,count);
});
test('N27: missing workspace proof or mismatched owner blocks preview before server RPC',async()=>{
  const f=await academicFixture(pg,'client-preview-n27-owner');await device();
  const workspace=runtimeSyncOwnershipGuard.getWorkspace(),count=previews;
  try {
    runtimeSyncOwnershipGuard.setWorkspace({type:'unresolved',reason:'synthetic-n27-unavailable'});
    assert.equal((await preview(f)).outcome,'blocked');
    assert.equal(previews,count);
    runtimeSyncOwnershipGuard.setWorkspace({type:'account',ownershipState:'claimed',syncEligible:true,
      authUserId:OWNER,databaseName:'synthetic-n27-owned-workspace'});
    cloud.setMockAuth({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{access_token:'synthetic'});
    assert.equal((await preview(f)).outcome,'blocked');
    assert.equal(previews,count);
  } finally {runtimeSyncOwnershipGuard.setWorkspace(workspace);cloud.setMockAuth({id:OWNER},{access_token:'synthetic'});}
});
test('account change and malformed/private server errors never escape in result or become pristine',async()=>{
  const f=await academicFixture(pg,'client-preview-errors');await device();const original=backend.previewStudentRemoval;
  try {
    backend.previewStudentRemoval=async()=>{throw Object.assign(new Error('SQL private student/token fixture'),{code:'23503'});};
    assert.deepEqual(await preview(f),{outcome:'blocked',reason:'preview_unavailable',retryable:true});
    backend.previewStudentRemoval=async()=>({outcome:'delete_pristine',reason:'private contents',retryable:false});
    assert.equal((await preview(f)).reason,'preview_unavailable');
    backend.previewStudentRemoval=async()=>({outcome:'delete_pristine',reason:'pristine',retryable:false,records:['private fixture'],mutationId:'private'});
    assert.deepEqual(await preview(f),{outcome:'delete_pristine',reason:'pristine',retryable:false});
    backend.previewStudentRemoval=async()=>{cloud.setMockAuth({id:'other-owner'},{access_token:'synthetic'});return {outcome:'delete_pristine',reason:'pristine',retryable:false};};
    assert.equal((await preview(f)).reason,'auth_required');
  }finally{backend.previewStudentRemoval=original;}
  assert.deepEqual(await store.previewStudentRemoval(f.student,f.enrollment,null),{outcome:'blocked',reason:'invalid_source',retryable:false});
});
test('two devices: preview before protected evidence never licenses deletion; canonical ending converges',async()=>{
  const f=await academicFixture(pg,'client-preview-two-device');const a=await device(),b=await device();
  await device(a);assert.equal((await preview(f)).outcome,'delete_pristine');
  await evidence(pg,f,'notes'); // Another device commits protected evidence after A previews.
  await assert.rejects(store.deletePristineStudent(f.student),{code:'NOT_PRISTINE'});
  assert.equal(store.getStudent(f.student).deleted, false);
  const en=store.activeEnrollment(f.student);
  assert.equal((await store.endStudentEnrollment(f.student,en.id,{sourceRevision:en.serverRevision})).ok,true);
  await device(b);assert.equal(store.activeEnrollment(f.student),null);assert.equal(store.getStudent(f.student).status,'withdrawn');
  await device(a);assert.equal(store.activeEnrollment(f.student),null);assert.equal(store.getStudent(f.student).status,'withdrawn');
  assert.equal(store.state.notes.some(row=>row.studentId===f.student),true);
});

test('RPC transport sends only exact source identity/revision to current Production schema, never an outcome or owner',async()=>{
  const nativeFetch=global.fetch;cloud.setMockBackend(null);cloud.setMockAuth({id:OWNER},{access_token:'synthetic'});
  const requests=[];
  global.fetch=async(url,options)=>{
    requests.push({url:String(url),options});return new Response(JSON.stringify({outcome:'blocked',reason:'stale_source',retryable:true}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    assert.deepEqual(await cloud.previewStudentRemoval('synthetic-student','synthetic-source',7),{outcome:'blocked',reason:'stale_source',retryable:true});
    assert.equal(requests.length,1);assert.equal(requests[0].url,`${cloud.SUPABASE_URL}/rest/v1/rpc/preview_student_removal`);
    assert.equal(requests[0].options.method,'POST');
    assert.equal(requests[0].options.headers['Content-Profile'],'rakeezx');
    assert.deepEqual(JSON.parse(requests[0].options.body),{p_student_id:'synthetic-student',p_source_enrollment_id:'synthetic-source',p_source_revision:7});
  }finally{global.fetch=nativeFetch;cloud.setMockBackend(backend);}
});
