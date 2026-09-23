// Explicit local-only gate: two independent clients of one disposable native PostgreSQL server.
// Install embedded-postgres under ignored test-results/postgres-concurrency, or provide its
// existing module path through RAKEEZ_TEST_EMBEDDED_PG_MODULE. Never use a remote database.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';

const OWNER = '11111111-1111-4111-8111-111111111111';
const migrations = new URL('../supabase/migrations/', import.meta.url);
let cluster;
let admin;
const clients = [];

async function connection(authenticated = false) {
  const client = cluster.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  clients.push(client);
  await client.query("set statement_timeout='10s'; set lock_timeout='5s'");
  if (authenticated) await client.query('set role authenticated');
  return client;
}

before(async () => {
  const installed = [
    new URL('../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url),
    new URL('../../../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url),
  ];
  const moduleUrl = process.env.RAKEEZ_TEST_EMBEDDED_PG_MODULE
    ? pathToFileURL(process.env.RAKEEZ_TEST_EMBEDDED_PG_MODULE)
    : await (async () => {
      for (const url of installed) {
        try { await access(url); return url; } catch { /* Try the next ignored local test installation. */ }
      }
      throw new Error('Disposable embedded-postgres installation unavailable');
    })();
  const { default: EmbeddedPostgres } = await import(moduleUrl.href);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(new URL('../test-results/score-foundation-pg-', import.meta.url));
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  cluster = new EmbeddedPostgres({ databaseDir: directory, port, persistent: true,
    user: 'postgres', password: 'synthetic-local-test-only', createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8'],
    onLog() {}, onError() {} });
  await cluster.initialise();
  await cluster.start();
  admin = await connection();
  await admin.query(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'); insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated,anon;`);
  for (const name of (await readdir(migrations)).sort()
    .filter((entry) => /^\d+.*\.sql$/.test(entry) && Number(entry.slice(0, 4)) <= 33)) {
    await admin.query((await readFile(new URL(name, migrations), 'utf8')).replace(/^\uFEFF/, ''));
  }
  await admin.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('race:year','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index") values('race:term','race:year','synthetic',1);
    insert into rakeezx.subjects(id,name,slug) values('race:subject','synthetic','race-subject');
    insert into rakeezx.sections(id,year_id,grade,label,name)
      values('race:section','race:year',4,'A','synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id)
      values('race:teaching','race:section','race:subject','race:term');
    insert into rakeezx.students(id,name,status) values('race:student','synthetic','active');`);
});

after(async () => {
  await Promise.allSettled(clients.map((client) => client.end()));
  await cluster?.stop(); // Preserve only this ignored disposable database as test evidence.
});

async function fixture(suffix, value) {
  const item = `race:item:${suffix}`;
  const subitem = `race:sub:${suffix}`;
  await admin.query(`insert into rakeezx.items(id,teaching_id,name,max)
    values($1,'race:teaching','synthetic',10)`, [item]);
  await admin.query('begin');
  try {
    await admin.query("select set_config('rakeezx.score_domain_write','on',true)");
    await admin.query(`update rakeezx.items set score_mode='subitems',distribution_mode='manual' where id=$1`, [item]);
    await admin.query(`insert into rakeezx.score_subitems(id,item_id,name,value,"order",device_id)
      values($1,$2,'synthetic',$3,0,'seed')`, [subitem, item, value]);
    await admin.query('commit');
  } catch (error) {
    await admin.query('rollback');
    throw error;
  }
  return { item, subitem };
}

async function command(client, mutation, device, action, { item, subitem }, value) {
  return (await client.query(`select rakeezx.apply_score_subitem_command(
    $1,$2,$3,$4,'race:student',$5,$6,$7) result`,
    [mutation, device, action, item,
      action === 'set_completion' ? subitem : null,
      action === 'set_completion' ? value : null,
      action === 'set_manual' ? value : null])).rows[0].result;
}

async function waitForLock(waiter, holder) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const row = (await admin.query('select pg_blocking_pids($1) blockers from pg_stat_activity where pid=$1',
      [waiter.processID])).rows[0];
    if (row?.blockers?.includes(holder.processID)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('second PostgreSQL connection never blocked behind the first transaction');
}

async function freshState({ item, subitem }) {
  const reader = await connection(true);
  assert.notEqual(reader.processID, admin.processID);
  const score = (await reader.query(`select owner_id,revision,derived_value,manual_value,value
    from rakeezx.scores where item_id=$1 and student_id='race:student'`, [item])).rows[0];
  const definition = (await reader.query(`select owner_id,revision,value from rakeezx.score_subitems where id=$1`,
    [subitem])).rows[0];
  const completions = (await reader.query(`select owner_id,revision,checked from rakeezx.score_subitem_completions
    where subitem_id=$1 and student_id='race:student'`, [subitem])).rows;
  assert.equal(String(score?.owner_id), OWNER);
  assert.equal(String(definition?.owner_id), OWNER);
  assert.ok(Number(score.revision) >= 1 && Number(definition.revision) >= 1);
  assert.ok(completions.every((row) => String(row.owner_id) === OWNER && Number(row.revision) >= 1));
  return { score, definition, completions };
}

async function overlap(first, second) {
  const a = await connection(true);
  const b = await connection(true);
  assert.notEqual(a.processID, b.processID);
  await a.query('begin');
  let committed = false;
  try {
    const firstResult = await first(a);
    const secondPromise = second(b);
    secondPromise.catch(() => {});
    await waitForLock(b, a);
    await a.query('commit');
    committed = true;
    return [firstResult, await secondPromise];
  } finally {
    if (!committed) await a.query('rollback');
  }
}

test('two independent sessions: completion and manual both survive', async () => {
  const f = await fixture('three', 3);
  await overlap(
    (a) => command(a, 'race:three:check', 'device:A', 'set_completion', f, true),
    (b) => command(b, 'race:three:manual', 'device:B', 'set_manual', f, 5));
  const { score, completions } = await freshState(f);
  assert.deepEqual([Number(score.derived_value), Number(score.manual_value), Number(score.value)], [3, 5, 8]);
  assert.deepEqual(completions.map((row) => row.checked), [true]);
});

test('two independent sessions: accepted manual is capped, not hidden', async () => {
  const f = await fixture('seven', 7);
  await overlap(
    (a) => command(a, 'race:seven:check', 'device:A', 'set_completion', f, true),
    (b) => command(b, 'race:seven:manual', 'device:B', 'set_manual', f, 5));
  const { score, completions } = await freshState(f);
  assert.deepEqual([Number(score.derived_value), Number(score.manual_value), Number(score.value)], [7, 3, 10]);
  assert.deepEqual(completions.map((row) => row.checked), [true]);
});

test('two independent sessions: uncheck and manual change recompute final state', async () => {
  const f = await fixture('uncheck', 3);
  const setup = await connection(true);
  await command(setup, 'race:uncheck:initial-check', 'seed', 'set_completion', f, true);
  await command(setup, 'race:uncheck:initial-manual', 'seed', 'set_manual', f, 2);
  await overlap(
    (a) => command(a, 'race:uncheck:remove', 'device:A', 'set_completion', f, false),
    (b) => command(b, 'race:uncheck:manual', 'device:B', 'set_manual', f, 7));
  const { score, completions } = await freshState(f);
  assert.deepEqual([Number(score.derived_value), Number(score.manual_value), Number(score.value)], [0, 7, 7]);
  assert.deepEqual(completions.map((row) => row.checked), [false]);
});

test('two independent sessions: retry after commit returns the same receipt without duplicates', async () => {
  const f = await fixture('retry', 3);
  const [first, retry] = await overlap(
    (a) => command(a, 'race:retry:same-id', 'device:A', 'set_completion', f, true),
    (b) => command(b, 'race:retry:same-id', 'device:A', 'set_completion', f, true));
  assert.deepEqual(retry, first);
  const reader = await connection(true);
  const { score, completions } = await freshState(f);
  assert.deepEqual([Number(score.derived_value), score.manual_value, Number(score.value)], [3, null, 3]);
  assert.deepEqual(completions.map((row) => row.checked), [true]);
  assert.equal((await reader.query(`select count(*)::int n from rakeezx.score_domain_receipts
    where mutation_id='race:retry:same-id'`)).rows[0].n, 1);
  assert.equal((await reader.query(`select count(*)::int n from rakeezx.scores
    where item_id=$1 and student_id='race:student'`, [f.item])).rows[0].n, 1);
});
