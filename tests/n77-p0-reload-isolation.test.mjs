import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { makeEnrollment, makeItem, makeSection, makeSession, makeStudent, makeTeaching } from '../src/models.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
const ownerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const account = {
  id: 'account:synthetic-p0', type: 'account', authUserId: ownerA,
  databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ownershipState: 'claimed',
  syncEligible: true, broadcastChannelName: 'test:n77-p0-reload',
};
const snapshot = async () => Object.fromEntries(await Promise.all(db.STORES.map(async (name) => [name, await db.getAll(name)])));

async function fixture(workspace) {
  store.activateWorkspace(workspace);
  await db.clearAll();
  await store.init();
  const section = makeSection({ id: 'section:p0', yearId: store.activeYear().id, grade: 5, label: '1' });
  const other = makeSection({ id: 'section:outside', yearId: section.yearId, grade: 6, label: '1' });
  const teaching = makeTeaching({ id: 'teaching:p0', sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id });
  const sibling = { ...teaching, id: 'teaching:sibling' };
  const outside = { ...teaching, id: 'teaching:outside', sectionId: other.id };
  const student = makeStudent({ id: 'student:shared', name: 'Synthetic P0 Student' });
  const enrollment = makeEnrollment({ id: 'enrollment:p0', studentId: student.id, sectionId: section.id, yearId: section.yearId });
  const item = makeItem({ id: 'item:p0', teachingId: teaching.id, name: 'Synthetic P0', maxScore: 10 });
  const session = makeSession({ id: 'session:p0', teachingId: teaching.id, date: '2026-10-11', period: 1 });
  await store.save({ sections: [section, other], teachings: [teaching, sibling, outside], students: [student],
    enrollments: [enrollment, { ...enrollment, id: 'enrollment:outside', sectionId: other.id }],
    items: [item, { ...item, id: 'item:sibling', teachingId: sibling.id }], sessions: [session],
    scores: [{ id: 'score:p0', itemId: item.id, studentId: student.id, value: 8, deleted: false, updatedAt: 1 }],
    attendance: [{ id: 'attendance:p0', sessionId: session.id, teachingId: teaching.id, studentId: student.id, date: session.date, status: 'present', deleted: false, updatedAt: 1 }],
  }, { queue: false });
  await db.clearStore('outbox');
  for (const state of ['pending', 'rejected']) await db.put('outbox', {
    id: `v2:historical-${state}`, state, command: 'lifecycle:delete_class', recordId: section.id,
  });
  await db.put('closedTermReports', { id: 'report:mixed', deleted: false, immutableSnapshot: { teachingIds: [teaching.id, outside.id] } });
  return { section, teaching };
}

for (const [label, online, authOwner, ownershipState, response] of [
  ['pending server receipt', true, ownerA, 'claimed', 'pending'],
  ['no network', true, ownerA, 'claimed', 'offline'],
  ['offline device', false, ownerA, 'claimed', 'offline'],
  ['owner rejection', true, ownerB, 'claimed', 'rejected'],
  ['unresolved preconditions', true, null, 'unresolved', 'rejected'],
  ['stale local scope', true, ownerA, 'claimed', 'stale'],
  ['Demo type on account database', true, null, 'demo', 'rejected'],
]) {
  test(`P0 ${label}: zero requests/writes and all stores unchanged after remount`, async () => {
    const originalFetch = globalThis.fetch;
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const workspace = { ...account, ownershipState, ...(label.startsWith('Demo') ? { type: 'demo' } : {}) };
    let requests = 0;
    let writes = 0;
    let connection;
    let originalTransaction;
    try {
      cloud.setMockAuth(authOwner ? { id: authOwner, email: 'synthetic@example.test' } : null, authOwner ? { access_token: 'synthetic' } : null);
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } });
      // Provision the synthetic fixture while resolved, then simulate losing ownership.
      const { section, teaching } = await fixture(ownershipState === 'unresolved' ? account : workspace);
      if (ownershipState === 'unresolved') {
        store.deactivateWorkspace('synthetic-owner-unavailable');
        store.activateWorkspace(workspace);
        await store.init();
      }
      if (response === 'stale') store.state.teachings = store.state.teachings.filter((row) => row.id !== 'teaching:sibling');
      const before = await snapshot();
      const memory = structuredClone(store.state);
      // These transports must remain unreachable, including a receipt that never arrives.
      globalThis.fetch = () => {
        requests++;
        if (response === 'pending') return new Promise(() => {});
        if (response === 'offline') return Promise.reject(new Error('synthetic no network'));
        return Promise.resolve(new Response('{}', { status: response === 'stale' ? 409 : 403 }));
      };
      connection = await db.openDB();
      originalTransaction = connection.transaction;
      connection.transaction = function (...args) {
        if (args[1] === 'readwrite') writes++;
        return originalTransaction.apply(this, args);
      };
      for (const action of [() => store.deleteClass(section.id), () => store.deleteTeaching(teaching.id), () => store.deleteSection(section.id)]) {
        let timer;
        try {
          await assert.rejects(Promise.race([action(), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Delete waited for network')), 500);
          })]), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
        } finally { clearTimeout(timer); }
      }
      assert.equal(requests, 0);
      assert.equal(writes, 0);
      assert.deepEqual(store.state, memory);
      assert.deepEqual(await snapshot(), before);
      connection.transaction = originalTransaction;
      store.deactivateWorkspace('synthetic-reload');
      store.activateWorkspace(workspace);
      await store.init();
      assert.deepEqual(await snapshot(), before);
      for (const name of ['sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'sessions', 'attendance']) {
        assert.deepEqual(store.state[name], before[name], `${name} changed after reload`);
      }
      assert.equal(requests, 0);
    } finally {
      if (connection && originalTransaction) connection.transaction = originalTransaction;
      globalThis.fetch = originalFetch;
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
      else delete globalThis.navigator;
      cloud.setMockAuth(null, null);
      store.deactivateWorkspace('synthetic-p0-done');
    }
  });
}

test('unmounted workspace Delete preserves A; switching to B cannot mutate A', async () => {
  const b = { ...account, id: 'account:synthetic-b', authUserId: ownerB, databaseName: 'rakeezx-user-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
  try {
    const { section, teaching } = await fixture(account);
    const beforeA = await snapshot();
    store.deactivateWorkspace('unmounted');
    for (const action of [() => store.deleteClass(section.id), () => store.deleteTeaching(teaching.id), () => store.deleteSection(section.id)]) {
      await assert.rejects(action(), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
    }
    assert.deepEqual(await snapshot(), beforeA);
    db.closeDB();
    await fixture(b);
    const beforeB = await snapshot();
    await assert.rejects(store.deleteClass(section.id), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
    assert.deepEqual(await snapshot(), beforeB);
    store.deactivateWorkspace('switch-back');
    store.activateWorkspace(account);
    await store.init();
    assert.deepEqual(await snapshot(), beforeA);
  } finally { store.deactivateWorkspace('switch-test-done'); }
});

test('isolated Demo deletion still tombstones pristine Teaching/items and permits new immutable class identity', async () => {
  try {
    store.activateWorkspace(demoDescriptor());
    await db.clearAll();
    await store.init();
    const section = await store.createSection({ grade: 4, label: 'أ' });
    const teaching = await store.createTeaching({ sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id });
    const items = store.items(teaching.id);
    assert.equal(await store.deleteClass(section.id), true);
    assert.equal((await db.get('sections', section.id)).deleted, true);
    assert.equal((await db.get('teachings', teaching.id)).deleted, true);
    for (const item of items) assert.equal((await db.get('items', item.id)).deleted, true);
    const replacement = await store.createSection({ grade: 4, label: 'ا' });
    assert.notEqual(replacement.id, section.id);
    assert.deepEqual(await db.getAll('outbox'), []);
  } finally { store.deactivateWorkspace('demo-p0-done'); }
});
