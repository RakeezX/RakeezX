// Disposable native PostgreSQL only; no Production account or database access.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import { makeEnrollment, makeItem, makeSection, makeStudent, makeSubject,
  makeTeaching, makeTerm, makeYear } from '../src/models.js';

global.document = { visibilityState: 'visible',
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), addEventListener() {} };
global.matchMedia = () => ({ matches: false });

const OWNER = '11111111-1111-4111-8111-111111111111';
const migrations = new URL('../supabase/migrations/', import.meta.url);
let cluster;
let client;

before(async () => {
  const candidates = [
    new URL('../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url),
    new URL('../../../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js', import.meta.url),
  ];
  let moduleUrl;
  for (const candidate of candidates) {
    try { await access(candidate); moduleUrl = candidate; break; } catch { /* next local installation */ }
  }
  if (!moduleUrl) throw new Error('Disposable native PostgreSQL installation unavailable');
  const { default: EmbeddedPostgres } = await import(moduleUrl.href);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(new URL('../test-results/score-create-incident-pg-', import.meta.url));
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
  client = cluster.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  await client.query("set statement_timeout='10s'; set lock_timeout='5s'");
  await client.query(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'); insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated,anon;`);
  for (const name of (await readdir(migrations)).sort()
    .filter((entry) => /^\d+.*\.sql$/.test(entry) && Number(entry.slice(0, 4)) <= 34)) {
    await client.query((await readFile(new URL(name, migrations), 'utf8')).replace(/^\uFEFF/, ''));
  }
  await client.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('incident:year','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index") values('incident:term','incident:year','synthetic',1);
    insert into rakeezx.subjects(id,name,slug) values('incident:subject','synthetic','incident-subject');
    insert into rakeezx.sections(id,year_id,grade,label,name)
      values('incident:section','incident:year',4,'A','synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id)
      values('incident:teaching','incident:section','incident:subject','incident:term');`);
  for (let i = 0; i < 7; i++) {
    await client.query(`insert into rakeezx.students(id,name,status) values($1,'synthetic','active')`,
      [`incident:student:${i}`]);
    await client.query(`insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status)
      values($1,$2,'incident:section',$3,'active')`,
      [`incident:enrollment:${i}`, `incident:student:${i}`, i + 1]);
  }
  for (let j = 0; j < 4; j++) {
    await client.query(`insert into rakeezx.items(id,teaching_id,name,max)
      values($1,'incident:teaching','synthetic',10)`, [`incident:item:${j}`]);
  }
});

after(async () => { store.closeChannel(); await db.closeDB(); await client?.end(); await cluster?.stop(); });

test('native server accepts exactly 28 authenticated score creates with identity and one ordinary patch', async () => {
  await activateSyntheticAccountWorkspace({ ownerId: OWNER });
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  const authoritative = (record) => ({ ...record, canonicalId: record.id, serverRevision: 1 });
  const year = authoritative(makeYear({ id: 'incident:year' }));
  const term = authoritative(makeTerm({ id: 'incident:term', yearId: year.id }));
  const subject = authoritative(makeSubject({ id: 'incident:subject' }));
  const section = authoritative(makeSection({ id: 'incident:section', yearId: year.id, grade: 4 }));
  const teaching = authoritative(makeTeaching({ id: 'incident:teaching', sectionId: section.id,
    subjectId: subject.id, termId: term.id }));
  const students = Array.from({ length: 7 }, (_, i) => authoritative(makeStudent({
    id: `incident:student:${i}`, name: `طالب ${i + 1}` })));
  const enrollments = students.map((student, i) => authoritative(makeEnrollment({
    id: `incident:enrollment:${i}`, studentId: student.id, sectionId: section.id, rollNo: i + 1 })));
  const items = Array.from({ length: 4 }, (_, i) => authoritative(makeItem({
    id: `incident:item:${i}`, teachingId: teaching.id, max: 10 })));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section],
    teachings: [teaching], students, enrollments, items }, { queue: false });
  await db.clearStore('outbox');
  for (const student of students) for (const item of items) await store.setScore(student.id, item.id, 5);
  const creates = (await db.getAll('outbox')).filter((row) => row.store === 'scores');
  assert.equal(creates.length, 28);
  await client.query('set role authenticated');
  try {
    for (const create of creates) {
      assert.ok(create.patch.student_id && create.patch.item_id && create.patch.value === 5);
      const args = ['scores', create.recordId, create.mutationId, create.deviceId, 0,
        JSON.stringify(create.patch), 'create', create.clientUpdatedAt];
      const { rows } = await client.query(`select rakeezx.apply_sync_v2_mutation(
        $1,$2,$3,$4,$5,$6::jsonb,$7,$8) receipt`, args);
      assert.equal(rows[0].receipt.mutationId, args[2]);
    }
    const counts = await client.query(`select count(*)::int total,
      count(distinct student_id)::int students,count(distinct item_id)::int items
      from rakeezx.scores where deleted_at is null`);
    assert.deepEqual(counts.rows[0], { total: 28, students: 7, items: 4 });
    await store.setScore(students[0].id, items[0].id, 7);
    const edit = (await db.getAll('outbox')).find((row) => row.op === 'patch' && row.store === 'scores');
    assert.ok(edit);
    assert.equal(edit.patch.value, 7);
    assert.equal(Object.hasOwn(edit.patch, 'student_id'), false);
    const patch = await client.query(`select rakeezx.apply_sync_v2_mutation(
      'scores',$1,'incident:score-edit',$2,1,$3::jsonb,'patch',$4) receipt`,
    [edit.recordId, edit.deviceId, JSON.stringify({ value: 7 }), Date.now()]);
    assert.equal(patch.rows[0].receipt.mutationId, 'incident:score-edit');
    const afterEdit = await client.query(`select count(*)::int total,
      max(value) filter (where id=$1) edited
      from rakeezx.scores where deleted_at is null`, [edit.recordId]);
    assert.equal(afterEdit.rows[0].total, 28);
    assert.equal(Number(afterEdit.rows[0].edited), 7);
    await assert.rejects(() => client.query(`select rakeezx.apply_sync_v2_mutation(
      'scores','incident:malformed','incident:malformed-mutation','incident-device',0,
      '{"value":5}'::jsonb,'create',$1)`, [Date.now()]),
    (error) => error.code === '23503' && error.message.includes('STUDENT_TOMBSTONED'));
  } finally {
    await client.query('reset role');
  }
});
