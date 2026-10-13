// Disposable native PG17 + actual IndexedDB/store/cloud/Sync handlers. No live rows.
import 'fake-indexeddb/auto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { n13Account } from './n13-fixture.mjs';
import { LifecycleBackend, academicFixture, OWNER } from './helpers/student-lifecycle-server.mjs';
import { createSyncV2Engine, decodeSyncV2Canonical, SYNC_V2_STORES } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { localDeleteWrites } from '../src/lib/n77-delete.js';
import { planCloudRestore } from '../src/lib/backup-v2.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
const B = '22222222-2222-4222-8222-222222222222';
const installation = process.env.RAKEEZ_NATIVE_PG_ROOT || 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const { default: pg } = await import(pathToFileURL(path.join(installation, 'client/node_modules/pg/lib/index.js')).href);
const sqlFile = '20261013045630_n77_recreate_fresh_identity.sql';
const migrations = new URL('../supabase/migrations/', import.meta.url);
const root = path.resolve('test-results/n77-recreate-native-' + crypto.randomUUID());
const data = path.join(root, 'cluster');
const command = (name, args) => execFileSync(path.join(installation, 'package/native/bin', name + '.exe'), args, { windowsHide: true, stdio: 'ignore' });
let started = false, client, port, f, backend, engine, recreated, receipt, deleteArgs, sibling, concurrentId, gradeBefore, loseResponse = false, lastEnvelope;
const digest = text => createHash('sha256').update(text).digest('hex');
const body = text => text.slice(text.indexOf('$function$') + 10, text.lastIndexOf('$function$')).replace(/\s+/g, ' ').trim();
const definition = async name => (await client.query('select pg_get_functiondef(oid) definition from pg_proc where pronamespace=\'rakeezx\'::regnamespace and proname=$1', [name])).rows[0].definition;
const envelope = (id, section = f.section, subject = f.subject, term = f.term) => ({ mutationId: 'create:' + id, deviceId: 'synthetic-a', teachingId: id, sectionId: section, subjectId: subject, termId: term, order: 0, itemIds: Array.from({ length: 5 }, (_, i) => id + ':item:' + i), clientUpdatedAt: 100 });
async function rpc(e, connection = client) {
  return (await connection.query('select rakeezx.apply_sync_v2_teaching_creation_command($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) result',
    [e.mutationId, e.deviceId, e.teachingId, e.sectionId, e.subjectId, e.termId, e.order, JSON.stringify(e.itemIds), e.clientUpdatedAt])).rows[0].result;
}
async function remove(id, section) {
  const plan = (await client.query('select rakeezx.n77_delete_teaching($1,$2) result', [id, section])).rows[0].result;
  const args = [id, section, plan.fingerprint, 'delete:' + id, 'synthetic-a', true];
  return { args, receipt: (await client.query('select rakeezx.n77_delete_teaching($1,$2,$3,$4,$5,$6) result', args)).rows[0].result };
}
async function canonical() {
  const result = Object.fromEntries(SYNC_V2_STORES.map(name => [name, []]));
  for (const name of ['years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'sessions', 'scores']) result[name] = (await backend.fetchRecords(name)).map(row => decodeSyncV2Canonical(name, row));
  return result;
}
before(async () => {
  await fs.mkdir(data, { recursive: true });
  const listener = createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  command('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
  command('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
  client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' }); await client.connect();
  await client.query(`create schema auth; create schema realtime; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text); alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select pg_catalog.current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  // Existing local initialization chain through N77. N94 scoring's migration
  // depends on separately deployed N71 SQL absent from this checkout; neither
  // changes the creation RPC or the guards certified here.
  for (const name of (await fs.readdir(migrations)).sort().filter(name => name.endsWith('.sql') && name < '20261008000000')) await client.query((await fs.readFile(new URL(name, migrations), 'utf8')).replace(/^\uFEFF/, ''));
  const saved = JSON.parse(await fs.readFile(new URL('./n77-recreate-server-before.json', import.meta.url), 'utf8'));
  assert.equal(body(await definition(saved.public.proname)), body(saved.public.definition), 'actual service wrapper matches local source');
  assert.equal(body(await definition(saved.inner.proname)), body(saved.inner.definition), 'actual service creation body matches local source');
  const deleteBefore = digest(await definition('n77_delete_teaching'));
  const aclBefore = (await client.query("select proacl::text acl from pg_proc where pronamespace='rakeezx'::regnamespace and proname='apply_sync_v2_teaching_creation_command'")).rows[0].acl;
  const sql = await fs.readFile(new URL(sqlFile, migrations), 'utf8'); await client.query(sql);
  assert.equal(digest(await definition('n77_delete_teaching')), deleteBefore);
  assert.equal((await client.query("select proacl::text acl from pg_proc where pronamespace='rakeezx'::regnamespace and proname='apply_sync_v2_teaching_creation_command'")).rows[0].acl, aclBefore);
  await fs.writeFile(path.join(root, 'certification.json'), JSON.stringify({ version: (await client.query('select version()')).rows[0].version, migrationSha256: digest(sql), functionSha256: digest(await definition('apply_sync_v2_teaching_creation_command')), aclBefore, deleteFunctionUnchanged: true }, null, 2));
  console.log('Native certification:', root);
  await client.query('insert into auth.users(id) values($1),($2)', [OWNER, B]);
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
  f = await academicFixture(client, 'recreate');
  sibling = 'sibling'; await client.query("insert into rakeezx.subjects(id,name,slug) values('second','second','second')");
  await client.query('insert into rakeezx.teachings(id,section_id,subject_id,term_id) values($1,$2,\'second\',$3)', [sibling, f.section, f.term]);
  await client.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('unrelated',$1,$2,$3);
    `, [f.destination, f.subject, f.term]);
  await client.query("insert into rakeezx.items(id,teaching_id,name,max) values('unrelated-item','unrelated','synthetic',10)");
  await client.query("insert into rakeezx.scores(id,student_id,item_id,value) values('unrelated-score',$1,'unrelated-item',7)", [f.student]);
  gradeBefore = (await client.query("select to_jsonb(s) row from rakeezx.scores s where id='unrelated-score'")).rows[0].row;
  backend = new LifecycleBackend(client);
  backend.applySyncV2TeachingCreationCommand = async e => { lastEnvelope = structuredClone(e); const result = await rpc(e); if (loseResponse) { loseResponse = false; throw new Error('Synthetic lost response after commit'); } return result; };
  cloud.setMockBackend(backend); await n13Account(OWNER); await db.clearAll(); store.state.ready = false; await store.init();
  await store.save(await canonical(), { queue: false }); await store.patchDevice({ activeYearId: f.year, activeTermId: f.term }); await db.clearStore('outbox');
  engine = createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => cloud.user?.id });
  await client.query('set role authenticated');
});
after(async () => { cloud.setMockBackend(null); store.closeChannel(); db.closeDB(); await client?.end(); if (started) command('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']); });

test('subject recreation uses fresh ID/defaults, preserves roster and unrelated grades; lost response retry is exact', async () => {
  const deletion = await remove(f.teaching, f.section); receipt = deletion.receipt; deleteArgs = deletion.args; assert.equal(receipt.scope, 'teaching');
  await store.save(await canonical(), { queue: false });
  const roster = await db.getAll('enrollments');
  const old = await db.get('teachings', f.teaching);
  const [a, b] = await Promise.all([store.createTeaching({ sectionId: f.section, subjectId: f.subject }), store.createTeaching({ sectionId: f.section, subjectId: f.subject })]);
  recreated = a; assert.equal(a.id, b.id); assert.notEqual(a.id, f.teaching);
  assert.equal(store.items(a.id).length, 5); assert.equal(store.students(a.id)[0].id, f.student);
  assert.deepEqual(await db.getAll('enrollments'), roster); assert.deepEqual(await db.get('teachings', f.teaching), old);
  loseResponse = true; assert.equal((await engine.dispatchPending()).failed, 1); const exact = structuredClone(lastEnvelope);
  db.closeDB(); store.state.ready = false; await store.init(); assert.ok((await engine.dispatchPending()).acknowledged >= 1); assert.deepEqual(lastEnvelope, exact);
  await store.refreshSyncedState(); assert.equal((await store.createTeaching({ sectionId: f.section, subjectId: f.subject })).id, a.id);
  assert.deepEqual(await rpc(exact), await rpc(exact)); await assert.rejects(rpc({ ...exact, order: exact.order + 1 }), /different request/);
  assert.deepEqual((await client.query("select to_jsonb(s) row from rakeezx.scores s where id='unrelated-score'")).rows[0].row, gradeBefore);
  assert.equal((await client.query('select count(*)::int n from rakeezx.sessions where teaching_id=$1', [a.id])).rows[0].n, 0);
});

test('two real concurrent device commands converge; old IDs and owner/year/term violations remain rejected', async () => {
  await client.query('reset role'); await client.query("insert into rakeezx.subjects(id,name,slug) values('concurrent','concurrent','concurrent')"); await client.query('set role authenticated');
  const second = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' }); await second.connect();
  try {
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]); await second.query('set role authenticated');
    const results = await Promise.all([rpc(envelope('device-a')), rpc(envelope('device-b'), second)]);
    for (const result of results) assert.equal(result.canonicalTeaching.id, recreated.id);
    assert.deepEqual(results[0].items, results[1].items);
    const freshResults = await Promise.all([rpc(envelope('fresh-device-a', f.section, 'concurrent')), rpc(envelope('fresh-device-b', f.section, 'concurrent'), second)]);
    concurrentId = freshResults[0].canonicalTeaching.id;
    assert.equal(freshResults[1].canonicalTeaching.id, concurrentId); assert.deepEqual(freshResults[0].items, freshResults[1].items);
    assert.equal((await client.query("select count(*)::int n from rakeezx.teachings where section_id=$1 and subject_id='concurrent' and deleted_at is null", [f.section])).rows[0].n, 1);
    assert.equal((await client.query('select count(*)::int n from rakeezx.teachings where section_id=$1 and subject_id=$2 and deleted_at is null', [f.section, f.subject])).rows[0].n, 1);
    await assert.rejects(rpc(envelope(f.teaching)), /tombstone/);
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [B]); await assert.rejects(rpc(envelope('wrong-owner'), second), /section is unavailable/);
    await second.query("select set_config('request.jwt.claim.sub','',false)"); await assert.rejects(rpc(envelope('no-auth'), second), /Authentication required/);
  } finally { await second.end(); }
  await client.query('reset role');
  await client.query("insert into rakeezx.years(id,label,hijri_start,hijri_end) values('other-year','other',1510,1511); insert into rakeezx.terms(id,year_id,name,\"index\") values('other-term','other-year','other',1)");
  await client.query('set role authenticated'); await assert.rejects(rpc(envelope('wrong-year', f.section, f.subject, 'other-term')), /term is unavailable/);
  await client.query('reset role');
  await client.query('insert into rakeezx.terms(id,year_id,name,"index",status) values(\'closed-term\',$1,\'closed\',3,\'closed\')', [f.year]);
  await client.query('set role authenticated');
  await assert.rejects(rpc(envelope('closed-create', f.section, f.subject, 'closed-term')), /term is unavailable/);
});

test('old deletion receipt and stale backup suppress only retired IDs, never the fresh generation', async () => {
  assert.deepEqual((await client.query('select rakeezx.n77_delete_teaching($1,$2,$3,$4,$5,$6) result', deleteArgs)).rows[0].result, receipt);
  const all = Object.fromEntries(await Promise.all([...SYNC_V2_STORES, 'device', 'outbox'].map(async name => [name, await db.getAll(name)])));
  all.device[0].n77DeleteIntent = { mutationId: receipt.mutationId };
  const writes = localDeleteWrites(all, receipt, Date.now());
  assert.equal((writes.teachings?.put ?? []).some(row => row.id === recreated.id), false);
  const remote = await canonical();
  const plan = planCloudRestore({ version: 5, sourceOwnerId: OWNER, data: { sections: [{ ...remote.sections.find(row => row.id === f.section), deleted: false }], teachings: [{ ...remote.teachings.find(row => row.id === f.teaching), deleted: false }], items: [{ ...remote.items.find(row => row.id === f.item), deleted: false }] } }, remote, { ownerId: OWNER });
  assert.equal(plan.operations.some(row => [f.teaching, f.item, recreated.id].includes(row.recordId)), false);
  assert.ok(plan.entries.some(row => row.id === f.teaching && row.reason === 'n77-deleted-scope'));
  await assert.rejects(client.query("insert into rakeezx.items(id,teaching_id,name,max) values('stale-item',$1,'stale',10)", [f.teaching]), /unavailable/);
  assert.ok((await client.query('select deleted_at from rakeezx.teachings where id=$1', [f.teaching])).rows[0].deleted_at);
});

test('whole-class delete then explicit same-label create yields new Section with no old roster/history', async () => {
  await remove(concurrentId, f.section); await remove(sibling, f.section); const last = await remove(recreated.id, f.section); assert.equal(last.receipt.scope, 'section');
  await store.save(await canonical(), { queue: false });
  const section = await store.createSection({ grade: 4, label: f.section }); assert.notEqual(section.id, f.section);
  const teaching = await store.createTeaching({ sectionId: section.id, subjectId: f.subject }); assert.notEqual(teaching.id, recreated.id);
  assert.equal(store.students(teaching.id).length, 0); assert.equal(store.items(teaching.id).length, 5);
  assert.ok((await engine.dispatchPending()).acknowledged >= 2); await store.refreshSyncedState();
  assert.equal(store.getTeaching(teaching.id).sectionId, section.id);
  assert.equal((await client.query('select count(*)::int n from rakeezx.enrollments where section_id=$1', [section.id])).rows[0].n, 0);
  assert.equal((await client.query('select count(*)::int n from rakeezx.sessions where teaching_id=$1', [teaching.id])).rows[0].n, 0);
  await assert.rejects(rpc(envelope('old-section', f.section)), /section is unavailable/);
  assert.deepEqual((await client.query("select to_jsonb(s) row from rakeezx.scores s where id='unrelated-score'")).rows[0].row, gradeBefore);
});
