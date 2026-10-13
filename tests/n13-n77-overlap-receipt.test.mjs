import { n77Account } from './n77-fixture.mjs';
import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import { planCloudRestore } from '../src/lib/backup-v2.js';
import { SYNC_V2_STORES } from '../src/lib/sync-v2.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const section = (id, deleted = false) => ({ id, yearId: 'year:one', grade: 4, label: 'Overlap',
  name: '4 / Overlap', updatedAt: 1, deleted });
const teaching = (id, sectionId, subjectId) => ({ id, sectionId, subjectId,
  termId: 'term:one', updatedAt: 1, deleted: false });
const active = section('section:active');
const oldA = section('section:old-a', true);
const oldB = section('section:old-b', true);
const selected = teaching('teaching:selected', active.id, 'subject:first');
const sibling = teaching('teaching:sibling', active.id, 'subject:second');
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

test('overlapping tombstones survive selected-Teaching receipt, reload and offline stale restore planning', async () => {
  await n77Account(A);
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await store.save({ sections: [active, oldA, oldB], teachings: [selected, sibling],
    students: [{ id: 'student:shared', name: 'Shared', updatedAt: 1, deleted: false }],
    enrollments: [{ id: 'enrollment:shared', sectionId: active.id, studentId: 'student:shared',
      status: 'active', updatedAt: 1, deleted: false }],
    items: [{ id: 'item:selected', teachingId: selected.id, updatedAt: 1, deleted: false },
      { id: 'item:sibling', teachingId: sibling.id, updatedAt: 1, deleted: false }] }, { queue: false });
  await db.clearStore('outbox');
  const plan = { ownerId: A, sectionId: active.id, selectedTeachingId: selected.id,
    scope: 'teaching', teachingIds: [selected.id], fingerprint: 'exact-synthetic-scope' };
  cloud.setMockBackend({ async n77DeleteTeaching(input) {
    if (input.commit) throw new Error('synthetic receipt unavailable');
    return plan;
  } });
  const preview = await store.previewDeleteTeaching(selected.id);
  await assert.rejects(store.deleteTeaching(selected.id, preview));
  assert.equal((await db.get('teachings', selected.id)).deleted, false);
  assert.equal((await db.get('items', 'item:selected')).deleted, false);
  cloud.setMockBackend({ async n77DeleteTeaching(input) {
    return input.commit ? { ...plan, mutationId: input.mutationId,
      cascadeTeachingIds: [selected.id], orphanStudentIds: [], outcome: 'deleted' } : plan;
  } });
  await store.deleteTeaching(selected.id, await store.previewDeleteTeaching(selected.id));
  assert.equal((await db.get('teachings', selected.id)).deleted, true);
  assert.equal((await db.get('items', 'item:selected')).deleted, true);
  for (const id of [active.id, sibling.id, 'student:shared', 'enrollment:shared', 'item:sibling']) {
    const entity = id.startsWith('section:') ? 'sections' : id.startsWith('teaching:') ? 'teachings'
      : id.startsWith('student:') ? 'students' : id.startsWith('enrollment:') ? 'enrollments' : 'items';
    assert.equal((await db.get(entity, id)).deleted, false, id);
  }
  for (const id of [oldA.id, oldB.id]) assert.equal((await db.get('sections', id)).deleted, true);
  const workspace = store.getActiveWorkspace();
  store.deactivateWorkspace();
  store.activateWorkspace(workspace);
  store.state.ready = false;
  await store.init();
  assert.equal(store.getSection(oldA.id), null);
  assert.equal(store.getSection(oldB.id), null);
  assert.equal(store.getTeaching(selected.id), null);
  assert.ok(store.getTeaching(sibling.id));
  navigatorState.onLine = false;
  assert.equal(await sync.syncAll({ full: true }), false);
  assert.equal((await db.get('teachings', selected.id)).deleted, true);
  const canonical = Object.fromEntries(SYNC_V2_STORES.map((name) => [name, []]));
  canonical.sections = [active, oldA, oldB].map((row) => ({ id: row.id,
    deleted: row.deleted, serverRevision: 2 }));
  canonical.teachings = [{ id: selected.id, sectionId: active.id, deleted: true, serverRevision: 3 },
    { id: sibling.id, sectionId: active.id, deleted: false, serverRevision: 2 }];
  const stale = { version: 5, sourceOwnerId: A, data: { sections: [active],
    teachings: [selected], items: [{ id: 'item:selected', teachingId: selected.id }] } };
  const restore = planCloudRestore(stale, canonical, { ownerId: A });
  assert.equal(restore.operations.some((row) => row.recordId === selected.id || row.recordId === 'item:selected'), false);
  assert.equal(restore.entries.find((row) => row.id === selected.id)?.reason, 'n77-deleted-scope');
  assert.equal(planCloudRestore(stale, canonical, { ownerId: B }).ready, false);
  navigatorState.onLine = true;
});
