import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const migrationFiles = [
  '0001_core_schema.sql', '0002_indexes_triggers_rls.sql', '0003_hybrid_calendar.sql', '0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql', '0008_enrollment_membership_operations.sql',
  '0009_transfer_and_renumber_rosters.sql', '0010_profile_report_principal_name.sql', '0011_session_roster_snapshots.sql',
  '0012_sync_v2_server_protocol.sql', '0013_sync_v2_enrollment_commands.sql', '0014_sync_v2_attendance_snapshot_commands.sql',
  '0015_sync_v2_lifecycle_commands.sql', '0016_sync_v2_teaching_creation_commands.sql', '0017_sync_v2_bulk_attendance_commands.sql',
  '0018_profile_active_time_profile.sql', '0019_class_rules.sql', '0020_support_requests.sql', '0021_section_archive_lifecycle.sql',
  '0022_closed_term_reports.sql', '0023_sync_v2_backup_restore.sql', '0024_class_goal_runtime.sql',
];
const migrations = await Promise.all(migrationFiles.map((name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth; create role authenticated; create role anon;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
    insert into auth.users values('${OWNER}'); insert into auth.current_identity values('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
  `);
  for (const migration of migrations) await pg.exec(migration.replace(/^\uFEFF/, ''));
});
after(async () => pg.close());

async function seed() {
  await pg.exec(`
    select set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
    insert into rakeezx.years(id,label,hijri_start,hijri_end,status,client_updated_at,device_id) values('goal:y','سنة',1450,1451,'active',1,'seed');
    insert into rakeezx.terms(id,year_id,name,"index",status,client_updated_at,device_id) values('goal:t','goal:y','فصل',1,'active',1,'seed');
    insert into rakeezx.subjects(id,name,slug,client_updated_at,device_id) values('goal:sub','رياضيات','goal-sub',1,'seed');
    insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at,device_id) values('goal:s','goal:y',5,'أ','خامس أ',1,'seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at,device_id) values('goal:teach','goal:s','goal:sub','goal:t',1,'seed');
    insert into rakeezx.students(id,name,status,client_updated_at,device_id) values('goal:a','طالب أول','active',1,'seed'),('goal:b','طالب ثان','active',1,'seed');
    insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,client_updated_at,device_id)
      values('goal:ea','goal:a','goal:s',1,'active',1,'seed'),('goal:eb','goal:b','goal:s',2,'active',1,'seed');
    insert into rakeezx.sessions(id,teaching_id,date,period,status,client_updated_at,device_id) values('goal:ses','goal:teach','2026-09-09',1,'held',1,'seed');
    insert into rakeezx.session_roster_snapshots(id,session_id,teaching_id,section_id,captured_at,members,state,client_updated_at,device_id)
      values('srs:goal:ses','goal:ses','goal:teach','goal:s',clock_timestamp(),'[{"studentId":"goal:a","rollNo":1},{"studentId":"goal:b","rollNo":2}]','complete',1,'seed');
    insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status,note,client_updated_at,device_id)
      values('goal:att:b','goal:b','goal:ses','goal:teach','2026-09-09','absent','',1,'seed');
    insert into rakeezx.class_goals(id,teaching_id,run_id,date,session_id,text,duration_minutes,reward_points,state,started_at,client_updated_at,device_id)
      values('class-goal:goal:teach','goal:teach','goal:run','2026-09-09','goal:ses','نشارك',10,3,'active',clock_timestamp(),2,'device-a');
  `);
}

test('migration is owner-scoped, generic-mapped, backup-visible, and exposes no anonymous table writes', async () => {
  const rows = (await pg.query(`select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in
    ('rakeezx.class_goals'::regclass,'rakeezx.class_charter_selections'::regclass) order by relname`)).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity), true);
  assert.deepEqual((await pg.query(`select has_table_privilege('anon','rakeezx.class_goals','select') a,
    has_table_privilege('authenticated','rakeezx.class_goals','select') s`)).rows[0], { a: false, s: true });
  assert.deepEqual((await pg.query(`select rakeezx.sync_v2_field_map('class_goals') m`)).rows[0].m.state, 'goal');
  const entities = (await pg.query('select rakeezx.sync_v2_restore_entities() e')).rows[0].e;
  assert.ok(entities.includes('class_goals') && entities.includes('class_charter_selections'));
});

test('reward command is atomic/idempotent, excludes absent students, and canonicalizes one run once', async () => {
  await seed();
  const first = (await pg.query(`select rakeezx.apply_sync_v2_class_goal_reward_command($1,$2,$3,$4,$5) result`,
    ['goal:mutation:1', 'device-a', 'class-goal:goal:teach', 'goal:run', 3])).rows[0].result;
  assert.equal(first.outcome, 'completed');
  assert.equal(first.logs.length, 1);
  assert.equal(first.logs[0].student_id, 'goal:a');
  const replay = (await pg.query(`select rakeezx.apply_sync_v2_class_goal_reward_command($1,$2,$3,$4,$5) result`,
    ['goal:mutation:1', 'device-a', 'class-goal:goal:teach', 'goal:run', 3])).rows[0].result;
  assert.deepEqual(replay, first);
  const concurrent = (await pg.query(`select rakeezx.apply_sync_v2_class_goal_reward_command($1,$2,$3,$4,$5) result`,
    ['goal:mutation:2', 'device-b', 'class-goal:goal:teach', 'goal:run', 4])).rows[0].result;
  assert.equal(concurrent.logs.length, 1);
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.logs where note='class-goal:class-goal:goal:teach:goal:run'`)).rows[0].count, 1);
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.sync_mutation_receipts where operation='goal_reward'`)).rows[0].count, 2);
});

test('invalid goal/session relation rejects without partial goal or participation rows', async () => {
  await assert.rejects(pg.query(`insert into rakeezx.class_goals(id,teaching_id,run_id,date,session_id,text,duration_minutes,reward_points,state,started_at,client_updated_at,device_id)
    values('class-goal:bad','goal:teach','bad-run','2026-09-10','goal:ses','غير صالح',5,1,'active',clock_timestamp(),5,'device')`));
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.class_goals where id='class-goal:bad'`)).rows[0].count, 0);
});
