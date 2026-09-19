/**
 * Explicit, dormant-by-default ownership claim for the existing `rakeezx`
 * database. Importing this module never opens, reads, or changes a database.
 */

import * as defaultDatabase from './db.js';
import * as cloud from './cloud.js';
import {
  LEGACY_BROADCAST_CHANNEL_NAME,
  LEGACY_WORKSPACE_DB_NAME,
  createWorkspaceRegistry,
  normalizeAuthUserId,
} from './workspaces.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { SYNC_V2_SCHEMAS, SYNC_V2_STORES, decodeSyncV2Canonical } from './sync-v2.js';

export const LEGACY_WORKSPACE_CLAIM_VERSION = 1;
export const LEGACY_WORKSPACE_CLAIM_ACTIVATION_DEFAULT = false;
export const LEGACY_WORKSPACE_CLAIM_CONFIRMATION = 'CLAIM_EXISTING_LEGACY_WORKSPACE';
export const CANONICAL_PRODUCTION_ORIGIN = 'https://rakeezx.com';

const CLAIM_STATES = new Set(['registry_pending', 'claimed']);
const AUTH_FRESHNESS_MS = 5 * 60 * 1000;
const SHARED_DEFAULT_STORES = new Set(['years', 'terms', 'calendars', 'calendarDays', 'subjects', 'timeProfiles']);

function fail(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function stableClaimJSON(value) {
  return JSON.stringify(canonicalize(value));
}

export async function claimSHA256(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle?.digest) throw fail('WORKSPACE_CLAIM_CRYPTO_UNAVAILABLE', 'SHA-256 is unavailable');
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableClaimJSON(value));
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizedOwner(value) {
  try {
    return normalizeAuthUserId(value);
  } catch {
    return null;
  }
}

function outboxOwnerConflict(outbox, ownerId) {
  for (const entry of outbox ?? []) {
    if (entry?.ownerId == null) continue;
    const normalized = normalizedOwner(entry.ownerId);
    if (!normalized) return { reason: 'malformed-outbox-owner', commandId: entry.id ?? null };
    if (normalized !== ownerId) return { reason: 'conflicting-outbox-owner', commandId: entry.id ?? null };
  }
  return null;
}

function registryConflict(records, ownerId) {
  for (const record of records ?? []) {
    if (record?.databaseName !== LEGACY_WORKSPACE_DB_NAME || record?.ownershipState !== 'claimed') continue;
    if (normalizedOwner(record.authUserId) !== ownerId) {
      return { reason: 'conflicting-registry-owner', registryId: record.id ?? null };
    }
  }
  return null;
}

/**
 * Canonical evidence is deliberately sanitized: callers provide hashes and
 * revisions, never teacher/student payloads. `meaningful=false` covers shared
 * Product defaults that cannot prove account ownership.
 */
export function assessLegacyClaimEvidence({
  expectedOwnerId,
  verifiedOwnerId,
  online = true,
  canonicalEvidence = [],
  registryRecords = [],
  outbox = [],
} = {}) {
  const expected = normalizedOwner(expectedOwnerId);
  const verified = normalizedOwner(verifiedOwnerId);
  if (!online || !verified) return Object.freeze({ status: 'offline_or_unverified', strongMatches: 0, conflicts: [] });
  if (!expected || verified !== expected) {
    return Object.freeze({ status: 'conflict', strongMatches: 0, conflicts: ['verified-owner-mismatch'] });
  }

  const conflicts = [];
  const registry = registryConflict(registryRecords, expected);
  if (registry) conflicts.push(registry.reason);
  const outboxConflict = outboxOwnerConflict(outbox, expected);
  if (outboxConflict) conflicts.push(outboxConflict.reason);

  let strongMatches = 0;
  for (const evidence of canonicalEvidence ?? []) {
    if (!evidence?.meaningful) continue;
    const localRevision = Number(evidence.localRevision ?? 0);
    const remoteRevision = Number(evidence.remoteRevision ?? 0);
    if (!Number.isSafeInteger(localRevision) || localRevision <= 0) continue;
    if (evidence.remotePresent !== true || !Number.isSafeInteger(remoteRevision) || remoteRevision < localRevision) {
      conflicts.push('canonical-owner-record-missing-or-older');
      continue;
    }
    if (remoteRevision === localRevision && evidence.localHash !== evidence.remoteHash) {
      conflicts.push('canonical-owner-record-mismatch');
      continue;
    }
    strongMatches += 1;
  }

  return Object.freeze({
    status: conflicts.length ? 'conflict' : strongMatches ? 'established' : 'confirmation_required',
    strongMatches,
    conflicts: Object.freeze([...new Set(conflicts)]),
  });
}

function canonicalEvidenceValue(storeName, record) {
  const fields = Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {});
  return Object.fromEntries(['id', 'deleted', ...fields].map((field) => [field, record?.[field] ?? null]));
}

function meaningfulCanonicalRecord(storeName, record) {
  if (storeName === 'profile') {
    return ['teacherName', 'schoolName', 'phone', 'reportPrincipalName']
      .some((field) => String(record?.[field] ?? '').trim());
  }
  return !SHARED_DEFAULT_STORES.has(storeName);
}

/**
 * Read-only proof collector for a future explicitly authorized activation.
 * Remote rows are already owner-scoped by Supabase RLS; only hashes/revisions
 * leave this function. It is never called while activation remains disabled.
 */
export async function collectLegacyCanonicalEvidence({
  database = defaultDatabase,
  fetchRecords = (entity) => cloud.fetchRecords(entity),
  cryptoProvider = globalThis.crypto,
} = {}) {
  const canonicalEvidence = [];
  for (const storeName of SYNC_V2_STORES) {
    const schema = SYNC_V2_SCHEMAS[storeName];
    const localRows = storeName === 'profile'
      ? [await database.get('profile', 'profile')].filter(Boolean)
      : await database.getAll(storeName);
    const remoteRows = await fetchRecords(schema.entity);
    if (!Array.isArray(remoteRows)) throw fail('WORKSPACE_CLAIM_EVIDENCE_UNAVAILABLE', `Invalid owner-scoped evidence for ${storeName}`);
    const remoteById = new Map(remoteRows.map((row) => {
      const decoded = decodeSyncV2Canonical(storeName, row);
      return [decoded?.id, decoded];
    }).filter(([id]) => typeof id === 'string' && id));

    for (const local of localRows) {
      const localRevision = Number(local?.serverRevision ?? 0);
      if (!Number.isSafeInteger(localRevision) || localRevision <= 0 || !local?.serverCanonical) continue;
      const remote = remoteById.get(local.canonicalId ?? local.id) ?? null;
      canonicalEvidence.push({
        store: storeName,
        idHash: await claimSHA256(`${storeName}:${local.canonicalId ?? local.id}`, cryptoProvider),
        meaningful: meaningfulCanonicalRecord(storeName, local),
        localRevision,
        remoteRevision: Number(remote?.serverRevision ?? 0),
        localHash: await claimSHA256(canonicalEvidenceValue(storeName, local.serverCanonical), cryptoProvider),
        remoteHash: remote ? await claimSHA256(canonicalEvidenceValue(storeName, remote), cryptoProvider) : null,
        remotePresent: !!remote,
      });
    }
  }
  return Object.freeze({ online: true, canonicalEvidence: Object.freeze(canonicalEvidence) });
}

export function claimedWorkspaceAccess({ claimMarker, authenticatedUserId, authState } = {}) {
  if (!claimMarker || claimMarker.state !== 'claimed') {
    return Object.freeze({ allowed: false, reason: 'workspace-not-claimed' });
  }
  const ownerId = normalizedOwner(claimMarker.ownerId);
  const authenticated = normalizedOwner(authenticatedUserId);
  if (!ownerId) return Object.freeze({ allowed: false, reason: 'workspace-claim-invalid' });
  if (authState === 'signed_out' || !authenticated) {
    return Object.freeze({ allowed: false, reason: 'claimed-workspace-signed-out', ownerId });
  }
  if (authenticated !== ownerId) {
    return Object.freeze({ allowed: false, reason: 'claimed-workspace-owner-mismatch', ownerId });
  }
  return Object.freeze({ allowed: true, reason: 'claimed-workspace-owner-verified', ownerId });
}

function validateClaimMarker(marker, ownerId) {
  if (!marker) return null;
  if (marker.version !== LEGACY_WORKSPACE_CLAIM_VERSION || !CLAIM_STATES.has(marker.state) ||
      marker.databaseName !== LEGACY_WORKSPACE_DB_NAME || normalizedOwner(marker.ownerId) !== ownerId ||
      typeof marker.claimId !== 'string' || !marker.claimId) {
    throw fail('WORKSPACE_CLAIM_CONFLICT', 'Existing workspace claim metadata conflicts with this request');
  }
  return marker;
}

function confirmationMatches(confirmation, ownerId, origin) {
  return confirmation?.action === LEGACY_WORKSPACE_CLAIM_CONFIRMATION &&
    confirmation?.confirmed === true &&
    confirmation?.otherTabsClosed === true &&
    normalizedOwner(confirmation.expectedOwnerId) === ownerId &&
    confirmation?.origin === origin &&
    confirmation?.databaseName === LEGACY_WORKSPACE_DB_NAME;
}

function claimedDescriptor(registryRecord, ownerId, claimId) {
  return Object.freeze({
    id: registryRecord.id,
    type: 'account',
    authUserId: ownerId,
    databaseName: LEGACY_WORKSPACE_DB_NAME,
    ownershipState: 'claimed',
    syncEligible: true,
    workspaceKind: 'legacy-in-place',
    claimId,
    broadcastChannelName: LEGACY_BROADCAST_CHANNEL_NAME,
  });
}

export function createLegacyWorkspaceClaimService({
  activationEnabled = LEGACY_WORKSPACE_CLAIM_ACTIVATION_DEFAULT,
  database = defaultDatabase,
  registry = createWorkspaceRegistry(),
  ownershipGuard = runtimeSyncOwnershipGuard,
  verifyIdentity = (ownerId) => cloud.verifyCurrentAuthIdentity(ownerId),
  evidenceProvider = null,
  runExclusive = null,
  originProvider = () => globalThis.location?.origin ?? '',
  canonicalOrigin = CANONICAL_PRODUCTION_ORIGIN,
  now = () => Date.now(),
  makeId = () => globalThis.crypto.randomUUID(),
  cryptoProvider = globalThis.crypto,
} = {}) {
  let serialized = Promise.resolve();

  async function execute({ expectedOwnerId, confirmation, claimId: requestedClaimId = null } = {}) {
    if (!activationEnabled) throw fail('WORKSPACE_CLAIM_DISABLED', 'Legacy workspace claim activation is disabled');
    const ownerId = normalizeAuthUserId(expectedOwnerId);
    const origin = String(originProvider() ?? '');
    if (origin !== canonicalOrigin) {
      throw fail('WORKSPACE_CLAIM_ORIGIN_MISMATCH', 'The legacy workspace can only be claimed on the canonical Production origin');
    }
    if (!confirmationMatches(confirmation, ownerId, origin)) {
      throw fail('WORKSPACE_CLAIM_CONFIRMATION_REQUIRED', 'Explicit workspace claim confirmation is required');
    }

    const exclusive = runExclusive ?? (await import('./sync.js')).runWorkspaceClaimExclusive;
    if (typeof exclusive !== 'function') {
      throw fail('WORKSPACE_CLAIM_FENCE_UNAVAILABLE', 'The workspace claim write and Sync fence is unavailable');
    }
    return exclusive(async () => {
      const previousWorkspace = ownershipGuard.getWorkspace();
      ownershipGuard.setWorkspace({ type: 'unresolved', ownershipState: 'unresolved', reason: 'workspace-claim-in-progress' });
      let retainFence = false;
      try {
        const verified = await verifyIdentity(ownerId);
        if (normalizedOwner(verified?.id) !== ownerId || verified?.source !== 'supabase-auth-user' ||
            !Number.isFinite(verified?.verifiedAt) || now() - verified.verifiedAt > AUTH_FRESHNESS_MS) {
          throw fail('WORKSPACE_CLAIM_IDENTITY_UNVERIFIED', 'A fresh server-validated Auth identity is required');
        }

        const deviceBefore = await database.get('device', 'device');
        if (!deviceBefore?.deviceId) throw fail('WORKSPACE_CLAIM_DEVICE_MISSING', 'A stable local device identity is required');
        const existingMarker = validateClaimMarker(deviceBefore.workspaceClaim, ownerId);
        const claimId = existingMarker?.claimId ?? requestedClaimId ?? makeId();
        if (typeof claimId !== 'string' || !claimId) throw fail('INVALID_WORKSPACE_CLAIM', 'A durable claim ID is required');

        const provideEvidence = evidenceProvider ?? (() => collectLegacyCanonicalEvidence({ database, cryptoProvider }));
        const [registryRecords, outboxBefore, providedEvidence] = await Promise.all([
          registry.list(), database.getAll('outbox'), provideEvidence({ ownerId, claimId, origin }),
        ]);
        if (existingMarker?.state === 'registry_pending') {
          const recovery = deviceBefore.workspaceClaimRecovery;
          const expectedStampedOutbox = Array.isArray(recovery?.outbox)
            ? recovery.outbox.map((entry) => entry.ownerId == null ? { ...entry, ownerId } : entry)
            : null;
          if (recovery?.version !== LEGACY_WORKSPACE_CLAIM_VERSION || recovery?.claimId !== claimId ||
              recovery?.beforeOutboxHash !== existingMarker.beforeOutboxHash ||
              recovery?.afterOutboxHash !== existingMarker.afterOutboxHash ||
              !expectedStampedOutbox || stableClaimJSON(expectedStampedOutbox) !== stableClaimJSON(outboxBefore)) {
            throw fail('WORKSPACE_CLAIM_RECOVERY_CONFLICT', 'Pending claim recovery evidence is missing or inconsistent');
          }
        }
        const assessment = assessLegacyClaimEvidence({
          expectedOwnerId: ownerId,
          verifiedOwnerId: verified.id,
          online: providedEvidence?.online !== false,
          canonicalEvidence: providedEvidence?.canonicalEvidence ?? [],
          registryRecords,
          outbox: outboxBefore,
        });
        if (assessment.status === 'offline_or_unverified') {
          throw fail('WORKSPACE_CLAIM_IDENTITY_UNVERIFIED', 'Ownership cannot be established while identity is unverified');
        }
        if (assessment.status === 'conflict') {
          throw fail('WORKSPACE_CLAIM_EVIDENCE_CONFLICT', 'Workspace ownership evidence conflicts', {
            conflicts: assessment.conflicts,
          });
        }

        const existingOutboxConflict = outboxOwnerConflict(outboxBefore, ownerId);
        if (existingOutboxConflict) {
          throw fail('WORKSPACE_CLAIM_OUTBOX_CONFLICT', 'Outbox ownership conflicts with the expected owner', existingOutboxConflict);
        }
        const outboxJSON = stableClaimJSON(outboxBefore);
        const stampedOutbox = outboxBefore.map((entry) => entry.ownerId == null ? { ...entry, ownerId } : entry);
        const [beforeOutboxHash, afterOutboxHash, evidenceHash] = await Promise.all([
          claimSHA256(outboxJSON, cryptoProvider),
          claimSHA256(stampedOutbox, cryptoProvider),
          claimSHA256({ ownerId, origin, assessment, canonicalEvidence: providedEvidence?.canonicalEvidence ?? [] }, cryptoProvider),
        ]);
        const stamp = now();

        await database.applyBatch({ device: {}, outbox: {} }, {
          prepare(current) {
            const device = current.device.find((record) => record.id === 'device');
            if (!device?.deviceId || device.deviceId !== deviceBefore.deviceId) {
              throw fail('WORKSPACE_CLAIM_DEVICE_CHANGED', 'Device identity changed during claim preparation');
            }
            if (device.studentLifecycleResume || device.cloudRestoreResume) {
              throw fail('WORKSPACE_CLAIM_RECONCILIATION_PENDING', 'Finish pending reconciliation before claiming the workspace');
            }
            const marker = validateClaimMarker(device.workspaceClaim, ownerId);
            if (marker) {
              const conflict = outboxOwnerConflict(current.outbox, ownerId);
              if (conflict || current.outbox.some((entry) => entry.ownerId == null)) {
                throw fail('WORKSPACE_CLAIM_OUTBOX_CONFLICT', 'Outbox changed after a claim checkpoint', conflict ?? {});
              }
              return { device: { put: [], remove: [] }, outbox: { put: [], remove: [] } };
            }
            if (stableClaimJSON(current.outbox) !== outboxJSON) {
              throw fail('WORKSPACE_CLAIM_OUTBOX_CHANGED', 'Outbox changed while ownership evidence was being checked');
            }
            const workspaceClaim = {
              version: LEGACY_WORKSPACE_CLAIM_VERSION,
              claimId,
              state: 'registry_pending',
              ownerId,
              origin,
              databaseName: LEGACY_WORKSPACE_DB_NAME,
              deviceId: device.deviceId,
              evidenceHash,
              beforeOutboxHash,
              afterOutboxHash,
              createdAt: stamp,
              updatedAt: stamp,
            };
            const workspaceClaimRecovery = {
              version: LEGACY_WORKSPACE_CLAIM_VERSION,
              claimId,
              capturedAt: stamp,
              priorClaim: device.workspaceClaim ?? null,
              outbox: structuredClone(current.outbox),
              beforeOutboxHash,
              afterOutboxHash,
            };
            return {
              device: { put: [{ ...device, workspaceClaim, workspaceClaimRecovery }], remove: [] },
              outbox: { put: stampedOutbox, remove: [] },
            };
          },
        });
        retainFence = true;

        const registryRecord = await registry.registerLegacyClaim(ownerId, { claimId, evidenceHash, cryptoProvider });
        await database.applyBatch({ device: {}, outbox: {} }, {
          prepare(current) {
            const device = current.device.find((record) => record.id === 'device');
            const marker = validateClaimMarker(device?.workspaceClaim, ownerId);
            if (!marker || marker.claimId !== claimId) {
              throw fail('WORKSPACE_CLAIM_CHECKPOINT_CHANGED', 'Workspace claim checkpoint changed before finalization');
            }
            const conflict = outboxOwnerConflict(current.outbox, ownerId);
            if (conflict || current.outbox.some((entry) => entry.ownerId == null)) {
              throw fail('WORKSPACE_CLAIM_OUTBOX_CONFLICT', 'Outbox ownership changed before finalization', conflict ?? {});
            }
            if (marker.state === 'claimed') {
              return { device: { put: [], remove: [] }, outbox: { put: [], remove: [] } };
            }
            return {
              device: {
                put: [{ ...device, workspaceClaim: { ...marker, state: 'claimed', updatedAt: now() } }],
                remove: [],
              },
              outbox: { put: [], remove: [] },
            };
          },
        });

        const workspace = claimedDescriptor(registryRecord, ownerId, claimId);
        ownershipGuard.setWorkspace(workspace);
        retainFence = false;
        return Object.freeze({
          status: existingMarker?.state === 'claimed' ? 'already_claimed' : 'claimed',
          ownerId,
          claimId,
          databaseName: LEGACY_WORKSPACE_DB_NAME,
          evidenceStatus: assessment.status,
          stampedCommands: existingMarker ? 0 : outboxBefore.filter((entry) => entry.ownerId == null).length,
          beforeOutboxHash,
          afterOutboxHash,
          workspace,
        });
      } catch (error) {
        let checkpoint = null;
        try { checkpoint = (await database.get('device', 'device'))?.workspaceClaim ?? null; } catch {}
        const checkpointBelongsToAttempt = checkpoint
          && CLAIM_STATES.has(checkpoint.state)
          && normalizedOwner(checkpoint.ownerId) === ownerId;
        if (!checkpointBelongsToAttempt || checkpoint.state === 'claimed') {
          ownershipGuard.setWorkspace(previousWorkspace);
          retainFence = false;
        }
        if (checkpointBelongsToAttempt && (retainFence || checkpoint.state === 'registry_pending')) {
          ownershipGuard.setWorkspace({
            type: 'unresolved', ownershipState: 'unresolved', reason: 'workspace-claim-recovery-required',
          });
        }
        throw error;
      }
    });
  }

  function claim(request) {
    const run = serialized.then(() => execute(request));
    serialized = run.catch(() => {});
    return run;
  }

  return Object.freeze({ claim });
}
