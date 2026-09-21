import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoDataset, clearDemoRequest, isDemoRequested, requestDemo } from '../src/lib/demo-workspace.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { demoDescriptor } from '../src/lib/workspaces.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('demo marker is explicit and reversible', () => {
  const storage = memoryStorage();
  assert.equal(isDemoRequested(storage), false);
  requestDemo(storage);
  assert.equal(isDemoRequested(storage), true);
  clearDemoRequest(storage);
  assert.equal(isDemoRequested(storage), false);
});

test('deterministic demo dataset is substantial, isolated, and excludes deferred domains', () => {
  const first = createDemoDataset();
  const second = createDemoDataset();
  assert.deepEqual(first, second);
  assert.equal(first.sections.length, 5);
  assert.equal(first.students.length, 60);
  assert.equal(first.enrollments.length, 60);
  assert.equal(first.teachings.length, 5);
  assert.ok(first.attendance.length >= 100);
  assert.ok(first.scores.length >= 200);
  assert.ok(first.logs.length >= 25);
  assert.ok(first.notes.length >= 50);
  assert.equal(first.units.length, 0);
  assert.equal(first.lessons.length, 0);
  assert.equal(first.assignments.length, 0);
  assert.equal(first.submissions.length, 0);
  assert.equal(first.outbox.length, 0);
  for (const rows of Object.values(first).filter(Array.isArray)) {
    for (const row of rows) {
      assert.ok(row.id === 'profile' || row.id === 'device' || String(row.id).includes('demo:'), `unexpected demo id: ${row.id}`);
    }
  }
});

test('demo descriptor is denied cloud enqueue and pull by Owner Guard', () => {
  const workspace = demoDescriptor();
  assert.equal(workspace.databaseName, 'rakeezx-demo');
  assert.equal(workspace.syncEligible, false);
  const guard = createSyncOwnershipGuard({ workspace });
  assert.equal(guard.enqueueAccess().allowed, false);
  assert.equal(guard.enqueueAccess().reason, 'demo-sync-disabled');
  assert.equal(guard.cloudAccess().allowed, false);
  assert.equal(guard.cloudAccess().reason, 'demo-sync-disabled');
});
