import test, {before, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import {makeTeaching, makeEnrollment, makeSession, makeSlot, makeNote, defaultItemsFor, studentTotal, sessionId, attendanceId, scoreId} from '../src/models.js';

// Batch 2.1-D AUDIT, not a teaching rekey implementation. These characterize
// blockers explicitly; a green test here does NOT mean graph convergence passes.
// Direct teachingId: items, slots, sessions, attendance, logs, notes, assignments.
// Indirect: scores.itemId; attendance/notes/logs.sessionId; sessions.makeupForId;
// sessions.slotId; assignments.itemId; submissions.assignmentId. Enrollments use
// sectionId, not teachingId, but section adoption can collide on student+section.
// Composite identity: teaching -> session -> attendance; score -> item; enrollment
// -> section; submission -> assignment. Device.groupArrangements is teaching-keyed.
// Reports derive from these stores; units/lessons are subject/grade/term curriculum.
// Outbox stores record IDs/field NAMES, not JSON payloads. All tombstones matter.
// IDB stores have keyPath=id only, no secondary indexes. BC sends {store,id}
// invalidations. Routes/Picker/Groups/report filters also hold transient IDs.

const OWNER='11111111-1111-4111-8111-111111111111';
const STAMP=1700000000000;
const YEAR='year:test',TERM='term:test',SUBJECT='subject:test',B='sec:cloud';
const TB=makeTeaching({sectionId:B,subjectId:SUBJECT,termId:TERM,updatedAt:STAMP});
// Strip only the file encoding marker, not any SQL or constraint definition.
const core=(await readFile(new URL('../supabase/migrations/0001_core_schema.sql',import.meta.url),'utf8')).replace(/^\uFEFF/,'');
const migration=await readFile(new URL('../supabase/migrations/0007_sections_active_normalized_identity.sql',import.meta.url),'utf8');
let pg;
before(async()=>{
  pg=new PGlite(); // In-memory PostgreSQL only; never connects to Supabase.
  await pg.exec(`create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${OWNER}');
    create function auth.uid() returns uuid language sql immutable as $$select '${OWNER}'::uuid$$;`);
});
beforeEach(async()=>{
  await db.clearAll();
  for(const name of Object.keys(store.state)) if(Array.isArray(store.state[name])) store.state[name]=[];
  store.state.device=null;store.state.profile=null;
  cloud.setMockBackend(null);cloud.setMockAuth(null,null);
  sync.state.status='idle';sync.state.results={};
  await pg.exec('drop schema if exists rakeezx cascade;');
  await pg.exec(core);await pg.exec(migration);
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,client_updated_at) values($1,'TEST year',1448,1449,$2)`,[YEAR,STAMP]);
  await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",client_updated_at) values($1,$2,'TEST term',1,$3)`,[TERM,YEAR,STAMP]);
  await pg.query(`insert into rakeezx.subjects(id,name,slug,client_updated_at) values($1,'TEST subject','test',$2)`,[SUBJECT,STAMP]);
  await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at) values($1,$2,4,'1','TEST class',$3)`,[B,YEAR,STAMP]);
  await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at) values($1,$2,$3,$4,$5)`,[TB.id,B,SUBJECT,TERM,STAMP]);
  await store.save({years:[{id:YEAR,label:'TEST year',hijriStart:1448,hijriEnd:1449,updatedAt:STAMP}],
    terms:[{id:TERM,yearId:YEAR,name:'TEST term',index:1,updatedAt:STAMP}],
    subjects:[{id:SUBJECT,name:'TEST subject',slug:'test',updatedAt:STAMP}]},{queue:false});
  await store.patchDevice({activeYearId:YEAR,activeTermId:TERM,deviceId:'TEST-device-A'});
});
after(async()=>{cloud.setMockBackend(null);cloud.setMockAuth(null,null);store.closeChannel();db.closeDB();await pg.close();});

test('actual teaching unique constraint includes owner/section/subject/term and has no tombstone predicate',async()=>{
  const definition=(await pg.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conname='teachings_natural_uniq'")).rows[0].definition;
  assert.equal(definition,'UNIQUE (owner_id, section_id, subject_id, term_id)');
  const predicate=(await pg.query("select indpred from pg_index where indexrelid='rakeezx.teachings_natural_uniq'::regclass")).rows[0].indpred;
  assert.equal(predicate,null);
  await pg.query('update rakeezx.teachings set deleted_at=now() where id=$1',[TB.id]);
  await assert.rejects(pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('TA',$1,$2,$3)`,[B,SUBJECT,TERM]),{code:'23505',constraint:'teachings_natural_uniq'});
  assert.equal((await pg.query('select count(*)::int as count from rakeezx.teachings')).rows[0].count,1);
});

test('normal class creation creates teaching and five unrelated item IDs; union would double grading maximum',async()=>{
  const a=await store.createSection({grade:4,label:'١'});
  const ta=await store.createTeaching({sectionId:a.id,subjectId:SUBJECT,termId:TERM});
  const localItems=store.items(ta.id);
  const remoteItems=defaultItemsFor(TB.id);
  assert.notEqual(a.id,B);assert.notEqual(ta.id,TB.id);
  assert.equal(localItems.length,5);assert.equal(remoteItems.length,5);
  assert.equal(new Set([...localItems,...remoteItems].map(i=>i.id)).size,10);
  const context={classHasParticipation:false,scoresByItem:{},attendance:[],logs:[]};
  assert.equal(studentTotal(localItems,context).outOfAll,100);
  assert.equal(studentTotal(remoteItems,context).outOfAll,100);
  assert.equal(studentTotal([...localItems,...remoteItems],context).outOfAll,200,
    'Blind item union is NOT a valid unchanged-scoring teaching reconciliation');
});

test('reference-only teaching rekey preserves old session ID but breaks actual ensureSession idempotency',async()=>{
  await store.save({teachings:[TB]},{queue:false});
  const original=makeSession({teachingId:'TA',date:'2026-09-06',period:1,note:'TEST history'});
  // Counterexample in isolated test DB only, NOT a production rekey path.
  await store.save({sessions:[{...original,teachingId:TB.id}]});
  const opened=await store.ensureSession(TB.id,original.date,original.period);
  assert.notEqual(opened.id,original.id);
  assert.equal(store.sessionsOnFor(TB.id,original.date).length,2);
  assert.equal(store.getSession(original.id).note,'TEST history');
});

test('overlapping session and slot histories cannot be relinked to TB without further unique collisions',async()=>{
  await pg.query(`insert into rakeezx.slots(id,teaching_id,weekday,period) values('slot:cloud',$1,0,1)`,[TB.id]);
  await assert.rejects(pg.query(`insert into rakeezx.slots(id,teaching_id,weekday,period) values('slot:local',$1,0,1)`,[TB.id]),{code:'23505',constraint:'slots_natural_uniq'});
  await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,note) values('session:cloud',$1,'2026-09-06',1,'TEST cloud history')`,[TB.id]);
  await assert.rejects(pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,note) values('session:local',$1,'2026-09-06',1,'TEST local history')`,[TB.id]),{code:'23505',constraint:'sessions_natural_uniq'});
  assert.equal((await pg.query('select note from rakeezx.sessions')).rows[0].note,'TEST cloud history');
});

test('shared student enrollment can also collide after section adoption; it has no teaching reference',async()=>{
  await pg.query("insert into rakeezx.students(id,name) values('student:shared','TEST shared student')");
  await pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,start_date) values('en:cloud','student:shared',$1,'2026-09-01')`,[B]);
  await assert.rejects(pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,start_date) values('en:local','student:shared',$1,'2026-09-01')`,[B]),{code:'23505',constraint:'enrollments_natural_uniq'});
});

test('non-pristine two-device graph stops safely before teaching upload while preserving local/cloud history and pending work on repeat',async(t)=>{
  t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
  const a=await store.createSection({grade:4,label:'١'});
  const ta=await store.createTeaching({sectionId:a.id,subjectId:SUBJECT,termId:TERM});
  const studentId='student:local';
  const enrollment=makeEnrollment({studentId,sectionId:a.id,rollNo:1});
  const slot=makeSlot({teachingId:ta.id,weekday:0,period:1});
  const ses=makeSession({teachingId:ta.id,date:'2026-09-06',period:1,slotId:slot.id,status:'held',note:'TEST local history'});
  const item=store.items(ta.id)[1];
  const graph={students:[{id:studentId,name:'TEST local student',updatedAt:STAMP}],enrollments:[enrollment],slots:[slot],sessions:[ses],
    attendance:[{id:attendanceId(studentId,ses.id),studentId,sessionId:ses.id,teachingId:ta.id,date:ses.date,status:'present',updatedAt:STAMP}],
    scores:[{id:scoreId(studentId,item.id),studentId,itemId:item.id,value:9,updatedAt:STAMP}],
    notes:[makeNote({studentId,teachingId:ta.id,sessionId:ses.id,text:'TEST note'})],
    logs:[{id:'log:local',studentId,teachingId:ta.id,sessionId:ses.id,date:ses.date,kind:'participation',delta:1,updatedAt:STAMP}]};
  await store.save(graph);
  await store.patchDevice({groupArrangements:{[ta.id]:[[studentId]]}});
  await pg.query("insert into rakeezx.students(id,name) values('student:cloud','TEST cloud student')");
  await pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,start_date) values('en:cloud','student:cloud',$1,'2026-09-01')`,[B]);
  await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,note) values($1,$2,'2026-09-06',1,'TEST cloud history')`,[sessionId(TB.id,ses.date,1),TB.id]);
  await pg.query(`insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('at:cloud','student:cloud',$1,$2,'2026-09-06','absent')`,[sessionId(TB.id,ses.date,1),TB.id]);
  await pg.query(`insert into rakeezx.items(id,teaching_id,name,max) values('item:cloud',$1,'TEST homework',10)`,[TB.id]);
  await pg.query("insert into rakeezx.scores(id,student_id,item_id,value) values('score:cloud','student:cloud','item:cloud',7)");
  const tables=new Set([...core.matchAll(/create table rakeezx\.(\w+) \(/g)].map(match=>match[1]));
  const cloudSnapshot=async()=>Object.fromEntries(await Promise.all(['sections','teachings','students','enrollments','sessions','attendance','items','scores'].map(async table=>[table,(await pg.query(`select * from rakeezx.${table} order by id`)).rows])));
  const readLocal=async()=>Object.fromEntries(await Promise.all(['students','items','scores','slots','sessions','attendance','notes','logs','device'].map(async name=>[name,await db.getAll(name)])));
  const beforeLocal=await readLocal(),beforeCloud=await cloudSnapshot();
  const backend={
    async fetchRecords(table){assert.ok(tables.has(table));return(await pg.query(`select * from rakeezx.${table} where owner_id=$1`,[OWNER])).rows;},
    async fetchTeachingPresence(id){return(await pg.query('select * from rakeezx.teachings where owner_id=$1 and id=$2 limit 1',[OWNER,id])).rows;},
    async upsertRecords(table,records){
      assert.equal(table,'teachings','Existing parent records must not be rewritten by the fixture');
      for(const record of records) await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at)
        values($1,$2,$3,$4,$5) on conflict(owner_id,id) do update set section_id=excluded.section_id`,[record.id,record.section_id,record.subject_id,record.term_id,record.client_updated_at]);
    },
  };
  cloud.setMockBackend(backend);cloud.setMockAuth({id:OWNER},{access_token:'TEST'});
  for(let attempt=0;attempt<2;attempt++) {
    assert.equal(await sync.syncAll({full:false}),false,'Known blocker: graph convergence is NOT passing');
    assert.equal(sync.state.results.structural.code,'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION');
    assert.equal(sync.state.results.structural.retryable,false);
    assert.deepEqual(await readLocal(),beforeLocal);
    assert.deepEqual(await cloudSnapshot(),beforeCloud);
    assert.equal((await db.get('teachings',ta.id)).sectionId,B);
    assert.deepEqual(await db.get('enrollments',enrollment.id),{...enrollment,sectionId:B});
    const pending=await db.getAll('outbox');
    assert.ok(pending.some(entry=>entry.store==='teachings'&&entry.recordId===ta.id));
    assert.ok(pending.some(entry=>entry.store==='scores'&&entry.recordId===graph.scores[0].id));
    assert.equal(pending.some(entry=>entry.store==='teachings'&&entry.op==='delete'),false);
  }
});
