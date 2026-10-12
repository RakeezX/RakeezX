// Diagnostic evidence of a release blocker, not N94 acceptance or deployment proof.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { planCloudRestore } from '../src/lib/backup-v2.js';
import { assertScoreSnapshotInvariant } from '../src/lib/initial-restore.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const directory = new URL('../supabase/migrations/', import.meta.url);
let pg;

// Same isolated SQL bootstrap as score-foundation-server.test.mjs; no network,
// mock RPC success, deployed migration, real account, or Product database writes.
before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'),('${OTHER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated,anon;
  `);
  const names = (await readdir(directory)).sort()
    .filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 34);
  for (const name of names) await pg.exec((await readFile(new URL(name, directory), 'utf8')).replace(/^\uFEFF/, ''));
});
after(async () => pg?.close());

test('N94 resolves former Product Sync and V5 restore field loss', () => {
  const definition = { id: 'sub', itemId: 'item', name: 'Homework', value: 6,
    startDate: '2026-10-13', dueDate: '2026-10-14', latePoints: 2, createdAt: 1 };
  const completion = { id: 'ssc:student:sub', studentId: 'student', subitemId: 'sub',
    checked: true, completionState: 'late' };
  const patch = encodeSyncV2Patch('scoreSubitems', definition);
  assert.equal(patch.start_date, definition.startDate); assert.equal(patch.due_date, definition.dueDate);
  assert.equal(patch.late_points, 2); assert.ok(!('created_at' in patch), 'history stays outside generic Sync patches');
  assert.deepEqual(encodeSyncV2Patch('scoreSubitemCompletions', completion),
    { student_id: 'student', subitem_id: 'sub', checked: true, completion_state: 'late' });
  const decoded = decodeSyncV2Canonical('scoreSubitems', { id: 'sub', item_id: 'item', value: 6,
    created_at: '2026-10-12T00:00:00Z', start_date: definition.startDate,
    due_date: definition.dueDate, late_points: 2, revision: 1 });
  assert.equal(decoded.createdAt, Date.parse('2026-10-12T00:00:00Z'));
  assert.equal(decoded.startDate, definition.startDate); assert.equal(decoded.dueDate, definition.dueDate); assert.equal(decoded.latePoints, 2);
  const restored = decodeSyncV2Canonical('scoreSubitemCompletions', {
    id: completion.id, student_id: 'student', subitem_id: 'sub', checked: true,
    completion_state: 'late', revision: 1 });
  assert.equal(restored.completionState, 'late');
  const plan = planCloudRestore({ version: 5, sourceOwnerId: OWNER,
    data: { scoreSubitems: [definition], scoreSubitemCompletions: [completion] } }, {}, { ownerId: OWNER });
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.operations.find((row) => row.entity === 'score_subitems').patch, { ...patch, created_at: new Date(1).toISOString() });
  assert.equal(plan.operations.find((row) => row.entity === 'score_subitem_completions').patch.completion_state, 'late');
  assert.equal(planCloudRestore({ version: 5, sourceOwnerId: OWNER, data: {} }, {},
    { ownerId: OTHER }).entries[0].reason, 'v5-owner-mismatch');
  assert.equal(assertScoreSnapshotInvariant({
    items: [{ id: 'item', max: 10, scoreMode: 'subitems' }], students: [{ id: 'student' }],
    scoreSubitems: [definition], scoreSubitemCompletions: [completion],
    scores: [{ studentId: 'student', itemId: 'item', value: 2, derivedValue: 2, manualValue: null }],
  }), true, 'restore now accepts the selected lower late points');
});

test('immutable score server has no N94 columns or completion-state RPC argument', async () => {
  const columns = (await pg.query(`select table_name,column_name from information_schema.columns
    where table_schema='rakeezx' and table_name in ('score_subitems','score_subitem_completions')`)).rows;
  assert.ok(columns.some((row) => row.column_name === 'created_at'));
  for (const key of ['start_date', 'due_date', 'late_points', 'completion_state']) {
    assert.ok(!columns.some((row) => row.column_name === key));
  }
  const args = (await pg.query(`select pg_get_function_arguments(p.oid) args from pg_proc p
    where p.pronamespace='rakeezx'::regnamespace and p.proname='apply_score_subitem_command'`)).rows;
  assert.equal(args.length, 1);
  assert.match(args[0].args, /p_checked boolean/);
  assert.doesNotMatch(args[0].args, /state|late|submitted/);
});

test('real configuration SQL silently discards dates and late points', async () => {
  await pg.exec(`
    insert into rakeezx.years(id,label,hijri_start,hijri_end,device_id) values('year','synthetic',1450,1451,'seed');
    insert into rakeezx.terms(id,year_id,name,"index",device_id) values('term','year','term',1,'seed');
    insert into rakeezx.subjects(id,name,slug,device_id) values('subject','subject','n94-subject','seed');
    insert into rakeezx.sections(id,year_id,grade,label,name,device_id) values('section','year',4,'A','section','seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,device_id) values('teaching','section','subject','term','seed');
    insert into rakeezx.students(id,name,device_id) values('student','synthetic student','seed');
    insert into rakeezx.items(id,teaching_id,name,max,device_id) values('item','teaching','assessment',10,'seed');
  `);
  const payload = { scoreMode: 'subitems', distributionMode: 'manual', max: 10,
    subitems: [{ id: 'sub', name: 'Homework', value: 6, startDate: '2026-10-13',
      dueDate: '2026-10-14', latePoints: 2 }] };
  const receipt = (await pg.query(`select rakeezx.apply_score_configuration_command($1,$2,$3,$4,$5) result`,
    ['n94:configure', 'synthetic-device', 'item', 1, payload])).rows[0].result;
  assert.equal(receipt.subitems.length, 1);
  assert.equal(Number(receipt.subitems[0].value), 6);
  for (const key of ['start_date', 'due_date', 'late_points']) assert.ok(!(key in receipt.subitems[0]));
  const stored = (await pg.query(`select to_jsonb(d) row from rakeezx.score_subitems d where id='sub'`)).rows[0].row;
  for (const key of ['start_date', 'due_date', 'late_points']) assert.ok(!(key in stored));
});

test('real completion SQL cannot select late, retains ordinary score and replay/owner safeguards', async () => {
  const command = (mutationId, checked) => pg.query(`select rakeezx.apply_score_subitem_command($1,$2,$3,$4,$5,$6,$7,$8) result`,
    [mutationId, 'synthetic-device', 'set_completion', 'item', 'student', 'sub', checked, null]);
  await assert.rejects(() => pg.query(`select rakeezx.apply_score_subitem_command(
    'n94:late','synthetic-device','set_completion','item','student','sub','late',null)`),
  /invalid input syntax for type boolean/i);
  const receipt = (await command('n94:regular', true)).rows[0].result;
  assert.equal(Number(receipt.score.value), 6);
  assert.equal(receipt.completion.checked, true);
  assert.deepEqual((await command('n94:regular', true)).rows[0].result, receipt);
  const count = async () => (await pg.query('select count(*)::int n from rakeezx.score_subitem_completions')).rows[0].n;
  assert.equal(await count(), 1);
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  try {
    await assert.rejects(() => command('n94:wrong-owner', false), /unavailable/i);
    assert.equal(await count(), 1);
    assert.equal((await pg.query('select checked from rakeezx.score_subitem_completions')).rows[0].checked, true);
  } finally { await pg.query('update auth.current_identity set id=$1', [OWNER]); }
});
