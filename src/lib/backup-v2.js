/** Conservative, UI-neutral Sync V2 backup/restore foundation. */

import * as db from './db.js';
import * as cloud from './cloud.js';
import * as sync from './sync.js';
import * as store from '../store.js';
import { DEVICE_ONLY_STORES, validateBackupIntegrity } from './export.js';
import {
  SYNC_V2_SCHEMAS, SYNC_V2_STORES, decodeSyncV2Canonical, encodeSyncV2Patch,
} from './sync-v2.js';

export const RESTORE_CLASSIFICATIONS = Object.freeze([
  'SAFE_APPLY', 'KEEP_SERVER', 'CONFLICT', 'TOMBSTONED_SERVER', 'INVALID',
]);

const IMMUTABLE_STORES = new Set(['logs', 'sessionRosterSnapshots', 'closedTermReports']);
const RESTORE_STORE_ORDER = Object.freeze([
  'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings', 'students',
  'enrollments', 'timeProfiles', 'profile', 'items', 'slots', 'sessions', 'notes', 'classRules',
  'classCharterSelections', 'classGoals', 'groupArrangements',
  'scores', 'logs', 'sessionRosterSnapshots', 'attendance', 'closedTermReports',
]);
const LOCAL_ONLY_STORES = Object.freeze(db.STORES.filter((name) =>
  !SYNC_V2_STORES.includes(name) && !DEVICE_ONLY_STORES.includes(name)));
const RESTORE_RESUME_VERSION = 1;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);
const clone = (value) => value == null ? value : structuredClone(value);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function comparable(storeName, record) {
  if (!record) return null;
  const fields = Object.keys(SYNC_V2_SCHEMAS[storeName].fields);
  return Object.fromEntries(['deleted', ...fields].map((field) => [field,
    field === 'deleted' ? record.deleted === true : clone(record[field]) ]));
}

function baselineMap(payload, storeName) {
  return new Map((payload.baselines?.[storeName] ?? []).map((row) => [row.id, row]));
}

function recordMap(records) {
  return new Map((records ?? []).map((row) => [row.id, row]));
}

function planRecord({ storeName, backupRecord, baseline, serverRecord }) {
  const identity = { store: storeName, entity: SYNC_V2_SCHEMAS[storeName].entity, id: backupRecord.id };
  if ((storeName === 'items' && (backupRecord.unitId || backupRecord.lessonId)) ||
      (storeName === 'sessions' && backupRecord.lessonId)) {
    return { ...identity, classification: 'INVALID', reason: 'local-only-curriculum-reference' };
  }
  if (serverRecord?.deleted && !backupRecord.deleted) {
    return { ...identity, classification: 'TOMBSTONED_SERVER', reason: 'server-tombstone' };
  }
  if (!baseline?.value) {
    if (Number(backupRecord.serverRevision ?? 0) > 0) {
      return { ...identity, classification: 'INVALID', reason: 'missing-baseline-evidence' };
    }
    if (backupRecord.deleted) return { ...identity, classification: 'KEEP_SERVER', reason: 'local-only-tombstone' };
    if (serverRecord) return { ...identity, classification: 'CONFLICT', reason: 'identity-already-exists' };
    return {
      ...identity, classification: 'SAFE_APPLY', operation: 'create', baseRevision: 0,
      patch: encodeSyncV2Patch(storeName, backupRecord), clientUpdatedAt: backupRecord.updatedAt ?? null,
    };
  }
  if (!serverRecord) return { ...identity, classification: 'INVALID', reason: 'baseline-row-missing-on-server' };

  const before = comparable(storeName, baseline.value);
  const local = comparable(storeName, backupRecord);
  const remote = comparable(storeName, serverRecord);
  const fields = Object.keys(local);
  const localChanged = fields.filter((field) => !equal(local[field], before[field]));
  const serverChanged = fields.filter((field) => !equal(remote[field], before[field]));
  if (!localChanged.length) return { ...identity, classification: 'KEEP_SERVER', reason: 'backup-unchanged' };
  if (storeName === 'terms' && (serverRecord.status === 'closed' || localChanged.includes('status'))) {
    return { ...identity, classification: 'INVALID', reason: 'closed-term-lifecycle-requires-specialized-review' };
  }
  const collisions = localChanged.filter((field) => serverChanged.includes(field) && !equal(local[field], remote[field]));
  if (local.deleted && serverChanged.length) {
    return { ...identity, classification: 'CONFLICT', reason: 'delete-versus-newer-server-change', fields: serverChanged.sort() };
  }
  if (collisions.length) {
    return { ...identity, classification: 'CONFLICT', reason: 'same-field-change', fields: collisions.sort() };
  }
  if (local.deleted) {
    return {
      ...identity, classification: 'SAFE_APPLY', operation: 'delete',
      baseRevision: Number(serverRecord.serverRevision ?? 0), patch: {},
      clientUpdatedAt: backupRecord.updatedAt ?? null,
    };
  }
  if (IMMUTABLE_STORES.has(storeName)) {
    return { ...identity, classification: 'INVALID', reason: 'immutable-record-changed-in-backup' };
  }
  const patchFields = Object.fromEntries(localChanged.filter((field) => field !== 'deleted')
    .map((field) => [field, backupRecord[field]]));
  if (!Object.keys(patchFields).length) return { ...identity, classification: 'KEEP_SERVER', reason: 'no-live-field-change' };
  return {
    ...identity, classification: 'SAFE_APPLY', operation: 'patch',
    baseRevision: Number(serverRecord.serverRevision ?? 0),
    patch: encodeSyncV2Patch(storeName, patchFields), clientUpdatedAt: backupRecord.updatedAt ?? null,
  };
}

export function canonicalRestoreManifest(serverData) {
  return SYNC_V2_STORES.flatMap((storeName) => [...(serverData[storeName] ?? [])]
    .sort((left, right) => left.id.localeCompare(right.id)).map((row) => ({
    entity: SYNC_V2_SCHEMAS[storeName].entity,
    id: row.id,
    revision: Number(row.serverRevision ?? 0),
    deleted: row.deleted === true,
  })));
}

/** Pure, deterministic three-way planner. It never reads or writes storage. */
export function planCloudRestore(payload, serverData, { ownerId = null } = {}) {
  const entries = [];
  const legacy = payload.version === 3;
  const ownerHasRows = SYNC_V2_STORES.some((name) => (serverData[name] ?? []).length > 0);
  if (legacy && ownerHasRows) {
    entries.push({ store: '*', entity: '*', id: '*', classification: 'INVALID', reason: 'legacy-backup-requires-empty-owner' });
  } else if (!legacy && payload.sourceOwnerId && ownerId && payload.sourceOwnerId !== ownerId) {
    entries.push({ store: '*', entity: '*', id: '*', classification: 'INVALID', reason: 'backup-owner-mismatch' });
  } else if (!legacy && !payload.sourceOwnerId && ownerHasRows) {
    entries.push({ store: '*', entity: '*', id: '*', classification: 'INVALID', reason: 'unknown-backup-owner-requires-empty-owner' });
  } else {
    for (const storeName of SYNC_V2_STORES) {
      const backupRows = recordMap(payload.data?.[storeName]);
      const serverRows = recordMap(serverData[storeName]);
      const baselines = baselineMap(payload, storeName);
      const ids = [...new Set([...backupRows.keys(), ...serverRows.keys()])].sort();
      for (const id of ids) {
        const backupRecord = backupRows.get(id);
        const serverRecord = serverRows.get(id);
        if (!backupRecord) {
          entries.push({ store: storeName, entity: SYNC_V2_SCHEMAS[storeName].entity, id,
            classification: 'KEEP_SERVER', reason: 'server-only' });
          continue;
        }
        entries.push(planRecord({ storeName, backupRecord, baseline: baselines.get(id), serverRecord }));
      }
    }
  }
  entries.sort((left, right) => `${left.entity}\u0000${left.id}\u0000${left.classification}`
    .localeCompare(`${right.entity}\u0000${right.id}\u0000${right.classification}`));
  const counts = Object.fromEntries(RESTORE_CLASSIFICATIONS.map((name) =>
    [name, entries.filter((entry) => entry.classification === name).length]));
  return {
    backupHash: payload.backupHash ?? null,
    backupVersion: payload.version,
    sourceManifest: canonicalRestoreManifest(serverData),
    entries,
    operations: entries.filter((entry) => entry.classification === 'SAFE_APPLY')
      .sort((left, right) => {
        const leftRank = RESTORE_STORE_ORDER.indexOf(left.store);
        const rightRank = RESTORE_STORE_ORDER.indexOf(right.store);
        const leftDelete = left.operation === 'delete';
        const rightDelete = right.operation === 'delete';
        if (leftDelete !== rightDelete) return leftDelete ? 1 : -1;
        return (leftDelete ? rightRank - leftRank : leftRank - rightRank) || left.id.localeCompare(right.id);
      })
      .map((entry) => ({
      entity: entry.entity, recordId: entry.id, operation: entry.operation,
      baseRevision: entry.baseRevision, patch: entry.patch, clientUpdatedAt: entry.clientUpdatedAt,
    })),
    counts,
    ready: !entries.some((entry) => ['CONFLICT', 'TOMBSTONED_SERVER', 'INVALID'].includes(entry.classification)),
  };
}

export async function fetchCanonicalRestoreSource() {
  const canonical = await fetchCanonicalRestoreSnapshot();
  const pairs = SYNC_V2_STORES.map((storeName) => {
    const rows = canonical[SYNC_V2_SCHEMAS[storeName].entity];
    return [storeName, rows.map((row) => decodeSyncV2Canonical(storeName, row)).filter(Boolean)];
  });
  return Object.fromEntries(pairs);
}

/** Fetch the complete current owner snapshot in the shape local reconciliation consumes. */
export async function fetchCanonicalRestoreSnapshot() {
  const pairs = await Promise.all(SYNC_V2_STORES.map(async (storeName) => {
    const entity = SYNC_V2_SCHEMAS[storeName].entity;
    return [entity, await cloud.fetchRecords(entity)];
  }));
  return Object.fromEntries(pairs);
}

export async function previewCloudRestore(payload) {
  const validation = await validateBackupIntegrity(payload);
  if (!validation.ok) return { validation, plan: null };
  if (!cloud.user || !cloud.session) throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' });
  const serverData = await fetchCanonicalRestoreSource();
  return { validation, plan: planCloudRestore(payload, serverData, { ownerId: cloud.user.id }), serverData };
}

export async function reconcileCanonicalRestore(payload, canonicalRows, { restoreId = null } = {}) {
  if (!canonicalRows || typeof canonicalRows !== 'object' || SYNC_V2_STORES.some((storeName) =>
    !Array.isArray(canonicalRows[SYNC_V2_SCHEMAS[storeName].entity]))) {
    throw new Error('Restore server returned an incomplete canonical snapshot');
  }
  const decoded = Object.fromEntries(SYNC_V2_STORES.map((storeName) => {
    const rows = canonicalRows[SYNC_V2_SCHEMAS[storeName].entity]
      .map((row) => decodeSyncV2Canonical(storeName, row));
    if (rows.some((row) => !row?.id) || new Set(rows.map((row) => row.id)).size !== rows.length) {
      throw new Error(`Restore server returned invalid canonical rows for ${storeName}`);
    }
    return [storeName, rows];
  }));
  const scope = Object.fromEntries([...SYNC_V2_STORES, ...LOCAL_ONLY_STORES, 'device', 'outbox'].map((name) => [name, {}]));
  await db.applyBatch(scope, {
    prepare(current) {
      return Object.fromEntries(Object.keys(scope).map((name) => {
        if (name === 'outbox') return [name, { remove: current.outbox.map((row) => row.id), put: [] }];
        if (name === 'device') {
          const device = current.device.find((row) => row.id === 'device');
          if (!device || !current.outbox.length) return [name, { remove: [], put: [] }];
          const previous = Array.isArray(device.restoreQuarantinedOutbox) ? device.restoreQuarantinedOutbox : [];
          return [name, { remove: [], put: [{ ...device, restoreQuarantinedOutbox: [
            ...previous,
            { restoreId, capturedAt: Date.now(), entries: clone(current.outbox) },
          ] }] }];
        }
        const next = SYNC_V2_STORES.includes(name) ? decoded[name] : (payload.data?.[name] ?? current[name]);
        return [name, { remove: current[name].map((row) => row.id), put: next }];
      }));
    },
  });
  await store.refreshSyncedState();
}

function resumeLocalData(payload) {
  return Object.fromEntries(LOCAL_ONLY_STORES
    .filter((name) => Array.isArray(payload.data?.[name]))
    .map((name) => [name, clone(payload.data[name])]));
}

async function updateResumeCheckpoint(update) {
  let saved = null;
  await db.applyBatch({ device: {} }, {
    prepare(current) {
      const device = current.device.find((row) => row.id === 'device') ?? { id: 'device' };
      const next = update(clone(device.cloudRestoreResume ?? null));
      const replacement = { ...device };
      if (next) replacement.cloudRestoreResume = clone(next);
      else delete replacement.cloudRestoreResume;
      saved = clone(next);
      return { device: { remove: [], put: [replacement] } };
    },
  });
  return saved;
}

function validateResumeCheckpoint(checkpoint) {
  const valid = checkpoint?.version === RESTORE_RESUME_VERSION &&
    typeof checkpoint.restoreId === 'string' && checkpoint.restoreId &&
    typeof checkpoint.backupHash === 'string' && checkpoint.backupHash &&
    typeof checkpoint.stageHash === 'string' && checkpoint.stageHash &&
    ['staged', 'finalized'].includes(checkpoint.state) &&
    checkpoint.localData && typeof checkpoint.localData === 'object' && !Array.isArray(checkpoint.localData);
  if (!valid) throw Object.assign(new Error('Stored cloud restore resume state is invalid'), {
    code: 'INVALID_RESTORE_RESUME_STATE',
  });
  return checkpoint;
}

async function resumeCheckpoint() {
  const device = await db.get('device', 'device');
  return device?.cloudRestoreResume ? validateResumeCheckpoint(clone(device.cloudRestoreResume)) : null;
}

/** Metadata-only state for a future UI. Local payload content remains internal. */
export async function getCloudRestoreResumeState() {
  const checkpoint = await resumeCheckpoint();
  if (!checkpoint) return null;
  return {
    restoreId: checkpoint.restoreId,
    backupHash: checkpoint.backupHash,
    backupVersion: checkpoint.backupVersion,
    stageHash: checkpoint.stageHash,
    state: checkpoint.state,
    receipt: clone(checkpoint.receipt ?? null),
    stagedAt: checkpoint.stagedAt ?? null,
    finalizedAt: checkpoint.finalizedAt ?? null,
  };
}

async function markFinalized(checkpoint, receipt) {
  return updateResumeCheckpoint((current) => {
    if (!current || current.restoreId !== checkpoint.restoreId || current.stageHash !== checkpoint.stageHash) {
      throw Object.assign(new Error('Cloud restore resume identity changed'), { code: 'RESTORE_RESUME_IDENTITY_MISMATCH' });
    }
    return { ...current, state: 'finalized', receipt: clone(receipt), finalizedAt: Date.now() };
  });
}

async function clearResumeCheckpoint(checkpoint) {
  await updateResumeCheckpoint((current) => {
    if (!current) return null;
    if (current.restoreId !== checkpoint.restoreId || current.stageHash !== checkpoint.stageHash) {
      throw Object.assign(new Error('Cloud restore resume identity changed'), { code: 'RESTORE_RESUME_IDENTITY_MISMATCH' });
    }
    return null;
  });
}

function reconciliationRequired(error, checkpoint) {
  return Object.assign(new Error('Cloud restore finalized; local reconciliation must be resumed'), {
    code: 'LOCAL_RECONCILIATION_REQUIRED',
    cause: error,
    restore: {
      restoreId: checkpoint.restoreId,
      backupHash: checkpoint.backupHash,
      stageHash: checkpoint.stageHash,
    },
  });
}

/**
 * Explicitly resume the exact staged/finalized restore. Finalize is receipt-idempotent;
 * the fresh canonical fetch avoids replacing local state with an older receipt snapshot.
 */
export async function resumeCloudRestore({
  transport = cloud,
  coordinator = sync,
  canonicalFetcher = fetchCanonicalRestoreSnapshot,
  reconciler = reconcileCanonicalRestore,
} = {}) {
  const checkpoint = await resumeCheckpoint();
  if (!checkpoint) throw Object.assign(new Error('No cloud restore is waiting to resume'), { code: 'NO_RESTORE_TO_RESUME' });
  await coordinator.assertCloudRestoreReady();
  return coordinator.runCloudRestoreExclusive(async () => {
    const result = await transport.finalizeSyncV2Restore({
      restoreId: checkpoint.restoreId,
      backupHash: checkpoint.backupHash,
      expectedStageHash: checkpoint.stageHash,
    });
    let finalized = checkpoint;
    try {
      finalized = await markFinalized(checkpoint, result.receipt);
      const canonical = await canonicalFetcher();
      await reconciler({ data: finalized.localData }, canonical, { restoreId: finalized.restoreId });
      await clearResumeCheckpoint(finalized);
    } catch (error) {
      throw reconciliationRequired(error, finalized);
    }
    return { restoreId: finalized.restoreId, resumed: true, receipt: result.receipt };
  });
}

/** Final cloud-aware restore. No UI calls this foundation yet. */
export async function restoreBackupToCloud(payload, {
  restoreId = globalThis.crypto.randomUUID(),
  transport = cloud,
  coordinator = sync,
  sourceFetcher = fetchCanonicalRestoreSource,
  reconciler = reconcileCanonicalRestore,
} = {}) {
  const validation = await validateBackupIntegrity(payload);
  if (!validation.ok) throw Object.assign(new Error(validation.errors.join('\n')), { code: validation.code ?? 'INVALID_BACKUP' });
  if (await resumeCheckpoint()) {
    throw Object.assign(new Error('A prior cloud restore must be resumed before starting another'), {
      code: 'CLOUD_RESTORE_RESUME_REQUIRED',
      restore: await getCloudRestoreResumeState(),
    });
  }
  await coordinator.assertCloudRestoreReady();
  return coordinator.runCloudRestoreExclusive(async () => {
    const serverData = await sourceFetcher();
    const plan = planCloudRestore(payload, serverData, { ownerId: cloud.user.id });
    if (!plan.ready) throw Object.assign(new Error('Restore requires review'), { code: 'RESTORE_REVIEW_REQUIRED', plan });
    const stage = await transport.stageSyncV2Restore({
      restoreId, backupHash: payload.backupHash ?? `legacy-v3:${restoreId}`,
      backupVersion: payload.version, sourceManifest: plan.sourceManifest, operations: plan.operations,
    });
    let checkpoint = await updateResumeCheckpoint(() => ({
      version: RESTORE_RESUME_VERSION,
      restoreId,
      backupHash: stage.backupHash,
      backupVersion: payload.version,
      stageHash: stage.stageHash,
      state: 'staged',
      localData: resumeLocalData(payload),
      stagedAt: Date.now(),
    }));
    const result = await transport.finalizeSyncV2Restore({
      restoreId, backupHash: stage.backupHash, expectedStageHash: stage.stageHash,
    });
    try {
      checkpoint = await markFinalized(checkpoint, result.receipt);
      await reconciler(payload, result.canonical, { restoreId });
      await clearResumeCheckpoint(checkpoint);
    } catch (error) {
      throw reconciliationRequired(error, checkpoint);
    }
    return { restoreId, plan, receipt: result.receipt };
  });
}
