import * as cloud from './cloud.js';
import * as store from '../store.js';
import * as db from './db.js';
import { uid, DEFAULT_TIME_PROFILES, normalizeSectionLabel } from '../models.js';
import { createSyncV2Engine, SYNC_V2_STORES } from './sync-v2.js';
import { ownershipBlockedError, runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { isCurriculumOrdinarySyncAllowed } from './curriculum-bootstrap.js';
import { createRemoteSync, browserRemoteLeadership } from './remote-sync.js';
import { createSyncStatusSeverity, projectSyncStatusSeverity } from './sync-status-severity.js';

export const state = {
  lastError: null,
  status: 'idle', // idle, pending, offline, syncing, synced, blocked, error
  lastSyncedAt: null, // will be initialized from store
  results: {
    profile: null,
    structural: null,
    students: null,
    notes: null
  }
};

export function displayState() {
  const status = autoRunning ? 'syncing' : state.status;
  const visualStatus = ['blocked', 'conflicted', 'rejected'].includes(status) ? 'pending' : status;
  const labels = {
    synced: { text: 'متزامن', badge: 'badge--brand', label: 'كافة البيانات متزامنة مع السحابة' },
    syncing: { text: 'جارٍ المزامنة...', badge: 'badge--brand', label: 'جارٍ نقل وتحديث البيانات سحابيًا' },
    pending: { text: 'تغييرات بانتظار المزامنة', badge: 'badge--warn', label: 'توجد تعديلات محلية بانتظار رفعها' },
    blocked: { text: 'تغييرات بانتظار اكتمال بيانات مرتبطة', badge: 'badge--warn', label: 'بياناتك محفوظة محليًا وستُرسل بعد اكتمال البيانات المرتبطة' },
    conflicted: { text: 'توجد تغييرات تحتاج مراجعة', badge: 'badge--warn', label: 'البيانات محفوظة، ويوجد تعارض مسجل يحتاج مراجعة' },
    rejected: { text: 'تعذّر قبول بعض التغييرات', badge: 'badge--warn', label: 'بعض التغييرات محفوظة محليًا ولم يقبلها الخادم' },
    auth_required: { text: 'يلزم تسجيل الدخول', badge: 'badge--warn', label: 'بياناتك محفوظة محليًا. سجّل الدخول لاستئناف المزامنة' },
    offline: { text: 'غير متصل (حفظ محلي)', badge: 'badge--neutral', label: 'التطبيق يعمل دون إنترنت ويحفظ محليًا' },
    error: { text: 'تعذر إكمال المزامنة', badge: 'badge--danger', label: 'حُفظت بياناتك محليًا. يمكنك إعادة المحاولة الآن.' },
    idle: { text: 'محلي', badge: 'badge--neutral', label: 'البيانات محفوظة محليًا على هذا الجهاز' },
  };
  return { status: visualStatus, detailStatus: status, ...labels[status] };
}

const SYNCABLE_STORES = new Set([
  'profile', 'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'units', 'lessons', 'sections', 'teachings',
  'students', 'enrollments', 'notes', 'items', 'scoreSubitems', 'scoreSubitemCompletions', 'scores', 'logs',
  'classRules', 'classGoals', 'classCharterSelections', 'groupArrangements',
  'timeProfiles', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance', 'closedTermReports', 'assignments', 'submissions'
]);
const STRUCTURAL_STORES = new Set(['years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings', 'classRules', 'classGoals', 'classCharterSelections', 'groupArrangements']);
const STUDENT_STORES = new Set(['students', 'enrollments']);
const SCORING_STORES = new Set(['items', 'scoreSubitems', 'scoreSubitemCompletions', 'scores', 'logs']);
const TIMETABLE_STORES = new Set(['timeProfiles', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance']);
const AUTO_SYNC_DEBOUNCE_MS = 325;
const RESUME_STALE_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

let autoTimer = null;
let autoRunning = false;
let rerunRequested = false;
let fullRequested = false;
let remoteRequested = false;
let suppressAutoSchedule = false;
let initialized = false;
// AI-authored N123: boot lease verification is preparation, not a failed Sync attempt.
let startupPreparing = false;
// AI N125: a foreground lifecycle owns its prerequisite, before receiver/capture.
let resumePreparing = null;
let resumeAwake = false;
// AI-authored N125: bounded, context-local diagnostics; never retain raw errors.
let lastSafeFailure = null;
let resumeEvent = 'automatic';
function recordSafeFailure(error, phase, startedAt, event = resumeEvent) {
  const known = ['AUTH_REQUIRED', 'AUTH_TIMEOUT', 'AUTH_CONTEXT_CHANGED', 'AUTH_OWNER_MISMATCH',
    'SYNC_OWNERSHIP_BLOCKED', 'OFFLINE_LEASE_LIMITED', 'LEASE_VERIFY_TIMEOUT'];
  const status = Number(error?.status);
  const code = error?.reason === 'sync-context-changed' ? 'CONTEXT_CHANGED'
    : known.includes(error?.code) ? error.code
    : [400, 401, 403, 404, 409, 429, 500, 502, 503, 504].includes(status) ? `HTTP_${status}`
    : error?.name === 'TypeError' && ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'].includes(error.message)
      ? 'FETCH_FAILED' : 'UNKNOWN';
  lastSafeFailure = Object.freeze({ phase, code, event,
    at: new Date().toISOString(), elapsedMs: Math.min(120000, Math.max(0, Math.round(performance.now() - startedAt))) });
}
let retryAttempt = 0;
let retryScheduled = false;
let restoreRunning = false;
let liveStudentLifecycle = null;
let liveClassDeletion = null;
let classDeletionReserved = false;
let reservedClassDeletionTask = null;
let restorePreparing = false;
let workspaceClaimRunning = false;
const presentationSeverity = createSyncStatusSeverity();
let presentationContextToken = null;
function bindPresentationContext() {
  const workspace = store.getActiveWorkspace();
  const token = presentationSeverity.bind(cloud.session && cloud.user && workspace
    ? JSON.stringify([cloud.user.id, workspace.databaseName, workspace.authUserId]) : null);
  if (token !== presentationContextToken) {
    lastSafeFailure = null;
    liveStudentLifecycle = null;
    liveClassDeletion = null;
    presentationContextToken = token;
    if (operationalSummaryCache.state === 'synced') {
      operationalSummaryCache = Object.freeze({ ...operationalSummaryCache, state: 'pending',
        lastSuccessfulSyncAt: null, cloudSyncHealthy: false });
    }
  }
  return token;
}
const syncSettledWaiters = new Set();
const v2Engine = createSyncV2Engine({
  ownershipGuard: runtimeSyncOwnershipGuard,
  currentAuthenticatedUserId: () => cloud.user?.id ?? null,
});

const COORDINATOR_REASON = Object.freeze({
  idle: ['local_only', 'العمل محفوظ محليًا ولم تبدأ مزامنة سحابية.'],
  auth_required: ['authentication_required', 'يلزم تسجيل الدخول لاستئناف المزامنة.'],
  offline: ['offline', 'العمل محفوظ محليًا وسيُرفع عند عودة الاتصال.'],
  syncing: ['sync_in_progress', 'المزامنة تعمل الآن.'],
  error: ['temporary_sync_failure', 'تعذّر إكمال المزامنة وستُعاد المحاولة.'],
  blocked: ['workspace_ownership_blocked', 'توقفت المزامنة لحماية بيانات مساحة العمل.'],
});

const DURABLE_REASON = Object.freeze({
  error: ['temporary_sync_failure', 'تعذّر إرسال بعض التغييرات وستُعاد المحاولة.'],
  rejected: ['server_rejected_change', 'يوجد تغيير لم يقبله الخادم ويحتاج تدخّلًا.'],
  blocked: ['waiting_for_related_data', 'توجد تغييرات تنتظر اكتمال بيانات مرتبطة.'],
  pending: ['waiting_for_upload', 'توجد تغييرات محفوظة محليًا بانتظار الرفع.'],
  synced: ['none', 'لا توجد تغييرات حالية تحتاج إجراءً.'],
});

let operationalSummaryCache = Object.freeze({
  state: 'idle', queuedCount: 0, pendingCount: 0, failedCount: 0, blockedCount: 0,
  rejectedCount: 0, historicalConflictCount: 0, actionableSyncIssue: false,
  affectedCategories: Object.freeze([]), historicalConflictCategories: Object.freeze([]),
  reasonCategory: 'local_only', reasonLabel: COORDINATOR_REASON.idle[1],
  lastSuccessfulSyncAt: null, automaticRetryActive: false, automaticSyncActive: false,
  teacherActionRequired: false, localWorkSaved: true, cloudSyncHealthy: false,
  safeToContinueUnrelatedWork: true,
});

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const intersects = (stores, expected) => [...expected].some((name) => stores.has(name));
const cloudOwnershipAccess = (operation = 'pull', command = null) => runtimeSyncOwnershipGuard.cloudAccess({
  operation, authenticatedUserId: cloud.user?.id ?? null, command,
});

const remoteSync = createRemoteSync({
  debounceMs: AUTO_SYNC_DEBOUNCE_MS,
  getContext: () => ({ ownerId: cloud.user?.id, token: cloud.session?.access_token,
    workspace: store.getActiveWorkspace()?.databaseName, ready: store.state.ready,
    proven: cloudOwnershipAccess('pull').allowed
      && store.getActiveWorkspace()?.type === 'account'
      && store.getActiveWorkspace()?.authUserId === cloud.user?.id
      && store.getActiveWorkspace()?.ownershipState === 'claimed'
      && !startupPreparing && (!resumePreparing || autoRunning) && !workspaceClaimRunning && !restorePreparing && !restoreRunning,
    online: isOnline(), visible: typeof document === 'undefined' || document.visibilityState === 'visible' }),
  getMarker: cloud.fetchOwnerSyncMarker,
  openChannel: cloud.openOwnerSyncChannel,
  acquireLeadership: browserRemoteLeadership,
  requestSync: () => {
    if (restoreRunning || workspaceClaimRunning || retryScheduled || !cloudOwnershipAccess('pull').allowed) return;
    if (autoRunning) { rerunRequested = true; fullRequested = true; remoteRequested = true; }
    else scheduleAutomaticSync({ full: true, immediate: true, remote: true });
  },
});

export const getRemoteSyncDiagnostics = () => remoteSync.diagnostics();

function stopOwnershipBlockedScheduling(access) {
  recordSafeFailure({ code: 'SYNC_OWNERSHIP_BLOCKED', reason: access.reason }, 'ownership', performance.now());
  remoteSync.stop();
  fullRequested = false;
  remoteRequested = false;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  retryScheduled = false;
  retryAttempt = 0;
  rerunRequested = false;
  setState({ status: 'blocked', lastError: `Sync ownership blocked: ${access.reason}` });
}

function assertCloudOwnership(operation = 'pull') {
  const access = cloudOwnershipAccess(operation);
  if (access.allowed) return access;
  stopOwnershipBlockedScheduling(access);
  throw ownershipBlockedError(access);
}

function coordinatorOperationalState(durable) {
  if (durable.failedCount > 0) return 'error';
  if (durable.rejectedCount > 0) return 'rejected';
  if (state.status === 'blocked') return 'blocked';
  if (cloud.authStatus?.().state === 'auth_required' || state.status === 'auth_required') return 'auth_required';
  if (presentationSeverity.snapshot().hardFailure) return 'error';
  if ((studentLifecycleInFlight() || classDeletionInFlight()) && durable.blockedCount === 0) return 'syncing';
  if (store.state.device?.studentLifecycleResume || store.state.device?.n77DeleteIntent) return 'error';
  if (autoRunning) return 'syncing';
  if (!cloud.session || !cloud.user) return cloud.authStatus?.().state === 'auth_required' ? 'auth_required' : 'idle';
  if (!isOnline()) return 'offline';
  if (startupPreparing || resumePreparing) return 'pending';
  if (state.status === 'blocked') return 'blocked';
  if (state.status === 'error' && durable.failedCount === 0) return 'error';
  if (remoteSync.diagnostics().pending) return 'pending';
  return durable.state;
}

function studentLifecycleInFlight() {
  const checkpoint = store.state.device?.studentLifecycleResume;
  return !!liveStudentLifecycle && restoreRunning && !!cloud.session &&
    cloud.user?.id === liveStudentLifecycle.ownerId &&
    presentationContextToken === liveStudentLifecycle.contextToken &&
    cloudOwnershipAccess('pull').allowed && !store.state.device?.cloudRestoreResume &&
    (!checkpoint || (checkpoint.ownerId === liveStudentLifecycle.ownerId &&
      checkpoint.envelope?.mutationId === liveStudentLifecycle.mutationId));
}

function classDeletionInFlight() {
  const checkpoint = store.state.device?.n77DeleteIntent;
  return !!liveClassDeletion && restoreRunning && !!cloud.session &&
    cloud.user?.id === liveClassDeletion.ownerId &&
    presentationContextToken === liveClassDeletion.contextToken &&
    cloudOwnershipAccess('pull').allowed && !store.state.device?.cloudRestoreResume &&
    !store.state.device?.studentLifecycleResume &&
    (!checkpoint || (checkpoint.ownerId === liveClassDeletion.ownerId &&
      (liveClassDeletion.kind==='subjectless-section' ? checkpoint.kind==='subjectless-section'&&checkpoint.sectionId===liveClassDeletion.sectionId&&checkpoint.selectedTeachingId===null : checkpoint.selectedTeachingId === liveClassDeletion.teachingId) &&
      checkpoint.mutationId === liveClassDeletion.mutationId));
}

function normalizeDurableSummary(durable = {}) {
  const pendingCount = durable.pendingCount ?? durable.pending ?? 0;
  const failedCount = durable.failedCount ?? durable.failed ?? 0;
  const blockedCount = durable.blockedCount ?? durable.blocked ?? 0;
  const rejectedCount = durable.rejectedCount ?? durable.rejected ?? 0;
  const historicalConflictCount = durable.historicalConflictCount ?? durable.conflicts ?? 0;
  const state = failedCount ? 'error'
    : rejectedCount ? 'rejected'
    : blockedCount ? 'blocked'
    : pendingCount ? 'pending'
    : 'synced';
  const [reasonCategory, reasonLabel] = DURABLE_REASON[state];
  return {
    ...durable,
    state,
    queuedCount: durable.queuedCount ?? durable.queued ?? (pendingCount + failedCount + blockedCount + rejectedCount),
    pendingCount,
    failedCount,
    blockedCount,
    rejectedCount,
    historicalConflictCount,
    actionableSyncIssue: state !== 'synced',
    affectedCategories: durable.affectedCategories ?? [],
    historicalConflictCategories: durable.historicalConflictCategories ?? [],
    reasonCategory: durable.reasonCategory ?? reasonCategory,
    reasonLabel: durable.reasonLabel ?? reasonLabel,
  };
}

function cacheOperationalSummary(durable, expectedToken = null) {
  const token = bindPresentationContext();
  if (expectedToken && expectedToken !== token) return getSyncOperationalSummarySnapshot();
  const normalized = normalizeDurableSummary(durable);
  const currentState = coordinatorOperationalState(normalized);
  const reason = startupPreparing && currentState === 'pending'
    ? ['startup_preparing', 'نتحقق من جاهزية الحساب قبل بدء المزامنة.']
    : resumePreparing && currentState === 'pending'
    ? ['resume_preparing', 'نتحقق من جاهزية الحساب قبل استئناف المزامنة.']
    : COORDINATOR_REASON[currentState] ?? [normalized.reasonCategory, normalized.reasonLabel];
  const actionableSyncIssue = normalized.actionableSyncIssue || ['auth_required', 'offline', 'error'].includes(currentState);
  operationalSummaryCache = Object.freeze({
    state: currentState,
    queuedCount: normalized.queuedCount,
    pendingCount: normalized.pendingCount,
    failedCount: normalized.failedCount,
    blockedCount: normalized.blockedCount,
    rejectedCount: normalized.rejectedCount,
    historicalConflictCount: normalized.historicalConflictCount,
    actionableSyncIssue,
    affectedCategories: Object.freeze([...normalized.affectedCategories]),
    historicalConflictCategories: Object.freeze([...normalized.historicalConflictCategories]),
    reasonCategory: reason[0],
    reasonLabel: reason[1],
    lastSuccessfulSyncAt: state.lastSyncedAt,
    automaticRetryActive: retryScheduled,
    automaticSyncActive: autoRunning,
    teacherActionRequired: currentState === 'auth_required' || normalized.rejectedCount > 0 ||
      (normalized.blockedCount > 0 && !autoRunning) || (normalized.failedCount > 0 && !retryScheduled),
    localWorkSaved: true,
    cloudSyncHealthy: currentState === 'synced' && !normalized.actionableSyncIssue,
    safeToContinueUnrelatedWork: !restoreRunning && !store.state.device?.studentLifecycleResume && !store.state.device?.n77DeleteIntent,
    studentLifecycleInFlight: studentLifecycleInFlight(),
    classDeletionInFlight: classDeletionInFlight(),
    presentationSeverity: Object.freeze(presentationSeverity.snapshot()),
    lastSafeFailure,
  });
  return projectSyncStatusSeverity(operationalSummaryCache);
}

/** Fresh privacy-safe Sync health; never returns records, identities, patches, receipts, or raw errors. */
export async function getSyncOperationalSummary() {
  const token = bindPresentationContext();
  return cacheOperationalSummary(await v2Engine.status(), token);
}

/** Synchronous last-known projection for existing render/diagnostic paths. */
export function getSyncOperationalSummarySnapshot() {
  bindPresentationContext();
  // Rebind synchronously before any render; an old cache cannot certify a new
  // account, and an async status read is still responsible for durable truth.
  return cacheOperationalSummary(operationalSummaryCache);
}

async function pendingOutbox() {
  const entries = await db.getAll('outbox');
  const pending = [];
  for (const entry of entries) {
    if (entry.protocol !== 'v2' || entry.state === 'superseded' || !SYNCABLE_STORES.has(entry.store)) continue;
    // Preserve old receipts for diagnosis, but never upload local-only demo
    // records or let those receipts keep unrelated cloud work pending forever.
    const record = entry.recordId ? await db.get(entry.store, entry.recordId) : null;
    if (store.isLocalOnlyRecord(record)) continue;
    pending.push(entry);
  }
  return pending;
}

async function acknowledgeOutbox(snapshot) {
  for (const entry of snapshot) {
    const current = await db.get('outbox', entry.id);
    // A mutation made while this run was active keeps its newer entry for the
    // follow-up pass; only the exact successfully-synced snapshot is removed.
    if (current && current.updatedAt === entry.updatedAt) await db.remove('outbox', entry.id);
  }
}

function scheduleAutomaticSync({ full = false, immediate = false, remote = false } = {}) {
  if (classDeletionReserved || restoreRunning || restorePreparing || workspaceClaimRunning || suppressAutoSchedule) return;
  if (!cloud.session || !cloud.user) return;
  const ownership = cloudOwnershipAccess('pull');
  if (!ownership.allowed) {
    stopOwnershipBlockedScheduling(ownership);
    return;
  }
  if (startupPreparing || resumePreparing) return;
  if (!isOnline()) {
    setState({ status: 'offline' });
    return;
  }
  if (autoRunning) {
    rerunRequested = true;
    fullRequested ||= full;
    remoteRequested ||= remote;
    return;
  }
  if (autoTimer) clearTimeout(autoTimer);
  retryScheduled = false;
  fullRequested ||= full;
  remoteRequested ||= remote;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    const requestedFull = fullRequested;
    const requestedRemote = remoteRequested;
    fullRequested = false;
    remoteRequested = false;
    syncAll({ full: requestedFull, remote: requestedRemote });
  }, immediate ? 0 : AUTO_SYNC_DEBOUNCE_MS);
  setState({ status: 'pending' });
}

function retryDelay() {
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt = Math.min(retryAttempt + 1, RETRY_DELAYS_MS.length - 1);
  return delay;
}

function scheduleRetry() {
  if (classDeletionReserved || workspaceClaimRunning) return;
  if (!cloud.session || !cloud.user || !isOnline()) return;
  const ownership = cloudOwnershipAccess('pull');
  if (!ownership.allowed) {
    stopOwnershipBlockedScheduling(ownership);
    return;
  }
  if (autoTimer) clearTimeout(autoTimer);
  retryScheduled = true;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    retryScheduled = false;
    syncAll({ full: true });
  }, retryDelay());
  void getSyncOperationalSummary().catch(() => {});
  // Keep the failed result visible while waiting; a timer is not an active run.
}

async function scheduleResumeSync(prepareResume, { force = false, event = 'focus' } = {}) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (resumePreparing) { resumeAwake = true; return; }
  if (resumeAwake && !force) return;
  resumeAwake = true;
  resumeEvent = event;
  // Startup already owns its readiness and initial full pass (N123).
  if (startupPreparing) return;
  presentationSeverity.verifying(bindPresentationContext());
  notify();
  if (workspaceClaimRunning) return;
  if (!cloud.session || !cloud.user || !isOnline()) return;
  const ownership = cloudOwnershipAccess('pull');
  if (!ownership.allowed) {
    stopOwnershipBlockedScheduling(ownership);
    return;
  }
  const context = { workspace: store.getActiveWorkspace(), owner: cloud.user.id };
  const startedAt = performance.now();
  const isCurrent = () => store.getActiveWorkspace() === context.workspace && cloud.user?.id === context.owner && !!cloud.session;
  resumePreparing = context;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  retryScheduled = false;
  notify();
  try {
    // Never renew underneath an earlier active capture; let it finish first.
    if (autoRunning) await new Promise(resolve => syncSettledWaiters.add(resolve));
    presentationSeverity.verifying(bindPresentationContext());
    remoteSync.stop();
    if (isCurrent()) {
      const result = await prepareResume?.();
      if (result?.error) recordSafeFailure(result.error, 'resume_readiness', startedAt, event);
    }
  } catch (error) {
    if (isCurrent()) recordSafeFailure(error, 'resume_readiness', startedAt, event);
    // Readiness failure is not success. The following real attempt retains all
    // owner/lease/Auth guards and reports the actual failure, as at startup.
  } finally {
    if (resumePreparing === context) resumePreparing = null;
    notify();
  }
  if (!isCurrent()) {
    const access = cloudOwnershipAccess('pull');
    if (!access.allowed) stopOwnershipBlockedScheduling(access);
    else {
      // The old lifecycle cannot certify a replacement workspace. Start it
      // through the current guards rather than dropping a genuine change.
      void remoteSync.refresh();
      scheduleAutomaticSync({ full: true, immediate: true });
    }
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  void remoteSync.refresh();
  const pending = await pendingOutbox();
  if (!isCurrent()) return;
  const stale = !state.lastSyncedAt || Date.now() - state.lastSyncedAt >= RESUME_STALE_MS;
  if (pending.length || stale || presentationSeverity.snapshot().awaitingVerification) scheduleAutomaticSync({ full: true, immediate: true });
}

function failedResult(name) {
  return state.results[name]?.status === 'error' ? state.results[name].error : null;
}

async function runRequiredSync(stores, full) {
  if (full || stores.has('profile')) {
    await syncProfile();
    if (failedResult('profile')) throw new Error(failedResult('profile'));
  }
  if (full || intersects(stores, STRUCTURAL_STORES)) {
    await syncStructural();
    if (failedResult('structural')) throw new Error(failedResult('structural'));
  }
  if (full || intersects(stores, STUDENT_STORES)) {
    await syncStudents();
    if (failedResult('students')) throw new Error(failedResult('students'));
  }
  // Logs can reference a dated session, so timetable/session records must reach
  // the cloud before scoring (which owns the logs sync category) attempts log push.
  if (full || intersects(stores, TIMETABLE_STORES) || stores.has('logs')) {
    await syncTimetable();
    if (failedResult('timetable')) throw new Error(failedResult('timetable'));
  }
  if (full || intersects(stores, SCORING_STORES)) {
    await syncScoring();
    if (failedResult('scoring')) throw new Error(failedResult('scoring'));
  }
  if (full || stores.has('notes')) {
    await syncNotes();
    if (failedResult('notes')) throw new Error(failedResult('notes'));
  }
}

const SCORE_PROVENANCE_STORES = new Set(['scoreSubitems', 'scoreSubitemCompletions']);
let unifiedRestoreOwner = null;

function v2StoreAllowed(name, scoreDomainAvailable) {
  return (unifiedRestoreOwner === cloud.user?.id || isCurriculumOrdinarySyncAllowed(name)) &&
    (unifiedRestoreOwner === cloud.user?.id || !['assignments', 'submissions'].includes(name)) &&
    (scoreDomainAvailable || !SCORE_PROVENANCE_STORES.has(name));
}

async function scoreDomainAvailableForSync() {
  let capability;
  try {
    capability = await cloud.getScoreFoundationCapability({ workspace: store.getActiveWorkspace() });
  } catch (error) {
    if (Number(error?.status) === 404 || error?.code === 'PGRST202') return false;
    throw error;
  }
  return capability?.scoreDomainVersion === 1 && capability?.restoreProtocol === 'CORE_V2' &&
    capability?.backupVersion === 5 && capability?.copyDomainVersion === 1;
}

function v2StoresFor(snapshot, full, scoreDomainAvailable) {
  if (full) return SYNC_V2_STORES.filter((name) => v2StoreAllowed(name, scoreDomainAvailable));
  const stores = new Set(snapshot.map((entry) => entry.store).filter((name) => SYNCABLE_STORES.has(name)));
  for (const entry of snapshot) {
    for (const dependency of entry.dependencies ?? []) {
      if (SYNCABLE_STORES.has(dependency.store)) stores.add(dependency.store);
    }
  }
  return [...stores].filter((name) => v2StoreAllowed(name, scoreDomainAvailable));
}

function v2PostPullStores(snapshot, full, scoreDomainAvailable) {
  if (full || snapshot.some((entry) => String(entry.command ?? '').startsWith('lifecycle:'))) {
    return SYNC_V2_STORES.filter((name) => v2StoreAllowed(name, scoreDomainAvailable));
  }
  const stores = new Set(v2StoresFor(snapshot, false, scoreDomainAvailable));
  for (const entry of snapshot) {
    if (['scoreSubitems', 'scoreSubitemCompletions', 'scores', 'items'].includes(entry.store)) {
      stores.add('scores');
    }
    if (String(entry.command ?? '').startsWith('enrollment:')) {
      stores.add('students'); stores.add('enrollments'); stores.add('groupArrangements');
    } else if (['attendance:record', 'attendance:fill'].includes(entry.command)) {
      stores.add('sessions'); stores.add('sessionRosterSnapshots'); stores.add('attendance');
    } else if (entry.command === 'teaching:create') {
      stores.add('teachings'); stores.add('items');
    } else if (String(entry.command ?? '').startsWith('term-report:')) {
      stores.add('closedTermReports'); stores.add('terms');
    } else if (entry.command === 'class-goal:reward') {
      stores.add('classGoals'); stores.add('logs');
    }
  }
  return [...stores].filter((name) => v2StoreAllowed(name, scoreDomainAvailable));
}

/**
 * A term closure is deliberately online-only: first reach canonical Sync V2
 * state, then submit one durable idempotent command containing frozen facts.
 */
export async function finalizeClosedTermReport(termId, { supersedesId = null } = {}) {
  if (!cloud.session || !cloud.user) throw new Error('سجّل الدخول قبل إغلاق الفصل الدراسي.');
  if (!isOnline()) throw new Error('إغلاق الفصل الدراسي يحتاج اتصالًا بالإنترنت.');
  const prepared = await syncAll({ full: true });
  const before = await v2Engine.status();
  if (!prepared || before.state !== 'synced') {
    throw new Error('أكمل المزامنة وعالج التغييرات المعلقة قبل إغلاق الفصل الدراسي.');
  }
  const queued = await store.queueClosedTermReport({ termId, supersedesId });
  const committed = await syncAll({ full: true });
  const after = await v2Engine.status();
  const report = store.closedTermReports(termId).find((candidate) => candidate.id === queued.reportId) ?? null;
  if (!committed || after.state !== 'synced' || !report) {
    throw new Error('لم يكتمل تثبيت تقارير الفصل الدراسي. بقي الطلب محفوظًا لإعادة المحاولة.');
  }
  return report;
}

function firstPullError(result) {
  const failure = result?.failures?.[0];
  if (!failure) return null;
  return new Error(`${failure.store}: ${failure.error?.message ?? failure.error}`);
}

/** Sync V2 runtime coordinator; V1 category implementations below are retained as dead legacy only. */
export async function syncAll({ full = true, remote = false, forRestore = false } = {}) {
  if (startupPreparing || resumePreparing || classDeletionReserved || restoreRunning || workspaceClaimRunning || (restorePreparing && !forRestore)) return false;
  const lifecycleDevice = await db.get('device', 'device');
  if (startupPreparing || resumePreparing || classDeletionReserved || restoreRunning || workspaceClaimRunning || (restorePreparing && !forRestore)) return false;
  if (lifecycleDevice?.studentLifecycleResume || lifecycleDevice?.n77DeleteIntent || lifecycleDevice?.cloudRestoreResume) return false;
  if (!cloud.session || !cloud.user) {
    setState({ status: cloud.authStatus?.().state === 'auth_required' ? 'auth_required' : 'idle' });
    return false;
  }
  if (!isOnline()) {
    setState({ status: 'offline' });
    return false;
  }
  const ownership = cloudOwnershipAccess('pull');
  if (!ownership.allowed) {
    // Mark retained commands with the same non-retryable safety state, but the
    // engine guard guarantees that this pass cannot make a network mutation.
    await v2Engine.dispatchPending();
    stopOwnershipBlockedScheduling(ownership);
    cacheOperationalSummary(await v2Engine.status());
    notify();
    return false;
  }
  if (autoRunning) {
    rerunRequested = true;
    fullRequested ||= full;
    remoteRequested ||= remote;
    return false;
  }

  // A manual pass can cancel a queued full timer. Consume that intent in this
  // pass so it cannot expand the next unrelated local-change pass.
  full ||= fullRequested;
  fullRequested = false;
  remoteRequested = false;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  autoRunning = true;
  const startedAt = performance.now();
  let phase = 'marker';
  const presentationToken = bindPresentationContext();
  const acknowledgedContext = { workspace: store.getActiveWorkspace(), session: cloud.session };
  let presentationErrors = null;
  remoteSync.beginSync();
  suppressAutoSchedule = true;
  setState({ lastError: null });
  let failed = false;
  let madeProgress = false;
  let remoteCapture = null;
  try {
    if (full) remoteCapture = await remoteSync.beforeFullSync();
    const snapshot = await pendingOutbox();
    // AI-authored N123: open/return also need only one complete read when no
    // local work existed. The pre-read owner revision and final marker check
    // provide exactly the same coverage as a remote wake. Writes, absent marker
    // evidence and partial passes still require their canonical post-pull.
    const idleReceiver = full && remoteCapture && snapshot.length === 0;
    phase = 'capability';
    const scoreDomainAvailable = await scoreDomainAvailableForSync();
    const unifiedCapability = await cloud.getUnifiedRestoreCapability();
    unifiedRestoreOwner = unifiedCapability?.protocol === 'N71_V1' ? cloud.user.id : null;
    const stores = v2StoresFor(snapshot, full, scoreDomainAvailable);
    phase = 'pull';
    const pull = await v2Engine.pullAll({ stores, scoreDomainSnapshot: scoreDomainAvailable,
      // AI-authored N123: overlap bounded snapshot reads on every entry path.
      // The engine still reconciles in dependency order before dispatching.
      readConcurrency: 4 });
    if (pull.ownershipBlocked) {
      stopOwnershipBlockedScheduling(cloudOwnershipAccess('pull'));
      return false;
    }
    const pullError = firstPullError(pull);
    if (pullError) presentationErrors = pull.failures.map((failure) => failure.error);
    if (pullError) throw pullError;
    phase = 'dispatch';
    const pushed = await v2Engine.dispatchPending();
    madeProgress = pushed.acknowledged > 0;
    // AI-authored N107: publish durable ACK revisions before unrelated trailing
    // failures. This is local reconciliation, never whole-run success.
    if (madeProgress && acknowledgedContext.workspace === store.getActiveWorkspace() &&
        acknowledgedContext.session === cloud.session && cloudOwnershipAccess('pull').allowed)
      await store.refreshSyncedState();
    if (pushed.ownershipBlocked) {
      stopOwnershipBlockedScheduling({ reason: pushed.blockReason });
      return false;
    }
    if (pushed.failed) throw new Error(`${pushed.failed} Sync V2 mutation(s) failed`);
    const skipPostPull = idleReceiver && pushed.attempted === 0 && (await pendingOutbox()).length === 0;
    // A receipt proves our own mutation, not every concurrent owner change.
    // Capture the marker AFTER dispatch and BEFORE a complete post-pull to
    // cover self-echo safely, including other-device commits already observed.
    const writerCapture = pushed.acknowledged > 0 ? await remoteSync.beforeFullSync({ writer: true }) : null;
    if (writerCapture) remoteCapture = writerCapture;
    phase = 'post_pull';
    const postPull = skipPostPull ? null : await v2Engine.pullAll({
      stores: v2PostPullStores(snapshot, full || !!writerCapture, scoreDomainAvailable),
      scoreDomainSnapshot: scoreDomainAvailable,
      readConcurrency: 4,
    });
    if (postPull?.ownershipBlocked) {
      stopOwnershipBlockedScheduling(cloudOwnershipAccess('pull'));
      return false;
    }
    const postPullError = firstPullError(postPull);
    if (postPullError) presentationErrors = postPull.failures.map((failure) => failure.error);
    if (postPullError) throw postPullError;
    // Never acknowledge the later marker: it may represent a write after an
    // earlier store was read. It requests trailing work, even if Broadcast was
    // missed. A failed validation cannot certify the single-pull fast path.
    phase = 'revision_validation';
    if (remoteCapture && !await remoteSync.check() && skipPostPull) {
      throw new Error('Remote Sync revision validation unavailable');
    }
    if (skipPostPull && (acknowledgedContext.workspace !== store.getActiveWorkspace() ||
        acknowledgedContext.session !== cloud.session || !cloudOwnershipAccess('pull').allowed)) {
      throw ownershipBlockedError({ reason: 'sync-context-changed' });
    }
    phase = 'local_refresh';
    await store.refreshSyncedState();
    const v2Status = await v2Engine.status();
    const lastSyncedAt = Date.now();
    await store.patchDevice({ lastSyncAt: lastSyncedAt }, { notify: false, queue: false });
    state.lastSyncedAt = lastSyncedAt;
    retryAttempt = 0;
    retryScheduled = false;
    bindPresentationContext();
    presentationSeverity.succeeded(presentationToken);
    setState({ status: v2Status.state, lastError: null });
    cacheOperationalSummary(v2Status, presentationToken);
    if (remoteCapture) remoteSync.afterFullSync(remoteCapture, true);
    if (remoteSync.diagnostics().pending) setState({ status: 'pending' });
    // Observers cannot alter Sync success or acquire an ACK from a failed run.
    if (pushed.acknowledged > 0 && !pushed.failed && acknowledgedContext.workspace === store.getActiveWorkspace() &&
        acknowledgedContext.session === cloud.session && cloudOwnershipAccess('pull').allowed) {
      for (const observer of acknowledgedListeners) {
        try { Promise.resolve(observer(Object.freeze(acknowledgedContext))).catch(() => {}); } catch { /* isolated observer */ }
      }
    }
    return true;
  } catch (err) {
    if (remoteCapture) remoteSync.afterFullSync(remoteCapture, false);
    failed = true;
    console.warn('[rakeezx sync] Automatic sync failed:', err);
    const needsAuth = cloud.isAuthRequiredError?.(err) || cloud.authStatus?.().state === 'auth_required';
    bindPresentationContext();
    // firstPullError adds a store label and drops HTTP metadata. Diagnose the
    // original transport failure, while preserving existing error semantics.
    if (presentationToken === presentationContextToken) recordSafeFailure(presentationErrors?.[0] ?? err, phase, startedAt);
    presentationSeverity.failed(presentationToken, needsAuth ? [] : presentationErrors ?? [err]);
    setState({ status: needsAuth ? 'auth_required' : (isOnline() ? 'error' : 'offline'), lastError: err.message });
    return false;
  } finally {
    remoteSync.endSync();
    suppressAutoSchedule = false;
    autoRunning = false;
    notify();
    try {
      const v2Status = await v2Engine.status();
      cacheOperationalSummary(v2Status, presentationToken);
      if (failed && cloud.authStatus?.().state !== 'auth_required') {
        rerunRequested = false;
        scheduleRetry();
      } else if (rerunRequested || v2Status.backgroundPending || (v2Status.blocked && madeProgress)) {
        rerunRequested = false;
        scheduleAutomaticSync({ full: fullRequested, remote: remoteRequested });
      } else {
        rerunRequested = false;
      }
    } finally {
      for (const resolve of syncSettledWaiters) resolve();
      syncSettledWaiters.clear();
    }
  }
}

/**
 * A cloud restore starts only from a completely acknowledged V2 state. It does
 * not consume or reinterpret pre-existing work; the teacher must let that work
 * synchronize (or resolve it) first.
 */
export async function assertCloudRestoreReady({ resuming = false } = {}) {
  if (!cloud.session || !cloud.user) throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' });
  if (!isOnline()) throw Object.assign(new Error('Cloud restore requires a network connection'), { code: 'OFFLINE' });
  if (restoreRunning || autoRunning) throw Object.assign(new Error('Synchronization is already running'), { code: 'SYNC_BUSY' });
  if ((await db.get('device', 'device'))?.studentLifecycleResume) {
    throw Object.assign(new Error('Resume the pending student lifecycle command first'), { code: 'LIFECYCLE_RESUME_REQUIRED' });
  }
  const before = await v2Engine.status();
  const allOutbox = await db.getAll('outbox');
  if (before.state !== 'synced' || allOutbox.some(row => row.state !== 'superseded')) throw Object.assign(new Error('Pending or unresolved Sync work blocks restore'), {
    code: 'RESTORE_OUTBOX_NOT_EMPTY', status: before,
  });
  if (resuming) {
    // No Product pull may replace this device until the exact canonical finalize
    // receipt is established. Probe authenticated service readiness without writes.
    const capability = await cloud.getUnifiedRestoreCapability();
    if (capability?.protocol !== 'N71_V1') throw Object.assign(new Error('Restore service is unavailable'), { code: 'RESTORE_SYNC_NOT_HEALTHY' });
    return before;
  }
  const healthy = await syncAll({ full: true, forRestore: true });
  const after = await v2Engine.status();
  if (!healthy || after.state !== 'synced' || state.status !== 'synced') {
    throw Object.assign(new Error('Sync V2 is not healthy enough for cloud restore'), {
      code: 'RESTORE_SYNC_NOT_HEALTHY', status: after,
    });
  }
  return after;
}

/** Pause automatic sync and normal Product mutations around finalization/reconciliation. */
export async function runCloudRestoreExclusive(task, { scheduleAutomatic = true, prepare = null } = {}) {
  if ((classDeletionReserved && task !== reservedClassDeletionTask) || restoreRunning || restorePreparing || workspaceClaimRunning || (autoRunning && !prepare)) throw Object.assign(new Error('Synchronization is already running'), { code: 'SYNC_BUSY' });
  if (typeof task !== 'function') throw new TypeError('Cloud restore task is required');
  remoteSync.stop();
  fullRequested = false;
  remoteRequested = false;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  restorePreparing = true;
  suppressAutoSchedule = true;
  store.setCloudRestoreInProgress(true);
  setState({ status: 'syncing', lastError: null });
  let completed = false;
  try {
    if (autoRunning) await new Promise(resolve => syncSettledWaiters.add(resolve));
    // Preparation performs the existing owner/outbox/healthy-Sync gates while
    // automatic passes are paused. It never stages or reconciles Product data.
    if (prepare) await prepare();
    restorePreparing = false;
    restoreRunning = true;
    const result = await task();
    completed = true;
    return result;
  } finally {
    store.setCloudRestoreInProgress(false);
    suppressAutoSchedule = false;
    restoreRunning = false;
    restorePreparing = false;
    if (initialized) void remoteSync.refresh();
    setState({ status: completed ? 'synced' : isOnline() ? 'error' : 'offline' });
    if (completed && scheduleAutomatic) scheduleAutomaticSync({ full: true, immediate: true });
  }
}

/**
 * Stop new writes and Sync scheduling, then wait for an already-running pass
 * to settle before an ownership transaction starts. This API does not claim a
 * workspace by itself and is dormant until an explicit caller invokes it.
 */
export async function runWorkspaceClaimExclusive(task, { scheduleAutomatic = false } = {}) {
  if (workspaceClaimRunning || restoreRunning) {
    throw Object.assign(new Error('Another exclusive operation is already running'), { code: 'SYNC_BUSY' });
  }
  if (typeof task !== 'function') throw new TypeError('Workspace claim task is required');
  remoteSync.stop();
  fullRequested = false;
  remoteRequested = false;
  workspaceClaimRunning = true;
  suppressAutoSchedule = true;
  store.setWorkspaceClaimInProgress(true);
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  retryScheduled = false;
  rerunRequested = false;
  if (autoRunning) {
    await new Promise((resolve) => syncSettledWaiters.add(resolve));
  }
  try {
    return await task();
  } finally {
    store.setWorkspaceClaimInProgress(false);
    suppressAutoSchedule = false;
    workspaceClaimRunning = false;
    if (initialized) void remoteSync.refresh();
    if (scheduleAutomatic) scheduleAutomaticSync({ full: true, immediate: true });
  }
}

/**
 * Stop new automatic work and let an already-running pass settle before an
 * account workspace is hidden on explicit logout. This never changes Product
 * records or command ownership; the caller either reloads or resumes scheduling
 * if the logout request itself fails.
 */
export async function suspendForWorkspaceDeactivation() {
  presentationSeverity.clear();
  remoteSync.stop();
  fullRequested = false;
  remoteRequested = false;
  suppressAutoSchedule = true;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  retryScheduled = false;
  rerunRequested = false;
  if (autoRunning) await new Promise((resolve) => syncSettledWaiters.add(resolve));
}

export function resumeAfterWorkspaceDeactivationFailure() {
  suppressAutoSchedule = false;
  if (initialized) void remoteSync.refresh();
  if (initialized && cloud.session && cloud.user) {
    scheduleAutomaticSync({ full: true, immediate: true });
  }
}

export async function runStudentLifecycleExclusive(task, identity) {
  const contextToken = bindPresentationContext();
  const checkpoint = store.state.device?.studentLifecycleResume;
  const live = identity?.ownerId === cloud.user?.id && identity?.mutationId &&
    checkpoint?.ownerId === identity.ownerId && checkpoint?.envelope?.mutationId === identity.mutationId
    ? { ...identity, contextToken } : null;
  // Set before the wrapper's first notification; no records/IDs enter the summary.
  if (!restoreRunning && !workspaceClaimRunning && !autoRunning) liveStudentLifecycle = live;
  try {
    return await runCloudRestoreExclusive(async () => {
      try { return await task(); }
      finally { if (liveStudentLifecycle === live) liveStudentLifecycle = null; }
    }, { scheduleAutomatic: initialized });
  } finally {
    if (liveStudentLifecycle === live) liveStudentLifecycle = null;
  }
}

/** Drain a pass before creating the N77 checkpoint that excludes normal writes. */
export async function runClassDeletionExclusive(task, { ownerId, teachingId, sectionId=null, kind='teaching' }) {
  if (classDeletionReserved || restoreRunning || restorePreparing || workspaceClaimRunning) {
    throw Object.assign(new Error('Synchronization is already running'), { code: 'SYNC_BUSY' });
  }
  const contextToken = bindPresentationContext();
  classDeletionReserved = true;
  remoteSync.stop();
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  retryScheduled = false;
  rerunRequested = false;
  try {
    if (autoRunning) await new Promise(resolve => syncSettledWaiters.add(resolve));
    if (bindPresentationContext() !== contextToken || cloud.user?.id !== ownerId || !cloud.session) {
      throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' });
    }
    assertCloudOwnership('pull');
    liveClassDeletion = { ownerId, teachingId, sectionId, kind, contextToken };
    presentationSeverity.verifying(contextToken);
    reservedClassDeletionTask = () => task(intent => {
      if (intent.ownerId !== ownerId || (kind==='subjectless-section' ? intent.kind!==kind||intent.sectionId!==sectionId||intent.selectedTeachingId!==null : intent.selectedTeachingId !== teachingId) || !intent.mutationId ||
          bindPresentationContext() !== contextToken || !liveClassDeletion) {
        throw new Error('Class deletion checkpoint identity mismatch');
      }
      liveClassDeletion.mutationId = intent.mutationId;
    });
    return await runCloudRestoreExclusive(reservedClassDeletionTask, { scheduleAutomatic: false });
  } catch (error) {
    bindPresentationContext();
    presentationSeverity.failed(contextToken, [error]);
    throw error;
  } finally {
    liveClassDeletion = null;
    reservedClassDeletionTask = null;
    classDeletionReserved = false;
    // A delete receipt is not a fresh complete pull, even when its queue is empty.
    if (initialized) scheduleAutomaticSync({ full: true, immediate: true });
    notify();
  }
}

async function syncV2Category(name) {
  const ok = await syncAll({ full: true });
  const result = ok
    ? { status: 'success', time: Date.now() }
    : { status: 'error', error: state.lastError ?? 'تعذّرت المزامنة', time: Date.now() };
  setState({ results: { ...state.results, [name]: result } });
  return ok;
}

const acknowledgedListeners = new Set();
export function subscribeAcknowledged(fn) { acknowledgedListeners.add(fn); return () => acknowledgedListeners.delete(fn); }
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

function setState(updates) {
  // Category success is not whole-run success. Publish that timestamp only
  // after the orchestration completes and acknowledges its outbox snapshot.
  if (autoRunning && 'lastSyncedAt' in updates) {
    updates = { ...updates };
    delete updates.lastSyncedAt;
  }
  Object.assign(state, updates);
  notify();
}

export function init({ readiness = null, prepareResume = null } = {}) {
  state.lastSyncedAt = store.state.device?.lastSyncAt || null;
  if (initialized) return;
  initialized = true;
  startupPreparing = !!readiness;
  if (readiness) {
    // A settled renewal (including failure) releases preparation. Real attempts
    // still pass every existing lease/owner guard and report their own failures.
    void Promise.resolve(readiness).catch(() => {}).then(() => {
      startupPreparing = false;
      void remoteSync.refresh();
      scheduleAutomaticSync({ full: true, immediate: true });
      notify();
    });
  }
  void getSyncOperationalSummary().catch(() => {});
  store.subscribe((_state, update) => {
    bindPresentationContext();
    void remoteSync.refresh();
    if (!suppressAutoSchedule && update.syncReady) scheduleAutomaticSync();
  });
  cloud.subscribe(() => {
    bindPresentationContext();
    void remoteSync.refresh();
    if (cloud.session && cloud.user) scheduleAutomaticSync({ full: true, immediate: true });
    else if (!cloud.session) {
      fullRequested = false;
      remoteRequested = false;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      retryScheduled = false;
      setState({ status: cloud.authStatus?.().state === 'auth_required' ? 'auth_required' : 'idle' });
      void getSyncOperationalSummary().catch(() => {});
    }
  });
  void remoteSync.refresh();
  if (cloud.session && cloud.user) scheduleAutomaticSync({ full: true, immediate: true });
  else if (cloud.authStatus?.().state === 'auth_required') setState({ status: 'auth_required' });
  if (typeof addEventListener === 'function') {
    addEventListener('online', () => {
      void scheduleResumeSync(prepareResume, { force: true, event: 'online' });
    });
    addEventListener('offline', () => {
      remoteSync.stop();
      retryScheduled = false;
      setState({ status: 'offline' });
      void getSyncOperationalSummary().catch(() => {});
    });
    const leave = () => { resumeAwake = false; remoteSync.stop(); };
    const resume = event => { void scheduleResumeSync(prepareResume, { event: event?.type === 'pageshow' ? 'pageshow' : event?.type === 'visibilitychange' ? 'visible' : 'focus' }); };
    // A visible window losing focus does not invalidate an active read capture.
    addEventListener('blur', () => { resumeAwake = false; });
    addEventListener('pagehide', leave);
    addEventListener('pageshow', resume);
    addEventListener('focus', resume);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', event => {
        if (document.visibilityState === 'visible') resume(event);
        else leave();
      });
    }
  }
}

function getDeviceId() {
  let id = store.state.device?.deviceId;
  if (!id) {
    id = uid();
    store.patchDevice({ deviceId: id });
  }
  return id;
}

/**
 * Timestamp normalization
 * Safely parses any date/number to integer milliseconds.
 * Returns 0 if invalid or absent.
 */
function calendarSourceForCloud(source) {
  return String(source ?? '').startsWith('preset:') ? 'moe' : source;
}

function calendarSourceFromCloud(record) {
  const prefix = `cal:${record.year_id}:preset:`;
  return record.source === 'moe' && String(record.id ?? '').startsWith(prefix)
    ? String(record.id).slice(`cal:${record.year_id}:`.length)
    : record.source;
}

function normalizeTimestamp(ts) {
  if (ts === null || ts === undefined || ts === '') return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsedNumber = Number(ts);
    if (!isNaN(parsedNumber) && parsedNumber > 0) return parsedNumber;
    const parsedDate = Date.parse(ts);
    if (!isNaN(parsedDate)) return parsedDate;
  }
  return 0;
}

/**
 * Checks if the local profile contains actual user-entered data
 * rather than just boot-time default placeholders.
 */
function hasMeaningfulProfile(profile) {
  if (!profile) return false;
  return Boolean(
    (profile.teacherName && profile.teacherName.trim() !== '') ||
    (profile.schoolName && profile.schoolName.trim() !== '') ||
    (profile.phone && profile.phone.trim() !== '') ||
    (profile.reportPrincipalName && profile.reportPrincipalName.trim() !== '') ||
    (profile.principalName && profile.principalName.trim() !== '')
  );
}

// reportPrincipalName is the canonical synced field. principalName remains a
// local compatibility alias for profiles created before this field existed.
function profilePrincipalName(profile) {
  const canonical = String(profile?.reportPrincipalName ?? '').trim();
  return canonical || String(profile?.principalName ?? '').trim();
}

function remoteProfileToLocal(remote, updatedAt) {
  const principal = String(remote.report_principal_name ?? '').trim();
  return {
    teacherName: remote.teacher_name,
    schoolName: remote.school_name,
    phone: remote.phone,
    teacherForm: remote.teacher_form === 'feminine' ? 'feminine' : 'masculine',
    reportPrincipalName: principal,
    principalName: principal,
    updatedAt,
    deleted: !!remote.deleted_at,
  };
}

/**
 * Phase 5A: Profile Sync only.
 * Sync direction: Pull → Merge → Push.
 */
export async function syncProfile() {
  assertCloudOwnership('pull');
  return syncV2Category('profile');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping sync.');
    return;
  }
  if (state.status === 'syncing') return;

  setState({ status: 'syncing', results: { ...state.results, profile: null } });
  console.log('[rakeezx sync] Started Profile sync...');

  try {
    const remote = await cloud.fetchProfile();
    const local = store.state.profile;

    const localUpdatedAt = normalizeTimestamp(local?.updatedAt);
    const remoteClientUpdatedAt = normalizeTimestamp(remote?.client_updated_at);

    let shouldPush = false;
    let shouldUpdateLocal = false;
    let merged = null;

    if (!remote) {
      if (hasMeaningfulProfile(local)) {
        console.log('[rakeezx sync] No remote profile. Local has meaningful data. Local wins.');
        shouldPush = true;
        merged = local;
      } else {
        console.log('[rakeezx sync] Both remote and local are empty/default. No-op.');
      }
    } else {
      if (!hasMeaningfulProfile(local)) {
        console.log('[rakeezx sync] Local is empty/default. Remote wins.');
        shouldUpdateLocal = true;
        merged = remoteProfileToLocal(remote, remoteClientUpdatedAt);
      } else if (localUpdatedAt > remoteClientUpdatedAt) {
        console.log('[rakeezx sync] Local is strictly newer. Local wins.');
        shouldPush = true;
        merged = local;
      } else if (remoteClientUpdatedAt > localUpdatedAt) {
        console.log('[rakeezx sync] Remote is strictly newer. Remote wins.');
        shouldUpdateLocal = true;
        merged = remoteProfileToLocal(remote, remoteClientUpdatedAt);
      } else {
        console.log('[rakeezx sync] Timestamps are exactly equal. Perfect sync, no action.');
      }
    }

    if (shouldPush && merged) {
      console.log('[rakeezx sync] Pushing to cloud...');
      const payload = {
        teacher_name: merged.teacherName || '',
        school_name: merged.schoolName || '',
        phone: merged.phone || '',
        teacher_form: merged.teacherForm === 'feminine' ? 'feminine' : 'masculine',
        report_principal_name: profilePrincipalName(merged),
        client_updated_at: merged.updatedAt,
        device_id: getDeviceId()
      };

      if (!remote) {
        await cloud.insertProfile(payload);
      } else {
        await cloud.updateProfile(payload);
      }
    }

    if (shouldUpdateLocal && merged) {
      console.log('[rakeezx sync] Updating local store...');
      await store.patchProfile({
        teacherName: merged.teacherName,
        schoolName: merged.schoolName,
        phone: merged.phone,
        teacherForm: merged.teacherForm === 'feminine' ? 'feminine' : 'masculine',
        reportPrincipalName: merged.reportPrincipalName,
        principalName: merged.principalName,
        updatedAt: merged.updatedAt,
        deleted: merged.deleted
      }, { preserveTimestamp: true, queue: false });
    }

    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        profile: { status: 'success', time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Profile sync complete.');

  } catch (err) {
    console.warn('[rakeezx sync] Profile sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        profile: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

/**
 * Maps local models to/from Supabase payload structures
 */
const MAPPERS = {
  years: {
    toCloud: (rec) => ({
      id: rec.id,
      label: rec.label,
      hijri_start: rec.hijriStart,
      hijri_end: rec.hijriEnd,
      order: rec.order,
      status: rec.status,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      label: rec.label,
      hijriStart: rec.hijri_start,
      hijriEnd: rec.hijri_end,
      order: rec.order,
      status: rec.status,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  calendars: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      source: calendarSourceForCloud(rec.source),
      label: rec.label,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      source: calendarSourceFromCloud(rec),
      label: rec.label,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  calendarDays: {
    toCloud: (rec) => ({
      id: rec.id,
      calendar_id: rec.calendarId,
      date: rec.date,
      kind: rec.kind,
      label: rec.label,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      calendarId: rec.calendar_id,
      date: rec.date,
      kind: rec.kind,
      label: rec.label,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  terms: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      name: rec.name,
      index: rec.index,
      start_date: rec.startDate,
      end_date: rec.endDate,
      status: rec.status,
      calendar_id: rec.calendarId,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      name: rec.name,
      index: rec.index,
      startDate: rec.start_date,
      endDate: rec.end_date,
      status: rec.status,
      calendarId: rec.calendar_id,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  subjects: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      slug: rec.slug,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      slug: rec.slug,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  sections: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      grade: rec.grade,
      label: rec.label,
      name: rec.name,
      color: rec.color,
      order: rec.order,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      grade: rec.grade,
      label: rec.label,
      name: rec.name,
      color: rec.color,
      order: rec.order,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  teachings: {
    toCloud: (rec) => ({
      id: rec.id,
      section_id: rec.sectionId,
      subject_id: rec.subjectId,
      term_id: rec.termId,
      order: rec.order,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      sectionId: rec.section_id,
      subjectId: rec.subject_id,
      termId: rec.term_id,
      order: rec.order,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  students: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      note: rec.note,
      status: rec.status,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      note: rec.note,
      status: rec.status,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  enrollments: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      section_id: rec.sectionId,
      roll_no: rec.rollNo,
      start_date: rec.startDate,
      end_date: rec.endDate,
      status: rec.status,
      transfer_note: rec.transferNote,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      sectionId: rec.section_id,
      rollNo: rec.roll_no,
      startDate: rec.start_date,
      endDate: rec.end_date,
      status: rec.status,
      transferNote: rec.transfer_note,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  items: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      name: rec.name,
      max: rec.max,
      order: rec.order,
      auto: rec.auto,
      per_point: rec.perPoint,
      penalty: rec.penalty,
      unit_id: rec.unitId,
      lesson_id: rec.lessonId,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      name: rec.name,
      max: rec.max,
      order: rec.order,
      auto: rec.auto,
      perPoint: rec.per_point,
      penalty: rec.penalty,
      unitId: rec.unit_id,
      lessonId: rec.lesson_id,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  logs: {
    toCloud: (rec) => ({ id:rec.id, student_id:rec.studentId, teaching_id:rec.teachingId, session_id:rec.sessionId || null, date:rec.date, kind:rec.kind, delta:rec.delta, tag:rec.tag || '', note:rec.note || '', deleted_at:rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null, client_updated_at:rec.updatedAt, device_id:getDeviceId() }),
    fromCloud: (rec) => ({ id:rec.id, studentId:rec.student_id, teachingId:rec.teaching_id, sessionId:rec.session_id || null, date:rec.date, kind:rec.kind, delta:rec.delta, tag:rec.tag || '', note:rec.note || '', updatedAt:normalizeTimestamp(rec.client_updated_at), deleted:!!rec.deleted_at, deletedAt:rec.deleted_at || undefined })
  },
  scores: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      item_id: rec.itemId,
      value: rec.value,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      itemId: rec.item_id,
      value: rec.value,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  timeProfiles: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      order: rec.order,
      periods: rec.periods,
      overrides: rec.overrides,
      active_from: rec.activeFrom,
      active_to: rec.activeTo,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      order: rec.order,
      periods: rec.periods,
      overrides: rec.overrides,
      activeFrom: rec.active_from,
      activeTo: rec.active_to,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  slots: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      kind: rec.kind ?? 'teaching',
      term_id: rec.termId ?? null,
      weekday: rec.weekday,
      period: rec.period,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      kind: rec.kind ?? 'teaching',
      termId: rec.term_id ?? null,
      weekday: rec.weekday,
      period: rec.period,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  sessions: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      date: rec.date,
      period: rec.period,
      slot_id: rec.slotId,
      start_time: rec.startTime || null,
      end_time: rec.endTime || null,
      time_profile_id: rec.timeProfileId,
      status: rec.status,
      reason: rec.reason,
      makeup_for_id: rec.makeupForId,
      lesson_id: rec.lessonId,
      note: rec.note,
      homework: rec.homework,
      covered: rec.covered,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      date: rec.date,
      period: rec.period,
      slotId: rec.slot_id,
      startTime: rec.start_time || '',
      endTime: rec.end_time || '',
      timeProfileId: rec.time_profile_id,
      status: rec.status,
      reason: rec.reason,
      makeupForId: rec.makeup_for_id,
      lessonId: rec.lesson_id,
      note: rec.note,
      homework: rec.homework,
      covered: rec.covered,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  sessionRosterSnapshots: {
    toCloud: (rec) => ({
      id: rec.id,
      session_id: rec.sessionId,
      teaching_id: rec.teachingId,
      section_id: rec.sectionId,
      captured_at: new Date(rec.capturedAt).toISOString(),
      members: rec.members,
      state: rec.state,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId(),
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      sessionId: rec.session_id,
      teachingId: rec.teaching_id,
      sectionId: rec.section_id,
      capturedAt: normalizeTimestamp(rec.captured_at || rec.client_updated_at),
      members: Array.isArray(rec.members) ? rec.members : [],
      state: rec.state,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined,
    }),
  },
  notes: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      teaching_id: rec.teachingId || null,
      session_id: rec.sessionId || null,
      date: rec.date,
      kind: rec.kind || 'general',
      text: rec.text,
      created_at: new Date(rec.createdAt ?? rec.updatedAt).toISOString(),
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      teachingId: rec.teaching_id || null,
      sessionId: rec.session_id || null,
      date: rec.date,
      kind: rec.kind || 'general',
      text: rec.text,
      createdAt: normalizeTimestamp(rec.created_at || rec.client_updated_at),
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  attendance: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      session_id: rec.sessionId,
      teaching_id: rec.teachingId,
      date: rec.date,
      status: rec.status,
      note: rec.note,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      sessionId: rec.session_id,
      teachingId: rec.teaching_id,
      date: rec.date,
      status: rec.status,
      note: rec.note,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  }
};

/**
 * Checks if a structural record is an unmodified, auto-generated boot default.
 */
function isMeaningfulStructural(storeName, rec) {
  if (storeName === 'years') {
    return !(rec.hijriStart === 1448 && rec.label === '1448-1449' && rec.status === 'active');
  }
  if (storeName === 'terms') {
    const isDefaultName = rec.name === `الفصل الدراسي ${['', 'الأول', 'الثاني', 'الثالث'][rec.index] ?? rec.index}`;
    return !(isDefaultName && !rec.startDate && !rec.endDate && (rec.status === 'active' || rec.status === 'upcoming'));
  }
  if (storeName === 'subjects') {
    return !(rec.name === 'المهارات الرقمية' && rec.slug === 'digital-skills');
  }
  if (storeName === 'timeProfiles') {
    return !DEFAULT_TIME_PROFILES.some(p => p.name === rec.name);
  }
  return true; // sections do not have auto-generated defaults
}

/**
 * Scans local structural data to find parent records (like default years)
 * that must be pushed because user-created children depend on them.
 */
function buildLocalDependencies(state) {
  const req = { years: new Set(), calendars: new Set(), calendarDays: new Set(), terms: new Set(), subjects: new Set(), sections: new Set(), teachings: new Set(), timeProfiles: new Set(), slots: new Set() };

  for (const sec of state.sections || []) {
    if (sec.yearId && isMeaningfulStructural('sections', sec)) {
      req.years.add(sec.yearId);
    }
  }
  for (const calendar of state.calendars || []) {
    if (calendar.yearId && isMeaningfulStructural('calendars', calendar)) {
      req.years.add(calendar.yearId);
    }
  }
  for (const term of state.terms || []) {
    if (term.yearId && isMeaningfulStructural('terms', term)) {
      req.years.add(term.yearId);
    }
    if (term.calendarId && isMeaningfulStructural('terms', term)) {
      req.calendars.add(term.calendarId);
    }
  }
  for (const day of state.calendarDays || []) {
    if (day.calendarId && isMeaningfulStructural('calendarDays', day)) {
      req.calendars.add(day.calendarId);
    }
  }
  for (const tch of state.teachings || []) {
    if (!tch.deleted) {
      if (tch.sectionId) req.sections.add(tch.sectionId);
      if (tch.subjectId) req.subjects.add(tch.subjectId);
      if (tch.termId) req.terms.add(tch.termId);
    }
  }
  for (const sl of state.slots || []) {
    if (!sl.deleted) {
      if (sl.teachingId) req.teachings.add(sl.teachingId);
      if (sl.timeProfileId) req.timeProfiles.add(sl.timeProfileId);
    }
  }
  for (const ses of state.sessions || []) {
    if (!ses.deleted) {
      if (ses.teachingId) req.teachings.add(ses.teachingId);
      if (ses.slotId) req.slots.add(ses.slotId);
      if (ses.timeProfileId) req.timeProfiles.add(ses.timeProfileId);
    }
  }
  for (const att of state.attendance || []) {
    if (!att.deleted) {
      if (att.teachingId) req.teachings.add(att.teachingId);
    }
  }

  return req;
}

const sameSectionIdentity = (local, remote) => local.yearId === remote.year_id &&
  String(local.grade) === String(remote.grade) &&
  normalizeSectionLabel(local.label) === normalizeSectionLabel(remote.label);

export function sectionKeyMatches(local, records) {
  const matches = records.filter((remote) => sameSectionIdentity(local, remote));
  return { matches, active: matches.filter((remote) => remote.deleted_at === null) };
}

function sectionReconciliationError(code, retryable, sectionId, candidateIds = []) {
  const message = code === 'SECTION_NATURAL_KEY_BLOCKED_BY_TOMBSTONE'
    ? 'هوية الفصل محجوزة بسجل محذوف سحابياً. لم تُغيّر بياناتك، وأُوقفت إعادة المحاولة التلقائية.'
    : retryable
    ? 'تعذر التحقق الآمن من هوية الفصل. أعد محاولة المزامنة.'
    : 'توجد هويات سحابية متعددة للفصل نفسه. لم يتم دمجها أو حذفها.';
  return Object.assign(new Error(`${code}: ${message}`), { code, retryable, sectionId, candidateIds });
}

/**
 * The owner-scoped broad fetch discovers positive candidates ONLY. Its limited
 * result cannot prove absence: both technical IDs are checked independently.
 * Validate all candidates before any section mutation or upload is prepared.
 */
async function reconcileSections(remoteRecords, sectionIds = null) {
  const ownerId = cloud.user?.id;
  const locals = (await db.getAll('sections')).filter((record) => !record.deleted && !store.isLocalOnlyRecord(record) &&
    (!sectionIds || sectionIds.has(record.id)));
  const plans = [];
  for (const local of locals) {
    const candidates = sectionKeyMatches(local, remoteRecords).active;
    if (candidates.length > 1) {
      throw sectionReconciliationError('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', false,
        local.id, candidates.map((record) => record.id));
    }
    const candidate = candidates[0];
    if (!candidate || candidate.id === local.id) continue;

    const [a, b] = await Promise.all([
      cloud.fetchSectionPresence(local.id), cloud.fetchSectionPresence(candidate.id),
    ]);
    const fail = (code, retryable = true) => sectionReconciliationError(code, retryable, local.id, [candidate.id]);
    if (!cloud.session || cloud.user?.id !== ownerId || !a.authoritative || !b.authoritative ||
        !['present', 'absent'].includes(a.status) || !['present', 'absent'].includes(b.status)) {
      throw fail('SECTION_IDENTITY_PRESENCE_UNKNOWN');
    }
    if (a.status === 'present' && b.status === 'present') {
      throw fail('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', false);
    }
    if (a.status !== 'absent' || b.status !== 'present' || b.row?.id !== candidate.id ||
        b.row.owner_id !== ownerId || b.row.deleted_at !== null || !sameSectionIdentity(local, b.row)) {
      throw fail('SECTION_IDENTITY_CANDIDATE_CHANGED');
    }
    // Presence selects identity/deletion fields only. Keep full section metadata
    // from discovery, overlay freshly verified identity, then use the real mapper.
    plans.push({ local, candidate, canonical: { ...candidate, ...b.row } });
  }

  for (const { local, candidate, canonical } of plans) {
    const current = await db.get('sections', local.id);
    if (!cloud.session || cloud.user?.id !== ownerId || !current || current.deleted || !sameSectionIdentity(current, canonical)) {
      throw sectionReconciliationError('SECTION_IDENTITY_LOCAL_CHANGED', true, local.id, [candidate.id]);
    }
    const result = await store.rekeyLocalSectionIdentity({
      fromSectionId: local.id, canonicalSection: MAPPERS.sections.fromCloud(canonical),
      expectedSource: { yearId: current.yearId, grade: current.grade, label: current.label,
        deleted: current.deleted, updatedAt: current.updatedAt },
    });
    if (result.status === 'source-changed') {
      throw sectionReconciliationError('SECTION_IDENTITY_LOCAL_CHANGED', true, local.id, [candidate.id]);
    }
    if (!result.ok) throw sectionReconciliationError('SECTION_IDENTITY_REKEY_FAILED', true, local.id, [candidate.id]);
    // The rekey helper refreshes local memory after commit. Replace the stale
    // discovery row too, before the normal merge constructs either ID map.
    remoteRecords[remoteRecords.findIndex((record) => record.id === candidate.id)] = canonical;
  }
  return plans.map(({ local, canonical }) => ({ fromSectionId: local.id, canonical }));
}

/** One recovery pass for a failed atomic section POST, never for other tables. */
async function recoverSectionWriteConflict(payloads, originalError) {
  const scopes = new Map();
  const candidates = new Map();
  const sectionIds = new Set();
  try {
    for (const payload of payloads) {
      if (payload.deleted_at) continue;
      const local = await db.get('sections', payload.id);
      if (!local || local.deleted || !sameSectionIdentity(local, payload) || local.updatedAt !== payload.client_updated_at) {
        throw sectionReconciliationError('SECTION_IDENTITY_LOCAL_CHANGED', true, payload.id);
      }
      const scope = JSON.stringify([local.yearId, local.grade]);
      if (!scopes.has(scope)) scopes.set(scope, await cloud.fetchSectionCandidates({ yearId: local.yearId, grade: local.grade }));
      const result = scopes.get(scope);
      if (!result.authoritative) {
        const error = sectionReconciliationError('SECTION_IDENTITY_CANDIDATE_LOOKUP_INCOMPLETE', true, local.id);
        error.recovery = { reason: result.status };
        throw error;
      }
      const { matches, active } = sectionKeyMatches(local, result.rows);
      if (active.length > 1) {
        throw sectionReconciliationError('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', false,
          local.id, active.map((row) => row.id));
      }
      if (!active.length && matches.length) {
        throw sectionReconciliationError('SECTION_NATURAL_KEY_BLOCKED_BY_TOMBSTONE', false,
          local.id, matches.map((row) => row.id));
      }
      if (active.length === 1 && active[0].id !== local.id) {
        sectionIds.add(local.id);
        candidates.set(active[0].id, active[0]);
      }
    }
    if (!sectionIds.size) {
      // SQLSTATE alone is not evidence of natural identity. Keep the actual
      // database error when the scoped lookup does not verify a candidate.
      originalError.recovery = { reason: 'no-verified-natural-match', sectionIds: payloads.map((row) => row.id) };
      throw originalError;
    }
    // Reuse the locked exact A/B verification, mapper, and atomic rekey path.
    const adopted = await reconcileSections([...candidates.values()], sectionIds);
    if (adopted.length !== sectionIds.size) {
      throw sectionReconciliationError('SECTION_IDENTITY_LOCAL_CHANGED', true, [...sectionIds][0]);
    }
    return adopted;
  } catch (error) {
    if (error !== originalError) error.cause = originalError;
    throw error;
  }
}

/** Pristine teaching convergence only. Never rekey student/history records. */
async function reconcilePristineTeachings(remoteRecords) {
  const ownerId = cloud.user?.id;
  const token = cloud.session?.access_token;
  const sameKey = (local, remote) => local.sectionId === remote.section_id &&
    local.subjectId === remote.subject_id && local.termId === remote.term_id;
  const fail = (code, local, candidateIds, reason) => Object.assign(new Error(
    `${code}: تعذر توحيد هوية الفصل بأمان. حُفظت بياناتك؛ يلزم التحقق قبل إعادة المحاولة.`),
    { code, retryable: false, teachingId: local.id, candidateIds,
      recovery: { reason, fromTeachingId: local.id, candidateIds } });
  const locals = (await db.getAll('teachings')).filter((row) => !row.deleted && !store.isLocalOnlyRecord(row));
  for (const local of locals) {
    const matches = remoteRecords.filter((row) => sameKey(local, row));
    if (!matches.some((row) => row.id !== local.id)) continue;
    if (matches.length !== 1) throw fail('TEACHING_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', local,
      matches.map((row) => row.id), 'multiple-natural-candidates');
    const candidate = matches[0];
    const [a, b] = await Promise.all([cloud.fetchTeachingPresence(local.id), cloud.fetchTeachingPresence(candidate.id)]);
    const evidenceCurrent = () => !!token && cloud.user?.id === ownerId && cloud.session?.access_token === token;
    if (!evidenceCurrent() || !a.authoritative || !b.authoritative) {
      throw fail('TEACHING_IDENTITY_PRESENCE_UNKNOWN', local, [candidate.id], 'exact-presence-unavailable');
    }
    if (a.status === 'present' && b.status === 'present') {
      throw fail('TEACHING_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', local, [candidate.id], 'both-remotely-present');
    }
    if (a.status !== 'absent' || b.status !== 'present' || b.row?.deleted_at !== null ||
        b.row.id !== candidate.id || b.row.owner_id !== ownerId || !sameKey(local, b.row)) {
      throw fail('TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION', local, [candidate.id], 'canonical-not-active-or-changed');
    }
    const canonical = { ...candidate, ...b.row };
    const result = await store.adoptPristineTeachingIdentity({ fromTeachingId: local.id,
      canonicalTeaching: MAPPERS.teachings.fromCloud(canonical), expectedSource: local, validateEvidence: evidenceCurrent });
    if (!result.ok) {
      const error = fail(result.code, local, [candidate.id], result.reason);
      if (result.code === 'TEACHING_IDENTITY_ADOPTION_WRITE_FAILED') error.retryable = true;
      throw error;
    }
    remoteRecords[remoteRecords.findIndex((row) => row.id === candidate.id)] = canonical;
  }
}

function postgresDiagnostic(error) {
  const original = error.code === '23505' ? error : error.cause;
  if (original?.code !== '23505') return {};
  return { databaseError: Object.fromEntries(['message', 'code', 'status', 'details', 'hint', 'constraint']
    .filter((key) => original[key] !== undefined).map((key) => [key, original[key]])) };
}

/**
 * Enrollment-operation receipts are written atomically with their local rows.
 * Drain them before generic enrollment merge so PostgREST never receives a
 * transient active-roll collision as ordinary upserts.
 *
 * A locally tombstoned side deliberately skips its older receipt: deletion is
 * authoritative locally and must never be undone by replaying a transfer.
 */
async function syncEnrollmentOperations() {
  const entries = (await db.getAll('outbox'))
    .filter((entry) => entry.store === 'enrollments' && entry.enrollmentOperation)
    .sort((a, b) => (a.enrollmentOperation.order ?? a.queuedAt ?? a.updatedAt ?? 0) -
      (b.enrollmentOperation.order ?? b.queuedAt ?? b.updatedAt ?? 0) || a.id.localeCompare(b.id));

  for (const entry of entries) {
    const operation = entry.enrollmentOperation;
    if (!operation?.type) continue;

    if (operation.type === 'transfer-renumber') {
      const currentById = new Map(store.state.enrollments.map((row) => [row.id, row]));
      const planned = [operation.source, operation.destination,
        ...(operation.sourceRoster ?? []), ...(operation.destinationRoster ?? [])];
      if (planned.some((row) => !row || !currentById.get(row.id) || currentById.get(row.id).deleted)) continue;
      await cloud.commitEnrollmentTransferAndRenumber({
        source: MAPPERS.enrollments.toCloud(operation.source),
        destination: MAPPERS.enrollments.toCloud(operation.destination),
        sourceRoster: operation.sourceRoster.map((row) => MAPPERS.enrollments.toCloud(row)),
        destinationRoster: operation.destinationRoster.map((row) => MAPPERS.enrollments.toCloud(row)),
      });
      continue;
    }

    if (operation.type === 'transfer') {
      const sourceCurrent = store.state.enrollments.find((row) => row.id === operation.source?.id);
      const destinationCurrent = store.state.enrollments.find((row) => row.id === operation.destination?.id);
      if (!sourceCurrent || !destinationCurrent || sourceCurrent.deleted || destinationCurrent.deleted) continue;
      await cloud.commitEnrollmentTransfer({
        source: MAPPERS.enrollments.toCloud(operation.source),
        destination: MAPPERS.enrollments.toCloud(operation.destination),
      });
      continue;
    }

    if (operation.type === 'renumber') {
      const currentById = new Map(store.state.enrollments.map((row) => [row.id, row]));
      if (operation.roster?.some((row) => !currentById.get(row.id) || currentById.get(row.id).deleted)) continue;
      await cloud.renumberEnrollmentRoster({
        sectionId: operation.sectionId,
        roster: operation.roster.map((row) => MAPPERS.enrollments.toCloud(row)),
      });
      continue;
    }

    throw new Error(`Unknown enrollment operation: ${operation.type}`);
  }
}

/**
 * Generic sync engine for a single collection.
 * Pull → Merge → Push
 */
async function syncCollection(storeName, tableName, context = { requiredIds: new Set(), knownRemoteIds: {} }) {
  const mapper = MAPPERS[storeName];
  if (!mapper) throw new Error(`No mapper for ${storeName}`);

  const remoteRecords = (await cloud.fetchRecords(tableName)).filter((record) => !store.isLocalOnlyRecord(record));
  if (storeName === 'sections') await reconcileSections(remoteRecords);
  if (storeName === 'teachings') await reconcilePristineTeachings(remoteRecords);
  // A peer can commit pristine retirement before its BroadcastChannel message
  // arrives here. Never upload abandoned teaching/default IDs from stale memory.
  const localSnapshot = ['teachings', 'items'].includes(storeName)
    ? await db.getAll(storeName) : (store.state[storeName] || []);
  const localRecords = localSnapshot.filter((record) => !store.isLocalOnlyRecord(record));

  const remoteById = new Map(remoteRecords.map(r => [r.id, r]));
  const localById = new Map(localRecords.map(r => [r.id, r]));

  const allIds = new Set([...remoteById.keys(), ...localById.keys()]);

  const toPush = [];
  const toUpdateLocal = [];

  for (const id of allIds) {
    const remote = remoteById.get(id);
    const local = localById.get(id);

    if (!remote) {
      // Remote does not exist.
      // We push if the local record is meaningful OR if it is explicitly required by a child.
      if (isMeaningfulStructural(storeName, local) || context.requiredIds.has(local.id)) {
        toPush.push(mapper.toCloud(local));
      }
    } else if (!local) {
      // Local does not exist, so it was created on another device.
      // We pull it down.
      toUpdateLocal.push(mapper.fromCloud(remote));
    } else {
      // Both exist. Compare timestamps.
      const remoteClientUpdatedAt = normalizeTimestamp(remote.client_updated_at);
      const localUpdatedAt = normalizeTimestamp(local.updatedAt);
      const isStructural = storeName === 'years' || storeName === 'terms' || storeName === 'subjects';

      if (localUpdatedAt === remoteClientUpdatedAt) {
        // Converged, do nothing.
      } else if (isStructural && !isMeaningfulStructural(storeName, local) && localUpdatedAt > remoteClientUpdatedAt) {
        // Local is a generated default, and remote already has this exact ID.
        // Even though local is strictly newer (due to being freshly generated),
        // remote must be authoritative for this sync cycle. Hydrate local.
        toUpdateLocal.push(mapper.fromCloud(remote));
      } else if (localUpdatedAt > remoteClientUpdatedAt) {
        // Local is strictly newer.
        toPush.push(mapper.toCloud(local));
      } else if (remoteClientUpdatedAt > localUpdatedAt) {
        // Remote is strictly newer.
        toUpdateLocal.push(mapper.fromCloud(remote));
      }
    }
  }

  // -- RECONCILIATION OF FRESH-DEVICE DEFAULTS --
  // For years, terms, subjects: if a local record is an unmodified auto-generated default,
  // we check if a logically equivalent record exists remotely. If yes, we adopt the remote ID
  // locally to prevent duplicates and scoping bugs on fresh devices.
  const remappedLocals = new Map(); // oldId -> newId

  // Deterministically sort remote records to always pick the oldest (original) default if duplicates exist
  const sortedRemotes = [...remoteRecords].sort((a, b) => {
    const timeA = new Date(a.created_at || a.client_updated_at).getTime();
    const timeB = new Date(b.created_at || b.client_updated_at).getTime();
    return timeA - timeB;
  });

  if (storeName === 'years') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('years', local)) {
        const equiv = sortedRemotes.find(r => r.hijri_start === local.hijriStart);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'terms') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('terms', local)) {
        const equiv = sortedRemotes.find(r => r.year_id === local.yearId && r.index === local.index);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'subjects') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('subjects', local)) {
        const equiv = sortedRemotes.find(r => r.slug === local.slug);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'timeProfiles') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('timeProfiles', local)) {
        const equiv = sortedRemotes.find(r => r.name === local.name);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  }

  if (remappedLocals.size > 0) {
    console.log(`[rakeezx sync] Remapping ${storeName} identities:`, remappedLocals);

    // Centralized Reference-Remap Helper to guarantee full coverage without partial hardcoding
    const buildCascadePatch = (oldId, newId, entityType) => {
      const p = {};
      const updateStore = (sName, fkField) => {
        for (const rec of store.state[sName] || []) {
          if (rec[fkField] === oldId) {
            p[sName] ??= [];
            p[sName].push({ ...rec, [fkField]: newId });
          }
        }
      };

      if (entityType === 'years') {
        if (store.state.device?.activeYearId === oldId) p.device = { ...store.state.device, activeYearId: newId };
        updateStore('terms', 'yearId');
        updateStore('sections', 'yearId');
        updateStore('calendars', 'yearId');
      } else if (entityType === 'terms') {
        if (store.state.device?.activeTermId === oldId) p.device = { ...store.state.device, activeTermId: newId };
        updateStore('teachings', 'termId');
      } else if (entityType === 'subjects') {
        updateStore('teachings', 'subjectId');
        updateStore('units', 'subjectId');
      } else if (entityType === 'sections') {
        // Provided for completeness, though sections are not currently reconciled
        updateStore('teachings', 'sectionId');
        updateStore('enrollments', 'sectionId');
      } else if (entityType === 'timeProfiles') {
        if (store.state.device?.activeTimeProfileId === oldId) p.device = { ...store.state.device, activeTimeProfileId: newId };
        updateStore('sessions', 'timeProfileId');
      }
      return p;
    };

    const patch = { [storeName]: [] };
    const devicePatch = {};

    // 1. Rewrite local identities in memory arrays/maps and hydrate from remote
    for (const [oldId, newId] of remappedLocals.entries()) {
      const lRec = localById.get(oldId);
      const remoteEquiv = remoteRecords.find(r => r.id === newId);

      // Hydrate local record with remote canonical values
      const hydrated = {
        ...lRec,
        ...mapper.fromCloud(remoteEquiv),
        id: newId
      };

      localById.delete(oldId);
      localById.set(newId, hydrated);
      allIds.delete(oldId);
      allIds.add(newId);

      // 2. Cascade changes to dependent local state
      const cascade = buildCascadePatch(oldId, newId, storeName);
      if (cascade.device) Object.assign(devicePatch, cascade.device);
      for (const sName of Object.keys(cascade)) {
        if (sName === 'device') continue;
        patch[sName] ??= [];
        for (const mod of cascade[sName]) {
          const idx = patch[sName].findIndex(r => r.id === mod.id);
          if (idx !== -1) patch[sName][idx] = { ...patch[sName][idx], ...mod };
          else patch[sName].push(mod);
        }
      }

      // Mark the old local identity as deleted without discarding its model.
      // fields. IndexedDB put replaces a record, so an id-only tombstone
      // would persist a malformed time profile (including no name) and can
      // later be retried as an invalid cloud payload after a reload.
      patch[storeName].push({ ...lRec, id: oldId, deleted: true, deletedAt: new Date().toISOString(), updatedAt: Date.now() });
      patch[storeName].push(hydrated);

      // Prevent it from being pushed under the old ID if it somehow got queued
      const pushIdx = toPush.findIndex(p => p.id === oldId);
      if (pushIdx !== -1) toPush.splice(pushIdx, 1);

      // Since we just adopted the remote record's exact timestamp and identity,
      // we must NOT push it back as a local edit. It is fully converged.
      // Remove it from any toPush that might have queued it under newId.
      const newPushIdx = toPush.findIndex(p => p.id === newId);
      if (newPushIdx !== -1) toPush.splice(newPushIdx, 1);
    }

      if (Object.keys(devicePatch).length > 0) {
        const ok = await store.patchDevice({ ...store.state.device, ...devicePatch });
        if (!ok) throw new Error(`${storeName} defaults: device persistence failed`);
      }
      const ok2 = await store.save(patch, { queue: false });
      if (!ok2) throw new Error(`${storeName} defaults: local persistence failed`);
  }

  // Dependency validation before push
  if (storeName === 'calendars' || storeName === 'terms' || storeName === 'sections') {
    for (const p of toPush) {
      if (p.year_id && !context.knownRemoteIds?.years?.has(p.year_id)) {
        throw new Error(`${storeName}: missing remote year ${p.year_id}`);
      }
      if (storeName === 'terms' && p.calendar_id && !context.knownRemoteIds?.calendars?.has(p.calendar_id)) {
        throw new Error(`terms: missing remote calendar ${p.calendar_id}`);
      }
    }
  }
  if (storeName === 'calendarDays') {
    for (const p of toPush) {
      if (p.calendar_id && !context.knownRemoteIds?.calendars?.has(p.calendar_id)) {
        throw new Error(`calendarDays: missing remote calendar ${p.calendar_id}`);
      }
    }
  }
  if (storeName === 'teachings') {
    for (const p of toPush) {
      if (p.section_id && !context.knownRemoteIds?.sections?.has(p.section_id)) {
        throw new Error(`${storeName}: missing remote section ${p.section_id}`);
      }
      if (p.subject_id && !context.knownRemoteIds?.subjects?.has(p.subject_id)) {
        throw new Error(`${storeName}: missing remote subject ${p.subject_id}`);
      }
      if (p.term_id && !context.knownRemoteIds?.terms?.has(p.term_id)) {
        throw new Error(`${storeName}: missing remote term ${p.term_id}`);
      }
    }
  }

  if (storeName === 'enrollments') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.section_id && !context.knownRemoteIds?.sections?.has(p.section_id)) {
        throw new Error(`${storeName}: missing remote section ${p.section_id}`);
      }
    }
  }

  if (storeName === 'items') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (storeName === 'scores') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.item_id && !context.knownRemoteIds?.items?.has(p.item_id)) {
        throw new Error(`${storeName}: missing remote item ${p.item_id}`);
      }
    }
  }

  if (storeName === 'slots') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (storeName === 'sessions') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
      if (p.slot_id && !context.knownRemoteIds?.slots?.has(p.slot_id)) {
        throw new Error(`${storeName}: missing remote slot ${p.slot_id}`);
      }
      if (p.time_profile_id && !context.knownRemoteIds?.timeProfiles?.has(p.time_profile_id)) {
        throw new Error(`${storeName}: missing remote timeProfile ${p.time_profile_id}`);
      }
    }

    const toPushMap = new Map(toPush.map(p => [p.id, p]));
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(p) {
      if (visited.has(p.id)) return;
      if (visiting.has(p.id)) {
        throw new Error(`sessions: cycle detected in makeup_for_id dependency for ${p.id}`);
      }
      visiting.add(p.id);

      if (p.makeup_for_id && !remoteById.has(p.makeup_for_id)) {
        const parent = toPushMap.get(p.makeup_for_id);
        if (!parent) {
          throw new Error(`sessions: missing makeup parent ${p.makeup_for_id}`);
        }
        visit(parent);
      }

      visiting.delete(p.id);
      visited.add(p.id);
      sorted.push(p);
    }

    // Base sort for stable ordering before dependency resolution
    toPush.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.period - b.period));

    for (const p of toPush) {
      visit(p);
    }

    toPush.length = 0;
    toPush.push(...sorted);
  }

  if (storeName === 'sessionRosterSnapshots') {
    for (const p of toPush) {
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) {
        throw new Error(`${storeName}: missing remote session ${p.session_id}`);
      }
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (storeName === 'notes') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) {
        throw new Error(`${storeName}: missing remote session ${p.session_id}`);
      }
    }
  }

  if (storeName === 'logs') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) throw new Error(String(storeName) + ': missing remote student ' + p.student_id);
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) throw new Error(String(storeName) + ': missing remote teaching ' + p.teaching_id);
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) throw new Error(String(storeName) + ': missing remote session ' + p.session_id);
    }
  }

  if (storeName === 'attendance') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) {
        throw new Error(`${storeName}: missing remote session ${p.session_id}`);
      }
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (toPush.length > 0) {
    try {
      await cloud.upsertRecords(tableName, toPush);
    } catch (error) {
      if (storeName !== 'sections' || tableName !== 'sections' || error.code !== '23505') throw error;
      const adopted = await recoverSectionWriteConflict(toPush, error);
      const retiredIds = new Set(adopted.map((entry) => entry.fromSectionId));
      const canonicalIds = new Set(adopted.map((entry) => entry.canonical.id));
      for (const { canonical } of adopted) remoteById.set(canonical.id, canonical);
      // The failed POST is atomic: unrelated rows in that batch still need
      // uploading. Rebuild them from disk once; NEVER retry an abandoned A.
      const remainingIds = toPush.map((row) => row.id).filter((id) => !retiredIds.has(id) && !canonicalIds.has(id));
      toPush.length = 0;
      for (const id of remainingIds) {
        const current = await db.get('sections', id);
        if (!current) throw sectionReconciliationError('SECTION_IDENTITY_LOCAL_CHANGED', true, id);
        if (current.yearId && !context.knownRemoteIds?.years?.has(current.yearId)) {
          throw new Error(`sections: missing remote year ${current.yearId}`);
        }
        toPush.push(mapper.toCloud(current));
      }
      // A previously queued broad-fetch pull must not overwrite verified B.
      for (let index = toUpdateLocal.length - 1; index >= 0; index--) {
        if (retiredIds.has(toUpdateLocal[index].id) || canonicalIds.has(toUpdateLocal[index].id)) toUpdateLocal.splice(index, 1);
      }
      // Explicit bound: a second failed write escapes directly, without another
      // candidate lookup/recovery in this collection attempt.
      if (toPush.length) await cloud.upsertRecords(tableName, toPush);
    }
  }

  if (toUpdateLocal.length > 0) {
    const ok = await store.save({ [storeName]: toUpdateLocal }, { queue: false });
    if (!ok) throw new Error(`${storeName}: local persistence failed`);
  }

  if (remappedLocals.size > 0) {
    const buildCascadePatch = (oldId, newId, entityType) => {
      const p = {};
      const updateStore = (sName, fkField) => {
        for (const rec of store.state[sName] || []) {
          if (rec[fkField] === oldId) {
            p[sName] ??= [];
            p[sName].push({ ...rec, [fkField]: newId });
          }
        }
      };

      if (entityType === 'years') {
        if (store.state.device?.activeYearId === oldId) p.device = [{ ...store.state.device, activeYearId: newId }];
        updateStore('terms', 'yearId');
        updateStore('sections', 'yearId');
        updateStore('calendars', 'yearId');
      } else if (entityType === 'terms') {
        if (store.state.device?.activeTermId === oldId) p.device = [{ ...store.state.device, activeTermId: newId }];
        updateStore('teachings', 'termId');
      } else if (entityType === 'subjects') {
        updateStore('teachings', 'subjectId');
        updateStore('units', 'subjectId');
      } else if (entityType === 'sections') {
        updateStore('teachings', 'sectionId');
        updateStore('enrollments', 'sectionId');
      } else if (entityType === 'timeProfiles') {
        if (store.state.device?.activeTimeProfileId === oldId) p.device = [{ ...store.state.device, activeTimeProfileId: newId }];
        updateStore('sessions', 'timeProfileId');
      }
      return p;
    };

    for (const [oldId, newId] of remappedLocals) {
      const patch = buildCascadePatch(oldId, newId, storeName);
      if (Object.keys(patch).length > 0) {
        const ok = await store.save(patch, { queue: false });
        if (!ok) throw new Error(`${storeName} cascade: local persistence failed`);
      }
    }
  }

  const known = new Set(remoteById.keys());
  for (const p of toPush) known.add(p.id);

  return { pushed: toPush.length, pulled: toUpdateLocal.length, known };
}

// Test entry for the retained pre-Sync-V2 collection path. Runtime callers use Sync V2.
export { syncCollection as testOnlyLegacySyncCollection };

/**
 * Phase 5B: Sync structural academic data.
 */
export async function syncStructural() {
  assertCloudOwnership('pull');
  return syncV2Category('structural');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping structural sync.');
    return;
  }
  if (state.status === 'syncing') return;

  setState({ status: 'syncing', results: { ...state.results, structural: null } });
  console.log('[rakeezx sync] Started structural sync...');

  try {
    const requiredByChildren = buildLocalDependencies(store.state);
    const knownRemoteIds = {};
    const stats = {};
    const order = [
      { store: 'years', table: 'years' },
      { store: 'calendars', table: 'calendars' },
      { store: 'calendarDays', table: 'calendar_days' },
      { store: 'terms', table: 'terms' },
      { store: 'subjects', table: 'subjects' },
      { store: 'sections', table: 'sections' },
      { store: 'teachings', table: 'teachings' }
    ];

    for (const { store: sName, table: tName } of order) {
      const context = {
        requiredIds: requiredByChildren[sName] || new Set(),
        knownRemoteIds
      };
      const res = await syncCollection(sName, tName, context);
      knownRemoteIds[sName] = res.known;
      stats[sName] = { pushed: res.pushed, pulled: res.pulled };
    }

    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        structural: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Structural sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Structural sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        structural: { status: 'error', error: err.message, time: Date.now(),
          ...(err.code ? { code: err.code, retryable: err.retryable } : {}),
          ...postgresDiagnostic(err), ...(err.recovery ? { recovery: err.recovery } : {}) }
      }
    });
  }
}

/**
 * Phase 5C: Sync Students and Enrollments.
 * Dependency-aware execution: structural sync runs first.
 */
export async function syncStudents() {
  assertCloudOwnership('pull');
  return syncV2Category('students');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping students sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before students...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting students sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        students: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, students: null } });
  console.log('[rakeezx sync] Started students sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote sections to validate enrollment foreign keys.
    const remoteSections = await cloud.fetchRecords('sections');
    knownRemoteIds.sections = new Set(remoteSections.map(r => r.id));
    // A recovered B can remain outside the broad response cap. Establish
    // positive exact-ID evidence for missing enrollment parents, not absence.
    const missingParents = new Set((store.state.enrollments || []).map((row) => row.sectionId)
      .filter((id) => id && !knownRemoteIds.sections.has(id)));
    const ownerId = cloud.user?.id;
    for (const id of missingParents) {
      const evidence = await cloud.fetchSectionPresence(id);
      if (cloud.session && cloud.user?.id === ownerId && evidence.authoritative && evidence.status === 'present' &&
          evidence.row?.id === id && evidence.row.owner_id === ownerId) knownRemoteIds.sections.add(id);
    }

    // 1. Students
    const resStudents = await syncCollection('students', 'students', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.students = resStudents.known;
    stats.students = { pushed: resStudents.pushed, pulled: resStudents.pulled };

    // 2. Bounded enrollment operations must reach the cloud transaction before
    // generic record merge can observe their intermediate roll-number state.
    await syncEnrollmentOperations();

    // 3. Enrollments
    const resEnrollments = await syncCollection('enrollments', 'enrollments', { requiredIds: new Set(), knownRemoteIds });
    stats.enrollments = { pushed: resEnrollments.pushed, pulled: resEnrollments.pulled };

    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        students: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Students sync complete.', stats);

  } catch (err) {
    console.warn('[rakeezx sync] Students sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        students: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

/** يزامن سجل ملاحظات الطلاب بعد ضمان وصول الطالب وسياق الحصة إن وُجد. */
export async function syncNotes() {
  assertCloudOwnership('pull');
  return syncV2Category('notes');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping notes sync.');
    return;
  }
  if (state.status === 'syncing') return;

  await syncStudents();
  if (state.results.students?.status === 'error') {
    setState({ status: 'error', results: { ...state.results, notes: { status: 'error', error: 'فشلت مزامنة الطلاب: ' + state.results.students.error, time: Date.now() } } });
    return;
  }
  await store.migrateLegacyStudentNotes();

  setState({ status: 'syncing', results: { ...state.results, notes: null } });
  try {
    const knownRemoteIds = {};
    const [remoteStudents, remoteTeachings, remoteSessions] = await Promise.all([
      cloud.fetchRecords('students'), cloud.fetchRecords('teachings'), cloud.fetchRecords('sessions'),
    ]);
    knownRemoteIds.students = new Set(remoteStudents.map((record) => record.id));
    knownRemoteIds.teachings = new Set(remoteTeachings.map((record) => record.id));
    knownRemoteIds.sessions = new Set(remoteSessions.map((record) => record.id));
    const res = await syncCollection('notes', 'notes', { requiredIds: new Set(), knownRemoteIds });
    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({ status: 'synced', lastSyncedAt: nowStamp, results: { ...state.results, notes: { status: 'success', stats: { notes: { pushed: res.pushed, pulled: res.pulled } }, time: nowStamp } } });
    console.log('[rakeezx sync] Notes sync complete.', res);
  } catch (err) {
    console.warn('[rakeezx sync] Notes sync failed:', err);
    setState({ status: 'error', results: { ...state.results, notes: { status: 'error', error: err.message, time: Date.now() } } });
  }
}

export async function syncScoring() {
  assertCloudOwnership('pull');
  return syncV2Category('scoring');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping scoring sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before scoring...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting scoring sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        scoring: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, scoring: null } });
  console.log('[rakeezx sync] Started scoring sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote teachings and students to validate foreign keys.
    const remoteTeachings = await cloud.fetchRecords('teachings');
    knownRemoteIds.teachings = new Set(remoteTeachings.map(r => r.id));

    const remoteStudents = await cloud.fetchRecords('students');
    knownRemoteIds.students = new Set(remoteStudents.map(r => r.id));

    // 1. items
    const resItems = await syncCollection('items', 'items', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.items = resItems.known;
    stats.items = { pushed: resItems.pushed, pulled: resItems.pulled };

    // 2. scores
    const resScores = await syncCollection('scores', 'scores', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.scores = resScores.known;
    stats.scores = { pushed: resScores.pushed, pulled: resScores.pulled };

    // 3. Quick Log events depend on existing students, teachings, and optional sessions.
    const remoteSessions = await cloud.fetchRecords('sessions');
    knownRemoteIds.sessions = new Set(remoteSessions.map(r => r.id));
    const resLogs = await syncCollection('logs', 'logs', { requiredIds: new Set(), knownRemoteIds });
    stats.logs = { pushed: resLogs.pushed, pulled: resLogs.pulled };

    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        scoring: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Scoring sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Scoring sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        scoring: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

export async function syncTimetable() {
  assertCloudOwnership('pull');
  return syncV2Category('timetable');
  /* istanbul ignore next -- unreachable V1 implementation retained for rollback reference */
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping timetable sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before timetable...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting timetable sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        timetable: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, timetable: null } });
  console.log('[rakeezx sync] Started timetable sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote teachings to validate foreign keys.
    const remoteTeachings = await cloud.fetchRecords('teachings');
    knownRemoteIds.teachings = new Set(remoteTeachings.map(r => r.id));

    const localStoreState = store.state;
    const context = buildLocalDependencies(localStoreState);

    // 1. timeProfiles
    const resProfiles = await syncCollection('timeProfiles', 'time_profiles', { requiredIds: context.timeProfiles, knownRemoteIds });
    knownRemoteIds.timeProfiles = resProfiles.known;
    stats.timeProfiles = { pushed: resProfiles.pushed, pulled: resProfiles.pulled };

    // 2. slots
    const resSlots = await syncCollection('slots', 'slots', { requiredIds: context.slots, knownRemoteIds });
    knownRemoteIds.slots = resSlots.known;
    stats.slots = { pushed: resSlots.pushed, pulled: resSlots.pulled };

    // 3. sessions
    const resSessions = await syncCollection('sessions', 'sessions', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.sessions = resSessions.known;
    stats.sessions = { pushed: resSessions.pushed, pulled: resSessions.pulled };

    // Snapshots explain the historical roster for attendance, so pull/push
    // them after their session and before its attendance records.
    const resSnapshots = await syncCollection('sessionRosterSnapshots', 'session_roster_snapshots', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.sessionRosterSnapshots = resSnapshots.known;
    stats.sessionRosterSnapshots = { pushed: resSnapshots.pushed, pulled: resSnapshots.pulled };

    // Fetch remote students for attendance foreign key validation
    const remoteStudents = await cloud.fetchRecords('students');
    knownRemoteIds.students = new Set(remoteStudents.map(r => r.id));

    // 4. attendance
    const resAttendance = await syncCollection('attendance', 'attendance', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.attendance = resAttendance.known;
    stats.attendance = { pushed: resAttendance.pushed, pulled: resAttendance.pulled };

    const nowStamp = Date.now();
    if (!autoRunning) await store.patchDevice({ lastSyncAt: nowStamp }, { notify: false });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        timetable: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Timetable sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Timetable sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        timetable: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}
