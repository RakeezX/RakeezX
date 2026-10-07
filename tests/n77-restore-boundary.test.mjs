import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => null };
global.matchMedia = () => ({ matches: false });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { buildBackup, restoreBackup } from '../src/lib/export.js';
import { planCloudRestore, reconcileCanonicalRestore } from '../src/lib/backup-v2.js';
import { deletionScope, visibleClosedTermReport } from '../src/lib/restore-deletion-scope.js';
import { SYNC_V2_STORES, SYNC_V2_SCHEMAS } from '../src/lib/sync-v2.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const empty = () => Object.fromEntries(SYNC_V2_STORES.map((name) => [name, []]));
const canonical = (overrides = {}) => Object.fromEntries(SYNC_V2_STORES.map((name) =>
  [SYNC_V2_SCHEMAS[name].entity, overrides[name] ?? []]));

test('a deleted Teaching excludes its descendants while shared Section and unrelated recovery survive', () => {
  const backup = { version: 5, sourceOwnerId: A, data: {
    teachings: [{ id: 'teaching:deleted', sectionId: 'section:shared', deleted: false }],
    items: [{ id: 'item:deleted', teachingId: 'teaching:deleted', deleted: false }],
    scores: [{ id: 'score:deleted', itemId: 'item:deleted', studentId: 'student:shared', deleted: false }],
    students: [{ id: 'student:unrelated', name: 'recovered', deleted: false }],
  } };
  const server = empty();
  server.sections = [{ id: 'section:shared', deleted: false, serverRevision: 2 }];
  server.teachings = [{ id: 'teaching:deleted', sectionId: 'section:shared', deleted: true, serverRevision: 3 },
    { id: 'teaching:other', sectionId: 'section:shared', deleted: false, serverRevision: 2 }];
  server.items = [{ id: 'item:deleted', teachingId: 'teaching:deleted', deleted: true, serverRevision: 3 }];
  server.scores = [{ id: 'score:deleted', itemId: 'item:deleted', studentId: 'student:shared', deleted: true, serverRevision: 3 }];
  const plan = planCloudRestore(backup, server, { ownerId: A });
  assert.equal(plan.ready, true);
  for (const id of ['teaching:deleted', 'item:deleted', 'score:deleted']) {
    assert.equal(plan.entries.find((entry) => entry.id === id)?.reason, 'n77-deleted-scope');
  }
  assert.equal(plan.operations.some((operation) => operation.recordId === 'student:unrelated'), true);
  assert.equal(plan.operations.some((operation) => operation.recordId === 'teaching:deleted'), false);
  assert.equal(plan.entries.find((entry) => entry.id === 'section:shared')?.classification, 'KEEP_SERVER');
  assert.equal(plan.entries.find((entry) => entry.id === 'teaching:other')?.reason, 'server-only');
  assert.equal(planCloudRestore(backup, server, { ownerId: B }).ready, false);
});

test('whole Section deletion suppresses enrollments and Teachings without deleting shared students', () => {
  const backup = { version: 5, sourceOwnerId: A, data: {
    sections: [{ id: 'section:gone', deleted: false }],
    teachings: [{ id: 'teaching:gone', sectionId: 'section:gone', deleted: false }],
    enrollments: [{ id: 'enrollment:gone', sectionId: 'section:gone', studentId: 'student:shared', deleted: false }],
  } };
  const server = empty();
  server.sections = [{ id: 'section:gone', deleted: true, serverRevision: 4 }];
  server.teachings = [{ id: 'teaching:gone', sectionId: 'section:gone', deleted: true, serverRevision: 4 }];
  server.enrollments = [{ id: 'enrollment:gone', sectionId: 'section:gone', studentId: 'student:shared', deleted: true, serverRevision: 4 }];
  server.students = [{ id: 'student:shared', deleted: false, serverRevision: 3 }];
  const plan = planCloudRestore(backup, server, { ownerId: A });
  assert.equal(plan.ready, true);
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(plan.entries.filter((entry) => entry.reason === 'n77-deleted-scope').map((entry) => entry.id).sort(),
    ['enrollment:gone', 'section:gone', 'teaching:gone']);
  assert.equal(plan.entries.find((entry) => entry.id === 'student:shared')?.reason, 'server-only');
});

test('missing ancestry or an unproven empty owner blocks restore; stale live server descendant blocks too', () => {
  const backup = { version: 5, sourceOwnerId: A, data: {
    sections: [{ id: 'section:missing', deleted: false, serverRevision: 3 }],
    teachings: [{ id: 'teaching:missing', sectionId: 'section:missing', deleted: false }],
  } };
  assert.equal(planCloudRestore(backup, empty(), { ownerId: A }).entries[0].reason,
    'missing-empty-owner-authority');
  const occupied = empty();
  occupied.profile = [{ id: 'profile', deleted: false, serverRevision: 1 }];
  assert.equal(planCloudRestore(backup, occupied, { ownerId: A }).ready, false);
  const server = empty();
  server.sections = [{ id: 'section:missing', deleted: true, serverRevision: 4 }];
  server.teachings = [{ id: 'teaching:missing', sectionId: 'section:missing', deleted: false, serverRevision: 4 }];
  assert.equal(planCloudRestore(backup, server, { ownerId: A }).entries
    .find((entry) => entry.id === 'teaching:missing').reason, 'server-live-deleted-descendant');
});

test('mixed immutable report is projected without rewriting its bytes or shared Teaching', () => {
  const data = { sections: [{ id: 'section:shared' }], teachings: [
    { id: 'teaching:gone', sectionId: 'section:shared', deleted: true },
    { id: 'teaching:kept', sectionId: 'section:shared', deleted: false },
  ] };
  const report = { id: 'report:immutable', payload: {
    teachingDocuments: [
      { teaching: { id: 'teaching:gone' }, section: { id: 'section:shared' }, membership: [] },
      { teaching: { id: 'teaching:kept' }, section: { id: 'section:shared' }, membership: [{ id: 'enrollment:kept', status: 'active' }] },
    ],
    executionDocument: { teachings: data.teachings, rows: [
      { teaching: { id: 'teaching:gone' }, section: { id: 'section:shared' }, completeness: { state: 'completed' } },
      { teaching: { id: 'teaching:kept' }, section: { id: 'section:shared' }, completeness: { state: 'pending' } },
    ], counts: { generated: 2, completed: 1, pending: 1 }, sections: 1, students: 2, percentage: 50 },
  } };
  const before = structuredClone(report);
  const visible = visibleClosedTermReport(report, deletionScope(data, data));
  assert.deepEqual(report, before);
  assert.deepEqual(visible.payload.teachingDocuments.map((doc) => doc.teaching.id), ['teaching:kept']);
  assert.deepEqual(visible.payload.executionDocument.counts,
    { generated: 1, completed: 0, pending: 1, future: 0, excluded: 0 });
  assert.equal(visible.payload.executionDocument.students, 1);
});

test('Product report and backup export suppress deleted snapshot scope while IndexedDB retains immutable bytes', async () => {
  db.closeDB();
  await activateSyntheticAccountWorkspace({ ownerId: A });
  await db.clearAll();
  await db.put('sections', { id: 'section:shared', yearId: 'year:x', deleted: false });
  await db.put('teachings', { id: 'teaching:gone', sectionId: 'section:shared', deleted: true });
  await db.put('teachings', { id: 'teaching:kept', sectionId: 'section:shared', deleted: false });
  const original = { id: 'report:mixed', termId: 'term:x', deleted: false, payload: {
    teachingDocuments: [
      { teaching: { id: 'teaching:gone' }, section: { id: 'section:shared' } },
      { teaching: { id: 'teaching:kept' }, section: { id: 'section:shared' } },
    ],
  } };
  await db.put('closedTermReports', original);
  try {
    await store.init();
    assert.deepEqual(store.latestClosedTermReport('term:x').payload.teachingDocuments
      .map((doc) => doc.teaching.id), ['teaching:kept']);
    const backup = await buildBackup({ sourceOwnerId: A });
    assert.deepEqual(backup.data.closedTermReports[0].payload.teachingDocuments
      .map((doc) => doc.teaching.id), ['teaching:kept']);
    assert.deepEqual((await db.get('closedTermReports', original.id)).payload.teachingDocuments,
      original.payload.teachingDocuments);
  } finally {
    store.closeChannel();
    db.closeDB();
  }
});

test('canonical convergence drops deleted local-only descendants and keeps unrelated backup rows', async () => {
  db.closeDB();
  await activateSyntheticAccountWorkspace({ ownerId: A });
  await db.clearAll();
  const rows = canonical({
    sections: [{ id: 'section:gone', deleted_at: '2026-10-07T00:00:00Z', revision: 3 },
      { id: 'section:kept', deleted_at: null, revision: 1 }],
    teachings: [{ id: 'teaching:gone', section_id: 'section:gone', deleted_at: '2026-10-07T00:00:00Z', revision: 3 },
      { id: 'teaching:kept', section_id: 'section:kept', deleted_at: null, revision: 1 }],
  });
  const payload = { version: 4, data: {
    assignments: [{ id: 'assignment:gone', teachingId: 'teaching:gone' },
      { id: 'assignment:kept', teachingId: 'teaching:kept' }],
    submissions: [{ id: 'submission:gone', assignmentId: 'assignment:gone' },
      { id: 'submission:kept', assignmentId: 'assignment:kept' }],
  } };
  try {
    await reconcileCanonicalRestore(payload, rows, { expectedOwnerId: A, verifyOwner: async () => A });
    assert.deepEqual((await db.getAll('assignments')).map((row) => row.id), ['assignment:kept']);
    assert.deepEqual((await db.getAll('submissions')).map((row) => row.id), ['submission:kept']);
  } finally {
    store.closeChannel();
    db.closeDB();
  }
});

test('legacy local restore and offline canonical reconciliation write no Product rows', async () => {
  db.closeDB();
  await activateSyntheticAccountWorkspace({ ownerId: A });
  await db.clearAll();
  const payload = { version: 5, data: { students: [{ id: 'student:stale', name: 'old' }] } };
  await assert.rejects(restoreBackup(payload, 'replace'), (error) => error.code === 'LOCAL_RESTORE_DISABLED');
  assert.equal(await db.get('students', 'student:stale'), undefined);
  globalThis.navigator.onLine = false;
  try {
    await assert.rejects(reconcileCanonicalRestore(payload, canonical(), { expectedOwnerId: A }),
      (error) => error.code === 'RESTORE_OWNER_NOT_VALIDATED');
    assert.equal(await db.get('students', 'student:stale'), undefined);
  } finally {
    globalThis.navigator.onLine = true;
    store.closeChannel();
    db.closeDB();
  }
});
