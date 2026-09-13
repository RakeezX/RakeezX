import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lifecycleServer, academicFixture, lifecycle, evidence } from './helpers/student-lifecycle-server.mjs';
let pg;
before(async () => { pg = await lifecycleServer(); });
after(async () => { await pg?.close(); });

test('Riyadh calendar dates at 00:01, 02:59, 03:01 and daytime ignore DB timezone', async () => {
  const times = ['2026-09-12T21:01:00Z', '2026-09-12T23:59:00Z',
    '2026-09-13T00:01:00Z', '2026-09-13T10:00:00Z'];
  for (const timezone of ['UTC', 'Asia/Riyadh', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    await pg.query(`select set_config('TimeZone',$1,false)`, [timezone]);
    for (const time of times) {
      assert.equal((await pg.query(`select rakeezx.student_lifecycle_date($1::timestamptz)::text date`, [time])).rows[0].date,
        '2026-09-13', `${time} with DB timezone ${timezone}`);
    }
  }
  await pg.exec(`set timezone='UTC'`);
  assert.equal((await pg.query(`select '2026-09-12T21:01:00Z'::timestamptz::date::text date`)).rows[0].date, '2026-09-12');
  const definition = (await pg.query(`select pg_get_functiondef('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure) definition`)).rows[0].definition;
  assert.match(definition, /student_lifecycle_date\(clock_timestamp\(\)\)/);
  assert.doesNotMatch(definition, /current_date|start_date\s*=/i);
});

test('pristine deletion tombstones only unused identity/membership; receipt retries and stale device writes are safe', async () => {
  const f = await academicFixture(pg, 'unused');
  const result = await lifecycle(pg, 'delete_pristine', { studentId: f.student });
  assert.equal(result.outcome, 'applied');
  assert.ok(result.student.deleted_at);
  await assert.rejects(pg.query(`update rakeezx.students set deleted_at=null where id=$1`, [f.student]), /STUDENT_TOMBSTONED/);
  assert.ok(result.enrollments.find((row) => row.id === f.enrollment).deleted_at);
  assert.deepEqual(await lifecycle(pg, 'delete_pristine', { studentId: f.student }), result);
  const stale = (await pg.query(`select rakeezx.apply_sync_v2_mutation('students',$1,'stale-device','device-b',1,'{"name":"stale"}','patch',200) result`, [f.student])).rows[0].result;
  assert.equal(stale.outcome, 'tombstoned');
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.students where id=$1 and deleted_at is null`, [f.student])).rows[0].n, 0);
});

for (const kind of ['attendance', 'scores', 'logs', 'notes', 'inline-note', 'roster-snapshot', 'closed-term-report', 'membership-history', 'archived']) {
  test(`${kind} protects student without a destructive cascade`, async () => {
    const f = await academicFixture(pg, kind);
    await evidence(pg, f, kind);
    const result = await lifecycle(pg, 'delete_pristine', { studentId: f.student });
    assert.equal(result.outcome, 'protected');
    assert.equal(result.code, 'NOT_PRISTINE');
    assert.equal(result.student.deleted_at, null);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.students where id=$1 and deleted_at is null`, [f.student])).rows[0].n, 1);
  });
}

test('exact source ends immediately, preserves original interval/history and is idempotent', async () => {
  const f = await academicFixture(pg, 'end');
  for (const kind of ['attendance', 'scores', 'logs', 'notes', 'closed-term-report']) await evidence(pg, f, kind);
  const before = {};
  for (const name of ['attendance', 'scores', 'logs', 'notes', 'closed_term_reports']) before[name] = (await pg.query(`select * from rakeezx.${name}`)).rows;
  const payload = { studentId: f.student, sourceEnrollmentId: f.enrollment, sourceRevision: 1 };
  const ended = await lifecycle(pg, 'end_enrollment', payload);
  assert.equal(ended.outcome, 'applied');
  assert.equal(ended.student.status, 'withdrawn');
  assert.equal(ended.enrollments.find((row) => row.id === f.enrollment).status, 'withdrawn');
  assert.equal(ended.enrollments.find((row) => row.id === f.enrollment).start_date, '2026-08-01');
  const saudiDate = (await pg.query(`select rakeezx.student_lifecycle_date(clock_timestamp())::text date`)).rows[0].date;
  assert.equal(ended.enrollments.find((row) => row.id === f.enrollment).end_date, saudiDate);
  assert.deepEqual(await lifecycle(pg, 'end_enrollment', payload), ended);
  for (const name of Object.keys(before)) assert.deepEqual((await pg.query(`select * from rakeezx.${name}`)).rows, before[name]);
  await assert.rejects(pg.query(`insert into rakeezx.logs(id,student_id,teaching_id,date,kind,delta) values('future-log',$1,$2,$3,'participation',1)`, [f.student, f.teaching, saudiDate]), /ENROLLMENT_ENDED/);
  await assert.rejects(pg.query(`insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('future-att',$1,$2,$3,$4,'present')`, [f.student, f.session, f.teaching, saudiDate]), /ENROLLMENT_ENDED/);
  await assert.rejects(lifecycle(pg, 'reinstate', { studentId: f.student, destinationSectionId: f.section }), /Invalid student lifecycle command/);
  assert.equal((await lifecycle(pg, 'end_enrollment', payload, 'second-end')).code, 'STALE_SOURCE_ENROLLMENT');
  const protectedAgain = await lifecycle(pg, 'delete_pristine', { studentId: f.student });
  assert.equal(protectedAgain.code, 'NOT_PRISTINE');
});

test('two synthetic devices: A to B transfer preserves identity; stale A ending never ends B', async () => {
  const f = await academicFixture(pg, 'transfer');
  await evidence(pg, f, 'scores');
  const scoreBefore = (await pg.query(`select * from rakeezx.scores where student_id=$1`, [f.student])).rows;
  const payload = { studentId: f.student, sourceEnrollmentId: f.enrollment,
    destinationEnrollmentId: `en:${f.student}:${f.destination}`, destinationSectionId: f.destination, date: '2026-08-03' };
  const transfer = (await pg.query(`select rakeezx.apply_sync_v2_enrollment_command('transfer-device-b','device-b','transfer',$1::jsonb,100) result`, [JSON.stringify(payload)])).rows[0].result;
  assert.equal(transfer.outcome, 'applied');
  const stale = await lifecycle(pg, 'end_enrollment', { studentId: f.student, sourceEnrollmentId: f.enrollment, sourceRevision: 1 }, 'stale-a');
  assert.equal(stale.code, 'STALE_SOURCE_ENROLLMENT');
  assert.equal(stale.enrollments.filter((row) => row.student_id === f.student && row.status === 'active')[0].section_id, f.destination);
  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_enrollment_command('legacy-stale','device-a','withdraw',$1::jsonb,200)`,
    [JSON.stringify({ studentId: f.student, sourceEnrollmentId: f.enrollment })]), /STALE_SOURCE_ENROLLMENT/);
  assert.deepEqual((await pg.query(`select * from rakeezx.scores where student_id=$1`, [f.student])).rows, scoreBefore);
});

test('live parent guard covers direct and V2 child writes; either delete/write ordering is safe', async () => {
  const f = await academicFixture(pg, 'children');
  await lifecycle(pg, 'delete_pristine', { studentId: f.student });
  for (const kind of ['scores', 'logs', 'notes', 'attendance', 'roster-snapshot']) await assert.rejects(evidence(pg, f, kind), /STUDENT_TOMBSTONED/);
  await assert.rejects(pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,status) values('stale-en',$1,$2,'active')`, [f.student, f.destination]), /STUDENT_TOMBSTONED/);
  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_mutation('scores','new-score','new-score-mutation','device-b',0,$1::jsonb,'create',200)`,
    [JSON.stringify({ student_id: f.student, item_id: f.item, value: 0 })]), /STUDENT_TOMBSTONED/);
  const live = await academicFixture(pg, 'write-first');
  await evidence(pg, live, 'scores');
  assert.equal((await lifecycle(pg, 'delete_pristine', { studentId: live.student })).code, 'NOT_PRISTINE');
  assert.equal(Number((await pg.query(`select value from rakeezx.scores where student_id=$1`, [live.student])).rows[0].value), 0);
});

test('authority rejects anonymous requests and mutation identity reuse', async () => {
  const f = await academicFixture(pg, 'auth');
  await lifecycle(pg, 'delete_pristine', { studentId: f.student });
  await assert.rejects(lifecycle(pg, 'delete_pristine', { studentId: f.student, extra: true }, `delete_pristine:${f.student}`), /Mutation ID reused/);
  await pg.exec('set role anon');
  await assert.rejects(lifecycle(pg, 'delete_pristine', { studentId: f.student }), /permission denied/);
  await pg.exec('reset role');
});

test('generic/legacy deletion cannot bypass pristine authority; legacy active children reject updates after parent tombstone', async () => {
  const f = await academicFixture(pg, 'bypass');
  await evidence(pg, f, 'scores');
  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_mutation('students',$1,'unsafe-generic','device-b',1,'{}','delete',200)`, [f.student]), /USE_PRISTINE_STUDENT_COMMAND/);
  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_lifecycle_command('unsafe-cascade','device-b','delete_student',$1,200)`, [f.student]), /USE_PRISTINE_STUDENT_COMMAND/);
  assert.equal((await pg.query(`select deleted_at from rakeezx.scores where student_id=$1`, [f.student])).rows[0].deleted_at, null, 'failed old cascade rolled back');
  // Synthetic pre-existing legacy state, not a supported Product deletion path.
  await pg.query(`select set_config('rakeezx.pristine_student_delete','on',false)`);
  await pg.query(`update rakeezx.students set deleted_at=clock_timestamp() where id=$1`, [f.student]);
  await pg.query(`select set_config('rakeezx.pristine_student_delete','off',false)`);
  await assert.rejects(pg.query(`update rakeezx.scores set value=5 where student_id=$1`, [f.student]), /STUDENT_TOMBSTONED/);
  assert.equal(Number((await pg.query(`select value from rakeezx.scores where student_id=$1`, [f.student])).rows[0].value), 0);
});

test('cleared inline notes and reward receipts still count as meaningful history', async () => {
  const f = await academicFixture(pg, 'cleared-note');
  await pg.query(`select rakeezx.apply_sync_v2_mutation('students',$1,'note-written','device-a',1,'{"note":"history"}','patch',200)`, [f.student]);
  await pg.query(`update rakeezx.students set note='' where id=$1`, [f.student]);
  assert.equal((await lifecycle(pg, 'delete_pristine', { studentId: f.student })).reason, 'lifecycle-history');
  const r = await academicFixture(pg, 'reward-receipt');
  await pg.query(`insert into rakeezx.sync_mutation_receipts
    (owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
    values(auth.uid(),'retained-reward','class_goals','goal','device-a',1,'goal_reward','{}','{}','applied','{}','{}',$1::jsonb)`,
    [JSON.stringify({ recipients: [{ studentId: r.student }] })]);
  assert.equal((await lifecycle(pg, 'delete_pristine', { studentId: r.student })).reason, 'lifecycle-history');
});

test('schema/privileges match manual handoff and malformed commands cannot mutate data', async () => {
  const verification = await readFile(new URL('../supabase/verify-0029-student-lifecycle.sql', import.meta.url), 'utf8');
  // The frozen handoff hash identifies the canonical LF Git asset, not Windows checkout CRLF conversion.
  const frozen = Buffer.from((await readFile(new URL('../supabase/migrations/0029_student_lifecycle_safety.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n'));
  const handoff = await readFile(new URL('../docs/STUDENT_LIFECYCLE_0029_MANUAL_HANDOFF.md', import.meta.url), 'utf8');
  assert.ok(handoff.includes(`SHA256: ${createHash('sha256').update(frozen).digest('hex')}`));
  const normalized = (text) => text.replaceAll('\r\n', '\n').trimEnd();
  assert.ok(normalized(handoff).includes(normalized(frozen.toString('utf8'))));
  assert.ok(normalized(handoff).includes(normalized(verification)));
  const checks = await pg.exec(verification);
  assert.deepEqual(checks.map((result) => result.rows.length), [1, 6, 3, 2, 1, 7, 27, 3, 1, 11, 22, 3]);
  const expected = (await pg.query(`select relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='rakeezx' and c.relname='student_lifecycle_receipts'`)).rows[0];
  assert.deepEqual(expected, { relrowsecurity: true, relforcerowsecurity: true });
  assert.equal((await pg.query(`select count(*)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='rakeezx' and t.tgname='00_student_lifecycle_safety' and not t.tgisinternal`)).rows[0].n, 11);
  const rights = (await pg.query(`select has_function_privilege('authenticated','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','execute') authenticated,
    has_function_privilege('anon','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','execute') anon,
    has_table_privilege('authenticated','rakeezx.student_lifecycle_receipts','select') receipt_read`)).rows[0];
  assert.deepEqual(rights, { authenticated: true, anon: false, receipt_read: false });
  const f = await academicFixture(pg, 'invalid');
  await assert.rejects(lifecycle(pg, null, { studentId: f.student, destinationSectionId: f.section }), /Invalid student lifecycle/);
  await assert.rejects(lifecycle(pg, 'end_enrollment', { studentId: f.student, sourceEnrollmentId: f.enrollment, sourceRevision: 1, date: '2099-01-01' }), /IMMEDIATE_ONLY/);
  assert.equal((await pg.query(`select status from rakeezx.enrollments where id=$1`, [f.enrollment])).rows[0].status, 'active');
});

test('installation is additive and precondition failure rolls back every new object', async () => {
  const base = await lifecycleServer({ migration29: false });
  try {
    const f = await academicFixture(base, 'installation');
    const records = async () => (await base.query(`select to_jsonb(s) student,to_jsonb(e) enrollment
      from rakeezx.students s join rakeezx.enrollments e on e.student_id=s.id and e.owner_id=s.owner_id where s.id=$1`, [f.student])).rows;
    const before = await records();
    const sql = await readFile(new URL('../supabase/migrations/0029_student_lifecycle_safety.sql', import.meta.url), 'utf8');
    // A late legacy-RPC drift deliberately fails AFTER provisional DDL.
    await base.exec(`alter function rakeezx.renumber_enrollment_roster(text,jsonb) security definer`);
    await assert.rejects(base.exec(sql), /MIGRATION_0029_LEGACY_RPC_PRECONDITION_FAILED/);
    await base.exec('rollback');
    assert.equal((await base.query(`select to_regclass('rakeezx.student_lifecycle_receipts') name`)).rows[0].name, null);
    assert.equal((await base.query(`select count(*)::int n from pg_trigger where tgname like '00_student_lifecycle%'`)).rows[0].n, 0);
    assert.deepEqual(await records(), before);
    await base.exec(`alter function rakeezx.renumber_enrollment_roster(text,jsonb) security invoker`);
    await base.exec(sql);
    assert.deepEqual(await records(), before, 'install does not rewrite existing Product rows');
  } finally { await base.close(); }
});
