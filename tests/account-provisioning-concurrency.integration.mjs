// Disposable native PostgreSQL: independent sessions, never Production.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';

const OWNERS = ['11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'];
const defaults = JSON.stringify(buildAccountFoundationDefaults());
const migrations = new URL('../supabase/migrations/', import.meta.url);
let cluster;
let admin;
const clients = [];

async function client(owner) {
  const connection = cluster.getPgClient('postgres', '127.0.0.1');
  await connection.connect();
  clients.push(connection);
  await connection.query("set statement_timeout='30s'; set lock_timeout='20s'");
  if (owner) {
    await connection.query('set role authenticated');
    await connection.query('select pg_catalog.set_config($1,$2,false)', ['request.jwt.claim.sub', owner]);
  }
  return connection;
}

async function prepare(owner) {
  const connection = await client(owner);
  const profile = (await connection.query('select rakeezx.provision_account_profile() value')).rows[0].value;
  assert.equal(profile.provisioning.state, 'PROFILE_REQUIRED');
  const completed = (await connection.query("select rakeezx.complete_account_profile('Synthetic Teacher','0500000001','masculine',null) value")).rows[0].value;
  assert.equal(completed.provisioning.state, 'PROVISIONING_REQUIRED');
  const begun = (await connection.query('select rakeezx.begin_account_provisioning() value')).rows[0].value;
  assert.equal(begun.provisioning.state, 'PROVISIONING');
}

async function provision(owner) {
  const connection = await client(owner);
  const pid = (await connection.query('select pg_catalog.pg_backend_pid() pid')).rows[0].pid;
  const result = (await connection.query('select rakeezx.provision_account_workspace($1::jsonb) value', [defaults])).rows[0].value;
  return { pid, result };
}

async function counts(owner) {
  const result = {};
  for (const table of ['profile','account_access_grants','years','terms','subjects',
    'calendars','calendar_days','time_profiles','sections','students','scores']) {
    result[table] = Number((await admin.query(`select count(*)::int n from rakeezx.${table} where owner_id=$1`, [owner])).rows[0].n);
  }
  return result;
}

async function assertReady(owner) {
  const state = (await admin.query('select provisioning_state state,provisioning_version version,provisioning_hash hash from rakeezx.profile where owner_id=$1', [owner])).rows[0];
  assert.equal(state.state, 'READY');
  assert.equal(state.version, 1);
  assert.ok(state.hash);
  const expected = { profile: 1, account_access_grants: 1, years: 1, terms: 2,
    subjects: 1, calendars: 1, calendar_days: buildAccountFoundationDefaults().calendarDays.length,
    time_profiles: 4, sections: 0, students: 0, scores: 0 };
  assert.deepEqual(await counts(owner), expected);
  return state;
}

before(async () => {
  const installed = [new URL('../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url),
    new URL('../../../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url)];
  let moduleUrl;
  for (const path of installed) {
    try { await access(path); moduleUrl = path; break; } catch { /* next local installation */ }
  }
  if (!moduleUrl) throw new Error('Disposable native PostgreSQL installation unavailable');
  const { default: EmbeddedPostgres } = await import(moduleUrl.href);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(new URL('../test-results/account-provisioning-pg-', import.meta.url));
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  cluster = new EmbeddedPostgres({ databaseDir: directory, port, persistent: true,
    user: 'postgres', password: 'synthetic-local-test-only', createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8'], onLog() {}, onError() {} });
  await cluster.initialise();
  await cluster.start();
  admin = await client();
  await admin.query(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;`);
  for (const owner of OWNERS) await admin.query('insert into auth.users(id) values($1)', [owner]);
  for (const name of (await readdir(migrations)).sort()
    .filter((entry) => /^\d+.*\.sql$/.test(entry) && Number(entry.slice(0, 4)) <= 34)) {
    await admin.query((await readFile(new URL(name, migrations), 'utf8')).replace(/^\uFEFF/, ''));
  }
  await admin.query((await readFile(new URL('20260924003436_beta_new_account_provisioning.sql', migrations), 'utf8')));
});

after(async () => {
  await Promise.allSettled(clients.map((connection) => connection.end()));
  await cluster?.stop();
});

test('two independent sessions converge one owner to exactly one READY foundation', async () => {
  await prepare(OWNERS[0]);
  const results = await Promise.all([provision(OWNERS[0]), provision(OWNERS[0])]);
  assert.equal(new Set(results.map(({ pid }) => pid)).size, 2);
  assert.ok(results.every(({ result }) => result.contract.provisioning.state === 'READY'));
  assert.equal(new Set(results.map(({ result }) => result.contract.provisioning.foundationHash)).size, 1);
  await assertReady(OWNERS[0]);
});

test('eight independent sessions converge and replay after READY is side-effect free', async () => {
  await prepare(OWNERS[1]);
  const results = await Promise.all(Array.from({ length: 8 }, () => provision(OWNERS[1])));
  assert.equal(new Set(results.map(({ pid }) => pid)).size, 8);
  assert.ok(results.every(({ result }) => result.contract.provisioning.state === 'READY'));
  const state = await assertReady(OWNERS[1]);
  const replay = await provision(OWNERS[1]);
  assert.equal(replay.result.contract.provisioning.foundationHash, state.hash);
  assert.deepEqual(await counts(OWNERS[1]), await counts(OWNERS[0]));
});

test('different owners provision concurrently without crossing rows', async () => {
  await prepare(OWNERS[2]);
  await prepare(OWNERS[3]);
  const [a, b] = await Promise.all([provision(OWNERS[2]), provision(OWNERS[3])]);
  assert.notEqual(a.pid, b.pid);
  assert.equal(a.result.contract.provisioning.state, 'READY');
  assert.equal(b.result.contract.provisioning.state, 'READY');
  await assertReady(OWNERS[2]);
  await assertReady(OWNERS[3]);
});

test('interrupted partial foundation is completed without duplicating its preserved row', async () => {
  await prepare(OWNERS[4]);
  const year = buildAccountFoundationDefaults().years[0];
  await admin.query('select pg_catalog.set_config($1,$2,false)', ['request.jwt.claim.sub', OWNERS[4]]);
  await admin.query(`insert into rakeezx.years(owner_id,id,label,hijri_start,hijri_end,"order",status)
    values($1,$2,$3,$4,$5,$6,$7)`, [OWNERS[4], year.id, year.label,
    year.hijriStart, year.hijriEnd, year.order, year.status]);
  await admin.query('select pg_catalog.set_config($1,$2,false)', ['request.jwt.claim.sub', '']);
  const before = (await admin.query('select to_jsonb(y) row from rakeezx.years y where owner_id=$1', [OWNERS[4]])).rows[0].row;
  const result = await provision(OWNERS[4]);
  assert.equal(result.result.contract.provisioning.state, 'READY');
  const after = (await admin.query('select to_jsonb(y) row from rakeezx.years y where owner_id=$1', [OWNERS[4]])).rows[0].row;
  assert.deepEqual(after, before, 'the existing matching row was not rewritten');
  await assertReady(OWNERS[4]);
});

test('missing required foundation is never reported READY and safe retry restores only that row', async () => {
  const owner = OWNERS[4];
  const row = (await admin.query('select id from rakeezx.time_profiles where owner_id=$1 order by id limit 1', [owner])).rows[0];
  await admin.query('delete from rakeezx.time_profiles where owner_id=$1 and id=$2', [owner, row.id]);
  const connection = await client(owner);
  const contract = (await connection.query('select rakeezx.account_contract() value')).rows[0].value;
  assert.notEqual(contract.provisioning.state, 'READY');
  const repaired = (await connection.query('select rakeezx.provision_account_workspace($1::jsonb) value', [defaults])).rows[0].value;
  assert.equal(repaired.contract.provisioning.state, 'READY');
  await assertReady(owner);
});

test('new RPC grants and inherited RLS expose no new anonymous or cross-owner path', async () => {
  const functions = ['account_contract()', 'provision_account_profile()',
    'complete_account_profile(text,text,text,text)', 'begin_account_provisioning()',
    'provision_account_workspace(jsonb)', 'account_provisioning_snapshot()'];
  for (const name of functions) {
    const signature = `rakeezx.${name}`;
    const row = (await admin.query(`select pg_catalog.has_function_privilege('anon',$1,'EXECUTE') anon,
      pg_catalog.has_function_privilege('authenticated',$1,'EXECUTE') authenticated,
      p.prosecdef definer,p.proconfig config from pg_catalog.pg_proc p where p.oid=$1::regprocedure`,
    [signature])).rows[0];
    assert.equal(row.anon, false, signature);
    assert.equal(row.authenticated, true, signature);
    assert.equal(row.definer, true, signature);
    assert.ok(row.config?.some((entry) => entry.startsWith('search_path=')),
      `${signature}: ${JSON.stringify(row.config)}`);
  }
  for (const name of ['account_provisioning_foundation_complete(uuid)',
    'guard_account_provisioning_state()', 'account_contract_before_provisioning_0297()',
    'provision_account_profile_before_provisioning_0297()']) {
    const signature = `rakeezx.${name}`;
    const row = (await admin.query(`select pg_catalog.has_function_privilege('anon',$1,'EXECUTE') anon,
      pg_catalog.has_function_privilege('authenticated',$1,'EXECUTE') authenticated`, [signature])).rows[0];
    assert.equal(row.anon, false, signature);
    assert.equal(row.authenticated, false, signature);
  }
  const rls = (await admin.query(`select relrowsecurity enabled,relforcerowsecurity forced
    from pg_catalog.pg_class where oid='rakeezx.profile'::regclass`)).rows[0];
  assert.deepEqual(rls, { enabled: true, forced: true });
});

test('existing owner keeps profile and Product IDs without entering fresh provisioning', async () => {
  const owner = OWNERS[5];
  await admin.query('select pg_catalog.set_config($1,$2,false)', ['request.jwt.claim.sub', owner]);
  await admin.query("select pg_catalog.set_config('rakeezx.profile_completion','ready',false)");
  await admin.query(`insert into rakeezx.profile(owner_id,teacher_name,phone,profile_status)
    values($1,'Existing Teacher','0500000002','READY')`, [owner]);
  await admin.query("select pg_catalog.set_config('rakeezx.profile_completion','',false)");
  await admin.query(`insert into rakeezx.years(owner_id,id,label,hijri_start,hijri_end)
    values($1,'existing:year','Historical Year',1447,1448)`, [owner]);
  await admin.query(`insert into rakeezx.terms(owner_id,id,year_id,name,"index")
    values($1,'existing:term','existing:year','Historical Term',1)`, [owner]);
  await admin.query(`insert into rakeezx.subjects(owner_id,id,name,slug)
    values($1,'existing:subject','Existing Subject','existing-subject')`, [owner]);
  await admin.query(`insert into rakeezx.sections(owner_id,id,year_id,grade,label,name)
    values($1,'existing:section','existing:year',4,'A','Existing Section')`, [owner]);
  await admin.query(`insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id)
    values($1,'existing:teaching','existing:section','existing:subject','existing:term')`, [owner]);
  await admin.query(`insert into rakeezx.students(owner_id,id,name)
    values($1,'existing:student','Synthetic Student')`, [owner]);
  await admin.query(`insert into rakeezx.items(owner_id,id,teaching_id,name,max)
    values($1,'existing:item','existing:teaching','Existing Item',10)`, [owner]);
  await admin.query(`insert into rakeezx.scores(owner_id,id,student_id,item_id,value)
    values($1,'existing:score','existing:student','existing:item',8)`, [owner]);
  await admin.query(`insert into rakeezx.sessions(owner_id,id,teaching_id,date,period)
    values($1,'existing:session','existing:teaching','2026-09-24',1)`, [owner]);
  await admin.query(`insert into rakeezx.attendance(owner_id,id,student_id,session_id,teaching_id,date,status)
    values($1,'existing:attendance','existing:student','existing:session','existing:teaching','2026-09-24','present')`, [owner]);
  const before = (await admin.query(`select jsonb_build_object(
    'profile',(select to_jsonb(p) from rakeezx.profile p where owner_id=$1),
    'sections',(select jsonb_agg(to_jsonb(r)) from rakeezx.sections r where owner_id=$1),
    'students',(select jsonb_agg(to_jsonb(r)) from rakeezx.students r where owner_id=$1),
    'scores',(select jsonb_agg(to_jsonb(r)) from rakeezx.scores r where owner_id=$1),
    'attendance',(select jsonb_agg(to_jsonb(r)) from rakeezx.attendance r where owner_id=$1)) state`, [owner])).rows[0].state;
  await admin.query('select pg_catalog.set_config($1,$2,false)', ['request.jwt.claim.sub', '']);
  const connection = await client(owner);
  const profile = (await connection.query('select rakeezx.provision_account_profile() value')).rows[0].value;
  assert.equal(profile.provisioning, null);
  assert.equal(profile.profileStatus, 'READY');
  await assert.rejects(connection.query('select rakeezx.begin_account_provisioning()'),
    /not a fresh provisioning candidate/);
  const after = (await admin.query(`select jsonb_build_object(
    'profile',(select to_jsonb(p) from rakeezx.profile p where owner_id=$1),
    'sections',(select jsonb_agg(to_jsonb(r)) from rakeezx.sections r where owner_id=$1),
    'students',(select jsonb_agg(to_jsonb(r)) from rakeezx.students r where owner_id=$1),
    'scores',(select jsonb_agg(to_jsonb(r)) from rakeezx.scores r where owner_id=$1),
    'attendance',(select jsonb_agg(to_jsonb(r)) from rakeezx.attendance r where owner_id=$1)) state`, [owner])).rows[0].state;
  assert.deepEqual(after, before);
});
