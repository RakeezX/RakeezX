import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSyncStatusSeverity, isStudentLifecycleInFlight } from '../src/lib/sync-status-severity.js';
import { presentSyncWarning, startRecoveryCycle } from '../src/lib/sync-warning-policy.js';

const live = { state: 'syncing', studentLifecycleInFlight: true, reasonCategory: 'sync_in_progress',
  safeToContinueUnrelatedWork: false, failedCount: 0, rejectedCount: 0, blockedCount: 0,
  cloudSyncHealthy: false, presentationSeverity: {} };

test('N96 shared presentation predicate rejects independent hard errors and unknown unsafe states', () => {
  assert.equal(isStudentLifecycleInFlight(live), true);
  const cycle = startRecoveryCycle(10);
  assert.equal(presentSyncWarning(live, cycle, 10).strip, false);
  for (const override of [
    { failedCount: 1 }, { rejectedCount: 1 }, { blockedCount: 1 },
    { state: 'auth_required' }, { reasonCategory: 'workspace_ownership_blocked' },
    { presentationSeverity: { hardFailure: true } }, { presentationSeverity: { authRequired: true } },
    { studentLifecycleInFlight: false }, { state: 'unknown' }, { reasonCategory: 'unknown' },
  ]) {
    const summary = { ...live, ...override };
    assert.equal(isStudentLifecycleInFlight(summary), false, JSON.stringify(override));
    const projected = projectSyncStatusSeverity(summary, 10);
    assert.notEqual(projected.state, 'syncing', JSON.stringify(override));
    assert.equal(projected.cloudSyncHealthy, false);
    assert.equal(presentSyncWarning(projected, cycle, 10).strip, true, JSON.stringify(override));
  }
});
