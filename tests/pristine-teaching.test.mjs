import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeSection, makeTeaching, makeItem, defaultItemsFor, studentTotal } from '../src/models.js';
import { inspectPristineTeaching, teachingReplacementHash } from '../src/lib/pristine-teaching.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });
const YEAR = 'year:TEST', TERM = 'term:TEST', SUBJECT = 'subject:TEST';
const A = 'sec:TEST-A', B = 'sec:TEST-B';
const snapshot = async () => Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
beforeEach(async () => {
  await db.clearAll();
  for (const name of Object.keys(store.state)) if (Array.isArray(store.state[name])) store.state[name] = [];
  store.state.device = null; store.state.profile = null;
});
after(() => { store.closeChannel(); db.closeDB(); });

async function fixture() {
  await store.save({ sections: [makeSection({ id: A, yearId: YEAR, grade: 4, label: '1' })] }, { queue: false });
  // Exercise the real creation path, including its private local-only receipt.
  const ta = await store.createTeaching({ sectionId: A, subjectId: SUBJECT, termId: TERM });
  const tb = makeTeaching({ sectionId: B, subjectId: SUBJECT, termId: TERM });
  const items = structuredClone(store.items(ta.id));
  assert.equal((await store.rekeyLocalSectionIdentity({ fromSectionId: A,
    canonicalSection: makeSection({ id: B, yearId: YEAR, grade: 4, label: '1' }) })).ok, true);
  const args = { fromTeachingId: ta.id, canonicalTeaching: tb };
  assert.equal(inspectPristineTeaching(await snapshot(), ta.id).pristine, true);
  return { ta, tb, items, args };
}

test('actual creation provenance and canonical five defaults allow atomic local-only adoption, not item union', async t => {
  const f = await fixture();
  const canonicalItems = defaultItemsFor(f.tb.id);
  await store.save({ teachings: [f.tb], items: canonicalItems }, { queue: false });
  const before = await snapshot();
  const writeStores = new Set();
  for (const method of ['put', 'delete']) {
    const original = IDBObjectStore.prototype[method];
    t.mock.method(IDBObjectStore.prototype, method, function (...args) { writeStores.add(this.name); return original.apply(this, args); });
  }
  const result = await store.adoptPristineTeachingIdentity(f.args);
  assert.equal(result.status, 'adopted');
  const current = await snapshot();
  assert.deepEqual(current.teachings, [f.tb]);
  assert.deepEqual(current.items, before.items.filter(row => row.teachingId === f.tb.id));
  assert.deepEqual(current.outbox, []);
  assert.deepEqual([...writeStores].sort(), ['items', 'outbox', 'teachings']);
  for (const name of db.STORES.filter(name => !writeStores.has(name))) assert.deepEqual(current[name], before[name]);
  assert.equal(await db.get('teachings', f.ta.id), undefined);
  assert.equal(store.getTeaching(f.ta.id), null);
  const total = studentTotal(store.items(f.tb.id), { classHasParticipation: false, scoresByItem: {}, attendance: [], logs: [] });
  assert.equal(total.outOfAll, 100);
  assert.equal(store.items(f.tb.id).length, 5);
  assert.equal(current.outbox.some(row => row.op === 'delete'), false);
});

for (const [name, record] of [
  ['scores', f => ({ id: 'score:TEST', itemId: f.items[0].id, studentId: 'student:TEST', value: 1 })],
  ['sessions', f => ({ id: 'session:TEST', teachingId: f.ta.id })],
  ['attendance', f => ({ id: 'attendance:TEST', teachingId: f.ta.id, status: 'present' })],
  ['notes', f => ({ id: 'note:TEST', teachingId: f.ta.id, text: 'TEST note' })],
  ['logs', f => ({ id: 'log:TEST', teachingId: f.ta.id, delta: 1 })],
  ['assignments', f => ({ id: 'assignment:TEST', teachingId: f.ta.id })],
  ['submissions', f => ({ id: 'submission:TEST', assignmentId: `assignment:${f.ta.id}` })],
  ['slots', f => ({ id: 'slot:TEST', teachingId: f.ta.id, weekday: 0, period: 1 })],
  ['device', f => ({ id: 'device', groupArrangements: { [f.ta.id]: [['student:TEST']] } })],
  ['device', f => ({ id: 'device', futureTeachingSetting: { [f.ta.id]: { edited: true } } })],
  ['meta', f => ({ id: 'future-linked-record', nested: { item: f.items[0].id } })],
  ['outbox', f => ({ id: 'orphan:TEST', store: 'sessions', recordId: `se:${f.ta.id}:TEST`, op: 'delete' })],
  ['sessions', f => ({ id: 'session:deleted', teachingId: f.ta.id, deleted: true })],
]) {
  test(`independent ${name} meaningful/reference state blocks and preserves every disk record`, async () => {
    const f = await fixture();
    // Disk-only write also models a newer peer tab not yet reflected in this tab's memory.
    await db.put(name, record(f));
    const before = await snapshot();
    const result = await store.adoptPristineTeachingIdentity(f.args);
    assert.equal(result.code, 'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION');
    assert.match(result.reason, /^linked-data:/);
    assert.deepEqual(await snapshot(), before);
  });
}

for (const change of [{ name: 'TEST edited' }, { max: 11 }, { order: 99 }, { auto: 'custom' }, { perPoint: 2 },
  { penalty: 2 }, { unitId: 'unit:TEST' }, { deleted: true }, { extraField: 'unknown work' }]) {
  test(`modified canonical item ${Object.keys(change)[0]} cannot be abandoned`, async () => {
    const f = await fixture();
    await db.put('items', { ...f.items[0], ...change });
    const before = await snapshot();
    assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'default-item-modified');
    assert.deepEqual(await snapshot(), before);
  });
}

test('extra item, missing default, and legacy lookalike defaults without receipt are not pristine', async () => {
  const f = await fixture();
  const extra = makeItem({ teachingId: f.ta.id, name: 'TEST custom', max: 10 });
  await db.put('items', extra);
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'default-item-count');
  await db.remove('items', extra.id);
  await db.remove('items', f.items[0].id);
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'default-item-count');
  await db.put('items', f.items[0]);
  const entry = await db.get('outbox', `teachings:${f.ta.id}`);
  delete entry.pristineTeachingCreation;
  await db.put('outbox', entry);
  const before = await snapshot();
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'creation-proof-missing');
  assert.deepEqual(await snapshot(), before);
});

test('changed-back item, changed teaching, pending delete and missing outbox proof block', async () => {
  const f = await fixture();
  const baseline = await snapshot();
  await store.patch('items', f.items[0].id, { name: 'TEST edited' });
  await store.patch('items', f.items[0].id, { name: f.items[0].name });
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).ok, false);
  await db.putAcross({ items: baseline.items, outbox: baseline.outbox });
  await db.put('teachings', { ...baseline.teachings[0], order: 2 });
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'teaching-modified');
  await db.putAcross({ teachings: baseline.teachings });
  const entry = baseline.outbox.find(row => row.store === 'items');
  await db.put('outbox', { ...entry, op: 'delete' });
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'meaningful-or-missing-outbox-work');
  await db.remove('outbox', entry.id);
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).reason, 'meaningful-or-missing-outbox-work');
});

test('transaction rollback after teaching/default removals preserves disk, outbox and memory exactly', async t => {
  const f = await fixture();
  const before = await snapshot(), memory = structuredClone(store.state);
  const original = IDBObjectStore.prototype.delete;
  let injected = false;
  t.mock.method(IDBObjectStore.prototype, 'delete', function (...args) {
    const request = original.apply(this, args);
    if (this.name === 'outbox') { injected = true; throw new DOMException('TEST rollback', 'DataCloneError'); }
    return request;
  });
  t.mock.method(console, 'error', () => {});
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).code, 'TEACHING_IDENTITY_ADOPTION_WRITE_FAILED');
  assert.equal(injected, true);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(store.state, memory);
});

test('repeat and simultaneous callers are write-free/idempotent and survive DB reopen', async t => {
  const f = await fixture();
  const results = await Promise.all([store.adoptPristineTeachingIdentity(f.args), store.adoptPristineTeachingIdentity(f.args)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['adopted', 'already-adopted']);
  const before = await snapshot();
  db.closeDB();
  const put = t.mock.method(IDBObjectStore.prototype, 'put'), remove = t.mock.method(IDBObjectStore.prototype, 'delete');
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).status, 'already-adopted');
  assert.equal(put.mock.callCount(), 0); assert.equal(remove.mock.callCount(), 0);
  assert.deepEqual(await snapshot(), before);
  await store.init();
  assert.equal(store.getTeaching(f.ta.id), null); assert.ok(store.getTeaching(f.tb.id));
});

test('already-adopted retry refreshes a stale tab without any writes or stale default items', async t => {
  const f = await fixture();
  const stale = { teachings: structuredClone(store.state.teachings), items: structuredClone(store.state.items) };
  await store.adoptPristineTeachingIdentity(f.args);
  Object.assign(store.state, stale); // Peer committed, but its invalidation has not arrived.
  const put = t.mock.method(IDBObjectStore.prototype, 'put'), remove = t.mock.method(IDBObjectStore.prototype, 'delete');
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).status, 'already-adopted');
  assert.equal(store.getTeaching(f.ta.id), null);
  assert.ok(store.getTeaching(f.tb.id));
  assert.deepEqual(store.items(f.ta.id), []);
  assert.equal(put.mock.callCount(), 0); assert.equal(remove.mock.callCount(), 0);
});

test('auth evidence/local-source races fail closed; existing canonical metadata and unrelated work survive', async () => {
  const f = await fixture();
  let before = await snapshot();
  assert.equal((await store.adoptPristineTeachingIdentity({ ...f.args, validateEvidence: () => false })).code, 'TEACHING_IDENTITY_PRESENCE_UNKNOWN');
  assert.deepEqual(await snapshot(), before);
  assert.equal((await store.adoptPristineTeachingIdentity({ ...f.args, expectedSource: { ...before.teachings[0], order: 99 } })).reason, 'source-changed');
  const existing = { ...f.tb, order: 7, localDetail: 'TEST keep' };
  await store.save({ teachings: [existing], notes: [{ id: 'unrelated:note', teachingId: 'unrelated:teaching', text: 'TEST keep' }] });
  before = await snapshot();
  assert.equal((await store.adoptPristineTeachingIdentity(f.args)).ok, true);
  assert.deepEqual(await db.get('teachings', f.tb.id), existing);
  assert.deepEqual(await db.getAll('notes'), before.notes);
  assert.deepEqual(await db.getAll('outbox'), before.outbox.filter(row => ![f.ta.id, ...f.items.map(item => item.id)].includes(row.recordId)));
});

test('post-commit BroadcastChannel invalidation refreshes another tab without feedback writes', async t => {
  const f = await fixture();
  const peer = await import('../src/store.js?pristine-teaching-peer');
  t.after(() => peer.closeChannel());
  for (const name of ['teachings', 'items']) peer.state[name] = structuredClone(store.state[name]);
  const converged = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TEST peer failed to converge')), 3000);
    const unsubscribe = peer.subscribe(() => {
      if (!peer.getTeaching(f.ta.id) && peer.getTeaching(f.tb.id) && !peer.items(f.ta.id).length) {
        clearTimeout(timer); unsubscribe(); resolve();
      }
    });
    t.after(() => { clearTimeout(timer); unsubscribe(); });
  });
  await store.adoptPristineTeachingIdentity(f.args); await converged;
  assert.deepEqual(peer.state.teachings, store.state.teachings);
  assert.deepEqual(peer.state.items, store.state.items);
  assert.deepEqual(await db.getAll('outbox'), []);
});

test('only matching transient class/student context is redirected after successful commit', async t => {
  const f = await fixture();
  const path = `#/teaching/${encodeURIComponent(f.ta.id)}/grades?view=test`;
  assert.equal(teachingReplacementHash(path, f.ta.id, f.tb.id), `#/teaching/${encodeURIComponent(f.tb.id)}/grades?view=test`);
  const studentPath = `#/student/test?cls=${encodeURIComponent(f.ta.id)}&back=picker`;
  assert.equal(new URLSearchParams(teachingReplacementHash(studentPath, f.ta.id, f.tb.id).split('?')[1]).get('cls'), f.tb.id);
  for (const other of ['#/home', '#/groups', '#/teaching/another', '#/teaching/%ZZ']) assert.equal(teachingReplacementHash(other, f.ta.id, f.tb.id), other);
  const prior = globalThis.location;
  const calls = [];
  globalThis.location = { hash: path, replace(value) { calls.push(value); this.hash = value; } };
  t.after(() => { if (prior === undefined) delete globalThis.location; else globalThis.location = prior; });
  await store.adoptPristineTeachingIdentity(f.args);
  assert.deepEqual(calls, [`#/teaching/${encodeURIComponent(f.tb.id)}/grades?view=test`]);
});
