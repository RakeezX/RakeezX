import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lifecycleServer, academicFixture, lifecycle, evidence, OWNER } from './helpers/student-lifecycle-server.mjs';
let pg;
before(async()=>{pg=await lifecycleServer();});
after(async()=>{await pg?.close();});
const preview = async (f, revision=1) => (await pg.query(`select rakeezx.preview_student_removal($1,$2,$3) result`,
  [f.student,f.enrollment,revision])).rows[0].result;
const onlyClassification = result => {
  assert.deepEqual(Object.keys(result).sort(),['outcome','reason','retryable']);
  assert.equal(typeof result.retryable,'boolean');
};
const snapshot = async () => {
  const tables=(await pg.query(`select tablename from pg_tables where schemaname='rakeezx' order by tablename`)).rows;
  return Object.fromEntries(await Promise.all(tables.map(async({tablename})=>[tablename,
    (await pg.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from rakeezx.${tablename} t`)).rows[0].data])));
};
test('pristine preview returns only classification and changes ZERO rows, revisions, receipts or history',async()=>{
  const f=await academicFixture(pg,'preview-pristine'), before=await snapshot();
  const result=await preview(f);
  assert.deepEqual(result,{outcome:'delete_pristine',reason:'pristine',retryable:false}); onlyClassification(result);
  assert.deepEqual(await preview(f),result);
  assert.deepEqual(await snapshot(),before);
  await pg.exec('begin read only');
  assert.deepEqual(await preview(f),result,'RPC is usable in a read-only transaction');
  await pg.exec('rollback');
});
for(const kind of ['attendance','scores','logs','notes','inline-note','roster-snapshot','closed-term-report']) {
  test(`${kind} previews end enrollment using the SAME execution pristine guard`,async()=>{
    const f=await academicFixture(pg,`preview-${kind}`); await evidence(pg,f,kind);
    const before=await snapshot(), result=await preview(f);
    assert.deepEqual(result,{outcome:'end_enrollment',reason:'history_exists',retryable:false}); onlyClassification(result);
    assert.deepEqual(await snapshot(),before);
    assert.equal((await lifecycle(pg,'delete_pristine',{studentId:f.student})).code,'NOT_PRISTINE');
  });
}
test('retained/deleted evidence and cleared-note receipts still prevent pristine classification',async()=>{
  const f=await academicFixture(pg,'preview-retained'); await evidence(pg,f,'notes');
  await pg.query(`update rakeezx.notes set deleted_at=clock_timestamp() where student_id=$1`,[f.student]);
  assert.equal((await preview(f)).outcome,'end_enrollment');
  const n=await academicFixture(pg,'preview-cleared');
  await pg.query(`select rakeezx.apply_sync_v2_mutation('students',$1,'preview-note-written','a',1,'{"note":"synthetic"}','patch',100)`,[n.student]);
  await pg.query(`update rakeezx.students set note='' where id=$1`,[n.student]);
  assert.equal((await preview(n)).outcome,'end_enrollment');
});
test('stale revision, ended/wrong source, archived source and tombstone block with safe reasons',async()=>{
  const f=await academicFixture(pg,'preview-source');
  assert.deepEqual(await preview(f,0),{outcome:'blocked',reason:'stale_source',retryable:true});
  assert.equal((await preview({...f,enrollment:'not-this-membership'})).reason,'stale_source');
  await evidence(pg,f,'archived');
  const archivedRevision=(await pg.query(`select revision from rakeezx.enrollments where id=$1`,[f.enrollment])).rows[0].revision;
  assert.deepEqual(await preview(f,archivedRevision),{outcome:'blocked',reason:'archived_enrollment',retryable:false});
  const d=await academicFixture(pg,'preview-deleted'); await lifecycle(pg,'delete_pristine',{studentId:d.student});
  assert.deepEqual(await preview(d),{outcome:'blocked',reason:'student_deleted',retryable:false});
  const e=await academicFixture(pg,'preview-ended'); await lifecycle(pg,'end_enrollment',{studentId:e.student,sourceEnrollmentId:e.enrollment,sourceRevision:1});
  assert.equal((await preview(e)).reason,'stale_source');
  assert.equal((await preview({...e,student:'unknown'})).reason,'student_unavailable');
});
test('other-device evidence after preview is rechecked at deletion execution, never trusted',async()=>{
  const f=await academicFixture(pg,'preview-toctou'); assert.equal((await preview(f)).outcome,'delete_pristine');
  await evidence(pg,f,'scores');
  assert.equal((await lifecycle(pg,'delete_pristine',{studentId:f.student})).code,'NOT_PRISTINE');
  assert.equal((await preview(f)).outcome,'end_enrollment');
  const before=(await pg.query(`select to_jsonb(t) data from rakeezx.scores t where student_id=$1`,[f.student])).rows;
  assert.equal((await lifecycle(pg,'end_enrollment',{studentId:f.student,sourceEnrollmentId:f.enrollment,sourceRevision:1})).outcome,'applied');
  assert.deepEqual((await pg.query(`select to_jsonb(t) data from rakeezx.scores t where student_id=$1`,[f.student])).rows,before);
});
test('transfer after preview remains unchanged and stale ending cannot affect the new membership',async()=>{
  const f=await academicFixture(pg,'preview-transfer'); assert.equal((await preview(f)).outcome,'delete_pristine');
  const result=(await pg.query(`select rakeezx.apply_sync_v2_enrollment_command('preview-transfer-b','b','transfer',$1::jsonb,100) result`,
    [JSON.stringify({studentId:f.student,sourceEnrollmentId:f.enrollment,destinationEnrollmentId:`new:${f.student}`,destinationSectionId:f.destination,date:'2026-08-03'})])).rows[0].result;
  assert.equal(result.outcome,'applied'); assert.equal((await preview(f)).reason,'stale_source');
  assert.equal((await lifecycle(pg,'end_enrollment',{studentId:f.student,sourceEnrollmentId:f.enrollment,sourceRevision:1})).code,'STALE_SOURCE_ENROLLMENT');
  const newRevision=(await pg.query(`select revision from rakeezx.enrollments where id=$1`,[`new:${f.student}`])).rows[0].revision;
  assert.equal((await preview({...f,enrollment:`new:${f.student}`},newRevision)).outcome,'end_enrollment');
});
test('authenticated-only RPC derives owner, denies private helpers/anon and returns no other-owner evidence',async()=>{
  const f=await academicFixture(pg,'preview-rls');
  await pg.exec('set role authenticated'); assert.equal((await preview(f)).outcome,'delete_pristine');
  await assert.rejects(pg.query(`select rakeezx.student_removal_source_blocker($1,$2,$3,1)`,[OWNER,f.student,f.enrollment]),/permission denied/);
  await pg.exec('reset role');
  await pg.exec(`update auth.current_identity set id='22222222-2222-4222-8222-222222222222'`);
  assert.deepEqual(await preview(f),{outcome:'blocked',reason:'student_unavailable',retryable:true});
  await pg.query('update auth.current_identity set id=$1',[OWNER]);
  await pg.exec('set role anon'); await assert.rejects(preview(f),/permission denied/); await pg.exec('reset role');
  await pg.exec('update auth.current_identity set id=null'); await assert.rejects(preview(f),/Authentication required/);
  await pg.query('update auth.current_identity set id=$1',[OWNER]);
  assert.deepEqual(await preview({...f,student:''}),{outcome:'blocked',reason:'invalid_source',retryable:false});
});
test('migration is additive, shares source check and aborts atomically on drift without rewriting records',async()=>{
  const base=await lifecycleServer({migration30:false});
  try {
    const f=await academicFixture(base,'preview-install');
    const records=async()=> (await base.query(`select to_jsonb(s) student,to_jsonb(e) enrollment from rakeezx.students s
      join rakeezx.enrollments e on e.student_id=s.id where s.id=$1`,[f.student])).rows;
    const before=await records(), sql=await readFile(new URL('../supabase/migrations/0030_student_removal_preview.sql',import.meta.url),'utf8');
    const original=(await base.query(`select pg_get_functiondef('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure) def`)).rows[0].def;
    await base.exec(original.replace("v_e.status<>'active'","v_e.status != 'active'"));
    await assert.rejects(base.exec(sql),/MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT: rakeezx.apply_student_lifecycle_command/); await base.exec('rollback');
    assert.equal((await base.query(`select to_regprocedure('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)') name`)).rows[0].name,null);
    await base.exec(original); await base.exec(sql); assert.deepEqual(await records(),before);
    const def=(await base.query(`select prosrc from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure`)).rows[0].prosrc;
    assert.match(def,/student_removal_source_blocker\(v_owner,v_student,v_source,v_expected\)/);
    assert.match(def,/pristine_student_blocker\(v_owner,v_student\)/);
  } finally {await base.close();}
});
