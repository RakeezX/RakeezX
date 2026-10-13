import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncStatusSeverity, projectSyncStatusSeverity } from '../src/lib/sync-status-severity.js';
import { presentSyncWarning } from '../src/lib/sync-warning-policy.js';
import { syncOperationalPresentation, renderSyncOperationalSection } from '../src/lib/sync-operational-ui.js';

test('N97 exact live class operation stays busy; orphan and independent safety failures remain actionable', () => {
  const live = { state: 'syncing', classDeletionInFlight: true, reasonCategory: 'sync_in_progress',
    safeToContinueUnrelatedWork: false, failedCount: 0, rejectedCount: 0, blockedCount: 0, presentationSeverity: {} };
  assert.equal(projectSyncStatusSeverity(live).state, 'syncing');
  assert.equal(presentSyncWarning(live, null, 1).strip, false);
  for (const override of [{ classDeletionInFlight: false }, { failedCount: 1 }, { rejectedCount: 1 },
    { blockedCount: 1 }, { reasonCategory: 'workspace_ownership_blocked' },
    { presentationSeverity: { hardFailure: true } }, { presentationSeverity: { authRequired: true } }]) {
    const result = projectSyncStatusSeverity({ ...live, ...override });
    assert.notEqual(result.state, 'syncing');
    assert.equal(result.cloudSyncHealthy, false);
    assert.equal(presentSyncWarning(result, null, 1).strip, true);
  }
});

test('N97 resume invalidates freshness without clearing Auth, storage, owner or server failure evidence', () => {
  const tracker = createSyncStatusSeverity();
  const token = tracker.bind('owner/workspace');
  const summary = () => ({ state: 'synced', safeToContinueUnrelatedWork: true,
    presentationSeverity: tracker.snapshot(), historicalConflictCount: 27 });
  tracker.succeeded(token);
  assert.equal(projectSyncStatusSeverity(summary()).state, 'synced');
  tracker.verifying(token);
  assert.equal(projectSyncStatusSeverity(summary()).state, 'pending');
  assert.equal(projectSyncStatusSeverity(summary()).cloudSyncHealthy, false);
  assert.equal(syncOperationalPresentation(summary()).text, 'بانتظار التحقق من المزامنة');
  assert.match(String(renderSyncOperationalSection(summary())), /نتحقق من أحدث بيانات السحابة/);
  for (const error of [Object.assign(new Error('Auth revoked'), { code: 'AUTH_REQUIRED' }),
    new Error('Storage rejected'), new Error('Owner mismatch'), Object.assign(new Error('Rejected'), { status: 403 })]) {
    tracker.failed(token, [error]);
    tracker.verifying(token);
    assert.equal(tracker.snapshot().hardFailure, true);
    assert.equal(projectSyncStatusSeverity(summary()).actionableSyncIssue, true);
    tracker.succeeded(token);
  }
});
