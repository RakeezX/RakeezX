import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const migrationFiles = [
  '0001_core_schema.sql', '0002_indexes_triggers_rls.sql', '0003_hybrid_calendar.sql', '0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql', '0008_enrollment_membership_operations.sql',
  '0009_transfer_and_renumber_rosters.sql', '0010_profile_report_principal_name.sql', '0011_session_roster_snapshots.sql',
  '0012_sync_v2_server_protocol.sql', '0013_sync_v2_enrollment_commands.sql', '0014_sync_v2_attendance_snapshot_commands.sql',
  '0015_sync_v2_lifecycle_commands.sql', '0016_sync_v2_teaching_creation_commands.sql', '0017_sync_v2_bulk_attendance_commands.sql',
  '0018_profile_active_time_profile.sql', '0019_class_rules.sql', '0020_support_requests.sql', '0021_section_archive_lifecycle.sql',
  '0022_closed_term_reports.sql', '0023_sync_v2_backup_restore.sql', '0024_class_goal_runtime.sql', '0025_group_arrangements.sql',
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
  await pg.exec(`
    insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('groups:y','سنة',1450,1451,'active');
    insert into rakeezx.terms(id,year_id,name,"index",status) values('groups:t','groups:y','فصل',1,'active');
    insert into rakeezx.subjects(id,name,slug) values('groups:sub','رياضيات','groups-sub');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('groups:s','groups:y',5,'أ','خامس أ');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('groups:teach','groups:s','groups:sub','groups:t');
    insert into rakeezx.students(id,name,status) values
      ('groups:a','طالب أ','active'),('groups:b','طالب ب','active'),('groups:c','طالب ج','active');
    insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status) values
      ('groups:ea','groups:a','groups:s',1,'active'),
      ('groups:eb','groups:b','groups:s',2,'active'),
      ('groups:ec','groups:c','groups:s',3,'active');
  `);
});
after(async () => pg.close());

async function mutate({ mutationId, baseRevision = 0, operation = 'patch', groups }) {
  const patch = operation === 'delete' ? {} : { ...(operation === 'create' ? { teaching_id: 'groups:teach' } : {}), groups };
  return (await pg.query(`select rakeezx.apply_sync_v2_mutation(
    'group_arrangements','group-arrangement:groups:teach',$1,'groups-device',$2,$3::jsonb,$4,10
  ) result`, [mutationId, baseRevision, JSON.stringify(patch), operation])).rows[0].result;
}

test('migration is additive, owner-scoped, mapped, and included in V4 restore', async () => {
  const table = (await pg.query(`select relrowsecurity,relforcerowsecurity from pg_class
    where oid='rakeezx.group_arrangements'::regclass`)).rows[0];
  assert.equal(table.relrowsecurity && table.relforcerowsecurity, true);
  const grants = (await pg.query(`select
    has_table_privilege('anon','rakeezx.group_arrangements','select') anon_select,
    has_table_privilege('authenticated','rakeezx.group_arrangements','select') auth_select,
    has_table_privilege('authenticated','rakeezx.group_arrangements','insert') auth_insert`)).rows[0];
  assert.deepEqual(grants, { anon_select: false, auth_select: true, auth_insert: false });
  assert.deepEqual((await pg.query("select rakeezx.sync_v2_field_map('group_arrangements') map")).rows[0].map,
    { teaching_id: 'identity', groups: 'arrangement' });
  assert.deepEqual((await pg.query(`select rakeezx.sync_v2_natural_key('group_arrangements','{"teaching_id":"groups:teach"}'::jsonb) key`)).rows[0].key,
    ['groups:teach']);
  assert.ok((await pg.query('select rakeezx.sync_v2_restore_entities() entities')).rows[0].entities.includes('group_arrangements'));
});

test('server removes invalid/duplicate membership and concurrent edits converge as one arrangement', async () => {
  const created = await mutate({ mutationId: 'groups:create', operation: 'create', groups: [
    ['groups:a', 'groups:b', 'groups:a', 'missing'], ['groups:c', 'groups:b'],
  ] });
  assert.deepEqual(created.canonical.groups, [['groups:a', 'groups:b'], ['groups:c']]);
  const revision = created.canonical.revision;
  const first = await mutate({ mutationId: 'groups:first', baseRevision: revision, groups: [['groups:a'], ['groups:b', 'groups:c']] });
  const second = await mutate({ mutationId: 'groups:second', baseRevision: revision, groups: [['groups:c', 'groups:a'], ['groups:b']] });
  assert.equal(first.outcome, 'applied');
  assert.equal(second.outcome, 'conflict');
  assert.deepEqual(second.canonical.groups, first.canonical.groups);
  assert.deepEqual((await pg.query(`select groups from rakeezx.group_arrangements where owner_id=$1`, [OWNER])).rows[0].groups,
    [['groups:a'], ['groups:b', 'groups:c']]);
});

test('withdrawal prunes persisted membership, archive is read-only, and lifecycle retains tombstone protection', async () => {
  const before = (await pg.query(`select revision from rakeezx.group_arrangements where owner_id=$1`, [OWNER])).rows[0].revision;
  await pg.query(`update rakeezx.enrollments set status='withdrawn',end_date='2026-09-09',client_updated_at=20
    where owner_id=$1 and id='groups:eb'`, [OWNER]);
  const pruned = (await pg.query(`select groups,revision from rakeezx.group_arrangements where owner_id=$1`, [OWNER])).rows[0];
  assert.deepEqual(pruned.groups, [['groups:a'], ['groups:c']]);
  assert.ok(pruned.revision > before);

  const archived = (await pg.query(`select rakeezx.apply_sync_v2_section_lifecycle_command(
    'groups:archive','groups-device','archive_class','groups:s','2026-09-09'::date,30
  ) result`)).rows[0].result;
  assert.equal(archived.outcome, 'archived');
  await assert.rejects(mutate({ mutationId: 'groups:archived-edit', baseRevision: pruned.revision,
    groups: [['groups:a', 'groups:c']] }), /Archived section is read-only/);
  await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_lifecycle_command(
    'groups:delete','groups-device','delete_teaching','groups:teach',40)`), /Retained records require archive/);

  await pg.exec(`select set_config('rakeezx.section_lifecycle_delete','on',false);
    update rakeezx.teachings set deleted_at=clock_timestamp(),client_updated_at=50,device_id='lifecycle'
    where owner_id='${OWNER}' and id='groups:teach';`);
  assert.equal((await pg.query(`select deleted_at is not null deleted from rakeezx.group_arrangements
    where owner_id=$1 and teaching_id='groups:teach'`, [OWNER])).rows[0].deleted, true);
});
