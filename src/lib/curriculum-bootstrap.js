import * as cloud from './cloud.js';

export const CURRICULUM_BOOTSTRAP_VERSION = 1;
export const CURRICULUM_STORES = Object.freeze(['units', 'lessons']);
export const CURRICULUM_BOOTSTRAP_STATES = Object.freeze([
  'NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'CONFLICT', 'FAILED',
]);

let ordinarySyncAccess = Object.freeze({ allowed: false, ownerId: null, bootstrapId: null });

const clone = (value) => value == null ? value : structuredClone(value);
const isCurriculumStore = (storeName) => CURRICULUM_STORES.includes(storeName);
const byId = (left, right) => left.id.localeCompare(right.id);

function assertedText(value, name) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 240) throw Object.assign(new Error(`Invalid curriculum ${name}`), {
    code: 'CURRICULUM_BOOTSTRAP_INVALID',
  });
  return text;
}

function assertedInteger(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw Object.assign(new Error(`Invalid curriculum ${name}`), { code: 'CURRICULUM_BOOTSTRAP_INVALID' });
  }
  return number;
}

function normalizeUnit(record) {
  return {
    id: assertedText(record?.id, 'unit id'),
    subject_id: assertedText(record?.subjectId ?? record?.subject_id, 'subject'),
    grade: assertedInteger(record?.grade, 'grade', { min: 1, max: 12 }),
    term_index: assertedInteger(record?.termIndex ?? record?.term_index, 'term', { min: 1, max: 6 }),
    name: String(record?.name ?? '').trim(),
    order: assertedInteger(record?.order ?? 0, 'order'),
    planned_sessions: assertedInteger(record?.plannedSessions ?? record?.planned_sessions ?? 0, 'planned sessions'),
    deleted: record?.deleted === true,
    client_updated_at: Number.isSafeInteger(Number(record?.updatedAt ?? record?.client_updated_at))
      ? Number(record?.updatedAt ?? record?.client_updated_at) : null,
  };
}

function normalizeLesson(record) {
  return {
    id: assertedText(record?.id, 'lesson id'),
    unit_id: assertedText(record?.unitId ?? record?.unit_id, 'unit'),
    name: String(record?.name ?? '').trim(),
    order: assertedInteger(record?.order ?? 0, 'order'),
    planned_sessions: assertedInteger(record?.plannedSessions ?? record?.planned_sessions ?? 1, 'planned sessions'),
    deleted: record?.deleted === true,
    client_updated_at: Number.isSafeInteger(Number(record?.updatedAt ?? record?.client_updated_at))
      ? Number(record?.updatedAt ?? record?.client_updated_at) : null,
  };
}

function assertUnique(records, entity) {
  if (new Set(records.map((record) => record.id)).size !== records.length) {
    throw Object.assign(new Error(`Duplicate curriculum ${entity} id`), { code: 'CURRICULUM_BOOTSTRAP_INVALID' });
  }
}

export function normalizedCurriculumSnapshot({ units = [], lessons = [] } = {}) {
  const normalized = {
    version: CURRICULUM_BOOTSTRAP_VERSION,
    units: units.map(normalizeUnit).sort(byId),
    lessons: lessons.map(normalizeLesson).sort(byId),
  };
  assertUnique(normalized.units, 'unit');
  assertUnique(normalized.lessons, 'lesson');
  const unitIds = new Set(normalized.units.map((record) => record.id));
  for (const lesson of normalized.lessons) {
    if (!unitIds.has(lesson.unit_id)) {
      throw Object.assign(new Error('Curriculum lesson references a missing local unit'), {
        code: 'CURRICULUM_BOOTSTRAP_REFERENCE_INVALID', lessonId: lesson.id,
      });
    }
  }
  return normalized;
}

export function stableCurriculumSnapshotJSON(snapshot) {
  const normalized = normalizedCurriculumSnapshot(snapshot);
  return JSON.stringify(normalized);
}

export async function curriculumSnapshotHash(snapshot, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle?.digest) {
    throw Object.assign(new Error('Web Crypto SHA-256 is required'), { code: 'CURRICULUM_BOOTSTRAP_CRYPTO_REQUIRED' });
  }
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(stableCurriculumSnapshotJSON(snapshot)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertEligible(workspace) {
  const ownerId = String(cloud.user?.id ?? '').trim().toLowerCase();
  if (!cloud.session || !ownerId) throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' });
  if (workspace?.type !== 'account' || workspace?.ownershipState !== 'claimed' || workspace?.syncEligible !== true ||
      String(workspace?.authUserId ?? '').trim().toLowerCase() !== ownerId) {
    throw Object.assign(new Error('A matching claimed workspace is required'), { code: 'CURRICULUM_BOOTSTRAP_NOT_ELIGIBLE' });
  }
  return ownerId;
}

export function isCurriculumOrdinarySyncAllowed(storeName) {
  return !isCurriculumStore(storeName) || ordinarySyncAccess.allowed === true;
}

export function curriculumOrdinarySyncAccess() {
  return ordinarySyncAccess;
}

export function resetCurriculumOrdinarySyncAccess() {
  ordinarySyncAccess = Object.freeze({ allowed: false, ownerId: null, bootstrapId: null });
}

export function initializeCurriculumSyncGate({ workspace, device } = {}) {
  resetCurriculumOrdinarySyncAccess();
  const marker = device?.curriculumSyncBootstrap;
  if (workspace?.type !== 'account' || workspace?.ownershipState !== 'claimed' || workspace?.syncEligible !== true) return ordinarySyncAccess;
  if (marker?.state !== 'COMPLETE' || marker?.reconciled !== true ||
      String(marker.ownerId ?? '').toLowerCase() !== String(workspace.authUserId ?? '').toLowerCase() ||
      !marker.bootstrapId) return ordinarySyncAccess;
  ordinarySyncAccess = Object.freeze({ allowed: true, ownerId: marker.ownerId, bootstrapId: marker.bootstrapId });
  return ordinarySyncAccess;
}

export async function readCurriculumBootstrapStatus({ workspace } = {}) {
  assertEligible(workspace);
  const status = await cloud.getCurriculumSyncBootstrapStatus();
  if (!status || !CURRICULUM_BOOTSTRAP_STATES.includes(status.state)) {
    throw Object.assign(new Error('Invalid curriculum bootstrap status'), { code: 'CURRICULUM_BOOTSTRAP_RESPONSE_INVALID' });
  }
  return clone(status);
}

export async function submitCurriculumBootstrap({
  workspace, deviceId, units, lessons, bootstrapId = globalThis.crypto?.randomUUID?.(),
  authoritative = false, backupVerified = false,
} = {}) {
  const ownerId = assertEligible(workspace);
  if (authoritative && backupVerified !== true) {
    throw Object.assign(new Error('A verified backup is required before curriculum bootstrap'), {
      code: 'CURRICULUM_BOOTSTRAP_BACKUP_REQUIRED',
    });
  }
  const normalized = normalizedCurriculumSnapshot({ units, lessons });
  const snapshotHash = await curriculumSnapshotHash(normalized);
  const envelope = {
    bootstrapId: assertedText(bootstrapId, 'bootstrap id'),
    deviceId: assertedText(deviceId, 'device id'),
    snapshotHash,
    units: normalized.units,
    lessons: normalized.lessons,
    authoritative: authoritative === true,
  };
  const result = await cloud.contributeCurriculumSyncBootstrap(envelope);
  if (!result || !CURRICULUM_BOOTSTRAP_STATES.includes(result.state)) {
    throw Object.assign(new Error('Invalid curriculum bootstrap contribution'), { code: 'CURRICULUM_BOOTSTRAP_RESPONSE_INVALID' });
  }
  return { ...clone(result), ownerId, snapshotHash, bootstrapId: envelope.bootstrapId };
}

export async function finalizeCurriculumBootstrap({ workspace, deviceId, bootstrapId, snapshotHash } = {}) {
  const ownerId = assertEligible(workspace);
  const result = await cloud.finalizeCurriculumSyncBootstrap({
    bootstrapId: assertedText(bootstrapId, 'bootstrap id'),
    deviceId: assertedText(deviceId, 'device id'),
    snapshotHash: assertedText(snapshotHash, 'snapshot hash'),
  });
  if (result?.state !== 'COMPLETE' || !Array.isArray(result.units) || !Array.isArray(result.lessons)) {
    throw Object.assign(new Error('Curriculum bootstrap did not complete'), {
      code: result?.state === 'CONFLICT' ? 'CURRICULUM_BOOTSTRAP_CONFLICT' : 'CURRICULUM_BOOTSTRAP_INCOMPLETE',
      result,
    });
  }
  return { ...clone(result), ownerId };
}
