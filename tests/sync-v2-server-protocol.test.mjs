import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated in-memory PostgreSQL. This test has no Production/Supabase connection.
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const migrationFiles = [
  '0001_core_schema.sql',
  '0002_indexes_triggers_rls.sql',
  '0003_hybrid_calendar.sql',
  '0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql',
  '0008_enrollment_membership_operations.sql',
  '0009_transfer_and_renumber_rosters.sql',
  '0010_profile_report_principal_name.sql',
  '0011_session_roster_snapshots.sql',
  '0012_sync_v2_server_protocol.sql',
  '0013_sync_v2_enrollment_commands.sql',
  '0014_sync_v2_attendance_snapshot_commands.sql',
  '0015_sync_v2_lifecycle_commands.sql',
  '0016_sync_v2_teaching_creation_commands.sql',
  '0017_sync_v2_bulk_attendance_commands.sql',
  '0018_profile_active_time_profile.sql',
];
const migrations = await Promise.all(migrationFiles.map((name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));

let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create table auth.users(id uuid primary key);
    create table auth.current_identity(id uuid not null);
    insert into auth.users values ('${OWNER}'), ('${OTHER_OWNER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path = ''
      as $$select id from auth.current_identity limit 1$$;
  `);
  for (const migration of migrations) await pg.exec(migration.replace(/^\uFEFF/, ''));
});

after(async () => { await pg.close(); });

async function useOwner(ownerId) {
  await pg.query('update auth.current_identity set id = $1', [ownerId]);
}

async function seedStudent(id, owner = OWNER, { name = 'طالب أول', note = '' } = {}) {
  await pg.query(`insert into rakeezx.students
    (id, owner_id, name, note, status, client_updated_at, device_id)
    values ($1, $2, $3, $4, 'active', 1, 'legacy-device')`, [id, owner, name, note]);
}

async function seedAcademicContext(suffix) {
  const yearStart = 1400 + [...suffix].reduce((sum, char) => sum + char.codePointAt(0), 0) % 500;
  const yearId = `year:${suffix}`;
  const termId = `term:${suffix}`;
  const subjectId = `subject:${suffix}`;
  const sectionId = `section:${suffix}`;
  const teachingId = `teaching:${suffix}`;
  const studentId = `student:${suffix}`;
  const sessionId = `session:${suffix}`;
  const itemId = `item:${suffix}`;
  await pg.query(`insert into rakeezx.years
    (id, label, hijri_start, hijri_end, status, client_updated_at, device_id)
    values ($1, $2, $3, $4, 'active', 1, 'seed')`, [yearId, `سنة ${suffix}`, yearStart, yearStart + 1]);
  await pg.query(`insert into rakeezx.terms
    (id, year_id, name, "index", status, client_updated_at, device_id)
    values ($1, $2, $3, 1, 'active', 1, 'seed')`, [termId, yearId, `فصل ${suffix}`]);
  await pg.query(`insert into rakeezx.subjects
    (id, name, slug, client_updated_at, device_id)
    values ($1, $2, $3, 1, 'seed')`, [subjectId, `مادة ${suffix}`, `subject-${suffix}`]);
  await pg.query(`insert into rakeezx.sections
    (id, year_id, grade, label, name, client_updated_at, device_id)
    values ($1, $2, 4, $3, $4, 1, 'seed')`, [sectionId, yearId, suffix, `صف ${suffix}`]);
  await pg.query(`insert into rakeezx.teachings
    (id, section_id, subject_id, term_id, client_updated_at, device_id)
    values ($1, $2, $3, $4, 1, 'seed')`, [teachingId, sectionId, subjectId, termId]);
  await seedStudent(studentId, OWNER, { name: `طالب ${suffix}` });
  await pg.query(`insert into rakeezx.sessions
    (id, teaching_id, date, period, client_updated_at, device_id)
    values ($1, $2, '2026-09-06', 1, 1, 'seed')`, [sessionId, teachingId]);
  await pg.query(`insert into rakeezx.items
    (id, teaching_id, name, max, client_updated_at, device_id)
    values ($1, $2, 'اختبار', 10, 1, 'seed')`, [itemId, teachingId]);
  return { yearId, termId, subjectId, sectionId, teachingId, studentId, sessionId, itemId };
}

async function mutate({
  entity = 'students', recordId, mutationId, deviceId = 'device-a', baseRevision,
  patch = {}, operation = 'patch', clientUpdatedAt = 10,
}) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_mutation(
    $1, $2, $3, $4, $5, $6::jsonb, $7, $8
  ) as result`, [
    entity, recordId, mutationId, deviceId, baseRevision,
    JSON.stringify(patch), operation, clientUpdatedAt,
  ]);
  return result.rows[0].result;
}

async function enrollmentCommand({ mutationId, command = 'transfer', payload, deviceId = 'device-enrollment', clientUpdatedAt = 50 }) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_enrollment_command(
    $1, $2, $3, $4::jsonb, $5
  ) as result`, [mutationId, deviceId, command, JSON.stringify(payload), clientUpdatedAt]);
  return result.rows[0].result;
}

async function attendanceCommand({ mutationId, attendanceId, sessionId, studentId, baseRevision = 0, patch, deviceId = 'device-attendance', clientUpdatedAt = 60 }) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_attendance_command(
    $1, $2, $3, $4, $5, $6, $7::jsonb, $8
  ) as result`, [mutationId, deviceId, attendanceId, sessionId, studentId, baseRevision, JSON.stringify(patch), clientUpdatedAt]);
  return result.rows[0].result;
}

async function fillAttendanceCommand({ mutationId, sessionId, status = 'present', deviceId = 'device-fill', clientUpdatedAt = 90 }) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_fill_attendance_command($1,$2,$3,$4,$5) as result`,
    [mutationId, deviceId, sessionId, status, clientUpdatedAt]);
  return result.rows[0].result;
}

async function lifecycleCommand({ mutationId, command, targetId, deviceId = 'device-lifecycle', clientUpdatedAt = 70 }) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_lifecycle_command($1,$2,$3,$4,$5) as result`,
    [mutationId, deviceId, command, targetId, clientUpdatedAt]);
  return result.rows[0].result;
}

async function teachingCommand({ mutationId, teachingId, sectionId, subjectId, termId, order = 0, itemIds, deviceId = 'device-teaching' }) {
  const result = await pg.query(`select rakeezx.apply_sync_v2_teaching_creation_command($1,$2,$3,$4,$5,$6,$7,$8::jsonb,80) as result`,
    [mutationId, deviceId, teachingId, sectionId, subjectId, termId, order, JSON.stringify(itemIds)]);
  return result.rows[0].result;
}

test('attendance bulk then later explicit overrides use revisions, canonical identity, and idempotent receipts', async () => {
  await useOwner(OWNER);
  const suffix='override-causal';
  const f=await seedAcademicContext(suffix);
  const b=`student:${suffix}:b`,c=`student:${suffix}:c`;
  await seedStudent(b);
  await seedStudent(c);
  for (const [index,id] of [f.studentId,b,c].entries()) await pg.query(`insert into rakeezx.enrollments
    (id,student_id,section_id,roll_no,start_date,status) values ($1,$2,$3,$4,'2026-08-01','active')`,
    [`en:${id}`,id,f.sectionId,index+1]);
  const fill=await fillAttendanceCommand({mutationId:'override-fill',sessionId:f.sessionId,clientUpdatedAt:90});
  assert.equal(fill.applied.length,3);
  const stale=await attendanceCommand({mutationId:'override-stale',attendanceId:`at:${f.studentId}:${f.sessionId}`,sessionId:f.sessionId,studentId:f.studentId,patch:{status:'absent'},clientUpdatedAt:90});
  assert.equal(stale.outcome,'conflict');
  for (const [studentId,status] of [[f.studentId,'absent'],[b,'excused']]) {
    const canonical=fill.applied.find((row)=>row.student_id===studentId);
    const payload={mutationId:`override-${studentId}`,attendanceId:`at:${studentId}:${f.sessionId}`,sessionId:f.sessionId,studentId,
      baseRevision:Number(canonical.revision),patch:{status},clientUpdatedAt:90};
    const result=await attendanceCommand(payload);
    assert.equal(result.outcome,'applied');
    assert.equal(result.attendance.id,canonical.id,'different client ID cannot create a second natural attendance row');
    assert.equal(result.attendance.status,status);
    assert.deepEqual(await attendanceCommand(payload),result);
  }
  assert.deepEqual(await fillAttendanceCommand({mutationId:'override-fill',sessionId:f.sessionId,clientUpdatedAt:90}),fill);
  const again=await fillAttendanceCommand({mutationId:'override-fill-again',sessionId:f.sessionId,clientUpdatedAt:100});
  assert.equal(again.applied.length,0,'fill remains unmarked-only, never overwrite-all');
  assert.equal(again.skipped.length,3);
  const rows=(await pg.query('select student_id,status from rakeezx.attendance where session_id=$1 order by student_id',[f.sessionId])).rows;
  assert.equal(rows.length,3);
  assert.equal(rows.find((row)=>row.student_id===f.studentId).status,'absent');
  assert.equal(rows.find((row)=>row.student_id===b).status,'excused');
  assert.equal(rows.find((row)=>row.student_id===c).status,'present');
});

test('SYNC-V2A server protocol foundation', async (t) => {
  await t.test('covers every current Production synced table and no local-only curriculum table', async () => {
    const expected = [
      'attendance', 'calendar_days', 'calendars', 'enrollments', 'items', 'logs', 'notes',
      'profile', 'scores', 'sections', 'session_roster_snapshots', 'sessions', 'slots',
      'students', 'subjects', 'teachings', 'terms', 'time_profiles', 'years',
    ];
    const result = await pg.query(`select table_name from information_schema.columns
      where table_schema = 'rakeezx' and column_name = 'revision' order by table_name`);
    assert.deepEqual(result.rows.map((row) => row.table_name), expected);
    assert.equal(result.rows.some((row) => ['units', 'lessons'].includes(row.table_name)), false);
    for (const entity of expected) {
      const fields = await pg.query(`select key as field
        from jsonb_each(rakeezx.sync_v2_field_map($1)) order by key`, [entity]);
      assert.ok(fields.rows.length > 0, `${entity} has no V2 field policy`);
      const columns = await pg.query(`select column_name from information_schema.columns
        where table_schema = 'rakeezx' and table_name = $1`, [entity]);
      const known = new Set(columns.rows.map((row) => row.column_name));
      assert.deepEqual(fields.rows.filter((row) => !known.has(row.field)), [], `${entity} field policy references a missing column`);
    }
  });

  await t.test('defines only Product-backed natural identities for canonical create', async () => {
    const naturalSamples = {
      years: { hijri_start: 1448 },
      calendars: { year_id: 'year', source: 'custom' },
      calendar_days: { calendar_id: 'calendar', date: '2026-09-06' },
      terms: { year_id: 'year', index: 1 },
      subjects: { slug: 'math' },
      sections: { year_id: 'year', grade: 4, label: ' أ ' },
      teachings: { section_id: 'section', subject_id: 'subject', term_id: 'term' },
      enrollments: { student_id: 'student', section_id: 'section' },
      scores: { student_id: 'student', item_id: 'item' },
      slots: { teaching_id: 'teaching', weekday: 1, period: 2 },
      sessions: { teaching_id: 'teaching', date: '2026-09-06', period: 2 },
      session_roster_snapshots: { session_id: 'session' },
      attendance: { student_id: 'student', session_id: 'session' },
    };
    for (const [entity, sample] of Object.entries(naturalSamples)) {
      const row = (await pg.query('select rakeezx.sync_v2_natural_key($1, $2::jsonb) as key',
        [entity, JSON.stringify(sample)])).rows[0];
      assert.notEqual(row.key, null, `${entity} should expose a natural identity`);
    }
    for (const entity of ['profile', 'students', 'notes', 'items', 'logs', 'time_profiles']) {
      const row = (await pg.query("select rakeezx.sync_v2_natural_key($1, '{}'::jsonb) as key", [entity])).rows[0];
      assert.equal(row.key, null, `${entity} must remain durable-id only`);
    }
  });

  await t.test('keeps owner-global active Timing Profile selection isolated from unrelated profile fields', async () => {
    await useOwner(OWNER);
    const created = await mutate({
      entity: 'profile', recordId: 'profile', mutationId: 'timing-profile-create', baseRevision: 0, operation: 'create',
      patch: { teacher_name: '', school_name: '', phone: '', report_principal_name: '', active_time_profile_id: null },
    });
    assert.equal(created.outcome, 'applied');
    const timing = await mutate({
      entity: 'profile', recordId: 'profile', mutationId: 'timing-selection', baseRevision: 1,
      patch: { active_time_profile_id: 'time-profile:default:winter' }, clientUpdatedAt: 20,
    });
    assert.deepEqual(timing.appliedGroups, ['timing_selection']);
    const identity = await mutate({
      entity: 'profile', recordId: 'profile', mutationId: 'timing-unrelated-profile-edit', baseRevision: 1,
      patch: { school_name: 'مدرسة مستقلة' }, clientUpdatedAt: 21,
    });
    assert.deepEqual(identity.appliedGroups, ['school_name']);
    const row = (await pg.query(`select active_time_profile_id, school_name from rakeezx.profile where owner_id = $1`, [OWNER])).rows[0];
    assert.equal(row.active_time_profile_id, 'time-profile:default:winter');
    assert.equal(row.school_name, 'مدرسة مستقلة');
  });

  await t.test('creates a canonical row and retries the same mutation idempotently', async () => {
    await useOwner(OWNER);
    const args = {
      recordId: 'student:create', mutationId: 'mutation:create', baseRevision: 0,
      operation: 'create', patch: { name: 'طالب جديد', note: '', status: 'active' },
    };
    const first = await mutate(args);
    const second = await mutate(args);
    assert.deepEqual(second, first);
    assert.equal(first.outcome, 'applied');
    assert.equal(Number(first.resultRevision), 1);
    assert.equal(first.canonical.name, 'طالب جديد');
    assert.equal((await pg.query(`select count(*) from rakeezx.students where id = 'student:create'`)).rows[0].count, 1);
    assert.equal((await pg.query(`select count(*) from rakeezx.sync_mutation_receipts
      where mutation_id = 'mutation:create'`)).rows[0].count, 1);
    await assert.rejects(mutate({ ...args, clientUpdatedAt: 11 }), /Mutation ID was reused/);
  });

  await t.test('canonicalizes three competing logical creates without duplicate identities', async () => {
    await useOwner(OWNER);
    const results = await Promise.all(['a', 'b', 'c'].map((suffix, index) => mutate({
      entity: 'subjects', recordId: `subject:device-${suffix}`,
      mutationId: `mutation:subject-${suffix}`, deviceId: `device-${suffix}`,
      baseRevision: 0, operation: 'create', clientUpdatedAt: 20 + index,
      patch: { name: 'الرياضيات', slug: 'math' },
    })));
    const canonicalIds = new Set(results.map((result) => result.canonicalId));
    assert.equal(canonicalIds.size, 1);
    assert.equal(results.filter((result) => result.outcome === 'applied').length, 1);
    assert.equal(results.filter((result) => result.outcome === 'canonicalized').length, 2);
    assert.equal((await pg.query("select count(*) from rakeezx.subjects where slug = 'math'")).rows[0].count, 1);
    assert.equal((await pg.query("select count(*) from rakeezx.sync_mutation_receipts where entity = 'subjects'")).rows[0].count, 3);
  });

  await t.test('canonicalizes an occupied teacher schedule position across teachings', async () => {
    await useOwner(OWNER);
    const firstContext = await seedAcademicContext('slot-a');
    const secondContext = await seedAcademicContext('slot-long-b');
    const results = await Promise.all([
      mutate({
        entity: 'slots', recordId: 'slot:device-a', mutationId: 'mutation:slot-a',
        deviceId: 'device-a', baseRevision: 0, operation: 'create',
        patch: { teaching_id: firstContext.teachingId, weekday: 1, period: 3 },
      }),
      mutate({
        entity: 'slots', recordId: 'slot:device-b', mutationId: 'mutation:slot-b',
        deviceId: 'device-b', baseRevision: 0, operation: 'create',
        patch: { teaching_id: secondContext.teachingId, weekday: 1, period: 3 },
      }),
    ]);
    assert.equal(new Set(results.map((result) => result.canonicalId)).size, 1);
    assert.equal(results.filter((result) => result.outcome === 'applied').length, 1);
    assert.equal(results.filter((result) => result.outcome === 'canonicalized').length, 1);
    assert.equal((await pg.query('select count(*) from rakeezx.slots where weekday = 1 and period = 3')).rows[0].count, 1);
  });

  await t.test('converges three stale logical clients and preserves the rejected same-field intent', async () => {
    await useOwner(OWNER);
    await seedStudent('student:merge');
    const attempts = [
      { recordId: 'student:merge', mutationId: 'mutation:name-a', deviceId: 'device-a', baseRevision: 1,
        patch: { name: 'طالب من الجهاز أ' } },
      { recordId: 'student:merge', mutationId: 'mutation:note-b', deviceId: 'device-b', baseRevision: 1,
        patch: { note: 'ملاحظة من الجهاز ب' } },
      { recordId: 'student:merge', mutationId: 'mutation:name-c', deviceId: 'device-c', baseRevision: 1,
        patch: { name: 'طالب من الجهاز ج' } },
    ];
    const results = await Promise.all(attempts.map((attempt) => mutate(attempt)));
    const sameField = results.find((result) => result.outcome === 'conflict');
    assert.ok(sameField);
    assert.equal(results.filter((result) => result.outcome === 'applied').length, 2);
    assert.deepEqual(sameField.conflictedGroups, ['name']);
    assert.equal(Number(sameField.resultRevision), 3);
    assert.equal(sameField.canonical.note, 'ملاحظة من الجهاز ب');
    assert.ok(['طالب من الجهاز أ', 'طالب من الجهاز ج'].includes(sameField.canonical.name));
    const receipt = (await pg.query(`select request_patch, conflicted_groups
      from rakeezx.sync_mutation_receipts where owner_id = $1 and mutation_id = $2`,
    [OWNER, sameField.mutationId])).rows[0];
    assert.ok(['طالب من الجهاز أ', 'طالب من الجهاز ج'].includes(receipt.request_patch.name));
    assert.deepEqual(receipt.conflicted_groups, ['name']);
  });

  await t.test('delete wins and a stale normal mutation cannot resurrect the row', async () => {
    await useOwner(OWNER);
    await seedStudent('student:delete');
    const deleted = await mutate({
      recordId: 'student:delete', mutationId: 'mutation:delete', baseRevision: 1,
      operation: 'delete', patch: {},
    });
    assert.equal(deleted.outcome, 'deleted');
    assert.equal(Number(deleted.resultRevision), 2);
    assert.ok(deleted.canonical.deleted_at);

    const stale = await mutate({
      recordId: 'student:delete', mutationId: 'mutation:stale-edit', deviceId: 'device-b',
      baseRevision: 1, patch: { name: 'لا يجب إحياؤه' },
    });
    assert.equal(stale.outcome, 'tombstoned');
    assert.deepEqual(stale.conflictedGroups, ['__deleted__']);
    assert.ok(stale.canonical.deleted_at);
    assert.notEqual(stale.canonical.name, 'لا يجب إحياؤه');
  });

  await t.test('owner scope is derived from auth.uid and the same mutation id is owner-local', async () => {
    await useOwner(OWNER);
    await seedStudent('student:owner', OWNER, { name: 'مالك أول' });
    await useOwner(OTHER_OWNER);
    await seedStudent('student:owner', OTHER_OWNER, { name: 'مالك ثان' });

    await useOwner(OWNER);
    await mutate({ recordId: 'student:owner', mutationId: 'mutation:shared-id', baseRevision: 1, patch: { note: 'أ' } });
    await useOwner(OTHER_OWNER);
    await mutate({ recordId: 'student:owner', mutationId: 'mutation:shared-id', baseRevision: 1, patch: { note: 'ب' } });

    const rows = (await pg.query(`select owner_id, name, note from rakeezx.students
      where id = 'student:owner' order by owner_id`)).rows;
    assert.deepEqual(rows.map((row) => [row.name, row.note]), [['مالك أول', 'أ'], ['مالك ثان', 'ب']]);
    assert.equal((await pg.query(`select count(*) from rakeezx.sync_mutation_receipts
      where mutation_id = 'mutation:shared-id'`)).rows[0].count, 2);
  });

  await t.test('rejects malformed fields and mutation-id request reuse', async () => {
    await useOwner(OWNER);
    await seedStudent('student:validation');
    await assert.rejects(mutate({
      recordId: 'student:validation', mutationId: 'mutation:bad-field', baseRevision: 1,
      patch: { owner_id: OTHER_OWNER },
    }), /Field is not allowed/);
    await assert.rejects(mutate({
      recordId: 'student:validation', mutationId: 'mutation:bad-operation', baseRevision: 1,
      operation: null,
    }), /Invalid sync mutation envelope/);

    const valid = {
      recordId: 'student:validation', mutationId: 'mutation:stable', baseRevision: 1,
      patch: { note: 'طلب أصلي' },
    };
    await mutate(valid);
    await assert.rejects(mutate({ ...valid, patch: { note: 'طلب مختلف' } }), /Mutation ID was reused/);
  });

  await t.test('keeps no-op metadata silent and makes tombstones strictly immutable', async () => {
    await useOwner(OWNER);
    await seedStudent('student:v1');
    let row = (await pg.query(`select revision, name, deleted_at from rakeezx.students
      where owner_id = $1 and id = 'student:v1'`, [OWNER])).rows[0];
    assert.equal(Number(row.revision), 1);

    const noOp = await mutate({
      recordId: 'student:v1', mutationId: 'mutation:no-op', baseRevision: 1,
      patch: { note: '' }, clientUpdatedAt: 20,
    });
    assert.equal(Number(noOp.resultRevision), 1);
    await pg.query(`update rakeezx.students set device_id = 'metadata-only', client_updated_at = 21
      where owner_id = $1 and id = 'student:v1'`, [OWNER]);
    row = (await pg.query(`select revision from rakeezx.students
      where owner_id = $1 and id = 'student:v1'`, [OWNER])).rows[0];
    assert.equal(Number(row.revision), 1);

    await pg.query(`update rakeezx.students set name = 'تعديل V1' where owner_id = $1 and id = 'student:v1'`, [OWNER]);
    await pg.query(`update rakeezx.students set deleted_at = now() where owner_id = $1 and id = 'student:v1'`, [OWNER]);
    const staleWrite = await pg.query(`update rakeezx.students set deleted_at = null, name = 'محاولة V1 قديمة'
      where owner_id = $1 and id = 'student:v1'`, [OWNER]);
    const repeatedDelete = await pg.query(`update rakeezx.students set deleted_at = now()
      where owner_id = $1 and id = 'student:v1'`, [OWNER]);
    row = (await pg.query(`select revision, name, deleted_at, field_revisions from rakeezx.students
      where owner_id = $1 and id = 'student:v1'`, [OWNER])).rows[0];
    assert.equal(staleWrite.affectedRows, 0);
    assert.equal(repeatedDelete.affectedRows, 0);
    assert.equal(Number(row.revision), 3);
    assert.equal(row.name, 'تعديل V1');
    assert.ok(row.deleted_at);
    assert.equal(Number(row.field_revisions.name), 2);
    assert.equal(Number(row.field_revisions.__deleted__), 3);
  });

  await t.test('preserves score zero versus unrecorded null and snapshot immutability', async () => {
    await useOwner(OWNER);
    const scoreContext = await seedAcademicContext('score');
    const zero = await mutate({
      entity: 'scores', recordId: 'score:zero', mutationId: 'mutation:score-zero',
      baseRevision: 0, operation: 'create',
      patch: { student_id: scoreContext.studentId, item_id: scoreContext.itemId, value: 0 },
    });
    assert.equal(zero.canonical.value, 0);
    const unrecorded = await mutate({
      entity: 'scores', recordId: 'score:zero', mutationId: 'mutation:score-null',
      baseRevision: 1, patch: { value: null },
    });
    assert.equal(unrecorded.canonical.value, null);
    assert.equal(Number(unrecorded.resultRevision), 2);

    const snapshotContext = await seedAcademicContext('snapshot');
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ('enrollment:snapshot', $1, $2, $3, 1, '2026-08-01', 'active', 1, 'seed')`, [OWNER, snapshotContext.studentId, snapshotContext.sectionId]);
    const snapshot = await attendanceCommand({
      mutationId: 'mutation:snapshot-create', attendanceId: 'attendance:snapshot',
      sessionId: snapshotContext.sessionId, studentId: snapshotContext.studentId, patch: { status: 'present' },
    });
    assert.equal(snapshot.outcome, 'applied');
    const immutable = await mutate({
      entity: 'session_roster_snapshots', recordId: snapshot.snapshot.id,
      mutationId: 'mutation:snapshot-edit', baseRevision: 1,
      patch: { members: [] },
    });
    assert.equal(immutable.outcome, 'conflict');
    assert.deepEqual(immutable.conflictedGroups, ['__immutable__']);
    await assert.rejects(pg.query(`update rakeezx.session_roster_snapshots set members = '[]'::jsonb where id = $1`, [snapshot.snapshot.id]),
      /immutable/);
  });

  await t.test('keeps existing transfer and roster-renumber commands revision-consistent', async () => {
    await useOwner(OWNER);
    const context = await seedAcademicContext('roster');
    await seedStudent('student:roster-two', OWNER, { name: 'طالب ثان' });
    await pg.query(`insert into rakeezx.enrollments
      (id, student_id, section_id, roll_no, status, client_updated_at, device_id)
      values
      ('enrollment:roster-one', $1, $3, 1, 'active', 1, 'seed'),
      ('enrollment:roster-two', $2, $3, 2, 'active', 1, 'seed')`,
    [context.studentId, 'student:roster-two', context.sectionId]);
    const roster = [
      { id: 'enrollment:roster-one', roll_no: 2, client_updated_at: 30, device_id: 'device-a' },
      { id: 'enrollment:roster-two', roll_no: 1, client_updated_at: 30, device_id: 'device-a' },
    ];
    await pg.query('select rakeezx.renumber_enrollment_roster($1, $2::jsonb)',
      [context.sectionId, JSON.stringify(roster)]);
    const rows = (await pg.query(`select id, roll_no, revision, field_revisions
      from rakeezx.enrollments where section_id = $1 order by id`, [context.sectionId])).rows;
    assert.deepEqual(rows.map((row) => Number(row.roll_no)), [2, 1]);
    for (const row of rows) {
      assert.equal(Number(row.field_revisions.roll), Number(row.revision));
      assert.ok(Number(row.revision) >= 2);
    }
  });

  await t.test('enforces authenticated RLS and denies anonymous protocol execution', async () => {
    await useOwner(OWNER);
    await seedStudent('student:rls-owner', OWNER, { name: 'طالب المالك' });
    await useOwner(OTHER_OWNER);
    await seedStudent('student:rls-other', OTHER_OWNER, { name: 'طالب آخر' });
    await pg.exec('set role authenticated');
    try {
      const visible = await pg.query("select id from rakeezx.students where id like 'student:rls-%' order by id");
      assert.deepEqual(visible.rows.map((row) => row.id), ['student:rls-other']);
      const ownMutation = await mutate({
        recordId: 'student:rls-other', mutationId: 'mutation:rls-own', baseRevision: 1,
        patch: { note: 'مسموح' },
      });
      assert.equal(ownMutation.outcome, 'applied');
      const foreignMutation = await mutate({
        recordId: 'student:rls-owner', mutationId: 'mutation:rls-foreign', baseRevision: 1,
        patch: { note: 'ممنوع' },
      });
      assert.equal(foreignMutation.outcome, 'not_found');
    } finally {
      await pg.exec('reset role');
    }

    await pg.exec('set role anon');
    try {
      await assert.rejects(mutate({
        recordId: 'student:rls-other', mutationId: 'mutation:anon', baseRevision: 1,
        patch: { note: 'ممنوع' },
      }), /permission denied/);
    } finally {
      await pg.exec('reset role');
    }
  });

  await t.test('migration is safely re-runnable without losing protocol receipts', async () => {
    const before = (await pg.query('select count(*) from rakeezx.sync_mutation_receipts')).rows[0].count;
    await pg.exec(migrations.at(-1));
    const after = (await pg.query('select count(*) from rakeezx.sync_mutation_receipts')).rows[0].count;
    assert.equal(after, before);

    await useOwner(OWNER);
    const retried = await mutate({
      recordId: 'student:create', mutationId: 'mutation:create', baseRevision: 0,
      operation: 'create', patch: { name: 'طالب جديد', note: '', status: 'active' },
    });
    assert.equal(retried.outcome, 'applied');
    assert.equal(Number(retried.resultRevision), 1);
  });

  await t.test('enrollment commands are idempotent, serialize conflicting transfers, and return complete sequential rosters', async () => {
    await useOwner(OWNER);
    const suffix = 'v2-command';
    const year = `year:${suffix}`, student = `student:${suffix}`, xOther = `student:${suffix}:x-other`, yOther = `student:${suffix}:y-other`, x = `section:${suffix}:x`, y = `section:${suffix}:y`, z = `section:${suffix}:z`;
    const source = `enrollment:${suffix}:x`, destination = `enrollment:${suffix}:y`;
    await pg.query(`insert into rakeezx.years (id, owner_id, label, hijri_start, hijri_end, status, client_updated_at, device_id)
      values ($1,$2,'سنة',1488,1489,'active',1,'seed')`, [year, OWNER]);
    for (const [id, label] of [[x, 'أ'], [y, 'ب'], [z, 'ج']]) {
      await pg.query(`insert into rakeezx.sections (id, owner_id, year_id, grade, label, name, client_updated_at, device_id)
        values ($1,$2,$3,4,$4,$5,1,'seed')`, [id, OWNER, year, label, `4/${label}`]);
    }
    await seedStudent(student, OWNER, { name: 'طالب نقل' });
    await seedStudent(xOther, OWNER, { name: 'طالب س' });
    await seedStudent(yOther, OWNER, { name: 'طالب ص' });
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ($1,$2,$3,$4,1,'2026-08-01','active',1,'seed')`, [source, OWNER, student, x]);
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ($1,$2,$3,$4,$5,'2026-08-01','active',1,'seed')`, [`enrollment:${suffix}:x-other`, OWNER, xOther, x, 2]);
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ($1,$2,$3,$4,$5,'2026-08-01','active',1,'seed')`, [`enrollment:${suffix}:y-other`, OWNER, yOther, y, 1]);
    const payload = { studentId: student, sourceEnrollmentId: source, destinationEnrollmentId: destination, destinationSectionId: y, date: '2026-09-01', note: 'نقل' };
    const first = await enrollmentCommand({ mutationId: `command:${suffix}:a`, payload });
    const retry = await enrollmentCommand({ mutationId: `command:${suffix}:a`, payload });
    assert.deepEqual(retry, first);
    assert.equal(first.outcome, 'applied');
    assert.equal((await pg.query(`select count(*) from rakeezx.enrollments where owner_id=$1 and student_id=$2 and status='active' and deleted_at is null`, [OWNER, student])).rows[0].count, 1);
    assert.deepEqual((await pg.query(`select roll_no from rakeezx.enrollments where owner_id=$1 and section_id=$2 and status='active' order by roll_no`, [OWNER, x])).rows.map((row) => row.roll_no), [1]);
    assert.deepEqual((await pg.query(`select roll_no from rakeezx.enrollments where owner_id=$1 and section_id=$2 and status='active' order by roll_no`, [OWNER, y])).rows.map((row) => row.roll_no), [1, 2]);

    const same = await enrollmentCommand({ mutationId: `command:${suffix}:same`, payload });
    assert.equal(same.outcome, 'already_applied');
    const conflict = await enrollmentCommand({ mutationId: `command:${suffix}:conflict`, payload: { ...payload, destinationEnrollmentId: `enrollment:${suffix}:z`, destinationSectionId: z } });
    assert.equal(conflict.outcome, 'conflict');
    assert.equal((await pg.query(`select count(*) from rakeezx.enrollments where owner_id=$1 and student_id=$2 and status='active' and deleted_at is null`, [OWNER, student])).rows[0].count, 1);

    const withdrawn = await enrollmentCommand({ mutationId: `command:${suffix}:withdraw`, command: 'withdraw', payload: { studentId: student, date: '2026-09-02', note: 'انسحاب' } });
    const withdrawRetry = await enrollmentCommand({ mutationId: `command:${suffix}:withdraw`, command: 'withdraw', payload: { studentId: student, date: '2026-09-02', note: 'انسحاب' } });
    assert.deepEqual(withdrawRetry, withdrawn);
    assert.equal(withdrawn.outcome, 'applied');
    assert.equal((await pg.query(`select status from rakeezx.students where owner_id=$1 and id=$2`, [OWNER, student])).rows[0].status, 'withdrawn');
    assert.deepEqual((await pg.query(`select roll_no from rakeezx.enrollments where owner_id=$1 and section_id=$2 and status='active' order by roll_no`, [OWNER, y])).rows.map((row) => row.roll_no), [1]);
  });

  await t.test('attendance command atomically creates one immutable snapshot and converges concurrent devices', async () => {
    await useOwner(OWNER);
    const suffix = 'v2-attendance';
    const context = await seedAcademicContext(suffix);
    const secondStudent = `student:${suffix}:two`;
    await seedStudent(secondStudent, OWNER, { name: 'طالب ثان' });
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ($1,$2,$3,$4,$5,'2026-08-01','active',1,'seed'), ($6,$2,$7,$4,$8,'2026-08-01','active',1,'seed')`,
      [`enrollment:${suffix}:one`, OWNER, context.studentId, context.sectionId, 1, `enrollment:${suffix}:two`, secondStudent, 2]);
    const firstPayload = { mutationId: `attendance:${suffix}:a`, attendanceId: `attendance:${suffix}:one`, sessionId: context.sessionId, studentId: context.studentId, patch: { status: 'present' }, deviceId: 'device-a' };
    const [first, second] = await Promise.all([
      attendanceCommand(firstPayload),
      attendanceCommand({ mutationId: `attendance:${suffix}:b`, attendanceId: `attendance:${suffix}:two`, sessionId: context.sessionId, studentId: secondStudent, patch: { status: 'absent' }, deviceId: 'device-b' }),
    ]);
    assert.equal(first.outcome, 'applied');
    assert.equal(second.outcome, 'applied');
    assert.deepEqual(await attendanceCommand(firstPayload), first);
    assert.equal((await pg.query(`select count(*) from rakeezx.session_roster_snapshots where owner_id=$1 and session_id=$2`, [OWNER, context.sessionId])).rows[0].count, 1);
    assert.equal((await pg.query(`select count(*) from rakeezx.attendance where owner_id=$1 and session_id=$2 and deleted_at is null`, [OWNER, context.sessionId])).rows[0].count, 2);
    assert.equal(first.snapshot.members.length, 2);

    const stale = await attendanceCommand({ ...firstPayload, mutationId: `attendance:${suffix}:stale`, patch: { status: 'absent' }, deviceId: 'device-c' });
    assert.equal(stale.outcome, 'conflict');
    assert.equal(stale.attendance.status, 'present');
    const note = await attendanceCommand({ ...firstPayload, mutationId: `attendance:${suffix}:note`, baseRevision: 1, patch: { note: 'ملاحظة' }, deviceId: 'device-c' });
    assert.equal(note.outcome, 'applied');
    assert.equal(note.attendance.note, 'ملاحظة');

    const membersBefore = first.snapshot.members;
    await pg.query(`update rakeezx.enrollments set roll_no = 9 where owner_id=$1 and id=$2`, [OWNER, `enrollment:${suffix}:one`]);
    const snapshotAfter = (await pg.query(`select members from rakeezx.session_roster_snapshots where owner_id=$1 and session_id=$2`, [OWNER, context.sessionId])).rows[0];
    assert.deepEqual(snapshotAfter.members, membersBefore);
    const generic = await mutate({ entity: 'session_roster_snapshots', recordId: `other:${suffix}`, mutationId: `snapshot:${suffix}:generic`, baseRevision: 0, operation: 'create', patch: {
      session_id: context.sessionId, teaching_id: context.teachingId, section_id: context.sectionId, captured_at: '2026-09-06T00:00:00Z', members: [], state: 'complete',
    } });
    assert.equal(generic.outcome, 'canonicalized');
    assert.deepEqual(generic.canonical.members, membersBefore);
  });

  await t.test('bulk attendance receipts return canonical applied and skipped rows and replay unchanged', async () => {
    await useOwner(OWNER);
    const suffix = 'v2-fill-canonical';
    const context = await seedAcademicContext(suffix);
    const secondStudent = `student:${suffix}:two`;
    await seedStudent(secondStudent, OWNER, { name: 'طالب ثان' });
    await pg.query(`insert into rakeezx.enrollments (id, owner_id, student_id, section_id, roll_no, start_date, status, client_updated_at, device_id)
      values ($1,$2,$3,$4,1,'2026-08-01','active',1,'seed'), ($5,$2,$6,$4,2,'2026-08-01','active',1,'seed')`,
      [`enrollment:${suffix}:one`, OWNER, context.studentId, context.sectionId, `enrollment:${suffix}:two`, secondStudent]);
    await attendanceCommand({ mutationId: `attendance:${suffix}:existing`, attendanceId: `attendance:${suffix}:existing`, sessionId: context.sessionId, studentId: context.studentId, patch: { status: 'absent', note: 'canonical note' } });
    const first = await fillAttendanceCommand({ mutationId: `fill:${suffix}`, sessionId: context.sessionId, status: 'present' });
    const retry = await fillAttendanceCommand({ mutationId: `fill:${suffix}`, sessionId: context.sessionId, status: 'present' });
    assert.deepEqual(retry, first, 'lost-response retry must replay the complete stored canonical receipt');
    assert.equal(first.applied.length, 1);
    assert.equal(first.skipped.length, 1);
    const applied = first.applied[0];
    const skipped = first.skipped[0];
    assert.equal(applied.student_id, secondStudent);
    assert.equal(applied.status, 'present');
    assert.equal(skipped.id, `attendance:${suffix}:existing`);
    assert.equal(skipped.session_id, context.sessionId);
    assert.equal(skipped.student_id, context.studentId);
    assert.equal(skipped.status, 'absent');
    assert.equal(skipped.note, 'canonical note');
    assert.equal(skipped.bulkDisposition, 'skipped');
    assert.ok(Number(skipped.revision) > 0);
    assert.equal(typeof skipped.field_revisions, 'object');
  });

  await t.test('lifecycle commands tombstone dependent teaching data atomically and are retry-safe', async () => {
    await useOwner(OWNER);
    const context = await seedAcademicContext('lifecycle');
    const scoreId = 'score:lifecycle';
    await pg.query(`insert into rakeezx.scores (id, owner_id, student_id, item_id, value, client_updated_at, device_id)
      values ($1,$2,$3,$4,0,1,'seed')`, [scoreId, OWNER, context.studentId, context.itemId]);
    const first = await lifecycleCommand({ mutationId: 'lifecycle:teaching:one', command: 'delete_teaching', targetId: context.teachingId });
    const retry = await lifecycleCommand({ mutationId: 'lifecycle:teaching:one', command: 'delete_teaching', targetId: context.teachingId });
    assert.deepEqual(retry, first);
    assert.equal(first.outcome, 'deleted');
    for (const [table, id] of [['teachings', context.teachingId], ['items', context.itemId], ['sessions', context.sessionId], ['scores', scoreId]]) {
      const row = (await pg.query(`select deleted_at from rakeezx.${table} where owner_id=$1 and id=$2`, [OWNER, id])).rows[0];
      assert.ok(row.deleted_at, `${table} must be tombstoned`);
    }
    const stale = await mutate({ entity: 'teachings', recordId: context.teachingId, mutationId: 'lifecycle:stale', baseRevision: 1, patch: { order: 9 } });
    assert.equal(stale.outcome, 'tombstoned');
  });

  await t.test('timing profile metadata merges independently while nested configuration is one conflict group', async () => {
    await useOwner(OWNER);
    const created = await mutate({ entity: 'time_profiles', recordId: 'profile:v2-group', mutationId: 'profile:v2-create', baseRevision: 0, operation: 'create', patch: {
      name: 'ملف', order: 0, periods: [{ number: 1, start: '07:00', end: '07:45' }],
      overrides: { config: { recess: { enabled: false }, gap: 0 } }, active_from: null, active_to: null,
    } });
    assert.equal(created.outcome, 'applied');
    const metadata = await mutate({ entity: 'time_profiles', recordId: 'profile:v2-group', mutationId: 'profile:v2-name', baseRevision: 1, patch: { name: 'ملف جديد' } });
    assert.equal(metadata.outcome, 'applied');
    const configuration = await mutate({ entity: 'time_profiles', recordId: 'profile:v2-group', mutationId: 'profile:v2-config', baseRevision: 1, patch: { periods: [{ number: 1, start: '08:00', end: '08:45' }] } });
    assert.equal(configuration.outcome, 'applied');
    const staleConfiguration = await mutate({ entity: 'time_profiles', recordId: 'profile:v2-group', mutationId: 'profile:v2-stale-config', baseRevision: 1, patch: { overrides: { config: { recess: { enabled: true, after: 1 }, gap: 5 } } } });
    assert.equal(staleConfiguration.outcome, 'conflict');
    assert.deepEqual(staleConfiguration.conflictedGroups, ['configuration']);
  });

  await t.test('teaching creation canonicalizes three clients and creates Product defaults exactly once', async () => {
    await useOwner(OWNER);
    const context = await seedAcademicContext('teaching-command');
    const subject = 'subject:teaching-command:two';
    await pg.query(`insert into rakeezx.subjects(id,owner_id,name,slug,client_updated_at,device_id) values($1,$2,'مادة ثانية','subject-teaching-command-two',1,'seed')`, [subject, OWNER]);
    const results = await Promise.all(['a','b','c'].map((device) => teachingCommand({
      mutationId: `teaching-command:${device}`, teachingId: `teaching-command:${device}`,
      sectionId: context.sectionId, subjectId: subject, termId: context.termId,
      itemIds: Array.from({ length: 5 }, (_, index) => `item:teaching-command:${device}:${index}`), deviceId: `device-${device}`,
    })));
    const canonicalId = results[0].canonicalTeaching.id;
    assert.ok(results.every((result) => result.canonicalTeaching.id === canonicalId));
    assert.equal((await pg.query(`select count(*) from rakeezx.teachings where owner_id=$1 and section_id=$2 and subject_id=$3 and term_id=$4`, [OWNER, context.sectionId, subject, context.termId])).rows[0].count, 1);
    assert.equal((await pg.query(`select count(*) from rakeezx.items where owner_id=$1 and teaching_id=$2 and deleted_at is null`, [OWNER, canonicalId])).rows[0].count, 5);
    assert.deepEqual(results[0].items.map((item) => [item.name, item.max, item.auto]), [
      ['المشاركة والتفاعل', 10, 'participation'], ['الواجبات', 10, null], ['الأنشطة والمشاريع', 20, null], ['الاختبارات القصيرة', 20, null], ['الاختبار النهائي', 40, null],
    ]);
    assert.deepEqual(await teachingCommand({ mutationId: 'teaching-command:a', teachingId: 'teaching-command:a', sectionId: context.sectionId, subjectId: subject, termId: context.termId, itemIds: Array.from({ length: 5 }, (_, index) => `item:teaching-command:a:${index}`), deviceId: 'device-a' }), results[0]);
  });
});
