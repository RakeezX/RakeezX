// Explicit local-only integration gate. Install test-only embedded-postgres in
// test-results/postgres-concurrency (not Product package.json). No remote URL.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { installLifecycleServer, academicFixture, lifecycle, OWNER } from './helpers/student-lifecycle-server.mjs';

let cluster, admin;
const clients = [];
before(async () => {
  const { default: EmbeddedPostgres } = await import('../test-results/postgres-concurrency/node_modules/embedded-postgres/dist/index.js');
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(new URL('../test-results/student-lifecycle-pg-', import.meta.url));
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  cluster = new EmbeddedPostgres({ databaseDir: directory, port, persistent: true,
    user: 'postgres', password: 'synthetic-local-test-only', createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8'],
    onLog() {}, onError() {} });
  await cluster.initialise(); await cluster.start();
  admin = await connection();
  admin.exec = (sql) => admin.query(sql);
  await installLifecycleServer(admin);
});
after(async () => {
  await Promise.all(clients.map((client) => client.end()));
  await cluster?.stop(); // persistent=true: no recursive deletion.
});
async function connection() {
  const client = cluster.getPgClient('postgres', '127.0.0.1');
  await client.connect(); clients.push(client);
  await client.query(`set statement_timeout='5s'; set lock_timeout='3s'; set deadlock_timeout='100ms'`);
  return client;
}
async function waitingOnOwner(client) {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    const row = (await admin.query(`select wait_event from pg_stat_activity where pid=$1`, [client.processID])).rows[0];
    if (row?.wait_event === 'advisory') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('operation did not wait at the owner advisory boundary');
}
async function holdOwner(client) {
  await client.query('begin');
  await client.query(`select rakeezx.lock_student_lifecycle($1::uuid)`, [OWNER]);
}

test('direct UPDATE waits BEFORE tuple locks; owner-holding lifecycle can update the same row without deadlock', async () => {
  const f = await academicFixture(admin, 'lock-direct');
  const a = await connection(), b = await connection();
  await holdOwner(a);
  await b.query('set role authenticated');
  const update = b.query(`update rakeezx.students set name='synthetic override' where id=$1`, [f.student]);
  await waitingOnOwner(b);
  const ended = await lifecycle(a, 'end_enrollment', { studentId: f.student, sourceEnrollmentId: f.enrollment, sourceRevision: 1 });
  assert.equal(ended.outcome, 'applied');
  await a.query('commit');
  await update;
  assert.equal((await admin.query(`select name,status from rakeezx.students where id=$1`, [f.student])).rows[0].status, 'withdrawn');
});

test('legacy roster RPC waits at owner boundary BEFORE section locks and remains SECURITY INVOKER', async () => {
  const f = await academicFixture(admin, 'lock-legacy');
  const a = await connection(), b = await connection();
  await holdOwner(a);
  const renumber = b.query(`select rakeezx.renumber_enrollment_roster($1,$2::jsonb)`, [f.section,
    JSON.stringify([{ id: f.enrollment, roll_no: 1, client_updated_at: 100, device_id: 'legacy' }])]);
  await waitingOnOwner(b);
  // This same section would deadlock if legacy RPC took its section lock first.
  await a.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${OWNER}:section:${f.section}`]);
  await a.query('commit'); await renumber;
  const rows = (await admin.query(`select prosecdef from pg_proc where oid='rakeezx.renumber_enrollment_roster(text,jsonb)'::regprocedure`)).rows;
  assert.equal(rows[0].prosecdef, false);
});

test('bulk attendance before pristine delete protects history; reverse order rejects stale attendance atomically', async () => {
  for (const deleteFirst of [false, true]) {
    const f = await academicFixture(admin, `lock-bulk-${deleteFirst}`);
    const a = await connection(), b = await connection();
    await holdOwner(a);
    const runBulk = (client) => client.query(`select rakeezx.apply_sync_v2_fill_attendance_command($1,'bulk-device',$2,'present',100) result`, [`bulk:${f.student}`, f.session]);
    if (!deleteFirst) {
      const deletion = lifecycle(b, 'delete_pristine', { studentId: f.student });
      await waitingOnOwner(b);
      assert.equal((await runBulk(a)).rows[0].result.outcome, 'applied');
      await a.query('commit');
      assert.equal((await deletion).reason, 'attendance');
      assert.equal((await admin.query(`select count(*)::int n from rakeezx.attendance where student_id=$1`, [f.student])).rows[0].n, 1);
    } else {
      // Queue a stale explicit attendance command: bulk uses live roster and
      // would simply exclude a student deleted before roster capture.
      const stale = b.query(`select rakeezx.apply_sync_v2_attendance_command('stale-att','b',$1,$2,$3,0,'{"status":"present"}',100)`,
        [`attendance:${f.student}`, f.session, f.student]);
      const rejected = assert.rejects(stale, { code: '22023', message: 'Attendance student is unavailable' });
      await waitingOnOwner(b);
      assert.equal((await lifecycle(a, 'delete_pristine', { studentId: f.student })).outcome, 'applied');
      await a.query('commit'); await rejected;
      assert.equal((await admin.query(`select count(*)::int n from rakeezx.attendance where student_id=$1`, [f.student])).rows[0].n, 0);
    }
  }
});

test('concurrent generic child Sync and pristine deletion serialize; no protected evidence disappears', async () => {
  const f = await academicFixture(admin, 'lock-sync');
  const a = await connection(), b = await connection();
  await holdOwner(a);
  const deletion = lifecycle(b, 'delete_pristine', { studentId: f.student });
  await waitingOnOwner(b);
  const result = (await a.query(`select rakeezx.apply_sync_v2_mutation('scores','lock-score','lock-score-mutation','a',0,$1::jsonb,'create',100) result`,
    [JSON.stringify({ student_id: f.student, item_id: f.item, value: 0 })])).rows[0].result;
  assert.equal(result.outcome, 'applied');
  await a.query('commit');
  assert.equal((await deletion).reason, 'scores');
  assert.equal(Number((await admin.query(`select value from rakeezx.scores where id='lock-score'`)).rows[0].value), 0);
});

test('bulk attendance and end-enrollment preserve both historical rows and the original interval', async () => {
  const f = await academicFixture(admin, 'lock-bulk-end');
  const a = await connection(), b = await connection();
  await holdOwner(a);
  const ending = lifecycle(b, 'end_enrollment', { studentId: f.student,
    sourceEnrollmentId: f.enrollment, sourceRevision: 1 });
  await waitingOnOwner(b);
  assert.equal((await a.query(`select rakeezx.apply_sync_v2_fill_attendance_command('bulk-before-end','a',$1,'present',100) result`, [f.session])).rows[0].result.outcome, 'applied');
  const before = (await a.query(`select to_jsonb(t) record from rakeezx.attendance t where student_id=$1`, [f.student])).rows;
  await a.query('commit');
  const result = await ending;
  assert.equal(result.outcome, 'applied');
  assert.equal(result.enrollments.find((row) => row.id === f.enrollment).start_date, '2026-08-01');
  assert.deepEqual((await admin.query(`select to_jsonb(t) record from rakeezx.attendance t where student_id=$1`, [f.student])).rows, before);
});

test('session delete enters owner boundary before session lock while lifecycle holds it', async () => {
  const f = await academicFixture(admin, 'lock-session');
  const a = await connection(), b = await connection();
  await holdOwner(a);
  const sessionDelete = b.query(`select rakeezx.apply_sync_v2_session_delete_command('lock-session-delete','b',$1,100) result`, [f.session]);
  await waitingOnOwner(b);
  await a.query(`select * from rakeezx.sessions where id=$1 for update`, [f.session]);
  assert.equal((await lifecycle(a, 'end_enrollment', { studentId: f.student, sourceEnrollmentId: f.enrollment, sourceRevision: 1 })).outcome, 'applied');
  await a.query('commit');
  assert.equal((await sessionDelete).rows[0].result.outcome, 'deleted');
});

test('normal 40-student bulk attendance and 24 concurrent Sync commands complete with no duplicates/deadlocks', async () => {
  const f = await academicFixture(admin, 'lock-throughput');
  for (let i = 1; i < 40; i++) {
    await admin.query(`insert into rakeezx.students(id,name,status) values($1,'synthetic','active')`, [`bulk-student:${i}`]);
    await admin.query(`insert into rakeezx.enrollments(id,student_id,section_id,roll_no,start_date,status) values($1,$2,$3,$4,'2026-08-01','active')`,
      [`bulk-en:${i}`, `bulk-student:${i}`, f.section, i + 1]);
  }
  const workers = await Promise.all(Array.from({ length: 4 }, connection));
  const started = performance.now();
  const bulk = workers[0].query(`select rakeezx.apply_sync_v2_fill_attendance_command('throughput-bulk','a',$1,'present',100) result`, [f.session]);
  const mutations = workers.slice(1).map(async (client, worker) => {
    for (let i = 0; i < 8; i++) {
      const id = `throughput-note:${worker}:${i}`;
      const result = (await client.query(`select rakeezx.apply_sync_v2_mutation('notes',$1,$1,'b',0,$2::jsonb,'create',100) result`,
        [id, JSON.stringify({ student_id: f.student, date: '2026-08-02', text: 'synthetic' })])).rows[0].result;
      assert.equal(result.outcome, 'applied');
    }
  });
  await Promise.all([bulk, ...mutations]);
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 5000, `local practicality bound exceeded: ${elapsed}ms`);
  assert.equal((await admin.query(`select count(*)::int n,count(distinct student_id)::int students from rakeezx.attendance where session_id=$1`, [f.session])).rows[0].n, 40);
  assert.equal((await admin.query(`select count(*)::int n from rakeezx.notes where id like 'throughput-note:%'`)).rows[0].n, 24);
  console.log(`Local PostgreSQL: 40-student bulk + 24 Sync commands: ${Math.round(elapsed)}ms; no deadlocks.`);
});
