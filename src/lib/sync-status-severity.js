/** Presentation metadata only; no timers, persistence, records or Sync decisions. */
export const TRANSIENT_SEVERITY_MS = 90_000;

export function isTransientTransportFailure(error) {
  // Exact browser fetch failures only. HTTP/Auth/ownership/storage errors and
  // arbitrary messages mentioning a network are deliberately not retry proof.
  return error?.name === 'TypeError' && !error.code && !error.status &&
    ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'].includes(error.message);
}

export function createSyncStatusSeverity({ now = () => Date.now() } = {}) {
  let context = null;
  let epoch = {};
  let failureSince = null;
  let failedAttempts = 0;
  let transient = false;
  let hardFailure = false;
  let authRequired = false;
  let awaitingVerification = false;
  function reset() {
    epoch = {};
    failureSince = null;
    failedAttempts = 0;
    transient = false;
    hardFailure = false;
    authRequired = false;
    awaitingVerification = !!context;
  }
  return {
    bind(next) {
      if (next !== context) { context = next; reset(); }
      return epoch;
    },
    clear() { context = null; reset(); },
    failed(token, errors) {
      if (token !== epoch || !context) return;
      if (!errors.length || !errors.every(isTransientTransportFailure)) {
        authRequired ||= errors.some((error) => error?.code === 'AUTH_REQUIRED');
        hardFailure = true;
        transient = false;
        return;
      }
      failureSince ??= now();
      failedAttempts += 1;
      transient = !hardFailure;
    },
    succeeded(token) {
      if (token !== epoch) return;
      failureSince = null;
      failedAttempts = 0;
      transient = false;
      hardFailure = false;
      authRequired = false;
      awaitingVerification = false;
    },
    snapshot() { return { transient, hardFailure, authRequired, awaitingVerification, failureSince, failedAttempts }; },
  };
}

export function projectSyncStatusSeverity(summary, now = Date.now()) {
  const fatalState = summary.failedCount > 0 ? 'error'
    : summary.rejectedCount > 0 ? 'rejected'
    : summary.reasonCategory === 'workspace_ownership_blocked' ? 'blocked'
    : summary.safeToContinueUnrelatedWork === false ? 'error' : null;
  if (fatalState) return { ...summary, state: fatalState, actionableSyncIssue: true, cloudSyncHealthy: false };
  const hard = summary.failedCount > 0 || summary.rejectedCount > 0 || summary.blockedCount > 0 ||
    ['auth_required', 'blocked', 'rejected'].includes(summary.state) ||
    summary.reasonCategory === 'workspace_ownership_blocked' || summary.safeToContinueUnrelatedWork === false;
  const severity = summary.presentationSeverity;
  if (!hard && severity?.authRequired) return { ...summary, state: 'auth_required', cloudSyncHealthy: false, actionableSyncIssue: true };
  if (!hard && severity?.hardFailure) return { ...summary, state: 'error', cloudSyncHealthy: false, actionableSyncIssue: true };
  if (!hard && severity?.awaitingVerification && summary.state === 'synced' && !severity.transient) {
    return { ...summary, state: 'pending', cloudSyncHealthy: false };
  }
  if (hard || !severity?.transient || severity.hardFailure || !['error', 'pending', 'syncing', 'synced'].includes(summary.state)) return summary;
  const escalated = severity.failedAttempts >= 2 && now - severity.failureSince >= TRANSIENT_SEVERITY_MS;
  return { ...summary, state: escalated ? 'error' : 'pending', cloudSyncHealthy: false,
    reasonCategory: 'temporary_sync_failure', actionableSyncIssue: true };
}
