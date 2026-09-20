import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNERS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];
const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);
let pg;

const useOwner = (owner) => pg.query('update auth.current_identity set id=$1', [owner]);
const unit = (id, name = id, deleted = false, subject = 'subject:curriculum') => ({
  id, subject_id: subject, grade: 4, term_index: 1, name, order: 0,
  planned_sessions: 2, deleted, client_updated_at: 10,
});
const lesson = (id, unitId, name = id, deleted = false) => ({
  id, unit_id: unitId, name, order: 0, planned_sessions: 1, deleted, client_updated_at: 10,
});
const hash = (letter) => letter.repeat(64);
async function contribute(owner, {
  bootstrapId = `bootstrap:${owner}`, deviceId = `device:${owner}`, snapshotHash = hash('a'),
  units = [], lessons = [], authoritative = true,
} = {}) {
  await useOwner(owner);
  return (await pg.query(
    'select rakeezx.contribute_curriculum_sync_bootstrap($1,$2,$3,$4::jsonb,$5::jsonb,$6) result',
    [bootstrapId, deviceId, snapshotHash, JSON.stringify(units), JSON.stringify(lessons), authoritative],
  )).rows[0].result;
}
async function finalize(owner, bootstrapId, deviceId, snapshotHash) {
  await useOwner(owner);
  return (await pg.query('select rakeezx.finalize_curriculum_sync_bootstrap($1,$2,$3) result',
    [bootstrapId, deviceId, snapshotHash])).rows[0].result;
}

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ${OWNERS.map((id) => `('${id}')`).join(',')};
    insert into auth.current_identity values ('${OWNERS[0]}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated, anon;
  `);
  const names = (await readdir(migrationsDirectory)).sort()
    .filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 30);
  for (const name of names) await pg.exec((await readFile(new URL(name, migrationsDirectory), 'utf8')).replace(/^\uFEFF/, ''));
  for (const owner of OWNERS) {
    await useOwner(owner);
    await pg.query(`insert into rakeezx.subjects(id,name,slug,client_updated_at,device_id)
      values('subject:curriculum','منهج اصطناعي',$1,1,'seed')`, [`curriculum-${owner}`]);
  }
  await useOwner(OWNERS[0]);
  await pg.query(`insert into rakeezx.units(id,subject_id,grade,term_index,name,"order",planned_sessions,client_updated_at,device_id)
    values('unit:existing','subject:curriculum',4,1,'مطابق',0,2,7,'seed')`);
  await pg.query(`insert into rakeezx.lessons(id,unit_id,name,"order",planned_sessions,client_updated_at,device_id)
    values('lesson:existing','unit:existing','مطابق',0,1,7,'seed')`);
  await pg.exec((await readFile(new URL('0031_curriculum_sync_v2.sql', migrationsDirectory), 'utf8')).replace(/^\uFEFF/, ''));
});
after(async () => pg?.close());

test('migration initializes revision metadata without changing historical timestamps and preserves legacy restore contract', async () => {
  await useOwner(OWNERS[0]);
  const row = (await pg.query(`select revision,field_revisions,client_updated_at,device_id from rakeezx.units
    where owner_id=$1 and id='unit:existing'`, [OWNERS[0]])).rows[0];
  assert.equal(row.revision, 1);
  assert.deepEqual(row.field_revisions, { identity: 1, content: 1, order: 1, planning: 1 });
  assert.equal(row.client_updated_at, 7);
  assert.equal(row.device_id, 'seed');
  const legacy = (await pg.query('select rakeezx.sync_v2_restore_entities() entities')).rows[0].entities;
  const full = (await pg.query('select rakeezx.sync_v2_restore_entities_full() entities')).rows[0].entities;
  assert.equal(legacy.includes('units'), false);
  assert.equal(legacy.includes('lessons'), false);
  assert.ok(full.indexOf('subjects') < full.indexOf('units'));
  assert.ok(full.indexOf('units') < full.indexOf('lessons'));
  assert.equal(full.includes('assignments'), false);
  assert.equal(full.includes('submissions'), false);
});

test('status is owner-derived metadata only and bootstrap storage has no direct authenticated grants', async () => {
  await useOwner(OWNERS[1]);
  const status = (await pg.query('select rakeezx.get_curriculum_sync_bootstrap_status() result')).rows[0].result;
  assert.deepEqual(status, { protocolVersion: 1, state: 'NOT_STARTED', unitCount: 0, lessonCount: 0, conflicts: [] });
  assert.equal(Object.hasOwn(status, 'units'), false);
  assert.equal((await pg.query(`select has_table_privilege('authenticated','rakeezx.curriculum_sync_bootstraps','select') allowed`)).rows[0].allowed, false);
  assert.equal((await pg.query(`select has_function_privilege('anon','rakeezx.get_curriculum_sync_bootstrap_status()','execute') allowed`)).rows[0].allowed, false);
  assert.equal((await pg.query(`select has_function_privilege('authenticated','rakeezx.get_curriculum_sync_bootstrap_status()','execute') allowed`)).rows[0].allowed, true);
});

test('authoritative snapshot reconciles existing rows, preserves ids, finalizes, and is idempotent', async () => {
  const owner = OWNERS[0], bootstrapId = 'bootstrap:authoritative', deviceId = 'device:authoritative', snapshotHash = hash('a');
  const units = [unit('unit:existing', 'مطابق')];
  const lessons = [lesson('lesson:existing', 'unit:existing', 'مطابق')];
  const started = await contribute(owner, { bootstrapId, deviceId, snapshotHash, units, lessons });
  assert.equal(started.state, 'IN_PROGRESS');
  assert.equal(started.units.find((row) => row.id === 'unit:existing').id, 'unit:existing');
  const repeated = await contribute(owner, { bootstrapId, deviceId, snapshotHash, units, lessons });
  assert.deepEqual(repeated, started);
  const completed = await finalize(owner, bootstrapId, deviceId, snapshotHash);
  assert.equal(completed.state, 'COMPLETE');
  assert.equal((await pg.query('select count(*)::int count from rakeezx.units where owner_id=$1', [owner])).rows[0].count, 1);
  await assert.rejects(contribute(owner, {
    bootstrapId, deviceId, snapshotHash, units: [unit('unit:existing', 'محتوى مختلف')], lessons,
  }), /snapshot hash reused with different content/i);
});

test('later claimed device contributes unique stable ids but conflicting content and tombstone/live fail closed', async () => {
  const owner = OWNERS[0], bootstrapId = 'bootstrap:authoritative';
  const union = await contribute(owner, {
    bootstrapId, deviceId: 'device:second', snapshotHash: hash('b'), authoritative: false,
    units: [unit('unit:unique', 'فريد')], lessons: [lesson('lesson:unique', 'unit:unique', 'فريد')],
  });
  assert.equal(union.state, 'COMPLETE');
  assert.ok(union.units.some((row) => row.id === 'unit:unique'));
  const conflict = await contribute(owner, {
    bootstrapId, deviceId: 'device:third', snapshotHash: hash('c'), authoritative: false,
    units: [unit('unit:unique', 'مختلف')], lessons: [lesson('lesson:unique', 'unit:unique', 'فريد')],
  });
  assert.equal(conflict.state, 'CONFLICT');
  assert.equal((await pg.query(`select name from rakeezx.units where owner_id=$1 and id='unit:unique'`, [owner])).rows[0].name, 'فريد');

  const tombstoneOwner = OWNERS[2];
  const started = await contribute(tombstoneOwner, {
    snapshotHash: hash('d'), units: [unit('unit:tombstone', 'حي')], lessons: [],
  });
  await finalize(tombstoneOwner, started.bootstrapId, `device:${tombstoneOwner}`, hash('d'));
  const tombstoneConflict = await contribute(tombstoneOwner, {
    bootstrapId: started.bootstrapId, deviceId: 'device:tombstone', snapshotHash: hash('e'),
    units: [unit('unit:tombstone', 'حي', true)], lessons: [], authoritative: false,
  });
  assert.equal(tombstoneConflict.state, 'CONFLICT');
});

test('malformed references roll back atomically and another owner cannot inspect bootstrap evidence', async () => {
  const owner = OWNERS[3];
  await assert.rejects(contribute(owner, {
    snapshotHash: hash('f'), units: [], lessons: [lesson('lesson:broken', 'unit:missing')],
  }), /Invalid curriculum bootstrap reference/);
  assert.equal((await pg.query('select count(*)::int count from rakeezx.curriculum_sync_bootstraps where owner_id=$1', [owner])).rows[0].count, 0);
  assert.equal((await pg.query('select count(*)::int count from rakeezx.lessons where owner_id=$1', [owner])).rows[0].count, 0);
  await useOwner(OWNERS[1]);
  const status = (await pg.query('select rakeezx.get_curriculum_sync_bootstrap_status() result')).rows[0].result;
  assert.equal(status.state, 'NOT_STARTED');
  await pg.exec('set role authenticated');
  await assert.rejects(pg.query(`select rakeezx.curriculum_sync_bootstrap_result('${OWNERS[0]}')`), /permission denied/i);
  await pg.exec('reset role');
});

test('full manifest contains unit/lesson tombstones and generic Sync V2 advances curriculum revisions', async () => {
  const owner = OWNERS[2];
  await useOwner(owner);
  const mutation = (await pg.query(`select rakeezx.apply_sync_v2_mutation(
    'units','unit:tombstone','mutation:unit-update','device:sync',1,$1::jsonb,'patch',50) result`,
  [JSON.stringify({ name: 'محدث' })])).rows[0].result;
  assert.equal(mutation.outcome, 'applied');
  assert.equal(mutation.canonical.revision, 2);
  const deleted = (await pg.query(`select rakeezx.apply_sync_v2_mutation(
    'units','unit:tombstone','mutation:unit-delete','device:sync',2,'{}'::jsonb,'delete',51) result`)).rows[0].result;
  assert.equal(deleted.outcome, 'deleted');
  const manifest = (await pg.query('select rakeezx.sync_v2_restore_manifest_full(auth.uid()) result')).rows[0].result;
  const row = manifest.find((entry) => entry.entity === 'units' && entry.id === 'unit:tombstone');
  assert.equal(row.deleted, true);
  assert.equal(row.revision, 3);
});
