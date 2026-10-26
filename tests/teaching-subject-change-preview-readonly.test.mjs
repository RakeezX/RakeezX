import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import {DEFAULT_ITEMS} from '../src/models.js';
import {readSubjectChangeLocalSnapshot,previewTeachingSubjectChange} from '../src/lib/teaching-subject-change-preview.js';

globalThis.crypto ??= webcrypto;
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TEACHING='tch:22222222-2222-4222-8222-222222222222';
const FROM='sub:old',TO='sub:new',TERM='tm:1',SEC='sec:1';
db.selectDatabase('rakeezx-demo');
const req={
  ownerId:OWNER,teachingId:TEACHING,targetSubjectId:TO,currentTermId:TERM,
};
const fail=code=>err=>err?.code===code;
async function seed(){
  db.closeDB();await db.clearAll();
  await db.putAcross({
    years:[{id:'year:1',ownerId:OWNER,status:'active'}],
    terms:[{id:TERM,ownerId:OWNER,yearId:'year:1',status:'active'}],
    sections:[{id:SEC,ownerId:OWNER,yearId:'year:1',grade:4,label:'1',status:'active'}],
    subjects:[{id:FROM,ownerId:OWNER,name:'العلوم'},
      {id:TO,ownerId:OWNER,name:'الرياضيات'}],
    teachings:[{id:TEACHING,ownerId:OWNER,sectionId:SEC,
      termId:TERM,subjectId:FROM}],
    items:DEFAULT_ITEMS.map((item,i)=>({...item,id:'item:'+i,
      teachingId:TEACHING,order:i,deleted:false})),
    students:[{id:'student:test',name:'Private - never in preview'}],
    enrollments:[{id:'enroll:1',sectionId:SEC,studentId:'student:test',status:'active'}],
    device:[{id:'device'}],
  });
}
test('one readonly IndexedDB snapshot includes all domain arrays and no Outbox mutation',async()=>{
 await seed();
 const snapshot=await readSubjectChangeLocalSnapshot();
 assert.ok(Array.isArray(snapshot.sectionCurriculumScopes));
 assert.ok(Array.isArray(snapshot.teachingCourseBindings));
 assert.ok(Array.isArray(snapshot.closedTermReports));
 assert.ok(Array.isArray(snapshot.outbox));
 assert.equal(snapshot.teachings[0].subjectId,FROM);
 const r=await previewTeachingSubjectChange(req);
 assert.equal(r.status,'preflight_ready');
 assert.equal(r.canCommit,false);
 assert.equal(r.affected.sharedStudents,1);
 assert.deepEqual(await db.getAll('outbox'),[]);
 assert.equal((await db.get('teachings',TEACHING)).subjectId,FROM);
 assert.doesNotMatch(JSON.stringify(r),/Private/);
});
test('scores and pending sync independently prevent an automatic correction',async()=>{
 await seed();
 await db.put('scores',{id:'score:1',itemId:'item:1',value:17,
  studentId:'student:test'});
 const score=await previewTeachingSubjectChange(req);
 assert.equal(score.status,'review_required');
 assert.equal(score.affected.recordCounts.scores.count,1);
 assert.equal((await db.get('scores','score:1')).value,17);
 await db.remove('scores','score:1');
 await db.put('outbox',{id:'items:item:1',store:'items',recordId:'item:1',
  state:'pending'});
 const pending=await previewTeachingSubjectChange(req);
 assert.equal(pending.reason,'pending_sync_requires_reconciliation');
 assert.equal(pending.affected.pendingOutbox,1);
 assert.equal((await db.get('teachings',TEACHING)).subjectId,FROM);
});
test('a mismatched owner or stale academic identity is never a write authorization',async()=>{
 await seed();
 const outsider=await previewTeachingSubjectChange({...req,ownerId:OTHER});
 assert.equal(outsider.reason,'foreign_owner_record');
 let called=0;
 await assert.rejects(previewTeachingSubjectChange({
  ...req,assertContext:()=>{
    called++;
    if(called>=2)throw new Error('WORKSPACE_SWITCHED');
  },
 }),/WORKSPACE_SWITCHED/);
 assert.equal(called,2);
 assert.deepEqual(await db.getAll('outbox'),[]);
});
test('cancelled read and blocked Product write still cannot modify domain rows',async()=>{
 await seed();
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(readSubjectChangeLocalSnapshot({signal:aborted.signal}),
  fail('SUBJECT_CHANGE_PREVIEW_CANCELLED'));
 db.setProductWriteGuard(()=>{throw new Error('Lease limited');});
 try{
  const review=await previewTeachingSubjectChange(req);
  assert.equal(review.status,'preflight_ready');
  assert.equal((await db.get('teachings',TEACHING)).subjectId,FROM);
  assert.deepEqual(await db.getAll('outbox'),[]);
 }finally{db.setProductWriteGuard(null);db.closeDB();}
});
