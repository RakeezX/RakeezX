import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeSection, makeTeaching, makeEnrollment } from '../src/models.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });

const FROM = 'sec:local-A';
const TO = 'sec:canonical-B';
const STAMP = 1_700_000_000_000;
const scope = ['sections', 'teachings', 'enrollments', 'outbox'];
const historyStores = ['students', 'slots', 'sessions', 'attendance', 'items', 'scores', 'notes', 'logs'];
const input = () => ({ fromSectionId: FROM, canonicalSection: makeSection({
  id: TO, yearId: 'year:test', grade: 4, label: '١', name: 'Canonical TEST section',
  color: '#2563eb', updatedAt: STAMP,
}) });

const snapshot = async (names = scope) => Object.fromEntries(await Promise.all(
  names.map(async (name) => [name, await db.getAll(name)]),
));
const memorySnapshot = () => structuredClone(Object.fromEntries(
  [...scope.filter((name) => name !== 'outbox'), ...historyStores].map((name) => [name, store.state[name]]),
));

beforeEach(async () => {
  await db.clearAll();
  for (const name of Object.keys(store.state)) {
    if (Array.isArray(store.state[name])) store.state[name] = [];
  }
});
after(() => { store.closeChannel(); db.closeDB(); });

async function fixture(count = 1) {
  const section = makeSection({ id: FROM, yearId: 'year:test', grade: 4, label: '1', updatedAt: STAMP });
  const teachings = Array.from({ length: count }, (_, index) => makeTeaching({
    sectionId: FROM, subjectId: `subject:${index}`, termId: 'term:test',
    order: index, updatedAt: STAMP + index,
  }));
  const enrollments = Array.from({ length: count }, (_, index) => makeEnrollment({
    studentId: `student:test-${index}`, sectionId: FROM, rollNo: index + 1,
    startDate: '2026-09-01', updatedAt: STAMP + index,
  }));
  assert.equal(await store.save({ sections: [section], teachings, enrollments }), true);
  return { section, teachings, enrollments };
}

test('basic rekey commits canonical B and every direct reference without a tombstone for A', async () => {
  const f = await fixture();
  const before = await snapshot();
  assert.ok(before.outbox.some((entry) => entry.id === `sections:${FROM}`));
  const result = await store.rekeyLocalSectionIdentity(input());
  assert.deepEqual(result, { ok: true, status: 'rekeyed', sectionId: TO, teachings: 1, enrollments: 1 });
  const current = await snapshot();
  assert.deepEqual(current.sections, [input().canonicalSection]);
  assert.deepEqual(current.teachings, f.teachings.map((record) => ({ ...record, sectionId: TO })));
  assert.deepEqual(current.enrollments, f.enrollments.map((record) => ({ ...record, sectionId: TO })));
  assert.deepEqual(current.outbox, before.outbox.filter((entry) => entry.id !== `sections:${FROM}`));
  assert.equal(await db.get('sections', FROM), undefined);
  assert.equal(store.getSection(FROM), null);
  assert.deepEqual(store.getSection(TO), input().canonicalSection);
  assert.deepEqual(store.state.teachings, current.teachings);
  assert.deepEqual(store.state.enrollments, current.enrollments);
});

test('multiple active and deleted dependencies retain IDs, timestamps, and unrelated fields', async () => {
  const f = await fixture(3);
  const deletedTeaching = { ...f.teachings[2], deleted: true, localDetail: 'keep teaching history' };
  const deletedEnrollment = { ...f.enrollments[2], deleted: true, endDate: '2026-09-02', transferNote: 'keep history' };
  await store.save({ teachings: [deletedTeaching], enrollments: [deletedEnrollment] });
  const before = await snapshot();
  await store.rekeyLocalSectionIdentity(input());
  const current = await snapshot();
  for (const name of ['teachings', 'enrollments']) {
    assert.deepEqual(current[name], before[name].map((record) => ({ ...record, sectionId: TO })));
    assert.equal(current[name].some((record) => record.sectionId === FROM), false);
  }
});

test('existing B merges supplied defined canonical fields without erasing local-only fields', async () => {
  await fixture();
  const existing = { ...input().canonicalSection, name: 'Older name', localExtension: { keep: true }, untouched: 'keep' };
  await store.save({ sections: [existing] });
  const pendingB = await db.get('outbox', `sections:${TO}`);
  const args = input();
  args.canonicalSection.untouched = undefined;
  await store.rekeyLocalSectionIdentity(args);
  const records = await db.getAll('sections');
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], { ...input().canonicalSection, localExtension: { keep: true }, untouched: 'keep' });
  assert.deepEqual(await db.get('outbox', `sections:${TO}`), pendingB);
});

test('outbox field names and pending delete intent survive; missing dependency work is queued once', async () => {
  const f = await fixture(2);
  await store.patch('teachings', f.teachings[0].id, { order: 8, sectionId: FROM });
  await store.patch('enrollments', f.enrollments[0].id, { deleted: true });
  const deletion = { ...(await db.get('outbox', `enrollments:${f.enrollments[0].id}`)), op: 'delete' };
  await db.put('outbox', deletion);
  await db.remove('outbox', `teachings:${f.teachings[1].id}`);
  await db.remove('outbox', `enrollments:${f.enrollments[1].id}`);
  const before = await snapshot();
  const patchEntry = before.outbox.find((entry) => entry.recordId === f.teachings[0].id);
  assert.deepEqual(patchEntry.fields, ['order', 'sectionId']);
  await store.rekeyLocalSectionIdentity(input());
  assert.deepEqual(await db.get('outbox', patchEntry.id), patchEntry);
  assert.deepEqual(await db.get('outbox', deletion.id), deletion);
  for (const name of ['teachings', 'enrollments']) {
    const entry = await db.get('outbox', `${name}:${f[name][1].id}`);
    assert.equal(entry.op, 'patch');
    assert.deepEqual(entry.fields, ['sectionId']);
    assert.equal((await db.get(entry.store, entry.recordId)).sectionId, TO);
  }
  assert.equal((await db.getAll('outbox')).some((entry) => entry.recordId === FROM), false);
});

test('batch failure after queued mutations rolls back sections, dependencies, outbox and memory', async (t) => {
  await fixture(2);
  const before = await snapshot();
  const memoryBefore = memorySnapshot();
  const originalPut = IDBObjectStore.prototype.put;
  let injected = false;
  t.mock.method(IDBObjectStore.prototype, 'put', function (record, ...args) {
    const request = originalPut.call(this, record, ...args);
    if (this.name === 'enrollments') {
      injected = true;
      throw new DOMException('Injected mid-batch failure', 'DataCloneError');
    }
    return request;
  });
  t.mock.method(console, 'error', () => {});
  const result = await store.rekeyLocalSectionIdentity(input());
  assert.equal(injected, true, 'failure happened after section/teaching writes were queued');
  assert.deepEqual(result, { ok: false, status: 'write-failed', error: 'Injected mid-batch failure' });
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(memorySnapshot(), memoryBefore);
});

test('static applyBatch also aborts earlier writes on a real synchronous cloning error', async () => {
  const f = await fixture();
  const before = await snapshot();
  await assert.rejects(db.applyBatch({
    sections: { remove: [FROM], put: [input().canonicalSection] },
    teachings: { put: [{ ...f.teachings[0], sectionId: TO }] },
    enrollments: { put: [{ ...f.enrollments[0], invalid: () => {} }] },
    outbox: { remove: [`sections:${FROM}`] },
  }), { name: 'DataCloneError' });
  assert.deepEqual(await snapshot(), before);
});

test('second execution and retry after reopening IndexedDB are write-free no-ops', async (t) => {
  await fixture(2);
  await store.rekeyLocalSectionIdentity(input());
  const before = await snapshot();
  db.closeDB();
  const putSpy = t.mock.method(IDBObjectStore.prototype, 'put');
  const deleteSpy = t.mock.method(IDBObjectStore.prototype, 'delete');
  const result = await store.rekeyLocalSectionIdentity(input());
  assert.deepEqual(result, { ok: true, status: 'already-rekeyed', sectionId: TO });
  assert.equal(putSpy.mock.callCount(), 0);
  assert.equal(deleteSpy.mock.callCount(), 0);
  assert.deepEqual(await snapshot(), before);
});

test('rekey reads current disk values, including dependencies absent from stale tab memory', async () => {
  const f = await fixture();
  const newest = { ...f.teachings[0], order: 25, localDetail: 'saved by another tab' };
  const lateEnrollment = makeEnrollment({ studentId: 'student:late', sectionId: FROM, rollNo: 2, updatedAt: STAMP });
  await db.putAcross({ teachings: [newest], enrollments: [lateEnrollment] });
  assert.notEqual(store.state.teachings[0].order, 25);
  await store.rekeyLocalSectionIdentity(input());
  assert.deepEqual(await db.get('teachings', newest.id), { ...newest, sectionId: TO });
  assert.deepEqual(await db.get('enrollments', lateEnrollment.id), { ...lateEnrollment, sectionId: TO });
  assert.equal(store.state.enrollments.find((record) => record.id === lateEnrollment.id).sectionId, TO);
});

test('simultaneous same-device callers serialize to one rekey and one no-op', async () => {
  await fixture(2);
  const results = await Promise.all([
    store.rekeyLocalSectionIdentity(input()), store.rekeyLocalSectionIdentity(input()),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['already-rekeyed', 'rekeyed']);
  assert.equal((await db.getAll('sections')).length, 1);
  assert.equal((await db.getAll('teachings')).every((record) => record.sectionId === TO), true);
});

test('immutable teaching IDs preserve linked history and roster through a store reload', async () => {
  const f = await fixture();
  const teachingId = f.teachings[0].id;
  const studentId = f.enrollments[0].studentId;
  const history = {
    students: [{ id: studentId, name: 'Fictional TEST student', updatedAt: STAMP }],
    slots: [{ id: 'slot:test', teachingId, weekday: 0, period: 1 }],
    sessions: [{ id: 'session:test', teachingId, date: '2026-09-01', period: 1, status: 'completed' }],
    attendance: [{ id: 'attendance:test', teachingId, sessionId: 'session:test', studentId, status: 'present' }],
    items: [{ id: 'item:test', teachingId, name: 'TEST homework', maxScore: 10 }],
    scores: [{ id: 'score:test', itemId: 'item:test', studentId, value: 9 }],
    notes: [{ id: 'note:test', teachingId, studentId, date: '2026-09-01', text: 'TEST history' }],
    logs: [{ id: 'log:test', teachingId, studentId, delta: 1 }],
  };
  await store.save(history);
  const before = await snapshot(historyStores);
  await store.rekeyLocalSectionIdentity(input());
  db.closeDB();
  await store.init();
  assert.deepEqual(await snapshot(historyStores), before);
  assert.equal(store.getTeaching(teachingId).sectionId, TO);
  assert.equal(store.sectionRoster(TO)[0].id, studentId);
  assert.equal(store.sessionsOf(teachingId)[0].id, 'session:test');
  assert.equal(store.attendanceOf(studentId)[0].id, 'attendance:test');
  assert.equal(store.scoresOf(studentId)[0].id, 'score:test');
  assert.equal(store.notesOf(studentId)[0].id, 'note:test');
});

test('the existing BroadcastChannel invalidation refreshes a second tab after commit', async (t) => {
  await fixture();
  const peer = await import('../src/store.js?section-rekey-peer');
  t.after(() => peer.closeChannel());
  for (const name of ['sections', 'teachings', 'enrollments']) {
    peer.state[name] = structuredClone(store.state[name]);
  }
  const converged = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('peer did not receive rekey invalidation')), 3000);
    const unsubscribe = peer.subscribe(() => {
      if (peer.getSection(FROM) === null && peer.getSection(TO) &&
          peer.state.teachings.every((record) => record.sectionId === TO) &&
          peer.state.enrollments.every((record) => record.sectionId === TO)) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
    t.after(() => { clearTimeout(timer); unsubscribe(); });
  });
  await store.rekeyLocalSectionIdentity(input());
  await converged;
  assert.deepEqual(peer.state.sections, store.state.sections);
});

test('invalid input or missing local source cannot create a canonical section', async () => {
  assert.deepEqual(await store.rekeyLocalSectionIdentity(), { ok: false, status: 'invalid-input' });
  assert.deepEqual(await store.rekeyLocalSectionIdentity(input()), { ok: false, status: 'source-missing' });
  assert.deepEqual(await snapshot(), { sections: [], teachings: [], enrollments: [], outbox: [] });
});
