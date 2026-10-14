// AI: two existing affected runtime owner checks, unchanged assertions.
// Source tests/sync-v2-runtime.test.mjs normalized SHA256 792c71538f6c54a018cd02501a5452dde2f61ee865d8953a065d3341c00425d3
import 'fake-indexeddb/auto';
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { LEGACY_UNCLAIMED_SYNC_WORKSPACE, runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import {
  DEFAULT_TIME_PROFILES, makeEnrollment, makeSection, makeSession, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear,
} from '../src/models.js';

global.document = {
  visibilityState: 'visible',
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
  addEventListener() {},
};
global.matchMedia = () => ({ matches: false });

const authoritative = (record, revision = 1) => ({
  ...record, canonicalId: record.id, serverRevision: revision,
});

async function resetStore() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
}

async function seedRoster() {
  const year = authoritative(makeYear({ id: 'v2e1:year', hijriStart: 1450 }));
  const term = authoritative(makeTerm({ id: 'v2e1:term', yearId: year.id, index: 1 }));
  const subject = authoritative(makeSubject({ id: 'v2e1:subject', name: 'رياضيات', slug: 'math' }));
  const x = authoritative(makeSection({ id: 'v2e1:x', yearId: year.id, grade: 4, label: 'أ' }));
  const y = authoritative(makeSection({ id: 'v2e1:y', yearId: year.id, grade: 4, label: 'ب' }));
  const teaching = authoritative(makeTeaching({
    id: 'v2e1:teaching', sectionId: x.id, subjectId: subject.id, termId: term.id,
  }));
  const a = authoritative(makeStudent({ id: 'v2e1:a', name: 'طالب أ' }));
  const b = authoritative(makeStudent({ id: 'v2e1:b', name: 'طالب ب' }));
  const c = authoritative(makeStudent({ id: 'v2e1:c', name: 'طالب ج' }));
  const enrollments = [
    authoritative(makeEnrollment({ id: 'v2e1:ax', studentId: a.id, sectionId: x.id, rollNo: 1 })),
    authoritative(makeEnrollment({ id: 'v2e1:bx', studentId: b.id, sectionId: x.id, rollNo: 2 })),
    authoritative(makeEnrollment({ id: 'v2e1:cy', studentId: c.id, sectionId: y.id, rollNo: 1 })),
  ];
  const session = authoritative(makeSession({
    id: 'v2e1:session', teachingId: teaching.id, date: '2026-09-06', period: 1, status: 'scheduled',
  }));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teaching], students: [a, b, c], enrollments, sessions: [session] }, { queue: false });
  return { year, term, subject, x, y, teaching, a, b, c, session };
}

beforeEach(async () => {
  runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE);
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
  await resetStore();
});

// Synthetic storage completes the existing runtime fixture; no Product guard changes.
const storageRows=new Map();
globalThis.localStorage={get length(){return storageRows.size;},key(i){return [...storageRows.keys()][i]??null;},getItem(k){return storageRows.get(String(k))??null;},setItem(k,v){storageRows.set(String(k),String(v));},removeItem(k){storageRows.delete(String(k));},clear(){storageRows.clear();}};
test('claimed runtime store stamps generic and specialized commands from persisted workspace ownership', async (t) => {
  const ownerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  runtimeSyncOwnershipGuard.setWorkspace({
    id: 'account:a', type: 'account', authUserId: ownerA, databaseName: 'rakeezx-user-a',
    ownershipState: 'claimed', syncEligible: true,
  });
  t.after(() => runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE));
  const fixture = await seedRoster();
  await db.clearStore('outbox');

  await store.setAttendance(fixture.session.id, fixture.a.id, 'present');
  await store.fillAttendance(fixture.session.id, 'absent');
  await store.patch('students', fixture.b.id, { note: 'اختبار ملكية' });
  const rows = (await db.getAll('outbox')).filter((row) => row.protocol === 'v2');
  assert.deepEqual(rows.map((row) => row.command).filter(Boolean).sort(), ['attendance:fill', 'attendance:record']);
  assert.equal(rows.some((row) => row.op !== 'command'), true);
  assert.equal(rows.every((row) => row.ownerId === ownerA), true);
});

class GenericV2Backend {
  constructor() { this.tables = new Map(); this.failNext = false; this.fetchCalls = 0; this.mutationCalls = 0; }
  table(entity) {
    if (!this.tables.has(entity)) this.tables.set(entity, new Map());
    return this.tables.get(entity);
  }
  async fetchRecords(entity) { this.fetchCalls++; return structuredClone([...this.table(entity).values()]); }
  async applySyncV2Mutation(envelope) {
    this.mutationCalls++;
    if (this.failNext) { this.failNext = false; throw new Error('temporary test outage'); }
    const table = this.table(envelope.entity);
    const prior = table.get(envelope.recordId);
    const revision = (prior?.revision ?? 0) + 1;
    const canonical = {
      ...(prior ?? {}), id: envelope.recordId, ...structuredClone(envelope.patch), revision,
      field_revisions: Object.fromEntries(Object.keys(envelope.patch).map((field) => [field, revision])),
      deleted_at: envelope.operation === 'delete' ? new Date(envelope.clientUpdatedAt).toISOString() : null,
      client_updated_at: envelope.clientUpdatedAt,
    };
    table.set(canonical.id, canonical);
    return {
      mutationId: envelope.mutationId, entity: envelope.entity, recordId: envelope.recordId,
      canonicalId: canonical.id, outcome: 'applied', appliedGroups: Object.keys(envelope.patch),
      conflictedGroups: [], resultRevision: revision, canonical: structuredClone(canonical),
    };
  }
}

test('runtime automatic/manual Sync share the owner guard and resume only as the workspace owner', async () => {
  const ownerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ownerB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  runtimeSyncOwnershipGuard.setWorkspace({
    id: 'account:a', type: 'account', authUserId: ownerA, databaseName: 'rakeezx-user-a',
    ownershipState: 'claimed', syncEligible: true,
  });
  cloud.setMockAuth(null, null);
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  const activeYear = store.activeYear();
  await store.save({ years: [{ ...activeYear, canonicalId: activeYear.id, serverRevision: 1 }] }, { queue: false });

  const section = await store.createSection({ grade: 6, label: 'حارس الملكية' });
  let queued = (await db.getAll('outbox')).find((row) => row.recordId === section.id);
  assert.equal(queued.ownerId, ownerA, 'offline enqueue uses persisted workspace ownership');

  const backend = new GenericV2Backend();
  cloud.setMockBackend(backend);
  cloud.setMockAuth({ id: ownerB }, { access_token: 'account-b' });
  sync.init();
  const manualBlocked = await sync.syncAll({ full: true });
  queued = await db.get('outbox', queued.id);
  assert.equal(manualBlocked, false);
  assert.equal(backend.fetchCalls, 0);
  assert.equal(backend.mutationCalls, 0);
  assert.equal(queued.state, 'blocked');
  assert.equal(queued.ownerId, ownerA);
  assert.equal(queued.attemptCount, 0);
  assert.equal(sync.state.status, 'blocked');
  await assert.rejects(
    sync.syncStructural(),
    (error) => error.code === 'SYNC_OWNERSHIP_BLOCKED' && error.retryable === false,
  );
  assert.equal(backend.fetchCalls, 0, 'legacy category entry points use the same owner predicate');

  await store.patch('sections', section.id, { label: 'حارس الملكية تلقائي' });
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  assert.equal(backend.fetchCalls, 0, 'automatic Sync is blocked by the same predicate');
  assert.equal(backend.mutationCalls, 0);

  cloud.setMockAuth({ id: ownerA }, { access_token: 'account-a' });
  assert.equal(await sync.syncAll({ full: true }), true);
  assert.ok(backend.fetchCalls > 0);
  assert.ok(backend.mutationCalls > 0);
  assert.equal((await db.getAll('outbox')).filter((row) => row.protocol === 'v2').length, 0);
  runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE);
});

after(async()=>{
  await sync.suspendForWorkspaceDeactivation();
  runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE);
  cloud.setMockBackend(null);cloud.setMockAuth(null,null);store.closeChannel();db.closeDB();localStorage.clear();
});
