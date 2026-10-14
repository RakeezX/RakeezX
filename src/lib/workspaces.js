import { DB_NAME as LEGACY_PRODUCT_DB_NAME } from './db.js';

export const WORKSPACE_REGISTRY_DB_NAME = 'rakeezx-workspace-registry';
export const WORKSPACE_REGISTRY_DB_VERSION = 1;
export const WORKSPACE_REGISTRY_STORE = 'workspaces';
export const DEMO_WORKSPACE_DB_NAME = 'rakeezx-demo';
export const LEGACY_WORKSPACE_DB_NAME = LEGACY_PRODUCT_DB_NAME;
export const LEGACY_BROADCAST_CHANNEL_NAME = 'rakeezx-data';

const ACCOUNT_KEY_HEX_LENGTH = 32;
const AUTH_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);
});

export function normalizeAuthUserId(value) {
  const id = String(value ?? '').trim().toLowerCase();
  if (!AUTH_USER_ID_PATTERN.test(id)) {
    throw Object.assign(new Error('A valid Auth user ID is required'), { code: 'INVALID_AUTH_USER_ID' });
  }
  return id;
}

async function sha256Hex(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle?.digest) {
    throw Object.assign(new Error('Web Crypto SHA-256 is required for workspace resolution'), {
      code: 'WORKSPACE_CRYPTO_UNAVAILABLE',
    });
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function accountWorkspaceKey(authUserId, { cryptoProvider = globalThis.crypto } = {}) {
  const id = normalizeAuthUserId(authUserId);
  return (await sha256Hex(`rakeezx-workspace-v1:${id}`, cryptoProvider)).slice(0, ACCOUNT_KEY_HEX_LENGTH);
}

export async function accountWorkspaceDatabaseName(authUserId, options = {}) {
  return `rakeezx-user-${await accountWorkspaceKey(authUserId, options)}`;
}

export function validRestoreReceipt(receipt, ownerId = receipt?.ownerId) {
  return ['CORE_V1', 'CORE_V2'].includes(receipt?.protocol) &&
    receipt?.ownerId === ownerId && typeof receipt?.restoreId === 'string' && !!receipt.restoreId &&
    typeof receipt?.manifestHash === 'string' && !!receipt.manifestHash &&
    Number.isFinite(receipt?.completedAt) && receipt.completedAt > 0;
}

function unresolved(reason) {
  return Object.freeze({ status: 'unresolved', reason, workspace: null });
}

function resolved(workspace) {
  return Object.freeze({ status: 'resolved', reason: null, workspace: Object.freeze(workspace) });
}

function accountRecordId(key) {
  return `account:${key}`;
}

function accountChannelName(key) {
  return `rakeezx-data:account:${key}`;
}

function accountDescriptor(record, key) {
  const legacyInPlace = record.workspaceKind === 'legacy-in-place' &&
    record.databaseName === LEGACY_WORKSPACE_DB_NAME;
  return {
    id: record.id,
    type: 'account',
    authUserId: record.authUserId,
    databaseName: record.databaseName,
    ownershipState: 'claimed',
    syncEligible: true,
    // Stable claim/restore/provisioning identity, not mutable registry updatedAt.
    leaseGeneration: JSON.stringify([record.createdAt, record.claimId ?? null,
      record.restoreReceipt ?? null, record.provisioningReceipt ?? null]),
    broadcastChannelName: legacyInPlace ? LEGACY_BROADCAST_CHANNEL_NAME : accountChannelName(key),
    ...(legacyInPlace ? { workspaceKind: 'legacy-in-place', claimId: record.claimId } : {}),
    ...(record.workspaceKind === 'account-provisioned' ? { workspaceKind: 'account-provisioned' } : {}),
  };
}

export function demoDescriptor() {
  return {
    id: 'demo',
    type: 'demo',
    authUserId: null,
    databaseName: DEMO_WORKSPACE_DB_NAME,
    ownershipState: 'demo',
    syncEligible: false,
    broadcastChannelName: 'rakeezx-data:demo',
  };
}

function legacyDescriptor() {
  return {
    id: 'legacy',
    type: 'legacy',
    authUserId: null,
    databaseName: LEGACY_WORKSPACE_DB_NAME,
    ownershipState: 'unclaimed',
    syncEligible: false,
    broadcastChannelName: LEGACY_BROADCAST_CHANNEL_NAME,
  };
}

function openRegistry(indexedDBFactory) {
  if (!indexedDBFactory?.open) {
    throw Object.assign(new Error('IndexedDB is unavailable'), { code: 'WORKSPACE_REGISTRY_UNAVAILABLE' });
  }
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(WORKSPACE_REGISTRY_DB_NAME, WORKSPACE_REGISTRY_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKSPACE_REGISTRY_STORE)) {
        const store = database.createObjectStore(WORKSPACE_REGISTRY_STORE, { keyPath: 'id' });
        store.createIndex('authUserId', 'authUserId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Object.assign(new Error('Workspace registry upgrade is blocked'), {
      code: 'WORKSPACE_REGISTRY_BLOCKED',
    }));
  });
}

export function createWorkspaceRegistry({ indexedDBFactory = globalThis.indexedDB, now = () => Date.now() } = {}) {
  let databasePromise = null;
  const database = () => (databasePromise ??= openRegistry(indexedDBFactory));

  async function read(id) {
    const db = await database();
    return requestResult(db.transaction(WORKSPACE_REGISTRY_STORE, 'readonly')
      .objectStore(WORKSPACE_REGISTRY_STORE).get(id));
  }

  async function findByAuthUserId(authUserId) {
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readonly');
    return requestResult(tx.objectStore(WORKSPACE_REGISTRY_STORE).index('authUserId').getAll(authUserId));
  }

  async function list() {
    const db = await database();
    return requestResult(db.transaction(WORKSPACE_REGISTRY_STORE, 'readonly')
      .objectStore(WORKSPACE_REGISTRY_STORE).getAll());
  }

  async function write(record) {
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    tx.objectStore(WORKSPACE_REGISTRY_STORE).put(record);
    await committed;
    return record;
  }

  async function remove(id) {
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    tx.objectStore(WORKSPACE_REGISTRY_STORE).delete(id);
    await committed;
  }

  function assertExistingRecord(existing, expected) {
    if (!existing) return;
    const matches = Object.entries(expected).every(([key, value]) => existing[key] === value);
    if (!matches) {
      throw Object.assign(new Error('Existing workspace registration does not match the requested workspace'), {
        code: 'WORKSPACE_REGISTRY_MISMATCH',
      });
    }
  }

  async function recordLegacyPresence() {
    const existing = await read('legacy');
    assertExistingRecord(existing, {
      id: 'legacy', type: 'legacy', authUserId: null,
      databaseName: LEGACY_WORKSPACE_DB_NAME, ownershipState: 'unclaimed',
    });
    const stamp = now();
    return write({
      id: 'legacy', type: 'legacy', authUserId: null,
      databaseName: LEGACY_WORKSPACE_DB_NAME, ownershipState: 'unclaimed',
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    });
  }

  async function registerAccount(authUserId, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const existingForOwner = await findByAuthUserId(normalized);
    if (existingForOwner.some((record) => record.id !== id)) {
      throw Object.assign(new Error('Auth user has ambiguous workspace registrations'), {
        code: 'AMBIGUOUS_ACCOUNT_WORKSPACE',
      });
    }
    const existing = await read(id);
    assertExistingRecord(existing, {
      id, type: 'account', authUserId: normalized,
      databaseName: `rakeezx-user-${key}`, ownershipState: 'claimed',
    });
    const stamp = now();
    return write({
      id, type: 'account', authUserId: normalized,
      databaseName: `rakeezx-user-${key}`, ownershipState: 'claimed',
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    });
  }

  async function registerProvisionedAccount(authUserId, receipt, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    if (receipt?.ownerId !== normalized || receipt?.contractVersion !== 1 ||
        typeof receipt?.foundationHash !== 'string' || !receipt.foundationHash) {
      throw Object.assign(new Error('Invalid owner-bound provisioning receipt'), { code: 'INVALID_ACCOUNT_PROVISIONING_RECEIPT' });
    }
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const databaseName = `rakeezx-user-${key}`;
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const records = await requestResult(store.getAll());
    if (records.some((record) => record.authUserId === normalized && record.id !== id) ||
        records.some((record) => record.databaseName === databaseName && record.authUserId !== normalized)) {
      tx.abort(); await committed.catch(() => {});
      throw Object.assign(new Error('Conflicting account workspace registration'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    }
    const existing = records.find((record) => record.id === id);
    if (existing && (existing.type !== 'account' || existing.authUserId !== normalized ||
        existing.databaseName !== databaseName || existing.workspaceKind !== 'account-provisioned' ||
        !['provisioning', 'claimed'].includes(existing.ownershipState) ||
        (existing.ownershipState === 'claimed' &&
          (existing.provisioningReceipt?.ownerId !== normalized ||
           existing.provisioningReceipt?.foundationHash !== receipt.foundationHash ||
           existing.provisioningReceipt?.contractVersion !== 1)))) {
      tx.abort(); await committed.catch(() => {});
      throw Object.assign(new Error('Existing account workspace does not match provisioning evidence'), {
        code: 'WORKSPACE_REGISTRY_MISMATCH',
      });
    }
    const stamp = now();
    const record = { id, type: 'account', authUserId: normalized, databaseName,
      ownershipState: 'claimed', workspaceKind: 'account-provisioned',
      provisioningReceipt: { ownerId: normalized, contractVersion: 1, foundationHash: receipt.foundationHash },
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp };
    store.put(record);
    await committed;
    return record;
  }

  async function beginAccountProvisioning(authUserId, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const databaseName = `rakeezx-user-${key}`;
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const records = await requestResult(store.getAll());
    if (records.some((record) => record.authUserId === normalized && record.id !== id)) {
      tx.abort(); await committed.catch(() => {});
      throw Object.assign(new Error('Ambiguous account workspace'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    }
    const existing = records.find((record) => record.id === id);
    if (existing && (existing.type !== 'account' || existing.authUserId !== normalized ||
        existing.databaseName !== databaseName || existing.ownershipState !== 'provisioning' ||
        existing.workspaceKind !== 'account-provisioned')) {
      tx.abort(); await committed.catch(() => {});
      throw Object.assign(new Error('Account workspace is not a pending provision'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    }
    if (!existing) {
      const stamp = now();
      store.put({ id, type: 'account', authUserId: normalized, databaseName,
        ownershipState: 'provisioning', workspaceKind: 'account-provisioned',
        createdAt: stamp, updatedAt: stamp });
    }
    await committed;
    return existing ?? read(id);
  }

  async function beginAccountRestore(authUserId, checkpoint, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const databaseName = `rakeezx-user-${key}`;
    const recovery = options.recoveryRecord;
    if (recovery) {
      const presence = await detectWorkspaceDatabase(databaseName, { indexedDBFactory });
      const receipt = recovery.restoreReceipt;
      const provisioning = recovery.provisioningReceipt;
      const validEvidence = recovery.workspaceKind === 'account-provisioned'
        ? provisioning?.ownerId === normalized && provisioning?.contractVersion === 1 &&
          typeof provisioning?.foundationHash === 'string' && !!provisioning.foundationHash
        : validRestoreReceipt({ ...receipt, ownerId: receipt?.ownerId ?? normalized }, normalized);
      if (presence.status !== 'known' || presence.exists || !validEvidence ||
          recovery.type !== 'account' || recovery.authUserId !== normalized || recovery.id !== id ||
          recovery.databaseName !== databaseName || recovery.ownershipState !== 'claimed') {
        throw Object.assign(new Error('Missing storage recovery evidence is invalid'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
      }
    }
    if (!checkpoint || !['CORE_V1', 'CORE_V2'].includes(checkpoint.protocol) || typeof checkpoint.restoreId !== 'string' ||
        !checkpoint.restoreId || typeof checkpoint.manifestHash !== 'string' || !checkpoint.manifestHash) {
      throw Object.assign(new Error('Invalid Initial Restore checkpoint'), { code: 'INVALID_INITIAL_RESTORE_CHECKPOINT' });
    }
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const records = await requestResult(store.getAll());
    if (records.some((record) => (record.authUserId === normalized || record.databaseName === databaseName) && record.id !== id)) {
      tx.abort();
      await committed.catch(() => {});
      throw Object.assign(new Error('Auth user has ambiguous workspace registrations'), { code: 'AMBIGUOUS_ACCOUNT_WORKSPACE' });
    }
    const existing = records.find((record) => record.id === id);
    if (recovery && JSON.stringify(existing) !== JSON.stringify(recovery)) {
      tx.abort(); await committed.catch(() => {});
      throw Object.assign(new Error('Recovery registry changed'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    }
    if (existing?.ownershipState === 'claimed' && !recovery) {
      tx.abort();
      await committed.catch(() => {});
      throw Object.assign(new Error('Account workspace is already ready'), { code: 'WORKSPACE_ALREADY_READY' });
    }
    if (existing && !recovery && (existing.type !== 'account' || existing.authUserId !== normalized ||
        existing.databaseName !== databaseName || existing.ownershipState !== 'restoring' ||
        existing.restore?.restoreId !== checkpoint.restoreId ||
        existing.restore?.protocol !== checkpoint.protocol)) {
      tx.abort();
      await committed.catch(() => {});
      throw Object.assign(new Error('Pending restore belongs to different evidence'), {
        code: 'WORKSPACE_REGISTRY_MISMATCH',
      });
    }
    const stamp = now();
    const record = {
      id, type: 'account', authUserId: normalized, databaseName,
      ownershipState: 'restoring', workspaceKind: 'account-initial-restore',
      ...(recovery || existing?.recoveryEvidence ? { recoveryEvidence: recovery ?? existing.recoveryEvidence } : {}),
      restore: {
        protocol: checkpoint.protocol, restoreId: checkpoint.restoreId,
        manifestHash: checkpoint.manifestHash,
        phase: checkpoint.phase ?? 'RESTORE_PREFLIGHT',
        createdAt: existing?.restore?.createdAt ?? stamp, updatedAt: stamp,
      },
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    };
    store.put(record);
    await committed;
    return record;
  }

  async function updateAccountRestore(authUserId, restoreId, update, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const existing = await requestResult(store.get(id));
    if (!existing || existing.type !== 'account' || existing.authUserId !== normalized ||
        existing.databaseName !== `rakeezx-user-${key}` || existing.ownershipState !== 'restoring' ||
        existing.restore?.restoreId !== restoreId ||
        !['CORE_V1', 'CORE_V2'].includes(existing.restore?.protocol)) {
      tx.abort();
      await committed.catch(() => {});
      throw Object.assign(new Error('Initial Restore checkpoint mismatch'), { code: 'WORKSPACE_REGISTRY_MISMATCH' });
    }
    const stamp = now();
    const record = {
      ...existing, restore: { ...existing.restore, ...update, restoreId,
        protocol: existing.restore.protocol, updatedAt: stamp },
      updatedAt: stamp,
    };
    store.put(record);
    await committed;
    return record;
  }

  async function finalizeAccountRestore(authUserId, receipt, options = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const existing = await requestResult(store.get(id));
    if (!existing || existing.type !== 'account' || existing.authUserId !== normalized ||
        existing.databaseName !== `rakeezx-user-${key}` || existing.ownershipState !== 'restoring' ||
        !['CORE_V1', 'CORE_V2'].includes(existing.restore?.protocol) ||
        existing.restore?.protocol !== receipt?.protocol || existing.restore?.restoreId !== receipt?.restoreId ||
        existing.restore?.manifestHash !== receipt?.manifestHash || receipt?.ownerId !== normalized ||
        !['CORE_V1', 'CORE_V2'].includes(receipt?.protocol)) {
      tx.abort();
      await committed.catch(() => {});
      throw Object.assign(new Error('Initial Restore receipt does not match pending workspace'), {
        code: 'WORKSPACE_REGISTRY_MISMATCH',
      });
    }
    const stamp = now();
    const record = {
      id, type: 'account', authUserId: normalized,
      databaseName: `rakeezx-user-${key}`, ownershipState: 'claimed',
      ...(existing.recoveryEvidence ? { recoveryEvidence: existing.recoveryEvidence } : {}),
      restoreReceipt: {
        protocol: receipt.protocol, restoreId: receipt.restoreId,
        manifestHash: receipt.manifestHash, completedAt: receipt.completedAt,
      },
      createdAt: existing.createdAt ?? stamp, updatedAt: stamp,
    };
    store.put(record);
    await committed;
    return record;
  }

  async function registerLegacyClaim(authUserId, { claimId, evidenceHash, ...options } = {}) {
    const normalized = normalizeAuthUserId(authUserId);
    if (typeof claimId !== 'string' || !claimId) {
      throw Object.assign(new Error('A durable legacy claim ID is required'), { code: 'INVALID_WORKSPACE_CLAIM' });
    }
    const key = await accountWorkspaceKey(normalized, options);
    const id = accountRecordId(key);
    const db = await database();
    const tx = db.transaction(WORKSPACE_REGISTRY_STORE, 'readwrite');
    const committed = transactionDone(tx);
    const store = tx.objectStore(WORKSPACE_REGISTRY_STORE);
    const records = await requestResult(store.getAll());
    const conflicting = records.find((record) =>
      record.databaseName === LEGACY_WORKSPACE_DB_NAME && record.ownershipState === 'claimed' &&
      (record.authUserId !== normalized || record.claimId !== claimId));
    if (conflicting) {
      throw Object.assign(new Error('The legacy workspace is already registered to another claim'), {
        code: 'WORKSPACE_REGISTRY_MISMATCH',
      });
    }
    const existingForOwner = records.filter((record) => record.authUserId === normalized);
    if (existingForOwner.some((record) => record.id !== id)) {
      throw Object.assign(new Error('Auth user has ambiguous workspace registrations'), {
        code: 'AMBIGUOUS_ACCOUNT_WORKSPACE',
      });
    }
    const existing = records.find((record) => record.id === id);
    assertExistingRecord(existing, {
      id, type: 'account', authUserId: normalized,
      databaseName: LEGACY_WORKSPACE_DB_NAME, ownershipState: 'claimed',
      workspaceKind: 'legacy-in-place', claimId,
    });
    const stamp = now();
    const record = {
      id, type: 'account', authUserId: normalized,
      databaseName: LEGACY_WORKSPACE_DB_NAME, ownershipState: 'claimed',
      workspaceKind: 'legacy-in-place', claimId,
      evidenceHash: evidenceHash ?? existing?.evidenceHash ?? null,
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    };
    store.put(record);
    await committed;
    return record;
  }

  async function registerDemo() {
    const existing = await read('demo');
    assertExistingRecord(existing, {
      id: 'demo', type: 'demo', authUserId: null,
      databaseName: DEMO_WORKSPACE_DB_NAME, ownershipState: 'demo',
    });
    const stamp = now();
    return write({
      id: 'demo', type: 'demo', authUserId: null,
      databaseName: DEMO_WORKSPACE_DB_NAME, ownershipState: 'demo',
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    });
  }

  async function unregisterDemo() {
    await remove('demo');
  }

  async function close() {
    if (!databasePromise) return;
    (await databasePromise).close();
    databasePromise = null;
  }

  return Object.freeze({
    read, list, findByAuthUserId, recordLegacyPresence,
    registerAccount, beginAccountProvisioning, registerProvisionedAccount,
    beginAccountRestore, updateAccountRestore, finalizeAccountRestore,
    registerLegacyClaim, registerDemo, unregisterDemo, close,
  });
}

export async function resolveWorkspace(request, {
  registry = createWorkspaceRegistry(),
  cryptoProvider = globalThis.crypto,
} = {}) {
  const type = request?.type;
  if (type === 'demo') return resolved(demoDescriptor());

  if (type === 'legacy') {
    if (request?.legacyDetected !== true) return unresolved('legacy-presence-unconfirmed');
    const record = await registry.read('legacy');
    if (record && (record.type !== 'legacy' || record.databaseName !== LEGACY_WORKSPACE_DB_NAME ||
        record.ownershipState !== 'unclaimed' || record.authUserId != null)) {
      return unresolved('legacy-registry-mismatch');
    }
    return resolved(legacyDescriptor());
  }

  if (type !== 'account') return unresolved('unknown-workspace-request');

  let authUserId;
  let key;
  try {
    authUserId = normalizeAuthUserId(request?.authUserId);
    key = await accountWorkspaceKey(authUserId, { cryptoProvider });
  } catch (error) {
    return unresolved(error?.code === 'INVALID_AUTH_USER_ID' ? 'invalid-auth-user-id' : 'workspace-key-unavailable');
  }

  const matches = await registry.findByAuthUserId(authUserId);
  if (matches.length > 1) return unresolved('ambiguous-account-workspace');
  if (!matches.length) {
    return unresolved(request?.legacyDetected === true
      ? 'legacy-workspace-unclaimed'
      : 'account-workspace-not-registered');
  }

  const record = matches[0];
  const expectedId = accountRecordId(key);
  const expectedDatabaseName = record.workspaceKind === 'legacy-in-place'
    ? LEGACY_WORKSPACE_DB_NAME
    : `rakeezx-user-${key}`;
  if (record.id !== expectedId || record.type !== 'account' || record.authUserId !== authUserId ||
      record.databaseName !== expectedDatabaseName || record.ownershipState !== 'claimed' ||
      (record.workspaceKind === 'legacy-in-place' && (typeof record.claimId !== 'string' || !record.claimId))) {
    return unresolved('account-registry-mismatch');
  }
  return resolved(accountDescriptor(record, key));
}

export function openWorkspaceBroadcastChannel(workspace, BroadcastChannelImpl = globalThis.BroadcastChannel) {
  if (!workspace?.broadcastChannelName || typeof BroadcastChannelImpl !== 'function') {
    throw Object.assign(new Error('A resolved workspace and BroadcastChannel are required'), {
      code: 'INVALID_WORKSPACE_CHANNEL',
    });
  }
  return new BroadcastChannelImpl(workspace.broadcastChannelName);
}

export async function detectWorkspaceDatabase(databaseName, {
  indexedDBFactory = globalThis.indexedDB,
} = {}) {
  if (!databaseName) return Object.freeze({ status: 'unknown', exists: null });
  if (typeof indexedDBFactory?.databases !== 'function') {
    return Object.freeze({ status: 'unknown', exists: null });
  }
  const databases = await indexedDBFactory.databases();
  return Object.freeze({ status: 'known', exists: databases.some((entry) => entry?.name === databaseName) });
}
