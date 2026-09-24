import {
  LEGACY_WORKSPACE_DB_NAME,
  createWorkspaceRegistry,
  detectWorkspaceDatabase,
  normalizeAuthUserId,
  resolveWorkspace,
} from './workspaces.js';

export const WORKSPACE_NOT_READY = 'WORKSPACE_NOT_READY';

const CLAIM_VERSION = 1;

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function notReady(reason, details = {}) {
  return Object.freeze({
    status: 'not_ready',
    code: WORKSPACE_NOT_READY,
    reason,
    workspace: null,
    ...details,
  });
}

function ready(workspace, mode) {
  return Object.freeze({
    status: 'ready',
    code: null,
    reason: null,
    mode,
    workspace: Object.freeze(workspace),
  });
}

/**
 * Reads only the ownership checkpoint from an already-existing Product DB.
 * Callers must prove presence first so IndexedDB.open cannot create a database.
 */
export async function readWorkspaceClaimMetadata(databaseName, {
  indexedDBFactory = globalThis.indexedDB,
  databasePresence = null,
} = {}) {
  if (databasePresence?.status !== 'known' || databasePresence.exists !== true) {
    return Object.freeze({ status: 'unavailable', marker: null, recoveryPending: false });
  }
  if (!indexedDBFactory?.open) {
    return Object.freeze({ status: 'unavailable', marker: null, recoveryPending: false });
  }

  const database = await new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Object.assign(new Error('Product database metadata read is blocked'), {
      code: WORKSPACE_NOT_READY,
    }));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(Object.assign(new Error('Product database appeared after the presence check'), {
        code: WORKSPACE_NOT_READY,
      }));
    };
  });

  try {
    if (!database.objectStoreNames.contains('device')) {
      return Object.freeze({ status: 'read', marker: null, recoveryPending: false });
    }
    const device = await requestResult(database.transaction('device', 'readonly').objectStore('device').get('device'));
    return Object.freeze({
      status: 'read',
      marker: device?.workspaceClaim ? structuredClone(device.workspaceClaim) : null,
      recoveryPending: device?.workspaceClaim?.state === 'registry_pending',
    });
  } finally {
    database.close();
  }
}

/** Reads only the local Initial Restore receipt from a proven-existing DB. */
export async function readInitialRestoreMetadata(databaseName, {
  indexedDBFactory = globalThis.indexedDB,
  databasePresence = null,
} = {}) {
  if (databasePresence?.status !== 'known' || databasePresence.exists !== true || !indexedDBFactory?.open) {
    return Object.freeze({ status: 'unavailable', receipt: null });
  }
  const database = await new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Object.assign(new Error('Product database metadata read is blocked'), { code: WORKSPACE_NOT_READY }));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(Object.assign(new Error('Product database appeared after the presence check'), { code: WORKSPACE_NOT_READY }));
    };
  });
  try {
    if (!database.objectStoreNames.contains('device')) return Object.freeze({ status: 'read', receipt: null });
    const device = await requestResult(database.transaction('device', 'readonly').objectStore('device').get('device'));
    return Object.freeze({ status: 'read', receipt: device?.initialRestoreReceipt ? structuredClone(device.initialRestoreReceipt) : null });
  } finally {
    database.close();
  }
}

/** Only a prior server-verified first-account receipt can unlock this local database. */
export async function readAccountProvisioningMetadata(databaseName, {
  indexedDBFactory = globalThis.indexedDB, databasePresence = null,
} = {}) {
  if (databasePresence?.status !== 'known' || databasePresence.exists !== true || !indexedDBFactory?.open) {
    return Object.freeze({ status: 'unavailable', receipt: null });
  }
  const database = await new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Object.assign(new Error('Provisioned database metadata read is blocked'), { code: WORKSPACE_NOT_READY }));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(Object.assign(new Error('Provisioned database appeared after presence check'), { code: WORKSPACE_NOT_READY }));
    };
  });
  try {
    if (!database.objectStoreNames.contains('device')) return Object.freeze({ status: 'read', receipt: null });
    const device = await requestResult(database.transaction('device', 'readonly').objectStore('device').get('device'));
    return Object.freeze({ status: 'read', receipt: device?.accountProvisioningReceipt
      ? structuredClone(device.accountProvisioningReceipt) : null });
  } finally { database.close(); }
}

function markerMatchesWorkspace(marker, workspace) {
  if (!marker || marker.version !== CLAIM_VERSION || marker.state !== 'claimed') return false;
  let ownerId;
  try { ownerId = normalizeAuthUserId(marker.ownerId); } catch { return false; }
  return ownerId === workspace.authUserId &&
    marker.databaseName === workspace.databaseName &&
    marker.claimId === workspace.claimId;
}

function isClaimedLegacyRecord(record) {
  return record?.type === 'account' && record?.ownershipState === 'claimed' &&
    record?.workspaceKind === 'legacy-in-place' && record?.databaseName === LEGACY_WORKSPACE_DB_NAME;
}

/**
 * Resolves the only Product DB that may be mounted for this boot. This function
 * never creates a Product DB and never repairs ownership metadata.
 */
export async function resolveWorkspaceForBoot({
  authUser = null,
  authState = authUser ? 'authenticated' : 'signed_out',
  registry = createWorkspaceRegistry(),
  indexedDBFactory = globalThis.indexedDB,
  cryptoProvider = globalThis.crypto,
  detectDatabase = detectWorkspaceDatabase,
  readClaimMetadata = readWorkspaceClaimMetadata,
  readRestoreMetadata = readInitialRestoreMetadata,
  readProvisioningMetadata = readAccountProvisioningMetadata,
  allowDevelopmentLegacyBootstrap = false,
} = {}) {
  let records;
  let legacyPresence;
  try {
    [records, legacyPresence] = await Promise.all([
      registry.list(),
      detectDatabase(LEGACY_WORKSPACE_DB_NAME, { indexedDBFactory }),
    ]);
  } catch (error) {
    return notReady('workspace-metadata-unavailable', { cause: error?.code ?? error?.name ?? null });
  }

  const claimedLegacyRecords = (records ?? []).filter(isClaimedLegacyRecord);
  if (claimedLegacyRecords.length > 1) return notReady('ambiguous-claimed-legacy-workspace');

  let authenticatedUserId = null;
  if (authState === 'authenticated' || authUser) {
    try { authenticatedUserId = normalizeAuthUserId(authUser?.id); }
    catch { return notReady('invalid-auth-user-id', { authState: 'authenticated' }); }
  }

  if (authenticatedUserId) {
    const provisioningForOwner = (records ?? []).filter((record) => record?.type === 'account' &&
      record.authUserId === authenticatedUserId && record.ownershipState === 'provisioning');
    if (provisioningForOwner.length) return notReady('account-provisioning-pending', { authState: 'authenticated' });
    const pendingForOwner = (records ?? []).filter((record) => record?.type === 'account' &&
      record.authUserId === authenticatedUserId && record.ownershipState === 'restoring');
    if (pendingForOwner.length > 1) return notReady('ambiguous-account-workspace', { authState: 'authenticated' });
    if (pendingForOwner.length === 1) {
      return notReady('initial-restore-pending', {
        authState: 'authenticated', restorePhase: pendingForOwner[0].restore?.phase ?? 'RESTORE_FAILED',
      });
    }
    const resolution = await resolveWorkspace({
      type: 'account', authUserId: authenticatedUserId,
      legacyDetected: legacyPresence?.exists === true,
    }, { registry, cryptoProvider });

    if (resolution.status === 'resolved') {
      const workspace = resolution.workspace;
      if (workspace.workspaceKind !== 'legacy-in-place') {
        let presence;
        try { presence = await detectDatabase(workspace.databaseName, { indexedDBFactory }); }
        catch (error) { return notReady('workspace-metadata-unavailable', { authState: 'authenticated', cause: error?.code ?? error?.name ?? null }); }
        if (presence?.status !== 'known' || presence.exists !== true) {
          return notReady('claimed-workspace-database-missing', { authState: 'authenticated' });
        }
        if (workspace.workspaceKind === 'account-provisioned') {
          let metadata;
          try { metadata = await readProvisioningMetadata(workspace.databaseName, {
            indexedDBFactory, databasePresence: presence,
          }); } catch (error) { return notReady('provisioning-receipt-unavailable', {
            authState: 'authenticated', cause: error?.code ?? error?.name ?? null,
          }); }
          const receipt = metadata?.receipt;
          const registryReceipt = records.find((record) => record.id === workspace.id)?.provisioningReceipt;
          if (metadata?.status !== 'read' || receipt?.ownerId !== authenticatedUserId ||
              receipt?.contractVersion !== 1 || !receipt?.foundationHash ||
              registryReceipt?.ownerId !== authenticatedUserId || registryReceipt?.contractVersion !== 1 ||
              registryReceipt?.foundationHash !== receipt.foundationHash) {
            return notReady('account-provisioning-receipt-mismatch', { authState: 'authenticated' });
          }
          return ready(workspace, 'provisioned-account');
        }
        let metadata;
        try { metadata = await readRestoreMetadata(workspace.databaseName, { indexedDBFactory, databasePresence: presence }); }
        catch (error) { return notReady('restore-receipt-unavailable', { authState: 'authenticated', cause: error?.code ?? error?.name ?? null }); }
        const receipt = metadata?.receipt;
        const registryReceipt = records.find((record) => record.id === workspace.id)?.restoreReceipt;
        if (metadata?.status !== 'read' || receipt?.protocol !== 'CORE_V1' || receipt?.ownerId !== authenticatedUserId ||
            !registryReceipt || receipt.restoreId !== registryReceipt.restoreId || receipt.manifestHash !== registryReceipt.manifestHash) {
          return notReady('initial-restore-receipt-mismatch', { authState: 'authenticated' });
        }
        return ready(workspace, 'restored-account');
      }
      if (legacyPresence?.status !== 'known' || legacyPresence.exists !== true) {
        return notReady('claimed-workspace-database-missing', { authState: 'authenticated' });
      }
      let metadata;
      try {
        metadata = await readClaimMetadata(workspace.databaseName, {
          indexedDBFactory, databasePresence: legacyPresence,
        });
      } catch (error) {
        return notReady('claim-marker-unavailable', { authState: 'authenticated', cause: error?.code ?? error?.name ?? null });
      }
      if (metadata.status !== 'read' || metadata.recoveryPending || !markerMatchesWorkspace(metadata.marker, workspace)) {
        return notReady(metadata.recoveryPending ? 'workspace-claim-recovery-required' : 'workspace-claim-registry-mismatch', {
          authState: 'authenticated',
        });
      }
      return ready(workspace, 'claimed-account');
    }

    // A registry record for another owner is enough to reject before touching
    // that owner's Product database.
    if (claimedLegacyRecords.length) {
      return notReady('authenticated-account-workspace-mismatch', { authState: 'authenticated' });
    }

    if (legacyPresence?.status !== 'known') {
      return notReady('workspace-database-presence-unknown', { authState: 'authenticated' });
    }
    if (!legacyPresence.exists) return notReady('initial-restore-required', { authState: 'authenticated' });

    const metadata = await readClaimMetadata(LEGACY_WORKSPACE_DB_NAME, {
      indexedDBFactory, databasePresence: legacyPresence,
    });
    if (metadata.marker || metadata.recoveryPending) {
      return notReady(metadata.recoveryPending ? 'workspace-claim-recovery-required' : 'claimed-workspace-registry-missing', {
        authState: 'authenticated',
      });
    }
    const legacy = await resolveWorkspace({ type: 'legacy', legacyDetected: true }, { registry, cryptoProvider });
    return legacy.status === 'resolved'
      ? ready(legacy.workspace, 'legacy-unclaimed')
      : notReady(legacy.reason, { authState: 'authenticated' });
  }

  if (claimedLegacyRecords.length) {
    return notReady('claimed-workspace-signed-out', { authState: 'signed_out' });
  }
  if (legacyPresence?.status !== 'known') {
    return notReady('workspace-database-presence-unknown', { authState: 'signed_out' });
  }
  if (!legacyPresence.exists) {
    if (allowDevelopmentLegacyBootstrap) {
      const legacy = await resolveWorkspace({ type: 'legacy', legacyDetected: true }, { registry, cryptoProvider });
      return legacy.status === 'resolved'
        ? ready(legacy.workspace, 'development-legacy-unclaimed')
        : notReady(legacy.reason, { authState: 'signed_out' });
    }
    return notReady('workspace-not-provisioned', { authState: 'signed_out' });
  }

  const metadata = await readClaimMetadata(LEGACY_WORKSPACE_DB_NAME, {
    indexedDBFactory, databasePresence: legacyPresence,
  });
  if (metadata.marker || metadata.recoveryPending) {
    return notReady(metadata.recoveryPending ? 'workspace-claim-recovery-required' : 'claimed-workspace-registry-missing', {
      authState: 'signed_out',
    });
  }
  const legacy = await resolveWorkspace({ type: 'legacy', legacyDetected: true }, { registry, cryptoProvider });
  return legacy.status === 'resolved'
    ? ready(legacy.workspace, 'legacy-unclaimed')
    : notReady(legacy.reason, { authState: 'signed_out' });
}
