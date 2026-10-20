import * as cloudDefault from './cloud.js';
import * as databaseDefault from './db.js';
import { decodeSyncV2Canonical } from './sync-v2.js';
import { normalizeAccountContract } from './account-profile.js';
import { accountWorkspaceDatabaseName, createWorkspaceRegistry, normalizeAuthUserId, detectWorkspaceDatabase } from './workspaces.js';
import { readAccountProvisioningMetadata } from './workspace-routing.js';
import { calendarPresetRecords, getCalendarPreset } from './calendar-presets.js';
import { initialDepartmentCalendarPreset } from './education-department-directory.js';
import { DEFAULT_TIME_PROFILES, makeDevice, makeSubject, makeTimeProfile } from '../models.js';

export const ACCOUNT_PROVISIONING_VERSION = 1;
export const FOUNDATION_STORES = Object.freeze([
  'profile', 'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'timeProfiles',
]);
const SERVER_ENTITY = Object.freeze({ profile: 'profile', years: 'years', calendars: 'calendars',
  calendarDays: 'calendar_days', terms: 'terms', subjects: 'subjects', timeProfiles: 'time_profiles' });

function fail(code, message) { return Object.assign(new Error(message), { code }); }

export function buildAccountFoundationDefaults(presetId) {
  const preset = calendarPresetRecords(getCalendarPreset(presetId));
  return Object.freeze({
    years: [preset.year], calendars: [preset.calendar], terms: preset.terms,
    calendarDays: preset.calendarDays,
    subjects: [makeSubject({ name: 'المهارات الرقمية' })],
    timeProfiles: DEFAULT_TIME_PROFILES.map((profile, order) => makeTimeProfile({ ...profile, order })),
  });
}

export function decodeAccountFoundationSnapshot(raw, ownerId) {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).sort().join('|') !==
      Object.values(SERVER_ENTITY).sort().join('|')) {
    throw fail('ACCOUNT_PROVISIONING_SNAPSHOT_INVALID', 'Foundation stores do not match the server contract');
  }
  const expected = { profile: 1, years: 1, calendars: 1, terms: 2, subjects: 1, timeProfiles: 4 };
  const result = {};
  for (const store of FOUNDATION_STORES) {
    const rows = raw[SERVER_ENTITY[store]];
    if (!Array.isArray(rows) || (expected[store] != null && rows.length !== expected[store]) ||
        (store === 'calendarDays' && rows.length < 1)) {
      throw fail('ACCOUNT_PROVISIONING_SNAPSHOT_INVALID', 'Foundation row count is invalid');
    }
    if (rows.some((row) => row?.owner_id !== ownerId || row?.deleted_at != null)) {
      throw fail('ACCOUNT_PROVISIONING_OWNER_MISMATCH', 'Foundation row belongs to another owner');
    }
    result[store] = rows.map((row) => decodeSyncV2Canonical(store, row));
  }
  return result;
}

/** Server checkpoint comes first; local import is atomic and never replaces an existing workspace. */
export async function runAccountProvisioning({ expectedOwnerId, api = cloudDefault,
  database = databaseDefault, registry = createWorkspaceRegistry(),
  indexedDBFactory = globalThis.indexedDB, cryptoProvider = globalThis.crypto,
  onState = () => {}, signal,
} = {}) {
  const ownerId = normalizeAuthUserId(expectedOwnerId);
  const assertOwner = () => {
    if (signal?.aborted || api.user?.id !== ownerId) throw fail('ACCOUNT_PROVISIONING_OWNER_MISMATCH', 'Active account changed or preparation cancelled');
  };
  if (globalThis.navigator?.onLine === false) throw fail('ACCOUNT_PROVISIONING_REQUIRES_ONLINE', 'Provisioning requires a connection');
  const verified = await api.verifyCurrentAuthIdentity(ownerId);
  if (verified?.id !== ownerId || api.user?.id !== ownerId) {
    throw fail('ACCOUNT_PROVISIONING_OWNER_MISMATCH', 'Verified account changed');
  }
  let contract = normalizeAccountContract(await api.getAccountContract(), api.user);
  if (!contract.provisioning && contract.profileStatus !== 'READY') {
    contract = normalizeAccountContract(await api.provisionAccountProfile(), api.user);
  }
  assertOwner();
  if (!contract.provisioning) return Object.freeze({ status: 'not_applicable', contract });
  if (!contract.access) throw fail('ACCOUNT_ACCESS_REQUIRED', 'Beta access is not active');
  if (contract.profileStatus !== 'READY' || contract.provisioning.state === 'PROFILE_REQUIRED') {
    onState('PROFILE_REQUIRED');
    return Object.freeze({ status: 'profile_required', contract });
  }
  if (contract.provisioning.version !== ACCOUNT_PROVISIONING_VERSION) {
    throw fail('ACCOUNT_PROVISIONING_VERSION_UNSUPPORTED', 'Provisioning contract is unsupported');
  }
  const registrations = await registry.findByAuthUserId(ownerId);
  const name = await accountWorkspaceDatabaseName(ownerId, { cryptoProvider });
  const presence = await detectWorkspaceDatabase(name, { indexedDBFactory });
  if (presence.status !== 'known') throw fail('WORKSPACE_REGISTRY_MISMATCH', 'Local storage presence is unknown');
  if (registrations.length === 1 && registrations[0].workspaceKind !== 'account-provisioned' &&
      ['claimed', 'restoring'].includes(registrations[0].ownershipState) &&
      registrations[0].type === 'account' && registrations[0].databaseName === name &&
      contract.provisioning.state === 'READY') {
    return Object.freeze({ status: 'not_applicable', contract });
  }
  if (registrations.length > 1 || (registrations[0] &&
      (registrations[0].workspaceKind !== 'account-provisioned' ||
       !['provisioning', 'claimed'].includes(registrations[0].ownershipState)))) {
    throw fail('WORKSPACE_REGISTRY_MISMATCH', 'Existing workspace cannot be reprovisioned');
  }
  if (registrations[0]?.ownershipState === 'claimed') {
    if (registrations[0].databaseName !== name || registrations[0].provisioningReceipt?.ownerId !== ownerId ||
        registrations[0].provisioningReceipt?.contractVersion !== 1) {
      throw fail('ACCOUNT_PROVISIONING_RECEIPT_MISMATCH', 'Claimed owner evidence is invalid');
    }
    if (registrations[0].provisioningReceipt?.foundationHash !== contract.provisioning.foundationHash) {
      throw fail('ACCOUNT_PROVISIONING_RECEIPT_MISMATCH', 'Claimed workspace does not match server readiness');
    }
    if (contract.provisioning.state === 'PROVISIONING') {
      onState('PROVISIONING');
      await api.beginAccountProvisioning();
      const repaired = normalizeAccountContract((await api.provisionAccountWorkspace(
        buildAccountFoundationDefaults()))?.contract, api.user);
      if (repaired.provisioning?.state !== 'READY' ||
          repaired.provisioning.foundationHash !== registrations[0].provisioningReceipt.foundationHash) {
        throw fail('ACCOUNT_PROVISIONING_RECEIPT_MISMATCH', 'Server foundation repair did not preserve the owner receipt');
      }
      contract = repaired;
    }
    if (contract.provisioning.state !== 'READY') {
      throw fail('ACCOUNT_PROVISIONING_NOT_READY', 'Server foundation is incomplete');
    }
    // A mature cloud account with missing local storage needs the full restore,
    // never a foundation-only reimport or an unconditional READY reload loop.
    if (!presence.exists) return Object.freeze({ status: 'not_applicable', contract });
    return Object.freeze({ status: 'ready', contract, receipt: registrations[0].provisioningReceipt,
      workspaceDatabaseName: registrations[0].databaseName });
  }
  // A different, newly opened device must use ordinary Initial Restore, never
  // import only foundation rows over a potentially mature cloud workspace.
  if (contract.provisioning.state === 'READY' && !registrations.length) {
    if (presence.exists) {
      const { receipt } = await readAccountProvisioningMetadata(name, { indexedDBFactory, databasePresence: presence });
      if (receipt) {
        if (receipt.ownerId !== ownerId || receipt.contractVersion !== 1 ||
            !receipt.foundationHash || receipt.foundationHash !== contract.provisioning.foundationHash) {
          throw fail('ACCOUNT_PROVISIONING_RECEIPT_MISMATCH', 'Unregistered provisioning receipt is invalid');
        }
        assertOwner();
        await registry.beginAccountProvisioning(ownerId, { cryptoProvider });
        await registry.registerProvisionedAccount(ownerId, receipt, { cryptoProvider });
        return Object.freeze({ status: 'ready', contract, receipt, workspaceDatabaseName: name });
      }
    }
    return Object.freeze({ status: 'not_applicable', contract });
  }
  // Only a server-confirmed initial setup may choose a preset. READY restores
  // and receipt repairs above retain their existing calendar, even if profile
  // metadata was subsequently edited in Settings.
  const initialPresetId = initialDepartmentCalendarPreset(contract.profile.educationDepartment);
  if (contract.provisioning.state !== 'READY' && !initialPresetId) {
    onState('PROFILE_REQUIRED');
    return Object.freeze({ status: 'profile_required', contract });
  }
  assertOwner();
  if (!registrations.length) {
    if (presence.exists) throw fail('WORKSPACE_REGISTRY_MISMATCH', 'Unregistered storage cannot be provisioned');
    await registry.beginAccountProvisioning(ownerId, { cryptoProvider });
  }
  onState('PROVISIONING');
  const begun = normalizeAccountContract(await api.beginAccountProvisioning(), api.user);
  assertOwner();
  if (!['PROVISIONING', 'READY'].includes(begun.provisioning?.state)) {
    throw fail('ACCOUNT_PROVISIONING_NOT_READY', 'Server did not accept provisioning');
  }
  if (begun.provisioning?.state !== 'READY' && begun.profile.educationDepartment !== contract.profile.educationDepartment) {
    throw fail('ACCOUNT_PROVISIONING_PROFILE_CHANGED', 'Initial department changed; retry from the account checkpoint');
  }
  const result = await api.provisionAccountWorkspace(buildAccountFoundationDefaults(initialPresetId));
  assertOwner();
  contract = normalizeAccountContract(result?.contract, api.user);
  if (contract.provisioning?.state !== 'READY' ||
      contract.provisioning.version !== ACCOUNT_PROVISIONING_VERSION ||
      !contract.provisioning.foundationHash) {
    throw fail('ACCOUNT_PROVISIONING_NOT_READY', 'Server foundation was not verified');
  }
  const snapshot = decodeAccountFoundationSnapshot(result.snapshot, ownerId);
  const receipt = Object.freeze({ ownerId, contractVersion: ACCOUNT_PROVISIONING_VERSION,
    foundationHash: contract.provisioning.foundationHash });
  assertOwner();
  database.selectDatabase(name);
  const device = makeDevice({ deviceId: cryptoProvider?.randomUUID?.(), schemaVersion: database.DB_VERSION,
    accountProvisioningReceipt: receipt });
  await database.importAccountProvisioningSnapshot(snapshot, device, { assertAccess: assertOwner });
  assertOwner();
  await registry.registerProvisionedAccount(ownerId, receipt, { cryptoProvider });
  onState('READY');
  return Object.freeze({ status: 'ready', contract, receipt, workspaceDatabaseName: name });
}
