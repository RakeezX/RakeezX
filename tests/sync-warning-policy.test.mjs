import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAILED_RECOVERY_STABLE_MS, OFFLINE_LIVENESS_MS,
  startRecoveryCycle, wakeRecoveryCycle, presentSyncWarning,
} from '../src/lib/sync-warning-policy.js';

const summary = (state, extra = {}) => ({
  state, failedCount: 0, blockedCount: 0, rejectedCount: 0,
  safeToContinueUnrelatedWork: true, automaticSyncActive: false,
  automaticRetryActive: false, ...extra,
});

test('durable Sync and safety guards surface immediately during recovery', () => {
  const cycle = startRecoveryCycle(100);
  for (const guarded of [
    summary('syncing', { rejectedCount: 1 }),
    summary('offline', { blockedCount: 1 }),
    summary('syncing', { failedCount: 1 }),
    summary('auth_required'),
    summary('blocked'),
    summary('rejected'),
    summary('blocked', { reasonCategory: 'workspace_ownership_blocked' }),
    summary('synced', { reasonCategory: 'workspace_ownership_blocked' }),
    summary('error', { safeToContinueUnrelatedWork: false }),
    summary('synced', { safeToContinueUnrelatedWork: false }),
  ]) {
    assert.equal(presentSyncWarning(guarded, cycle, 101).strip, true);
  }
  assert.equal(presentSyncWarning(summary('syncing', { failedCount: 1 }), cycle, 101).status, 'error');
  assert.equal(presentSyncWarning(summary('offline', { rejectedCount: 1 }), cycle, 101).status, 'rejected');
  assert.equal(presentSyncWarning(summary('synced', { reasonCategory: 'workspace_ownership_blocked' }), cycle, 101).status, 'blocked');
  assert.equal(presentSyncWarning(summary('synced', { safeToContinueUnrelatedWork: false }), cycle, 101).status, 'error');
});

test('transient coordinator states stay in the Mini Hub through the first attempt', () => {
  let cycle = startRecoveryCycle(100);
  for (const [state, time, extra] of [
    ['offline', 100, {}], ['pending', 300, {}],
    ['syncing', 500, { automaticSyncActive: true }],
    ['error', 700, { automaticRetryActive: true }],
    ['syncing', 900, { automaticSyncActive: true }],
    ['synced', 1000, {}],
  ]) {
    const result = presentSyncWarning(summary(state, extra), cycle, time);
    assert.equal(result.strip, false, state);
    cycle = result.cycle;
  }
  assert.equal(presentSyncWarning(summary('synced'), cycle, 100 + FAILED_RECOVERY_STABLE_MS).cycle.phase, 'settled');
});

test('pageshow, visible, and online coalesce; later reconnect starts a fresh cycle', () => {
  const first = startRecoveryCycle(0);
  assert.equal(wakeRecoveryCycle(first, 10), first);
  assert.equal(wakeRecoveryCycle(first, 20), first);
  assert.equal(wakeRecoveryCycle(first, 30), first);
  const settled = presentSyncWarning(summary('synced'), first, FAILED_RECOVERY_STABLE_MS).cycle;
  assert.equal(wakeRecoveryCycle(settled, FAILED_RECOVERY_STABLE_MS + 50), settled);
  const later = wakeRecoveryCycle(settled, 3_000);
  assert.equal(later.startedAt, 3_000);
  assert.equal(presentSyncWarning(summary('error'), later, 3_001).strip, false);
});

test('synthetic failed wake escalates only after stable failure; success clears it', () => {
  let cycle = startRecoveryCycle(0);
  cycle = presentSyncWarning(summary('syncing', { automaticSyncActive: true }), cycle, 200).cycle;
  let result = presentSyncWarning(summary('error'), cycle, 300);
  assert.equal(result.strip, false);
  assert.equal(result.nextCheckAt, 300 + FAILED_RECOVERY_STABLE_MS);
  result = presentSyncWarning(summary('syncing', { automaticSyncActive: true }), result.cycle, 800);
  assert.equal(result.cycle.failureSince, null);
  result = presentSyncWarning(summary('error'), result.cycle, 900);
  assert.equal(presentSyncWarning(summary('error'), result.cycle, 900 + FAILED_RECOVERY_STABLE_MS - 1).strip, false);
  result = presentSyncWarning(summary('error'), result.cycle, 900 + FAILED_RECOVERY_STABLE_MS);
  assert.equal(result.strip, true);
  assert.equal(presentSyncWarning(summary('synced'), result.cycle, 2_200).strip, false);
});

test('synthetic offline wake has a bounded liveness deadline', () => {
  let cycle = startRecoveryCycle(100);
  let result = presentSyncWarning(summary('offline'), cycle, 101);
  assert.equal(result.nextCheckAt, 100 + OFFLINE_LIVENESS_MS);
  cycle = wakeRecoveryCycle(result.cycle, 500); // online/visible burst cannot move the deadline
  assert.equal(cycle.startedAt, 100);
  assert.equal(presentSyncWarning(summary('offline'), cycle, 100 + OFFLINE_LIVENESS_MS - 1).strip, false);
  const failed = presentSyncWarning(summary('offline'), cycle, 100 + OFFLINE_LIVENESS_MS);
  assert.equal(failed.strip, true);
  assert.equal(wakeRecoveryCycle(failed.cycle, 10_000, { online: false }), failed.cycle);
  assert.equal(wakeRecoveryCycle(failed.cycle, 10_000, { online: true }).phase, 'recovering');
});

test('retrying transport error cannot hide indefinitely', () => {
  const cycle = startRecoveryCycle(100);
  const retrying = summary('error', { automaticRetryActive: true });
  const first = presentSyncWarning(retrying, cycle, 101);
  assert.equal(first.strip, false);
  assert.equal(first.nextCheckAt, 100 + OFFLINE_LIVENESS_MS);
  const failed = presentSyncWarning(retrying, first.cycle, 100 + OFFLINE_LIVENESS_MS);
  assert.equal(failed.strip, true);
  assert.equal(failed.status, 'error');
});
