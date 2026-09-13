import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lifecycleServer, academicFixture } from './helpers/student-lifecycle-server.mjs';
const filename=new URL('../supabase/migrations/0030_student_removal_preview.sql',import.meta.url);
const hash='a368b7e343884a9406eda26206e13ecb36107cb70dd14525ce5dfbe778d68d4d';
const prefile=new URL('../supabase/precheck-0030-student-removal-preview.sql',import.meta.url);
const postfile=new URL('../supabase/verify-0030-student-removal-preview.sql',import.meta.url);
const fingerprint=results=>results.flatMap(result=>result.rows).find(row=>row.security_metadata_sha256)?.security_metadata_sha256;

test('frozen migration and manual metadata verification are safe, exact and preserve Product/security metadata',async()=>{
  const bytes=await readFile(filename),migration=bytes.toString('utf8');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'SQL change invalidates this freeze');
  const handoff=await readFile(new URL('../docs/STUDENT_REMOVAL_PREVIEW_0030_MANUAL_HANDOFF.md',import.meta.url),'utf8');
  assert.ok(handoff.includes(hash));
  assert.ok(handoff.replaceAll('\r\n','\n').includes(migration.replaceAll('\r\n','\n').trimEnd()),'handoff SQL is full and exact');
  const pre=await readFile(prefile,'utf8'),post=await readFile(postfile,'utf8');
  assert.ok(handoff.includes(createHash('sha256').update(await readFile(prefile)).digest('hex')));
  assert.ok(handoff.includes(createHash('sha256').update(await readFile(postfile)).digest('hex')));
  const freeze=JSON.parse(await readFile(new URL('../docs/STUDENT_REMOVAL_PREVIEW_0030_FREEZE.json',import.meta.url),'utf8'));
  assert.equal(freeze.manualRetryReady,true);
  assert.equal(freeze.confirmedFailureLocation,'MIGRATION EXECUTION ALONE; POSTCHECK NOT RUN');
  assert.ok(handoff.includes('READY FOR MANUAL RETRY: YES'));
  assert.ok(handoff.includes('does not prove that line endings caused the historical failure'));
  for(const entry of freeze.files) {
    const actual=await readFile(new URL(`../${entry.path}`,import.meta.url));
    assert.equal(createHash('sha256').update(actual).digest('hex'),entry.sha256,`freeze changed: ${entry.path}`);
  }
  for(const sql of [pre,post]) {
    assert.match(sql,/set transaction read only/);
    // These two dollar-quoted values are inert source text for the catalog-only
    // dry run, not SELECT statements. Never execute them in PRECHECK.
    const executable=sql.replace(/\$(old|new)\$[\s\S]*?\$\1\$/g,'');
    assert.doesNotMatch(executable,/\b(?:from|join|update|insert into|delete from)\s+rakeezx\./i,'only catalogs, never Product rows');
    assert.doesNotMatch(executable.replace(/'(?:''|[^'])*'/g,'').replace(/--[^\n]*/g,''),/\bexecute\b/i,'verification never executes dynamic DDL or source text');
  }
  const pg=await lifecycleServer({migration30:false});
  try {
    const f=await academicFixture(pg,'manual-metadata-only');
    const records=async()=> (await pg.query(`select to_jsonb(s) student,to_jsonb(e) enrollment from rakeezx.students s
      join rakeezx.enrollments e on e.student_id=s.id where s.id=$1`,[f.student])).rows;
    const before=await records(),securityBefore=fingerprint(await pg.exec(pre));
    assert.match(securityBefore,/^[a-f0-9]{64}$/);
    await pg.exec(migration);
    const checks=await pg.exec(post);
    assert.equal(fingerprint(checks),securityBefore);
    assert.ok(checks.flatMap(result=>result.rows).some(row=>row.verification==='FROZEN_FUNCTION_DEFINITIONS_AND_PRIVILEGES_PASS'));
    assert.deepEqual(await records(),before);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.student_lifecycle_receipts`)).rows[0].n,0);
    await assert.rejects(pg.exec(pre),/ALREADY_PARTLY_OR_FULLY_INSTALLED/);await pg.exec('rollback');
    await assert.rejects(pg.exec(migration),/ALREADY_PARTLY_OR_FULLY_INSTALLED/);await pg.exec('rollback');
    assert.equal(fingerprint(await pg.exec(post)),securityBefore,'repeat failure rolls back safely');
    assert.deepEqual(await records(),before);
  }finally{await pg.close();}
});

test('manual verification fails on unsafe function attributes/anon grant and detects table/column/policy drift',async()=>{
  const pg=await lifecycleServer(),post=await readFile(postfile,'utf8');
  try {
    const before=fingerprint(await pg.exec(post));
    await pg.exec('grant execute on function rakeezx.preview_student_removal(text,text,bigint) to anon');
    await assert.rejects(pg.exec(post),/DEFINITION_OR_PRIVILEGE_DRIFT/);await pg.exec('rollback');
    await pg.exec('revoke execute on function rakeezx.preview_student_removal(text,text,bigint) from anon');
    await pg.exec('alter function rakeezx.preview_student_removal(text,text,bigint) security invoker');
    await assert.rejects(pg.exec(post),/DEFINITION_OR_PRIVILEGE_DRIFT/);await pg.exec('rollback');
    await pg.exec('alter function rakeezx.preview_student_removal(text,text,bigint) security definer');
    assert.equal(fingerprint(await pg.exec(post)),before);
    await pg.exec('grant select on rakeezx.students to anon');
    assert.notEqual(fingerprint(await pg.exec(post)),before,'comparison gate detects unexpected table grant');
    await pg.exec('revoke select on rakeezx.students from anon');
    await pg.exec('grant select (name) on rakeezx.students to anon');
    assert.notEqual(fingerprint(await pg.exec(post)),before,'column grants are covered');
    await pg.exec('revoke select (name) on rakeezx.students from anon');
    await pg.exec('create policy handoff_test_only on rakeezx.students for select to anon using (true)');
    assert.notEqual(fingerprint(await pg.exec(post)),before,'policy drift is covered');
    await pg.exec('drop policy handoff_test_only on rakeezx.students');
    assert.equal(fingerprint(await pg.exec(post)),before);
    await pg.exec('alter table rakeezx.students disable trigger "00_student_lifecycle_safety"');
    assert.notEqual(fingerprint(await pg.exec(post)),before,'trigger drift is covered');
    await pg.exec('alter table rakeezx.students enable trigger "00_student_lifecycle_safety"');
    assert.equal(fingerprint(await pg.exec(post)),before);
    const original=(await pg.query(`select pg_get_functiondef('rakeezx.preview_student_removal(text,text,bigint)'::regprocedure) definition`)).rows[0].definition;
    await pg.exec(original.replace("'pristine','retryable'","'pristine' /* hash drift */, 'retryable'"));
    await assert.rejects(pg.exec(post),/DEFINITION_OR_PRIVILEGE_DRIFT/);await pg.exec('rollback');
    await pg.exec(original);assert.equal(fingerprint(await pg.exec(post)),before);
  }finally{await pg.close();}
});
