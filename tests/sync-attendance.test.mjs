import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import { STORES } from '../src/lib/db.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';

/*
 * Coverage migration from the retired Sync V1 fixture:
 * - push/pull counters -> durable outbox acknowledgement + canonical pulls
 * - local/remote timestamp winner tests -> ordered explicit commands + canonical receipts
 * - missing-parent error strings -> dependency block and deterministic recovery
 * - generic attendance row upserts -> attendance/fill RPC commands
 * - multiple sessions, unmarked students, null lesson and 50-student roster remain direct coverage
 * - moved-student history is covered by attendance-history.e2e.mjs
 */

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

class IsolatedIndexedDb {
  constructor(name) {
    this.name = name;
    this.factory = new IDBFactory();
    this.connection = null;
  }

  async open() {
    if (this.connection) return this.connection;
    const request = this.factory.open(this.name, 1);
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    this.connection = await requestResult(request);
    return this.connection;
  }

  async getAll(store) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async get(store, id) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).get(id));
  }

  async applyBatch(batch, { prepare } = {}) {
    const stores = Object.keys(batch);
    const connection = await this.open();
    const transaction = connection.transaction(stores, 'readwrite');
    let failure;
    const completion = transactionDone(transaction);
    try {
      const current = {};
      for (const store of stores) current[store] = await requestResult(transaction.objectStore(store).getAll());
      const writes = prepare ? prepare(current) : batch;
      if (!writes || typeof writes.then === 'function') throw new TypeError('prepare must be synchronous');
      for (const [store, operations] of Object.entries(writes)) {
        const target = transaction.objectStore(store);
        for (const id of operations.remove ?? []) target.delete(id);
        for (const record of operations.put ?? []) target.put(record);
      }
    } catch (error) {
      failure = error;
      transaction.abort();
    }
    try {
      await completion;
    } catch (error) {
      throw failure ?? error;
    }
  }

  close() {
    this.connection?.close();
    this.connection = null;
  }
}

let sequence = 0;
function makeClient(server, label, transportOverride) {
  const database = new IsolatedIndexedDb(`attendance-v2-${label}-${++sequence}`);
  let clock = 1_800_000_000_000;
  let ids = 0;
  const transport = transportOverride ?? {
    fetchRecords: (entity) => server.fetchRecords(entity),
    applyAttendanceCommand: (envelope) => server.applyAttendanceCommand(envelope),
    applyFillAttendanceCommand: (envelope) => server.applyFillAttendanceCommand(envelope),
  };
  const engine = createSyncV2Engine({
    database,
    transport,
    now: () => ++clock,
    makeId: () => `${label}-${++ids}`,
  });
  return { database, engine };
}

test('attendance command is dependency-blocked, then acknowledges and reconciles after canonical parents arrive', async (t) => {
  const server = await createAttendanceServer();
  const client = makeClient(server, 'dependency');
  t.after(async () => {
    client.database.close();
    await server.close();
  });

  await client.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session',
    sessionId: 'override-session',
    studentId: 'override-a',
    patch: { status: 'present' },
  });
  const blocked = await client.engine.dispatchPending();
  assert.equal(blocked.acknowledged, 0);
  assert.equal(blocked.blocked, 1);
  assert.equal((await client.database.getAll('outbox')).length, 1);
  assert.equal((await client.engine.status()).state, 'blocked');

  await client.engine.pullAll({ stores: ['students', 'sessions'] });
  const recovered = await client.engine.dispatchPending();
  assert.equal(recovered.acknowledged, 1);
  assert.equal(recovered.failed, 0);
  assert.equal(recovered.blocked, 0);
  assert.equal((await client.database.getAll('outbox')).length, 0);
  assert.equal((await client.database.get('attendance', 'att:override-a:override-session')).status, 'present');
  assert.equal((await client.database.get('sessionRosterSnapshots', 'srs:override-session')).members[0].studentId, 'override-a');
  assert.equal((await client.engine.status()).state, 'synced');
});

test('same student can retain distinct attendance across same-day sessions without marking other students', async (t) => {
  const server = await createAttendanceServer();
  const client = makeClient(server, 'multiple-sessions');
  t.after(async () => {
    client.database.close();
    await server.close();
  });
  await server.pg.exec(`
    insert into rakeezx.sessions(id,teaching_id,date,period,status,lesson_id)
      values ('override-session-2','override-teaching','2026-09-06',2,'scheduled',null);
  `);
  await client.engine.pullAll({ stores: ['students', 'sessions'] });
  await client.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session', sessionId: 'override-session',
    studentId: 'override-a', patch: { status: 'present' },
  });
  await client.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session-2', sessionId: 'override-session-2',
    studentId: 'override-a', patch: { status: 'excused' },
  });
  const result = await client.engine.dispatchPending();
  assert.deepEqual(
    { acknowledged: result.acknowledged, failed: result.failed, blocked: result.blocked },
    { acknowledged: 2, failed: 0, blocked: 0 },
  );
  const remote = (await server.fetchRecords('attendance')).sort((left, right) => left.session_id.localeCompare(right.session_id));
  assert.equal(remote.length, 2);
  assert.deepEqual(remote.map((row) => row.status), ['present', 'excused']);
  assert.equal(remote.every((row) => row.student_id === 'override-a' && row.teaching_id === 'override-teaching'), true);
  assert.equal(remote.some((row) => row.student_id === 'override-b' || row.student_id === 'override-c'), false);
  assert.equal(new Set(remote.map((row) => `${row.session_id}:${row.student_id}`)).size, 2);
});

test('bulk attendance supports a large roster through one acknowledged fill command', async (t) => {
  const server = await createAttendanceServer();
  const client = makeClient(server, 'large-roster');
  t.after(async () => {
    client.database.close();
    await server.close();
  });
  const studentIds = Array.from({ length: 50 }, (_, index) => `bulk-${String(index).padStart(2, '0')}`);
  const students = studentIds.map((id, index) => `('${id}','طالب اختبار ${index}','active')`).join(',');
  const enrollments = studentIds.map((id, index) => `('en-${id}','${id}','override-section',${index + 10},'active','2026-08-01')`).join(',');
  await server.pg.exec(`
    insert into rakeezx.students(id,name,status) values ${students};
    insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,start_date) values ${enrollments};
  `);
  await client.engine.pullAll({ stores: ['students', 'sessions'] });
  await client.engine.queueFillAttendanceCommand({
    sessionId: 'override-session', status: 'present', studentIds,
  });
  const result = await client.engine.dispatchPending();
  assert.equal(result.acknowledged, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.blocked, 0);
  const remote = await server.fetchRecords('attendance');
  assert.equal(remote.length, 53, 'the canonical active roster includes the three base students plus fifty added students');
  assert.equal(new Set(remote.map((row) => `${row.session_id}:${row.student_id}`)).size, 53);
  assert.equal(remote.every((row) => row.status === 'present'), true);
  assert.equal((await client.database.getAll('outbox')).length, 0);
});

test('canonical attendance converges across clients and the later explicit action wins without duplicates', async (t) => {
  const server = await createAttendanceServer();
  const first = makeClient(server, 'first-client');
  const second = makeClient(server, 'second-client');
  t.after(async () => {
    first.database.close();
    second.database.close();
    await server.close();
  });
  for (const client of [first, second]) await client.engine.pullAll({ stores: ['students', 'sessions'] });

  await first.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session', sessionId: 'override-session',
    studentId: 'override-a', patch: { status: 'present' },
  });
  assert.equal((await first.engine.dispatchPending()).acknowledged, 1);
  await second.engine.pullAll({ stores: ['attendance', 'sessionRosterSnapshots'] });
  assert.equal((await second.database.get('attendance', 'att:override-a:override-session')).status, 'present');

  await first.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session', sessionId: 'override-session',
    studentId: 'override-a', patch: { status: 'absent' },
  });
  assert.equal((await first.engine.dispatchPending()).acknowledged, 1);
  await second.engine.pullAll({ stores: ['attendance'] });
  assert.equal((await second.database.get('attendance', 'att:override-a:override-session')).status, 'absent');

  await second.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session', sessionId: 'override-session',
    studentId: 'override-a', patch: { status: 'late' },
  });
  assert.equal((await second.engine.dispatchPending()).acknowledged, 1);
  await first.engine.pullAll({ stores: ['attendance'] });
  first.database.close();
  assert.equal((await first.database.get('attendance', 'att:override-a:override-session')).status, 'late');
  for (const client of [first, second]) {
    const rows = await client.database.getAll('attendance');
    assert.equal(rows.length, 1);
    assert.equal(new Set(rows.map((row) => `${row.sessionId}:${row.studentId}`)).size, 1);
    assert.equal((await client.database.getAll('outbox')).length, 0);
  }
  const remote = await server.fetchRecords('attendance');
  assert.equal(remote.length, 1);
  assert.equal(remote[0].status, 'late');
});

test('lost acknowledgement keeps the durable command identity and safely reconciles on retry after reopen', async (t) => {
  const server = await createAttendanceServer();
  let loseResponse = true;
  const transport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    applyFillAttendanceCommand: (envelope) => server.applyFillAttendanceCommand(envelope),
    async applyAttendanceCommand(envelope) {
      const receipt = await server.applyAttendanceCommand(envelope);
      if (loseResponse) {
        loseResponse = false;
        throw new Error('synthetic lost acknowledgement');
      }
      return receipt;
    },
  };
  const client = makeClient(server, 'lost-ack', transport);
  t.after(async () => {
    client.database.close();
    await server.close();
  });
  await client.engine.pullAll({ stores: ['students', 'sessions'] });
  await client.engine.queueAttendanceCommand({
    attendanceId: 'att:override-a:override-session', sessionId: 'override-session',
    studentId: 'override-a', patch: { status: 'excused' },
  });
  const identity = (await client.database.getAll('outbox'))[0].mutationId;
  const failed = await client.engine.dispatchPending();
  assert.equal(failed.failed, 1);
  assert.equal((await client.database.getAll('outbox'))[0].mutationId, identity);

  client.database.close();
  const retried = await client.engine.dispatchPending();
  assert.equal(retried.acknowledged, 1);
  assert.equal((await client.database.getAll('outbox')).length, 0);
  assert.deepEqual(server.calls.map((call) => call.mutationId), [identity, identity]);
  assert.equal((await server.fetchRecords('attendance')).length, 1);
  assert.equal((await client.database.get('attendance', 'att:override-a:override-session')).status, 'excused');
});
