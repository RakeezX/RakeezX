import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import { DEFAULT_ITEMS } from '../src/models.js';
import { createSyntheticSubjectCorrection as create } from '../src/lib/teaching-subject-change-synthetic.js';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID='tch:22222222-2222-4222-8222-222222222222';
const term='term:1',section='section:1';
let owner=A,allowsWrite=true,clock=1793010203040;
const fail=(code)=>error=>error?.code===code;
db.selectDatabase('rakeezx-demo');
db.setProductWriteGuard(()=>{
 if(!allowsWrite)throw Object.assign(new Error('Lease expired'),{code:'OFFLINE_LEASE_LIMITED'});
});
const bridge=create({database:db,currentOwner:()=>owner,clock:()=>++clock,enabled:true});
async function foundation(id=ID){
 db.closeDB();
 await db.clearAll();
 await db.putAcross({
   years:[{id:'year:1448',ownerId:A,status:'active'}],
   terms:[{id:term,ownerId:A,yearId:'year:1448',status:'active'}],
   sections:[{id:section,ownerId:A,yearId:'year:1448',grade:4,label:'1'}],
   subjects:[{id:'sub:old',ownerId:A,name:'العلوم'},{id:'sub:new',ownerId:A,name:'الرياضيات'}],
   teachings:[{id,ownerId:A,sectionId:section,termId:term,
     subjectId:'sub:old',serverRevision:2,updatedAt:200}],
   items:DEFAULT_ITEMS.map((template,i)=>({
     ...template,id:'item:'+i,order:i,teachingId:id,deleted:false,updatedAt:210+i,
   })),
   students:[{id:'student:1',name:'مصطنع فقط'}],
   enrollments:[{id:'enrollment:1',studentId:'student:1',sectionId:section,status:'active'}],
   device:[{id:'device'}],
 });
 return id;
}
const args=(id=ID)=>({ownerId:A,teachingId:id,targetSubjectId:'sub:new',currentTermId:term});

test('demo-only change is atomic and preserves same roster/default items on real Product adapter',async()=>{
 await foundation();
 const before={students:await db.getAll('students'),
   enrollments:await db.getAll('enrollments'),items:await db.getAll('items')};
 const response=await bridge.apply(args());
 assert.equal(response.status,'synthetic_local_staged');
 assert.equal(response.cloudCommitted,false);
 assert.equal(response.serverReceipt,false);
 assert.equal(response.baseRevision,2);
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:new');
 assert.equal((await db.getAll('outbox')).length,1);
 assert.equal((await db.getAll('outbox'))[0].baseRevision,2);
 assert.equal((await db.getAll('outbox'))[0].priorSubjectId,'sub:old');
 assert.deepEqual(await db.getAll('students'),before.students);
 assert.deepEqual(await db.getAll('enrollments'),before.enrollments);
 assert.deepEqual(await db.getAll('items'),before.items);
 db.closeDB();
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:new');
 assert.equal((await db.getAll('outbox')).length,1);
});

test('a repeated correction cannot mint a second outbox or alter the canonical Teaching twice',async()=>{
 await assert.rejects(bridge.apply(args()),fail('SUBJECT_CORRECTION_PREFLIGHT_SAME_SUBJECT'));
 assert.equal((await db.getAll('outbox')).length,1);
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:new');
});

test('Product offline write lease rejects both record and synthetic outbox in one transaction',async()=>{
 await foundation();
 allowsWrite=false;
 await assert.rejects(bridge.apply(args()),fail('OFFLINE_LEASE_LIMITED'));
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:old');
 assert.deepEqual(await db.getAll('outbox'),[]);
 allowsWrite=true;
});

test('historical marks cannot be silently carried to new subject by local correction',async()=>{
 await foundation();
 await db.put('scores',{id:'score:1',itemId:'item:1',studentId:'student:1',value:19});
 await assert.rejects(bridge.apply(args()),
   fail('SUBJECT_CORRECTION_PREFLIGHT_LINKED_TEACHING_HISTORY_REQUIRES_CHOICE'));
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:old');
 assert.equal((await db.get('scores','score:1')).value,19);
 assert.deepEqual(await db.getAll('outbox'),[]);
});

test('owner switch and disabled bridge cannot operate on Account Product storage',async()=>{
 await foundation();
 owner=B;
 await assert.rejects(bridge.apply(args()),fail('SUBJECT_CORRECTION_OWNER_CONTEXT_CHANGED'));
 owner=A;
 const off=create({database:db,currentOwner:()=>owner,enabled:false});
 await assert.rejects(off.apply(args()),fail('SUBJECT_CORRECTION_DEMO_ONLY'));
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:old');
});

test('legacy subject-derived Teaching identity cannot be silently reinterpreted',async()=>{
 const legacy='tch:section:1|sub:old|term:1';
 await foundation(legacy);
 await assert.rejects(bridge.apply(args(legacy)),fail('SUBJECT_CORRECTION_LEGACY_TEACHING_ID'));
 assert.equal((await db.get('teachings',legacy)).subjectId,'sub:old');
 assert.equal((await db.getAll('outbox')).length,0);
});

test('V2 course binding and pending Sync must be reviewed, not discarded',async()=>{
 await foundation();
 await db.put('teachingCourseBindings',{id:'course:1',teachingId:ID,sectionId:section,subjectId:'sub:old'});
 await assert.rejects(bridge.apply(args()),
   fail('SUBJECT_CORRECTION_PREFLIGHT_LINKED_TEACHING_HISTORY_REQUIRES_CHOICE'));
 await db.clearStore('teachingCourseBindings');
 await db.put('outbox',{id:'teachings:'+ID,recordId:ID,store:'teachings',state:'pending'});
 await assert.rejects(bridge.apply(args()),
   fail('SUBJECT_CORRECTION_PREFLIGHT_PENDING_SYNC_REQUIRES_RECONCILIATION'));
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:old');
});

test('closed term requires new reviewed teaching rather than an in-place correction',async()=>{
 await foundation();
 const old=await db.get('terms',term);
 await db.put('terms',{...old,status:'closed'});
 await assert.rejects(bridge.apply(args()),
   fail('SUBJECT_CORRECTION_PREFLIGHT_HISTORICAL_SCOPE_READONLY'));
 assert.equal((await db.get('teachings',ID)).subjectId,'sub:old');
});
