import * as cloudDefault from './cloud.js';
import * as dbDefault from './db.js';
import { decodeSyncV2Canonical, SYNC_V2_SCHEMAS } from './sync-v2.js';
import {
  accountWorkspaceDatabaseName, createWorkspaceRegistry, detectWorkspaceDatabase,
  normalizeAuthUserId, resolveWorkspace,
} from './workspaces.js';
import { makeDevice, uid } from '../models.js';

export const CORE_RESTORE_PROTOCOL = 'CORE_V1';
export const CORE_RESTORE_PAGE_SIZE = 500;
export const CORE_RESTORE_MAX_ATTEMPTS = 3;
export const CORE_V1_STORES = Object.freeze([
  'profile', 'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'notes', 'classRules', 'classGoals', 'classCharterSelections',
  'groupArrangements', 'items', 'scores', 'logs', 'timeProfiles', 'slots', 'sessions',
  'sessionRosterSnapshots', 'attendance', 'closedTermReports',
]);
export const CORE_V1_ENTITIES = Object.freeze(CORE_V1_STORES.map((store) => SYNC_V2_SCHEMAS[store].entity));

const FULL_RESTORE_ENTITIES = new Set([...CORE_V1_ENTITIES, 'units', 'lessons']);
const STORE_BY_ENTITY = Object.freeze(Object.fromEntries(CORE_V1_STORES.map((store) => [SYNC_V2_SCHEMAS[store].entity, store])));
const clone = (value) => value == null ? value : structuredClone(value);
const stableManifest = (rows) => [...rows].sort((a, b) =>
  `${a.entity}\0${a.id}`.localeCompare(`${b.entity}\0${b.id}`));

function fail(code, message, cause = null) {
  return Object.assign(new Error(message), { code, ...(cause ? { cause } : {}) });
}

function assertNotAborted(signal) {
  if (signal?.aborted) throw fail('RESTORE_ABORTED', 'Initial Restore was cancelled');
}

export function filterCoreRestoreManifest(input) {
  if (!Array.isArray(input)) throw fail('RESTORE_MANIFEST_INVALID', 'Restore manifest must be an array');
  const seen = new Set();
  const core = [];
  for (const row of input) {
    if (!row || typeof row !== 'object' || !FULL_RESTORE_ENTITIES.has(row.entity)) {
      throw fail('RESTORE_MANIFEST_INVALID', 'Restore manifest contains an unexpected entity');
    }
    if (!CORE_V1_ENTITIES.includes(row.entity)) continue;
    const id = row.entity === 'profile' ? 'profile' : row.id;
    const revision = Number(row.revision);
    if (typeof id !== 'string' || !id || !Number.isSafeInteger(revision) || revision < 1 ||
        typeof row.deleted !== 'boolean') {
      throw fail('RESTORE_MANIFEST_INVALID', 'Restore manifest contains malformed evidence');
    }
    const key = `${row.entity}\0${id}`;
    if (seen.has(key)) throw fail('RESTORE_MANIFEST_DUPLICATE', 'Restore manifest contains duplicate identity');
    seen.add(key);
    core.push({ entity: row.entity, id, revision, deleted: row.deleted });
  }
  return stableManifest(core);
}

export function manifestForCanonicalSnapshot(snapshot) {
  return stableManifest(CORE_V1_STORES.flatMap((store) => (snapshot[store] ?? []).map((record) => ({
    entity: SYNC_V2_SCHEMAS[store].entity, id: record.id,
    revision: Number(record.serverRevision), deleted: record.deleted === true,
  }))));
}

export function manifestsEqual(left, right) {
  return JSON.stringify(stableManifest(left)) === JSON.stringify(stableManifest(right));
}

async function sha256(value, cryptoProvider) {
  if (!cryptoProvider?.subtle?.digest) throw fail('RESTORE_CRYPTO_UNAVAILABLE', 'Web Crypto is required');
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateCanonicalRow(entity, row, ownerId) {
  if (!row || typeof row !== 'object' || row.owner_id !== ownerId) {
    throw fail('RESTORE_OWNER_MISMATCH', 'Restore row owner mismatch');
  }
  const id = entity === 'profile' ? 'profile' : row.id;
  const revision = Number(row.revision);
  if (typeof id !== 'string' || !id || !Number.isSafeInteger(revision) || revision < 1 ||
      !(row.deleted_at === null || row.deleted_at === undefined || typeof row.deleted_at === 'string')) {
    throw fail('RESTORE_ROW_INVALID', 'Restore row is malformed');
  }
}

export async function fetchCoreSnapshot({ ownerId, cloud = cloudDefault, pageSize = CORE_RESTORE_PAGE_SIZE, signal } = {}) {
  const snapshot = {};
  for (const store of CORE_V1_STORES) {
    const entity = SYNC_V2_SCHEMAS[store].entity;
    const rows = [];
    const seen = new Set();
    for (let offset = 0;; offset += pageSize) {
      assertNotAborted(signal);
      const page = await cloud.fetchRestoreEntityPage(entity, { offset, limit: pageSize, signal });
      if (!Array.isArray(page) || page.length > pageSize) throw fail('RESTORE_PAGE_INVALID', 'Invalid restore page');
      for (const row of page) {
        validateCanonicalRow(entity, row, ownerId);
        const id = entity === 'profile' ? 'profile' : row.id;
        if (seen.has(id)) throw fail('RESTORE_ROW_DUPLICATE', 'Duplicate restore row');
        seen.add(id);
        const decoded = decodeSyncV2Canonical(store, row);
        if (!decoded?.id) throw fail('RESTORE_ROW_INVALID', 'Canonical row could not be decoded');
        rows.push(decoded);
      }
      if (page.length < pageSize) break;
    }
    snapshot[store] = rows;
  }
  return snapshot;
}

export async function acquireConsistentCoreSnapshot({ ownerId, cloud = cloudDefault, attempts = CORE_RESTORE_MAX_ATTEMPTS, signal } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      assertNotAborted(signal);
      const m1 = filterCoreRestoreManifest(await cloud.getSyncV2RestoreManifestFull({ signal }));
      if (!m1.length) return { status: 'provisioning_required', manifest: m1, attempt };
      const snapshot = await fetchCoreSnapshot({ ownerId, cloud, signal });
      if (!manifestsEqual(manifestForCanonicalSnapshot(snapshot), m1)) {
        throw fail('RESTORE_SNAPSHOT_MISMATCH', 'Restore data does not match its manifest');
      }
      const m2 = filterCoreRestoreManifest(await cloud.getSyncV2RestoreManifestFull({ signal }));
      if (!manifestsEqual(m1, m2)) throw fail('RESTORE_CONCURRENT_CHANGE', 'Restore manifest changed');
      return { status: 'ready', manifest: m1, snapshot, attempt };
    } catch (error) {
      if (signal?.aborted || error?.code === 'RESTORE_ABORTED' || error?.name === 'AbortError') {
        throw fail('RESTORE_ABORTED', 'Initial Restore was cancelled', error);
      }
      lastError = error;
    }
  }
  throw fail('RESTORE_FAILED', 'Unable to obtain a consistent account snapshot', lastError);
}

export async function runInitialRestore({
  expectedOwnerId, registry = createWorkspaceRegistry(), cloud = cloudDefault, database = dbDefault,
  cryptoProvider = globalThis.crypto, indexedDBFactory = globalThis.indexedDB,
  onState = () => {}, now = () => Date.now(),
  signal,
} = {}) {
  const ownerId = normalizeAuthUserId(expectedOwnerId);
  if (globalThis.navigator?.onLine === false) throw fail('RESTORE_REQUIRES_ONLINE', 'Initial Restore requires a connection');
  onState('RESTORE_PREFLIGHT');
  assertNotAborted(signal);
  const verified = await cloud.verifyCurrentAuthIdentity(ownerId);
  if (verified.id !== ownerId) throw fail('RESTORE_OWNER_MISMATCH', 'Verified account changed');
  const databaseName = await accountWorkspaceDatabaseName(ownerId, { cryptoProvider });
  const matches = await registry.findByAuthUserId(ownerId);
  if (matches.length > 1) throw fail('WORKSPACE_REGISTRY_MISMATCH', 'Ambiguous account workspace');
  let pending = matches[0] ?? null;
  if (pending?.ownershipState === 'claimed') {
    return { status: 'ready', workspace: (await resolveWorkspace({ type: 'account', authUserId: ownerId }, { registry, cryptoProvider })).workspace };
  }
  if (pending && (pending.ownershipState !== 'restoring' || pending.databaseName !== databaseName ||
      pending.restore?.protocol !== CORE_RESTORE_PROTOCOL)) {
    throw fail('WORKSPACE_REGISTRY_MISMATCH', 'Pending workspace ownership mismatch');
  }

  if (pending) {
    database.selectDatabase(databaseName);
    const receipt = await database.readInitialRestoreReceipt();
    if (receipt) {
      if (receipt.ownerId !== ownerId || receipt.restoreId !== pending.restore.restoreId ||
          receipt.manifestHash !== pending.restore.manifestHash || receipt.protocol !== CORE_RESTORE_PROTOCOL) {
        throw fail('RESTORE_RECEIPT_MISMATCH', 'Restore receipt does not match its owner checkpoint');
      }
      onState('RESTORE_FINALIZING');
      await registry.finalizeAccountRestore(ownerId, receipt, { cryptoProvider });
      const resolution = await resolveWorkspace({ type: 'account', authUserId: ownerId }, { registry, cryptoProvider });
      return { status: 'ready', workspace: resolution.workspace, resumed: true };
    }
  } else {
    const presence = await detectWorkspaceDatabase(databaseName, { indexedDBFactory });
    if (presence.status !== 'known') throw fail('RESTORE_DATABASE_PRESENCE_UNKNOWN', 'Cannot prove local workspace absence');
    if (presence.exists) throw fail('RESTORE_DATABASE_CONFLICT', 'Unregistered account database already exists');
  }

  let acquired;
  try {
    acquired = await acquireConsistentCoreSnapshot({ ownerId, cloud, signal });
  } catch (error) {
    if (pending?.restore?.restoreId && error?.code !== 'RESTORE_ABORTED') {
      await registry.updateAccountRestore(ownerId, pending.restore.restoreId, {
        phase: 'RESTORE_FAILED', errorCode: error?.code ?? 'RESTORE_FAILED',
      }, { cryptoProvider });
    }
    throw error;
  }
  if (acquired.status === 'provisioning_required') return acquired;
  const manifestJSON = JSON.stringify(acquired.manifest);
  const manifestHash = await sha256(manifestJSON, cryptoProvider);
  const restoreId = pending?.restore?.restoreId ?? cryptoProvider?.randomUUID?.() ?? uid();
  pending = pending ?? await registry.beginAccountRestore(ownerId, {
    protocol: CORE_RESTORE_PROTOCOL, restoreId, manifestHash, phase: 'RESTORING',
  }, { cryptoProvider });
  if (pending.restore.manifestHash !== manifestHash) {
    throw fail('RESTORE_CHECKPOINT_STALE', 'Pending restore manifest changed; explicit retry is required');
  }
  onState('RESTORING');
  assertNotAborted(signal);
  await registry.updateAccountRestore(ownerId, restoreId, { phase: 'RESTORING' }, { cryptoProvider });
  database.selectDatabase(databaseName);
  const completedAt = now();
  const receipt = Object.freeze({ protocol: CORE_RESTORE_PROTOCOL, restoreId, ownerId, manifestHash, completedAt });
  const device = makeDevice({
    deviceId: cryptoProvider?.randomUUID?.() ?? uid(), schemaVersion: database.DB_VERSION,
    initialRestoreReceipt: clone(receipt), updatedAt: completedAt,
  });
  await database.importInitialRestoreSnapshot(acquired.snapshot, device);
  assertNotAborted(signal);
  onState('RESTORE_FINALIZING');
  await registry.updateAccountRestore(ownerId, restoreId, { phase: 'RESTORE_FINALIZING' }, { cryptoProvider });
  await registry.finalizeAccountRestore(ownerId, receipt, { cryptoProvider });
  const resolution = await resolveWorkspace({ type: 'account', authUserId: ownerId }, { registry, cryptoProvider });
  if (resolution.status !== 'resolved') throw fail('RESTORE_FINALIZE_FAILED', 'Restored workspace could not be resolved');
  return { status: 'ready', workspace: resolution.workspace, receipt, attempt: acquired.attempt };
}
