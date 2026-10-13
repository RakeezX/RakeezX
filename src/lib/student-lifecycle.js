/** Online, server-confirmed student lifecycle. Device receipt is never exported. */
import * as db from './db.js';
import * as cloud from './cloud.js';
import * as sync from './sync.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import * as store from '../store.js';
import { decodeSyncV2Canonical, summarizeSyncV2OperationalState } from './sync-v2.js';
import { uid } from '../models.js';

const fail = (code) => Object.assign(new Error(code), { code });
const clone = (value) => structuredClone(value);
const accepted = new Set(['applied', 'already_applied', 'already_deleted']);

export function localPristineBlocker(data, studentId) {
  const student = data.students?.find((row) => row.id === studentId);
  if (!student || student.deleted) return 'STUDENT_TOMBSTONED';
  if (student.status !== 'active') return 'membership-history';
  if (String(student.note ?? '').trim()) return 'inline-note';
  for (const name of ['attendance', 'scores', 'logs', 'notes', 'submissions']) {
    if (data[name]?.some((row) => row.studentId === studentId)) return name;
  }
  const references = (value) => value === studentId || (value && typeof value === 'object' &&
    Object.values(value).some(references));
  for (const name of ['sessionRosterSnapshots', 'closedTermReports', 'groupArrangements']) {
    if (data[name]?.some(references)) return name;
  }
  const memberships = data.enrollments?.filter((row) => row.studentId === studentId) ?? [];
  if (memberships.length > 1 || memberships.some((row) => row.deleted || row.status !== 'active' ||
      row.endDate || String(row.transferNote ?? '').trim() ||
      data.sections?.some((section) => section.id === row.sectionId && (section.deleted || section.status === 'archived')))) {
    return 'membership-history';
  }
  return null;
}

const previewReasons = Object.freeze({
  delete_pristine: ['pristine'], end_enrollment: ['history_exists'],
  blocked: ['invalid_source', 'student_unavailable', 'student_deleted', 'stale_source', 'archived_enrollment'],
});
const blockedPreview = (reason, retryable = true) => ({ outcome: 'blocked', reason, retryable });
const previewStores = ['device', 'outbox', 'students', 'enrollments', 'sections', 'attendance', 'scores',
  'logs', 'notes', 'submissions', 'sessionRosterSnapshots', 'closedTermReports', 'groupArrangements'];
// V2 superseded rows are retained history, not queued work. Keep unknown/legacy
// rows fail-closed; the Sync V2 summary is authoritative for active V2 work.
const lifecycleOutboxReady = (rows) => rows.every((row) => row?.protocol === 'v2') &&
  summarizeSyncV2OperationalState({ outbox: rows }).queuedCount === 0;

// One disk snapshot, no readwrite transaction, checkpoint, outbox or Sync push.
async function removalEvidenceSnapshot() {
  const handle = await db.openDB();
  return new Promise((resolve, reject) => {
    const tx = handle.transaction(previewStores, 'readonly'), data = {};
    for (const name of previewStores) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { data[name] = request.result; };
    }
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Informational only. Execution still rechecks 0029 authority and local evidence. */
export async function previewStudentRemoval(studentId, enrollmentId, revision) {
  if (typeof studentId !== 'string' || !studentId || studentId.length > 200 ||
    typeof enrollmentId !== 'string' || !enrollmentId || enrollmentId.length > 200) return blockedPreview('invalid_source', false);
  if (studentId.startsWith('demo:') || enrollmentId.startsWith('demo:')) return blockedPreview('demo_local_only', false);
  if (!cloud.session || !cloud.user) return blockedPreview('auth_required');
  if (globalThis.navigator?.onLine === false) return blockedPreview('offline');
  const ownerId = cloud.user.id;
  try {
    const before = await removalEvidenceSnapshot();
    const student = before.students.find(row => row.id === studentId);
    const source = before.enrollments.find(row => row.id === enrollmentId && row.studentId === studentId);
    if (store.isLocalOnlyRecord(student) || store.isLocalOnlyRecord(source)) return blockedPreview('demo_local_only', false);
    // Classification only: lack of authority never permits local deletion.
    if (student && source && !student.deleted && !source.deleted &&
        (!(student.serverRevision >= 1) || !(source.serverRevision >= 1) || student.syncCreatePending || source.syncCreatePending)) {
      return blockedPreview('student_not_synced');
    }
    if (!Number.isSafeInteger(revision) || revision < 0) return blockedPreview('invalid_source', false);
    const beforeDevice = before.device.find((row) => row.id === 'device');
    if (!lifecycleOutboxReady(before.outbox) || beforeDevice?.studentLifecycleResume || beforeDevice?.cloudRestoreResume) {
      return blockedPreview('sync_not_ready');
    }
    const available = async () => {
      if (!cloud.session || cloud.user?.id !== ownerId) return false;
      if (!runtimeSyncOwnershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: ownerId }).allowed) return false;
      const summary = await sync.getSyncOperationalSummary(); // READ-ONLY; never assertCloudRestoreReady().
      return summary.cloudSyncHealthy && summary.queuedCount === 0 &&
        !summary.automaticSyncActive && summary.safeToContinueUnrelatedWork;
    };
    if (!await available()) return blockedPreview('sync_not_ready');
    const result = await cloud.previewStudentRemoval(studentId, enrollmentId, revision);
    if (!cloud.session || cloud.user?.id !== ownerId) return blockedPreview('auth_required');
    if (!previewReasons[result?.outcome]?.includes(result?.reason) || typeof result.retryable !== 'boolean') {
      return blockedPreview('preview_unavailable');
    }
    // Re-read after the server response: a local-only submission may arrive while waiting.
    const current = await removalEvidenceSnapshot();
    const device = current.device.find((row) => row.id === 'device');
    if (!lifecycleOutboxReady(current.outbox) || device?.studentLifecycleResume || device?.cloudRestoreResume || !await available()) {
      return blockedPreview('sync_not_ready');
    }
    if (!cloud.session || cloud.user?.id !== ownerId) return blockedPreview('auth_required');
    if (result.outcome === 'delete_pristine') {
      const reason = localPristineBlocker(current, studentId);
      if (reason === 'STUDENT_TOMBSTONED') return blockedPreview('student_unavailable');
      if (reason) return { outcome: 'end_enrollment', reason: 'local_protected_evidence', retryable: false };
    }
    return { outcome: result.outcome, reason: result.reason, retryable: result.retryable };
  } catch (error) {
    return blockedPreview(cloud.isAuthRequiredError(error) ? 'auth_required'
      : globalThis.navigator?.onLine === false ? 'offline' : 'preview_unavailable');
  }
}

export async function getStudentLifecycleResumeState() {
  const pending = (await db.get('device', 'device'))?.studentLifecycleResume;
  if (!pending) return null;
  if (pending.ownerId !== cloud.user?.id) throw fail('LIFECYCLE_OWNER_MISMATCH');
  return { mutationId: pending.envelope.mutationId, command: pending.envelope.command,
    studentId: pending.envelope.payload.studentId, state: pending.result ? 'reconciliation_required' : 'confirmation_required' };
}

async function reconcile(checkpoint) {
  const result = checkpoint.result;
  if (result?.mutationId !== checkpoint.envelope.mutationId || result.command !== checkpoint.envelope.command ||
      !['applied', 'already_applied', 'already_deleted', 'protected', 'rejected'].includes(result.outcome) ||
      !Array.isArray(result.enrollments)) throw fail('INVALID_LIFECYCLE_RECEIPT');
  const receiptStudent = decodeSyncV2Canonical('students', result.student);
  if (accepted.has(result.outcome) && receiptStudent?.id !== checkpoint.envelope.payload.studentId) {
    throw fail('INVALID_LIFECYCLE_RECEIPT');
  }
  // A durable receipt proves the mutation completed, not that its old rows are
  // still current. Another device may have transferred/reinstated afterward.
  // Resume only reads current authority; it never reapplies the mutation.
  const [students, enrollments] = await Promise.all([cloud.fetchRecords('students'), cloud.fetchRecords('enrollments')]);
  const studentId = checkpoint.envelope.payload.studentId;
  const canonicalStudent = decodeSyncV2Canonical('students', students.find((row) => row.id === studentId));
  if (accepted.has(result.outcome) && !canonicalStudent) throw fail('INVALID_LIFECYCLE_RECEIPT');
  const sections = new Set(result.enrollments.map((row) => row.section_id));
  const currentEnrollments = enrollments.filter((row) => row.student_id === studentId || sections.has(row.section_id));
  await db.applyBatch({ students: {}, enrollments: {}, device: {}, outbox: {} }, {
    allowStudentLifecycle: true,
    prepare(current) {
      const device = current.device.find((row) => row.id === 'device');
      if (device?.studentLifecycleResume?.envelope.mutationId !== checkpoint.envelope.mutationId) throw fail('LIFECYCLE_CHECKPOINT_CHANGED');
      if (!lifecycleOutboxReady(current.outbox)) throw fail('LIFECYCLE_OUTBOX_NOT_EMPTY');
      const adopt = (name, canonical) => {
        const existing = current[name].find((row) => row.id === canonical.id);
        if ((existing?.serverRevision ?? 0) > canonical.serverRevision) return existing;
        // Never erase recorded conflict evidence when adopting authority.
        const next = { ...existing, ...canonical, serverCanonical: clone(canonical) };
        delete next.syncCreatePending;
        return next;
      };
      const nextDevice = { ...device };
      delete nextDevice.studentLifecycleResume;
      return {
        students: { put: canonicalStudent ? [adopt('students', canonicalStudent)] : [] },
        enrollments: { put: currentEnrollments.map((row) => decodeSyncV2Canonical('enrollments', row))
          .map((row) => { if (!row?.id) throw fail('INVALID_LIFECYCLE_RECEIPT'); return adopt('enrollments', row); }) },
        device: { put: [nextDevice] }, outbox: {},
      };
    },
  });
  store.state.device = await db.get('device', 'device');
  await store.refreshSyncedState();
  return { ...result, ok: accepted.has(result.outcome), student: canonicalStudent,
    enrollment: store.activeEnrollment(studentId) };
}

async function confirmAndReconcile(checkpoint) {
  if (!cloud.session || checkpoint.ownerId !== cloud.user?.id) throw fail('AUTH_REQUIRED');
  if (globalThis.navigator?.onLine === false) throw fail('OFFLINE');
  return sync.runStudentLifecycleExclusive(async () => {
    if (!checkpoint.result) {
      let result;
      try { result = await cloud.applyStudentLifecycleCommand(checkpoint.envelope); }
      catch (error) {
        // PostgreSQL exceptions roll back the RPC; missing-RPC responses never
        // executed it. Only these definitive failures may release the device.
        // Network/ambiguous failures retain the exact envelope for resume.
        if (['22023', '23503', '42501', 'PGRST202'].includes(error.code)) {
          await db.applyBatch({ device: {} }, { allowStudentLifecycle: true, prepare(current) {
            const device = current.device.find((row) => row.id === 'device');
            if (device?.studentLifecycleResume?.envelope.mutationId !== checkpoint.envelope.mutationId) throw fail('LIFECYCLE_CHECKPOINT_CHANGED');
            const next = { ...device }; delete next.studentLifecycleResume;
            return { device: { put: [next] } };
          } });
          store.state.device = await db.get('device', 'device');
        }
        throw error;
      }
      await db.applyBatch({ device: {} }, { allowStudentLifecycle: true, prepare(current) {
        const device = current.device.find((row) => row.id === 'device');
        if (device?.studentLifecycleResume?.envelope.mutationId !== checkpoint.envelope.mutationId) throw fail('LIFECYCLE_CHECKPOINT_CHANGED');
        checkpoint = { ...checkpoint, result: clone(result) };
        return { device: { put: [{ ...device, studentLifecycleResume: checkpoint }] } };
      } });
    }
    return reconcile(checkpoint);
  }, { ownerId: checkpoint.ownerId, mutationId: checkpoint.envelope.mutationId });
}

export async function resumeStudentLifecycle() {
  const checkpoint = (await db.get('device', 'device'))?.studentLifecycleResume;
  if (!checkpoint) throw fail('NO_LIFECYCLE_TO_RESUME');
  return confirmAndReconcile(checkpoint);
}

export async function executeStudentLifecycle(command, payload) {
  if (!['delete_pristine', 'end_enrollment'].includes(command)) throw fail('UNSUPPORTED_LIFECYCLE_COMMAND');
  if (await getStudentLifecycleResumeState()) throw fail('LIFECYCLE_RESUME_REQUIRED');
  if ((await db.get('device', 'device'))?.cloudRestoreResume) throw fail('RESTORE_RESUME_REQUIRED');
  await sync.assertCloudRestoreReady(); // Auth, online, no running reconciliation, completely healthy V2.
  let checkpoint;
  const scope = Object.fromEntries(['device', 'outbox', 'students', 'enrollments', 'sections', 'attendance',
    'scores', 'logs', 'notes', 'submissions', 'sessionRosterSnapshots', 'closedTermReports', 'groupArrangements'].map((name) => [name, {}]));
  await db.applyBatch(scope, { prepare(current) {
    const device = current.device.find((row) => row.id === 'device') ?? { id: 'device' };
    if (device.studentLifecycleResume || device.cloudRestoreResume) throw fail('RECONCILIATION_REQUIRED');
    if (!lifecycleOutboxReady(current.outbox)) throw fail('LIFECYCLE_OUTBOX_NOT_EMPTY');
    if (command === 'delete_pristine') {
      const reason = localPristineBlocker(current, payload.studentId);
      if (reason) throw Object.assign(fail('NOT_PRISTINE'), { reason });
    }
    checkpoint = { version: 1, ownerId: cloud.user.id,
      envelope: { mutationId: `student-lifecycle:${uid()}`, deviceId: device.deviceId ?? device.id,
        command, payload: clone(payload), clientUpdatedAt: Date.now() } };
    return { device: { put: [{ ...device, studentLifecycleResume: checkpoint }] } };
  } });
  store.state.device = await db.get('device', 'device');
  return confirmAndReconcile(checkpoint);
}
