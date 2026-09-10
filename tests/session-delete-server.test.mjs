import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const migrationFiles = [
  '0001_core_schema.sql','0002_indexes_triggers_rls.sql','0003_hybrid_calendar.sql','0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql','0008_enrollment_membership_operations.sql',
  '0009_transfer_and_renumber_rosters.sql','0010_profile_report_principal_name.sql','0011_session_roster_snapshots.sql',
  '0012_sync_v2_server_protocol.sql','0013_sync_v2_enrollment_commands.sql','0014_sync_v2_attendance_snapshot_commands.sql',
  '0015_sync_v2_lifecycle_commands.sql','0016_sync_v2_teaching_creation_commands.sql','0017_sync_v2_bulk_attendance_commands.sql',
  '0018_profile_active_time_profile.sql','0019_class_rules.sql','0020_support_requests.sql','0021_section_archive_lifecycle.sql',
  '0022_closed_term_reports.sql','0023_sync_v2_backup_restore.sql','0024_class_goal_runtime.sql','0025_group_arrangements.sql',
  '0026_session_delete.sql',
];
const migrations = await Promise.all(migrationFiles.map((name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));

let pg;
before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth; create role authenticated; create role anon;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
    insert into auth.users values('${OWNER}'),('${OTHER}'); insert into auth.current_identity values('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
  `);
  for (const migration of migrations) await pg.exec(migration.replace(/^\uFEFF/, ''));
});
after(async () => pg.close());

const useOwner = (owner) => pg.query('update auth.current_identity set id=$1', [owner]);

async function seed(suffix, owner = OWNER, { status = 'scheduled', makeupForId = null } = {}) {
  await useOwner(owner);
  const ids = Object.fromEntries(['year','term','subject','section','teaching','student','session'].map((name) => [name, `${suffix}:${name}`]));
  const yearStart = 1400 + [...suffix].reduce((sum, char) => sum + char.codePointAt(0), 0) % 500;
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values($1,$2,$3,$4,'active')`, [ids.year, suffix, yearStart, yearStart + 1]);
  await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",status) values($1,$2,$3,1,'active')`, [ids.term, ids.year, suffix]);
  await pg.query(`insert into rakeezx.subjects(id,name,slug) values($1,$2,$3)`, [ids.subject, suffix, `${suffix}-slug`]);
  await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name) values($1,$2,5,$3,$3)`, [ids.section, ids.year, suffix]);
  await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values($1,$2,$3,$4)`, [ids.teaching, ids.section, ids.subject, ids.term]);
  await pg.query(`insert into rakeezx.students(id,name,status) values($1,$2,'active')`, [ids.student, suffix]);
  await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,status,makeup_for_id) values($1,$2,'2026-09-10',1,$3,$4)`, [ids.session, ids.teaching, status, makeupForId]);
  return ids;
}

async function removeSession(mutationId, sessionId, deviceId = 'device-a', clientUpdatedAt = 10) {
  return (await pg.query(`select rakeezx.apply_sync_v2_session_delete_command($1,$2,$3,$4) result`,
    [mutationId, deviceId, sessionId, clientUpdatedAt])).rows[0].result;
}

test('0026 exposes only the authenticated owner-scoped command and keeps the delete trigger active', async () => {
  const security = (await pg.query(`select
    has_function_privilege('authenticated','rakeezx.apply_sync_v2_session_delete_command(text,text,text,bigint)','execute') auth_exec,
    has_function_privilege('anon','rakeezx.apply_sync_v2_session_delete_command(text,text,text,bigint)','execute') anon_exec`)).rows[0];
  assert.deepEqual(security, { auth_exec: true, anon_exec: false });
  assert.equal((await pg.query(`select count(*)::int count from pg_trigger where tgrelid='rakeezx.sessions'::regclass and tgname='sessions_guard_safe_delete' and not tgisinternal`)).rows[0].count, 1);
});

test('pristine delete is receipt-idempotent and permanently occupies the auto-session natural identity', async () => {
  const ids = await seed('pristine');
  const first = await removeSession('delete:pristine', ids.session);
  const retry = await removeSession('delete:pristine', ids.session);
  assert.deepEqual(retry, first);
  assert.equal(first.outcome, 'deleted');
  assert.ok(first.session.deleted_at);
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.sync_mutation_receipts where owner_id=$1 and mutation_id='delete:pristine'`, [OWNER])).rows[0].count, 1);

  const recreate = (await pg.query(`select rakeezx.apply_sync_v2_mutation(
    'sessions','pristine:replacement','create:after-delete','device-b',0,
    jsonb_build_object('teaching_id',$1::text,'date','2026-09-10','period',1,'status','scheduled'),'create',20
  ) result`, [ids.teaching])).rows[0].result;
  assert.equal(recreate.outcome, 'tombstoned');
  assert.equal(recreate.canonicalId, ids.session);
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.sessions where owner_id=$1 and teaching_id=$2 and date='2026-09-10' and period=1`, [OWNER, ids.teaching])).rows[0].count, 1);
});

test('server protects held, attendance, snapshot, and both sides of a makeup relationship', async () => {
  const held = await seed('held', OWNER, { status: 'held' });
  const attendance = await seed('attendance');
  await pg.query(`insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('attendance:row',$1,$2,$3,'2026-09-10','present')`, [attendance.student, attendance.session, attendance.teaching]);
  const snapshot = await seed('snapshot');
  await pg.exec(`select set_config('rakeezx.sync_v2_attendance_snapshot','on',false)`);
  await pg.query(`insert into rakeezx.session_roster_snapshots(id,session_id,teaching_id,section_id,captured_at,members,state)
    values('snapshot:row',$1,$2,$3,clock_timestamp(),'[]'::jsonb,'complete')`, [snapshot.session, snapshot.teaching, snapshot.section]);
  const parent = await seed('makeup-parent');
  const child = await seed('makeup-child', OWNER, { status: 'scheduled', makeupForId: parent.session });

  const cases = [
    [held.session, 'status'], [attendance.session, 'attendance'], [snapshot.session, 'roster_snapshot'],
    [parent.session, 'makeup'], [child.session, 'makeup'],
  ];
  for (const [sessionId, reason] of cases) {
    const result = await removeSession(`delete:${sessionId}`, sessionId);
    assert.equal(result.outcome, 'protected');
    assert.equal(result.reason, reason);
    assert.equal(result.session.deleted_at, null);
  }

  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_mutation(
    'sessions',$1,'generic:held-delete','stale-device',1,'{}'::jsonb,'delete',30
  )`, [held.session]), /Session contains retained historical evidence/);
});

test('a stale other owner cannot delete or inspect the canonical owner session', async () => {
  const ids = await seed('owner-isolation', OWNER);
  await useOwner(OTHER);
  const result = await removeSession('other:delete', ids.session, 'other-device');
  assert.equal(result.outcome, 'not_found');
  assert.equal(result.session, null);
  await useOwner(OWNER);
  assert.equal((await pg.query(`select deleted_at from rakeezx.sessions where owner_id=$1 and id=$2`, [OWNER, ids.session])).rows[0].deleted_at, null);
});
