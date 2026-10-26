import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';
import * as db from '../src/lib/db.js';
import {DEFAULT_ITEMS} from '../src/models.js';
import {createSyntheticSubjectCorrection} from '../src/lib/teaching-subject-change-synthetic.js';
import {createSyntheticSubjectConvergence,RESEARCH_SUBJECT_CAS_RECEIPT} from '../src/lib/teaching-subject-convergence-synthetic.js';

globalThis.crypto ??= webcrypto;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID='tch:22222222-2222-4222-8222-222222222222';
const FROM='sub:old',TO='sub:new',TERM='term:1',SEC='sec:1';
const fail=code=>e=>e?.code===code;
const previousFactory=globalThis.indexedDB;
const FA=new IDBFactory(),FB=new IDBFactory();
let owner=A,time=1793010203100;
db.selectDatabase('rakeezx-demo');
db.setProductWriteGuard(()=>{});
function select(factory){
 db.closeDB();
 globalThis.indexedDB=factory;
 return {
   correction:createSyntheticSubjectCorrection({database:db,currentOwner:()=>owner,clock:()=>++time,enabled:true}),
   sync:createSyntheticSubjectConvergence({database:db,currentOwner:()=>owner,enabled:true}),
 };
}
async function seed(){
 await db.clearAll();
 await db.putAcross({
  years:[{id:'y:1448',ownerId:A,status:'active'}],
  terms:[{id:TERM,ownerId:A,yearId:'y:1448',status:'active'}],
  sections:[{id:SEC,ownerId:A,yearId:'y:1448',grade:4,label:'1',status:'active'}],
  subjects:[{id:FROM,ownerId:A,name:'العلوم'},{id:TO,ownerId:A,name:'الرياضيات'}],
  teachings:[{id:ID,ownerId:A,sectionId:SEC,termId:TERM,
    subjectId:FROM,serverRevision:2,updatedAt:200}],
  items:DEFAULT_ITEMS.map((r,i)=>({...r,id:'item:'+i,teachingId:ID,order:i,deleted:false})),
  students:[{id:'student:test',name:'Synthetic'}],
  enrollments:[{id:'en:test',sectionId:SEC,studentId:'student:test',status:'active'}],
  device:[{id:'device'}],
 });
}
const result=async()=>({
 teaching:await db.get('teachings',ID),
 queued:await db.getAll('outbox'),
 scores:await db.getAll('scores'),
 student:await db.getAll('students'),
 enrollments:await db.getAll('enrollments'),
 items:await db.getAll('items'),
});
const draft={ownerId:A,teachingId:ID,targetSubjectId:TO,currentTermId:TERM};
test('two-device synthetic CAS receipt convergence without real cloud access',async t=>{
 try{
  let a=select(FA);
  await seed();
  const beforeA=await result();
  let reply,receipt;
  await t.test('device A stages correction and durable pending intent atomically',async()=>{
    reply=await a.correction.apply(draft);
    const state=await result();
    assert.equal(reply.cloudCommitted,false);
    assert.equal(state.teaching.subjectId,TO);
    assert.equal(state.queued.length,1);
    receipt={protocol:RESEARCH_SUBJECT_CAS_RECEIPT,status:'changed',ownerId:A,
      teachingId:ID,sectionId:SEC,termId:TERM,previousSubjectId:FROM,
      subjectId:TO,baseRevision:2,revision:3,
      clientUpdatedAt:state.queued[0].updatedAt};
    assert.deepEqual(state.student,beforeA.student);
    assert.deepEqual(state.enrollments,beforeA.enrollments);
    assert.deepEqual(state.items,beforeA.items);
  });
  let b=select(FB);
  await seed();
  const beforeB=await result();
  await t.test('device B rejects forged receipts and changes from unrelated owners',async()=>{
    await assert.rejects(b.sync.pullPeer(A,{...receipt,ownerId:B}),fail('SUBJECT_CAS_RECEIPT_NOT_VERIFIED'));
    owner=B;
    await assert.rejects(b.sync.pullPeer(A,receipt),fail('SUBJECT_CAS_OWNER_CONTEXT_CHANGED'));
    owner=A;
    assert.deepEqual(await result(),beforeB);
  });
  await t.test('device B forbids historic scores or queued offline changes',async()=>{
    await db.put('scores',{id:'score:1',itemId:'item:1',studentId:'student:test',value:17});
    await assert.rejects(b.sync.pullPeer(A,receipt),
      fail('SUBJECT_CAS_REVIEW_CHANGED:linked_teaching_history_requires_choice'));
    assert.equal((await db.get('scores','score:1')).value,17);
    await db.remove('scores','score:1');
    await db.put('outbox',{id:'scores:pending',recordId:'item:1',state:'pending'});
    await assert.rejects(b.sync.pullPeer(A,receipt),
      fail('SUBJECT_CAS_REVIEW_CHANGED:pending_sync_requires_reconciliation'));
    await db.remove('outbox','scores:pending');
    assert.deepEqual((await result()).student,beforeB.student);
  });
  await t.test('device B imports exact revision without duplicating students or default items',async()=>{
    const x=await b.sync.pullPeer(A,receipt);
    assert.equal(x.status,'synthetic_peer_converged');
    const after=await result();
    assert.equal(after.teaching.subjectId,TO);
    assert.equal(after.teaching.serverRevision,3);
    assert.deepEqual(after.student,beforeB.student);
    assert.deepEqual(after.enrollments,beforeB.enrollments);
    assert.deepEqual(after.items,beforeB.items);
    assert.deepEqual(after.scores,[]);
    assert.deepEqual(after.queued,[]);
  });
  await t.test('device B repeated exact server pull stays idempotent',async()=>{
    b=select(FB);
    const x=await b.sync.pullPeer(A,receipt);
    assert.equal(x.status,'already_converged');
    assert.equal((await db.get('teachings',ID)).serverRevision,3);
  });
  a=select(FA);
  await t.test('device A refuses altered receipt without dropping its pending intent',async()=>{
    const bad={...receipt,revision:4};
    await assert.rejects(a.sync.confirmLocal(A,bad),fail('SUBJECT_CAS_RECEIPT_NOT_VERIFIED'));
    const wrongTime={...receipt,clientUpdatedAt:receipt.clientUpdatedAt+1};
    await assert.rejects(a.sync.confirmLocal(A,wrongTime),fail('SUBJECT_CAS_LOCAL_INTENT_MISMATCH'));
    const old=await result();
    assert.equal(old.queued.length,1);
    assert.equal(old.teaching.serverRevision,2);
  });
  await t.test('device A confirms exact same CAS receipt, discards only owned outbox atomically',async()=>{
    const x=await a.sync.confirmLocal(A,receipt);
    assert.equal(x.status,'synthetic_receipt_confirmed');
    assert.equal(x.cloudVerified,false);
    assert.equal(x.providerIdentityVerified,false);
    const after=await result();
    assert.equal(after.teaching.serverRevision,3);
    assert.equal(after.teaching.subjectId,TO);
    assert.deepEqual(after.queued,[]);
    assert.deepEqual(after.student,beforeA.student);
    assert.deepEqual(after.enrollments,beforeA.enrollments);
  });
  await t.test('A reboot preserves confirmed teaching and never invents a pending mutation',async()=>{
    a=select(FA);
    assert.equal((await db.get('teachings',ID)).subjectId,TO);
    assert.equal((await db.get('teachings',ID)).serverRevision,3);
    assert.deepEqual(await db.getAll('outbox'),[]);
    await assert.rejects(a.sync.confirmLocal(A,receipt),
      fail('SUBJECT_CAS_LOCAL_INTENT_MISMATCH'));
  });
 }finally{
   db.closeDB();db.setProductWriteGuard(null);
   globalThis.indexedDB=previousFactory;
 }
});
