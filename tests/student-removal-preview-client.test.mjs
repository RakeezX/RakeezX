import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import { lifecycleServer, academicFixture, LifecycleBackend, OWNER, evidence } from './helpers/student-lifecycle-server.mjs';
let pg,backend,previews=0;
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
before(async()=>{
  pg=await lifecycleServer(); backend=new LifecycleBackend(pg);
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
  for(const state of ['pending','blocked','rejected','error']) {
    await db.put('outbox',{id:'synthetic-preview-pending',protocol:'v2',store:'students',state});
    const before=await dump();assert.equal((await preview(f)).reason,'sync_not_ready');assert.deepEqual(await dump(),before);
  }
  assert.equal(previews,count);
  await device();const deviceRow=await db.get('device','device');
  await db.put('device',{...deviceRow,cloudRestoreResume:{version:1}});
  const before=await dump();assert.equal((await preview(f)).reason,'sync_not_ready');assert.deepEqual(await dump(),before);
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
