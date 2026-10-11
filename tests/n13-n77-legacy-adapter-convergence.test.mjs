import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { testOnlyLegacySyncCollection } from '../src/lib/sync.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stamp = '2026-10-08T00:00:00.000Z';
const section = (id, deleted = false) => ({ id, owner_id: A, year_id: 'year:one',
  grade: 4, label: 'Overlap', name: '4 / Overlap', color: '#123456', order: 1,
  client_updated_at: 1, revision: 5, deleted_at: deleted ? stamp : null });
const canonical = section('section:canonical');
const oldA = section('section:old-a', true);
const oldB = section('section:old-b', true);
const selectedId = 'teaching:selected';
const siblingId = 'teaching:sibling';
const navigatorState = { onLine: true };
Object.defineProperty(globalThis, 'navigator', { value: navigatorState, configurable: true });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: A }), { status: 200 });
  throw new Error(`Unexpected network call: ${url}`);
};
after(() => { cloud.setMockBackend(null); store.deactivateWorkspace(); db.closeDB(); });

test('legacy conflict retry and authoritative post-delete pull converge without resurrection', async () => {
  store.activateWorkspace({ type: 'account', ownershipState: 'claimed', syncEligible: true,
    authUserId: A, databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    broadcastChannelName: 'n13-n77-legacy-adapter' });
  cloud.setMockAuth({ id: A }, { access_token: 'synthetic-token', user: { id: A } });
  await store.init();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  const localSection = { id: 'section:stale', yearId: 'year:one', grade: 4,
    label: 'Overlap', name: '4 / Overlap', updatedAt: 1, deleted: false };
  const teaching = (id, subjectId) => ({ id, sectionId: localSection.id, subjectId,
    termId: 'term:one', updatedAt: 1, deleted: false });
  await store.save({ sections: [localSection],
    teachings: [teaching(selectedId, 'subject:first'), teaching(siblingId, 'subject:second')],
    students: [{ id: 'student:shared', name: 'Shared', updatedAt: 1, deleted: false }],
    enrollments: [{ id: 'enrollment:shared', sectionId: localSection.id,
      studentId: 'student:shared', status: 'active', updatedAt: 1, deleted: false }],
    items: [{ id: 'item:selected', teachingId: selectedId, updatedAt: 1, deleted: false },
      { id: 'item:sibling', teachingId: siblingId, updatedAt: 1, deleted: false }] }, { queue: false });
  await db.clearStore('outbox');

  const remote = new Map([['sections', [canonical, oldA, oldB]],
    ['teachings', [{ id: selectedId, owner_id: A, section_id: canonical.id,
      subject_id: 'subject:first', term_id: 'term:one', client_updated_at: 1,
      revision: 5, deleted_at: null },
    { id: siblingId, owner_id: A, section_id: canonical.id, subject_id: 'subject:second',
      term_id: 'term:one', client_updated_at: 1, revision: 5, deleted_at: null }]],
    ['items', [{ id: 'item:selected', owner_id: A, teaching_id: selectedId,
      client_updated_at: 1, revision: 5, deleted_at: null },
    { id: 'item:sibling', owner_id: A, teaching_id: siblingId,
      client_updated_at: 1, revision: 5, deleted_at: null }]]]);
  let initialFetch = true;
  let conflictWrites = 0;
  let candidateReads = 0;
  let serverReads = 0;
  const assertServerOwner = () => {
    assert.equal(cloud.user?.id, A);
    assert.equal(store.getActiveWorkspace()?.authUserId, A);
  };
  const adapter = {
    async fetchRecords(table) {
      assertServerOwner();
      serverReads++;
      if (table === 'sections' && initialFetch) { initialFetch = false; return []; }
      return structuredClone(remote.get(table) ?? []);
    },
    async fetchSectionCandidates({ yearId, grade }) {
      assertServerOwner();
      candidateReads++;
      assert.equal(yearId, 'year:one'); assert.equal(grade, 4);
      return structuredClone(remote.get('sections'));
    },
    async upsertRecords(table, rows) {
      assertServerOwner();
      assert.equal(table, 'sections');
      assert.deepEqual(rows.map((row) => row.id), [localSection.id]);
      conflictWrites++;
      throw Object.assign(new Error('unique active natural key'), { code: '23505' });
    },
    async n77DeleteTeaching(input) {
      assertServerOwner();
      assert.equal(input.teachingId, selectedId);
      const plan = { ownerId: A, sectionId: canonical.id, selectedTeachingId: selectedId,
        scope: 'teaching', teachingIds: [selectedId], fingerprint: 'server-scope' };
      if (!input.commit) return plan;
      for (const [table, ids] of [['teachings', [selectedId]], ['items', ['item:selected']]]) {
        remote.set(table, remote.get(table).map((row) => ids.includes(row.id)
          ? { ...row, revision: 6, deleted_at: stamp } : row));
      }
      return { ...plan, mutationId: input.mutationId, cascadeTeachingIds: [selectedId],
        orphanStudentIds: [], outcome: 'deleted' };
    },
  };
  cloud.setMockBackend(adapter);
  const legacy = await testOnlyLegacySyncCollection('sections', 'sections',
    { requiredIds: new Set(), knownRemoteIds: { years: new Set(['year:one']) } });
  assert.equal(legacy.pushed, 0);
  assert.equal(conflictWrites, 1);
  assert.equal(candidateReads, 1);
  assert.equal(await db.get('sections', localSection.id), undefined);
  assert.equal((await db.get('teachings', selectedId)).sectionId, canonical.id);
  assert.equal((await db.get('enrollments', 'enrollment:shared')).sectionId, canonical.id);
  await db.clearStore('outbox');

  await store.deleteTeaching(selectedId, await store.previewDeleteTeaching(selectedId));
  assert.equal((await db.get('teachings', selectedId)).deleted, true);
  // A stale offline device still has an active copy before it receives the server pull.
  const stale = { ...(await db.get('teachings', selectedId)), deleted: false, updatedAt: 1 };
  await db.applyBatch({ teachings: {} }, { prepare: () => ({ teachings: { put: [stale] } }) });
  store.state.ready = false;
  await store.init();
  navigatorState.onLine = false;
  assert.equal((await db.get('teachings', selectedId)).deleted, false);
  navigatorState.onLine = true;
  const engine = createSyncV2Engine({ database: db, transport: adapter,
    ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => A });
  const pulled = await engine.pullAll({ stores: ['sections', 'teachings', 'items'] });
  assert.equal(pulled.failures.length, 0);
  await store.refreshSyncedState();
  assert.equal((await db.get('teachings', selectedId)).deleted, true);
  assert.equal((await db.get('items', 'item:selected')).deleted, true);
  assert.equal((await db.get('teachings', siblingId)).deleted, false);
  assert.equal((await db.get('items', 'item:sibling')).deleted, false);
  assert.equal((await db.get('enrollments', 'enrollment:shared')).deleted, false);
  assert.equal((await db.get('students', 'student:shared')).deleted, false);
  assert.equal((await db.get('sections', canonical.id)).deleted, false);
  for (const id of [oldA.id, oldB.id]) assert.equal((await db.get('sections', id)).deleted, true);
  assert.equal(store.getTeaching(selectedId), null);
  assert.ok(store.getTeaching(siblingId));
  assert.ok(store.sectionRoster(canonical.id).some((row) => row.id === 'student:shared'));
  assert.equal(remote.get('teachings').find((row) => row.id === selectedId).deleted_at, stamp);
  assert.equal((await engine.dispatchPending()).attempted, 0);
  const readsBeforeB = serverReads;
  const ownerB = createSyncV2Engine({ database: db, transport: adapter,
    ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => B });
  const blocked = await ownerB.pullAll({ stores: ['sections', 'teachings'] });
  assert.equal(blocked.ownershipBlocked, true);
  assert.equal(serverReads, readsBeforeB);
});
