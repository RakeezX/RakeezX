/** Presentation state only. Sync and its retry timers remain the source of truth. */
import { isStudentLifecycleInFlight } from './sync-status-severity.js';
export const OFFLINE_LIVENESS_MS = 8_000;
export const FAILED_RECOVERY_STABLE_MS = 1_200;
export const WAKE_COALESCE_MS = 1_500;

export function startRecoveryCycle(now) {
  return { phase: 'recovering', startedAt: now, failureSince: null };
}

export function wakeRecoveryCycle(cycle, now, { online = true } = {}) {
  // Browser wake signals for one return to the app share the same attempt.
  if (!online && cycle?.phase === 'failed') return cycle;
  return cycle && (cycle.phase === 'recovering' || now - cycle.startedAt < WAKE_COALESCE_MS)
    ? cycle : startRecoveryCycle(now);
}

export function presentSyncWarning(summary, cycle, now) {
  if (isStudentLifecycleInFlight(summary)) {
    return { cycle, quiet: false, strip: false, status: 'syncing', nextCheckAt: null };
  }
  const state = summary?.state ?? 'idle';
  const durable = ['rejectedCount', 'blockedCount', 'failedCount'].some((key) => summary?.[key] > 0)
    || ['auth_required', 'blocked', 'rejected'].includes(state)
    || summary?.reasonCategory === 'workspace_ownership_blocked'
    || summary?.safeToContinueUnrelatedWork === false;
  if (durable) {
    const status = summary.failedCount > 0 ? 'error'
      : summary.rejectedCount > 0 ? 'rejected'
      : summary.blockedCount > 0 || summary?.reasonCategory === 'workspace_ownership_blocked' ? 'blocked'
      : summary?.safeToContinueUnrelatedWork === false && !['error', 'blocked', 'rejected', 'auth_required'].includes(state)
        ? 'error' : state;
    return { cycle, quiet: false, strip: true, status, nextCheckAt: null };
  }

  if (cycle?.phase === 'settled' && ['offline', 'error'].includes(state)) {
    return presentSyncWarning(summary, startRecoveryCycle(now), now);
  }

  if (!cycle || cycle.phase !== 'recovering') {
    return { cycle, quiet: false, strip: state === 'offline' || state === 'error', nextCheckAt: null };
  }
  if (state === 'synced' || state === 'idle') {
    const settleAt = cycle.startedAt + FAILED_RECOVERY_STABLE_MS;
    return now >= settleAt
      ? { cycle: { ...cycle, phase: 'settled' }, quiet: false, strip: false, nextCheckAt: null }
      : { cycle, quiet: true, strip: false, nextCheckAt: settleAt };
  }
  if (state === 'offline') {
    const deadline = cycle.startedAt + OFFLINE_LIVENESS_MS;
    return now >= deadline
      ? { cycle: { ...cycle, phase: 'failed' }, quiet: false, strip: true, nextCheckAt: null }
      : { cycle: { ...cycle, failureSince: null }, quiet: true, strip: false, nextCheckAt: deadline };
  }
  if (state === 'error') {
    const retrying = summary?.automaticSyncActive || summary?.automaticRetryActive;
    const failureSince = retrying ? null : cycle.failureSince ?? now;
    const deadline = retrying ? cycle.startedAt + OFFLINE_LIVENESS_MS
      : Math.min(cycle.startedAt + OFFLINE_LIVENESS_MS,
        Math.max(cycle.startedAt + FAILED_RECOVERY_STABLE_MS, failureSince + FAILED_RECOVERY_STABLE_MS));
    return now >= deadline
      ? { cycle: { ...cycle, phase: 'failed', failureSince }, quiet: false, strip: true, status: 'error', nextCheckAt: null }
      : { cycle: { ...cycle, failureSince }, quiet: true, strip: false, nextCheckAt: deadline };
  }
  return { cycle: { ...cycle, failureSince: null }, quiet: true, strip: false, nextCheckAt: null };
}
