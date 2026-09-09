import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const migrationFiles = [
  '0001_core_schema.sql', '0002_indexes_triggers_rls.sql', '0003_hybrid_calendar.sql',
  '0004_student_notes.sql', '0007_sections_active_normalized_identity.sql',
  '0008_enrollment_membership_operations.sql', '0009_transfer_and_renumber_rosters.sql',
  '0010_profile_report_principal_name.sql', '0011_session_roster_snapshots.sql',
  '0012_sync_v2_server_protocol.sql', '0013_sync_v2_enrollment_commands.sql',
  '0014_sync_v2_attendance_snapshot_commands.sql', '0015_sync_v2_lifecycle_commands.sql',
  '0016_sync_v2_teaching_creation_commands.sql', '0017_sync_v2_bulk_attendance_commands.sql',
  '0018_profile_active_time_profile.sql', '0019_class_rules.sql', '0020_support_requests.sql',
  '0021_section_archive_lifecycle.sql', '0022_closed_term_reports.sql',
  '0023_sync_v2_backup_restore.sql',
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
    insert into auth.users values ('${OWNER}'),('${OTHER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
  `);
  for (const migration of migrations) await pg.exec(migration.replace(/^\uFEFF/, ''));
});
after(async () => pg.close());

const useOwner = (id) => pg.query('update auth.current_identity set id=$1', [id]);
const manifest = async () => (await pg.query('select rakeezx.sync_v2_restore_manifest(auth.uid()) result')).rows[0].result;
async function stage({ id, hash = 'a'.repeat(64), version = 4, source, operations }) {
  return (await pg.query('select rakeezx.stage_sync_v2_restore($1,$2,$3,$4::jsonb,$5::jsonb) result',
    [id, hash, version, JSON.stringify(source), JSON.stringify(operations)])).rows[0].result;
}
async function finalize({ id, hash = 'a'.repeat(64), stageHash }) {
  return (await pg.query('select rakeezx.finalize_sync_v2_restore($1,$2,$3) result', [id, hash, stageHash])).rows[0].result;
}

test('staging is write-free; finalization is atomic, canonical, and idempotent', async () => {
  await useOwner(OWNER);
  await pg.query(`insert into rakeezx.students(id,owner_id,name,note,status,client_updated_at,device_id)
    values('restore:student',$1,'طالب قبل','','active',1,'seed')`, [OWNER]);
  const before = await manifest();
  const revision = before.find((row) => row.entity === 'students' && row.id === 'restore:student').revision;
  const staged = await stage({ id: 'restore:normal', source: before, operations: [{
    entity: 'students', recordId: 'restore:student', operation: 'patch', baseRevision: revision,
    patch: { name: 'طالب مستعاد' }, clientUpdatedAt: 9,
  }] });
  assert.equal((await pg.query("select name from rakeezx.students where id='restore:student' and owner_id=$1", [OWNER])).rows[0].name, 'طالب قبل');
  const result = await finalize({ id: 'restore:normal', stageHash: staged.stageHash });
  assert.equal(result.canonical.students.find((row) => row.id === 'restore:student').name, 'طالب مستعاد');
  const replay = await finalize({ id: 'restore:normal', stageHash: staged.stageHash });
  assert.deepEqual(replay, result);
  assert.equal((await pg.query("select count(*)::int count from rakeezx.sync_restore_receipts where owner_id=$1 and restore_id='restore:normal'", [OWNER])).rows[0].count, 1);
});

test('failure during finalization rolls back every domain write', async () => {
  await useOwner(OWNER);
  const before = await manifest();
  const staged = await stage({ id: 'restore:rollback', hash: 'b'.repeat(64), source: before, operations: [
    { entity: 'students', recordId: 'restore:atomic-student', operation: 'create', baseRevision: 0,
      patch: { name: 'طالب ذري', note: '', status: 'active' }, clientUpdatedAt: 10 },
    { entity: 'scores', recordId: 'restore:bad-score', operation: 'create', baseRevision: 0,
      patch: { student_id: 'restore:atomic-student', item_id: 'missing-item', value: 2 }, clientUpdatedAt: 10 },
  ] });
  await assert.rejects(finalize({ id: 'restore:rollback', hash: 'b'.repeat(64), stageHash: staged.stageHash }));
  assert.equal((await pg.query("select count(*)::int count from rakeezx.students where owner_id=$1 and id='restore:atomic-student'", [OWNER])).rows[0].count, 0);
  assert.equal((await pg.query("select count(*)::int count from rakeezx.sync_restore_receipts where owner_id=$1 and restore_id='restore:rollback'", [OWNER])).rows[0].count, 0);
});

test('owner isolation, canonical-source recheck, and safe legacy empty-owner restore', async () => {
  await useOwner(OWNER);
  const source = await manifest();
  const staged = await stage({ id: 'restore:isolated', hash: 'c'.repeat(64), source, operations: [] });
  await useOwner(OTHER);
  await assert.rejects(finalize({ id: 'restore:isolated', hash: 'c'.repeat(64), stageHash: staged.stageHash }), /not found|mismatch/i);

  const empty = await manifest();
  assert.deepEqual(empty, []);
  const legacy = await stage({ id: 'restore:legacy', hash: 'legacy-v3:test', version: 3, source: empty,
    operations: [{ entity: 'students', recordId: 'legacy:student', operation: 'create', baseRevision: 0,
      patch: { name: 'طالب قديم', note: '', status: 'active' }, clientUpdatedAt: 1 }] });
  await finalize({ id: 'restore:legacy', hash: 'legacy-v3:test', stageHash: legacy.stageHash });
  assert.equal((await pg.query("select name from rakeezx.students where owner_id=$1 and id='legacy:student'", [OTHER])).rows[0].name, 'طالب قديم');

  const occupied = await manifest();
  await assert.rejects(stage({ id: 'restore:legacy-unsafe', hash: 'legacy-v3:unsafe', version: 3, source: occupied, operations: [] }),
    /provably empty/i);
});

test('staged restore detects intervening canonical edits and never resurrects tombstones', async () => {
  await useOwner(OWNER);
  const before = await manifest();
  const staged = await stage({ id: 'restore:stale', hash: 'd'.repeat(64), source: before, operations: [] });
  await pg.query("update rakeezx.students set note='newer cloud edit' where owner_id=$1 and id='restore:student'", [OWNER]);
  await assert.rejects(finalize({ id: 'restore:stale', hash: 'd'.repeat(64), stageHash: staged.stageHash }), /source changed/i);

  await pg.query("update rakeezx.students set deleted_at=clock_timestamp() where owner_id=$1 and id='restore:student'", [OWNER]);
  const tombstoned = await manifest();
  const row = tombstoned.find((candidate) => candidate.entity === 'students' && candidate.id === 'restore:student');
  await assert.rejects(stage({ id: 'restore:resurrect', hash: 'e'.repeat(64), source: tombstoned, operations: [{
    entity: 'students', recordId: 'restore:student', operation: 'patch', baseRevision: row.revision,
    patch: { name: 'لا تعيدني' }, clientUpdatedAt: 20,
  }] }), /no longer matches/i);
});

test('restore metadata is RLS protected and only authenticated callers receive RPC access', async () => {
  const tables = await pg.query(`select relname,relrowsecurity,relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx'
      and relname in ('sync_restore_stages','sync_restore_receipts') order by relname`);
  assert.equal(tables.rows.length, 2);
  assert.equal(tables.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity), true);
  const grants = await pg.query(`select
    has_table_privilege('anon','rakeezx.sync_restore_stages','select') anon_table,
    has_table_privilege('authenticated','rakeezx.sync_restore_stages','insert') authenticated_insert,
    has_function_privilege('authenticated','rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb)','execute') authenticated_rpc,
    has_function_privilege('anon','rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb)','execute') anon_rpc`);
  assert.equal(grants.rows[0].anon_table, false);
  assert.equal(grants.rows[0].authenticated_insert, false);
  assert.equal(grants.rows[0].authenticated_rpc, true);
  assert.equal(grants.rows[0].anon_rpc, false);
});
