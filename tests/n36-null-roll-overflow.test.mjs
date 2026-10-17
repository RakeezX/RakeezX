// AI D-123: real local store transactions and original SQL, no live service.
import 'fake-indexeddb/auto';
import test,{after} from 'node:test';import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';import * as store from '../src/store.js';
import {makeYear,makeTerm,makeSubject,makeSection,makeTeaching,makeStudent,makeEnrollment} from '../src/models.js';
import {lifecycleServer,academicFixture} from './helpers/student-lifecycle-server.mjs';
import {encodeSyncV2Patch} from '../src/lib/sync-v2.js';
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
async function fixture(count){
 await db.clearAll();await store.init();
 const year=makeYear({id:'overflow-year'}),term=makeTerm({id:'overflow-term',yearId:year.id}),subject=makeSubject({id:'overflow-subject'}),section=makeSection({id:'overflow-section',yearId:year.id}),other=makeSection({id:'overflow-other',yearId:year.id,label:'2'}),teaching=makeTeaching({id:'overflow-teaching',sectionId:section.id,termId:term.id,subjectId:subject.id});
 const students=Array.from({length:count},(_,i)=>makeStudent({id:'overflow-student-'+i,name:'طالب تجريبي '+i}));
 await store.save({years:[year],terms:[term],subjects:[subject],sections:[section,other],teachings:[teaching],students,enrollments:students.map((s,i)=>makeEnrollment({studentId:s.id,sectionId:section.id,rollNo:i<999?i+1:null}))});
 return {section,other,teaching};
}
test('998/999/1000/1251 sequential confirmed batches retain membership and SQL-range numbers',async()=>{
 for(const count of [998,999,1000,1251]){
  const f=await fixture(0);let added=0;
  for(let start=0;start<count;start+=300){
   const names=Array.from({length:Math.min(300,count-start)},(_,i)=>'اسم اختبار '+(start+i));
   // Store's guarded persisted preflight is exercised; names grammar belongs to UI tests.
   const result=await store.importStudents(f.section.id,names,{verifyCurrent(current){assert.ok(current.sections.some(s=>s.id===f.section.id));}});added+=result.added;
  }
  assert.equal(added,count);const rows=(await db.getAll('enrollments')).filter(e=>e.sectionId===f.section.id);
  assert.deepEqual(rows.filter(e=>e.rollNo!==null).map(e=>e.rollNo).sort((a,b)=>a-b),Array.from({length:Math.min(count,999)},(_,i)=>i+1));
  assert.equal(rows.filter(e=>e.rollNo===null).length,Math.max(0,count-999));
  for(const row of rows)assert.ok(encodeSyncV2Patch('enrollments',row).roll_no===null||row.rollNo<=999);
 }
});
test('preexisting null membership is not numbered or lost; automatic add caps only numbering; explicit 1000 rejected',async()=>{
 const f=await fixture(1000),before=await db.getAll('enrollments');
 const student=await store.addStudent(f.section.id,'طالب إضافي');assert.ok(student);
 assert.equal(store.activeEnrollment(student.id).rollNo,null);
 assert.equal(await store.addStudent(f.section.id,'رقم غير صالح',{rollNo:1000}),null);
 assert.deepEqual(await store.setRollNo(store.activeEnrollment(student.id).id,1000),{ok:false,reason:'range'});
 const direct=await store.importStudents(f.section.id,['طالب مباشر']);assert.equal(direct.added,1);
 assert.equal(store.sectionRoster(f.section.id).filter(e=>e.rollNo===null).length,3);
 for(const row of before)assert.deepEqual((await db.getAll('enrollments')).find(e=>e.id===row.id),row);
 const snapshot=await Promise.all(['students','enrollments','outbox'].map(k=>db.getAll(k)));
 assert.equal(await store.renumberRoster(f.section.id),false);
 assert.equal(await store.transferStudent(student.id,f.other.id),null);
 assert.deepEqual(await Promise.all(['students','enrollments','outbox'].map(k=>db.getAll(k))),snapshot,'unsupported RPC plans never create writes or commands');
});
test('persisted review preflight rejection is atomic at the overflow boundary',async()=>{
 const f=await fixture(999),before=await Promise.all(['students','enrollments','outbox'].map(k=>db.getAll(k)));
 await assert.rejects(()=>store.importStudents(f.section.id,['طالب جديد'],{verifyCurrent(){throw Error('IMPORT_CHANGED');}}),/IMPORT_CHANGED/);
 assert.deepEqual(await Promise.all(['students','enrollments','outbox'].map(k=>db.getAll(k))),before);
});
test('original server SQL accepts nullable membership and rejects explicit 1000; RPC null plans remain unsupported',async()=>{
 const pg=await lifecycleServer();try{
  const f=await academicFixture(pg,'overflow-null');
  await pg.query('insert into rakeezx.students(id,name) values($1,$2)',['overflow-null-student','طالب بلا رقم']);
  await pg.query('insert into rakeezx.enrollments(id,student_id,section_id,roll_no) values($1,$2,$3,null)',['overflow-null-enrollment','overflow-null-student',f.section]);
  assert.equal((await pg.query('select roll_no from rakeezx.enrollments where id=$1',['overflow-null-enrollment'])).rows[0].roll_no,null);
  await pg.query('insert into rakeezx.students(id,name) values($1,$2)',['overflow-v2-student','طالب مزامنة']);
  const patch={student_id:'overflow-v2-student',section_id:f.section,roll_no:null,status:'active',start_date:'2026-08-01'};
  const stamp=Date.now();const apply=()=>pg.query('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6::jsonb,$7,$8) result',['enrollments','overflow-v2-enrollment','overflow-v2-mutation','overflow-test-device',0,JSON.stringify(patch),'create',stamp]);
  const receipt=(await apply()).rows[0].result;assert.deepEqual((await apply()).rows[0].result,receipt);
  assert.equal((await pg.query('select roll_no from rakeezx.enrollments where id=$1',['overflow-v2-enrollment'])).rows[0].roll_no,null);

  await assert.rejects(()=>pg.query('update rakeezx.enrollments set roll_no=1000 where id=$1',['overflow-null-enrollment']),/check constraint/);
  await assert.rejects(()=>pg.query('select rakeezx.renumber_enrollment_roster($1,$2::jsonb)',[f.section,JSON.stringify([{id:f.enrollment,roll_no:null,client_updated_at:Date.now()},{id:'overflow-null-enrollment',roll_no:null,client_updated_at:Date.now()},{id:'overflow-v2-enrollment',roll_no:null,client_updated_at:Date.now()}])]),/Invalid enrollment roster roll number or identity/);
 }finally{await pg.close();}
});
after(async()=>{store.closeChannel();await db.closeDB();});
