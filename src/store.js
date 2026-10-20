import { resolveCalendarRuntime, resolveCalendarDate, resolveRecordedSessionPresentation } from './lib/calendar-runtime.js';
import { reviewFoundationRepair, confirmFoundationRepair, resumeFoundationRepair } from './lib/calendar-recovery.js';
/**
 * RAKEEZ X — المخزن: الحالة في الذاكرة + الحفظ في IndexedDB + الإشعار بالتغيير.
 *
 * كل تعديل يمر من هنا، فيُحفظ فورًا ويُسجَّل في صندوق الصادر (outbox)
 * ليُرفع لاحقًا عند تفعيل المزامنة السحابية.
 */

import * as rawDB from './lib/db.js';
import * as cloud from './lib/cloud.js';
import { runtimeOfflineLease, leaseWriteError } from './lib/offline-lease.js';
// Only store-originated Product writes use this wrapper. Canonical Sync
// reconciliation uses the raw adapter and cannot mint lease evidence.
const productMutators = new Set(['put', 'putMany', 'putAcross', 'patchMany', 'markDeleted', 'applyBatch']);
const db = new Proxy(rawDB, { get(target, name) {
  if (!productMutators.has(name)) return target[name];
  return (...args) => {
    const deviceOnly = ['put', 'putMany', 'patchMany'].includes(name) && args[0] === 'device' ||
      ['putAcross', 'applyBatch'].includes(name) && Object.keys(args[0]).every((key) => key === 'device');
    if (!deviceOnly) assertLeaseWritable();
    const optionIndex = name === 'patchMany' ? 4 : name === 'markDeleted' ? 3 : ['put', 'putMany'].includes(name) ? 2 : 1;
    if (!deviceOnly) {
      // Fill omitted default arguments without changing their defaults.
      if (name === 'patchMany' && args.length < 4) args[3] = Date.now();
      args[optionIndex] = { ...args[optionIndex], productWrite: true };
    }
    return target[name](...args);
  };
} });
import { getScoreFoundationCapability, n77DeleteTeaching, n36DeleteSubjectlessSection } from './lib/cloud.js';
// Bind the copy protocol to its module identity. A previous offline/HTTP cache
// must not supply the two-mode engine to the automatic-safe account entry.
import { DISTRIBUTION_MODES, planScoreDistributionCopy } from './lib/score-distribution-copy.js?n100=automatic-safe-v1';
import { classGroups } from './lib/class-import-file.js';
import { previewStudentRows, importContext, confirmStudentImport } from './lib/student-import.js';
import { reviewGradeTransfer, gradeCommand, isTransferItem, importScoreBinding, importItemBinding } from './lib/grade-transfer.js';
import { DELETE_RETRY_MESSAGE, DELETE_SERVER_UNAVAILABLE_MESSAGE, DELETE_AMBIGUOUS_MESSAGE, DELETE_STALE_MESSAGE, validateDeletePlan, localDeleteWrites, validateSubjectlessPlan, subjectlessDeleteWrites } from './lib/n77-delete.js';
import { deletionScope, visibleClosedTermReport } from './lib/restore-deletion-scope.js';
import { inspectPristineTeaching, hasTeachingReferences, samePristineRecord, teachingReplacementHash } from './lib/pristine-teaching.js';
import { SYNC_V2_SCHEMAS, decodeSyncV2Canonical, encodeSyncV2Patch, calendarDependencies, createSyncV2Engine } from './lib/sync-v2.js';
import { runtimeSyncOwnershipGuard, setLeaseWriteGuard } from './lib/sync-ownership.js';
import { resolveWorkspaceForBoot } from './lib/workspace-routing.js';
import { classifyIncomingItem, distributeAutomatically, projectSubitemScore, scoreCents,
  distributionTargets, normalizeSubitemDatesAndPoints, nextSubitemCompletionState } from './lib/score-foundation.js';
import { LEGACY_WORKSPACE_DB_NAME, LEGACY_BROADCAST_CHANNEL_NAME, openWorkspaceBroadcastChannel, createWorkspaceRegistry } from './lib/workspaces.js';
import {
  initializeCurriculumSyncGate, isCurriculumOrdinarySyncAllowed, resetCurriculumOrdinarySyncAccess,
} from './lib/curriculum-bootstrap.js';

import {
  now, uid, todayISO, scoreId, scoreSubitemCompletionId, attendanceId, sessionId, enrollmentId, closedTermReportId, groupArrangementId,
  calendarRangeIdentity, calendarRangeDayId,
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeEnrollment, makeItem, makeScoreSubitem, makeScoreSubitemCompletion,
  makeSession, makeSlot, slotKind, isNonTeachingSlot, makeCalendar, makeTimeProfile, makeProfile, makeDevice, makeNote, makeClassRule, makeGroupArrangement,
  defaultItemsFor, DEFAULT_ITEMS, DEFAULT_TIME_PROFILES, TERMS_PER_YEAR, termIndexes,
  periodTime, periodNumbers, weekday, shiftDate, isTeachingDay, isWeekend, CALENDAR_KIND, sessionCalendarPresentation,
  sortStudents, sortByOrder, indexScores, groupBy, compareArabic, sectionLabel, normalizeSectionLabel,
  normalizeSearchText, gradeLabel, itemScore, studentTotal
} from './models.js';
import { calendarPresetRecords, getCalendarPreset, officialPresetRangeIdentity, WESTERN_1448_1449_PRESET_ID } from './lib/calendar-presets.js';
import {
  builtinSubject, customSubjectSlug, findPersistedBuiltin, matchBuiltinSubject,
  normalizeSubjectName, subjectCatalogOptions, validateCustomSubjectName,
} from './lib/subject-catalog.js';

export { sectionLabel };

/** إصدار شكل البيانات — يرتفع حين تحتاج السجلات الموجودة ترقية. */
const SCHEMA_VERSION = 8;

/* ---------- الحالة ---------- */

const COLLECTIONS = [
  'years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments',
  'items', 'scoreSubitems', 'scoreSubitemCompletions', 'scores', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance', 'logs',
  'calendars', 'calendarDays', 'units', 'lessons', 'timeProfiles',
  'notes', 'classRules', 'classGoals', 'classCharterSelections', 'groupArrangements', 'assignments', 'submissions',
  'closedTermReports',
];

export const state = {
  ready: false,
  /** بيانات المعلّم — تُصدَّر وتُدمج */
  profile: null,
  /** إعدادات هذا الجهاز — لا تغادره */
  device: null,

  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
};

let cloudRestoreInProgress = false;
let workspaceClaimInProgress = false;
let workspaceInitializationInProgress = false;
export function setCloudRestoreInProgress(active) {
  cloudRestoreInProgress = active === true;
}

export function setWorkspaceClaimInProgress(active) {
  workspaceClaimInProgress = active === true;
}

function assertCloudRestoreWritable({ lease = true } = {}) {
  if (lease) assertLeaseWritable();
  if (!state.ready && !workspaceInitializationInProgress) {
    throw Object.assign(new Error('Workspace is not ready for Product writes'), { code: 'WORKSPACE_NOT_READY' });
  }
  if (workspaceClaimInProgress) {
    throw Object.assign(new Error('Workspace ownership verification is in progress'), {
      code: 'WORKSPACE_CLAIM_IN_PROGRESS',
    });
  }
  if (state.device?.studentLifecycleResume) {
    throw Object.assign(new Error('أكمل تحديث حالة الطالب قبل إجراء تعديلات أخرى.'), { code: 'LIFECYCLE_RESUME_REQUIRED' });
  }
  if (cloudRestoreInProgress) {
    throw Object.assign(new Error('استعادة النسخة السحابية قيد التنفيذ. انتظر اكتمالها قبل التعديل.'), {
      code: 'CLOUD_RESTORE_IN_PROGRESS',
    });
  }
}

const DEFAULT_PROFILE = makeProfile();
const DEFAULT_DEVICE = makeDevice({ schemaVersion: SCHEMA_VERSION });
export const THEME_BOOT_STORAGE_KEY = 'rakeezx-theme';

/* ---------- الاشتراك ---------- */

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let notifyQueued = false;
let pendingRender = false;
let pendingSyncReady = false;
function notify({ render = true, syncReady = true } = {}) {
  pendingRender ||= render;
  pendingSyncReady ||= syncReady;
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    const update = { render: pendingRender, syncReady: pendingSyncReady };
    pendingRender = false;
    pendingSyncReady = false;
    for (const fn of listeners) fn(state, update);
  });
}

/* ---------- الإبلاغ عن فشل الحفظ ---------- */

let errorHandler = null;
export const onWriteError = (fn) => { errorHandler = fn; };

function reportWriteError(err, context) {
  console.error('[rakeezx] تعذر الحفظ', context, err);
  console.error('[rakeezx sync db debug] IndexedDB Error Name:', err.name);
  console.error('[rakeezx sync db debug] IndexedDB Error Message:', err.message);
  console.error('[rakeezx sync db debug] IndexedDB Context:', JSON.stringify(context, null, 2));
  try {
    errorHandler?.(err, context);
  } catch (e) {
    console.error('[rakeezx] فشل معالج الأخطاء', e);
  }
}

/* ---------- التنسيق بين التبويبات ---------- */

const TAB_ID = uid();
let channel = null;
let activeWorkspace = null;
function leaseOwner() {
  if (activeWorkspace?.type !== 'account') return null;
  try {
    const persisted = JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY) || 'null');
    return cloud.session && persisted?.access_token && persisted?.user?.id === cloud.user?.id ? cloud.user.id : null;
  } catch { return null; }
}
function updateLeaseContext() {
  runtimeOfflineLease().setContext(activeWorkspace, leaseOwner());
}
export function getOfflineLeaseStatus() {
  updateLeaseContext();
  return runtimeOfflineLease().observe();
}
export function assertLeaseWritable(device) {
  if (activeWorkspace?.type !== 'account') return;
  updateLeaseContext();
  runtimeOfflineLease().assertWritable();
  if (device) {
    const generation = JSON.parse(activeWorkspace.leaseGeneration);
    const claim = generation[1], restore = generation[2], provision = generation[3];
    if (claim && (device.workspaceClaim?.claimId !== claim || device.workspaceClaim?.ownerId !== activeWorkspace.authUserId) ||
        restore && (device.initialRestoreReceipt?.restoreId !== restore.restoreId || device.initialRestoreReceipt?.manifestHash !== restore.manifestHash) ||
        provision && device.accountProvisioningReceipt?.foundationHash !== provision.foundationHash) {
      runtimeOfflineLease().invalidate('workspace-generation-mismatch');
      throw leaseWriteError();
    }
  }
}
export async function renewOfflineLease() {
  updateLeaseContext();
  const workspace = activeWorkspace;
  const result = await runtimeOfflineLease().renew(async (owner) => {
    const verified = await cloud.verifyCurrentAuthIdentity(owner);
    const registry = createWorkspaceRegistry();
    let routing;
    try { routing = await resolveWorkspaceForBoot({ authUser: cloud.user, registry }); }
    finally { await registry.close(); }
    if (routing.status !== 'ready' || routing.workspace.leaseGeneration !== workspace.leaseGeneration ||
        routing.workspace.id !== workspace.id || routing.workspace.databaseName !== workspace.databaseName) {
      throw Object.assign(new Error('Workspace changed during verification'), { code: 'OFFLINE_LEASE_LIMITED' });
    }
    return verified;
  }, {
    isCurrent: () => activeWorkspace === workspace && leaseOwner() === workspace.authUserId,
  });
  // Establish real score support while online, even before the first subitem
  // edit. Failure does not revoke an otherwise valid ordinary offline lease.
  try { await getScoreFoundationCapability({ workspace }); } catch {}
  notify({ syncReady: false });
  return result;
}
// Recheck after asynchronous DB open and inside the durable transaction.
rawDB.setProductWriteGuard(assertLeaseWritable);
setLeaseWriteGuard(assertLeaseWritable);
cloud.subscribe(() => { updateLeaseContext(); });
const workspaceDeactivationListeners = new Set();

export function onWorkspaceDeactivation(fn) {
  workspaceDeactivationListeners.add(fn);
  return () => workspaceDeactivationListeners.delete(fn);
}

function broadcast(changes, { render = true } = {}) {
  if (!channel || !changes.length) return;
  try {
    channel.postMessage({ from: TAB_ID, changes, render });
  } catch (err) {
    console.warn('[rakeezx] تعذّر إبلاغ التبويبات الأخرى', err);
  }
}

function receiveBroadcast(ev) {
  if (!ev.data || ev.data.from === TAB_ID) return;
  absorb(ev.data.changes, { render: ev.data.render !== false })
    .catch((err) => console.warn('[rakeezx] تعذّر استقبال تغيير', err));
}

export function activateWorkspace(workspace) {
  if (!workspace?.databaseName || !workspace?.broadcastChannelName) {
    throw Object.assign(new Error('A resolved workspace is required before store initialization'), {
      code: 'WORKSPACE_NOT_READY',
    });
  }
  if (state.ready && activeWorkspace?.databaseName !== workspace.databaseName) {
    throw Object.assign(new Error('Cannot switch an initialized Product workspace in place'), {
      code: 'WORKSPACE_ALREADY_MOUNTED',
    });
  }
  db.selectDatabase(workspace.databaseName);
  runtimeSyncOwnershipGuard.setWorkspace(workspace);
  activeWorkspace = Object.freeze({ ...workspace });
  updateLeaseContext();
  resetCurriculumOrdinarySyncAccess();
  closeChannel();
  if (typeof BroadcastChannel === 'function') {
    channel = openWorkspaceBroadcastChannel(activeWorkspace, BroadcastChannel);
    channel.addEventListener('message', receiveBroadcast);
  }
  return activeWorkspace;
}

export function getActiveWorkspace() {
  return activeWorkspace;
}

/** UI access to existing class operations; never substitutes for write/Sync ACLs.
 * Local create rows and claimed legacy rows need not have a canonical ownerId.
 * Their provenance is the mounted, immutable, receipt-bound account database.
 */
export function assertClassOperationsAccess(teachingId) {
  const teaching = getTeaching(teachingId), workspace = activeWorkspace;
  const denied = () => { throw new Error('تعذّر فتح كشف هذا الفصل. تحقق من الحساب والفصل النشط.'); };
  if (!teaching || teaching.deleted || isTeachingArchived(teaching)) denied();
  validateTeachingContext(teaching.sectionId, teaching.termId);
  assertClassImportAccess();
  if (workspace.type === 'account') {
    if (teaching.termId !== activeTerm()?.id || getSection(teaching.sectionId)?.yearId !== activeYear()?.id) denied();
    for (const row of [teaching, getSection(teaching.sectionId), getSubject(teaching.subjectId)]) {
      if (!row || row.ownerId != null && row.ownerId !== workspace.authUserId) denied();
    }
  }

  return teaching;
}
/** AI: read-only presentation of a failed gate. Never authorizes an operation or
 * exposes the underlying identity, database, receipt or exception text. */
export function classOperationsStatus(teachingId) {
  try {
    if (teachingId) assertClassOperationsAccess(teachingId);
    else assertClassImportAccess();
    return null;
  } catch {
    const teaching = getTeaching(teachingId);
    if ((teaching && (teaching.deleted || isTeachingArchived(teaching))) ||
        (activeTerm() && isTermClosed(activeTerm().id))) return 'archived';
    if (!state.ready || !activeWorkspace || !cloud.session ||
        cloud.session.user?.id !== cloud.user?.id || cloud.authStatus().state !== 'authenticated') return 'verification';
    if (getOfflineLeaseStatus().reason === 'expired') return 'lease';
    return 'ownership';
  }
}
/** Same account/provenance/lease gate for an empty Classes screen. No writes. */
export function assertClassImportAccess() {
  const workspace = activeWorkspace;
  const denied = () => { throw new Error('تعذّر فتح الاستيراد. تحقق من الحساب والسنة والفصل الدراسي وصلاحية العمل دون اتصال.'); };
  if (!state.ready || !workspace || !activeYear() || !activeTerm() || activeTerm().yearId !== activeYear().id || isTermClosed(activeTerm().id)) denied();
  if (workspace.type === 'account') {
    const owner = workspace.authUserId, bound = runtimeSyncOwnershipGuard.getWorkspace();
    const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'preview', authenticatedUserId: cloud.user?.id });
    if (!cloud.session || cloud.session.user?.id !== owner || cloud.user?.id !== owner ||
        cloud.authStatus().state !== 'authenticated' || !access.allowed || access.workspaceOwnerId !== owner ||
        workspace.databaseName !== rawDB.getActiveDatabaseName() || bound.id !== workspace.id ||
        bound.databaseName !== workspace.databaseName || bound.leaseGeneration !== workspace.leaseGeneration ||
        !activeYear() || !activeTerm() || activeTerm().yearId !== activeYear().id) denied();
    // Explicit conflicts always win, including parent rows in a mixed-owner cache.
    for (const row of [activeYear(), activeTerm()]) {
      if (!row || row.ownerId != null && row.ownerId !== owner) denied();
    }
    assertCloudRestoreWritable();
    assertLeaseWritable(state.device);
    {
      const [, claim, restore, provision] = JSON.parse(workspace.leaseGeneration);
      const marker = state.device?.workspaceClaim;
      const receipt = state.device?.initialRestoreReceipt;
      const foundation = state.device?.accountProvisioningReceipt;
      const claimed = workspace.workspaceKind === 'legacy-in-place' && workspace.databaseName === LEGACY_WORKSPACE_DB_NAME &&
        claim && marker?.version === 1 && marker.state === 'claimed' && marker.claimId === claim &&
        marker.ownerId === owner && marker.databaseName === workspace.databaseName;
      // finalizeAccountRestore stores an ownerless registry receipt. The mounted
      // workspace/Auth/DB binding above supplies its owner; the device must name it.
      const restored = restore && receipt?.ownerId === owner &&
        (!Object.hasOwn(restore, 'ownerId') || restore.ownerId === owner) &&
        ['CORE_V1', 'CORE_V2'].includes(receipt.protocol) && receipt.protocol === restore.protocol &&
        receipt.restoreId === restore.restoreId &&
        receipt.manifestHash && receipt.manifestHash === restore.manifestHash &&
        Number.isFinite(receipt.completedAt) && receipt.completedAt > 0 && receipt.completedAt === restore.completedAt;
      const provisioned = workspace.workspaceKind === 'account-provisioned' && provision &&
        provision.ownerId === owner && foundation?.ownerId === owner && foundation.contractVersion === 1 &&
        provision.contractVersion === 1 && foundation.foundationHash && foundation.foundationHash === provision.foundationHash;
      if (!claimed && !restored && !provisioned) denied();
    }
  } else if (!['demo', 'legacy'].includes(workspace.type)) denied();
  assertCloudRestoreWritable();
  assertLeaseWritable(state.device);
  return workspace;
}


/**
 * يُغلق قناة BroadcastChannel.
 * يُستدعى من بيئة الاختبار فقط بعد انتهاء جميع الاختبارات لمنع تسرّب الموارد
 * وإبقاء Node.js حيًّا بعد انتهاء مجموعة الاختبارات.
 */
export function closeChannel() {
  if (channel) channel.close();
  channel = null;
}

export function deactivateWorkspace(reason = 'workspace-not-ready') {
  for (const fn of workspaceDeactivationListeners) fn();
  closeChannel();
  db.closeDB();
  activeWorkspace = null;
  updateLeaseContext();
  resetCurriculumOrdinarySyncAccess();
  runtimeSyncOwnershipGuard.setWorkspace({ type: 'unresolved', ownershipState: 'unresolved', reason });
  state.ready = false;
  state.profile = null;
  state.device = null;
  for (const collection of COLLECTIONS) state[collection] = [];
  notify();
}

async function absorb(changes, { render = true } = {}) {
  const byStore = {};
  for (const c of changes ?? []) (byStore[c.store] ??= new Set()).add(c.id);

  for (const [storeName, ids] of Object.entries(byStore)) {
    if (storeName === 'profile' || storeName === 'device') {
      const fresh = await db.get(storeName, storeName);
      if (fresh) state[storeName] = fresh;
      continue;
    }
    const arr = state[storeName];
    if (!Array.isArray(arr)) continue;

    for (const id of ids) {
      const fresh = await db.get(storeName, id);
      const i = arr.findIndex((r) => r.id === id);
      if (fresh) {
        if (i >= 0) arr[i] = fresh;
        else arr.push(fresh);
      } else if (i >= 0) {
        arr.splice(i, 1);
      }
    }
  }
  for (const change of changes ?? []) {
    if (change.store === 'teachings' && change.replacementId && globalThis.location?.hash &&
        !getTeaching(change.id) && getTeaching(change.replacementId)) {
      const next = teachingReplacementHash(location.hash, change.id, change.replacementId);
      if (next !== location.hash) location.replace(next);
    }
  }
  notify({ render });
}

function visibleSyncValue(storeName, record) {
  if (!record) return null;
  const fields = Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {});
  return Object.fromEntries(['id', 'deleted', ...fields].map((field) => [field, record[field]]));
}

/** Refresh only cloud-backed state after Sync V2 reconciliation. */
export async function refreshSyncedState() {
  const stores = Object.keys(SYNC_V2_SCHEMAS);
  const loaded = await Promise.all(stores.map((storeName) =>
    storeName === 'profile' ? db.get('profile', 'profile') : db.getAll(storeName)));
  const changes = [];
  let shouldRender = false;
  stores.forEach((storeName, index) => {
    const fresh = loaded[index];
    if (storeName === 'profile') {
      const next = { ...DEFAULT_PROFILE, ...(fresh ?? {}) };
      if (JSON.stringify(state.profile) !== JSON.stringify(next)) {
        shouldRender ||= JSON.stringify(visibleSyncValue('profile', state.profile)) !== JSON.stringify(visibleSyncValue('profile', next));
        state.profile = next;
        changes.push({ store: 'profile', id: 'profile' });
      }
      return;
    }
    const current = Array.isArray(state[storeName]) ? state[storeName] : [];
    if (JSON.stringify(current) === JSON.stringify(fresh)) return;
    const visible = (records) => records.map((record) => visibleSyncValue(storeName, record))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    shouldRender ||= JSON.stringify(visible(current)) !== JSON.stringify(visible(fresh));
    const ids = new Set([...current, ...fresh].map((record) => record.id));
    state[storeName] = fresh;
    changes.push(...[...ids].map((id) => ({ store: storeName, id })));
  });
  if (changes.length) {
    notify({ render: shouldRender });
    broadcast(changes, { render: shouldRender });
  }
  return changes;
}

const changeList = (storeName, records) => records.map((r) => ({ store: storeName, id: r.id }));

/* ---------- الإقلاع والترحيل ---------- */


/**
 * ترقية ٣ → ٤: يفصل سجل الإعدادات الواحد إلى ملف معلّم وإعدادات جهاز.
 * تُشغَّل مرة واحدة، ولا تفقد شيئًا: كل حقل يذهب إلى موضعه الصحيح.
 */
async function splitMetaIfNeeded() {
  const [profile, device, oldMeta] = await Promise.all([
    db.get('profile', 'profile'),
    db.get('device', 'device'),
    db.get('meta', 'meta'),
  ]);
  if (profile && device) return false;

  const src = oldMeta ?? {};
  const nextProfile = profile ?? makeProfile({
    teacherName: src.teacherName ?? '',
    schoolName: src.schoolName ?? '',
    phone: src.phone ?? '',
  });
  const nextDevice = device ?? makeDevice({
    theme: src.theme ?? 'light',
    activeYearId: src.activeYearId ?? null,
    activeTermId: src.activeTermId ?? null,
    lastSyncAt: src.lastSyncAt ?? null,
    schemaVersion: SCHEMA_VERSION,
  });

  await db.putAcross({ profile: [nextProfile], device: [nextDevice] });
  if (oldMeta) await db.clearStore('meta');   // السجل القديم أدّى دوره
  return true;
}

export async function init() {
  if (!activeWorkspace) {
    activateWorkspace({
      id: 'legacy', type: 'legacy', authUserId: null,
      databaseName: db.DB_NAME, ownershipState: 'unclaimed', syncEligible: false,
      broadcastChannelName: LEGACY_BROADCAST_CHANNEL_NAME,
    });
  }
  workspaceInitializationInProgress = true;
  try {
    await db.openDB();

    const hadProfile = await db.get('profile', 'profile');
    const hadMeta = await db.get('meta', 'meta');

    if (getOfflineLeaseStatus().editable) await splitMetaIfNeeded();

    const [profile, device, ...loaded] = await Promise.all([
      db.get('profile', 'profile'),
      db.get('device', 'device'),
      ...COLLECTIONS.map((c) => db.getAll(c)),
    ]);

    state.profile = { ...DEFAULT_PROFILE, ...(profile ?? {}) };
    state.device = { ...DEFAULT_DEVICE, ...(device ?? {}) };
    COLLECTIONS.forEach((c, i) => {
      state[c] = loaded[i] ?? [];
    });
    initializeCurriculumSyncGate({ workspace: activeWorkspace, device: state.device });

    if (!device?.studentLifecycleResume && !device?.n77DeleteIntent && getOfflineLeaseStatus().editable) {
      await normalizeSectionLifecycle();
      await ensureFoundation();
      await migrateLegacyGroupArrangements();
      await migrateLegacyStudentNotes();
    }

    applyTheme();
    state.ready = true;
    notify();
    db.persist();
    return state;
  } finally {
    workspaceInitializationInProgress = false;
  }
}

/** Forward-compatible local normalization; no outbox entry or timestamp churn. */
async function normalizeSectionLifecycle() {
  const changed = [];
  state.sections = state.sections.map((section) => {
    if (section.status && 'archivedAt' in section && 'archiveDate' in section) return section;
    const normalized = {
      ...section,
      status: section.status ?? 'active',
      archivedAt: section.archivedAt ?? null,
      archiveDate: section.archiveDate ?? null,
    };
    changed.push(normalized);
    return normalized;
  });
  if (changed.length) await db.putMany('sections', changed);
}

/**
 * يضمن الأساس: سنة، وفصولها الدراسية بعدد إعداد المنتج، ومادة، وملفات توقيت،
 * ومؤشّرات جهاز صالحة. إجراء متكرر آمن يُصلح أي مؤشّر معلّق بعد استرجاع نسخة.
 */
async function ensureFoundation() {
  const writes = {};
  if (!state.device?.deviceId) {
    state.device = { ...(state.device ?? DEFAULT_DEVICE), id: 'device', deviceId: uid(), updatedAt: now() };
    writes.device = [state.device];
  }
  if (!Number(state.profile?.serverRevision) && !state.profile?.syncCreatePending) {
    state.profile = syncV2Record('profile', state.profile ?? DEFAULT_PROFILE, { pendingCreate: true });
    writes.profile = [state.profile];
    const entry = outboxEntry('profile', state.profile, null, 'put', null);
    if (entry) (writes.outbox ??= []).push({ ...entry, bootstrap: true });
  }
  const push = (k, rec) => {
    const next = syncV2Record(k, rec, { pendingCreate: !!SYNC_V2_SCHEMAS[k] });
    (writes[k] ??= []).push(next);
    if (Array.isArray(state[k])) state[k].push(next);
    const entry = outboxEntry(k, next, null, 'put', null);
    if (entry) (writes.outbox ??= []).push({ ...entry, bootstrap: true });
  };

  // Old offline data could predate the required cloud `name` column. Preserve
  // its id, periods, and history, but give only nameless records a transparent,
  // deterministic compatibility label before they can be serialized to cloud.
  for (const profile of state.timeProfiles) {
    if (isLocalOnlyRecord(profile) || (typeof profile.name === 'string' && profile.name.trim())) continue;
    const suffix = String(profile.id ?? 'غير-معرّف').slice(-8);
    profile.name = `ملف توقيت قديم (${suffix})`;
    profile.updatedAt = now();
    (writes.timeProfiles ??= []).push(profile);
    // Replace only this record's stale payload so a previous invalid outbox
    // entry cannot keep automatic sync pending after the repair succeeds.
    (writes.outbox ??= []).push(outboxEntry('timeProfiles', profile, ['name'], 'patch', profile));
  }

  if (!state.years.length) {
    const preset = calendarPresetRecords(getCalendarPreset());
    // N58: the server must acknowledge the year and both terms BEFORE selection.
    // Keep the user's default selected projection locally; never send it in CREATE.
    const { calendarPresetId, ...unselectedYear } = preset.year;
    push('years', unselectedYear);
    preset.terms.forEach(({ calendarId, ...term }) => push('terms', { ...term, calendarId: null }));
    const selected = { ...state.years.at(-1), calendarPresetId };
    const selection = outboxEntry('years', selected, ['calendarPresetId'], 'patch', state.years.at(-1));
    if (selection) (writes.outbox ??= []).push({ ...selection, bootstrap: true });
    state.years[state.years.length - 1] = selected;
    writes.years[writes.years.length - 1] = selected;
  }

  // Retained year tombstones are history, not permission to recreate IDs.
  if (!live(state.years).length) {
    if (Object.keys(writes).length) await db.putAcross(writes);
    return;
  }

  // السنة التي نضمن فصولها هي **النشطة**، لا أول سنة في ترتيب الإدخال —
  // وإلا أُنشئ الفصل الثاني لسنة أخرى غير التي يعمل عليها المعلّم.
  const year =
    live(state.years).find((y) => y.id === state.device?.activeYearId) ?? live(state.years)[0];

  // فصول السنة الدراسية بعدد الإعداد الحالي (فصلان)، بلا حذف ما زاد عنها
  const existing = live(state.terms).filter((t) => t.yearId === year.id);
  for (const index of termIndexes()) {
    if (existing.some((t) => t.index === index) || year.calendarPresetId ||
        state.terms.some(t => t.yearId === year.id && t.index === index)) continue;
    push('terms', makeTerm({ yearId: year.id, index, status: index === 1 ? 'active' : 'upcoming' }));
  }

  if (!live(state.subjects).length) push('subjects', makeSubject({ name: 'المهارات الرقمية' }));

  // ملفات التوقيت المبدئية — سجلات قابلة للتعديل، لا ثوابت
  // Only a truly empty device receives the four first-use presets. Retained
  // tombstones are authoritative deletion evidence and must not be recreated.
  if (!state.timeProfiles.length) {
    DEFAULT_TIME_PROFILES.forEach((p, i) => push('timeProfiles', makeTimeProfile({ ...p, order: i })));
  } else {
    // Auto-upgrade legacy default profiles that lack exact official configs
    live(state.timeProfiles).forEach((p) => {
      const defaultProfile = DEFAULT_TIME_PROFILES.find(dp => dp.name === p.name);
      if (defaultProfile && (!p.overrides || !p.overrides.config)) {
        p.periods = defaultProfile.periods;
        p.overrides = defaultProfile.overrides;
        p.updatedAt = now();
        (writes.timeProfiles ??= []).push(p);
      }
    });
  }

  const terms = live(state.terms).filter((t) => t.yearId === year.id)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const profiles = live(state.timeProfiles);

  const patch = {};
  const d = state.device;
  if (!d.activeYearId || !state.years.some((y) => y.id === d.activeYearId && !y.deleted)) {
    patch.activeYearId = year.id;
  }
  if (!d.activeTermId || !state.terms.some((t) => t.id === d.activeTermId && !t.deleted)) {
    patch.activeTermId = terms[0]?.id ?? null;
  }
  if (!d.activeTimeProfileId || !profiles.some((p) => p.id === d.activeTimeProfileId)) {
    patch.activeTimeProfileId = profiles[0]?.id ?? null;
  }
  if (d.schemaVersion !== SCHEMA_VERSION) patch.schemaVersion = SCHEMA_VERSION;

  if (Object.keys(patch).length) {
    state.device = { ...state.device, ...patch, updatedAt: now() };
    writes.device = [state.device];
  }

  if (Object.keys(writes).length) await db.putAcross(writes);
}

/** ينقل ترتيب المجموعات القديم من إعدادات الجهاز مرة واحدة إلى سجل Sync V2. */
async function migrateLegacyGroupArrangements() {
  const legacy = state.device?.groupArrangements;
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return;
  const remaining = { ...legacy };
  let changed = false;
  for (const [teachingId, arrangement] of Object.entries(legacy)) {
    const teaching = getTeaching(teachingId);
    const existing = groupArrangementOf(teachingId);
    if (existing) {
      delete remaining[teachingId];
      changed = true;
      continue;
    }
    if (!teaching || teaching.deleted) {
      delete remaining[teachingId];
      changed = true;
      continue;
    }
    // An archived teaching is read-only. Retain its old local display source,
    // but never emit a new cloud mutation after archival.
    if (isTeachingArchived(teaching)) continue;
    const groups = projectGroupArrangement(teachingId, arrangement);
    if (!groups.length) continue;
    const record = makeGroupArrangement({ teachingId, groups });
    if (await save({ groupArrangements: [record] })) {
      delete remaining[teachingId];
      changed = true;
    }
  }
  if (changed) await patchDevice({ groupArrangements: remaining });
}

/* ---------- الكتابة ---------- */

// Runtime actions on demo classes use ordinary session/score IDs. Their
// explicit demo references still make them local-only, even after deletion.
export const isLocalOnlyRecord = (rec) => [
  'id', 'teachingId', 'teaching_id', 'studentId', 'student_id',
  'sectionId', 'section_id', 'sessionId', 'session_id', 'itemId', 'item_id',
  'slotId', 'slot_id',
].some(key => String(rec?.[key] ?? '').startsWith('demo:'));
// Private creation-only receipt. It lives in the local outbox, never in cloud payloads.
const TEACHING_CREATION_PROOF = Symbol('pristineTeachingCreation');

let syncV2Sequence = 0;
const nextSyncV2Sequence = () => {
  syncV2Sequence = Math.max(Date.now() * 1000, syncV2Sequence + 1);
  return syncV2Sequence;
};

function syncV2DeviceId() {
  if (!state.device?.deviceId) {
    state.device = { ...(state.device ?? DEFAULT_DEVICE), id: 'device', deviceId: uid(), updatedAt: now() };
  }
  return state.device.deviceId;
}

function syncV2Record(storeName, record, { pendingCreate = false } = {}) {
  if (!SYNC_V2_SCHEMAS[storeName] || isLocalOnlyRecord(record)) return record;
  return {
    ...record,
    canonicalId: record.canonicalId ?? record.id,
    serverRevision: Number.isSafeInteger(Number(record.serverRevision)) ? Number(record.serverRevision) : 0,
    ...(pendingCreate ? { syncCreatePending: true } : {}),
  };
}

function syncV2Dependencies(storeName, record, op) {
  const references = SYNC_V2_SCHEMAS[storeName]?.references ?? {};
  return [...calendarDependencies(storeName, record, op, state.terms), ...Object.entries(references)
    .filter(([field]) => record?.[field])
    .map(([field, store]) => ({ store, recordId: record[field], requiresServerRevision: true }))];
}

function syncV2CommandEntry({ store, recordId, command, patch: commandPatch = {}, dependencies = [], priorCommands = [], baseRevision = 0, stamp = now() }) {
  assertCloudRestoreWritable();
  if (activeWorkspace?.type === 'demo') return null;
  if (isLocalOnlyRecord({ id: recordId, ...commandPatch }) ||
      dependencies.some((dependency) => String(dependency.recordId ?? '').startsWith('demo:'))) return null;
  const mutationId = uid();
  const canonicalId = recordId;
  // Definitions and student decisions share one score domain. A later edit
  // must not overtake a completion whose acknowledgement failed (or vice versa).
  const preceding = String(command).startsWith('score:') && commandPatch.itemId
    ? priorCommands.filter(row => String(row.command ?? '').startsWith('score:') &&
      row.patch?.itemId === commandPatch.itemId).sort((a, b) => b.sequence - a.sequence)[0] : null;
  return runtimeSyncOwnershipGuard.bindNewCommand({
    id: `v2:${mutationId}`,
    protocol: 'v2', mutationId, deviceId: syncV2DeviceId(), store,
    entity: SYNC_V2_SCHEMAS[store]?.entity ?? store,
    recordId, serverRecordId: canonicalId, canonicalId,
    logicalRecordKey: `${store}:${canonicalId}`,
    op: 'command', command, baseRevision: Number(baseRevision) || 0,
    patch: structuredClone(commandPatch), localPatch: {},
    fields: Object.keys(commandPatch).sort(), groups: [],
    dependencies: structuredClone([...dependencies, ...(preceding ? [{ mutationId: preceding.mutationId }] : [])]),
    sequence: nextSyncV2Sequence(), clientUpdatedAt: stamp, queuedAt: stamp,
    state: 'pending', attemptCount: 0, envelopeLocked: false,
    lastError: null, blockedReason: null,
  });
}

const outboxEntry = (storeName, rec, fields = null, op = 'put', previous = null) => {
  assertCloudRestoreWritable();
  if (activeWorkspace?.type === 'demo') return null;
  const schema = SYNC_V2_SCHEMAS[storeName];
  if (!schema || schema.readOnly || isLocalOnlyRecord(rec) || !isCurriculumOrdinarySyncAllowed(storeName)) return null;
  const operation = op === 'put' ? (previous ? 'patch' : 'create') : op;
  let localFields = fields ?? Object.keys(schema.fields);
  // patchMany reports only edited fields even when it inserted a new record.
  // A new score must carry its immutable parent identities to Sync V2.
  if (storeName === 'scores' && operation === 'create') {
    if (!rec.studentId || !rec.itemId) throw new Error('Score create requires canonical student and item IDs');
    localFields = [...new Set([...localFields, 'studentId', 'itemId'])];
  }
  // The server derives subitem totals from completion and manual-value rows.
  // Uploading an optimistic numeric projection could overwrite a newer device's contribution.
  if (storeName === 'scores' && state.items.find((item) => item.id === rec.itemId)?.scoreMode === 'subitems') {
    localFields = localFields.filter((field) => !['value', 'derivedValue'].includes(field));
  }
  const localPatch = operation === 'delete'
    ? {}
    : Object.fromEntries(localFields.filter((field) => field in rec).map((field) => [field, structuredClone(rec[field])]));
  const patch = operation === 'delete' ? {} : encodeSyncV2Patch(storeName, localPatch);
  const mutationId = uid();
  const canonicalId = rec.canonicalId ?? rec.id;
  const stamp = rec.updatedAt ?? now();
  return runtimeSyncOwnershipGuard.bindNewCommand({
    id: `v2:${mutationId}`,
    protocol: 'v2', mutationId, deviceId: syncV2DeviceId(),
    store: storeName, entity: schema.entity,
    recordId: rec.id, serverRecordId: canonicalId, canonicalId,
    logicalRecordKey: `${storeName}:${canonicalId}`,
    op: operation,
    baseRevision: operation === 'create' ? 0 : Number(rec.serverRevision ?? previous?.serverRevision ?? 0),
    patch, localPatch,
    fields: Object.keys(patch).sort(), groups: [],
    dependencies: syncV2Dependencies(storeName, rec, operation),
    sequence: nextSyncV2Sequence(), clientUpdatedAt: stamp, queuedAt: stamp,
    state: 'pending', attemptCount: 0, envelopeLocked: false,
    lastError: null, blockedReason: null,
  });
};

function teachingCreationEntry(proof, stamp = now()) {
  return syncV2CommandEntry({
    store: 'teachings', recordId: proof.teaching.id, command: 'teaching:create', stamp,
    patch: {
      sectionId: proof.teaching.sectionId,
      subjectId: proof.teaching.subjectId,
      termId: proof.teaching.termId,
      order: proof.teaching.order ?? 0,
      itemIds: proof.items.map((item) => item.id),
    },
    dependencies: [
      { store: 'sections', recordId: proof.teaching.sectionId, requiresServerRevision: true },
      { store: 'subjects', recordId: proof.teaching.subjectId, requiresServerRevision: true },
      { store: 'terms', recordId: proof.teaching.termId, requiresServerRevision: true },
    ],
  });
}

function enrollmentCommandEntry(command, enrollment, { sourceEnrollmentId = null, date = null, note = '' } = {}) {
  return syncV2CommandEntry({
    store: 'enrollments', recordId: enrollment.studentId, command: `enrollment:${command}`,
    patch: {
      studentId: enrollment.studentId,
      sourceEnrollmentId,
      destinationEnrollmentId: command === 'withdraw' ? null : enrollment.id,
      destinationSectionId: command === 'withdraw' ? null : enrollment.sectionId,
      date: date ?? enrollment.startDate ?? todayISO(), note,
    },
    dependencies: [
      { store: 'students', recordId: enrollment.studentId, requiresServerRevision: true },
      ...(command === 'withdraw' ? [] : [{ store: 'sections', recordId: enrollment.sectionId, requiresServerRevision: true }]),
    ],
    stamp: enrollment.updatedAt ?? now(),
  });
}

function lifecycleCommandEntry(command, targetId, storeName, stamp = now(), extraPatch = {}) {
  return syncV2CommandEntry({
    store: storeName, recordId: targetId, command: `lifecycle:${command}`,
    patch: { targetId, ...extraPatch }, stamp,
    dependencies: ['archive_class', 'reopen_class'].includes(command)
      ? [{ store: storeName, recordId: targetId, requiresServerRevision: true }]
      : [],
  });
}

const ARCHIVED_SECTION_WRITE_MESSAGE = 'الفصل مؤرشف ومحمي من التعديل. أعد فتحه بعد التحقق من التعارضات أولًا.';

function recordFrom(storeName, id, pending = null) {
  if (!id) return null;
  return pending?.[storeName]?.find((record) => record.id === id) ??
    (Array.isArray(state[storeName]) ? state[storeName].find((record) => record.id === id) : null) ?? null;
}

function sectionForOperationalRecord(storeName, record, pending = null) {
  if (!record || ['sections', 'years', 'terms', 'subjects', 'students', 'profile', 'timeProfiles', 'calendars', 'calendarDays'].includes(storeName)) return null;
  if (storeName === 'enrollments') return recordFrom('sections', record.sectionId, pending);
  if (storeName === 'teachings') return recordFrom('sections', record.sectionId, pending);
  let teachingId = record.teachingId ?? null;
  if (storeName === 'items' || storeName === 'slots' || storeName === 'sessions' || storeName === 'logs' || storeName === 'classRules' || storeName === 'classGoals' || storeName === 'classCharterSelections' || storeName === 'groupArrangements') {
    teachingId = record.teachingId;
  } else if (storeName === 'scores') {
    teachingId = recordFrom('items', record.itemId, pending)?.teachingId ?? null;
  } else if (storeName === 'attendance') {
    teachingId = record.teachingId ?? recordFrom('sessions', record.sessionId, pending)?.teachingId ?? null;
  } else if (storeName === 'sessionRosterSnapshots') {
    return recordFrom('sections', record.sectionId, pending);
  } else if (storeName === 'notes') {
    teachingId = record.teachingId ?? recordFrom('sessions', record.sessionId, pending)?.teachingId ?? null;
  } else if (storeName === 'assignments') {
    teachingId = record.teachingId ?? null;
  } else if (storeName === 'submissions') {
    const assignment = recordFrom('assignments', record.assignmentId, pending);
    teachingId = assignment?.teachingId ?? null;
  }
  const teaching = recordFrom('teachings', teachingId, pending);
  return teaching ? recordFrom('sections', teaching.sectionId, pending) : null;
}

function assertOperationalWritesAllowed(batch) {
  assertCloudRestoreWritable({ lease: Object.keys(batch ?? {}).some((name) => name !== 'device') });
  for (const [storeName, records] of Object.entries(batch ?? {})) {
    for (const record of records ?? []) {
      const parent = record.studentId ? recordFrom('students', record.studentId, batch) : null;
      if (record.studentId && !record.deleted && (!parent || parent.deleted)) {
        throw Object.assign(new Error('لا يمكن إضافة بيانات لطالب محذوف.'), { code: 'STUDENT_TOMBSTONED' });
      }
      if (storeName === 'closedTermReports') {
        throw new Error('تقارير الفصل المغلق تُنشأ وتُصحح بالأمر الخادمي المخصص فقط.');
      }
      if (storeName === 'terms') {
        const existing = state.terms.find((term) => term.id === record.id);
        if ((record.status === 'closed' && existing?.status !== 'closed') || existing?.status === 'closed') {
          throw new Error('إغلاق الفصل الدراسي أو تعديل فصل مغلق يتطلب أمر التقارير المخصص.');
        }
      }
      if (storeName === 'sections') {
        const existing = state.sections.find((section) => section.id === record.id);
        const invalidCreate = !existing && ((record.status ?? 'active') !== 'active' || record.archivedAt != null || record.archiveDate != null);
        const lifecycleChanged = existing && (
          (record.status ?? existing.status ?? 'active') !== (existing.status ?? 'active') ||
          (record.archivedAt ?? null) !== (existing.archivedAt ?? null) ||
          (record.archiveDate ?? null) !== (existing.archiveDate ?? null)
        );
        if (invalidCreate || lifecycleChanged) throw new Error('تغيير حالة أرشفة الفصل يتطلب أمر دورة الحياة المخصص.');
        if (existing?.status === 'archived') throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
      }
      const section = sectionForOperationalRecord(storeName, record, batch);
      if (section?.status === 'archived') throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
    }
  }
}

/**
 * A durable receipt for a bounded enrollment operation.  The ordinary per-row
 * entries remain so generic sync can still converge the final records; this
 * receipt tells student sync to use the server transaction first, before a
 * generic bulk upsert could expose a transient duplicate roll number.
 */
const enrollmentOperationEntry = (operation, stamp) => activeWorkspace?.type === 'demo' ? null : runtimeSyncOwnershipGuard.bindNewCommand({
  id: `enrollment-operation:${operation.id}`,
  store: 'enrollments',
  recordId: null,
  op: 'enrollment-operation',
  updatedAt: stamp,
  queuedAt: stamp,
  enrollmentOperation: operation,
});

let enrollmentOperationOrder = 0;
const nextEnrollmentOperationOrder = (outbox = []) => {
  const persisted = outbox.reduce((max, entry) => Math.max(max, entry.enrollmentOperation?.order ?? 0), 0);
  enrollmentOperationOrder = Math.max(Date.now() * 1000, enrollmentOperationOrder + 1, persisted + 1);
  return enrollmentOperationOrder;
};

// Keep cascade deletes in the same durable transaction as their tombstones.
// Every store listed here has a cloud mapper and may safely drain through automatic sync.
const CASCADE_SYNCABLE_STORES = new Set([
  'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'notes', 'items', 'scoreSubitems', 'scoreSubitemCompletions', 'scores', 'logs',
  'classRules', 'classGoals', 'classCharterSelections', 'groupArrangements',
  'timeProfiles', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance',
]);

function applyToMemory(storeName, records) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return [];
  const undo = [];
  for (const rec of records) {
    const i = arr.findIndex((x) => x.id === rec.id);
    undo.push({ index: i, previous: i >= 0 ? arr[i] : null });
    if (i >= 0) arr[i] = rec;
    else arr.push(rec);
  }
  return undo;
}

function revertMemory(storeName, records, undo) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return;
  for (let k = undo.length - 1; k >= 0; k--) {
    const { index, previous } = undo[k];
    if (previous) arr[index] = previous;
    else {
      const i = arr.findIndex((x) => x.id === records[k].id);
      if (i >= 0) arr.splice(i, 1);
    }
  }
}

/** يحفظ سجلات كاملة — للإنشاء والاستيراد الجماعي. للتعديل استعمل patch(). */
export async function save(batch, options = {}) {
  assertLeaseWritable();
  if (options.signal?.aborted) return false;
  if (options.queue !== false) assertOperationalWritesAllowed(batch);
  const writes = {};
  const outbox = [];
  const undos = [];
  const changes = [];
  const proof = options[TEACHING_CREATION_PROOF];
  const explicitDeletes = options.v2Deletes ?? {};
  const contextualSessions = options.queue === false ? batch.sessions : batch.sessions?.map(record => {
    if (state.sessions.some(prior => prior.id === record.id)) return record;
    const calendarContext = newSessionCalendarContext(record, batch);
    return calendarContext ? { ...record, calendarContext } : record;
  });

  for (const [storeName, records] of Object.entries(batch)) {
    if (!records?.length) continue;
    const previous = new Map((Array.isArray(state[storeName]) ? state[storeName] : [state[storeName]])
      .filter(Boolean).map((record) => [record.id, record]));
    for (const id of explicitDeletes[storeName] ?? []) {
      if (!records.some((record) => record.id === id && record.deleted) ||
          !previous.has(id) || previous.get(id).deleted) {
        throw new Error('Calendar range delete requires an active local record.');
      }
    }
    // Prepare the entire batch before changing memory: an unknown calendar must
    // not leave a partial batch or queue a session the native contract rejects.
    const contextual = storeName === 'sessions' ? contextualSessions : records;
    const prepared = contextual.map((record) => syncV2Record(storeName, record, {
      pendingCreate: !!SYNC_V2_SCHEMAS[storeName] && !previous.has(record.id),
    }));
    writes[storeName] = prepared;
    undos.push([storeName, prepared, applyToMemory(storeName, prepared)]);
    changes.push(...changeList(storeName, prepared));
    if (options.queue === false || storeName === 'meta' ||
        (proof && (storeName === 'teachings' || storeName === 'items'))) continue;
    for (const record of prepared) {
      const prior = previous.get(record.id) ?? null;
      const explicitDelete = explicitDeletes[storeName]?.includes(record.id) === true;
      if (storeName === 'enrollments' && !prior && record.status === 'active') {
        const entry = enrollmentCommandEntry('enroll', record);
        if (entry) outbox.push(entry);
      } else {
        const fields = prior
          ? Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {}).filter((field) =>
            JSON.stringify(prior[field]) !== JSON.stringify(record[field]))
          : null;
        const entry = outboxEntry(storeName, record, fields, explicitDelete ? 'delete' : 'put', prior);
        if (entry && (explicitDelete || entry.op === 'create' || entry.fields.length)) outbox.push(entry);
      }
    }
  }
  if (!changes.length) return true;

  if (proof) {
    const entry = teachingCreationEntry(proof, proof.teaching.updatedAt ?? now());
    if (entry) outbox.push(entry);
  }
  if (outbox.length) writes.outbox = outbox;
  notify({ syncReady: false });

  try {
    if (options.verifyCurrent) {
      const guarded = Object.fromEntries([...new Set(['sections','teachings','subjects','students','enrollments','years','terms','device','outbox',...Object.keys(writes)])].map(name => [name, {}]));
      await db.applyBatch(guarded, { signal: options.signal, prepare(current) {
        options.verifyCurrent(current);
        return Object.fromEntries(Object.entries(writes).map(([name, rows]) => [name, { put: rows }]));
      } });
    } else await db.putAcross(writes, { signal: options.signal });
    if (options.signal?.aborted) return false;
    broadcast(changes);
    if (outbox.length) notify({ render: false });
    return true;
  } catch (err) {
    if (options.signal?.aborted) return false;
    for (const [storeName, records, undo] of undos) revertMemory(storeName, records, undo);
    notify({ syncReady: false });
    reportWriteError(err, { op: 'save', stores: Object.keys(batch) });
    return false;
  }
}

/**
 * Local persistence only. The caller must prevalidate that A is safe to retire
 * and canonicalSection is the active B in local (camelCase) model format.
 * Optional expectedSource scalar fields guard evidence against local edits
 * between caller validation and this transaction; no cloud decisions occur here.
 * No IDs other than the abandoned section ID are changed.
 */
export async function rekeyLocalSectionIdentity({ fromSectionId, canonicalSection, expectedSource } = {}) {
  const toSectionId = canonicalSection?.id;
  if (typeof fromSectionId !== 'string' || !fromSectionId ||
      typeof toSectionId !== 'string' || !toSectionId || fromSectionId === toSectionId) {
    return { ok: false, status: 'invalid-input' };
  }

  let result;
  let committed;
  try {
    // Clone once so the caller cannot alter inputs while IndexedDB is opening.
    const supplied = structuredClone(canonicalSection);
    const expected = expectedSource && structuredClone(expectedSource);
    committed = await db.applyBatch({ sections: {}, teachings: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const source = current.sections.find((record) => record.id === fromSectionId);
        const existing = current.sections.find((record) => record.id === toSectionId);
        const teachings = current.teachings.filter((record) => record.sectionId === fromSectionId)
          .map((record) => ({ ...record, sectionId: toSectionId }));
        const enrollments = current.enrollments.filter((record) => record.sectionId === fromSectionId)
          .map((record) => ({ ...record, sectionId: toSectionId }));
        const obsolete = current.outbox.filter((entry) => entry.id === `sections:${fromSectionId}` ||
          (entry.store === 'sections' && entry.recordId === fromSectionId)).map((entry) => entry.id);

        if (!source) {
          result = existing && !teachings.length && !enrollments.length && !obsolete.length
            ? { ok: true, status: 'already-rekeyed', sectionId: toSectionId }
            : { ok: false, status: 'source-missing' };
          return {};
        }

        if (expected && Object.entries(expected).some(([field, value]) => source[field] !== value)) {
          result = { ok: false, status: 'source-changed' };
          return {};
        }

        // Supplied canonical fields win; fields not supplied remain local.
        // Undefined mapping fields must not erase local extension fields.
        const canonical = { ...existing,
          ...Object.fromEntries(Object.entries(supplied).filter(([, value]) => value !== undefined)),
          id: toSectionId };
        const pending = new Set(current.outbox.map((entry) => `${entry.store}:${entry.recordId}`));
        const queued = [];
        for (const [name, records] of [['teachings', teachings], ['enrollments', enrollments]]) {
          for (const record of records) {
            // Outbox fields are field NAMES, not payloads. Preserve existing
            // entries (including delete intent); serialization reads the record.
            if (pending.has(`${name}:${record.id}`)) continue;
            const entry = outboxEntry(name, record, ['sectionId'], record.deleted ? 'delete' : 'patch');
            if (entry) queued.push(entry);
          }
        }
        result = { ok: true, status: 'rekeyed', sectionId: toSectionId,
          teachings: teachings.length, enrollments: enrollments.length };
        return {
          sections: { remove: [fromSectionId], put: [canonical] },
          teachings: { put: teachings },
          enrollments: { put: enrollments },
          outbox: { remove: obsolete, put: queued },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'rekeyLocalSectionIdentity', fromSectionId, toSectionId });
    return { ok: false, status: 'write-failed', error: error.message };
  }

  if (result.ok) {
    const changes = [{ store: 'sections', id: fromSectionId }, { store: 'sections', id: toSectionId }];
    for (const name of ['teachings', 'enrollments']) {
      changes.push(...changeList(name, committed[name]?.put ?? []));
    }
    // Memory is updated only after commit. Reuse the normal cross-tab refresh
    // path, reading current disk values rather than overwriting optimistic edits.
    await absorb(changes);
    if (result.status === 'rekeyed') broadcast(changes);
  }
  return result;
}

/**
 * Pristine-only, local atomic adoption. Caller supplies exact authenticated
 * TA-absent/TB-active evidence; no cloud decisions or history rekeys occur here.
 * All stores participate in the transaction so concurrent meaningful work is
 * observed before cleanup. Only teachings/items/outbox receive writes.
 */
export async function adoptPristineTeachingIdentity({ fromTeachingId, canonicalTeaching, expectedSource, validateEvidence } = {}) {
  const toId = canonicalTeaching?.id;
  const blocked = (reason, code = 'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION') =>
    ({ ok: false, code, reason });
  if (typeof fromTeachingId !== 'string' || !fromTeachingId || typeof toId !== 'string' || !toId || fromTeachingId === toId) {
    return blocked('invalid-input');
  }
  let result;
  try {
    const supplied = structuredClone(canonicalTeaching);
    const expected = expectedSource && structuredClone(expectedSource);
    await db.applyBatch(Object.fromEntries(db.STORES.map((name) => [name, {}])), {
      prepare(current) {
        if (validateEvidence && !validateEvidence()) {
          result = blocked('evidence-changed', 'TEACHING_IDENTITY_PRESENCE_UNKNOWN'); return {};
        }
        const source = current.teachings.find((row) => row.id === fromTeachingId);
        const existing = current.teachings.find((row) => row.id === toId);
        const sameKey = (row) => row && ['sectionId', 'subjectId', 'termId'].every((key) =>
          typeof supplied[key] === 'string' && supplied[key] && row[key] === supplied[key]);
        if (supplied.deleted !== false || (existing && (existing.deleted || !sameKey(existing)))) {
          result = blocked('canonical-changed'); return {};
        }
        if (!source) {
          result = existing && sameKey(existing) && !hasTeachingReferences(current, fromTeachingId)
            ? { ok: true, status: 'already-adopted', teachingId: toId, abandonedItemIds: [] }
            : blocked('source-missing');
          return {};
        }
        if (!sameKey(source) || (expected && !samePristineRecord(source, expected))) {
          result = blocked('source-changed'); return {};
        }
        const checked = inspectPristineTeaching(current, fromTeachingId);
        if (!checked.pristine) { result = blocked(checked.reason); return {}; }
        result = { ok: true, status: 'adopted', teachingId: toId, abandonedItemIds: checked.itemIds };
        return {
          teachings: { remove: [fromTeachingId], put: [existing ?? supplied] },
          items: { remove: checked.itemIds },
          outbox: { remove: checked.outboxIds },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'adoptPristineTeachingIdentity', fromTeachingId, toId });
    return blocked(error.message, 'TEACHING_IDENTITY_ADOPTION_WRITE_FAILED');
  }
  if (result.ok) {
    // A peer may have committed first while this tab still holds the retired
    // teaching/defaults. A write-free repeat must refresh that memory as well.
    const staleItemIds = state.items.filter((row) => row.teachingId === fromTeachingId).map((row) => row.id);
    const itemIds = new Set([...result.abandonedItemIds, ...staleItemIds]);
    const changes = [{ store: 'teachings', id: fromTeachingId, replacementId: toId },
      { store: 'teachings', id: toId }, ...[...itemIds].map((id) => ({ store: 'items', id }))];
    await absorb(changes);
    if (result.status === 'adopted') broadcast(changes);
  }
  return result;
}

/**
 * تعديل حقول محددة في سجل قائم.
 * الأساس يُقرأ من القرص داخل المعاملة، فلا يُكتب إلا الحقول المطلوبة فوق
 * أحدث نسخة موجودة.
 */
export async function patch(storeName, id, changes, create = null, options = {}) {
  if (storeName !== 'device') assertLeaseWritable();
  // profile و device سجلان مفردان لا مصفوفتان — ولا يدخل device في الصادر أبدًا
  const singleton = storeName === 'profile' || storeName === 'device';
  const arr = state[storeName];
  const idx = Array.isArray(arr) ? arr.findIndex((r) => r.id === id) : -1;

  const known = singleton ? state[storeName] : idx >= 0 ? arr[idx] : null;
  const base = known ?? create;
  if (!base) return null;
  if (options.queue !== false) assertOperationalWritesAllowed({ [storeName]: [{ ...base, ...changes, id }] });

  const preserve = options.preserveTimestamp && changes.updatedAt !== undefined;
  const newStamp = preserve ? changes.updatedAt : now();
  const shouldNotify = options.notify !== false;
  const shouldRender = options.render !== false;
  const operation = options.v2Operation ?? (changes.deleted === true ? 'delete' : (!known && create ? 'create' : 'patch'));
  const optimistic = syncV2Record(storeName, { ...base, ...changes, id, updatedAt: newStamp }, {
    pendingCreate: operation === 'create',
  });
  const undo = singleton ? [] : applyToMemory(storeName, [optimistic]);
  const previous = singleton ? state[storeName] : null;
  if (singleton) state[storeName] = optimistic;
  if (shouldNotify) notify({ render: shouldRender, syncReady: false });

  try {
    const [authoritative] = await db.patchMany(
      storeName,
      [{ id, changes, create: create ? { ...create, id } : null }],
      storeName === 'device' || options.queue === false ? null : (rec, fields) =>
        outboxEntry(storeName, syncV2Record(storeName, rec, { pendingCreate: operation === 'create' }),
          fields, operation, known),
      newStamp
    );

    if (!authoritative) {
      if (singleton) state[storeName] = previous;
      else revertMemory(storeName, [optimistic], undo);
      if (shouldNotify) notify({ syncReady: false });
      return null;
    }

    // patchMany preserves the optimistic record exactly in the normal path.
    // Do not replace the active screen a second time just to install that same
    // record after IndexedDB confirms it; a genuinely different authoritative
    // record still updates memory and notifies every subscriber.
    const authoritativeChanged = JSON.stringify(optimistic) !== JSON.stringify(authoritative);
    if (authoritativeChanged) {
      if (singleton) state[storeName] = authoritative;
      else applyToMemory(storeName, [authoritative]);
    }
    broadcast([{ store: storeName, id }]);
    if (shouldNotify) {
      notify({
        render: authoritativeChanged && shouldRender,
        syncReady: options.queue !== false && storeName !== 'device' && !!SYNC_V2_SCHEMAS[storeName],
      });
    }
    return authoritative;
  } catch (err) {
    if (singleton) state[storeName] = previous;
    else revertMemory(storeName, [optimistic], undo);
    if (shouldNotify) notify({ syncReady: false });
    reportWriteError(err, { op: 'patch', store: storeName, id, fields: Object.keys(changes) });
    return null;
  }
}

export const touch = (rec, changes = {}) => ({ ...rec, ...changes, updatedAt: now() });

export async function upsert(storeName, rec) {
  const ok = await save({ [storeName]: [rec] });
  return ok ? rec : null;
}

export const softDelete = (storeName, id) => storeName === 'sessions'
  ? deleteSession(id)
  : patch(storeName, id, { deleted: true }, null, { v2Operation: 'delete' });

/** بيانات المعلّم — تُصدَّر في النسخ الاحتياطية وتُدمج. */
export const patchProfile = (changes, options = {}) => patch('profile', 'profile', changes, { ...DEFAULT_PROFILE }, options);

// AI: only the explicit guarded source run may replace available profile values.
export async function importSetupProfile(changes, { verifyCurrent, sourceWins = false } = {}) {
  assertClassImportAccess();
  const workspace=activeWorkspace, session=cloud.session;
  const guard=current=>{
    if(activeWorkspace!==workspace||cloud.session!==session)throw Error('SETUP_PROFILE_OWNER');
    assertClassImportAccess();
    verifyCurrent?.(current);
  };
  if(state.profile?.ownerId&&state.profile.ownerId!==workspace.authUserId)throw Error('SETUP_PROFILE_OWNER');
  const fields = ['teacherName','schoolName','principalName','reportPrincipalName','educationDepartment'];
  if(Object.keys(changes).some(k=>!fields.includes(k)))throw Error('SETUP_PROFILE_FIELD');
  if(sourceWins&&typeof verifyCurrent!=='function')throw Error('SETUP_PROFILE_FIELD');
  if(changes.educationDepartment){
    const {EDUCATION_DEPARTMENTS,isOfficialEducationDepartment}=await import('./lib/education-department-directory.js');
    if(!isOfficialEducationDepartment(EDUCATION_DEPARTMENTS,changes.educationDepartment))throw Error('SETUP_PROFILE_FIELD');
  }
  const previous=structuredClone(state.profile);
  if(Object.entries(changes).some(([k,v])=>typeof v!=='string'||!v.trim()||v.length>80||!sourceWins&&state.profile[k]&&state.profile[k]!==v))throw Error('SETUP_PROFILE_CONFLICT');
  let phase='transaction';
  try {
    // SINGLETON: compare the same hydrated shape as init/refresh, then prepare
    // the profile and its owner-bound outbox atomically. No optimistic render
    // may replace the snapshot while verifyCurrent is still checking it.
    const committed=await db.applyBatch({profile:{},outbox:{},device:{},years:{},terms:{}},{prepare(current){
      guard(current);
      const raw=current.profile.find(p=>p.id==='profile');
      const hydrated={...DEFAULT_PROFILE,...raw};
      if(raw?.ownerId&&raw.ownerId!==workspace.authUserId)throw Error('SETUP_PROFILE_OWNER');
      const keys=[...new Set([...Object.keys(hydrated),...Object.keys(previous)])];
      if(keys.some(k=>JSON.stringify(hydrated[k])!==JSON.stringify(previous[k])))throw Error('SETUP_PROFILE_CHANGED');
      const next=syncV2Record('profile',{...hydrated,...changes,updatedAt:now()},{pendingCreate:!raw});
      const changed=Object.keys(changes).filter(k=>hydrated[k]!==changes[k]);
      const entry=changed.length?outboxEntry('profile',next,raw?changed:null,'put',raw??null):null;
      const device=current.device.find(d=>d.id==='device');
      const legacy=sourceWins&&device&&['teacherName','schoolName','principalName'].some(k=>Object.hasOwn(changes,k)&&Object.hasOwn(device,k));
      const cleaned=legacy?{...device}:null;
      if(cleaned)for(const k of ['teacherName','schoolName','principalName'])if(Object.hasOwn(changes,k))delete cleaned[k];
      return {...(changed.length?{profile:{put:[next]}}:{}),...(cleaned?{device:{put:[cleaned]}}:{}),...(entry&&(entry.op==='create'||entry.fields.length)?{outbox:{put:[entry]}}:{})};
    }});
    phase='readback';
    guard();
    const profile=committed.profile?.put[0];
    if(committed.device?.put[0])state.device={...state.device,...committed.device.put[0]};
    if(sourceWins)for(const k of ['teacherName','schoolName','principalName'])if(Object.hasOwn(changes,k))delete state.device[k];
    if(profile)state.profile=profile;
    if(profile||committed.device?.put[0]){broadcast([...(profile?[{store:'profile',id:'profile'}]:[]),...(committed.device?.put[0]?[{store:'device',id:'device'}]:[])]);notify();}
    return state.profile;
  } catch(cause) {
    reportWriteError(cause,{op:'importSetupProfile',phase});
    // Finite non-PII cause survives the public wrapper and extension receipt.
    const codes=['SETUP_PROFILE_CHANGED','SETUP_PROFILE_OWNER','BATCH_OWNER_OR_SESSION_CHANGED','BATCH_PERSISTED_TERM_CHANGED','BATCH_PERSISTED_CONTEXT_CHANGED','OFFLINE_LEASE_LIMITED','DataError','DataCloneError','QuotaExceededError','AbortError','ConstraintError'];
    const code=codes.includes(cause.code)?cause.code:codes.includes(cause.message)?cause.message:codes.includes(cause.name)?cause.name:'WRITE_FAILED';
    throw Object.assign(Error('SETUP_PROFILE_SAVE',{cause}),{code,phase});
  }
}

/** إعدادات هذا الجهاز — لا تغادره ولا يستوردها ملف نسخة. */
export const patchDevice = (changes, options = {}) => patch('device', 'device', changes, { ...DEFAULT_DEVICE }, options);

async function patchManyRecords(storeName, edits, context) {
  if (!edits.length) return true;
  assertOperationalWritesAllowed({ [storeName]: edits.map(({ id, changes }) => ({
    ...(state[storeName]?.find((record) => record.id === id) ?? {}), ...changes, id,
  })) });
  try {
    const updated = await db.patchMany(storeName, edits,
      (rec, fields) => outboxEntry(storeName, rec, fields, 'patch'));
    applyToMemory(storeName, updated);
    notify();
    broadcast(changeList(storeName, updated));
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

async function cascadeDelete(predicates, context, lifecycle = null) {
  try {
    let commandQueued = false;
    const { touched } = await db.markDeleted(predicates, now(), (storeName, record) => {
      if (lifecycle) {
        if (commandQueued || storeName !== lifecycle.store || record.id !== lifecycle.targetId) return null;
        commandQueued = true;
        return lifecycleCommandEntry(lifecycle.command, lifecycle.targetId, lifecycle.store, record.updatedAt);
      }
      return CASCADE_SYNCABLE_STORES.has(storeName)
        ? outboxEntry(storeName, record, null, 'delete')
        : null;
    });
    const changes = [];
    for (const [storeName, ids] of Object.entries(touched)) {
      const arr = state[storeName];
      if (!Array.isArray(arr)) continue;
      for (const id of ids) {
        const i = arr.findIndex((r) => r.id === id);
        if (i >= 0) arr[i] = { ...arr[i], deleted: true, updatedAt: now() };
        changes.push({ store: storeName, id });
      }
    }
    notify();
    broadcast(changes);
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

/* ---------- المظهر ---------- */

export function applyTheme() {
  const t = state.device?.theme ?? 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);

  // IndexedDB remains authoritative. This same-origin mirror exists only so
  // index.html can select the correct palette before asynchronous DB startup.
  if (t === 'light' || t === 'dark' || t === 'auto') {
    try { globalThis.localStorage?.setItem(THEME_BOOT_STORAGE_KEY, t); } catch {}
  }

  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1216' : '#0f766e');
}

/* ---------- المحدِّدات ---------- */

const live = (arr) => arr.filter((r) => !r.deleted);

export const years = () => [...live(state.years)].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
export const activeYear = () => {
  const year = state.years.find((y) => y.id === state.device?.activeYearId && !y.deleted) ?? live(state.years)[0] ?? null;
  const status = calendarReadStatus(year?.id);
  // Display-only warning in existing year subtitles. Raw records and identities
  // remain authoritative; this is not a repaired/effective foundation.
  return year && !status.ok ? { ...year, label: `${year.label} — ${status.warning}` } : year;
};

export const termsOf = (yId) =>
  live(state.terms).filter((t) => !yId || t.yearId === yId).map(t => calendarTermForRead(t)).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
export const activeTerm = () =>
  calendarTermForRead(state.terms.find((t) => t.id === state.device?.activeTermId && !t.deleted)) ??
  termsOf(activeYear()?.id)[0] ?? null;

/** أرقام الفصول الدراسية المستعملة فعلًا في السنة النشطة — وإلا فإعداد المنتج. */
export function activeTermIndexes() {
  const list = termsOf(activeYear()?.id).map((t) => t.index).filter(Boolean);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : termIndexes();
}

export const getTerm = (id) => state.terms.find((t) => t.id === id && !t.deleted) ?? null;
export const getYear = (id) => state.years.find((y) => y.id === id && !y.deleted) ?? null;

/** هل الفصل الدراسي مغلق؟ عندها تُمنع الكتابة عليه. */
export const isTermClosed = (tmId) => {
  const t = getTerm(tmId);
  if (!t) return false;
  const y = getYear(t.yearId);
  return t.status === 'closed' || y?.status === 'archived';
};

export const subjects = () => live(state.subjects).sort((a, b) => compareArabic(a.name, b.name));
export const getSubject = (id) => state.subjects.find((s) => s.id === id && !s.deleted) ?? null;

/** مواد الفهرس الثابت مع مواد المعلّم المستخدمة، من دون إنشاء سجلات غير مستخدمة. */
export function subjectOptions() {
  const usedIds = live(state.teachings).map((teaching) => teaching.subjectId);
  return subjectCatalogOptions(live(state.subjects), usedIds);
}

export const isSectionArchived = (sectionOrId) => {
  const section = typeof sectionOrId === 'string' ? getSection(sectionOrId) : sectionOrId;
  return section?.status === 'archived';
};

export const sections = (yId = activeYear()?.id, { includeArchived = false } = {}) =>
  sortByOrder(live(state.sections).filter((s) => (!yId || s.yearId === yId) && (includeArchived || !isSectionArchived(s))));
export const archivedSections = (yId = activeYear()?.id) =>
  sortByOrder(live(state.sections).filter((s) => (!yId || s.yearId === yId) && isSectionArchived(s)));
export const getSection = (id) => state.sections.find((s) => s.id === id && !s.deleted) ?? null;

/** الإسنادات التدريسية في فصل دراسي — وهي ما يراه المعلّم في «الفصول». */
export const teachings = (tmId = activeTerm()?.id, { includeArchived = false } = {}) =>
  sortByOrder(live(state.teachings).filter((t) =>
    (!tmId || t.termId === tmId) && (includeArchived || !isSectionArchived(t.sectionId))));
export const getTeaching = (id) => state.teachings.find((t) => t.id === id && !t.deleted) ?? null;
export const isTeachingArchived = (teachingOrId) => {
  const teaching = typeof teachingOrId === 'string' ? getTeaching(teachingOrId) : teachingOrId;
  return !!teaching && isSectionArchived(teaching.sectionId);
};

/** وصف مقروء للفصل والمادة: «الرابع الابتدائي / أ · الرياضيات». */
export function teachingLabel(tch) {
  if (!tch) return '';
  const sec = getSection(tch.sectionId);
  const sub = getSubject(tch.subjectId);
  return [sectionLabel(sec), sub?.name].filter(Boolean).join(' · ');
}

export const getStudent = (id) => state.students.find((s) => s.id === id && !s.deleted) ?? null;
export const allStudents = () => live(state.students);

export const enrollmentsOf = (studentId) =>
  live(state.enrollments).filter((e) => e.studentId === studentId);
export const enrollmentsIn = (secId) =>
  live(state.enrollments).filter((e) => e.sectionId === secId);
export const activeEnrollment = (studentId) =>
  enrollmentsOf(studentId).find((e) => e.status === 'active') ?? null;

/**
 * كشف الشعبة: الطلاب المنتسبون حاليًا، مدموجًا معهم rollNo من الانتساب.
 * الشاشات تقرأ الطالب كما كانت تمامًا — ولا تعرف بوجود جدول الانتساب.
 */
export function sectionRoster(secId) {
  const rows = [];
  for (const en of enrollmentsIn(secId)) {
    if (en.status !== 'active') continue;
    const st = getStudent(en.studentId);
    if (!st) continue;
    rows.push({ ...st, rollNo: en.rollNo, enrollmentId: en.id, sectionId: secId });
  }
  return sortStudents(rows);
}

// AI: names-only imports need no invented teaching to read their saved roster.
// Local ownerless rows retain the mounted account DB's receipt-bound provenance.
export function readCurrentSectionRoster(secId) {
  const workspace = assertClassImportAccess();
  const section = getSection(secId);
  if (!section || section.yearId !== activeYear().id || isSectionArchived(section)) {
    throw new Error('الفصل غير متاح في السنة الحالية.');
  }
  const enrollments = enrollmentsIn(secId).filter(row => row.status === 'active');
  const students = sectionRoster(secId);
  if (workspace.type === 'account' && [section, ...enrollments, ...students].some(row =>
    row.ownerId != null && row.ownerId !== workspace.authUserId)) {
    throw new Error('تعذّرت مطابقة كشف الفصل مع الحساب الحالي.');
  }
  return { section, students };
}

/** كشف الإسناد = كشف شعبته. */
export const students = (tchId) => {
  const tch = getTeaching(tchId);
  return tch ? sectionRoster(tch.sectionId) : [];
};

export const groupArrangementOf = (tchId) => live(state.groupArrangements)
  .find((record) => record.teachingId === tchId) ?? null;

/**
 * يعرض الترتيب على كشف الإسناد الحالي: يحذف المنقول/المزال، يمنع التكرار،
 * ويلحق الطالب الجديد بأصغر مجموعة. لا يكتب هذا الإسقاط ولا يغيّر الحضور.
 */
export function projectGroupArrangement(tchId, arrangement = groupArrangementOf(tchId)?.groups ?? []) {
  if (!Array.isArray(arrangement) || !arrangement.length) return [];
  const roster = students(tchId);
  const eligible = new Set(roster.map((student) => student.id));
  const seen = new Set();
  const projected = arrangement.map((group) => (Array.isArray(group) ? group : [])
    .filter((studentId) => typeof studentId === 'string' && eligible.has(studentId) && !seen.has(studentId) && seen.add(studentId)));
  for (const student of roster) {
    if (seen.has(student.id)) continue;
    const target = projected.reduce(
      (smallest, group, index) => group.length < projected[smallest].length ? index : smallest,
      0,
    );
    if (projected.length) projected[target].push(student.id);
  }
  return projected;
}

export async function saveGroupArrangement(tchId, arrangement) {
  const teaching = getTeaching(tchId);
  if (!teaching) throw new Error('الفصل غير موجود.');
  if (isTeachingArchived(teaching)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const groups = projectGroupArrangement(tchId, arrangement);
  if (!groups.length) return null;
  const existing = groupArrangementOf(tchId);
  if (existing) return patch('groupArrangements', existing.id, { groups });
  const id = groupArrangementId(tchId);
  const record = makeGroupArrangement({ id, teachingId: tchId, groups });
  return (await save({ groupArrangements: [record] })) ? record : null;
}

export const items = (tchId) =>
  sortByOrder(live(state.items).filter((i) => i.teachingId === tchId));

/** قوانين الإسناد محفوظة بترتيب إنشائها فقط؛ لا يوجد حقل ترتيب مستقل في V1. */
export const classRulesOf = (tchId) => [...live(state.classRules)]
  .filter((rule) => rule.teachingId === tchId)
  .sort((left, right) => Number(left.createdAt ?? left.updatedAt ?? 0) - Number(right.createdAt ?? right.updatedAt ?? 0) ||
    String(left.id).localeCompare(String(right.id)));

export const classGoalId = (tchId) => `class-goal:${tchId}`;
export const classCharterSelectionId = (tchId) => `class-charter-selection:${tchId}`;

export const classGoalOf = (tchId) => live(state.classGoals)
  .find((goal) => goal.teachingId === tchId && goal.id === classGoalId(tchId)) ?? null;

export const activeClassGoal = (tchId) => {
  const goal = classGoalOf(tchId);
  if (!goal || goal.state !== 'active' || isTeachingArchived(tchId) || isTermClosed(getTeaching(tchId)?.termId)) return null;
  return goal;
};

export function selectedClassRules(tchId) {
  const rules = classRulesOf(tchId);
  const config = live(state.classCharterSelections).find((row) => row.teachingId === tchId);
  if (!config) return rules;
  const selected = new Set(config.selectedRuleIds ?? []);
  return rules.filter((rule) => selected.has(rule.id));
}

export const scoresOf = (studentId) => live(state.scores).filter((s) => s.studentId === studentId);

function portableGroup(item) {
  return item && !item.deleted && item.scoreMode !== 'subitems' &&
    typeof item.portabilityGroupId === 'string' && item.portabilityGroupId.trim()
    ? item.portabilityGroupId : null;
}

function scoreForItem(studentId, itemId) {
  return scoresOf(studentId).find((score) => score.itemId === itemId) ?? null;
}

/** Historical name/max similarity is never authority to reuse or edit a score. */
function portableGradeScore(studentId, item) {
  const direct = scoreForItem(studentId, item?.id);
  if (direct) return direct;

  const group = portableGroup(item);
  const teaching = getTeaching(item?.teachingId);
  if (!group || !teaching || item.auto) return null;
  if (items(teaching.id).filter((candidate) => portableGroup(candidate) === group).length !== 1) return null;

  // لا نعرض درجة من شعبة لم ينتسب إليها الطالب قط، حتى لو صادف أنها تحمل
  // مادة وبندًا بالاسم نفسيهما.
  const targetSection = getSection(teaching.sectionId);
  const targetEnrollment = enrollmentsOf(studentId).find((enrollment) => enrollment.sectionId === teaching.sectionId);
  if (!targetSection || !targetEnrollment) return null;
  const transferredSections = new Set(enrollmentsOf(studentId)
    .filter((enrollment) => enrollment.status === 'transferred')
    .map((enrollment) => enrollment.sectionId));
  const candidates = [];
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !transferredSections.has(sourceTeaching.sectionId) ||
        getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId ||
        getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
    const matches = items(sourceTeaching.id)
      .filter((candidate) => !candidate.auto && portableGroup(candidate) === group);
    if (matches.length !== 1) continue;
    const score = scoreForItem(studentId, matches[0].id);
    if (score) candidates.push(score);
  }

  return candidates.length === 1 ? candidates[0] : null;
}

/** سياق درجات يدوي قابل للنقل من دون نسخ سجلات الدرجات. */
function portableScoresByItem(studentId, tchId) {
  const directScores = indexScores(scoresOf(studentId));
  const out = Object.create(null);
  for (const item of items(tchId)) {
    const score = directScores[item.id] ?? portableGradeScore(studentId, item);
    if (score) out[item.id] = score;
  }
  return out;
}

export const attendanceOf = (studentId) =>
  live(state.attendance).filter((a) => a.studentId === studentId);

export const logsOf = (studentId) => live(state.logs).filter((l) => l.studentId === studentId);

function automaticItemIdentity(item) {
  if (!item?.auto) return null;
  const name = normalizeSearchText(item.name);
  if (!name) return null;
  return `${item.auto}\u0000${name}`;
}

function automaticItemKey(item) {
  const identity = automaticItemIdentity(item);
  const max = Number(item?.max);
  if (!identity || !Number.isFinite(max) || max <= 0) return null;
  const factor = item.auto === 'participation' ? Number(item.perPoint ?? 1) :
    item.auto === 'attendance' ? Number(item.penalty ?? 1) : null;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return `${identity}\u0000${max}\u0000${factor}`;
}

function dedupeRecords(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

/**
 * سياقات الطالب التي يمكن أن تمثل بندًا آليًا واحدًا. أي بند بنفس الاسم
 * والنوع لكن بإعداد مختلف يجعل النتيجة غير مؤكدة، فلا نعرض درجة مُخمّنة.
 */
function compatibleAutomaticTeachingIds(studentId, item) {
  const teaching = getTeaching(item?.teachingId);
  const group = portableGroup(item);
  const key = automaticItemKey(item);
  if (!teaching || !key) return null;
  if (!group) return new Set([teaching.id]);

  const targetMatches = items(teaching.id).filter((candidate) =>
    portableGroup(candidate) === group);
  if (targetMatches.length !== 1 || automaticItemKey(targetMatches[0]) !== key) return null;

  const targetSection = getSection(teaching.sectionId);
  const targetEnrollment = enrollmentsOf(studentId).find((enrollment) => enrollment.sectionId === teaching.sectionId);
  if (!targetSection || !targetEnrollment) return new Set([teaching.id]);
  const transferredSections = new Set(enrollmentsOf(studentId)
    .filter((enrollment) => enrollment.status === 'transferred')
    .map((enrollment) => enrollment.sectionId));
  const teachingIds = new Set([teaching.id]);
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !transferredSections.has(sourceTeaching.sectionId) ||
        getSection(sourceTeaching.sectionId)?.yearId !== targetSection.yearId ||
        getSection(sourceTeaching.sectionId)?.grade !== targetSection.grade) continue;
    const sameItem = items(sourceTeaching.id).filter((candidate) => portableGroup(candidate) === group);
    if (!sameItem.length) continue;
    if (sameItem.length !== 1 || automaticItemKey(sameItem[0]) !== key) return null;
    teachingIds.add(sourceTeaching.id);
  }
  return teachingIds;
}

/**
 * إسقاط آلي فقط: يجمع سجل الطالب الموجود عبر الإسنادات المتوافقة، ولا ينشئ
 * درجات أو حضورًا أو رصدًا جديدًا. لكل بند نطاقه كي لا تختلط إعدادات مختلفة.
 */
function portableAutomaticByItem(studentId, tchId) {
  const out = Object.create(null);
  for (const item of items(tchId).filter((candidate) => candidate.auto)) {
    const teachingIds = compatibleAutomaticTeachingIds(studentId, item);
    if (!teachingIds) {
      out[item.id] = null;
      continue;
    }
    if (item.auto === 'participation') {
      out[item.id] = {
        logs: dedupeRecords(logsOf(studentId).filter((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation')),
        classHasParticipation: live(state.logs).some((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation'),
      };
    } else if (item.auto === 'attendance') {
      out[item.id] = {
        attendance: dedupeRecords(attendanceOf(studentId).filter((record) =>
          teachingIds.has(record.teachingId))),
      };
    }
  }
  return out;
}

/** سجل ملاحظات الطالب هو المصدر القانوني؛ الأحدث أولًا لسهولة المتابعة اليومية. */
export const notesOf = (studentId) => live(state.notes)
  .filter((n) => n.studentId === studentId)
  .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) ||
    Number(b.createdAt ?? b.updatedAt ?? 0) - Number(a.createdAt ?? a.updatedAt ?? 0) ||
    Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));

/* ---------- الحصص ---------- */

export const sessionsOf = (tchId) =>
  live(state.sessions)
    .filter((s) => s.teachingId === tchId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period));

export const sessionsOn = (date) =>
  live(state.sessions).filter((s) => s.date === date && !isTeachingArchived(s.teachingId))
    .sort((a, b) => a.period - b.period);

export const sessionsOnFor = (tchId, date) =>
  live(state.sessions).filter((s) => s.teachingId === tchId && s.date === date)
    .sort((a, b) => a.period - b.period);

export const getSession = (id) => state.sessions.find((s) => s.id === id && !s.deleted) ?? null;

export const attendanceIn = (sesId) => live(state.attendance).filter((a) => a.sessionId === sesId);

export const sessionRosterSnapshotId = (sesId) => `srs:${sesId}`;

export const sessionRosterSnapshot = (sesId) =>
  live(state.sessionRosterSnapshots).find((snapshot) =>
    snapshot.sessionId === sesId && snapshot.state === 'complete') ?? null;

/**
 * مصدر كشف الحصة: اللقطة المثبتة هي الحقيقة بعد أول رصد. قبلها فقط تظهر
 * القائمة النشطة كمعاينة لعملية الرصد القادمة، ولا تصبح حقيقة تاريخية إلا
 * داخل معاملة أول رصد حضور.
 */
export function sessionRoster(ses) {
  if (!ses) return { source: 'active', members: [], snapshot: null };
  const snapshot = sessionRosterSnapshot(ses.id);
  if (!snapshot) return { source: 'active', members: students(ses.teachingId), snapshot: null };
  return {
    source: 'snapshot',
    snapshot,
    members: snapshot.members.map((member) => {
      const student = getStudent(member.studentId);
      return {
        ...(student ?? { id: member.studentId, name: 'طالب محفوظ' }),
        id: member.studentId,
        rollNo: member.rollNo ?? null,
      };
    }),
  };
}

function snapshotRosterFromCurrent(current, ses) {
  const teaching = current.teachings.find((record) => record.id === ses.teachingId && !record.deleted);
  if (!teaching) return null;
  const studentsById = new Map(current.students.filter((record) => !record.deleted).map((record) => [record.id, record]));
  const members = current.enrollments
    .filter((record) => !record.deleted && record.sectionId === teaching.sectionId && record.status === 'active' && studentsById.has(record.studentId))
    .map((record) => ({ studentId: record.studentId, rollNo: record.rollNo ?? null, name: studentsById.get(record.studentId).name ?? '' }))
    .sort((left, right) =>
      (left.rollNo ?? Number.MAX_SAFE_INTEGER) - (right.rollNo ?? Number.MAX_SAFE_INTEGER) ||
      String(left.name).localeCompare(String(right.name), 'ar') ||
      left.studentId.localeCompare(right.studentId))
    .map(({ studentId, rollNo }) => ({ studentId, rollNo }));
  return { teaching, members };
}

function applyCommittedPuts(writes) {
  const changes = [];
  for (const [storeName, operations] of Object.entries(writes ?? {})) {
    if (storeName === 'outbox' || !Array.isArray(state[storeName])) continue;
    const records = operations.put ?? [];
    if (!records.length) continue;
    applyToMemory(storeName, records);
    changes.push(...changeList(storeName, records));
  }
  notify();
  broadcast(changes);
}

async function mutateSnapshotAttendance(sesId, makeRecords, commandKind = 'record') {
  const knownSession = getSession(sesId);
  if (knownSession && isTeachingArchived(knownSession.teachingId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const stamp = now();
  let result = { kind: 'missing', records: [] };
  let committed;
  try {
    committed = await db.applyBatch({
      sessions: {}, teachings: {}, students: {}, enrollments: {}, attendance: {}, sessionRosterSnapshots: {}, outbox: {},
    }, {
      prepare(current) {
        const ses = current.sessions.find((record) => record.id === sesId && !record.deleted);
        if (!ses || ['cancelled_holiday', 'cancelled'].includes(ses.status)) return {};

        const existingAttendance = current.attendance.filter((record) => record.sessionId === sesId && !record.deleted);
        let snapshot = current.sessionRosterSnapshots.find((record) => record.sessionId === sesId && !record.deleted && record.state === 'complete');
        let isNewSnapshot = false;
        if (!snapshot) {
          // Existing experimental attendance predates this feature. Keep its
          // current behavior; never manufacture a historical snapshot for it.
          if (existingAttendance.length) {
            result = { kind: 'legacy', records: [] };
            return {};
          }
          const roster = snapshotRosterFromCurrent(current, ses);
          if (!roster) return {};
          snapshot = {
            id: sessionRosterSnapshotId(ses.id),
            sessionId: ses.id,
            teachingId: ses.teachingId,
            sectionId: roster.teaching.sectionId,
            capturedAt: stamp,
            members: roster.members,
            state: 'complete',
            updatedAt: stamp,
            deleted: false,
          };
          isNewSnapshot = true;
        }

        const records = makeRecords(snapshot.members, existingAttendance, ses, stamp)
          .map((record) => syncV2Record('attendance', record, {
            pendingCreate: !existingAttendance.some((candidate) => candidate.id === record.id),
          }));
        if (!records.length) {
          result = { kind: 'empty', records: [] };
          return {};
        }

        const nextSession = ses.status === 'scheduled'
          ? syncV2Record('sessions', { ...ses, status: 'held', updatedAt: stamp }) : null;
        const outbox = (commandKind === 'fill'
          ? [syncV2CommandEntry({
            store: 'attendance', recordId: `fill:${sesId}`, command: 'attendance:fill', stamp,
            patch: { sessionId: sesId, status: records[0]?.status, studentIds: records.map((record) => record.studentId) },
            dependencies: [
              { store: 'sessions', recordId: sesId, requiresServerRevision: true },
              ...records.map((record) => ({ store: 'students', recordId: record.studentId, requiresServerRevision: true })),
            ],
          })]
          : records.map((record) => syncV2CommandEntry({
            store: 'attendance', recordId: record.id, command: 'attendance:record', stamp,
            baseRevision: existingAttendance.find((candidate) => candidate.id === record.id)?.serverRevision ?? 0,
            patch: { sessionId: sesId, studentId: record.studentId, status: record.status, note: record.note ?? '' },
            dependencies: [
              { store: 'sessions', recordId: sesId, requiresServerRevision: true },
              { store: 'students', recordId: record.studentId, requiresServerRevision: true },
            ],
          }))).filter(Boolean);
        result = { kind: 'snapshot', records, snapshot };
        return {
          ...(isNewSnapshot ? { sessionRosterSnapshots: { put: [snapshot] } } : {}),
          attendance: { put: records },
          ...(nextSession ? { sessions: { put: [nextSession] } } : {}),
          outbox: { put: outbox },
        };
      },
    });
    applyCommittedPuts(committed);
    return result;
  } catch (err) {
    reportWriteError(err, { op: 'mutateSnapshotAttendance', sesId });
    return { kind: 'error', records: [] };
  }
}

/**
 * حالة اكتمال الحضور مشتقة من الحصة المؤرخة وسجل الحضور فقط؛ لا تُخزَّن
 * كحقل مستقل حتى لا تنفصل عن وقت الحصة التاريخي أو عن بيانات الحضور المزامنة.
 * لا تصبح الحصة مستحقة إلا بعد نهاية وقتها الفعلي في ذلك التاريخ.
 */
export function attendanceCompleteness(ses, reference = new Date()) {
  if (!ses) return { state: 'excluded', completed: false, due: false, recorded: 0, expected: 0 };
  if (['cancelled_holiday', 'cancelled', 'missed', 'postponed'].includes(ses.status)) {
    return { state: 'excluded', completed: false, due: false, recorded: 0, expected: 0 };
  }

  const roster = sessionRoster(ses).members;
  const rosterIds = new Set(roster.map((student) => student.id));
  const records = attendanceIn(ses.id).filter((record) => rosterIds.has(record.studentId));
  const expected = roster.length;
  const completed = expected > 0 && records.length >= expected;
  const end = ses.endTime || ses.startTime || '23:59';
  const dueAt = new Date(`${ses.date}T${end}`);
  const due = Number.isFinite(dueAt.getTime()) && reference.getTime() >= dueAt.getTime();

  if (completed) return { state: 'completed', completed, due, recorded: records.length, expected };
  if (due) return { state: 'pending', completed, due, recorded: records.length, expected };
  return { state: 'future', completed, due, recorded: records.length, expected };
}

/**
 * إسقاط تقارير التنفيذ: يربط الحصص المؤرخة بالإسناد الحالي وحالة اكتمال الحضور
 * المشتقة. لا يقرأ وقتًا من خانة الجدول المتكررة، فتظل الحصص التاريخية ثابتة.
 */
function liveExecutionReport({ yearId = activeYear()?.id, termId = activeTerm()?.id, reference = new Date(), includeArchived = false } = {}) {
  const scopedTerms = live(state.terms).filter((term) => term.yearId === yearId && (!termId || term.id === termId));
  const termIds = new Set(scopedTerms.map((term) => term.id));
  const scopedTeachings = live(state.teachings).filter((teaching) =>
    termIds.has(teaching.termId) && (includeArchived || !isSectionArchived(teaching.sectionId)));
  const teachingIds = new Set(scopedTeachings.map((teaching) => teaching.id));
  const rows = live(state.sessions)
    .filter((session) => teachingIds.has(session.teachingId))
    .map((session) => {
      const teaching = getTeaching(session.teachingId);
      const section = teaching ? getSection(teaching.sectionId) : null;
      const completeness = attendanceCompleteness(session, reference);
      return { session, teaching, section, completeness };
    })
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.period - b.session.period);
  const counts = { generated: rows.length, completed: 0, pending: 0, future: 0, excluded: 0 };
  for (const row of rows) counts[row.completeness.state]++;
  const eligible = counts.completed + counts.pending;
  const sectionIds = new Set(scopedTeachings.map((teaching) => teaching.sectionId));
  const students = live(state.enrollments).filter((enrollment) => sectionIds.has(enrollment.sectionId) && enrollment.status === 'active').length;
  return {
    terms: scopedTerms,
    teachings: scopedTeachings,
    rows,
    counts,
    sections: sectionIds.size,
    students,
    percentage: eligible ? Math.round((counts.completed / eligible) * 100) : null,
  };
}

export function executionReport(options = {}) {
  const termId = options.termId ?? activeTerm()?.id;
  const snapshot = latestClosedTermReport(termId);
  if (snapshot?.payload?.executionDocument) return structuredClone(snapshot.payload.executionDocument);
  return liveExecutionReport(options);
}
export function attendanceCompletenessFor(tchId, date = todayISO(), reference = new Date()) {
  const sessions = sessionsOnFor(tchId, date);
  const summary = { sessions: 0, completed: 0, pending: 0, future: 0 };
  for (const ses of sessions) {
    const status = attendanceCompleteness(ses, reference);
    if (status.state === 'excluded') continue;
    summary.sessions++;
    summary[status.state]++;
  }
  return summary;
}

/** كل التواريخ التي فيها حصص لهذا الإسناد، من الأحدث. */
export function sessionDates(tchId) {
  const set = new Set(sessionsOf(tchId).map((s) => s.date));
  return [...set].sort().reverse();
}

export const slotsOf = (tchId) =>
  live(state.slots).filter((s) => slotKind(s) === 'teaching' && s.teachingId === tchId)
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);

export const getSlot = (id) => live(state.slots).find((s) => s.id === id);

export const allSlots = (tmId = activeTerm()?.id) => {
  const ids = new Set(teachings(tmId).map((t) => t.id));
  return live(state.slots).filter((s) => isNonTeachingSlot(s) ? s.termId === tmId : ids.has(s.teachingId))
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);
};

/** عدد الحصص الأسبوعية لإسناد — مشتق من الجدول لا رقم ثابت. */
export const weeklyPeriods = (tchId) => slotsOf(tchId).length;

/* ---------- ملفات توقيت الحصص ---------- */

export const timeProfiles = () => sortByOrder(live(state.timeProfiles));

export const getTimeProfile = (id) =>
  state.timeProfiles.find((p) => p.id === id && !p.deleted) ?? null;

// A null/invalid owner selection deliberately does not adopt any old local
// device choice. Stable default IDs make first-use fallback deterministic on
// every device; custom-only legacy data still has a deterministic sort order.
const fallbackTimeProfile = () =>
  DEFAULT_TIME_PROFILES.map((profile) => getTimeProfile(profile.id)).find(Boolean)
  ?? timeProfiles()[0]
  ?? null;

export const activeTimeProfile = () =>
  getTimeProfile(state.profile?.activeTimeProfileId) ?? fallbackTimeProfile();

/** وقت حصة برقمها في يوم — من الملف النشط ما لم يُطلب غيره. */
export const timeFor = (wd, period, profile = activeTimeProfile(), grade = null, date = null, day = undefined) => {
  const p = resolveProfile(profile, date, day);
  return periodTime(p, wd, period, grade);
};

/** أرقام الحصص المتاحة في يوم حسب الملف النشط. */
export const availablePeriods = (wd = null, profile = activeTimeProfile(), date = null, day = undefined) => {
  const p = resolveProfile(profile, date, day);
  return periodNumbers(p, wd);
};

/** يستنتج الملف الفعلي ليوم معين حسب الأولوية: استثناء تقويم، تقويم مدمج، موسمي، ثم الملف النشط. */
export function resolveProfile(profile, date, explicitDay = undefined) {
  if (!profile || !date) return profile;

  const day = explicitDay === undefined ? calendarDayFor(date) : explicitDay;

  // يوم «عن بُعد» يستعمل وقت التوقيت المدمج نفسه، حتى لو كان الملف اليدوي الحالي موسمياً.
  if (day?.kind === 'remote') {
    const hybrid = timeProfiles().find((p) => p.overrides?.config?.type === 'hybrid') ?? profile;
    return {
      ...hybrid,
      periods: hybrid.overrides?.remote ?? hybrid.periods,
      overrides: { config: { type: 'remote', assembly: { enabled: false }, recess: { enabled: false }, gap: 0 } },
    };
  }

  const validProfiles = timeProfiles().filter(
    (p) => p.overrides?.config?.type !== 'hybrid' && p.activeFrom && p.activeFrom <= date && (!p.activeTo || p.activeTo >= date)
  );
  validProfiles.sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
  return validProfiles[0] ?? profile;
}

export const setActiveTimeProfile = (id) => {
  if (!getTimeProfile(id)) throw new Error('ملف التوقيت المحدد غير متاح.');
  return patchProfile({ activeTimeProfileId: id });
};

export async function createTimeProfile(data) {
  const p = makeTimeProfile({ order: timeProfiles().length, ...data });
  await save({ timeProfiles: [p] });
  return p;
}

export const deleteTimeProfile = (id) => softDelete('timeProfiles', id);

/* ---------- التقويم ---------- */

/** Detached runtime projection. Persistence continues to use raw state records. */
export function effectiveCalendar(yearId, { year = getYear(yearId), terms = state.terms.filter(t => t.yearId === yearId), calendars = state.calendars } = {}) {
  if (!year?.calendarPresetId) return null;
  // Released Demo v3 retained this historical identity beside its replacement
  // official second term. Keep that row/history raw, outside today's official
  // projection; real account ambiguity remains fail-closed in the resolver.
  if (activeWorkspace?.type === 'demo') terms = terms.filter(t => t.id !== 'demo:term:past');
  return resolveCalendarRuntime({ year, terms, presetId: year.calendarPresetId,
    customizations: calendars.filter(c => c.yearId === yearId && c.source === 'custom' && c.presetId).map(c => ({
      yearId, presetId: c.presetId, deleted: c.deleted,
      termDateOverrides: Object.entries(c.termDateOverrides ?? {}).map(([termId, pair]) => ({ termId, ...pair })),
      exceptions: state.calendarDays.filter(d => d.calendarId === c.id).map(d => ({ ...d })),
    })),
  });
}
export function effectiveYear(id) {
  const calendar = effectiveCalendar(id);
  if (calendar && !calendar.ok) throw new Error(`Calendar resolution failed: ${calendar.reason}`);
  return calendar?.year ?? getYear(id);
}
export function calendarReadStatus(yearId) {
  const calendar = effectiveCalendar(yearId);
  return calendar && !calendar.ok ? { ok: false, reason: calendar.reason,
    warning: 'بيانات التقويم غير مكتملة؛ المعروض من السجلات المحفوظة، وإنشاء الحصص متوقف حتى التحقق.' } : { ok: true };
}
function calendarTermForRead(term) {
  if (!term) return null;
  const calendar = effectiveCalendar(term.yearId);
  return calendar?.ok ? calendar.terms.find(t => t.id === term.id && !t.deleted) ?? term : term;
}
export function effectiveTerm(id) {
  const raw = getTerm(id), calendar = raw ? effectiveCalendar(raw.yearId) : null;
  if (calendar && !calendar.ok) throw new Error(`Calendar resolution failed: ${calendar.reason}`);
  return calendar?.terms.find(t => t.id === id && !t.deleted) ?? raw;
}
export const effectiveTermsOf = yearId => termsOf(yearId).map(t => effectiveTerm(t.id));

export const calendarsOf = yId => {
  const calendar = effectiveCalendar(yId);
  if (!calendar?.ok) return live(state.calendars).filter(c => c.yearId === yId);
  return [...live(state.calendars).filter(c => c.yearId === yId && c.source === 'custom' && c.presetId === calendar.preset.id),
    { id: `official:${yId}:${calendar.preset.id}`, yearId: yId, source: `preset:${calendar.preset.id}`, presetId: calendar.preset.id, projected: true }];
};
export const activeCalendar = () => calendarsOf(activeYear()?.id)[0] ?? null;

export const calendarDaysOf = calId => {
  const official = state.years.map(y => calendarsOf(y.id).find(c => c.id === calId && c.projected)).find(Boolean);
  if (official) return calendarPresetRecords(getCalendarPreset(official.presetId)).calendarDays.map(d => ({ ...d, calendarId: calId, id: `${calId}:${d.date}` }));
  return live(state.calendarDays).filter(d => d.calendarId === calId).sort((a, b) => a.date.localeCompare(b.date));
};

/** تصنيف يوم معيّن في تقويم السنة النشطة — أو null إن لم يُدخل. */
export function calendarDayFor(date) {
  return calendarDayForYear(activeYear()?.id, date);
}

/** يوم تقويم لسنة محددة — مهم عند عرض إسناد تاريخي لا يطابق السنة النشطة. */
export function calendarDayForYear(yearId, date) {
  const calendar = effectiveCalendar(yearId);
  if (calendar?.ok) {
    const day = resolveCalendarDate(calendar, date);
    if (!day.ok) throw new Error(`Calendar date resolution failed: ${day.reason}`);
    return day;
  }
  const matching = calendarsOf(yearId)
    .map((calendar) => ({ calendar, day: live(state.calendarDays).find((d) => d.calendarId === calendar.id && d.date === date) }))
    .filter(({ day }) => day);
  // A local custom exception is intentionally more specific than a preset day.
  return matching.find(({ calendar }) => calendar.source === 'custom')?.day ?? matching[0]?.day ?? null;
}

/** Same selected day for eligibility, timing and creation-time provenance. */
function selectedCalendarDay(year, date) {
  if (!year) return null;
  const canonical = year.serverCanonical ?? year;
  // Exact native legacy exception: genuinely unselected years need no context.
  // A pending removal of an acknowledged selection is not that exception.
  if (year.calendarPresetId == null && canonical.calendarPresetId == null) return null;
  const projection = effectiveCalendar(year.id, { year });
  if (!projection?.ok) throw new Error('بيانات التقويم غير مكتملة؛ تعذّر تحديد تقويم الحصة.');
  const preset = getCalendarPreset(year.calendarPresetId);
  if (!preset || preset.id !== year.calendarPresetId || preset.hijriStart !== year.hijriStart ||
      preset.hijriEnd !== year.hijriEnd) throw new Error('تعذّر تحديد التقويم المعتمد للحصة.');
  const exceptions = calendarsOf(year.id).filter(c => c.source === 'custom' && c.presetId === preset.id)
    .flatMap(c => live(state.calendarDays).filter(d => d.calendarId === c.id && d.date === date));
  if (exceptions.length > 1) throw new Error('تعذّر تحديد يوم التقويم للحصة.');
  const exception = exceptions[0];
  const official = preset.holidays.find(d => d.startDate <= date && date <= d.endDate);
  const kind = exception?.kind ?? official?.kind ?? (isWeekend(date) ? 'holiday' : 'study');
  const label = exception?.label ?? official?.label ?? '';
  if (!Object.hasOwn(CALENDAR_KIND, kind) || typeof label !== 'string' || label.length > 500)
    throw new Error('تعذّر تحديد يوم التقويم للحصة.');
  return { presetId: preset.id, kind, label,
    source: exception ? 'custom' : official ? 'official' : 'default' };
}

/** Creation-only provenance. Revision is added by Sync from the year receipt. */
function newSessionCalendarContext(session, batch = {}) {
  const teaching = batch.teachings?.find(row => row.id === session.teachingId) ?? getTeaching(session.teachingId);
  const term = batch.terms?.find(row => row.id === teaching?.termId) ?? getTerm(teaching?.termId);
  const year = batch.years?.find(row => row.id === term?.yearId) ?? getYear(term?.yearId);
  if (!teaching || teaching.deleted || !year || year.deleted || !term || term.deleted) throw new Error('تعذّر تحديد تقويم الحصة.');
  const day = selectedCalendarDay(year, session.date);
  return day ? { yearId: year.id, termId: term.id, ...day } : null;
}

/** Resolve a dated session through its teaching's term and year, including history. */
export function sessionCalendarDay(session) {
  const teaching = getTeaching(session?.teachingId)
    ?? state.teachings.find((record) => record.id === session?.teachingId);
  const term = getTerm(teaching?.termId)
    ?? state.terms.find((record) => record.id === teaching?.termId);
  return term ? calendarDayForYear(term.yearId, session.date) : null;
}

export function sessionStatusPresentation(session) {
  const term = getTerm(getTeaching(session?.teachingId)?.termId);
  if (session.calendarContext != null || getYear(term?.yearId)?.calendarPresetId) {
    const presentation = resolveRecordedSessionPresentation(session);
    if (!presentation.ok) throw new Error(`Recorded Calendar context invalid: ${presentation.reason}`);
    return presentation;
  }
  return sessionCalendarPresentation(session, sessionCalendarDay(session));
}

/** المصدر الواحد لأهلية الحصة الاعتيادية؛ لا ينشئ بيانات. */
export function isSessionEligibleDate(date, { year = activeYear(), term = activeTerm() } = {}) {
  if (!date || !year || !term || term.yearId !== year.id) return false;
  const calendar = effectiveCalendar(year.id, { year });
  if (calendar && !calendar.ok) return false;
  term = effectiveTerm(term.id) ?? term;
  if (!term.startDate || !term.endDate || date < term.startDate || date > term.endDate) return false;
  const day = selectedCalendarDay(year, date) ?? calendarDayForYear(year.id, date);
  // التقويم الصريح يغلب عطلة نهاية الأسبوع الافتراضية.
  if (day) return isTeachingDay(day.kind);
  return !isWeekend(date);
}

export { getCalendarPreset, WESTERN_1448_1449_PRESET_ID };

export function calendarPresetForYear(yearId = activeYear()?.id) {
  return getCalendarPreset(getYear(yearId)?.calendarPresetId);
}

// N58 bounded release: selection patches the existing year; official dates are
// projections. Actual UI/local protocol roundtrips certify this path separately
// from the outstanding PO fresh-account acceptance.
// N116 does not certify the underlying calendar/year Sync repair.
export const CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = true;
export const CALENDAR_PRESET_SWITCH_HOLD_MESSAGE = 'تغيير التقويم متوقف مؤقتًا لمعالجة المزامنة. يمكنك متابعة العمل بالتقويم الحالي.';

/** Applies a built-in template without replacing existing user calendar data. */
export async function applyCalendarPreset(presetId = WESTERN_1448_1449_PRESET_ID, { yearId = activeYear()?.id } = {}) {
  const year = getYear(yearId);
  if (!year) return { ok: false, reason: 'existing-year-required' };
  if (CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD && year.calendarPresetId) {
    if (year.calendarPresetId !== presetId) return { ok: false, reason: 'calendar-switch-temporary-hold', message: CALENDAR_PRESET_SWITCH_HOLD_MESSAGE };
    return { ok: true, applied: 0, year };
  }
  const calendar = effectiveCalendar(yearId, { year: { ...year, calendarPresetId: presetId } });
  if (!calendar?.ok) return { ok: false, reason: calendar?.reason ?? 'unsupported-preset' };
  const changed = year.calendarPresetId !== presetId;
  if (changed && !await patch('years', yearId, { calendarPresetId: presetId })) {
    throw new Error('تعذر حفظ إعدادات التقويم. حاول مرة أخرى.');
  }
  return { ok: true, applied: changed ? 1 : 0, year: effectiveYear(yearId) };
}

/* ---------- المنهج ---------- */

export const unitsFor = (subId, grade, termIndex) =>
  sortByOrder(
    live(state.units).filter(
      (u) => u.subjectId === subId &&
        (grade === undefined || u.grade === Number(grade)) &&
        (termIndex === undefined || u.termIndex === Number(termIndex))
    )
  );

export const lessonsOf = (unitId) => sortByOrder(live(state.lessons).filter((l) => l.unitId === unitId));
export const getLesson = (id) => state.lessons.find((l) => l.id === id && !l.deleted) ?? null;
export const getUnit = (id) => state.units.find((u) => u.id === id && !u.deleted) ?? null;

/** Installs the server-verified curriculum snapshot without creating outbox work. */
export async function reconcileCurriculumBootstrapCanonical({ units = [], lessons = [] } = {}) {
  const decodedUnits = units.map((row) => decodeSyncV2Canonical('units', row)).filter(Boolean);
  const decodedLessons = lessons.map((row) => decodeSyncV2Canonical('lessons', row)).filter(Boolean);
  if (decodedUnits.length !== units.length || decodedLessons.length !== lessons.length) {
    throw Object.assign(new Error('Curriculum bootstrap returned malformed canonical rows'), {
      code: 'CURRICULUM_BOOTSTRAP_RESPONSE_INVALID',
    });
  }
  const unitIds = new Set(decodedUnits.map((row) => row.id));
  if (decodedLessons.some((row) => !unitIds.has(row.unitId))) {
    throw Object.assign(new Error('Curriculum bootstrap returned a broken lesson reference'), {
      code: 'CURRICULUM_BOOTSTRAP_REFERENCE_INVALID',
    });
  }
  await db.applyBatch({
    units: { remove: state.units.map((row) => row.id), put: decodedUnits },
    lessons: { remove: state.lessons.map((row) => row.id), put: decodedLessons },
  });
  state.units = decodedUnits;
  state.lessons = decodedLessons;
  notify();
  broadcast([
    ...decodedUnits.map((row) => ({ store: 'units', id: row.id })),
    ...decodedLessons.map((row) => ({ store: 'lessons', id: row.id })),
  ]);
  return { units: decodedUnits.length, lessons: decodedLessons.length };
}

/**
 * وحدة المنهج التي يقيسها بند التقييم — من ربطه المباشر أو عبر درسه.
 * أساس تقارير إتقان المفاهيم لاحقًا؛ لا واجهة له بعد.
 */
export function itemCurriculum(item) {
  if (!item) return null;
  const lesson = item.lessonId ? getLesson(item.lessonId) : null;
  const unit = getUnit(item.unitId ?? lesson?.unitId ?? null);
  if (!lesson && !unit) return null;
  return { unit, lesson };
}

/* ---------- سياق الحساب ---------- */

function liveTeachingContext(tchId) {
  const roster = students(tchId);
  const ids = new Set(roster.map((s) => s.id));
  const attByStudent = groupBy(
    state.attendance.filter((a) => ids.has(a.studentId) && a.teachingId === tchId), 'studentId');
  const logsByStudent = groupBy(
    state.logs.filter((l) => ids.has(l.studentId) && l.teachingId === tchId), 'studentId');

  const classHasParticipation = live(state.logs).some(
    (l) => l.teachingId === tchId && l.kind === 'participation'
  );

  const ctx = Object.create(null);
  for (const s of roster) {
    ctx[s.id] = {
      scoresByItem: portableScoresByItem(s.id, tchId),
      automaticByItem: portableAutomaticByItem(s.id, tchId),
      attendance: attByStudent[s.id] ?? [],
      logs: logsByStudent[s.id] ?? [],
      classHasParticipation,
    };
  }
  return { roster, items: items(tchId), ctx };
}

export function teachingContext(tchId) {
  const historical = closedTeachingReport(tchId);
  if (historical) return structuredClone({ roster: historical.roster, items: historical.items, ctx: historical.contexts });
  return liveTeachingContext(tchId);
}

/** كشف الحضور التاريخي: لكل حصة مصدر كشف مستقل، لا كشف الفصل الحالي. */
function liveAttendanceReportContext(tchId) {
  const sessions = sessionsOf(tchId).slice().reverse();
  const studentsById = new Map();
  const rosterBySession = new Map();
  const attendanceBySession = new Map();
  for (const ses of sessions) {
    const roster = sessionRoster(ses);
    rosterBySession.set(ses.id, roster);
    for (const student of roster.members) {
      if (!studentsById.has(student.id)) studentsById.set(student.id, student);
    }
    const memberIds = new Set(roster.members.map((student) => student.id));
    attendanceBySession.set(ses.id, new Map(
      attendanceIn(ses.id).filter((record) => memberIds.has(record.studentId)).map((record) => [record.studentId, record])
    ));
  }
  return { sessions, students: [...studentsById.values()], rosterBySession, attendanceBySession };
}

export function attendanceReportContext(tchId) {
  const historical = closedTeachingReport(tchId)?.attendanceDocument;
  if (!historical) return liveAttendanceReportContext(tchId);
  return {
    sessions: structuredClone(historical.sessions),
    students: structuredClone(historical.students),
    rosterBySession: new Map(historical.rosters.map((entry) => [entry.sessionId, structuredClone(entry.roster)])),
    attendanceBySession: new Map(historical.records.map((entry) => [entry.sessionId,
      new Map(entry.records.map((record) => [record.studentId, structuredClone(record)]))])),
  };
}

const CLOSED_TERM_SCHEMA_VERSION = 1;

const frozenRecord = (storeName, record, extras = {}) => {
  if (!record) return null;
  const fields = Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {});
  return structuredClone(Object.fromEntries([
    ['id', record.id],
    ...fields.filter((field) => field !== 'payload' && field !== 'sourceManifest')
      .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
      .map((field) => [field, record[field]]),
    ...Object.entries(extras),
  ]));
};

function closedTermSourceRecords(termId) {
  const term = getTerm(termId);
  if (!term) throw new Error('الفصل الدراسي غير موجود.');
  const year = getYear(term.yearId);
  if (!year) throw new Error('السنة الدراسية غير موجودة.');
  const teachings = live(state.teachings).filter((record) => record.termId === termId);
  const teachingIds = new Set(teachings.map((record) => record.id));
  const sectionIds = new Set(teachings.map((record) => record.sectionId));
  const subjectIds = new Set(teachings.map((record) => record.subjectId));
  const items = live(state.items).filter((record) => teachingIds.has(record.teachingId));
  const itemIds = new Set(items.map((record) => record.id));
  const sessions = live(state.sessions).filter((record) => teachingIds.has(record.teachingId));
  const sessionIds = new Set(sessions.map((record) => record.id));
  const enrollments = live(state.enrollments).filter((record) => sectionIds.has(record.sectionId));
  const scores = live(state.scores).filter((record) => itemIds.has(record.itemId));
  const snapshots = live(state.sessionRosterSnapshots).filter((record) => sessionIds.has(record.sessionId));
  const attendance = live(state.attendance).filter((record) => sessionIds.has(record.sessionId));
  const logs = live(state.logs).filter((record) => teachingIds.has(record.teachingId));
  const notes = live(state.notes).filter((record) => teachingIds.has(record.teachingId) || sessionIds.has(record.sessionId));
  const studentIds = new Set([
    ...enrollments.map((record) => record.studentId), ...scores.map((record) => record.studentId),
    ...attendance.map((record) => record.studentId), ...logs.map((record) => record.studentId),
    ...notes.map((record) => record.studentId),
    ...snapshots.flatMap((record) => (record.members ?? []).map((member) => member.studentId ?? member.id)),
  ].filter(Boolean));
  const records = {
    profile: [state.profile], years: [year], terms: [term], teachings,
    sections: live(state.sections).filter((record) => sectionIds.has(record.id)),
    subjects: live(state.subjects).filter((record) => subjectIds.has(record.id)),
    students: live(state.students).filter((record) => studentIds.has(record.id)),
    enrollments, items, scores, sessions, sessionRosterSnapshots: snapshots, attendance, logs, notes,
  };
  return records;
}

export function closedTermSourceManifest(termId) {
  const records = closedTermSourceRecords(termId);
  const manifest = [];
  for (const [storeName, rows] of Object.entries(records)) {
    const entity = SYNC_V2_SCHEMAS[storeName]?.entity;
    for (const record of rows) {
      const revision = Number(record?.serverRevision ?? 0);
      if (!entity || !record?.id || !Number.isSafeInteger(revision) || revision < 1) {
        throw new Error('يجب إكمال المزامنة والتحقق من النسخ السحابية قبل إغلاق الفصل الدراسي.');
      }
      manifest.push({ entity, id: record.id, revision });
    }
  }
  const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return manifest.sort((left, right) => lexical(left.entity, right.entity) || lexical(left.id, right.id));
}

function serializeAttendanceDocument(tchId) {
  const context = liveAttendanceReportContext(tchId);
  return {
    sessions: structuredClone(context.sessions),
    students: structuredClone(context.students),
    rosters: context.sessions.map((session) => ({ sessionId: session.id, roster: structuredClone(context.rosterBySession.get(session.id)) })),
    records: context.sessions.map((session) => ({ sessionId: session.id,
      records: [...(context.attendanceBySession.get(session.id)?.values() ?? [])].map((record) => structuredClone(record)) })),
  };
}

/** Build frozen facts with the existing Product report/scoring implementation. */
export function buildClosedTermReportPayload(termId) {
  const source = closedTermSourceRecords(termId);
  const term = source.terms[0];
  const year = source.years[0];
  const teachingDocuments = source.teachings
    .slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((teaching) => {
      const context = liveTeachingContext(teaching.id);
      const section = source.sections.find((record) => record.id === teaching.sectionId);
      const subject = source.subjects.find((record) => record.id === teaching.subjectId);
      const gradeResults = context.roster.map((student) => ({
        studentId: student.id,
        itemResults: context.items.map((item) => ({ itemId: item.id, value: itemScore(item, context.ctx[student.id]) })),
        total: studentTotal(context.items, context.ctx[student.id]),
      }));
      return {
        teaching: frozenRecord('teachings', teaching),
        section: frozenRecord('sections', section),
        subject: frozenRecord('subjects', subject),
        roster: structuredClone(context.roster),
        membership: source.enrollments.filter((record) => record.sectionId === teaching.sectionId).map((record) => frozenRecord('enrollments', record)),
        items: context.items.map((record) => frozenRecord('items', record)),
        contexts: structuredClone(context.ctx),
        gradeResults,
        attendanceDocument: serializeAttendanceDocument(teaching.id),
        notes: source.notes.filter((record) => record.teachingId === teaching.id ||
          source.sessions.some((session) => session.teachingId === teaching.id && session.id === record.sessionId))
          .map((record) => frozenRecord('notes', record)),
      };
    });
  const execution = liveExecutionReport({ yearId: year.id, termId, includeArchived: true });
  const executionDocument = structuredClone({
    ...execution,
    snapshotIdentity: {
      profile: frozenRecord('profile', state.profile),
      year: frozenRecord('years', year),
      term: { ...frozenRecord('terms', term), status: 'closed' },
    },
    rows: execution.rows.map((row) => ({ ...row,
      subject: row.teaching ? frozenRecord('subjects', source.subjects.find((subject) => subject.id === row.teaching.subjectId)) : null })),
  });
  return {
    schemaVersion: CLOSED_TERM_SCHEMA_VERSION,
    identity: {
      profile: frozenRecord('profile', state.profile),
      year: frozenRecord('years', year),
      term: { ...frozenRecord('terms', term), status: 'closed' },
    },
    teachingDocuments,
    executionDocument,
  };
}

export function closedTermReports(termId) {
  const scope = deletionScope(state, state);
  return live(state.closedTermReports).filter((record) => !termId || record.termId === termId)
    .sort((a, b) => Number(b.version) - Number(a.version) || Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
    .map((report) => visibleClosedTermReport(report, scope));
}

export const latestClosedTermReport = (termId) => closedTermReports(termId)[0] ?? null;

export function closedTeachingReport(teachingId) {
  if (deletionScope(state, state).deleted('teachings', teachingId)) return null;
  const teaching = getTeaching(teachingId) ?? state.teachings.find((record) => record.id === teachingId);
  const report = teaching ? latestClosedTermReport(teaching.termId) :
    closedTermReports().find((candidate) => candidate.payload?.teachingDocuments?.some((doc) => doc.teaching?.id === teachingId));
  return report?.payload?.teachingDocuments?.find((document) => document.teaching?.id === teachingId) ?? null;
}

export function closedTermReportState(termId) {
  const term = getTerm(termId);
  const report = latestClosedTermReport(termId);
  if (report) return { state: 'complete', report, versions: closedTermReports(termId).length };
  if (term?.status === 'closed') return { state: 'legacy-unresolved', report: null, versions: 0 };
  return { state: 'open', report: null, versions: 0 };
}

export async function queueClosedTermReport({ termId, supersedesId = null } = {}) {
  assertLeaseWritable();
  const term = getTerm(termId);
  if (!term) throw new Error('الفصل الدراسي غير موجود.');
  const existing = closedTermReports(termId);
  if (!supersedesId && existing.length) throw new Error('توجد حقيقة تقارير مغلقة لهذا الفصل بالفعل.');
  if (supersedesId && existing[0]?.id !== supersedesId) throw new Error('يجب أن يصحح الإصدار الجديد أحدث إصدار محفوظ.');
  const reportId = closedTermReportId(termId);
  const stamp = now();
  const sourceManifest = closedTermSourceManifest(termId);
  const payload = buildClosedTermReportPayload(termId);
  const command = syncV2CommandEntry({
    store: 'closedTermReports', recordId: reportId,
    command: supersedesId ? 'term-report:correct' : 'term-report:close', stamp,
    patch: { termId, reportId, supersedesId, sourceManifest, payload },
    dependencies: [{ store: 'terms', recordId: termId, requiresServerRevision: true }],
  });
  await db.put('outbox', command);
  notify({ render: false });
  broadcast([{ store: 'outbox', id: command.id }], { render: false });
  return { reportId, mutationId: command.mutationId };
}

/** سياق طالب داخل إسناد محدد — لا يخلط إسنادًا بآخر. */
export function studentContext(studentId, tchId) {
  const inTeaching = (r) => !tchId || r.teachingId === tchId;
  return {
    scoresByItem: tchId ? portableScoresByItem(studentId, tchId) : indexScores(scoresOf(studentId)),
    automaticByItem: tchId ? portableAutomaticByItem(studentId, tchId) : Object.create(null),
    attendance: attendanceOf(studentId).filter(inTeaching),
    logs: logsOf(studentId).filter(inTeaching),
    classHasParticipation: tchId
      ? live(state.logs).some((l) => l.teachingId === tchId && l.kind === 'participation')
      : false,
  };
}

/**
 * سجل الطالب المستمر عبر الإسنادات. هذا إسقاط قراءة فقط: تبقى السجلات
 * مرتبطة بحصتها وإسنادها وشعبتها الأصلية. الدرجات هنا هي سجلات الدرجات
 * اليدوية المحفوظة فعلًا مع بنودها الأصلية؛ ولا تدخل في حساب الإسناد الحالي.
 */
export function studentHistory(studentId) {
  const withContext = (record, teachingId = record.teachingId) => {
    const session = record.sessionId ? getSession(record.sessionId) : null;
    const teaching = getTeaching(session?.teachingId ?? teachingId);
    const section = teaching ? getSection(teaching.sectionId) : null;
    const subject = teaching ? getSubject(teaching.subjectId) : null;
    const term = teaching ? getTerm(teaching.termId) : null;
    const year = term ? getYear(term.yearId) : section ? getYear(section.yearId) : null;
    return {
      record,
      session,
      teaching,
      section,
      subject,
      term,
      year,
      date: record.date ?? session?.date ?? '',
      contextLabel: teachingLabel(teaching) || sectionLabel(section) || '',
    };
  };
  const newestFirst = (left, right) =>
    String(right.date ?? '').localeCompare(String(left.date ?? '')) ||
    Number(right.record.createdAt ?? right.record.updatedAt ?? 0) -
      Number(left.record.createdAt ?? left.record.updatedAt ?? 0) ||
    String(left.record.id ?? '').localeCompare(String(right.record.id ?? ''));
  const unique = (records) => [...new Map(records.map((record) => [record.id, record])).values()];
  const project = (records) => unique(records).map((record) => withContext(record)).sort(newestFirst);
  const itemById = new Map(live(state.items).map((item) => [item.id, item]));
  const scores = unique(scoresOf(studentId))
    .map((record) => {
      const item = itemById.get(record.itemId);
      if (!item || item.auto || record.value === null || record.value === undefined) return null;
      return { ...withContext(record, item.teachingId), item };
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(left.teaching?.id ?? '').localeCompare(String(right.teaching?.id ?? '')) ||
      Number(left.item.order ?? 0) - Number(right.item.order ?? 0) ||
      String(left.item.id).localeCompare(String(right.item.id)));

  const attendance = project(attendanceOf(studentId));
  const logs = project(logsOf(studentId));
  const notes = project(notesOf(studentId));
  const contextsByTeaching = new Map();
  const addToContext = (kind, event) => {
    if (!event.teaching) return;
    let context = contextsByTeaching.get(event.teaching.id);
    if (!context) {
      context = {
        teaching: event.teaching,
        section: event.section,
        subject: event.subject,
        term: event.term,
        year: event.year,
        attendance: [], logs: [], notes: [], scores: [],
        latestDate: '', latestUpdatedAt: 0,
      };
      contextsByTeaching.set(event.teaching.id, context);
    }
    context[kind].push(event);
    context.latestDate = [context.latestDate, event.date].sort().at(-1) ?? '';
    context.latestUpdatedAt = Math.max(
      context.latestUpdatedAt,
      Number(event.record.createdAt ?? event.record.updatedAt ?? 0),
    );
  };
  attendance.forEach((event) => addToContext('attendance', event));
  logs.forEach((event) => addToContext('logs', event));
  notes.forEach((event) => addToContext('notes', event));
  scores.forEach((event) => addToContext('scores', event));
  const contexts = [...contextsByTeaching.values()].sort((left, right) =>
    String(right.latestDate).localeCompare(String(left.latestDate)) ||
    right.latestUpdatedAt - left.latestUpdatedAt ||
    String(left.teaching.id).localeCompare(String(right.teaching.id)));

  return { attendance, logs, notes, scores, contexts };
}

/* ---------- عمليات: البنية ---------- */

export async function createYear(data) {
  const y = makeYear(data);
  await save({ years: [y] });
  return y;
}

function customCalendarCandidate(yearId) {
  const presetId = getYear(yearId)?.calendarPresetId;
  const existing = state.calendars.find(c => c.yearId === yearId && c.source === 'custom' && (c.presetId ?? null) === (presetId ?? null));
  if (existing?.deleted) throw new Error('Calendar scope is deleted.');
  return existing ?? { ...makeCalendar({ yearId, source: 'custom' }),
    ...(presetId ? { id: `cal:${yearId}:custom:${presetId}`, presetId, termDateOverrides: {} } : {}) };
}
export async function createTerm(data) {
  const selected = getYear(data.yearId)?.calendarPresetId;
  const hasDates = Boolean(data.startDate || data.endDate);
  const t = makeTerm(selected ? { ...data, startDate: null, endDate: null } : data);
  if (state.terms.some(term => term.id === t.id || (!term.deleted && term.yearId === t.yearId && term.index === t.index))) throw new Error('يوجد فصل دراسي بهذا الترتيب');
  const batch = { terms: [t] };
  if (selected && hasDates) {
    const calendar = customCalendarCandidate(t.yearId);
    const next = { ...calendar, termDateOverrides: { ...calendar.termDateOverrides, [t.id]: { startDate: data.startDate, endDate: data.endDate } }, updatedAt: now() };
    const projection = effectiveCalendar(t.yearId, { terms: [...state.terms.filter(term => term.yearId === t.yearId), t], calendars: [...state.calendars.filter(c => c.id !== next.id), next] });
    if (!projection.ok) throw new Error(`Invalid term dates: ${projection.reason}`);
    batch.calendars = [next];
  }
  if (selected && !hasDates) {
    const projection = effectiveCalendar(t.yearId, { terms: [...state.terms.filter(term => term.yearId === t.yearId), t] });
    if (!projection.ok) throw new Error(`Invalid term identity: ${projection.reason}`);
  }
  if (!await save(batch)) throw new Error('تعذّر حفظ الفصل الدراسي.');
  return t;
}

export async function createSubject(data) {
  const s = makeSubject(data);
  await save({ subjects: [s] });
  return s;
}

/**
 * Resolves a picker token to one durable subject identity. Built-ins are
 * created lazily; equivalent legacy/custom rows are reused rather than copied.
 */
export async function resolveSubjectSelection({ token, customName = '' } = {}, { verifyCurrent } = {}) {
  const value = String(token ?? '');
  if (value.startsWith('subject:')) {
    const existing = getSubject(value.slice('subject:'.length));
    if (!existing) throw new Error('المادة المحددة غير متاحة. اختر مادة أخرى.');
    return existing;
  }

  let definition = value.startsWith('builtin:') ? builtinSubject(value.slice('builtin:'.length)) : null;
  let validated = null;
  if (value === 'custom') {
    validated = validateCustomSubjectName(customName);
    if (!validated.ok) throw new Error(validated.error);
    definition = matchBuiltinSubject(validated.name);
  }

  if (definition) {
    const existing = findPersistedBuiltin(live(state.subjects), definition);
    if (existing) return existing;
    const created = makeSubject({ id: definition.id, name: definition.name, slug: definition.slug });
    if (!(await save({ subjects: [created] }, { verifyCurrent }))) throw new Error('تعذّر حفظ المادة. حاول مرة أخرى.');
    return created;
  }

  if (!validated) throw new Error('اختر مادة للفصل.');
  const duplicate = live(state.subjects).find((subject) => normalizeSubjectName(subject.name) === validated.normalized);
  if (duplicate) return duplicate;
  const slug = customSubjectSlug(validated.name);
  const sameNaturalIdentity = live(state.subjects).find((subject) => subject.slug === slug);
  if (sameNaturalIdentity) return sameNaturalIdentity;
  const created = makeSubject({ id: `sub:${uid()}`, name: validated.name, slug });
  if (!(await save({ subjects: [created] }, { verifyCurrent }))) throw new Error('تعذّر حفظ المادة المخصصة. حاول مرة أخرى.');
  return created;
}

// AI: private review capabilities bind one file group to one immutable account
// checkpoint. Partial receipts survive a failed child; they never auto-replay.
const classImportFingerprint = (name,row) => {
  if(activeWorkspace?.type==='account' && row?.ownerId!=null && row.ownerId!==activeWorkspace.authUserId)
    throw Error('CLASS_IMPORT_FOREIGN_PARENT');
  return JSON.stringify(visibleSyncValue(name,row));
};
const classImportReviews = new WeakMap();
let classImportBusy = false;
export function reviewClassImport(group) {
  const workspace = assertClassImportAccess();
  const canonical = classGroups([
    ['الصف', 'الفصل', 'المادة', 'اسم الطالب'],
    ...(group.rows.length ? group.rows : [['']]).map(row => [group.grade, group.label, group.subject, row[0]]),
  ], { mapping: { grade: 0, label: 1, subject: 2, name: 3 } })[0];
  if (!canonical || canonical.error || canonical.preview.counts.invalid || canonical.preview.counts.ambiguous) {
    throw Error(canonical?.error || 'صحّح الأسماء غير الصالحة أو المكررة في الملف ثم أعد رفعه.');
  }
  const matches = state.sections.filter(row => !row.deleted && row.yearId === activeYear().id &&
    Number(row.grade) === canonical.grade && normalizeSectionLabel(row.label) === normalizeSectionLabel(canonical.label));
  if (matches.length) throw Error('الفصل موجود مسبقًا أو مؤرشف. راجعه من الفصول والكشوف؛ لن يُدمج طلابه تلقائيًا.');
  const validatedSubject=validateCustomSubjectName(canonical.subject);
  if(!validatedSubject.ok)throw Error(validatedSubject.error);
  const definition=matchBuiltinSubject(validatedSubject.name);
  const subjectName=definition ? findPersistedBuiltin(live(state.subjects),definition)?.name ?? definition.name :
    live(state.subjects).find(row=>normalizeSubjectName(row.name)===validatedSubject.normalized)?.name ?? validatedSubject.name;
  const review = { grade: canonical.grade, label: canonical.label, subject: subjectName,
    names: Object.freeze([...canonical.preview.names]), yearId: activeYear().id, termId: activeTerm().id };
  classImportReviews.set(review, { workspace, session: cloud.session, source: JSON.stringify(review),
    year: classImportFingerprint('years',activeYear()), term: classImportFingerprint('terms',activeTerm()), section: null, teaching: null,
    deviceTerm: JSON.stringify([state.device.activeYearId, state.device.activeTermId]), students: [],
    sectionFingerprint: null, teachingFingerprint: null, added: 0, busy: false });
  return Object.freeze(review);
}
function verifyClassImportBinding(review, receipt) {
  const workspace = assertClassImportAccess();
  if (workspace !== receipt.workspace || cloud.session !== receipt.session || JSON.stringify(review) !== receipt.source ||
      classImportFingerprint('years',activeYear()) !== receipt.year || classImportFingerprint('terms',activeTerm()) !== receipt.term) {
    throw Error('تغيّر الحساب أو السنة أو الفصل الدراسي. أعد رفع الملف ومراجعته.');
  }
}
function verifyClassImport(review, receipt) {
  verifyClassImportBinding(review, receipt);
  const matches = state.sections.filter(row => !row.deleted && row.yearId === review.yearId &&
    Number(row.grade) === review.grade && normalizeSectionLabel(row.label) === normalizeSectionLabel(review.label));
  if (receipt.section) {
    if (matches.length !== 1 || matches[0].id !== receipt.section.id ||
        classImportFingerprint('sections',getSection(receipt.section.id)) !== receipt.sectionFingerprint) throw Error('تغيّر الفصل. راجع المحفوظ قبل المحاولة.');
    validateTeachingContext(receipt.section.id, review.termId);
    if (receipt.teaching) {
      assertClassOperationsAccess(receipt.teaching.id);
      if (classImportFingerprint('teachings',getTeaching(receipt.teaching.id)) !== receipt.teachingFingerprint) throw Error('تغيّرت مادة الفصل. راجع المحفوظ.');
    }
    const roster = sectionRoster(receipt.section.id);
    if (roster.length !== receipt.added || JSON.stringify(roster.map(row => row.name).sort()) !==
        JSON.stringify((receipt.added ? [...review.names] : []).sort())) throw Error('تغيّرت قائمة الطلاب. راجع الكشوف قبل المحاولة.');
  } else if (matches.length) throw Error('أُنشئ فصل مطابق أثناء المراجعة. افتح الكشوف لمراجعته.');
}
// Snapshot is read inside the existing save/import transaction, before any put.
// Cross-tab classes/rosters cannot be inferred from this tab's memory.
function verifyPersistedClassImport(review, receipt, current) {
  verifyClassImportBinding(review, receipt);
  const matches = current.sections.filter(row => !row.deleted && row.yearId === review.yearId &&
    Number(row.grade) === review.grade && normalizeSectionLabel(row.label) === normalizeSectionLabel(review.label));
  if (receipt.section ? matches.length !== 1 || matches[0].id !== receipt.section.id ||
      classImportFingerprint('sections',matches[0]) !== receipt.sectionFingerprint : matches.length) throw Error('تغيّر الفصل المحفوظ في نافذة أخرى. راجع الكشوف.');
  if (receipt.teaching && classImportFingerprint('teachings',current.teachings.find(row => row.id === receipt.teaching.id)) !== receipt.teachingFingerprint) throw Error('تغيّرت مادة الفصل المحفوظة.');
  if (receipt.section && current.enrollments.some(row => !row.deleted && row.sectionId === receipt.section.id)) throw Error('تغيّر كشف الطلاب المحفوظ. راجعه قبل الاستيراد.');
  if (current.years && classImportFingerprint('years',current.years.find(row => row.id === review.yearId)) !== receipt.year ||
      current.terms && classImportFingerprint('terms',current.terms.find(row => row.id === review.termId)) !== receipt.term) throw Error('تغيّرت السنة أو الفصل الدراسي المحفوظ.');
  if (current.device && JSON.stringify([current.device[0]?.activeYearId, current.device[0]?.activeTermId]) !== receipt.deviceTerm) throw Error('تغيّر الفصل الدراسي في نافذة أخرى.');
}
// AI-authored N107: one owner-bound local continuation; never enters Sync or backup.
// Compare inside the durable transaction so another tab's draft cannot be erased.
export async function saveClassFileImportContinuation(value, { expectedTeachingId = value?.created?.teachingId, verifyCurrent = () => {} } = {}) {
  const workspace=assertClassImportAccess(), session=cloud.session;
  assertLeaseWritable();
  if(!expectedTeachingId || value && (value.ownerId!==workspace.authUserId || value.databaseName!==workspace.databaseName))
    throw Error('CLASS_FILE_CONTINUATION_OWNER');
  const committed=await db.applyBatch({device:{},outbox:{}},{prepare(current){
    verifyCurrent();assertLeaseWritable();
    if(assertClassImportAccess()!==workspace || cloud.session!==session)throw Error('CLASS_FILE_CONTINUATION_CONTEXT');
    const device=current.device.find(row=>row.id==='device'), prior=device?.classFileImportContinuation;
    if(!device)throw Error('CLASS_FILE_CONTINUATION_DEVICE');
    if(prior && (prior.ownerId!==workspace.authUserId || prior.databaseName!==workspace.databaseName ||
        prior.created?.teachingId!==expectedTeachingId))throw Error('CLASS_FILE_CONTINUATION_CHANGED');
    if(!value && prior?.maxProgress?.some(stage=>current.outbox.some(row=>row.mutationId===stage.mutationId && row.state!=='superseded')))
      throw Error('طلب تغيير العظمى المعلّق محفوظ بهويته؛ استكمله أو عالج رفض المزامنة قبل إلغاء المراجعة.');
    if(value && prior?.maxProgress){
      if(prior.input!==value.input || JSON.stringify(prior.maximumReview)!==JSON.stringify(value.maximumReview))throw Error('CLASS_FILE_CONTINUATION_CHANGED');
      value={...value,maxProgress:prior.maxProgress};
    }
    return {device:{put:[{...device,classFileImportContinuation:value,updatedAt:now()}]}};
  }});
  if(activeWorkspace===workspace && cloud.session===session){
    state.device=committed.device.put[0];broadcast([{store:'device',id:'device'}]);
  }
}
// AI N107: independent owner-device import plans; no cloud payload or credential.
export async function updateLocalImportPlans(change, { verifyCurrent = () => {} } = {}) {
  const workspace=assertClassImportAccess(), session=cloud.session;
  const committed=await db.applyBatch({device:{},outbox:{},teachings:{},sections:{}},{prepare(current){
    verifyCurrent();assertLeaseWritable();
    if(assertClassImportAccess()!==workspace || cloud.session!==session)throw Error('IMPORT_PLAN_CONTEXT');
    const device=current.device.find(r=>r.id==='device');if(!device)throw Error('IMPORT_PLAN_DEVICE');
    const next=change(structuredClone(device.classFileImportPlans??{}),current,device);
    return {device:{put:[{...device,classFileImportPlans:next,updatedAt:now()}]}};
  }});
  if(activeWorkspace===workspace && cloud.session===session){state.device=committed.device.put[0];notify({syncReady:false});broadcast([{store:'device',id:'device'}]);}
}
export async function saveLocalImportPlan(value, options={}) {
  const workspace=assertClassImportAccess();
  if(value.ownerId!==workspace.authUserId || value.databaseName!==workspace.databaseName || value.version!==1)throw Error('IMPORT_PLAN_OWNER');
  await updateLocalImportPlans((plans,current)=>{
    if(plans[value.id])throw Error('IMPORT_PLAN_EXISTS');
    const teaching=current.teachings.find(r=>r.id===value.created.teachingId),section=current.sections.find(r=>r.id===teaching?.sectionId);
    if(!teaching || teaching.deleted || !section || section.deleted || teaching.termId!==value.termId)throw Error('IMPORT_PLAN_CHANGED');
    return {...plans,[value.id]:structuredClone(value)};
  },options);
  return value.id;
}

// AI-authored N107: cancellation settles only this continuation's commands.
// An uncertain envelope must recover its genuine receipt before being released.
export async function cancelClassFileImportContinuation(expectedTeachingId) {
  const workspace=assertClassImportAccess(), session=cloud.session;
  const guard=()=>{assertLeaseWritable();if(assertClassImportAccess()!==workspace || cloud.session!==session)throw Error('CLASS_FILE_CONTINUATION_CONTEXT');};
  guard();
  let saved=(await db.get('device','device'))?.classFileImportContinuation;
  if(!saved)return;
  if(saved.ownerId!==workspace.authUserId || saved.databaseName!==workspace.databaseName || saved.created?.teachingId!==expectedTeachingId)throw Error('CLASS_FILE_CONTINUATION_CHANGED');
  const pending=await db.getAll('outbox');
  if(pending.some(row=>row.command==='score:grade_import' && row.state!=='superseded' && row.patch?.batch?.teachingId===expectedTeachingId))
    throw Error('دفعة الدرجات محفوظة بهويتها؛ استعد إيصال الطلب نفسه، أو عالج رفضه من حالة الطلب، قبل إغلاق المراجعة.');
  if(saved.maxProgress?.some(stage=>pending.some(row=>row.mutationId===stage.mutationId && row.envelopeLocked && !['rejected','superseded'].includes(row.state)))) {
    try {await confirmImportMaximums(saved.maximumReview,{verifyCurrent:guard});}
    catch(error) {
      // A terminal rejection can be released below; uncertainty cannot.
      const rows=await db.getAll('outbox');
      if(saved.maxProgress.some(stage=>rows.some(row=>row.mutationId===stage.mutationId && row.envelopeLocked && !['rejected','superseded'].includes(row.state))))
        throw Error('لم يتأكد إلغاء الطلب: تعذّر استعادة إيصال العظمى. هويته محفوظة؛ أعد الإلغاء أو الاستكمال عند توفر المزامنة. '+error.message);
    }
  }
  await db.applyBatch({device:{},outbox:{},items:{},scores:{}},{prepare(current){
    guard();
    const device=current.device.find(row=>row.id==='device'), prior=device?.classFileImportContinuation;
    if(JSON.stringify(prior)!==JSON.stringify(saved))throw Error('CLASS_FILE_CONTINUATION_CHANGED');
    if(current.outbox.some(row=>row.command==='score:grade_import' && row.state!=='superseded' && row.patch?.batch?.teachingId===expectedTeachingId))
      throw Error('دفعة الدرجات ما زالت محفوظة بهويتها؛ استعد إيصالها قبل إغلاق المراجعة.');
    const items=[],outbox=[];
    for(const stage of prior.maxProgress??[]) {
      const row=current.outbox.find(row=>row.mutationId===stage.mutationId && row.state!=='superseded');
      if(!row)continue; // Already acknowledged: keep the accepted maximum.
      if(row.ownerId!==workspace.authUserId || row.importMaximum!==true || row.recordId!==stage.itemId || row.envelopeLocked && row.state!=='rejected')throw Error('CLASS_FILE_CONTINUATION_CHANGED');
      const item=current.items.find(item=>item.id===stage.itemId),before=JSON.parse(stage.item);
      // Undo only our still-unaccepted max overlay, never another edit/grade.
      if(!item || !isTransferItem(item) || item.ownerId!=null && item.ownerId!==workspace.authUserId || !(Number(item.max)===stage.max || (row.state==='rejected' || !row.envelopeLocked) && Number(item.max)===stage.oldMax) || item.serverRevision!==stage.revision ||
         Object.keys(SYNC_V2_SCHEMAS.items.fields).filter(k=>k!=='max').some(k=>JSON.stringify(item[k]??null)!==JSON.stringify(before[k]??null)) ||
         importScoreBinding(current.scores.filter(r=>r.itemId===stage.itemId))!==stage.scores ||
         current.outbox.some(other=>other.id!==row.id && other.state!=='superseded' && other.store==='items' && other.recordId===stage.itemId))
        throw Error('تغيّر البند أو درجاته؛ الطلب محفوظ. عالج التعارض قبل الإلغاء.');
      items.push({...item,max:stage.oldMax,updatedAt:now()});
      outbox.push({...row,state:'superseded',recoveryReason:'import-review-cancelled',supersededAt:now()});
    }
    return {items:{put:items},scores:{},outbox:{put:outbox},device:{put:[{...device,classFileImportContinuation:null,updatedAt:now()}]}};
  }});
  guard();await absorb([{store:'device',id:'device'},...(saved.maxProgress??[]).map(stage=>({store:'items',id:stage.itemId}))]);
  broadcast([{store:'device',id:'device'}]);
}
export function classImportReceipt(review) {
  const receipt = classImportReviews.get(review);
  if (!receipt) return null;
  // Do not expose a previous account's draft after callback/account drift.
  if (receipt.workspace !== activeWorkspace || cloud.user?.id !== activeWorkspace.authUserId && activeWorkspace.type === 'account') return null;
  return { sectionId: receipt.section?.id ?? null, teachingId: receipt.teaching?.id ?? null,
    added: receipt.added, pendingNames: receipt.added ? [] : [...review.names],
    students: receipt.students.map(row => ({ ...row })) };
}
// A new explicit review may rebind an expired/refreshed same-owner session.
// Callback drift during the later confirmation still rejects the write.
export function refreshClassImportReview(review) {
  const receipt = classImportReviews.get(review);
  if (!receipt || receipt.busy) throw Error('أعد مراجعة الملف.');
  const fresh = { ...receipt, session: cloud.session };
  verifyClassImport(review, fresh);
  receipt.session = fresh.session;
}
export async function confirmClassImport(review, approved = false, { verifyCurrent = () => {} } = {}) {
  const receipt = classImportReviews.get(review);
  if (!approved) return null;
  if (!receipt || receipt.busy || classImportBusy) throw Error('أعد مراجعة الملف قبل الحفظ.');
  receipt.busy = classImportBusy = true;
  try {
    verifyCurrent(); verifyClassImport(review, receipt);
    const guard = { verifyCurrent: current => { verifyCurrent(); verifyPersistedClassImport(review, receipt, current); } };
    const subject = await resolveSubjectSelection({ token: 'custom', customName: review.subject }, guard);
    verifyCurrent(); verifyClassImport(review, receipt);
    if (subject.ownerId != null && subject.ownerId !== activeWorkspace.authUserId) throw Error('المادة لا تخص الحساب الحالي.');
    if (!receipt.section) {
      verifyCurrent(); verifyClassImport(review, receipt);
      receipt.section = await createSection({ yearId: review.yearId, grade: review.grade, label: review.label, name: `${review.grade}/${review.label}` }, guard);
      receipt.sectionFingerprint = classImportFingerprint('sections',getSection(receipt.section.id));
      verifyCurrent(); verifyClassImport(review, receipt);
    }
    if (!receipt.teaching) {
      verifyCurrent(); verifyClassImport(review, receipt);
      receipt.teaching = await createTeaching({ sectionId: receipt.section.id, subjectId: subject.id, termId: review.termId }, guard);
      receipt.teachingFingerprint = classImportFingerprint('teachings',receipt.teaching);
      verifyCurrent(); verifyClassImport(review, receipt);
    }
    if (!receipt.added && review.names.length) {
      verifyCurrent(); verifyClassImport(review, receipt);
      const result = await importStudents(receipt.section.id, review.names, guard);
      receipt.added = result.added;
      receipt.students = result.students;
      verifyCurrent(); verifyClassImport(review, receipt);
    }
    return classImportReceipt(review);
  } finally { receipt.busy = classImportBusy = false; }
}

export async function createSection(data, { verifyCurrent } = {}) {
  const year = activeYear();
  const yearId = data.yearId ?? year?.id;
  if (!yearId || !live(state.years).some((candidate) => candidate.id === yearId)) {
    throw new Error('تعذّر تحديد السنة الدراسية النشطة.');
  }
  const existing = sections(yearId).find(s =>
    !s.deleted && s.yearId === yearId &&
    s.grade === Number(data.grade) && 
    normalizeSectionLabel(s.label) === normalizeSectionLabel(data.label)
  );
  if (existing) throw new Error(`هذا الفصل موجود مسبقًا (${gradeLabel(existing.grade)} / ${existing.label})`);
  
  const s = makeSection({ yearId, order: sections(yearId).length, ...data });
  if (!(await save({ sections: [s] }, { verifyCurrent }))) throw new Error('تعذّر حفظ الفصل. حاول مرة أخرى.');
  return s;
}

export async function editSection(id, data) {
  const existing = getSection(id);
  if (!existing) throw new Error('الفصل غير موجود.');
  if (isSectionArchived(existing)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  
  const duplicate = sections(existing.yearId).find(s =>
    !s.deleted && s.id !== id &&
    s.yearId === existing.yearId && 
    s.grade === Number(data.grade) && 
    normalizeSectionLabel(s.label) === normalizeSectionLabel(data.label)
  );
  if (duplicate) throw new Error(`هذا الفصل موجود مسبقًا (${gradeLabel(duplicate.grade)} / ${duplicate.label})`);
  
  const { makeSection } = await import('./models.js');
  const name = `${data.grade}/${data.label}`;
  const updated = makeSection({ ...existing, ...data, name, id });
  await patch('sections', id, { grade: updated.grade, label: updated.label, name: updated.name, color: updated.color });
  return updated;
}

/** Validate references before resolving a new subject or persisting a teaching. */
export function validateTeachingContext(secId, tmId = activeTerm()?.id) {
  const section = getSection(secId);
  const term = getTerm(tmId);
  if (!section) throw new Error('الفصل غير موجود. اختر فصلًا نشطًا.');
  if (isSectionArchived(secId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  if (!term || !getYear(section.yearId) || section.yearId !== term.yearId) {
    throw new Error('اختر فصلًا من السنة الدراسية الحالية.');
  }
  if (isTermClosed(term.id)) throw new Error('هذا الفصل الدراسي مغلق — البيانات للعرض فقط.');
  return { section, term };
}

const pendingTeachingCreations = new Map();

/** ينشئ إسنادًا تدريسيًا ومعه بنود التقييم الافتراضية. */
export async function createTeaching({ sectionId: secId, subjectId: subId, termId: tmId }, { verifyCurrent } = {}) {
  const { term: contextTerm } = validateTeachingContext(secId, tmId);
  const term = contextTerm.id;
  const subject = subId ?? getSubject('sub:digital-skills')?.id ?? subjects()[0]?.id;
  if (!getSubject(subject)) throw new Error('اختر مادة صالحة للفصل.');
  const key = JSON.stringify([activeWorkspace?.databaseName, secId, subject, term]);
  if (pendingTeachingCreations.has(key)) return pendingTeachingCreations.get(key);
  const existing = live(state.teachings).find((row) => row.sectionId === secId && row.subjectId === subject && row.termId === term);
  if (existing) return existing;
  const tch = makeTeaching({
    // A deliberate create is a new generation, never the retired natural ID.
    // Pending/local retries reuse this row; the server converges active duplicates.
    id: `tch:${uid()}`,
    sectionId: secId, subjectId: subject, termId: term,
    order: teachings(term).length,
  });
  const defaults = defaultItemsFor(tch.id);
  const pending = save({ teachings: [tch], items: defaults }, {
    verifyCurrent,
    [TEACHING_CREATION_PROOF]: { version: 1, teaching: tch, items: defaults },
  }).then((saved) => {
    if (!saved) throw new Error('تعذّر حفظ مادة الفصل. حاول مرة أخرى.');
    return getTeaching(tch.id);
  });
  pendingTeachingCreations.set(key, pending);
  try { return await pending; }
  finally { pendingTeachingCreations.delete(key); }
}

/** All live subjects on this class count, including subjects in another term. */
export function classDeleteScope(tchId) {
  const teaching = getTeaching(tchId);
  if (!teaching || isTeachingArchived(teaching)) throw new Error('الفصل غير متاح للحذف.');
  const section = getSection(teaching.sectionId);
  if (!section) throw new Error('الفصل غير موجود.');
  const ids = live(state.teachings).filter((row) => row.sectionId === section.id).map((row) => row.id).sort();
  return { teachingId: tchId, sectionId: section.id, kind: ids.length > 1 ? 'subject' : 'class',
    signature: JSON.stringify([section.id, tchId, ids]) };
}

export async function deleteClassFromTeaching(tchId, expectedSignature) {
  const scope = classDeleteScope(tchId);
  if (scope.signature !== expectedSignature) throw new Error('تغيّرت مواد الفصل. راجع نطاق الحذف وأكّد مجددًا.');
  if (activeWorkspace?.type === 'demo') return deleteDemoTeachingScope(tchId, scope.sectionId, scope.kind === 'subject' ? 'teaching' : 'section');
  throwLegacyDeleteUpdateRequired();
}

const pristineDefaultItem = (item, expected, index) => !item.deleted &&
  Number(item.serverRevision ?? 0) <= 1 && Number(item.order) === index &&
  item.name === expected.name && Number(item.max) === Number(expected.max) &&
  (item.auto ?? null) === (expected.auto ?? null) &&
  Number(item.perPoint ?? 1) === Number(expected.perPoint ?? 1) &&
  Number(item.penalty ?? 1) === Number(expected.penalty ?? 1) &&
  (item.unitId ?? null) === null && (item.lessonId ?? null) === null;

/** Retained evidence which makes destructive teaching deletion unsafe. */
export function teachingDeleteEvidence(tchId) {
  const teaching = state.teachings.find((row) => row.id === tchId);
  if (!teaching || teaching.deleted) return [];
  const itemRows = state.items.filter((row) => row.teachingId === tchId);
  const itemIds = new Set(itemRows.map((row) => row.id));
  const sessionRows = state.sessions.filter((row) => row.teachingId === tchId);
  const sessionIds = new Set(sessionRows.map((row) => row.id));
  const assignmentRows = state.assignments.filter((row) => row.teachingId === tchId);
  const assignmentIds = new Set(assignmentRows.map((row) => row.id));
  const evidence = [];
  const exactDefaults = Number(teaching.serverRevision ?? 0) <= 1 && itemRows.length === DEFAULT_ITEMS.length &&
    DEFAULT_ITEMS.every((expected, index) => pristineDefaultItem(
      itemRows.find((row) => Number(row.order) === index), expected, index));
  if (!exactDefaults) evidence.push('teaching/default-items');
  const check = (name, rows) => { if (rows.some(Boolean)) evidence.push(name); };
  check('enrollments', state.enrollments.filter((row) => row.sectionId === teaching.sectionId));
  check('scores', state.scores.filter((row) => itemIds.has(row.itemId)));
  check('slots', state.slots.filter((row) => row.teachingId === tchId));
  check('sessions', sessionRows);
  check('roster-snapshots', state.sessionRosterSnapshots.filter((row) => sessionIds.has(row.sessionId) || row.teachingId === tchId));
  check('attendance', state.attendance.filter((row) => sessionIds.has(row.sessionId) || row.teachingId === tchId));
  check('logs', state.logs.filter((row) => row.teachingId === tchId || sessionIds.has(row.sessionId)));
  check('notes', state.notes.filter((row) => row.teachingId === tchId || sessionIds.has(row.sessionId)));
  check('class-rules', state.classRules.filter((row) => row.teachingId === tchId));
  check('class-goal', state.classGoals.filter((row) => row.teachingId === tchId));
  check('class-charter-selection', state.classCharterSelections.filter((row) => row.teachingId === tchId));
  check('group-arrangement', state.groupArrangements.filter((row) => row.teachingId === tchId));
  check('assignments', assignmentRows);
  check('submissions', state.submissions.filter((row) => assignmentIds.has(row.assignmentId)));
  return [...new Set(evidence)];
}

/** Retained evidence which makes destructive class deletion unsafe. */
export function sectionDeleteEvidence(secId) {
  const evidence = [];
  if (state.enrollments.some((row) => row.sectionId === secId)) evidence.push('enrollments');
  for (const teaching of state.teachings.filter((row) => row.sectionId === secId)) {
    if (teaching.deleted) evidence.push('teaching-tombstone');
    evidence.push(...teachingDeleteEvidence(teaching.id));
  }
  return [...new Set(evidence)];
}

const validCivilDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return todayISO(date) === value;
};

export function validateSectionReopen(secId) {
  const section = getSection(secId);
  if (!section || section.status !== 'archived' || !section.archivedAt || !validCivilDate(section.archiveDate)) {
    return { ok: false, reason: 'lifecycle-inconsistent' };
  }
  const year = getYear(section.yearId);
  if (!year || year.status === 'archived') return { ok: false, reason: 'year-closed' };
  const openTerms = live(state.terms).filter((term) => term.yearId === year.id && term.status !== 'closed');
  if (!openTerms.length) return { ok: false, reason: 'term-closed' };
  const archivedTeachingIds = new Set(live(state.teachings).filter((teaching) => teaching.sectionId === secId).map((teaching) => teaching.id));
  const activeTeachingIds = new Set(live(state.teachings).filter((teaching) =>
    teaching.sectionId !== secId && !isSectionArchived(teaching.sectionId)).map((teaching) => teaching.id));
  const activeSlots = live(state.slots).filter((slot) => isNonTeachingSlot(slot) || activeTeachingIds.has(slot.teachingId));
  const conflict = live(state.slots).find((slot) => archivedTeachingIds.has(slot.teachingId) &&
    activeSlots.some((other) => slot.weekday === other.weekday && slot.period === other.period &&
      (!isNonTeachingSlot(other) || other.termId === getTeaching(slot.teachingId)?.termId)));
  return conflict ? { ok: false, reason: 'slot-conflict', slotId: conflict.id } : { ok: true };
}

/** Archive is immediate locally and durable offline; no child record is touched. */
export async function archiveSection(secId, archiveDate = todayISO()) {
  const section = getSection(secId);
  if (!section) throw new Error('الفصل غير موجود.');
  if (!validCivilDate(archiveDate)) throw new Error('تاريخ الأرشفة غير صالح.');
  if (section.status === 'archived') return section;
  const stamp = now();
  const archived = syncV2Record('sections', { ...section, status: 'archived', archivedAt: new Date(stamp).toISOString(), archiveDate, updatedAt: stamp });
  const command = lifecycleCommandEntry('archive_class', secId, 'sections', stamp, { archiveDate });
  const teachingIds = new Set(live(state.teachings).filter((row) => row.sectionId === secId).map((row) => row.id));
  const cancelledGoals = live(state.classGoals).filter((goal) => teachingIds.has(goal.teachingId) && goal.state === 'active')
    .map((goal) => syncV2Record('classGoals', { ...goal, state: 'cancelled', completedAt: stamp, updatedAt: stamp }));
  await db.applyBatch({ sections: {}, classGoals: {}, outbox: {} }, { prepare: () => ({
    sections: { put: [archived], remove: [] },
    classGoals: { put: cancelledGoals, remove: [] },
    outbox: { put: command ? [command] : [], remove: [] },
  }) });
  applyToMemory('sections', [archived]);
  applyToMemory('classGoals', cancelledGoals);
  notify();
  broadcast([{ store: 'sections', id: secId }, ...changeList('classGoals', cancelledGoals)]);
  return archived;
}

/** Reopen remains read-only locally until the server repeats the validation. */
export async function reopenSection(secId) {
  const validation = validateSectionReopen(secId);
  if (!validation.ok) return validation;
  const stamp = now();
  const command = lifecycleCommandEntry('reopen_class', secId, 'sections', stamp);
  if (!command) return { ok: false, reason: 'local-only' };
  let queued = false;
  await db.applyBatch({ outbox: {} }, { prepare: (current) => {
    const existing = current.outbox.some((row) => row.command === 'lifecycle:reopen_class' && row.patch?.targetId === secId && !['rejected', 'conflict'].includes(row.state));
    queued = !existing;
    return { outbox: { put: existing ? [] : [command], remove: [] } };
  } });
  return { ok: true, status: queued ? 'pending-server-validation' : 'already-pending' };
}

function n77Context(tchId) {
  const workspace = activeWorkspace;
  const teaching = state.teachings.find((row) => row.id === tchId && !row.deleted);
  if (!state.ready || workspace?.type !== 'account' || workspace.ownershipState !== 'claimed' ||
      workspace.syncEligible !== true || !workspace.authUserId || !teaching ||
      !state.sections.some((row) => row.id === teaching.sectionId && !row.deleted)) {
    throw new Error(DELETE_STALE_MESSAGE);
  }
  if (!globalThis.navigator?.onLine) throw new Error(DELETE_RETRY_MESSAGE);
  return { workspace, teaching, ownerId: workspace.authUserId };
}


function n77CheckLocalScope(plan) {
  const localIds = live(state.teachings).filter((row) => row.sectionId === plan.sectionId).map((row) => row.id);
  if (plan.scope === 'section' ? localIds.length !== 1 || localIds[0] !== plan.selectedTeachingId
    : localIds.length < 2 || !localIds.includes(plan.selectedTeachingId)) throw new Error(DELETE_STALE_MESSAGE);
}


/** Demo has no server owner. Recheck the confirmed scope and cascade in one local transaction. */
export async function deleteDemoTeachingScope(tchId, expectedSectionId, expectedScope) {
  if (activeWorkspace?.type !== 'demo' || db.getActiveDatabaseName() !== 'rakeezx-demo')
    throw new Error('حذف الفصل التجريبي متاح في مساحة التجربة فقط.');
  if (!['teaching', 'section'].includes(expectedScope)) throw new Error('نطاق الحذف غير صالح.');
  const stamp = now();
  let scope;
  const committed = await db.applyBatch(Object.fromEntries(db.STORES.map((name) => [name, {}])), {
    prepare(current) {
      const active = (name) => current[name].filter((row) => !row.deleted);
      const selected = active('teachings').find((row) => row.id === tchId);
      const section = active('sections').find((row) => row.id === expectedSectionId);
      if (!selected || !section || selected.sectionId !== section.id ||
          !isLocalOnlyRecord(selected) || !isLocalOnlyRecord(section))
        throw new Error('تغيّر الفصل التجريبي. حدّث القائمة وأعد المحاولة.');
      const siblings = active('teachings').filter((row) => row.sectionId === section.id);
      const actualScope = siblings.length === 1 ? 'section' : 'teaching';
      if (actualScope !== expectedScope) throw new Error('تغيّر نطاق الحذف. راجعه ثم أعد التأكيد.');
      const teachingIds = new Set(actualScope === 'section' ? siblings.map((row) => row.id) : [tchId]);
      const ids = (name, predicate) => new Set(active(name).filter(predicate).map((row) => row.id));
      const itemIds = ids('items', (row) => teachingIds.has(row.teachingId));
      const subitemIds = ids('scoreSubitems', (row) => itemIds.has(row.itemId));
      const sessionIds = ids('sessions', (row) => teachingIds.has(row.teachingId));
      const assignmentIds = ids('assignments', (row) => teachingIds.has(row.teachingId));
      const targets = {
        teachings: (row) => teachingIds.has(row.id),
        items: (row) => teachingIds.has(row.teachingId),
        scoreSubitems: (row) => itemIds.has(row.itemId),
        scoreSubitemCompletions: (row) => subitemIds.has(row.subitemId),
        scores: (row) => itemIds.has(row.itemId),
        slots: (row) => teachingIds.has(row.teachingId),
        sessions: (row) => teachingIds.has(row.teachingId),
        sessionRosterSnapshots: (row) => sessionIds.has(row.sessionId) || teachingIds.has(row.teachingId),
        attendance: (row) => sessionIds.has(row.sessionId) || teachingIds.has(row.teachingId),
        logs: (row) => teachingIds.has(row.teachingId) || sessionIds.has(row.sessionId),
        notes: (row) => teachingIds.has(row.teachingId) || sessionIds.has(row.sessionId),
        classRules: (row) => teachingIds.has(row.teachingId),
        classGoals: (row) => teachingIds.has(row.teachingId),
        classCharterSelections: (row) => teachingIds.has(row.teachingId),
        groupArrangements: (row) => teachingIds.has(row.teachingId),
        assignments: (row) => teachingIds.has(row.teachingId),
        submissions: (row) => assignmentIds.has(row.assignmentId),
      };
      if (actualScope === 'section') {
        targets.sections = (row) => row.id === section.id;
        targets.enrollments = (row) => row.sectionId === section.id;
        const enrolled = ids('enrollments', targets.enrollments);
        const studentIds = new Set(active('enrollments').filter((row) => enrolled.has(row.id)).map((row) => row.studentId));
        const orphanStudentIds = new Set([...studentIds].filter((studentId) =>
          !current.enrollments.some((enrollment) => enrollment.studentId === studentId && enrollment.sectionId !== section.id) &&
          !['scores', 'attendance', 'logs', 'notes', 'submissions'].some((name) =>
            active(name).some((record) => record.studentId === studentId && !targets[name](record)))));
        targets.students = (row) => orphanStudentIds.has(row.id);
        for (const name of ['scores', 'attendance', 'logs', 'notes', 'submissions']) {
          const inScope = targets[name];
          targets[name] = (row) => inScope(row) || orphanStudentIds.has(row.studentId);
        }
      }
      const writes = {};
      const removed = {};
      for (const [name, predicate] of Object.entries(targets)) {
        const rows = active(name).filter(predicate);
        if (rows.length) {
          writes[name] = { put: rows.map((row) => ({ ...row, deleted: true, updatedAt: stamp })) };
          removed[name] = new Set(rows.map((row) => row.id));
        }
      }
      const manifest = current.meta.find((row) => row.id === 'demo:packages');
      if (manifest) writes.meta = { put: [{ ...manifest, updatedAt: stamp,
        packages: (manifest.packages ?? []).map((pkg) => ({ ...pkg,
          owned: Object.fromEntries(Object.entries(pkg.owned ?? {}).map(([name, values]) =>
            [name, values.filter((id) => !removed[name]?.has(id))])) }))
          .filter((pkg) => pkg.owned.sections?.length || pkg.owned.teachings?.length) }] };
      scope = actualScope;
      return writes;
    },
  });
  const changes = Object.entries(committed).flatMap(([name, operations]) =>
    (operations.put ?? []).map((row) => ({ store: name, id: row.id })));
  await absorb(changes);
  broadcast(changes);
  return { scope };
}


async function clearRejectedN77Intent(mutationId) {
  await db.applyBatch({ device: {} }, { allowStudentLifecycle: true, prepare: (current) => {
    const device = current.device.find((row) => row.id === 'device');
    return { device: { put: device?.n77DeleteIntent?.mutationId === mutationId
      ? [{ ...device, n77DeleteIntent: null, updatedAt: now() }] : [], remove: [] } };
  } });
}

export async function previewDeleteTeaching(tchId) {
  const { teaching, ownerId } = n77Context(tchId);
  const device = await db.get('device', 'device');
  if (device?.studentLifecycleResume) throw new Error(DELETE_STALE_MESSAGE);
  const pending = device?.n77DeleteIntent;
  if (pending && (pending.ownerId !== ownerId || pending.selectedTeachingId !== tchId)) throw new Error(DELETE_STALE_MESSAGE);
  if (!pending && (await db.getAll('outbox')).some((row) => row.state !== 'superseded')) {
    throw new Error('أكمل مزامنة التغييرات المعلّقة قبل حذف الفصل، ثم أعد المحاولة.');
  }
  if (pending) return pending.plan;
  try {
    const plan = validateDeletePlan(await n77DeleteTeaching({ teachingId: tchId, sectionId: teaching.sectionId }),
      { teachingId: tchId, sectionId: teaching.sectionId, ownerId });
    n77CheckLocalScope(plan);
    return plan;
  } catch (error) {
    if (error.message === DELETE_STALE_MESSAGE) throw error;
    throw new Error(globalThis.navigator?.onLine ? DELETE_SERVER_UNAVAILABLE_MESSAGE : DELETE_RETRY_MESSAGE);
  }
}

/** Server commit must succeed before any local Product row is marked deleted. */
export async function deleteTeaching(tchId, plan) {
  if (!plan) throwLegacyDeleteUpdateRequired();
  assertLeaseWritable();
  const { ownerId } = n77Context(tchId);
  const { runClassDeletionExclusive } = await import('./lib/sync.js');
  return runClassDeletionExclusive(async bindCheckpoint => {
    try { return await executeDeleteTeaching(tchId, plan, bindCheckpoint); }
    finally { state.device = await db.get('device', 'device'); notify(); }
  }, { ownerId, teachingId: tchId });
}

async function executeDeleteTeaching(tchId, plan, bindCheckpoint) {
  if (!plan) throwLegacyDeleteUpdateRequired();
  const { teaching, ownerId, workspace } = n77Context(tchId);
  if ((await db.get('device', 'device'))?.studentLifecycleResume) throw new Error(DELETE_STALE_MESSAGE);
  validateDeletePlan(plan, { teachingId: tchId, sectionId: teaching.sectionId, ownerId });
  n77CheckLocalScope(plan);
  let intent;
  await db.applyBatch({ device: {}, outbox: {} }, { allowStudentLifecycle: true, prepare: (current) => {
    const device = current.device.find((row) => row.id === 'device');
    if (!device || device.studentLifecycleResume) throw new Error(DELETE_STALE_MESSAGE);
    const existing = device.n77DeleteIntent;
    if (existing && (existing.ownerId !== ownerId || existing.selectedTeachingId !== tchId ||
        existing.plan.fingerprint !== plan.fingerprint)) throw new Error(DELETE_STALE_MESSAGE);
    if (!existing && current.outbox.some((row) => row.state !== 'superseded')) {
      throw new Error('أكمل مزامنة التغييرات المعلّقة قبل حذف الفصل، ثم أعد المحاولة.');
    }
    intent = existing ?? { ownerId, selectedTeachingId: tchId, plan, mutationId: uid(), deviceId: device.deviceId ?? uid() };
    return { device: { put: [{ ...device, deviceId: intent.deviceId, n77DeleteIntent: intent, updatedAt: now() }], remove: [] } };
  } });
  bindCheckpoint(intent);
  state.device = await db.get('device', 'device');
  notify();
  let receipt;
  try {
    receipt = await n77DeleteTeaching({ teachingId: tchId, sectionId: teaching.sectionId,
      fingerprint: plan.fingerprint, mutationId: intent.mutationId, deviceId: intent.deviceId, commit: true });
  } catch (error) {
    if (error?.code === 'N77_SCOPE_STALE' || error?.code === '22023') {
      await clearRejectedN77Intent(intent.mutationId);
      throw new Error(DELETE_STALE_MESSAGE);
    }
    throw new Error(DELETE_AMBIGUOUS_MESSAGE);
  }
  if (activeWorkspace !== workspace || receipt?.outcome !== 'deleted' || receipt?.mutationId !== intent.mutationId || receipt?.ownerId !== ownerId ||
      receipt?.fingerprint !== plan.fingerprint || receipt?.scope !== plan.scope ||
      receipt?.sectionId !== plan.sectionId || receipt?.selectedTeachingId !== tchId ||
      JSON.stringify(receipt?.teachingIds) !== JSON.stringify(plan.teachingIds) ||
      !Array.isArray(receipt?.cascadeTeachingIds) || !receipt.cascadeTeachingIds.includes(tchId) ||
      (plan.scope === 'teaching' && (receipt.cascadeTeachingIds.length !== 1 || receipt.cascadeTeachingIds[0] !== tchId)) ||
      new Set(receipt.cascadeTeachingIds).size !== receipt.cascadeTeachingIds.length ||
      receipt.cascadeTeachingIds.some((id) => state.teachings.some((row) => row.id === id && row.sectionId !== plan.sectionId))) {
    throw new Error(DELETE_AMBIGUOUS_MESSAGE);
  }
  const names = db.STORES.filter((name) => !['profile', 'meta'].includes(name));
  try {
    await db.applyBatch(Object.fromEntries(names.map((name) => [name, {}])), {
      allowStudentLifecycle: true, prepare: (current) => localDeleteWrites(current, receipt, now()),
    });
  } catch { throw new Error(DELETE_AMBIGUOUS_MESSAGE); }
  const loaded = await Promise.all(COLLECTIONS.map((name) => db.getAll(name)));
  COLLECTIONS.forEach((name, index) => { state[name] = loaded[index]; });
  state.device = await db.get('device', 'device');
  notify();
  broadcast([{ store: 'teachings', id: tchId }, { store: 'sections', id: plan.sectionId }]);
  return receipt;
}

// AI N36: independent section-only lifecycle with the existing durable exclusion.
function subjectlessContext(sectionId){
 assertLeaseWritable();
 const workspace=activeWorkspace,ownerId=workspace?.authUserId,section=getSection(sectionId),year=activeYear(),term=activeTerm();
 const access=runtimeSyncOwnershipGuard.cloudAccess({operation:'pull',authenticatedUserId:cloud.user?.id});
 if(!state.ready||workspace?.type!=='account'||workspace.ownershipState!=='claimed'||!workspace.syncEligible||!ownerId||
 !cloud.session||cloud.user?.id!==ownerId||cloud.session.user?.id!==ownerId||!access.allowed||access.workspaceOwnerId!==ownerId||
 rawDB.getActiveDatabaseName()!==workspace.databaseName||!section||!year||!term||section.yearId!==year.id||term.yearId!==year.id||
 year.status!=='active'||term.status!=='active'||section.status!=='active'||[section,year,term].some(r=>r.ownerId!=null&&r.ownerId!==ownerId)||
 state.teachings.some(t=>!t.deleted&&t.sectionId===sectionId)||
 state.enrollments.some(e=>e.sectionId===sectionId&&e.ownerId!=null&&e.ownerId!==ownerId)||
 sectionRoster(sectionId).some(s=>s.ownerId!=null&&s.ownerId!==ownerId))throw Error(DELETE_STALE_MESSAGE);
 if(!globalThis.navigator?.onLine)throw Error(DELETE_RETRY_MESSAGE);
 return {workspace,ownerId,sectionId,yearId:year.id,termId:term.id};
}
export function subjectlessDeleteScope(sectionId){
 const c=subjectlessContext(sectionId);
 return {sectionId,kind:'class',signature:JSON.stringify([sectionId,c.ownerId,c.yearId,c.termId,[]])};
}
function checkSubjectlessPending(device,c){
 if(device?.studentLifecycleResume||device?.cloudRestoreResume)throw Error(DELETE_STALE_MESSAGE);
 const p=device?.n77DeleteIntent;
 if(p&&(p.kind!=='subjectless-section'||p.ownerId!==c.ownerId||p.sectionId!==c.sectionId||p.yearId!==c.yearId||p.termId!==c.termId))throw Error(DELETE_STALE_MESSAGE);
 return p;
}
export async function previewDeleteSubjectlessSection(sectionId){
 const c=subjectlessContext(sectionId),device=await db.get('device','device');
 const p=checkSubjectlessPending(device,c);
 if(p)return validateSubjectlessPlan(p.plan,c);
 if((await db.getAll('outbox')).some(r=>r.state!=='superseded'))throw Error('أكمل مزامنة التغييرات المعلّقة قبل حذف الفصل، ثم أعد المحاولة.');
 try{
  const plan=validateSubjectlessPlan(await n36DeleteSubjectlessSection(c),c);
  if(subjectlessContext(sectionId).workspace!==c.workspace)throw Error(DELETE_STALE_MESSAGE);
  return plan;
 }catch(e){if(e.message===DELETE_STALE_MESSAGE)throw e;throw Error(DELETE_SERVER_UNAVAILABLE_MESSAGE);}
}
export async function deleteSubjectlessSection(sectionId,plan){
 const c=subjectlessContext(sectionId);validateSubjectlessPlan(plan,c);
 const {runClassDeletionExclusive}=await import('./lib/sync.js');
 return runClassDeletionExclusive(async bindCheckpoint=>{
  try{
   let intent;
   await db.applyBatch({device:{},outbox:{},sections:{},teachings:{},years:{},terms:{},enrollments:{},students:{}},{allowStudentLifecycle:true,prepare(current){
    const live=subjectlessContext(sectionId);if(live.workspace!==c.workspace)throw Error(DELETE_STALE_MESSAGE);
    if(!current.sections.some(r=>r.id===sectionId&&!r.deleted&&r.status==='active'&&r.yearId===c.yearId)||
     current.teachings.some(t=>!t.deleted&&t.sectionId===sectionId)||
     current.enrollments.some(e=>e.sectionId===sectionId&&e.ownerId!=null&&e.ownerId!==c.ownerId)||
     current.students.some(s=>s.ownerId!=null&&s.ownerId!==c.ownerId&&current.enrollments.some(e=>e.sectionId===sectionId&&e.studentId===s.id))||
     !current.years.some(y=>y.id===c.yearId&&!y.deleted&&y.status==='active')||!current.terms.some(t=>t.id===c.termId&&!t.deleted&&t.status==='active'&&t.yearId===c.yearId))throw Error(DELETE_STALE_MESSAGE);
    const device=current.device.find(d=>d.id==='device');if(!device)throw Error(DELETE_STALE_MESSAGE);
    const prior=checkSubjectlessPending(device,c);
    if(prior&&prior.plan.fingerprint!==plan.fingerprint||!prior&&current.outbox.some(r=>r.state!=='superseded'))throw Error(DELETE_STALE_MESSAGE);
    intent=prior??{kind:'subjectless-section',selectedTeachingId:null,sectionId,ownerId:c.ownerId,yearId:c.yearId,termId:c.termId,plan,mutationId:uid(),deviceId:device.deviceId??uid()};
    return {device:{put:[{...device,deviceId:intent.deviceId,n77DeleteIntent:intent,updatedAt:now()}]}};
   }});
   bindCheckpoint(intent);state.device=await db.get('device','device');notify();
   let receipt;
   try{receipt=await n36DeleteSubjectlessSection({...c,fingerprint:plan.fingerprint,mutationId:intent.mutationId,deviceId:intent.deviceId,commit:true});}
   catch(e){if(e.code==='22023'){await clearRejectedN77Intent(intent.mutationId);throw Error(DELETE_STALE_MESSAGE);}throw Error(DELETE_AMBIGUOUS_MESSAGE);}
   try{
    validateSubjectlessPlan(receipt,c,true);
    if(receipt.mutationId!==intent.mutationId||receipt.fingerprint!==plan.fingerprint||JSON.stringify(receipt.cascadeTeachingIds)!==JSON.stringify(plan.cascadeTeachingIds)||JSON.stringify(receipt.enrollmentIds)!==JSON.stringify(plan.enrollmentIds)||subjectlessContext(sectionId).workspace!==c.workspace)throw Error(DELETE_STALE_MESSAGE);
    await db.applyBatch(Object.fromEntries(db.STORES.filter(n=>!['profile','meta'].includes(n)).map(n=>[n,{}])),{allowStudentLifecycle:true,prepare(current){
     if(subjectlessContext(sectionId).workspace!==c.workspace)throw Error(DELETE_STALE_MESSAGE);
     return subjectlessDeleteWrites(current,receipt,now());
    }});
   }catch{throw Error(DELETE_AMBIGUOUS_MESSAGE);}
   const loaded=await Promise.all(COLLECTIONS.map(n=>db.getAll(n)));
   if(activeWorkspace!==c.workspace)throw Error(DELETE_AMBIGUOUS_MESSAGE);
   COLLECTIONS.forEach((n,i)=>{state[n]=loaded[i];});state.device=await db.get('device','device');notify();broadcast([{store:'sections',id:sectionId}]);return receipt;
  }finally{if(activeWorkspace===c.workspace){state.device=await db.get('device','device');notify();}}
 },{ownerId:c.ownerId,teachingId:null,sectionId,kind:'subjectless-section'});
}

function throwLegacyDeleteUpdateRequired() {
  throw Object.assign(new Error('حذف الفصل غير متاح في هذا الإصدار. حدّث ركيز ثم أعد المحاولة.'), {
    code: 'N77_CLIENT_UPDATE_REQUIRED',
  });
}

export async function deleteClass() {
  throwLegacyDeleteUpdateRequired();
}

/**
 * واجهة إدارية داخلية قديمة: تنهي انتساب الشعبة وإسناداتها ولا تمس الطلاب.
 * الحذف المرئي للفصل يستخدم deleteClass أعلاه.
 */
export async function deleteSection(secId) {
  throwLegacyDeleteUpdateRequired();
}
/* ---------- عمليات: الطلاب والانتساب ---------- */

/* ---------- حدود وتحقق على مستوى البيانات ---------- */

/**
 * الحدود تُفرض هنا لا في الشاشة: كل ما يدخل من ملف نسخة أو من المزامنة لاحقًا
 * يمر من طبقة البيانات، والشاشة وحدها لا تكفي حارسًا.
 */
export const LIMITS = {
  nameMaxLength: 80,
  importMaxRows: 300,
  noteMaxLength: 500,
};

/** اسم صالح: ليس فارغًا ولا مسافات، ومقصوص عند الحد. */
export function normalizeName(value) {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;
  return name.slice(0, LIMITS.nameMaxLength);
}

/** هل رقم الكشف مأخوذ في هذه الشعبة؟ */
export function rollNoTaken(secId, rollNo, exceptEnrollmentId = null) {
  if (rollNo === null || rollNo === undefined || rollNo === '') return false;
  return enrollmentsIn(secId).some(
    (e) => e.status === 'active' && e.rollNo === Number(rollNo) && e.id !== exceptEnrollmentId
  );
}

// AI D-123: numbering is optional; membership has no 999-student ceiling.
const automaticRollNo = ordinal => Number.isSafeInteger(ordinal) && ordinal >= 1 && ordinal <= 999 ? ordinal : null;
const nextRollNo = (secId) => nextRollNoFrom(state.enrollments, secId);

const validRollNo = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999;

const nextRollNoFrom = (enrollments, secId) =>
  enrollments.filter((e) => e.sectionId === secId && !e.deleted)
    .reduce((max, e) => Math.max(max, validRollNo(e.rollNo) ? Number(e.rollNo) : 0), 0) + 1;

/**
 * Builds the complete final active roster for one section without persisting
 * an intermediate numbering state. The caller owns the surrounding batch.
 */
const sequentialRosterPlan = (enrollments, studentsById, secId, stamp) => {
  const active = enrollments.filter((row) => row.sectionId === secId && row.status === 'active' && !row.deleted);
  if (active.length > 999 || active.some((row) => !studentsById.has(row.studentId))) return null;
  const byEnrollmentId = new Map(active.map((row) => [row.id, row]));
  const sorted = sortStudents(active.map((enrollment) => ({
    ...studentsById.get(enrollment.studentId),
    rollNo: enrollment.rollNo,
    enrollmentId: enrollment.id,
  })));
  return sorted.map((student, index) => {
    const enrollment = byEnrollmentId.get(student.enrollmentId);
    const rollNo = index + 1;
    return {
      ...enrollment,
      rollNo,
      updatedAt: enrollment.rollNo === rollNo ? enrollment.updatedAt : stamp,
    };
  });
};

/** يضبط رقم كشف مع منع التكرار داخل الشعبة. يعيد {ok, reason}. */
export async function setRollNo(enrollmentId, rollNo) {
  const en = state.enrollments.find((e) => e.id === enrollmentId && !e.deleted);
  if (!en) return { ok: false, reason: 'notFound' };

  const value = rollNo === null || rollNo === '' ? null : Number(rollNo);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 999)) {
    return { ok: false, reason: 'range' };
  }
  if (rollNoTaken(en.sectionId, value, en.id)) return { ok: false, reason: 'duplicate' };

  await patch('enrollments', en.id, { rollNo: value });
  return { ok: true };
}

/** ترحيل متكرر آمن: ملاحظة الطالب القديمة تظهر مرة واحدة في السجل المؤرّخ.
 * نستخدم تاريخ آخر تعديل إن وُجد؛ وإلا تاريخ تشغيل الترحيل كأفضل تاريخ متاح. */
export async function migrateLegacyStudentNotes() {
  const migrated = [];
  for (const student of live(state.students)) {
    const text = String(student.note ?? '').trim();
    if (!text) continue;
    const localOnly = isLocalOnlyRecord(student);
    const id = `${localOnly ? 'demo:' : ''}legacy-note:${student.id}`;
    if (state.notes.some((note) => note.id === id)) continue;
    const stamp = Number.isFinite(Number(student.updatedAt)) ? Number(student.updatedAt) : now();
    migrated.push(makeNote({
      id, studentId: student.id, text, kind: 'legacy',
      date: todayISO(new Date(stamp)), createdAt: stamp, updatedAt: stamp,
    }));
  }
  if (migrated.length) await save({ notes: migrated });
  return migrated;
}

/** يضيف ملاحظة مستقلة إلى سجل الطالب، مع سياق اختياري محفوظ تاريخيًا. */
export async function addStudentNote({ studentId, text, teachingId = null, sessionId = null, date = todayISO(), createdAt = now() } = {}) {
  const student = getStudent(studentId);
  const clean = String(text ?? '').trim();
  if (!student || !clean || clean.length > 1200) return null;
  const stamp = Number(createdAt) || now();
  const note = makeNote({
    ...(isLocalOnlyRecord(student) ? { id: `demo:note:${uid()}` } : {}),
    studentId, teachingId, sessionId, date, text: clean, createdAt: stamp, updatedAt: stamp,
  });
  return (await save({ notes: [note] })) ? note : null;
}

export async function editStudentNote(noteId, text) {
  const clean = String(text ?? '').trim();
  if (!clean || clean.length > 1200) return null;
  return patch('notes', noteId, { text: clean });
}

export async function deleteStudentNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId && !item.deleted);
  if (!note) return null;
  return patch('notes', noteId, { deleted: true, deletedAt: new Date().toISOString() });
}

const normalizeClassRuleText = (value) => String(value ?? '').trim();
const normalizeClassRuleIcon = (value) => String(value ?? '').trim().toLowerCase();
const validClassRuleIcon = (value) => /^[a-z][a-z0-9_-]{0,39}$/.test(value);

/** أساس بيانات القوانين الصفية: CRUD محلي/متصل بلا واجهة أو دلالات عرض. */
export async function addClassRule({ teachingId, iconKey, text, createdAt = now() } = {}) {
  const teaching = getTeaching(teachingId);
  const cleanText = normalizeClassRuleText(text);
  const cleanIcon = normalizeClassRuleIcon(iconKey);
  if (!teaching || !cleanText || cleanText.length > 240 || !validClassRuleIcon(cleanIcon)) return null;
  const stamp = Number(createdAt) || now();
  const rule = makeClassRule({
    ...(isLocalOnlyRecord(teaching) ? { id: `demo:class-rule:${uid()}` } : {}),
    teachingId, iconKey: cleanIcon, text: cleanText, createdAt: stamp, updatedAt: stamp,
  });
  return (await save({ classRules: [rule] })) ? rule : null;
}

export async function editClassRule(ruleId, { iconKey, text } = {}) {
  const rule = state.classRules.find((candidate) => candidate.id === ruleId && !candidate.deleted);
  if (!rule) return null;
  const changes = {};
  if (text !== undefined) {
    const cleanText = normalizeClassRuleText(text);
    if (!cleanText || cleanText.length > 240) return null;
    changes.text = cleanText;
  }
  if (iconKey !== undefined) {
    const cleanIcon = normalizeClassRuleIcon(iconKey);
    if (!validClassRuleIcon(cleanIcon)) return null;
    changes.iconKey = cleanIcon;
  }
  return Object.keys(changes).length ? patch('classRules', ruleId, changes) : rule;
}

export async function deleteClassRule(ruleId) {
  const rule = state.classRules.find((candidate) => candidate.id === ruleId && !candidate.deleted);
  if (!rule) return null;
  const removed = await softDelete('classRules', ruleId);
  const config = live(state.classCharterSelections).find((row) => row.teachingId === rule.teachingId);
  if (removed && config?.selectedRuleIds?.includes(ruleId)) {
    await patch('classCharterSelections', config.id, {
      selectedRuleIds: config.selectedRuleIds.filter((id) => id !== ruleId),
    });
  }
  return removed;
}

const goalText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const validGoalState = (value) => ['active', 'cancelled', 'completed'].includes(value);

async function persistGoalRecord(storeName, record, previous = null) {
  assertOperationalWritesAllowed({ [storeName]: [record] });
  const prepared = syncV2Record(storeName, record, { pendingCreate: !previous });
  const fields = previous ? Object.keys(SYNC_V2_SCHEMAS[storeName].fields)
    .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(prepared[field])) : null;
  const entry = outboxEntry(storeName, prepared, fields, previous ? 'patch' : 'put', previous);
  await db.putAcross({ [storeName]: [prepared], outbox: entry ? [entry] : [] });
  applyToMemory(storeName, [prepared]);
  notify();
  broadcast([{ store: storeName, id: prepared.id }]);
  return prepared;
}

/** Creates a new run of the single durable current goal for one teaching. */
export async function startClassGoal({ teachingId, text, presetKey = null, durationMinutes, rewardPoints, date = todayISO(), sessionId: requestedSessionId = null } = {}) {
  const teaching = getTeaching(teachingId);
  const section = teaching ? getSection(teaching.sectionId) : null;
  const clean = goalText(text);
  const duration = Number(durationMinutes);
  const reward = Number(rewardPoints);
  if (!teaching || !section || section.status === 'archived' || isTermClosed(teaching.termId)) {
    throw new Error('لا يمكن بدء هدف في فصل مؤرشف أو فصل دراسي مغلق.');
  }
  if (!clean || clean.length > 120) throw new Error('يجب أن يكون الهدف بين 1 و120 حرفًا.');
  if (!validCivilDate(date)) throw new Error('تاريخ الهدف غير صالح.');
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) throw new Error('مدة الهدف يجب أن تكون بين 1 و180 دقيقة.');
  if (!Number.isInteger(reward) || reward < 1 || reward > 10) throw new Error('المكافأة يجب أن تكون بين 1 و10 نقاط مشاركة.');
  const sessions = sessionsOnFor(teachingId, date).filter((session) => !['cancelled', 'cancelled_holiday'].includes(session.status));
  const selectedSession = requestedSessionId
    ? sessions.find((session) => session.id === requestedSessionId)
    : sessions.find((session) => !attendanceCompleteness(session).completed) ?? sessions[0] ?? null;
  if (requestedSessionId && !selectedSession) throw new Error('الحصة المحددة لا تنتمي إلى هذا الإسناد والتاريخ.');
  const stamp = now();
  const record = {
    id: classGoalId(teachingId), teachingId, runId: uid(), date,
    sessionId: selectedSession?.id ?? null, text: clean, presetKey: presetKey || null,
    durationMinutes: duration, rewardPoints: reward, state: 'active',
    startedAt: stamp, completedAt: null, rewardOperationId: null,
    updatedAt: stamp, deleted: false,
  };
  const existing = classGoalOf(teachingId);
  return persistGoalRecord('classGoals', record, existing);
}

export async function cancelClassGoal(teachingId) {
  const goal = activeClassGoal(teachingId);
  return goal ? patch('classGoals', goal.id, { state: 'cancelled', completedAt: now() }) : null;
}

export async function setClassCharterSelection(teachingId, ruleIds = []) {
  const teaching = getTeaching(teachingId);
  if (!teaching) return null;
  const available = new Set(classRulesOf(teachingId).map((rule) => rule.id));
  const selectedRuleIds = [...new Set(ruleIds)].filter((id) => available.has(id));
  const id = classCharterSelectionId(teachingId);
  const existing = live(state.classCharterSelections).find((row) => row.id === id);
  return persistGoalRecord('classCharterSelections', {
    ...(existing ?? {}), id, teachingId, selectedRuleIds, updatedAt: now(), deleted: false,
  }, existing);
}

/** Exact, displayable eligibility used by the confirmation sheet. */
export function classGoalRewardPreview(teachingId) {
  const goal = activeClassGoal(teachingId);
  if (!goal) return { ok: false, reason: 'inactive', students: [] };
  let members = students(teachingId);
  if (goal.sessionId) {
    const session = getSession(goal.sessionId);
    if (!session || session.teachingId !== teachingId || session.date !== goal.date) {
      return { ok: false, reason: 'session-mismatch', students: [] };
    }
    const snapshot = sessionRosterSnapshot(session.id);
    const attendance = attendanceIn(session.id);
    if (!snapshot && attendance.length) return { ok: false, reason: 'legacy-membership-unresolved', students: [] };
    members = sessionRoster(session).members;
    const excluded = new Set(attendance.filter((row) => ['absent', 'excused'].includes(row.status)).map((row) => row.studentId));
    members = members.filter((student) => !excluded.has(student.id));
  }
  const unique = [...new Map(members.map((student) => [student.id, student])).values()];
  return { ok: true, reason: null, students: unique, count: unique.length, sessionId: goal.sessionId ?? null };
}

/** Queue one atomic server reward command; no local participation row is invented. */
export async function rewardClassGoal(teachingId) {
  const goal = activeClassGoal(teachingId);
  const preview = classGoalRewardPreview(teachingId);
  if (!goal || !preview.ok || !preview.count) throw new Error('لا يوجد طلاب مؤهلون لمكافأة هذا الهدف.');
  const stamp = now();
  const command = syncV2CommandEntry({
    store: 'classGoals', recordId: goal.id, command: 'class-goal:reward', stamp,
    baseRevision: goal.serverRevision ?? 0,
    patch: { goalId: goal.id, runId: goal.runId },
    dependencies: [{ store: 'classGoals', recordId: goal.id, requiresServerRevision: true }],
  });
  if (!command) throw new Error('لا يمكن مزامنة هدف تجريبي محلي.');
  let queued = false;
  await db.applyBatch({ outbox: {} }, { prepare(current) {
    const exists = current.outbox.some((row) => row.command === 'class-goal:reward' &&
      row.patch?.goalId === goal.id && row.patch?.runId === goal.runId && !['rejected'].includes(row.state));
    queued = !exists;
    return { outbox: { put: exists ? [] : [command], remove: [] } };
  } });
  if (queued) notify({ render: false });
  return { queued, count: preview.count, mutationId: queued ? command.mutationId : null };
}

/** يضيف طالبًا جديدًا وينسبه لشعبة. يرفض الاسم الفارغ. */
export async function addStudent(secId, name, { rollNo = null, note = '' } = {}) {
  const clean = normalizeName(name);
  if (!clean) return null;

  const student = {
    id: uid(), updatedAt: now(), deleted: false,
    name: clean, note: String(note ?? '').slice(0, LIMITS.noteMaxLength), status: 'active',
  };
  if (rollNo !== null && !validRollNo(rollNo)) return null;
  let accepted = false;
  const committed = await db.applyBatch({ students: {}, enrollments: {}, sections: {}, outbox: {} }, {
    prepare(current) {
      const section = current.sections.find(row => row.id === secId && !row.deleted && row.status !== 'archived');
      if (!section) throw Error('IMPORT_CHANGED');
      const number = rollNo === null ? automaticRollNo(nextRollNoFrom(current.enrollments, secId)) : Number(rollNo);
      if (number !== null && current.enrollments.some(row => row.sectionId === secId && !row.deleted && row.status === 'active' && row.rollNo === number)) return {};
      const enrollment = makeEnrollment({ studentId: student.id, sectionId: secId, rollNo: number });
      assertOperationalWritesAllowed({ students: [student], enrollments: [enrollment] });
      const st = syncV2Record('students', student, { pendingCreate: true });
      const en = syncV2Record('enrollments', enrollment, { pendingCreate: true });
      accepted = true;
      return { students: { put: [st] }, enrollments: { put: [en] }, outbox: { put: [
        outboxEntry('students', st, Object.keys(st), 'put', null),
        // Keep the existing enrollment command for numbered manual additions.
        // Only a fresh overflow identity uses the same nullable create as N12.
        en.rollNo === null || current.enrollments.filter(row => row.sectionId === secId && !row.deleted && row.status === 'active').length >= 999
          ? outboxEntry('enrollments', en, Object.keys(en), 'put', null) : enrollmentCommandEntry('enroll', en),
      ].filter(Boolean) } };
    },
  });
  if (!accepted) return null;
  applyCommittedPuts(committed);
  return student;
}

/** يعدّل اسم طالب — يرفض الفارغ ويقصّ الطويل. */
export async function renameStudent(studentId, name) {
  const clean = normalizeName(name);
  if (!clean) return null;
  return patch('students', studentId, { name: clean });
}

/**
 * استيراد أسماء دفعة واحدة.
 * يعيد { added, skippedInvalid, skippedOverLimit } — فيعرف المعلّم ما لم يدخل ولماذا.
 */
export async function importStudents(secId, names, { verifyCurrent, signal } = {}) {
  if (signal?.aborted) throw new Error('IMPORT_CANCELLED');
  const clean = [];
  let skippedInvalid = 0;

  for (const raw of names ?? []) {
    const n = normalizeName(raw);
    if (!n) { skippedInvalid++; continue; }
    clean.push(n);
  }

  const skippedOverLimit = Math.max(0, clean.length - LIMITS.importMaxRows);
  const accepted = clean.slice(0, LIMITS.importMaxRows);

  let roll = nextRollNo(secId) - 1;
  const stamp = now();
  const students = [];
  const enrollments = [];

  for (const name of accepted) {
    const st = { id: uid(), updatedAt: stamp, deleted: false, name, note: '', status: 'active' };
    students.push(st);
    enrollments.push(
      makeEnrollment({ studentId: st.id, sectionId: secId, rollNo: automaticRollNo(++roll), updatedAt: stamp })
    );
  }
  if (students.length) {
    // File import rechecks the confirmed preview against persisted rows inside
    // the same transaction as student/enrollment/outbox creation. Another tab
    // cannot slip a same-name student between the check and the write.
    const committed = await db.applyBatch({ students: {}, enrollments: {}, sections: {}, teachings: {}, outbox: {}, years: {}, terms: {}, device: {}, subjects: {} }, {
      signal,
      prepare(current) {
        verifyCurrent?.(current);
        assertOperationalWritesAllowed({ students, enrollments });
        const section = current.sections.find((row) => row.id === secId && !row.deleted && row.status !== 'archived');
        if (!section) throw new Error('IMPORT_CHANGED');
        let next = nextRollNoFrom(current.enrollments, secId);
        const nextStudents = students.map((row) => syncV2Record('students', row, { pendingCreate: true }));
        const nextEnrollments = enrollments.map((row) => syncV2Record('enrollments', { ...row, rollNo: automaticRollNo(next++) }, { pendingCreate: true }));
        const outbox = [
          ...nextStudents.map((row) => outboxEntry('students', row, Object.keys(row), 'put', null)),
          ...nextEnrollments.map((row) => verifyCurrent || row.rollNo === null ||
            current.enrollments.filter(en => en.sectionId === secId && en.status === 'active' && !en.deleted).length + nextEnrollments.length > 999
            ? outboxEntry('enrollments', row, Object.keys(row), 'put', null) : enrollmentCommandEntry('enroll', row)),
        ].filter(Boolean);
        return { students: { put: nextStudents }, enrollments: { put: nextEnrollments }, outbox: { put: outbox } };
      },
    });
    applyCommittedPuts(committed);
  }
  return { added: students.length, skippedInvalid, skippedOverLimit,
    students: students.map(({ id, name }) => ({ id, name })) };
}

/**
 * نقل طالب بين شعبتين: يُنهى الانتساب القديم ويُفتح جديد، ثم يُرقّم كشفا
 * المصدر والوجهة في نفس الدفعة المحلية ونفس العملية السحابية. لا يُحذف
 * الطالب ولا تُنشأ له هوية جديدة، ودرجاته وحضوره السابقان يبقيان مربوطين
 * بإسنادات شعبته السابقة.
 */
export async function transferStudent(studentId, toSectionId, { date = todayISO(), note = '' } = {}) {
  if (!studentId || !toSectionId || !date) return null;
  const stamp = now();
  let result = { ok: false, status: 'write-failed' };
  let committed;

  try {
    committed = await db.applyBatch({ students: {}, sections: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const student = current.students.find((row) => row.id === studentId && !row.deleted);
        const destinationSection = current.sections.find((row) => row.id === toSectionId && !row.deleted);
        if (!student) {
          result = { ok: false, status: 'student-missing' };
          return {};
        }
        if (!destinationSection || destinationSection.status === 'archived') {
          result = { ok: false, status: 'destination-missing' };
          return {};
        }

        const active = current.enrollments.filter((row) =>
          row.studentId === studentId && row.status === 'active' && !row.deleted);
        const destinationId = enrollmentId(studentId, toSectionId);
        const destination = current.enrollments.find((row) => row.id === destinationId) ?? null;

        // A retried completed transfer is intentionally write-free.
        if (active.length === 1 && active[0].id === destinationId) {
          result = { ok: true, status: 'already-active', enrollment: active[0] };
          return {};
        }
        if (active.length !== 1) {
          result = { ok: false, status: active.length ? 'multiple-active-memberships' : 'source-missing' };
          return {};
        }
        if (destination?.deleted) {
          // A tombstone is a durable deletion signal; transfer must not revive it.
          result = { ok: false, status: 'destination-tombstoned' };
          return {};
        }

        const source = active[0];
        const sourceSection = current.sections.find((row) => row.id === source.sectionId && !row.deleted);
        if (!sourceSection || sourceSection.status === 'archived') {
          result = { ok: false, status: 'source-unavailable' };
          return {};
        }
        // This number is private to the in-memory plan. It is replaced by the
        // final sequential destination roster before the IndexedDB transaction
        // commits, so a returned student's old number cannot collide locally.
        if ([source.sectionId, toSectionId].some(sectionId => current.enrollments.filter(row => row.sectionId === sectionId && row.status === 'active' && !row.deleted).length > 999)) {
          result = { ok: false, status: 'numbering-capacity-unavailable' };return {};
        }
        const provisionalRollNo = Number(destination?.rollNo) || nextRollNoFrom(current.enrollments, toSectionId);

        const retired = {
          ...source,
          status: 'transferred',
          endDate: date,
          transferNote: String(note ?? ''),
          updatedAt: stamp,
        };
        const activated = destination
          ? {
            ...destination,
            status: 'active',
            startDate: date,
            endDate: null,
            rollNo: provisionalRollNo,
            updatedAt: stamp,
          }
          : makeEnrollment({
            studentId,
            sectionId: toSectionId,
            rollNo: provisionalRollNo,
            startDate: date,
            updatedAt: stamp,
          });

        const afterMembership = current.enrollments
          .filter((row) => row.id !== source.id && row.id !== activated.id)
          .concat([retired, activated]);
        const studentsById = new Map(current.students
          .filter((row) => !row.deleted)
          .map((row) => [row.id, row]));
        const sourceRoster = sequentialRosterPlan(afterMembership, studentsById, source.sectionId, stamp);
        const destinationRoster = sequentialRosterPlan(afterMembership, studentsById, toSectionId, stamp);
        if (!sourceRoster || !destinationRoster) {
          result = { ok: false, status: 'roster-plan-unavailable' };
          return {};
        }

        const finalById = new Map([retired, ...sourceRoster, ...destinationRoster].map((row) => [row.id, row]));
        const finalDestination = finalById.get(activated.id);
        if (!finalDestination || !validRollNo(finalDestination.rollNo)) {
          result = { ok: false, status: 'destination-roll-unavailable' };
          return {};
        }
        const changedEnrollments = [...finalById.values()].filter((row) => {
          const before = current.enrollments.find((candidate) => candidate.id === row.id);
          return !before || before.status !== row.status || before.rollNo !== row.rollNo ||
            before.startDate !== row.startDate || before.endDate !== row.endDate ||
            before.transferNote !== row.transferNote || before.updatedAt !== row.updatedAt;
        }).map((row) => syncV2Record('enrollments', row, {
          pendingCreate: !current.enrollments.some((candidate) => candidate.id === row.id),
        }));
        const destinationForCommand = changedEnrollments.find((row) => row.id === finalDestination.id) ?? finalDestination;
        result = { ok: true, status: 'transferred', enrollment: finalDestination };
        return {
          enrollments: { put: changedEnrollments },
          outbox: {
            put: [enrollmentCommandEntry('transfer', destinationForCommand, {
              sourceEnrollmentId: source.id, date, note,
            })].filter(Boolean),
          },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'transferStudent', studentId, toSectionId });
    return null;
  }

  if (!result.ok) return null;
  if (result.status === 'already-active') return result.enrollment;
  const changed = changeList('enrollments', committed.enrollments?.put ?? []);
  await absorb(changed);
  broadcast(changed);
  return result.enrollment;
}

/** خروج الطالب من المدرسة — بلا حذف، فيبقى سجله التاريخي كاملًا. */
export async function withdrawStudent(studentId, { date = todayISO(), note = '' } = {}) {
  const enrollment = activeEnrollment(studentId);
  const student = getStudent(studentId);
  if (!enrollment || !student) return null;
  if (isSectionArchived(enrollment.sectionId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const stamp = now();
  const nextEnrollment = syncV2Record('enrollments', {
    ...enrollment, status: 'withdrawn', endDate: date, transferNote: note, updatedAt: stamp,
  });
  const nextStudent = syncV2Record('students', { ...student, status: 'withdrawn', updatedAt: stamp });
  try {
    const committed = await db.applyBatch({ students: {}, enrollments: {}, outbox: {} }, {
      prepare: () => ({
        students: { put: [nextStudent] },
        enrollments: { put: [nextEnrollment] },
        outbox: { put: [enrollmentCommandEntry('withdraw', nextEnrollment, {
          sourceEnrollmentId: enrollment.id, date, note,
        })].filter(Boolean) },
      }),
    });
    applyCommittedPuts(committed);
    return nextStudent;
  } catch (error) {
    reportWriteError(error, { op: 'withdrawStudent', studentId });
    return null;
  }
}

/** عودة طالب غادر. */
export async function reinstateStudent(studentId, secId, { date = todayISO() } = {}) {
  // Existing Production compatibility path; redesign is explicitly deferred.
  await patch('students', studentId, { status: 'active' });
  return transferStudent(studentId, secId, { date });
}

export async function previewStudentRemoval(studentId, sourceEnrollmentId, sourceRevision) {
  const lifecycle = await import('./lib/student-lifecycle.js');
  return lifecycle.previewStudentRemoval(studentId, sourceEnrollmentId, sourceRevision);
}

export async function deletePristineStudent(studentId) {
  assertLeaseWritable();
  const { executeStudentLifecycle } = await import('./lib/student-lifecycle.js');
  return executeStudentLifecycle('delete_pristine', { studentId });
}

export async function endStudentEnrollment(studentId, sourceEnrollmentId, { sourceRevision, note = '', date } = {}) {
  assertLeaseWritable();
  if (date !== undefined) throw Object.assign(new Error('Server-dated immediate ending only'), { code: 'IMMEDIATE_ONLY' });
  const { executeStudentLifecycle } = await import('./lib/student-lifecycle.js');
  return executeStudentLifecycle('end_enrollment', { studentId, sourceEnrollmentId, sourceRevision, note });
}

/** Compatibility alias: never expose the old unrestricted history cascade. */
export async function deleteStudent(studentId) {
  return (await deletePristineStudent(studentId)).ok;
}

export async function renumberRoster(secId) {
  if (!secId) return false;
  const stamp = now();
  const operationId = `renumber:${uid()}`;
  let result = { ok: false, status: 'write-failed' };
  let committed;

  try {
    committed = await db.applyBatch({ students: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const studentsById = new Map(current.students.filter((row) => !row.deleted).map((row) => [row.id, row]));
        const active = current.enrollments
          .filter((row) => row.sectionId === secId && row.status === 'active' && !row.deleted)
          .map((row) => ({ enrollment: row, student: studentsById.get(row.studentId) }))
          .filter((row) => row.student);
        if (active.length > 999) {
          result = { ok: false, status: 'numbering-capacity-unavailable' };return {};
        }
        const sorted = sortStudents(active.map(({ enrollment, student }) => ({
          ...student, rollNo: enrollment.rollNo, enrollmentId: enrollment.id,
        })));
        const planned = sorted.map((student, index) => {
          const enrollment = active.find((row) => row.enrollment.id === student.enrollmentId).enrollment;
          return { ...enrollment, rollNo: index + 1, updatedAt: enrollment.rollNo === index + 1 ? enrollment.updatedAt : stamp };
        });
        const changed = planned.filter((row) => current.enrollments.find((currentRow) => currentRow.id === row.id)?.rollNo !== row.rollNo);
        if (!changed.length) {
          result = { ok: true, status: 'unchanged' };
          return {};
        }
        const operation = {
          id: operationId,
          type: 'renumber',
          sectionId: secId,
          roster: structuredClone(planned),
          updatedAt: stamp,
          order: nextEnrollmentOperationOrder(current.outbox),
        };
        result = { ok: true, status: 'renumbered' };
        return {
          enrollments: { put: changed },
          outbox: {
            put: [
              ...changed.map((row) => outboxEntry('enrollments', row, ['rollNo'], 'patch')).filter(Boolean),
              enrollmentOperationEntry(operation, stamp),
            ].filter(Boolean),
          },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'renumberRoster', secId });
    return false;
  }

  if (!result.ok || result.status === 'unchanged') return result.ok;
  const changed = changeList('enrollments', committed.enrollments?.put ?? []);
  await absorb(changed);
  broadcast(changed);
  return true;
}

/* ---------- عمليات: بنود ودرجات ---------- */

export function clampScore(value, itemId) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const item = state.items.find((i) => i.id === itemId);
  const max = Number.isFinite(item?.max) ? item.max : Infinity;
  return Math.min(max, Math.max(0, n));
}

export function setScore(studentId, itemId, value, options = {}) {
  const item = state.items.find((candidate) => candidate.id === itemId && !candidate.deleted);
  if (!item || item.scoreMode === 'subitems') return null;
  // عندما توجد درجة واحدة متوافقة في شعبة سابقة، نحدّث سجلها نفسه بدل صنع
  // سجل ثانٍ للبند الموازي. أما البند المختلف أو الغامض فيبدأ غير مرصود هنا.
  const existing = portableGradeScore(studentId, item);
  const id = existing?.id ?? scoreId(studentId, itemId);
  const targetItemId = existing?.itemId ?? itemId;
  return patch('scores', id, { value: clampScore(value, itemId), deleted: false }, {
    id, studentId, itemId: targetItemId, value: null, deleted: false, updatedAt: now(),
  }, options);
}

export function deleteItem(itemId) {
  const subitemIds = new Set(state.scoreSubitems.filter((row) => row.itemId === itemId).map((row) => row.id));
  return cascadeDelete(
    {
      items: (i) => i.id === itemId,
      scoreSubitems: (s) => s.itemId === itemId,
      scoreSubitemCompletions: (s) => subitemIds.has(s.subitemId),
      scores: (s) => s.itemId === itemId,
    },
    { op: 'deleteItem', itemId },
    { command: 'delete_item', store: 'items', targetId: itemId }
  );
}

export const reorderItems = (pairs) =>
  patchManyRecords('items', pairs.map((p) => ({ id: p.id, changes: { order: p.order } })),
    { op: 'reorderItems' });

export const scoreSubitemsOf = (itemId) => sortByOrder(live(state.scoreSubitems)
  .filter((row) => row.itemId === itemId));

const scoreFoundationScope = () => ({
  items: {}, scoreSubitems: {}, scoreSubitemCompletions: {}, scores: {},
  students: {}, sections: {}, teachings: {}, terms: {}, outbox: {},
  units: {}, lessons: {}, logs: {}, attendance: {},
});

async function commitScoreFoundation(prepare, { n94 = false } = {}) {
  assertCloudRestoreWritable();
  const commandWorkspace = activeWorkspace;
  const isolatedDemo = activeWorkspace?.type === 'demo' && activeWorkspace.databaseName === 'rakeezx-demo';
  if (!isolatedDemo && (activeWorkspace?.type !== 'account' || activeWorkspace.ownershipState !== 'claimed' ||
      !activeWorkspace.authUserId)) {
    throw new Error('Score foundation requires a claimed account workspace');
  }
  if (!isolatedDemo) {
    const capability = await getScoreFoundationCapability({ workspace: commandWorkspace, allowOffline: true });
    if (capability?.scoreDomainVersion !== 1 || capability?.restoreProtocol !== 'CORE_V2' ||
        capability?.backupVersion !== 5 || capability?.copyDomainVersion !== 1) {
      throw new Error('Score foundation server capability is unavailable');
    }
    if (n94 && capability?.n94SubitemVersion !== 1) throw new Error('N94 server capability is unavailable');
  }
  if (activeWorkspace !== commandWorkspace) throw new Error('Score command workspace changed');
  assertCloudRestoreWritable();
  const committed = await db.applyBatch(scoreFoundationScope(), { prepare(current) {
    if (activeWorkspace !== commandWorkspace) throw new Error('Score command workspace changed');
    assertCloudRestoreWritable();
    return prepare(current);
  } });
  const changes = Object.entries(committed).filter(([name]) => name !== 'outbox')
    .flatMap(([name, operations]) => (operations.put ?? []).map((row) => ({ store: name, id: row.id })));
  await absorb(changes);
  broadcast(changes);
  return committed;
}

/** Establish an explicit, reviewed equivalence; never infer it from labels. */
export async function linkPortableScoreItems(sourceItemId, destinationItemId, { confirmed = false } = {}) {
  if (!confirmed || sourceItemId === destinationItemId) throw new Error('Explicit item-equivalence confirmation is required');
  let groupId;
  await commitScoreFoundation((current) => {
    const source = current.items.find((row) => row.id === sourceItemId && !row.deleted);
    const destination = current.items.find((row) => row.id === destinationItemId && !row.deleted);
    const sourceTeaching = current.teachings.find((row) => row.id === source?.teachingId && !row.deleted);
    const destinationTeaching = current.teachings.find((row) => row.id === destination?.teachingId && !row.deleted);
    const sourceSection = current.sections.find((row) => row.id === sourceTeaching?.sectionId && !row.deleted);
    const destinationSection = current.sections.find((row) => row.id === destinationTeaching?.sectionId && !row.deleted);
    if (!source || !destination || !sourceTeaching || !destinationTeaching || !sourceSection || !destinationSection ||
        sourceTeaching.id === destinationTeaching.id || sourceSection.id === destinationSection.id ||
        sourceTeaching.termId !== destinationTeaching.termId ||
        sourceTeaching.subjectId !== destinationTeaching.subjectId ||
        sourceSection.yearId !== destinationSection.yearId || sourceSection.grade !== destinationSection.grade ||
        source.scoreMode === 'subitems' || destination.scoreMode === 'subitems' ||
        Number(source.max) !== Number(destination.max) || automaticItemKey(source) !== automaticItemKey(destination) ||
        Boolean(source.auto) !== Boolean(destination.auto) ||
        (source.portabilityGroupId && destination.portabilityGroupId &&
          source.portabilityGroupId !== destination.portabilityGroupId)) {
      throw new Error('Item equivalence is unsafe or outside the same academic boundary');
    }
    groupId = source.portabilityGroupId || destination.portabilityGroupId || `portability:${uid()}`;
    const members = current.items.filter((row) => !row.deleted &&
      (row.portabilityGroupId === groupId || row.id === source.id || row.id === destination.id));
    if (new Set(members.map((row) => row.teachingId)).size !== members.length) {
      throw new Error('Portable group contains ambiguous items in one teaching');
    }
    const changed = [source, destination].filter((row) => row.portabilityGroupId !== groupId)
      .map((row) => syncV2Record('items', { ...row, portabilityGroupId: groupId, updatedAt: now() }));
    assertOperationalWritesAllowed({ items: changed });
    return {
      items: { put: changed },
      outbox: { put: changed.map((row) => outboxEntry('items', row, ['portabilityGroupId'], 'patch',
        current.items.find((old) => old.id === row.id))).filter(Boolean) },
    };
  });
  return groupId;
}

function preparedScore(current, item, studentId, completions, manualValue, stamp) {
  const prior = current.scores.find((row) => row.studentId === studentId && row.itemId === item.id && !row.deleted);
  const projection = projectSubitemScore(item,
    current.scoreSubitems.filter((row) => row.itemId === item.id),
    completions.filter((row) => row.studentId === studentId), manualValue,
    { studentId, ownerId: activeWorkspace?.authUserId ?? null });
  const record = syncV2Record('scores', {
    ...(prior ?? { id: scoreId(studentId, item.id), studentId, itemId: item.id }),
    ...projection, deleted: false, updatedAt: stamp,
  });
  return { prior, record, projection };
}

/** A checkbox and its local numeric projection commit in one IndexedDB transaction. */
export async function setScoreSubitemCompletion(studentId, subitemId, checked) {
  const completionState = typeof checked === 'string' ? checked : null;
  if (completionState ? !['unrecorded', 'late', 'regular'].includes(completionState) : typeof checked !== 'boolean') {
    throw new TypeError('Invalid completion state');
  }
  if (completionState) checked = completionState !== 'unrecorded';
  const stamp = now();
  let result;
  await commitScoreFoundation((current) => {
    const subitem = current.scoreSubitems.find((row) => row.id === subitemId && !row.deleted);
    const item = current.items.find((row) => row.id === subitem?.itemId && !row.deleted && row.scoreMode === 'subitems');
    if (!item || !current.students.some((row) => row.id === studentId && !row.deleted)) {
      throw new Error('Subitem or student is unavailable');
    }
    const matches = current.scoreSubitemCompletions.filter((row) => row.studentId === studentId && row.subitemId === subitemId);
    if (matches.length > 1) throw new Error('Conflicting completion identities require reconciliation');
    const prior = matches[0];
    const id = prior?.id ?? scoreSubitemCompletionId(studentId, subitemId);
    if (prior?.deleted) throw new Error('A deleted completion identity cannot be resurrected');
    const completion = syncV2Record('scoreSubitemCompletions', makeScoreSubitemCompletion({
      ...(prior ?? {}), id, studentId, subitemId, checked, updatedAt: stamp,
      completionState: completionState ?? (checked ? 'regular' : null),
    }), { pendingCreate: !prior });
    const completions = current.scoreSubitemCompletions.filter((row) => row.id !== id).concat(completion);
    const score = preparedScore(current, item, studentId, completions,
      current.scores.find((row) => row.studentId === studentId && row.itemId === item.id)?.manualValue ?? null, stamp);
    const entry = syncV2CommandEntry({ store: 'scores', recordId: score.record.id,
      command: 'score:set_completion', stamp,
      priorCommands: current.outbox,
      patch: { itemId: item.id, studentId, subitemId, checked,
        ...(completionState ? { completionState: checked ? completionState : null } : {}) },
      dependencies: [
        { store: 'items', recordId: item.id, requiresServerRevision: true },
        { store: 'students', recordId: studentId, requiresServerRevision: true },
        // A queued configure command establishes this server identity before
        // completion via the explicit command chain. A later offline edit can
        // keep its optimistic local definition at revision zero meanwhile.
        { store: 'scoreSubitems', recordId: subitemId, requiresServerRevision:
          !current.outbox.some(row => row.command === 'score:configure' && row.patch?.itemId === item.id &&
            row.patch?.payload?.subitems?.some(definition => definition.id === subitemId)) },
      ],
    });
    result = { completion, score: score.record, ...score.projection };
    return {
      scoreSubitemCompletions: { put: [completion] }, scores: { put: [score.record] },
      outbox: { put: entry ? [entry] : [] },
    };
  }, { n94: Boolean(completionState) });
  return result;
}

// Serialize deliberate taps per workspace/student/subitem and suppress rapid duplicates.
const subitemTaps = new Map();
export async function cycleScoreSubitemCompletion(studentId, subitemId, { localDate = todayISO() } = {}) {
  const workspace = activeWorkspace?.id;
  const key = `${workspace}:${studentId}:${subitemId}`;
  const priorTap = subitemTaps.get(key);
  const clickStamp = performance.now();
  if (priorTap && (priorTap.pending || clickStamp - priorTap.stamp < 350)) return priorTap.promise;
  const tap = { pending: true, stamp: clickStamp };
  tap.promise = (async () => {
    try {
      if (activeWorkspace?.id !== workspace) throw new Error('Workspace changed');
      const definition = state.scoreSubitems.find((row) => row.id === subitemId && !row.deleted);
      if (!definition) throw new Error('Subitem unavailable');
      const completion = state.scoreSubitemCompletions.find((row) => row.studentId === studentId && row.subitemId === subitemId);
      return await setScoreSubitemCompletion(studentId, subitemId,
        nextSubitemCompletionState(definition, completion, localDate));
    } finally { tap.pending = false; }
  })();
  subitemTaps.set(key, tap);
  return tap.promise;
}

/** Explicit blank remains unrecorded; explicit numeric zero remains recorded. */
export async function setScoreManualContribution(studentId, itemId, manualInput) {
  const requested = scoreCents(manualInput, { allowBlank: true });
  const stamp = now();
  let result;
  await commitScoreFoundation((current) => {
    const item = current.items.find((row) => row.id === itemId && !row.deleted && row.scoreMode === 'subitems');
    if (!item || !current.students.some((row) => row.id === studentId && !row.deleted)) {
      throw new Error('Subitem score item or student is unavailable');
    }
    const score = preparedScore(current, item, studentId, current.scoreSubitemCompletions,
      requested === null ? null : requested / 100, stamp);
    const entry = syncV2CommandEntry({ store: 'scores', recordId: score.record.id,
      command: 'score:set_manual', stamp,
      priorCommands: current.outbox,
      patch: { itemId, studentId, manualValue: score.record.manualValue },
      dependencies: [
        { store: 'items', recordId: itemId, requiresServerRevision: true },
        { store: 'students', recordId: studentId, requiresServerRevision: true },
      ],
    });
    result = { score: score.record, ...score.projection };
    return { scores: { put: [score.record] }, outbox: { put: entry ? [entry] : [] } };
  });
  return result;
}

/** Read-only impact preview; the committing API rechecks the version inside its transaction. */
export function previewScoreConfiguration(itemId, proposed) {
  const item = state.items.find((row) => row.id === itemId && !row.deleted);
  if (!item) throw new Error('Score item is unavailable');
  const nextMode = proposed.scoreMode ?? item.scoreMode ?? 'direct';
  const maximum = proposed.max ?? item.max;
  scoreCents(maximum);
  const supplied = proposed.subitems ?? scoreSubitemsOf(itemId);
  const values = nextMode === 'subitems' && (proposed.distributionMode ?? item.distributionMode) === 'auto'
    ? distributeAutomatically(maximum, supplied.length) : supplied.map((row) => {
      scoreCents(row.value);
      return row.value;
    });
  const nextDefinitions = supplied.map((row, index) => ({ ...row, itemId, value: values[index], order: index,
    ...normalizeSubitemDatesAndPoints({ ...row, value: values[index] }) }));
  const priorIds = new Set(scoreSubitemsOf(itemId).map((row) => row.id));
  const keptIds = new Set(nextDefinitions.map((row) => row.id).filter(Boolean));
  const removedIds = [...priorIds].filter((id) => !keptIds.has(id));
  const studentIds = new Set([
    ...state.scores.filter((row) => row.itemId === itemId && !row.deleted).map((row) => row.studentId),
    ...state.scoreSubitemCompletions.filter((row) => priorIds.has(row.subitemId) && row.checked && !row.deleted)
      .map((row) => row.studentId),
  ]);
  const nextItem = { ...item, ...proposed, max: maximum, scoreMode: nextMode };
  const projections = [...studentIds].map((studentId) => {
    const prior = state.scores.find((row) => row.studentId === studentId && row.itemId === itemId && !row.deleted);
    if (nextMode === 'direct') return { studentId, before: prior?.value ?? null, after: prior?.value ?? null };
    const manual = item.scoreMode === 'direct' ? prior?.value ?? null : prior?.manualValue ?? null;
    const next = projectSubitemScore(nextItem, nextDefinitions,
      state.scoreSubitemCompletions.filter((row) => row.studentId === studentId), manual,
      { studentId, ownerId: activeWorkspace?.authUserId ?? null });
    return { studentId, before: prior?.value ?? null, after: next.value, manualClamped: next.manualClamped };
  });
  return {
    itemId, expectedVersion: item.distributionVersion ?? 1,
    affectedStudentCount: projections.filter((row) => row.before !== row.after).length,
    usedDeletedSubitems: removedIds.filter((id) => state.scoreSubitemCompletions
      .some((row) => row.subitemId === id && row.checked && !row.deleted)),
    projections,
    requiresConfirmation: projections.some((row) => row.before !== row.after) || removedIds.length > 0 ||
      item.scoreMode !== nextMode,
  };
}

/** Apply a reviewed configuration and every affected local score in one transaction. */
export async function applyConfirmedScoreConfiguration(itemId, proposed, {
  expectedVersion, confirmed = false, conversionStrategy = null,
} = {}) {
  const preview = previewScoreConfiguration(itemId, proposed);
  if (preview.requiresConfirmation && !confirmed) throw new Error('Score recalculation requires explicit confirmation');
  if (expectedVersion !== preview.expectedVersion) throw new Error('Score configuration changed since preview');
  const supplied = proposed.subitems ?? scoreSubitemsOf(itemId);
  const prepared = supplied.map((row) => ({ ...row, id: row.id ?? uid() }));
  const stamp = now();
  let result;
  await commitScoreFoundation((current) => {
    const prior = current.items.find((row) => row.id === itemId && !row.deleted);
    if (!prior || (prior.distributionVersion ?? 1) !== expectedVersion) {
      throw new Error('Score configuration changed since preview');
    }
    const mode = proposed.scoreMode ?? prior.scoreMode ?? 'direct';
    if (!['direct', 'subitems'].includes(mode)) throw new Error('Invalid score mode');
    const distributionMode = mode === 'subitems' ? (proposed.distributionMode ?? prior.distributionMode) : null;
    if (mode === 'subitems' && !['auto', 'manual'].includes(distributionMode)) {
      throw new Error('Invalid subitem distribution mode');
    }
    if (prior.scoreMode === 'direct' && mode === 'subitems' &&
        current.scores.some((row) => row.itemId === itemId && row.value !== null && !row.deleted) &&
        conversionStrategy !== 'retain-as-manual') {
      throw new Error('Existing direct scores require an explicit reviewed conversion');
    }
    const maximum = proposed.max ?? prior.max;
    scoreCents(maximum);
    const values = mode === 'subitems' && distributionMode === 'auto'
      ? distributeAutomatically(maximum, prepared.length)
      : prepared.map((row) => { scoreCents(row.value); return row.value; });
    const existing = current.scoreSubitems.filter((row) => row.itemId === itemId);
    const existingIds = new Set(existing.map((row) => row.id));
    const keptIds = new Set(prepared.map((row) => row.id));
    if (prepared.some((row) => row.itemId && row.itemId !== itemId) ||
        prepared.some((row) => row.id && current.scoreSubitems.some((old) => old.id === row.id && old.itemId !== itemId))) {
      throw new Error('Subitem belongs to a different score item');
    }
    if (keptIds.size !== prepared.length) throw new Error('Duplicate subitem identity');
    const nextDefinitions = prepared.map((row, index) => {
      const old = existing.find((candidate) => candidate.id === row.id);
      if (old?.deleted) throw new Error('A deleted subitem identity cannot be resurrected');
      return syncV2Record('scoreSubitems', makeScoreSubitem({
        ...(old ?? {}), id: row.id, itemId, name: row.name,
        value: values[index], order: index, distributionVersion: (prior.distributionVersion ?? 1) + 1,
        ...normalizeSubitemDatesAndPoints({ ...row, value: values[index] }),
        createdAt: old ? old.createdAt : stamp,
        updatedAt: stamp,
      }), { pendingCreate: !old });
    });
    const removed = existing.filter((row) => !row.deleted && !keptIds.has(row.id))
      .map((row) => syncV2Record('scoreSubitems', { ...row, deleted: true, updatedAt: stamp }));
    if (removed.some((row) => current.scoreSubitemCompletions.some((completion) =>
      completion.subitemId === row.id && completion.checked && !completion.deleted)) && !confirmed) {
      throw new Error('Deleting a used subitem requires confirmation');
    }
    const item = syncV2Record('items', {
      ...prior, max: maximum, scoreMode: mode, distributionMode,
      distributionVersion: (prior.distributionVersion ?? 1) + 1,
      ...(mode === 'subitems' ? { portabilityGroupId: null } : {}),
      updatedAt: stamp,
    });
    const workingDefinitions = current.scoreSubitems.filter((row) => row.itemId !== itemId)
      .concat(nextDefinitions, removed);
    const relevantIds = new Set(existingIds);
    const studentIds = new Set([
      ...current.scores.filter((row) => row.itemId === itemId && !row.deleted).map((row) => row.studentId),
      ...current.scoreSubitemCompletions.filter((row) => relevantIds.has(row.subitemId) && row.checked && !row.deleted)
        .map((row) => row.studentId),
    ]);
    const scoreWrites = [];
    for (const studentId of studentIds) {
      const previous = current.scores.find((row) => row.studentId === studentId && row.itemId === itemId && !row.deleted);
      if (!previous) continue;
      let next;
      if (mode === 'direct') {
        next = { ...previous, manualValue: null, derivedValue: null, updatedAt: stamp };
      } else {
        const manual = prior.scoreMode === 'direct' ? previous.value : previous.manualValue;
        next = { ...previous, ...projectSubitemScore(item, workingDefinitions,
          current.scoreSubitemCompletions.filter((row) => row.studentId === studentId), manual,
          { studentId, ownerId: activeWorkspace?.authUserId ?? null }), updatedAt: stamp };
      }
      scoreWrites.push(syncV2Record('scores', next));
    }
    const configuration = {
      scoreMode: mode, distributionMode, max: maximum,
      subitems: mode === 'subitems' ? nextDefinitions.map((row) => ({
        id: row.id, name: row.name, value: row.value, order: row.order,
        startDate: row.startDate, dueDate: row.dueDate, latePoints: row.latePoints,
      })) : [],
      ...(conversionStrategy ? { conversionStrategy } : {}),
    };
    const entry = syncV2CommandEntry({ store: 'items', recordId: itemId,
      command: 'score:configure', stamp,
      priorCommands: current.outbox,
      patch: { itemId, expectedVersion, payload: configuration },
      dependencies: [
        { store: 'teachings', recordId: item.teachingId, requiresServerRevision: true },
        { store: 'items', recordId: itemId, requiresServerRevision: true },
      ],
    });
    result = { item, affectedStudentCount: scoreWrites.filter((row) =>
      row.value !== current.scores.find((priorScore) => priorScore.id === row.id)?.value).length,
      removedSubitemIds: removed.map((row) => row.id) };
    return {
      items: { put: [item] }, scoreSubitems: { put: [...nextDefinitions, ...removed] },
      scores: { put: scoreWrites }, outbox: { put: entry ? [entry] : [] },
    };
  }, { n94: supplied.some((row) => ['startDate', 'dueDate', 'latePoints'].some((field) => Object.hasOwn(row, field))) });
  return result;
}

function eligibleScoreCopyTargets(current, sourceTeachingId) {
  const source = current.teachings.find((row) => row.id === sourceTeachingId && !row.deleted);
  const sourceSection = current.sections.find((row) => row.id === source?.sectionId && !row.deleted);
  const sourceTerm = current.terms.find((row) => row.id === source?.termId && !row.deleted);
  if (!source || !sourceSection || !sourceTerm || sourceTerm.yearId !== sourceSection.yearId) {
    throw new Error('Source teaching boundary is unavailable');
  }
  return current.teachings.filter((teaching) => {
    if (teaching.deleted || teaching.sectionId === source.sectionId ||
        teaching.subjectId !== source.subjectId || teaching.termId !== source.termId) return false;
    const section = current.sections.find((row) => row.id === teaching.sectionId && !row.deleted);
    return section && section.yearId === sourceSection.yearId && section.grade === sourceSection.grade &&
      section.status !== 'archived';
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function previewScoreDistributionCopy(sourceTeachingId) {
  return distributionTargets(state, sourceTeachingId, activeWorkspace?.authUserId ?? null)
    .map(teaching => ({ teachingId: teaching.id, sectionId: teaching.sectionId }));
}

export function previewLegacyScoreDistributionCopy(sourceTeachingId) {
  const current = state;
  const targets = eligibleScoreCopyTargets(current, sourceTeachingId);
  const incoming = current.items.filter((row) => row.teachingId === sourceTeachingId && !row.deleted)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return targets.map((teaching) => ({
    teachingId: teaching.id, sectionId: teaching.sectionId,
    items: incoming.map((item) => ({ sourceItemId: item.id, ...classifyIncomingItem(item,
      current.scoreSubitems.filter((row) => row.itemId === item.id),
      current.items.filter((row) => row.teachingId === teaching.id), current.scoreSubitems) })),
  }));
}

const reviewedDistributions = new Map();
const distributionReviewKey = (source, targets, removals, mode) => JSON.stringify([
  activeWorkspace?.databaseName, source, [...targets].sort(), [...removals].sort(), mode,
]);
const isDistributionDemo = () => activeWorkspace?.type === 'demo' && activeWorkspace.databaseName === 'rakeezx-demo';

async function requireDistributionAccount(mode = 'definitions') {
  assertCloudRestoreWritable(); assertLeaseWritable();
  if (activeWorkspace?.type !== 'account' || activeWorkspace.ownershipState !== 'claimed' ||
      cloud.user?.id !== activeWorkspace.authUserId || !cloud.session || globalThis.navigator?.onLine === false) {
    throw new Error('اتصل بالإنترنت وسجّل الدخول لمراجعة توزيع الفصول.');
  }
  // Eligibility reads have no command. The Sync engine separately validates
  // dispatch against the exact owner-bound durable command before transport.
  const ownership = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: cloud.user.id });
  if (!ownership.allowed) throw new Error('تعذّر التحقق من ملكية مساحة العمل.');
  const capability = await cloud.getScoreDistributionCapability();
  if (capability?.distributionApplyVersion !== 2 || capability?.protocol !== 'N73_D119_V2') {
    throw new Error('خادم نسخ التوزيع يحتاج إلى تحديث. النسخ السابق ما زال متاحًا.');
  }
  if (mode === 'automatic-safe' && capability?.automaticSafeCopyVersion !== 1) {
    throw new Error('النسخ الآمن التلقائي يحتاج إلى تحديث الخادم.');
  }
  if (mode === 'preserve-target' && capability?.targetPreservationVersion !== 1) {
    throw new Error('حفظ سجلات الفصل الهدف يحتاج إلى تحديث الخادم.');
  }
  if ((await db.getAll('outbox')).some(row => row.protocol === 'v2' && !['superseded'].includes(row.state))) {
    throw new Error('أكمل مزامنة التغييرات الحالية قبل مراجعة التوزيع.');
  }
}

/** Demo uses the same bounded definition/score rules; accounts review server state. */
export function reviewScoreDistributionCopy(sourceTeachingId, targetTeachingIds, { removeItemIds = [], mode = 'definitions' } = {}) {
  if (!DISTRIBUTION_MODES.includes(mode)) throw new Error('Invalid distribution mode');
  if (isDistributionDemo()) return planScoreDistributionCopy(state, sourceTeachingId, targetTeachingIds, {
    ownerId: null, removeItemIds, mode, id: uid,
  });
  return (async () => {
    await requireDistributionAccount(mode);
    const owner = cloud.user.id, workspace = activeWorkspace.databaseName;
    const plan = await cloud.planScoreDistribution({ planId: uid(), sourceTeachingId, targetTeachingIds, removeItemIds, mode });
    if (cloud.user?.id !== owner || activeWorkspace?.databaseName !== workspace ||
        plan?.protocol !== 'N73_D119_V2' || (mode !== 'definitions' && plan.mode !== mode) || !Array.isArray(plan.targets) || !plan.token || !plan.planId) {
      throw new Error('تعذّر التحقق من مراجعة التوزيع.');
    }
    reviewedDistributions.set(distributionReviewKey(sourceTeachingId, targetTeachingIds, removeItemIds, mode), plan);
    return plan;
  })();
}

async function applyReviewedCommand(command, recordId, patch, verifyCurrent = () => {}, backgroundImportPlanId = null) {
  const engine = createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => cloud.user?.id ?? null, captureMutationContext: cloud.captureOwnedMutationContext });
  verifyCurrent();
  const queued = await engine.queueCommand({ store: 'items', recordId, command, patch, backgroundImportPlanId, verifyCurrent });
  verifyCurrent();
  const result = await engine.dispatchPending({ onlyMutationId: queued.mutationId });
  if (result.acknowledged !== 1) {
    const pending = await db.get('outbox', queued.id);
    throw new Error(command === 'score:grade_import'
      ? pending?.state === 'rejected' ? 'رُفضت دفعة الدرجات كاملة؛ راجع البنود والدرجات الحالية قبل طلب جديد.'
        : 'لم يتأكد إيصال دفعة الدرجات. الطلب محفوظ بنفس هويته لاستعادة الإيصال بأمان.'
      : pending?.state === 'rejected' ? 'تغيّر التوزيع أو تعذّر قبول التطبيق؛ راجع التغييرات قبل المحاولة الجديدة.'
        : 'تعذّر تأكيد التطبيق. طلبك محفوظ للمزامنة وإعادة المحاولة الآمنة.');
  }
  const changes = [];
  for (const store of ['students', 'enrollments', 'items', 'scoreSubitems', 'scoreSubitemCompletions', 'scores']) {
    changes.push(...(await db.getAll(store)).map(row => ({ store, id: row.id })));
  }
  await absorb(changes); broadcast(changes);
}

export function reviewNamesImport(teachingId, input) {
  const teaching = getTeaching(teachingId);
  const context = !isTeachingArchived(teaching) && importContext(activeWorkspace, teaching, cloud.user?.id);
  if (!context) throw new Error('تحقق من الحساب والفصل قبل الاستيراد.');
  return { ...previewStudentRows(input.rows, input.nameColumn, false, sectionRoster(teaching.sectionId)),
    context, teachingId, rows: input.rows, column: input.nameColumn };
}
export async function confirmNamesImport(review, approved, { verifyCurrent = () => {} } = {}) {
  verifyCurrent();
  const teaching = getTeaching(review.teachingId);
  const currentContext = !isTeachingArchived(teaching) && importContext(activeWorkspace, teaching, cloud.user?.id);
  if (approved && currentContext !== review.context) throw new Error('IMPORT_CHANGED');
  const currentPreview = previewStudentRows(review.rows, review.column, false, sectionRoster(teaching.sectionId));
  const controller = new AbortController(), stop = onWorkspaceDeactivation(() => controller.abort());
  try {
    return await confirmStudentImport({ approved, preview: review, currentPreview, expectedContext: review.context, currentContext,
      write: names => importStudents(teaching.sectionId, names, { signal: controller.signal, verifyCurrent(snapshot) {
        verifyCurrent();
        const currentTeaching = snapshot.teachings.find(row => row.id === teaching.id);
        if (importContext(activeWorkspace, currentTeaching, cloud.user?.id) !== review.context || isTeachingArchived(currentTeaching)) throw new Error('IMPORT_CHANGED');
        const ids = new Set(snapshot.enrollments.filter(row => row.sectionId === teaching.sectionId && row.status === 'active' && !row.deleted).map(row => row.studentId));
        const roster = snapshot.students.filter(row => ids.has(row.id) && !row.deleted);
        if (JSON.stringify(previewStudentRows(review.rows, review.column, false, roster).entries) !== JSON.stringify(review.entries)) throw new Error('IMPORT_CHANGED');
      } }) });
  } finally { stop(); }
}

export function reviewGradeImport(teachingId, input) {
  const teaching = getTeaching(teachingId), term = activeTerm();
  if (!teaching || isTeachingArchived(teaching) || teaching.termId !== term?.id || term.status !== 'active') throw new Error('اختر تدريسًا حيًا في الفصل الدراسي الحالي.');
  const { roster, items } = teachingContext(teachingId);
  input.newStudentIds ??= {};
  input.rows.slice(1).forEach((row, i) => { input.newStudentIds[i + 2] ??= { id: uid(), enrollmentId: uid() }; });
  return reviewGradeTransfer({ ...input, allowNewStudents: true, roster, items, scores: state.scores, teaching, term,
    ownerId: activeWorkspace?.authUserId, databaseName: activeWorkspace?.databaseName });
}

// Recheck the same acknowledged maximum stage during the asynchronous grade preflight.
export function assertImportMaximumReviewCurrent(review) {
  const saved=state.device?.classFileImportContinuation;
  for(const change of review.maxChanges??[]){
    const stage=saved?.maxProgress?.find(r=>r.itemId===change.itemId), item=state.items.find(i=>i.id===change.itemId);
    const ack=item?.importMaximumReceipt, before=JSON.parse(change.item);
    if(!stage || !isTransferItem(item??{deleted:true}) || ack?.mutationId!==stage.mutationId || ack.outcome!=='applied' || ack.conflicts ||
       Number(item.max)!==change.max || ack.max!==change.max || item.serverRevision!==ack.revision ||
       Object.keys(SYNC_V2_SCHEMAS.items.fields).filter(k=>k!=='max').some(k=>JSON.stringify(item[k]??null)!==JSON.stringify(before[k]??null)) ||
       importScoreBinding(state.scores.filter(r=>r.itemId===change.itemId))!==change.scores)
      throw Error('تغيّر أثر الاستيراد أو سياقه؛ يلزم مراجعة جديدة قبل حفظ درجات إضافية.');
  }
}

// AI-authored N107: ordinary max-only Sync mutation with a durable request checkpoint.
// No scoring configuration command, rescaling or invented server revision.
export async function confirmImportMaximums(review, { verifyCurrent = () => {} } = {}) {
  const workspace=assertClassImportAccess(), session=cloud.session;
  const guard=()=>{verifyCurrent();assertLeaseWritable();assertClassOperationsAccess(review.teachingId);
    if(activeWorkspace!==workspace || cloud.session!==session || cloud.user?.id!==review.ownerId ||
       workspace.databaseName!==review.databaseName || activeTerm()?.id!==review.termId)throw Error('IMPORT_CHANGED');};
  guard();
  await db.applyBatch({device:{},items:{},scores:{},outbox:{}},{prepare(current){
    guard();
    const device=current.device.find(r=>r.id==='device'), saved=device?.classFileImportContinuation;
    if(!saved || saved.created?.teachingId!==review.teachingId || saved.ownerId!==review.ownerId ||
       saved.databaseName!==review.databaseName)throw Error('IMPORT_CHANGED');
    if(JSON.stringify(saved.maximumReview)!==JSON.stringify(review))throw Error('IMPORT_CHANGED');
    if(saved.maxProgress){
      // Recover the old snapshot bug through this same reviewed transaction.
      // Only a still-identical canonical preimage may regain its own overlay;
      // this is neither a new request nor an acknowledgement.
      const repairs=[];
      for(const stage of saved.maxProgress){
        const row=current.outbox.find(r=>r.mutationId===stage.mutationId && !['rejected','superseded'].includes(r.state));
        const item=current.items.find(i=>i.id===stage.itemId),before=JSON.parse(stage.item);
        if(!row || Number(item?.max)!==stage.oldMax)continue;
        if(row.importMaximum!==true || row.ownerId!==review.ownerId || row.recordId!==stage.itemId ||
           row.patch?.max!==stage.max || row.localPatch?.max!==stage.max || !isTransferItem(item) ||
           item.serverRevision!==stage.revision || row.baseRevision!==stage.revision ||
           Object.keys(SYNC_V2_SCHEMAS.items.fields).filter(k=>k!=='max').some(k=>JSON.stringify(item[k]??null)!==JSON.stringify(before[k]??null)) ||
           importScoreBinding(current.scores.filter(r=>r.itemId===stage.itemId))!==stage.scores ||
           current.outbox.some(other=>other.id!==row.id && other.state!=='superseded' && other.store==='items' && other.recordId===stage.itemId))throw Error('IMPORT_CHANGED');
        repairs.push({...item,max:stage.max,updatedAt:now()});
      }
      return {device:{},items:{put:repairs},scores:{},outbox:{}};
    }
    const puts=[],commands=[],progress=[];
    for(const change of review.maxChanges??[]){
      const item=current.items.find(i=>i.id===change.itemId);
      if(!item || !isTransferItem(item) || item.teachingId!==review.teachingId || item.ownerId && item.ownerId!==review.ownerId || !(change.max>0 && change.max<=9999.99) || !/^\d+(?:\.\d{1,2})?$/.test(String(change.max)) || importItemBinding(item)!==importItemBinding(JSON.parse(change.item)) || importScoreBinding(current.scores.filter(r=>r.itemId===change.itemId))!==change.scores ||
         current.outbox.some(r=>r.state!=='superseded' && (r.store==='items' && r.recordId===change.itemId || r.store==='scores' && current.scores.some(sc=>sc.id===r.recordId && sc.itemId===change.itemId))) || item.syncConflicts?.length)
        throw Error('IMPORT_CHANGED');
      const next={...item,max:change.max,updatedAt:now()};
      assertOperationalWritesAllowed({items:[next]});
      const command=outboxEntry('items',next,['max'],'patch',item);
      if(!command)throw Error('IMPORT_CHANGED');
      command.importMaximum=true;
      puts.push(next);commands.push(command);progress.push({...change,mutationId:command.mutationId});
    }
    return {items:{put:puts},scores:{},outbox:{put:commands},device:{put:[{...device,
      classFileImportContinuation:{...saved,maxProgress:progress}}]}};
  }});
  guard();
  await absorb([{store:'device',id:'device'},...(review.maxChanges??[]).map(r=>({store:'items',id:r.itemId}))]);
  const engine=createSyncV2Engine({ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cloud.user?.id??null});
  const saved=(await db.get('device','device')).classFileImportContinuation;
  for(const stage of saved.maxProgress){
    guard();
    const row=(await db.getAll('outbox')).find(r=>r.mutationId===stage.mutationId);
    if(row?.state==='rejected')throw Error('رُفض تغيير العظمى؛ لم تُرسل درجات. راجع التعارض قبل طلب جديد.');
    if(row)await engine.dispatchPending({onlyMutationId:stage.mutationId});
    guard();
    const pending=(await db.getAll('outbox')).find(r=>r.mutationId===stage.mutationId);
    if(pending?.state==='rejected')throw Error('رُفض تغيير العظمى؛ لم تُرسل درجات. راجع التعارض قبل طلب جديد.');
    const item=await db.get('items',stage.itemId), ack=item?.importMaximumReceipt;
    if(ack?.mutationId===stage.mutationId && (ack.outcome!=='applied' || ack.conflicts || ack.max!==stage.max))
      throw Error('تعارض إيصال تغيير العظمى؛ لم تُرسل درجات. ألغِ المراجعة وعالج المزامنة ثم راجع الملف.');
    if(!ack || ack.mutationId!==stage.mutationId || ack.outcome!=='applied' || ack.conflicts ||
       ack.max!==stage.max || ack.revision!==item.serverRevision || !(ack.revision>stage.revision) ||
       Number(item.max)!==stage.max || !isTransferItem(item) || item.syncConflicts?.length ||
       importScoreBinding(await db.getAll('scores').then(rows=>rows.filter(r=>r.itemId===stage.itemId)))!==stage.scores ||
       (await db.getAll('outbox')).some(r=>r.store==='items' && r.recordId===stage.itemId && r.state!=='superseded'))
      throw Error('لم يتأكد إيصال تغيير العظمى. الطلب محفوظ بهويته؛ لم تُرسل درجات.');
    // All other item semantics must equal the approved item; canonical metadata alone may evolve.
    const before=JSON.parse(stage.item), fields=Object.keys(SYNC_V2_SCHEMAS.items.fields).filter(k=>k!=='max');
    if(fields.some(k=>JSON.stringify(item[k]??null)!==JSON.stringify(before[k]??null)))throw Error('IMPORT_CHANGED');
  }
  await absorb([{store:'device',id:'device'},...saved.maxProgress.map(r=>({store:'items',id:r.itemId}))]);
  guard();return saved.maxProgress;
}

export async function confirmGradeImport(review, { overwriteConfirmed = false, enrollmentConfirmed = false, approved = false, verifyCurrent = () => {}, backgroundImportPlanId = null } = {}) {
  if (!approved) return false;
  verifyCurrent();
  assertCloudRestoreWritable(); assertLeaseWritable();
  if (activeWorkspace?.type !== 'account' || activeWorkspace.ownershipState !== 'claimed' ||
    review.ownerId !== cloud.user?.id || activeWorkspace.authUserId !== review.ownerId ||
    review.databaseName !== activeWorkspace.databaseName || !cloud.session || globalThis.navigator?.onLine === false ||
    activeTerm()?.id !== review.termId) throw new Error('تأكيد الاستيراد يحتاج حساب المالك واتصالًا ومزامنة نظيفة.');
  const ownership = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: cloud.user.id });
  if (!ownership.allowed) throw new Error('تعذّر التحقق من ملكية مساحة العمل.');
  const batch = gradeCommand(review, overwriteConfirmed, enrollmentConfirmed);
  const capability = await cloud.getGradeImportCapability();
  // Recheck after asynchronous preflight. Dispatch itself guards the bound command.
  verifyCurrent(); assertLeaseWritable();
  if (review.ownerId !== cloud.user?.id || activeWorkspace?.databaseName !== review.databaseName || activeTerm()?.id !== review.termId ||
    (batch.newStudents?.length ? capability?.unifiedProtocol !== 'N90_UNIFIED_V1' || capability?.unifiedVersion !== 1 : capability?.protocol !== 'N90_REVIEWED_V1' || capability?.version !== 1)) throw new Error('قدرة استيراد الدرجات غير متاحة.');
  await applyReviewedCommand('score:grade_import', review.teachingId, { batch }, verifyCurrent, backgroundImportPlanId);
  return true;
}

export async function gradeImportRecovery() {
  return (await db.getAll('outbox')).filter(row => row.command === 'score:grade_import' && row.state !== 'superseded');
}

export async function retireRejectedGradeImport(mutationId, confirmed = false) {
  if (!confirmed) return false;
  assertCloudRestoreWritable(); assertLeaseWritable();
  await db.applyBatch({ outbox: {} }, { prepare(current) {
    const row = current.outbox.find(r => r.command === 'score:grade_import' && r.mutationId === mutationId);
    if (!row || row.state !== 'rejected') throw new Error('لا يجوز إلغاء طلب قد يكون طُبّق؛ استعد إيصال الطلب نفسه.');
    const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'dispatch', authenticatedUserId: cloud.user?.id, command: row });
    if (!access.allowed) throw new Error('تعذّر التحقق من ملكية الطلب المرفوض.');
    return { outbox: { put: [{ ...row, state: 'superseded', supersededAt: now(), recoveryReason: 'n90-explicit-rejected-disposition' }] } };
  } });
  return true;
}

export async function retryGradeImport(mutationId) {
  assertCloudRestoreWritable(); assertLeaseWritable();
  const pending = (await gradeImportRecovery()).find(row => row.mutationId === mutationId);
  if (!pending || pending.state === 'rejected') throw new Error('الطلب مرفوض؛ احتفظ بالمراجعة وصحّح سبب الرفض قبل طلب جديد.');
  const engine = createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => cloud.user?.id ?? null });
  const result = await engine.dispatchPending({ onlyMutationId: mutationId });
  if (result.acknowledged !== 1) throw new Error('لم يصل الإيصال بعد. الطلب نفسه محفوظ، دون إنشاء دفعة جديدة.');
  const changes = (await db.getAll('scores')).map(row => ({ store: 'scores', id: row.id }));
  for (const name of ['items', 'students', 'enrollments']) changes.push(...(await db.getAll(name)).map(row => ({ store: name, id: row.id })));
  await absorb(changes); broadcast(changes);
  return { teachingId: pending.patch.batch.teachingId, gradeCount: pending.patch.batch.cells.length,
    addedNames: pending.patch.batch.newStudents?.length ?? 0 };
}

/** No optimistic account writes: a durable command adopts one canonical receipt. */
export async function applyReviewedScoreDistribution(sourceTeachingId, targetTeachingIds, {
  expectedToken, removeItemIds = [], confirmed = false, mode = 'definitions',
} = {}) {
  if (typeof expectedToken !== 'string') throw new Error('راجع التوزيع قبل التطبيق.');
  if (!DISTRIBUTION_MODES.includes(mode)) throw new Error('Invalid distribution mode');
  if (isDistributionDemo()) {
    let result;
    await commitScoreFoundation(current => {
      const plan = planScoreDistributionCopy(current, sourceTeachingId, targetTeachingIds, {
        ownerId: null, removeItemIds, mode, id: uid, stamp: now(),
      });
      if (plan.token !== expectedToken) throw new Error('تغيّر التوزيع أو الدرجات منذ المراجعة.');
      if (!plan.targets.length) throw new Error('راجع البنود المكررة في الفصول المستهدفة قبل التطبيق.');
      if (plan.requiresConfirmation && !confirmed) throw new Error('تغييرات الدرجات تتطلب تأكيد الأثر.');
      result = { changedCount: plan.changedCount, targets: plan.targets };
      return plan.writes;
    });
    return result;
  }
  await requireDistributionAccount(mode);
  const key = distributionReviewKey(sourceTeachingId, targetTeachingIds, removeItemIds, mode);
  const plan = reviewedDistributions.get(key);
  if (!plan || plan.token !== expectedToken) throw new Error('راجع التوزيع قبل التطبيق.');
  if (plan.requiresConfirmation && !confirmed) throw new Error('تغييرات الدرجات تتطلب تأكيد الأثر.');
  await applyReviewedCommand('score:distribution_apply', sourceTeachingId, { planId: plan.planId,
    token: plan.token, confirmed });
  reviewedDistributions.delete(key);
  return { changedCount: plan.changedCount, targets: plan.targets, excludedTargets: plan.excludedTargets };
}

export async function renameScoreParent(itemId, name) {
  const item = state.items.find(row => row.id === itemId && !row.deleted);
  const trimmed = String(name ?? '').trim();
  if (!item || !trimmed || trimmed.length > 50) throw new Error('تحقق من اسم البند.');
  if (isDistributionDemo()) return patch('items', itemId, { name: trimmed });
  await requireDistributionAccount();
  await applyReviewedCommand('score:rename', itemId, { itemId, name: trimmed, revision: item.serverRevision });
  return true;
}

/** One-time definition copy. A conflict choice is "keep" or "add"; replacement is unsupported. */
export async function applyScoreDistributionCopy(sourceTeachingId, targetTeachingIds, conflictChoices = {}) {
  if (!Array.isArray(targetTeachingIds) || !targetTeachingIds.length ||
      targetTeachingIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(targetTeachingIds).size !== targetTeachingIds.length) {
    throw new Error('Copy requires distinct selected target IDs');
  }
  const selected = [...targetTeachingIds].sort();
  const expected = new Set(previewScoreDistributionCopy(sourceTeachingId).map((row) => row.teachingId));
  if (selected.some((id) => !expected.has(id))) throw new Error('Copy target is not eligible');
  let result;
  await commitScoreFoundation((current) => {
    const currentTargets = new Set(eligibleScoreCopyTargets(current, sourceTeachingId).map((row) => row.id));
    if (selected.some((id) => !currentTargets.has(id))) throw new Error('Copy target changed');
    const sourceItems = current.items.filter((row) => row.teachingId === sourceTeachingId && !row.deleted)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const clonedItems = [];
    const clonedSubitems = [];
    const entries = [];
    const classifications = [];
    for (const teachingId of selected) for (const source of sourceItems) {
      const sourceDefinitions = current.scoreSubitems.filter((row) => row.itemId === source.id && !row.deleted);
      const classification = classifyIncomingItem(source, sourceDefinitions,
        current.items.filter((row) => row.teachingId === teachingId), current.scoreSubitems);
      const key = `${teachingId}:${source.id}`;
      const choice = classification.kind === 'CONFLICTING' ? conflictChoices[key] : null;
      if (classification.kind === 'CONFLICTING' && !['keep', 'add'].includes(choice)) {
        throw new Error(`Distribution conflict requires an explicit choice: ${key}`);
      }
      classifications.push({ teachingId, sourceItemId: source.id, kind: classification.kind, choice });
      if (classification.kind === 'EQUIVALENT' || choice === 'keep') continue;
      const item = syncV2Record('items', makeItem({
        teachingId, name: source.name, max: source.max, order: source.order,
        auto: source.auto, perPoint: source.perPoint, penalty: source.penalty,
        unitId: source.unitId, lessonId: source.lessonId,
        scoreMode: source.scoreMode ?? 'direct', distributionMode: source.distributionMode ?? null,
        distributionVersion: 1, portabilityGroupId: null, distributionOriginId: source.id,
      }), { pendingCreate: true });
      clonedItems.push(item);
      const subitemIds = {};
      for (const definition of sourceDefinitions) {
        const clone = syncV2Record('scoreSubitems', makeScoreSubitem({
          itemId: item.id, name: definition.name, value: definition.value, order: definition.order,
          startDate: definition.startDate ?? null, dueDate: definition.dueDate ?? null, latePoints: definition.latePoints ?? null,
          distributionVersion: 1,
        }), { pendingCreate: true });
        clonedSubitems.push(clone);
        subitemIds[definition.id] = clone.id;
      }
      const entry = syncV2CommandEntry({ store: 'items', recordId: item.id,
        command: 'score:copy_definition',
        patch: { sourceItemId: source.id, sourceRevision: source.serverRevision ?? 0,
          targetTeachingId: teachingId, newItemId: item.id, subitemIds,
          conflictChoice: classification.kind === 'MISSING' ? 'missing' : 'add' },
        dependencies: [
          { store: 'items', recordId: source.id, requiresServerRevision: true },
          { store: 'teachings', recordId: teachingId, requiresServerRevision: true },
          ...sourceDefinitions.map((row) => ({ store: 'scoreSubitems', recordId: row.id,
            requiresServerRevision: true })),
        ],
      });
      if (entry) entries.push(entry);
    }
    result = { classifications, itemIds: clonedItems.map((row) => row.id),
      subitemIds: clonedSubitems.map((row) => row.id) };
    return { items: { put: clonedItems }, scoreSubitems: { put: clonedSubitems }, outbox: { put: entries } };
  });
  return result;
}

/* ---------- عمليات: الحصص والحضور ---------- */

/**
 * يجلب حصة أو ينشئها.
 * إن وافق التاريخ إجازة في التقويم، تُنشأ الحصة بحالة `cancelled_holiday`
 * فلا تُحسب حصة فائتة ولا تولّد غيابًا.
 */
export async function ensureSession(tchId, date, period = 1, extra = {}) {
  const id = sessionId(tchId, date, period);
  // A retained tombstone owns this natural identity permanently.  Looking only
  // through getSession() used to let this direct path overwrite the tombstone,
  // even though the automatic/range materializers already preserved it.
  const existing = state.sessions.find((session) => session.id === id || (
    session.teachingId === tchId && session.date === date && Number(session.period) === Number(period)
  ));
  if (existing) return existing.deleted ? null : existing;

  const tch = getTeaching(tchId);
  const term = getTerm(tch?.termId);
  if (getYear(term?.yearId)?.calendarPresetId != null &&
      (date > todayISO() || term.status === 'closed')) return null;
  const day = term ? selectedCalendarDay(getYear(term.yearId), date) ?? calendarDayForYear(term.yearId, date) : calendarDayFor(date);
  const holiday = day && !isTeachingDay(day.kind);

  // يُطبع وقت الحصة فيها الآن من الملف النشط. تغيير الملف لاحقًا لا يمسّها.
  const profile = activeTimeProfile();
  if (tch && isTeachingArchived(tch)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const sec = tch ? getSection(tch.sectionId) : null;
  const t = timeFor(weekday(date), period, profile, sec?.grade, date);
  const slot = live(state.slots).find(
    (s) => s.teachingId === tchId && s.weekday === weekday(date) && s.period === period
  );

  const ses = makeSession({
    teachingId: tchId, date, period,
    slotId: slot?.id ?? null,
    startTime: t?.start ?? '',
    endTime: t?.end ?? '',
    timeProfileId: profile?.id ?? null,
    status: holiday ? 'cancelled_holiday' : 'scheduled',
    reason: holiday ? day.label || CALENDAR_KIND[day.kind]?.label || 'إجازة رسمية' : '',
    ...extra,
  });
  await save({ sessions: [ses] });
  return getSession(ses.id);
}

/** Explicit entry creates one current occurrence, never an entire day. */
const openingSessions = new Map();
export async function ensureSessionsForDate(date = todayISO(), { signal, teachingId, period } = {}) {
  if (!teachingId || !Number.isInteger(Number(period)) || signal?.aborted) return { created: 0, existing: 0, skipped: 0 };
  const workspace = activeWorkspace;
  const key = `${workspace?.databaseName}|${teachingId}|${date}|${period}`;
  if (openingSessions.has(key)) return openingSessions.get(key);
  const pending = Promise.resolve().then(async () => {
    const guard = () => {
      if (workspace !== activeWorkspace || signal?.aborted) throw new Error('تغيّر سياق الحصة. أعد فتحها.');
      assertClassOperationsAccess(teachingId);
    };
    guard();
    const existing = state.sessions.find(row => row.teachingId === teachingId && row.date === date && Number(row.period) === Number(period));
    if (existing) return { created: 0, existing: existing.deleted ? 0 : 1, skipped: existing.deleted ? 1 : 0 };
    const projected = projectedSessionsForDate(date).find(row => row.teachingId === teachingId && Number(row.period) === Number(period));
    if (date !== todayISO() || !projected) return { created: 0, existing: 0, skipped: 1 };
    const expectedTerm = activeTerm()?.id, expectedYear = activeYear()?.id;
    const teaching = getTeaching(teachingId);
    const contextNames = ['years', 'terms', 'teachings', 'sections', 'subjects', 'slots', 'timeProfiles', 'calendars', 'calendarDays'];
    const contextToken = source => JSON.stringify(contextNames.map(name => (source[name] ?? [])
      .filter(row => name === 'years' ? row.id === expectedYear : name === 'terms' ? row.id === expectedTerm :
        name === 'teachings' ? row.id === teachingId : name === 'sections' ? row.id === teaching.sectionId :
        name === 'subjects' ? row.id === teaching.subjectId : name === 'slots' ? row.id === projected.slotId : name === 'calendars' ? row.yearId === expectedYear :
        name === 'calendarDays' ? row.date === date : true)
      .map(row => Object.fromEntries(['id', 'deleted', 'ownerId', ...Object.keys(SYNC_V2_SCHEMAS[name]?.fields ?? {})]
        .sort().map(field => [field, row[field] ?? null])))
      .sort((a, b) => a.id.localeCompare(b.id))));
    const expectedContext = contextToken(state);
    const { projected: ignored, ...session } = projected;
    const calendarContext = newSessionCalendarContext(session);
    const record = syncV2Record('sessions', { ...session, ...(calendarContext ? { calendarContext } : {}) }, { pendingCreate: true });
    assertOperationalWritesAllowed({ sessions: [record] });
    let result, adoptedId = record.id;
    // The durable identity check serializes other tabs as well as repeated clicks.
    await db.applyBatch(Object.fromEntries(['sessions', 'outbox', ...contextNames].map(name => [name, {}])), { signal, prepare(current) {
      guard();
      if (activeTerm()?.id !== expectedTerm || activeYear()?.id !== expectedYear || contextToken(current) !== expectedContext || contextToken(state) !== expectedContext) {
        throw new Error('تغيّر الجدول أو التقويم. أعد فتح الحصة.');
      }
      const prior = current.sessions.find(row => row.id === record.id ||
        row.teachingId === teachingId && row.date === date && Number(row.period) === Number(period));
      if (prior) {
        adoptedId = prior.id;
        result = { created: 0, existing: prior.deleted ? 0 : 1, skipped: prior.deleted ? 1 : 0 };
        return {};
      }
      const latest = projectedSessionsForDate(date).find(row => row.id === record.id);
      if (date !== todayISO() || !latest || ['startTime', 'endTime', 'timeProfileId', 'slotId'].some(field => latest[field] !== record[field])) {
        throw new Error('تغيّر يوم التقويم أو التوقيت. أعد فتح الحصة.');
      }
      const entry = outboxEntry('sessions', record, null, 'put', null);
      result = { created: 1, existing: 0, skipped: 0 };
      return { sessions: { put: [record] }, outbox: { put: entry ? [entry] : [] } };
    } });
    guard();
    const changes = [{ store: 'sessions', id: adoptedId }];
    await absorb(changes);
    broadcast(changes);
    return result;
  });
  openingSessions.set(key, pending);
  try { return await pending; } finally { if (openingSessions.get(key) === pending) openingSessions.delete(key); }
}

/** Operational cards only. Stored history getters continue returning persisted rows. */
export function operationalSessionsOn(date) {
  return [...sessionsOn(date), ...projectedSessionsForDate(date)].sort((a, b) => a.period - b.period);
}

/** إسقاط قراءة فقط للحصص غير المفتوحة من اليوم فصاعدًا؛ لا يكتب صفوف sessions. */
export function projectedSessionsForDate(date, { term = activeTerm() } = {}) {
  if (!date || date < todayISO() || !isSessionEligibleDate(date, { term })) return [];
  const profile = activeTimeProfile();
  const year = activeYear();
  const calendarDay = selectedCalendarDay(year, date) ?? calendarDayForYear(year?.id, date);
  const resolved = resolveProfile(profile, date, calendarDay);
  return teachings(term?.id).flatMap((teaching) => {
    const section = getSection(teaching.sectionId);
    return slotsOf(teaching.id).filter((slot) => slot.weekday === weekday(date)).map((slot) => {
      if (state.sessions.some(row => row.teachingId === teaching.id && row.date === date && Number(row.period) === Number(slot.period))) return null;
      const timing = periodTime(resolved, weekday(date), slot.period, section?.grade);
      if (!timing) return null;
      const session = makeSession({ teachingId: teaching.id, date, period: slot.period, slotId: slot.id,
        startTime: timing.start, endTime: timing.end, timeProfileId: resolved?.id ?? profile?.id ?? null,
        status: 'scheduled', projected: true });
      const calendarContext = newSessionCalendarContext(session);
      return calendarContext ? { ...session, calendarContext } : session;
    }).filter(Boolean);
  }).sort((a, b) => a.period - b.period);
}

/**
 * ينشئ الحصص المؤرخة المفقودة من خانات إسناد واحد ضمن حدود فصله الدراسي.
 * لا يعيد إنشاء أو إحياء أي سجل موجود، فتظل الحصص والحضور التاريخيان كما هما.
 */
export async function generateSessionsForRange(tchId, startDate, endDate) {
  const teaching = getTeaching(tchId);
  if (!teaching) throw new Error('الفصل غير موجود.');
  if (isTeachingArchived(teaching)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const term = getTerm(teaching.termId);
  const year = term ? getYear(term.yearId) : null;
  if (!term || !year) throw new Error('تعذّر تحديد السنة والفصل الدراسي لهذا الإسناد.');
  if (!term.startDate || !term.endDate) throw new Error('أدخل تاريخ بداية ونهاية الفصل الدراسي أولًا.');
  if (!startDate || !endDate || startDate > endDate) throw new Error('تحقق من نطاق التاريخ.');
  const today = todayISO();
  if (startDate > today) {
    return { created: 0, existing: 0, holidays: 0, suspensions: 0, unavailable: 0, startDate, endDate, clipped: true, futureClipped: true, futureOnly: true };
  }
  if (endDate < term.startDate || startDate > term.endDate) {
    throw new Error('النطاق المختار خارج تواريخ الفصل الدراسي الحالي.');
  }

  const effectiveStart = startDate < term.startDate ? term.startDate : startDate;
  const futureClipped = endDate > today;
  const requestedEnd = futureClipped ? today : endDate;
  const effectiveEnd = requestedEnd > term.endDate ? term.endDate : requestedEnd;
  const slots = slotsOf(tchId);
  if (!slots.length) throw new Error('لا توجد حصص في الجدول لهذا الفصل ضمن الإعداد الحالي.');

  const maxDays = 184;
  let date = effectiveStart;
  let dayCount = 0;
  let created = 0;
  let existing = 0;
  let holidays = 0;
  let suspensions = 0;
  let unavailable = 0;
  let matchedSlotDays = 0;
  const pending = [];
  const naturalIdentity = (teachingId, sessionDate, sessionPeriod) =>
    `${teachingId}\u0000${sessionDate}\u0000${Number(sessionPeriod)}`;
  const knownSessionIdentities = new Set(state.sessions.map((session) =>
    naturalIdentity(session.teachingId, session.date, session.period)));
  const section = getSection(teaching.sectionId);
  const profile = activeTimeProfile();

  while (date <= effectiveEnd) {
    dayCount++;
    if (dayCount > maxDays) throw new Error('النطاق كبير جدًا؛ اختر مدة لا تتجاوز 184 يومًا.');

    const matchingSlots = slots.filter((slot) => slot.weekday === weekday(date));
    if (matchingSlots.length) {
      matchedSlotDays++;
      const calendarDay = selectedCalendarDay(year, date) ?? calendarDayForYear(year.id, date);
      if (!isSessionEligibleDate(date, { year, term })) {
        holidays++;
        if (calendarDay?.kind === 'suspension') suspensions++;
      } else {
        const resolved = resolveProfile(profile, date, calendarDay);
        for (const slot of matchingSlots) {
          const id = sessionId(tchId, date, slot.period);
          const identity = naturalIdentity(tchId, date, slot.period);
          if (knownSessionIdentities.has(identity)) {
            existing++;
            continue;
          }
          const timing = periodTime(resolved, weekday(date), slot.period, section?.grade);
          if (!timing) {
            unavailable++;
            continue;
          }
          pending.push(makeSession({
            id,
            teachingId: tchId,
            date,
            period: slot.period,
            slotId: slot.id,
            startTime: timing.start,
            endTime: timing.end,
            timeProfileId: resolved?.id ?? profile?.id ?? null,
            status: 'scheduled',
          }));
          knownSessionIdentities.add(identity);
          created++;
        }
      }
    }
    date = shiftDate(date, 1);
  }

  if (!matchedSlotDays) throw new Error('لا توجد حصص في الجدول ضمن النطاق المختار.');
  if (pending.length) {
    const ok = await save({ sessions: pending });
    if (!ok) throw new Error('تعذّر حفظ الحصص المولّدة.');
  }
  return {
    created, existing, holidays, suspensions, unavailable,
    startDate: effectiveStart, endDate: effectiveEnd,
    clipped: effectiveStart !== startDate || effectiveEnd !== endDate,
    futureClipped,
  };
}
export async function setSessionStatus(sesId, status, reason = '') {
  const session = getSession(sesId);
  if (!session) return null;
  if (['cancelled', 'cancelled_holiday'].includes(status) &&
      (session.status === 'held' || attendanceIn(sesId).length > 0)) {
    throw new Error('لا يمكن إلغاء حصة تم رصد حضورها؛ صحّح الحضور أولًا.');
  }
  return patch('sessions', sesId, { status, reason });
}

const SESSION_DELETE_PROTECTED_MESSAGE = 'لا يمكن حذف هذه الحصة لأنها تحتوي على سجل محفوظ. استخدم الإلغاء عند الحاجة.';

/** Evidence which makes a dated session historical rather than pristine. */
export function sessionDeleteEvidence(sesId, source = state) {
  const rows = (name) => Array.isArray(source[name]) ? source[name] : [];
  const session = rows('sessions').find((record) => record.id === sesId);
  if (!session || session.deleted) return [];
  const evidence = [];
  if (session.status !== 'scheduled') evidence.push('status');
  if (session.makeupForId || rows('sessions').some((record) =>
    !record.deleted && record.id !== sesId && record.makeupForId === sesId)) evidence.push('makeup');
  if (rows('attendance').some((record) => !record.deleted && record.sessionId === sesId)) evidence.push('attendance');
  if (rows('sessionRosterSnapshots').some((record) => !record.deleted && record.sessionId === sesId)) evidence.push('roster-snapshot');
  if (rows('logs').some((record) => !record.deleted && record.sessionId === sesId)) evidence.push('logs');
  if (rows('notes').some((record) => !record.deleted && record.sessionId === sesId)) evidence.push('notes');
  if (rows('classGoals').some((record) => !record.deleted && record.sessionId === sesId)) evidence.push('class-goal');
  if (session.lessonId || session.note || session.homework || session.covered) evidence.push('content');
  return [...new Set(evidence)];
}

/**
 * Tombstone one genuinely unused session and queue the server-authoritative
 * guard in the same IndexedDB transaction.  No user-facing control calls this
 * yet; this is the runtime/data boundary for the later Sessions UI.
 */
export async function deleteSession(sesId) {
  const known = state.sessions.find((record) => record.id === sesId);
  if (!known) return null;
  if (known.deleted) return known;
  assertOperationalWritesAllowed({ sessions: [{ ...known, deleted: true }] });
  const knownEvidence = sessionDeleteEvidence(sesId);
  if (knownEvidence.length) throw new Error(SESSION_DELETE_PROTECTED_MESSAGE);

  const stamp = now();
  const command = isLocalOnlyRecord(known) ? null : syncV2CommandEntry({
    store: 'sessions', recordId: sesId, command: 'session:delete', stamp,
    baseRevision: known.serverRevision ?? 0,
    patch: { sessionId: sesId },
    dependencies: [{ store: 'sessions', recordId: sesId, requiresServerRevision: true }],
  });
  if (command) command.localPatch = { deleted: true, deletedAt: new Date(stamp).toISOString() };
  let deleted = null;
  await db.applyBatch({
    sessions: {}, attendance: {}, sessionRosterSnapshots: {}, logs: {}, notes: {}, classGoals: {}, outbox: {},
  }, {
    prepare(current) {
      const persisted = current.sessions.find((record) => record.id === sesId);
      if (!persisted || persisted.deleted) {
        deleted = persisted ?? null;
        return Object.fromEntries(Object.keys(current).map((name) => [name, { put: [], remove: [] }]));
      }
      if (sessionDeleteEvidence(sesId, current).length) throw new Error(SESSION_DELETE_PROTECTED_MESSAGE);
      deleted = syncV2Record('sessions', {
        ...persisted, deleted: true, deletedAt: new Date(stamp).toISOString(), updatedAt: stamp,
      });
      const alreadyQueued = current.outbox.some((entry) =>
        entry.protocol === 'v2' && entry.command === 'session:delete' && entry.patch?.sessionId === sesId);
      return {
        sessions: { put: [deleted], remove: [] },
        attendance: { put: [], remove: [] }, sessionRosterSnapshots: { put: [], remove: [] },
        logs: { put: [], remove: [] }, notes: { put: [], remove: [] }, classGoals: { put: [], remove: [] },
        outbox: { put: command && !alreadyQueued ? [command] : [], remove: [] },
      };
    },
  });
  if (deleted) {
    applyToMemory('sessions', [deleted]);
    notify();
    broadcast([{ store: 'sessions', id: sesId }]);
  }
  return deleted;
}

/** يضبط حضور طالب في حصة. لا يُنشأ حضور إلا لحصة قائمة. */
export async function setAttendance(sesId, studentId, status) {
  assertLeaseWritable();
  const ses = getSession(sesId);
  if (!ses) return null;
  const mutation = await mutateSnapshotAttendance(sesId, (members, existing, session, stamp) => {
    if (!members.some((member) => member.studentId === studentId)) return [];
    // Bulk server commands may supply a different canonical ID. Attendance
    // identity remains student/session; never recreate its optimistic alias.
    const previous = existing.filter((record) => record.studentId === studentId)
      .sort((a, b) => (b.serverRevision ?? 0) - (a.serverRevision ?? 0))[0];
    const id = previous?.id ?? attendanceId(studentId, sesId);
    return [{
      ...(previous ?? { id, studentId, sessionId: sesId, teachingId: session.teachingId, date: session.date, note: '' }),
      status, deleted: false, updatedAt: stamp,
    }];
  }, 'record');
  if (mutation.kind === 'snapshot') return mutation.records[0] ?? null;
  if (mutation.kind !== 'legacy') return null;

  // Experimental pre-snapshot sessions retain the previous behavior. The
  // forward-only guarantee begins only when a snapshot is first captured.
  const id = attendanceIn(sesId).find((record) => record.studentId === studentId)?.id ?? attendanceId(studentId, sesId);
  const rec = await patch('attendance', id, { status, deleted: false }, {
    id, studentId, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
    status, note: '', deleted: false, updatedAt: now(),
  });
  // أول رصد حضور يعني أن الحصة نُفّذت
  if (rec && ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return rec;
}

/** يرصد كل الطلاب غير المرصودين في حصة بحالة واحدة. */
export async function fillAttendance(sesId, status = 'present') {
  assertLeaseWritable();
  const ses = getSession(sesId);
  if (!ses) return 0;
  const mutation = await mutateSnapshotAttendance(sesId, (members, existing, session, stamp) => {
    const existingIds = new Set(existing.map((record) => record.studentId));
    return members
      .filter((member) => !existingIds.has(member.studentId))
      .map((member) => ({
        id: attendanceId(member.studentId, sesId), updatedAt: stamp, deleted: false,
        studentId: member.studentId, sessionId: sesId, teachingId: session.teachingId, date: session.date,
        status, note: '',
      }));
  }, 'fill');
  if (mutation.kind === 'snapshot') return mutation.records.length;
  if (mutation.kind !== 'legacy') return 0;

  const roster = students(ses.teachingId);
  const existing = new Set(attendanceIn(sesId).map((a) => a.studentId));
  const stamp = now();
  const recs = roster.filter((student) => !existing.has(student.id)).map((student) => ({
    id: attendanceId(student.id, sesId), updatedAt: stamp, deleted: false,
    studentId: student.id, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
    status, note: '',
  }));
  if (recs.length) await save({ attendance: recs });
  if (ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return recs.length;
}

/* ---------- عمليات: الجدول والتقويم ---------- */

function validatedSlot(data) {
  const slot = makeSlot(data);
  if (!['teaching', 'activity', 'waiting'].includes(slotKind(slot))) throw new Error('نوع الحصة غير صالح.');
  if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 ||
      !Number.isInteger(slot.period) || slot.period < 1 || slot.period > 12) throw new Error('اليوم أو رقم الحصة غير صالح.');
  if (isNonTeachingSlot(slot)) {
    if (slot.teachingId || !slot.termId || !getTerm(slot.termId) || getTerm(slot.termId).status === 'closed') throw new Error('اختر فصلًا دراسيًا متاحًا للحصة المستقلة.');
    slot.teachingId = null;
  } else {
    if (!getTeaching(slot.teachingId) || slot.termId) throw new Error('اختر الفصل والمادة للحصة التدريسية.');
    if (isTeachingArchived(slot.teachingId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
    slot.termId = null;
  }
  return slot;
}

export async function addSlot(tchId, weekday, period, times = {}, { verifyCurrent } = {}) {
  if (isTeachingArchived(tchId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);
  const slot = validatedSlot({ ...times, teachingId: tchId, weekday: Number(weekday), period: Number(period) });
  const termId = isNonTeachingSlot(slot) ? slot.termId : getTeaching(tchId)?.termId;
  const parent=verifyCurrent&&!isNonTeachingSlot(slot)?getTeaching(tchId):null;
  const parentScope=parent?Object.entries({teachings:parent,sections:getSection(parent.sectionId),subjects:getSubject(parent.subjectId)}).map(([name,row])=>({name,id:row?.id,ownerId:row?.ownerId,snapshot:JSON.stringify(row)})):[];
  const existing = allSlots(termId).find(s => s.weekday === slot.weekday && s.period === slot.period);
  if (existing) {
    throw new Error('لديك حصة مسجلة بالفعل في هذا الوقت.');
  }
  
  if (live(state.slots).some((s) => s.id === slot.id)) return null;
  const saved=await save({ slots: [slot] }, {verifyCurrent:verifyCurrent?current=>{
    verifyCurrent(current);
    for(const row of parentScope){
      if(!row.id||row.ownerId&&row.ownerId!==activeWorkspace?.authUserId||JSON.stringify(current[row.name].find(r=>r.id===row.id))!==row.snapshot)throw Error('SETUP_SLOT_PARENT_CHANGED');
    }
    if(current.slots.some(s=>!s.deleted&&s.weekday===slot.weekday&&s.period===slot.period&&
      (s.termId===termId||current.teachings.some(t=>t.id===s.teachingId&&t.termId===termId))))throw Error('SETUP_SLOT_CHANGED');
  }:undefined});
  if(!saved)throw Error('SETUP_SLOT_SAVE');
  return slot;
}

export async function editSlot(slotId, data) {
  const existingSlot = getSlot(slotId);
  if (!existingSlot) throw new Error('الحصة غير موجودة');
  if (isTeachingArchived(existingSlot.teachingId) || isTeachingArchived(data.teachingId)) throw new Error(ARCHIVED_SECTION_WRITE_MESSAGE);

  const updated = validatedSlot({ ...existingSlot, ...data, id: slotId });
  const termId = isNonTeachingSlot(updated) ? updated.termId : getTeaching(updated.teachingId)?.termId;
  const conflict = allSlots(termId).find(s => s.id !== slotId && s.weekday === updated.weekday && s.period === updated.period);
  if (conflict) {
    throw new Error('لديك حصة مسجلة بالفعل في هذا الوقت.');
  }

  await patch('slots', slotId, { 
    weekday: updated.weekday, 
    period: updated.period, 
    teachingId: updated.teachingId,
    kind: updated.kind,
    termId: updated.termId,
    start: updated.start,
    end: updated.end
  });
  return updated;
}

export const removeSlot = (slotId) => softDelete('slots', slotId);

export async function ensureCalendar(yId = activeYear()?.id, source = 'custom') {
  const existing = calendarsOf(yId).find((c) => c.source === source);
  if (existing) return existing;
  const cal = source === 'custom' ? customCalendarCandidate(yId) : makeCalendar({ yearId: yId, source });
  await save({ calendars: [cal] });
  return cal;
}

export async function setCalendarDay(calId, date, kind, label = '') {
  const { calendarDayId, makeCalendarDay } = await import('./models.js');
  const id = calendarDayId(calId, date);
  return patch('calendarDays', id, { kind, label, deleted: false },
    makeCalendarDay({ calendarId: calId, date, kind, label }));
}

export const removeCalendarDay = (id) => softDelete('calendarDays', id);

export function calendarRangesOf(yearId = activeYear()?.id) {
  const groups = new Map();
  for (const calendar of calendarsOf(yearId)) for (const day of calendarDaysOf(calendar.id)) {
    const key = calendar.source?.startsWith('preset:')
      ? officialPresetRangeIdentity(calendar, day) ?? `legacy:${calendar.id}:${day.id}`
      : calendarRangeIdentity(day);
    const group = groups.get(key) ?? { id: key, calendarId: calendar.id, source: calendar.source, kind: day.kind, label: day.label, startDate: day.date, endDate: day.date, days: [] };
    group.startDate = group.startDate < day.date ? group.startDate : day.date;
    group.endDate = group.endDate > day.date ? group.endDate : day.date;
    group.days.push(day); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label));
}

export async function saveCalendarRange({ id = uid(), calendarId, startDate, endDate = startDate, kind, label = '' }) {
  if (!startDate) throw new Error('تاريخ البداية مطلوب.');
  if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.');
  const calendar = state.calendars.find((item) => item.id === calendarId && !item.deleted);
  if (!calendar || calendar.source !== 'custom') throw new Error('لا يمكن تعديل الفترة الرسمية.');
  const existing = live(state.calendarDays).filter((day) => day.calendarId === calendarId && calendarRangeIdentity(day) === id);
  const existingByDate = new Map(existing.map((day) => [day.date, day]));
  const allDays = state.calendarDays.filter((day) => day.calendarId === calendarId);
  const next = [];
  for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) {
    if (allDays.some((day) => day.date === date && !day.deleted && calendarRangeIdentity(day) !== id)) {
      throw new Error('يوجد استثناء محلي آخر في هذا التاريخ. عدّل الفترة الموجودة أولًا.');
    }
    const retained = existingByDate.get(date);
    const baseId = calendarRangeDayId(calendarId, id, date);
    const dayId = retained?.id ?? (allDays.some((day) => day.id === baseId)
      ? calendarRangeDayId(calendarId, id, date, uid()) : baseId);
    if (retained && retained.kind === kind && retained.label === label &&
        retained.rangeId === id && retained.rangeStart === startDate && retained.rangeEnd === endDate) {
      next.push(retained);
    } else {
      next.push({ ...retained, id: dayId, calendarId, date, kind, label,
        rangeId: id, rangeStart: startDate, rangeEnd: endDate, deleted: false, updatedAt: now() });
    }
  }
  const removed = existing.filter((day) => !next.some((item) => item.id === day.id)).map((day) => ({ ...day, deleted: true, updatedAt: now() }));
  const changed = next.filter((day) => existingByDate.get(day.date) !== day);
  if (!await save({ calendarDays: [...changed, ...removed] }, {
    v2Deletes: { calendarDays: removed.map((day) => day.id) },
  })) throw new Error('تعذّر حفظ تعديلات الفترة. حاول مرة أخرى.');
  return id;
}

export async function removeCalendarRange(calendarId, rangeId) {
  const calendar = state.calendars.find((item) => item.id === calendarId && !item.deleted);
  if (!calendar || calendar.source !== 'custom') throw new Error('لا يمكن حذف الفترة الرسمية.');
  const days = live(state.calendarDays).filter((day) => day.calendarId === calendarId && calendarRangeIdentity(day) === rangeId);
  if (!days.length) return;
  if (!await save({ calendarDays: days.map((day) => ({ ...day, deleted: true, updatedAt: now() })) }, {
    v2Deletes: { calendarDays: days.map((day) => day.id) },
  })) throw new Error('تعذّر حذف الفترة. حاول مرة أخرى.');
}

export async function updateTermDates(termId, startDate, endDate) {
  if (!startDate || !endDate) throw new Error('تاريخ البداية والنهاية مطلوبان.');
  if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.');
  const term = getTerm(termId); if (!term) throw new Error('الفصل الدراسي غير موجود.');
  const overlaps = effectiveTermsOf(term.yearId).some((other) => other.id !== term.id && other.startDate && other.endDate && startDate <= other.endDate && other.startDate <= endDate);
  if (overlaps) throw new Error('يتداخل تاريخ هذا الفصل الدراسي مع فصل دراسي آخر. عدّل تاريخ البداية أو النهاية.');
  if (getYear(term.yearId)?.calendarPresetId) {
    const calendar = customCalendarCandidate(term.yearId);
    const next = { ...calendar, termDateOverrides: { ...calendar.termDateOverrides, [term.id]: { startDate, endDate } }, updatedAt: now() };
    const projection = effectiveCalendar(term.yearId, { calendars: [...state.calendars.filter(c => c.id !== next.id), next] });
    if (!projection.ok) throw new Error(`Invalid term dates: ${projection.reason}`);
    if (!await save({ calendars: [next] })) throw new Error('تعذّر حفظ تواريخ الفصل الدراسي.');
    return effectiveTerm(term.id);
  }
  return patch('terms', term.id, { startDate, endDate });
}

/**
 * يولّد تقويم هجين متناوب أسبوعيًا.
 * الأسبوع A: الأحد-الثلاثاء (حضوري)، الأربعاء-الخميس (عن بُعد)
 * الأسبوع B: الأحد-الإثنين (حضوري)، الثلاثاء-الخميس (عن بُعد)
 * الأيام الحضورية لا تُضاف (لتتبع الافتراضي)، والعن بُعد تُضاف كـ remote.
 * لا يمس أيام الإجازات الموجودة.
 */
export async function generateHybridCalendar(calId, startDate, endDate) {
  const { shiftDate, weekday, calendarDayId, makeCalendarDay } = await import('./models.js');
  
  let current = startDate;
  let weekIndex = 0;
  const newDays = [];
  const existingDays = calendarDaysOf(calId);

  while (current <= endDate) {
    const wd = weekday(current);
    
    // إجازة الأسبوع
    if (wd === 5 || wd === 6) {
      if (wd === 6) weekIndex++; // انتهى الأسبوع، نبدّل
      current = shiftDate(current, 1);
      continue;
    }

    // الأسبوع الأول هو B (الثلاثاء-الخميس عن بُعد)، والثاني A (الأربعاء-الخميس عن بُعد).
    const isWeekB = weekIndex % 2 === 0;
    // B: remote on Tue (2), Wed (3), Thu (4)
    // A: remote on Wed (3), Thu (4)
    const isRemote = isWeekB ? (wd >= 2) : (wd >= 3);

    if (isRemote) {
      // لا نستبدل الإجازات أو الأيام المحددة مسبقًا بـ 'remote'
      const existing = existingDays.find(d => d.date === current);
      if (!existing || existing.kind === 'study' || existing.kind === 'remote') {
        newDays.push(makeCalendarDay({ calendarId: calId, date: current, kind: 'remote', label: 'عن بُعد' }));
      }
    }
    
    current = shiftDate(current, 1);
  }

  if (newDays.length) {
    await save({ calendarDays: newDays });
  }
}


/* ---------- عمليات: الرصد السريع ---------- */

export async function addLog({ teachingId: tchId, studentId, kind, delta, tag = '', note = '', date, sessionId: sesId = null }) {
  const rec = {
    id: uid(), updatedAt: now(), deleted: false,
    teachingId: tchId, studentId, kind, delta, tag, note,
    sessionId: sesId,
    date: date ?? todayISO(),
  };
  await save({ logs: [rec] });
  return rec;
}

export async function undoLastLog(studentId, kind, date = todayISO()) {
  const today = logsOf(studentId)
    .filter((l) => l.date === date && l.kind === kind)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const last = today.at(-1);
  if (!last) return false;
  await patch('logs', last.id, { deleted: true });
  return true;
}

// Explicit UI entry; the engine revalidates owner, evidence and parents transactionally.
export async function reviewRejectedSessionRepairs() {
  return createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => cloud.user?.id ?? null }).reviewSessionRepairs();
}
export const reviewCalendarFoundationRepair = reviewFoundationRepair;
export async function confirmCalendarFoundationRepair(plan, acknowledged) {
  const result = await confirmFoundationRepair(plan, acknowledged);
  await refreshSyncedState(); notify(); return result;
}
export async function resumeCalendarFoundationRepair() {
  const result = await resumeFoundationRepair();
  await refreshSyncedState(); notify(); return result;
}
export async function confirmRejectedSessionRepairs(plan, selectedIds, confirmed = false) {
  const ids = await createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => cloud.user?.id ?? null }).confirmSessionRepairs(plan, selectedIds, confirmed);
  notify();
  return ids;
}
