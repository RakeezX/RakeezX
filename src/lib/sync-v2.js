/**
 * RAKEEZ X — Sync V2 client foundation.
 *
 * This module is intentionally isolated from the current Production V1 sync
 * coordinator.  It provides the durable mutation/reconciliation primitives
 * that V2C can wire into runtime store actions after the server cutover.
 */

import * as databaseDefault from './db.js';
import { applySyncV2Mutation, applySyncV2EnrollmentCommand, applySyncV2AttendanceCommand, applySyncV2LifecycleCommand, applySyncV2TeachingCreationCommand, applySyncV2FillAttendanceCommand, fetchRecords } from './cloud.js';
import { uid } from '../models.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => value == null ? value : structuredClone(value);

export const SYNC_V2_SCHEMAS = Object.freeze({
  profile: {
    entity: 'profile',
    fields: {
      teacherName: 'teacher_name', schoolName: 'school_name', phone: 'phone',
      reportPrincipalName: 'report_principal_name',
    },
  },
  years: {
    entity: 'years',
    fields: { label: 'label', hijriStart: 'hijri_start', hijriEnd: 'hijri_end', order: 'order', status: 'status' },
  },
  calendars: {
    entity: 'calendars',
    fields: { yearId: 'year_id', source: 'source', label: 'label' },
    references: { yearId: 'years' },
  },
  calendarDays: {
    entity: 'calendar_days',
    fields: { calendarId: 'calendar_id', date: 'date', kind: 'kind', label: 'label' },
    references: { calendarId: 'calendars' },
  },
  terms: {
    entity: 'terms',
    fields: { yearId: 'year_id', calendarId: 'calendar_id', index: 'index', name: 'name', startDate: 'start_date', endDate: 'end_date', status: 'status' },
    references: { yearId: 'years', calendarId: 'calendars' },
  },
  subjects: {
    entity: 'subjects',
    fields: { name: 'name', slug: 'slug' },
  },
  sections: {
    entity: 'sections',
    fields: { yearId: 'year_id', grade: 'grade', label: 'label', name: 'name', color: 'color', order: 'order' },
    references: { yearId: 'years' },
  },
  teachings: {
    entity: 'teachings',
    fields: { sectionId: 'section_id', subjectId: 'subject_id', termId: 'term_id', order: 'order' },
    references: { sectionId: 'sections', subjectId: 'subjects', termId: 'terms' },
  },
  students: {
    entity: 'students',
    fields: { name: 'name', note: 'note', status: 'status' },
  },
  enrollments: {
    entity: 'enrollments',
    fields: { studentId: 'student_id', sectionId: 'section_id', startDate: 'start_date', endDate: 'end_date', status: 'status', rollNo: 'roll_no', transferNote: 'transfer_note' },
    references: { studentId: 'students', sectionId: 'sections' },
  },
  notes: {
    entity: 'notes',
    fields: { studentId: 'student_id', teachingId: 'teaching_id', sessionId: 'session_id', text: 'text', date: 'date', kind: 'kind' },
    references: { studentId: 'students', teachingId: 'teachings', sessionId: 'sessions' },
  },
  items: {
    entity: 'items',
    fields: {
      teachingId: 'teaching_id', name: 'name', max: 'max',
      auto: 'auto', perPoint: 'per_point', penalty: 'penalty', unitId: 'unit_id', lessonId: 'lesson_id', order: 'order',
    },
    references: { teachingId: 'teachings' },
  },
  scores: {
    entity: 'scores',
    fields: { studentId: 'student_id', itemId: 'item_id', value: 'value' },
    references: { studentId: 'students', itemId: 'items' },
  },
  logs: {
    entity: 'logs',
    fields: { studentId: 'student_id', teachingId: 'teaching_id', sessionId: 'session_id', date: 'date', kind: 'kind', delta: 'delta', tag: 'tag', note: 'note' },
    references: { studentId: 'students', teachingId: 'teachings', sessionId: 'sessions' },
  },
  timeProfiles: {
    entity: 'time_profiles',
    fields: {
      name: 'name', order: 'order', periods: 'periods', overrides: 'overrides', activeFrom: 'active_from', activeTo: 'active_to',
    },
  },
  slots: {
    entity: 'slots',
    fields: { teachingId: 'teaching_id', weekday: 'weekday', period: 'period' },
    references: { teachingId: 'teachings' },
  },
  sessions: {
    entity: 'sessions',
    fields: {
      teachingId: 'teaching_id', slotId: 'slot_id', timeProfileId: 'time_profile_id', date: 'date',
      period: 'period', startTime: 'start_time', endTime: 'end_time', status: 'status',
      reason: 'reason', makeupForId: 'makeup_for_id', lessonId: 'lesson_id', note: 'note', homework: 'homework', covered: 'covered',
    },
    references: { teachingId: 'teachings', slotId: 'slots', timeProfileId: 'timeProfiles', makeupForId: 'sessions' },
  },
  sessionRosterSnapshots: {
    entity: 'session_roster_snapshots',
    fields: { sessionId: 'session_id', teachingId: 'teaching_id', sectionId: 'section_id', capturedAt: 'captured_at', members: 'members', state: 'state' },
    references: { sessionId: 'sessions', teachingId: 'teachings', sectionId: 'sections' },
  },
  attendance: {
    entity: 'attendance',
    fields: { studentId: 'student_id', sessionId: 'session_id', teachingId: 'teaching_id', date: 'date', status: 'status', note: 'note' },
    references: { studentId: 'students', sessionId: 'sessions', teachingId: 'teachings' },
  },
});

export const SYNC_V2_STORES = Object.freeze(Object.keys(SYNC_V2_SCHEMAS));

function schemaFor(store) {
  const schema = SYNC_V2_SCHEMAS[store];
  if (!schema) throw new Error(`Sync V2 does not support store: ${store}`);
  return schema;
}

function normalizeRevision(value) {
  const revision = Number(value ?? 0);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function encodeFieldValue(store, field, value) {
  if (store === 'sessionRosterSnapshots' && field === 'capturedAt' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (store === 'calendars' && field === 'source' && String(value ?? '').startsWith('preset:')) {
    return 'moe';
  }
  return clone(value);
}

function decodeFieldValue(store, field, value, row) {
  if (store === 'sessionRosterSnapshots' && field === 'capturedAt') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (store === 'calendars' && field === 'source' && value === 'moe') {
    const prefix = `cal:${row.year_id}:preset:`;
    if (String(row.id ?? '').startsWith(prefix)) return String(row.id).slice(`cal:${row.year_id}:`.length);
  }
  return clone(value);
}

export function encodeSyncV2Patch(store, localPatch = {}) {
  const schema = schemaFor(store);
  const patch = {};
  for (const [localField, serverField] of Object.entries(schema.fields)) {
    if (hasOwn(localPatch, localField)) patch[serverField] = encodeFieldValue(store, localField, localPatch[localField]);
  }
  if (store === 'profile' && !hasOwn(localPatch, 'reportPrincipalName') && hasOwn(localPatch, 'principalName')) {
    patch.report_principal_name = clone(localPatch.principalName);
  }
  return patch;
}

export function decodeSyncV2Canonical(store, row) {
  if (!row || typeof row !== 'object') return null;
  const schema = schemaFor(store);
  const record = { id: store === 'profile' ? 'profile' : row.id };
  for (const [localField, serverField] of Object.entries(schema.fields)) {
    if (hasOwn(row, serverField)) record[localField] = decodeFieldValue(store, localField, row[serverField], row);
  }
  if (store === 'profile') record.principalName = record.reportPrincipalName ?? '';
  record.canonicalId = record.id;
  record.serverRevision = normalizeRevision(row.revision);
  if (row.field_revisions && typeof row.field_revisions === 'object') record.fieldRevisions = clone(row.field_revisions);
  record.deleted = row.deleted_at != null;
  if (record.deleted) record.deletedAt = row.deleted_at;
  if (row.client_updated_at !== null && row.client_updated_at !== undefined) {
    const clientStamp = Number(row.client_updated_at);
    if (Number.isFinite(clientStamp)) record.updatedAt = clientStamp;
  }
  return record;
}

function mutationEnvelope(mutation) {
  return {
    entity: mutation.entity,
    recordId: mutation.serverRecordId,
    mutationId: mutation.mutationId,
    deviceId: mutation.deviceId,
    baseRevision: mutation.baseRevision,
    operation: mutation.op,
    patch: clone(mutation.patch ?? {}),
    clientUpdatedAt: mutation.clientUpdatedAt ?? null,
  };
}

function uniqueDependencies(dependencies) {
  const seen = new Set();
  return dependencies.filter((dependency) => {
    const key = [dependency.store, dependency.recordId, dependency.mutationId, dependency.requiresServerRevision].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mutationScope(store) {
  const references = SYNC_V2_SCHEMAS[store]?.references ?? {};
  return [...new Set([store, 'outbox', 'device', ...Object.values(references)])];
}

function inferredDependencies(store, record, current, supplied) {
  const dependencies = [...(supplied ?? [])];
  const references = SYNC_V2_SCHEMAS[store]?.references ?? {};
  for (const [field, parentStore] of Object.entries(references)) {
    const parentId = record[field];
    if (!parentId) continue;
    const parent = current[parentStore]?.find((candidate) => candidate.id === parentId) ?? null;
    if (!parent) {
      dependencies.push({ store: parentStore, recordId: parentId, requiresServerRevision: true });
      continue;
    }
    if (parent.deleted) throw new Error(`Sync V2 parent is deleted locally: ${parentStore}/${parentId}`);
    const parentPending = sortMutations(current.outbox).find((mutation) =>
      mutation.store === parentStore &&
      (mutation.recordId === parentId || mutation.serverRecordId === parentId) &&
      mutation.op === 'create'
    );
    if (normalizeRevision(parent.serverRevision) === 0 || parentPending) {
      dependencies.push({
        store: parentStore,
        recordId: parent.canonicalId ?? parentId,
        mutationId: parentPending?.mutationId,
        requiresServerRevision: true,
      });
    }
  }
  return uniqueDependencies(dependencies);
}

function sortMutations(rows) {
  return rows
    .filter((row) => row?.protocol === 'v2')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.id).localeCompare(String(b.id)));
}

function pendingForRecord(rows, store, ids, excludingId = null) {
  const accepted = new Set(ids.filter(Boolean));
  return sortMutations(rows).filter((mutation) =>
    mutation.id !== excludingId && mutation.store === store &&
    (accepted.has(mutation.recordId) || accepted.has(mutation.serverRecordId) || accepted.has(mutation.canonicalId))
  );
}

function overlayMutations(record, mutations, canonicalDeleted = false) {
  let next = { ...record };
  for (const mutation of mutations) {
    if (mutation.op === 'delete') {
      next.deleted = true;
      next.deletedAt = mutation.clientUpdatedAt ?? next.deletedAt;
      continue;
    }
    next = { ...next, ...clone(mutation.localPatch ?? {}) };
  }
  if (canonicalDeleted) next.deleted = true;
  return next;
}

function canonicalSnapshot(record) {
  if (!record) return null;
  const { serverCanonical, syncConflicts, ...snapshot } = record;
  return clone(snapshot);
}

function conflictDiagnostic(mutation, result, stamp) {
  const groups = (Array.isArray(result?.conflictedGroups) ? result.conflictedGroups : [])
    .filter((group) => group !== '__canonical__');
  if (!groups.length) return null;
  return {
    mutationId: mutation.mutationId,
    outcome: result.outcome ?? 'conflict',
    fields: [...(mutation.fields ?? [])],
    groups: [...groups],
    rejectedPatch: clone(mutation.patch ?? {}),
    canonicalRevision: normalizeRevision(result.resultRevision),
    recordedAt: stamp,
  };
}

function operationBatch() {
  return { put: [], remove: [] };
}

function pushUniquePut(batch, record) {
  const index = batch.put.findIndex((item) => item.id === record.id);
  if (index >= 0) batch.put[index] = record;
  else batch.put.push(record);
}

function rewriteReferenceRecord(store, record, targetStore, oldId, newId) {
  const references = SYNC_V2_SCHEMAS[store]?.references ?? {};
  let changed = false;
  const next = { ...record };
  for (const [field, parentStore] of Object.entries(references)) {
    if (parentStore === targetStore && next[field] === oldId) {
      next[field] = newId;
      changed = true;
    }
  }
  return changed ? next : record;
}

function rewriteMutationReferences(mutation, targetStore, oldId, newId) {
  if (mutation?.protocol !== 'v2') return mutation;
  let changed = false;
  const next = { ...mutation };
  const localPatch = { ...(mutation.localPatch ?? {}) };
  const serverPatch = { ...(mutation.patch ?? {}) };
  const references = SYNC_V2_SCHEMAS[mutation.store]?.references ?? {};

  // Enrollment commands carry their enrollment references inside the typed
  // command payload. Remap those exact fields only; never use a generic
  // string replacement on command data.
  if (targetStore === 'enrollments' && String(mutation.command ?? '').startsWith('enrollment:')) {
    for (const field of ['sourceEnrollmentId', 'destinationEnrollmentId']) {
      if (localPatch[field] === oldId) { localPatch[field] = newId; changed = true; }
      if (serverPatch[field] === oldId) { serverPatch[field] = newId; changed = true; }
    }
  }
  if (['attendance:record', 'attendance:fill'].includes(String(mutation.command ?? ''))) {
    const field = targetStore === 'sessions' ? 'sessionId' : targetStore === 'students' ? 'studentId' : null;
    if (field) {
      if (field === 'studentId' && String(mutation.command ?? '') === 'attendance:fill') {
        for (const patch of [localPatch, serverPatch]) {
          if (Array.isArray(patch.studentIds) && patch.studentIds.includes(oldId)) {
            patch.studentIds = patch.studentIds.map((id) => id === oldId ? newId : id);
            changed = true;
          }
        }
      } else {
        if (localPatch[field] === oldId) { localPatch[field] = newId; changed = true; }
        if (serverPatch[field] === oldId) { serverPatch[field] = newId; changed = true; }
      }
    }
  }

  if (mutation.store === targetStore &&
      (mutation.recordId === oldId || mutation.serverRecordId === oldId || mutation.canonicalId === oldId)) {
    if (mutation.envelopeLocked) {
      return {
        ...mutation,
        state: 'blocked',
        blockedReason: 'canonical-id-remap-after-dispatch',
      };
    }
    next.recordId = newId;
    next.serverRecordId = newId;
    next.canonicalId = newId;
    next.logicalRecordKey = `${targetStore}:${newId}`;
    changed = true;
  }

  for (const [localField, parentStore] of Object.entries(references)) {
    if (parentStore !== targetStore) continue;
    const serverField = SYNC_V2_SCHEMAS[mutation.store].fields[localField];
    if (localPatch[localField] === oldId || serverPatch[serverField] === oldId) {
      if (mutation.envelopeLocked) {
        return {
          ...mutation,
          state: 'blocked',
          blockedReason: 'canonical-reference-remap-after-dispatch',
        };
      }
      if (localPatch[localField] === oldId) localPatch[localField] = newId;
      if (serverPatch[serverField] === oldId) serverPatch[serverField] = newId;
      changed = true;
    }
  }

  const dependencies = (mutation.dependencies ?? []).map((dependency) => {
    if (dependency.store === targetStore && dependency.recordId === oldId) {
      changed = true;
      return { ...dependency, recordId: newId };
    }
    return dependency;
  });

  return changed ? { ...next, localPatch, patch: serverPatch, dependencies } : mutation;
}

function defaultTransport() {
  return {
    applyMutation: applySyncV2Mutation,
    applyEnrollmentCommand: applySyncV2EnrollmentCommand,
    applyAttendanceCommand: applySyncV2AttendanceCommand,
    applyLifecycleCommand: applySyncV2LifecycleCommand,
    applyTeachingCreationCommand: applySyncV2TeachingCreationCommand,
    applyFillAttendanceCommand: applySyncV2FillAttendanceCommand,
    fetchRecords: (entity) => fetchRecords(entity),
  };
}

export function createSyncV2Engine({
  database = databaseDefault,
  transport = defaultTransport(),
  now = () => Date.now(),
  makeId = uid,
} = {}) {
  if (!database?.applyBatch || !database?.getAll) throw new Error('Sync V2 requires a transactional database adapter');

  async function ensureDeviceId() {
    let resolved;
    await database.applyBatch({ device: {} }, {
      prepare(current) {
        const existing = current.device.find((record) => record.id === 'device') ?? null;
        resolved = existing?.deviceId || makeId();
        if (existing?.deviceId) return { device: operationBatch() };
        return {
          device: {
            put: [{ ...(existing ?? {}), id: 'device', deviceId: resolved, updatedAt: now() }],
            remove: [],
          },
        };
      },
    });
    return resolved;
  }

  async function commitMutation({
    store, recordId, op, patch = {}, create = null, groups = [], dependencies = [], clientUpdatedAt,
  }) {
    schemaFor(store);
    if (!recordId || !['create', 'patch', 'delete'].includes(op)) throw new Error('Invalid Sync V2 local mutation');
    const mutationId = makeId();
    const stamp = clientUpdatedAt ?? now();
    let result;
    const scope = Object.fromEntries(mutationScope(store).map((name) => [name, {}]));

    await database.applyBatch(scope, {
      prepare(current) {
        const deviceRecord = current.device.find((record) => record.id === 'device') ?? null;
        const deviceId = deviceRecord?.deviceId || makeId();
        const existing = current[store].find((record) => record.id === recordId) ?? create ?? null;
        if (!existing && op !== 'create') throw new Error(`Sync V2 local record not found: ${store}/${recordId}`);

        const optimisticPatch = op === 'create' ? { ...(create ?? {}), ...patch } : { ...patch };
        let next = { ...(existing ?? {}), ...optimisticPatch, id: recordId, updatedAt: stamp };
        if (op === 'delete') next = { ...next, deleted: true, deletedAt: stamp };
        const canonicalId = existing?.canonicalId ?? recordId;
        next.canonicalId = canonicalId;
        next.serverRevision = normalizeRevision(existing?.serverRevision);

        const serverPatch = op === 'delete'
          ? {}
          : encodeSyncV2Patch(store, op === 'create' ? next : patch);
        const resolvedDependencies = op === 'delete'
          ? uniqueDependencies(dependencies)
          : inferredDependencies(store, next, current, dependencies);
        const sequence = sortMutations(current.outbox).reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1;
        const mutation = {
          id: `v2:${mutationId}`,
          protocol: 'v2',
          mutationId,
          deviceId,
          store,
          entity: schemaFor(store).entity,
          recordId,
          serverRecordId: canonicalId,
          canonicalId,
          logicalRecordKey: `${store}:${canonicalId}`,
          op,
          baseRevision: op === 'create' ? 0 : normalizeRevision(existing?.serverRevision),
          patch: clone(serverPatch),
          localPatch: clone(op === 'delete' ? {} : optimisticPatch),
          fields: Object.keys(serverPatch).sort(),
          groups: [...new Set(groups)].sort(),
          dependencies: clone(resolvedDependencies),
          sequence,
          clientUpdatedAt: stamp,
          queuedAt: stamp,
          state: 'pending',
          attemptCount: 0,
          envelopeLocked: false,
          lastError: null,
          blockedReason: null,
        };
        result = { record: next, mutation };
        return {
          [store]: { put: [next], remove: [] },
          outbox: { put: [mutation], remove: [] },
          device: deviceRecord?.deviceId
            ? operationBatch()
            : { put: [{ ...(deviceRecord ?? {}), id: 'device', deviceId, updatedAt: stamp }], remove: [] },
        };
      },
    });
    return result;
  }

  async function queueCommand({ store, recordId, command, patch = {}, groups = [], dependencies = [], baseRevision = 0 }) {
    const schema = schemaFor(store);
    if (!recordId || !command) throw new Error('Invalid Sync V2 command');
    const mutationId = makeId();
    const stamp = now();
    let queued;
    await database.applyBatch({ outbox: {}, device: {} }, {
      prepare(current) {
        const deviceRecord = current.device.find((record) => record.id === 'device') ?? null;
        const deviceId = deviceRecord?.deviceId || makeId();
        const sequence = sortMutations(current.outbox).reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1;
        queued = {
          id: `v2:${mutationId}`,
          protocol: 'v2', mutationId, deviceId, store, entity: schema.entity,
          recordId, serverRecordId: recordId, canonicalId: recordId,
          logicalRecordKey: `${store}:${recordId}`,
          op: 'command', command, baseRevision: normalizeRevision(baseRevision),
          patch: clone(patch), localPatch: {},
          fields: Object.keys(patch).sort(), groups: [...new Set(groups)].sort(),
          dependencies: clone(dependencies), sequence,
          clientUpdatedAt: stamp, queuedAt: stamp,
          state: 'pending', attemptCount: 0, envelopeLocked: false,
          lastError: null, blockedReason: null,
        };
        return {
          outbox: { put: [queued], remove: [] },
          device: deviceRecord?.deviceId
            ? operationBatch()
            : { put: [{ ...(deviceRecord ?? {}), id: 'device', deviceId, updatedAt: stamp }], remove: [] },
        };
      },
    });
    return queued;
  }

  async function queueEnrollmentCommand({
    command, studentId, sourceEnrollmentId = null, destinationEnrollmentId = null,
    destinationSectionId = null, date = null, note = '', dependencies = [],
  }) {
    if (!['enroll', 'transfer', 'withdraw'].includes(command) || !studentId) {
      throw new Error('Invalid Sync V2 enrollment command');
    }
    const payload = { studentId, sourceEnrollmentId, destinationEnrollmentId, destinationSectionId, date, note };
    const required = [
      { store: 'students', recordId: studentId, requiresServerRevision: true },
      ...(destinationSectionId ? [{ store: 'sections', recordId: destinationSectionId, requiresServerRevision: true }] : []),
      ...dependencies,
    ];
    return queueCommand({
      store: 'enrollments', recordId: studentId, command: `enrollment:${command}`,
      patch: payload, groups: ['membership'], dependencies: uniqueDependencies(required),
    });
  }

  async function queueAttendanceCommand({ attendanceId, sessionId, studentId, patch, dependencies = [] }) {
    if (!attendanceId || !sessionId || !studentId || !patch || typeof patch !== 'object') {
      throw new Error('Invalid Sync V2 attendance command');
    }
    const existing = await database.get('attendance', attendanceId);
    const required = [
      { store: 'sessions', recordId: sessionId, requiresServerRevision: true },
      { store: 'students', recordId: studentId, requiresServerRevision: true },
      ...dependencies,
    ];
    return queueCommand({
      store: 'attendance', recordId: attendanceId, command: 'attendance:record',
      patch: { sessionId, studentId, ...patch }, groups: Object.keys(patch),
      dependencies: uniqueDependencies(required), baseRevision: normalizeRevision(existing?.serverRevision),
    });
  }

  async function queueLifecycleCommand({ command, targetId, dependencies = [] }) {
    if (!['delete_item', 'delete_teaching', 'delete_student', 'delete_class'].includes(command) || !targetId) throw new Error('Invalid Sync V2 lifecycle command');
    return queueCommand({ store: 'sessions', recordId: `${command}:${targetId}`, command: `lifecycle:${command}`, patch: { targetId }, groups: ['__deleted__'], dependencies });
  }

  async function queueTeachingCreationCommand({ teaching, items, dependencies = [] }) {
    if (!teaching?.id || !teaching.sectionId || !teaching.subjectId || !teaching.termId || !Array.isArray(items) || items.length !== 5) {
      throw new Error('Invalid Sync V2 teaching creation command');
    }
    const mutationId = makeId(), stamp = now(); let queued;
    await database.applyBatch({ teachings: {}, items: {}, outbox: {}, device: {} }, { prepare(current) {
      const device = current.device.find((row) => row.id === 'device'); const deviceId = device?.deviceId || makeId();
      const sequence = sortMutations(current.outbox).reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1;
      queued = { id: `v2:${mutationId}`, protocol: 'v2', mutationId, deviceId, store: 'teachings', entity: 'teachings',
        recordId: teaching.id, serverRecordId: teaching.id, canonicalId: teaching.id, logicalRecordKey: `teachings:${teaching.id}`,
        op: 'command', command: 'teaching:create', patch: { sectionId: teaching.sectionId, subjectId: teaching.subjectId, termId: teaching.termId, order: teaching.order ?? 0, itemIds: items.map((item) => item.id) },
        localPatch: {}, fields: [], groups: ['__create__'], dependencies: uniqueDependencies([{ store: 'sections', recordId: teaching.sectionId, requiresServerRevision: true }, { store: 'subjects', recordId: teaching.subjectId, requiresServerRevision: true }, { store: 'terms', recordId: teaching.termId, requiresServerRevision: true }, ...dependencies]),
        sequence, clientUpdatedAt: stamp, queuedAt: stamp, state: 'pending', attemptCount: 0, envelopeLocked: false, lastError: null, blockedReason: null };
      return { teachings: { put: [{ ...teaching, canonicalId: teaching.id, serverRevision: 0 }], remove: [] }, items: { put: items.map((item) => ({ ...item, canonicalId: item.id, serverRevision: 0 })), remove: [] }, outbox: { put: [queued], remove: [] }, device: device ? operationBatch() : { put: [{ id: 'device', deviceId, updatedAt: stamp }], remove: [] } };
    }});
    return queued;
  }

  async function queueFillAttendanceCommand({ sessionId, status, studentIds = [] }) {
    if (!sessionId || !['present','late','excused','absent'].includes(status)) throw new Error('Invalid Sync V2 fill attendance command');
    return queueCommand({ store:'attendance', recordId:`fill:${sessionId}`, command:'attendance:fill', patch:{ sessionId,status,studentIds:[...studentIds] }, groups:['status'], dependencies: uniqueDependencies([{ store:'sessions',recordId:sessionId,requiresServerRevision:true }, ...studentIds.map((recordId)=>({store:'students',recordId,requiresServerRevision:true}))]) });
  }

  async function markAttempt(mutation) {
    let locked = mutation;
    await database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const existing = current.outbox.find((row) => row.id === mutation.id);
        if (!existing) return { outbox: operationBatch() };
        locked = {
          ...existing,
          state: 'pending',
          envelopeLocked: true,
          attemptCount: (existing.attemptCount ?? 0) + 1,
          lastAttemptAt: now(),
          lastError: null,
          blockedReason: null,
        };
        return { outbox: { put: [locked], remove: [] } };
      },
    });
    return locked;
  }

  async function markFailure(mutation, error) {
    await database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const existing = current.outbox.find((row) => row.id === mutation.id);
        if (!existing) return { outbox: operationBatch() };
        return {
          outbox: {
            put: [{
              ...existing,
              state: 'failed',
              lastError: {
                message: error?.message ?? String(error),
                code: error?.code ?? null,
                status: error?.status ?? null,
                at: now(),
              },
            }],
            remove: [],
          },
        };
      },
    });
  }

  async function markDependencyBlock(mutation, reason) {
    await database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const existing = current.outbox.find((row) => row.id === mutation.id);
        if (!existing) return { outbox: operationBatch() };
        return { outbox: { put: [{ ...existing, state: 'blocked', blockedReason: reason }], remove: [] } };
      },
    });
  }

  async function reconcileReceipt(mutation, result) {
    const resultMutationId = result?.mutationId;
    if (resultMutationId !== mutation.mutationId) throw new Error('Sync V2 receipt mutationId mismatch');
    const canonical = decodeSyncV2Canonical(mutation.store, result.canonical);
    const canonicalId = result.canonicalId || canonical?.id || mutation.serverRecordId;
    const sourceId = mutation.recordId;
    const stamp = now();
    const scope = Object.fromEntries([...SYNC_V2_STORES, 'outbox'].map((store) => [store, {}]));

    await database.applyBatch(scope, {
      prepare(current) {
        const currentMutation = current.outbox.find((row) => row.id === mutation.id);
        if (!currentMutation) return Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const writes = Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const remappedOutbox = current.outbox
          .filter((row) => row.id !== mutation.id)
          .map((row) => canonicalId !== sourceId ? rewriteMutationReferences(row, mutation.store, sourceId, canonicalId) : row);

        for (const store of SYNC_V2_STORES) {
          if (canonicalId === sourceId) break;
          for (const record of current[store]) {
            const rewritten = rewriteReferenceRecord(store, record, mutation.store, sourceId, canonicalId);
            if (rewritten !== record) pushUniquePut(writes[store], rewritten);
          }
        }

        const source = current[mutation.store].find((record) => record.id === sourceId) ?? null;
        const target = current[mutation.store].find((record) => record.id === canonicalId) ?? null;
        const existingRevision = Math.max(
          normalizeRevision(source?.serverRevision), normalizeRevision(target?.serverRevision),
        );
        const resultRevision = normalizeRevision(result.resultRevision ?? canonical?.serverRevision);
        const acceptCanonical = canonical && resultRevision >= existingRevision;
        const authoritative = acceptCanonical
          ? canonical
          : (target?.serverCanonical ?? source?.serverCanonical ?? null);
        let next = { ...(source ?? {}), ...(target ?? {}), ...(authoritative ?? {}), id: canonicalId, canonicalId };
        next.serverRevision = Math.max(existingRevision, resultRevision);
        if (acceptCanonical) next.serverCanonical = canonicalSnapshot({ ...canonical, id: canonicalId, canonicalId });
        else if (target?.serverCanonical ?? source?.serverCanonical) {
          next.serverCanonical = clone(target?.serverCanonical ?? source?.serverCanonical);
        }
        const diagnostic = conflictDiagnostic(currentMutation, result, stamp);
        if (diagnostic) next.syncConflicts = [...(next.syncConflicts ?? []), diagnostic];

        const later = pendingForRecord(remappedOutbox, mutation.store, [sourceId, canonicalId]);
        const rebasedOutbox = remappedOutbox.map((row) => {
          if (!later.some((candidate) => candidate.id === row.id) || row.envelopeLocked || row.op === 'create') return row;
          return {
            ...row,
            baseRevision: next.serverRevision,
            recordId: canonicalId,
            serverRecordId: canonicalId,
            canonicalId,
            logicalRecordKey: `${mutation.store}:${canonicalId}`,
            state: row.state === 'blocked' ? 'pending' : row.state,
            blockedReason: null,
          };
        });
        next = overlayMutations(next, pendingForRecord(rebasedOutbox, mutation.store, [canonicalId]), canonical?.deleted === true);

        if (canonicalId !== sourceId) writes[mutation.store].remove.push(sourceId);
        pushUniquePut(writes[mutation.store], next);
        writes.outbox.remove.push(mutation.id);
        for (const row of rebasedOutbox) {
          const previous = current.outbox.find((candidate) => candidate.id === row.id);
          if (JSON.stringify(previous) !== JSON.stringify(row)) pushUniquePut(writes.outbox, row);
        }
        return writes;
      },
    });
  }

  async function reconcileEnrollmentCommandReceipt(mutation, result) {
    if (result?.mutationId !== mutation.mutationId) throw new Error('Sync V2 enrollment receipt mutationId mismatch');
    const canonicalRows = Array.isArray(result.enrollments) ? result.enrollments
      .map((row) => decodeSyncV2Canonical('enrollments', row)).filter(Boolean) : [];
    const payload = mutation.patch ?? {};
    const destination = canonicalRows.find((row) => row.sectionId === payload.destinationSectionId && row.studentId === payload.studentId) ?? null;
    const remap = payload.destinationEnrollmentId && destination && payload.destinationEnrollmentId !== destination.id
      ? { from: payload.destinationEnrollmentId, to: destination.id } : null;
    await database.applyBatch({ enrollments: {}, students: {}, outbox: {} }, {
      prepare(current) {
        const currentMutation = current.outbox.find((row) => row.id === mutation.id);
        if (!currentMutation) return { enrollments: operationBatch(), students: operationBatch(), outbox: operationBatch() };
        const writes = { enrollments: operationBatch(), students: operationBatch(), outbox: operationBatch() };
        for (const row of canonicalRows) {
          const existing = current.enrollments.find((record) => record.id === row.id);
          pushUniquePut(writes.enrollments, { ...(existing ?? {}), ...row, serverCanonical: canonicalSnapshot(row) });
        }
        const student = current.students.find((row) => row.id === payload.studentId);
        if (['conflict', 'rejected'].includes(result.outcome) && student) {
          pushUniquePut(writes.students, {
            ...student,
            syncConflicts: [...(student.syncConflicts ?? []), {
              mutationId: mutation.mutationId, outcome: result.outcome, groups: ['__membership__'],
              rejectedPatch: clone(payload), recordedAt: now(),
            }],
          });
        }
        const others = current.outbox.filter((row) => row.id !== mutation.id).map((row) =>
          remap ? rewriteMutationReferences(row, 'enrollments', remap.from, remap.to) : row);
        if (remap) writes.enrollments.remove.push(remap.from);
        writes.outbox.remove.push(mutation.id);
        for (const row of others) {
          const before = current.outbox.find((candidate) => candidate.id === row.id);
          if (JSON.stringify(before) !== JSON.stringify(row)) pushUniquePut(writes.outbox, row);
        }
        return writes;
      },
    });
  }

  async function reconcileAttendanceCommandReceipt(mutation, result) {
    if (result?.mutationId !== mutation.mutationId) throw new Error('Sync V2 attendance receipt mutationId mismatch');
    const snapshot = decodeSyncV2Canonical('sessionRosterSnapshots', result.snapshot);
    const attendance = decodeSyncV2Canonical('attendance', result.attendance);
    if (!attendance?.id) throw new Error('Sync V2 attendance receipt is missing canonical attendance');
    const sourceId = mutation.recordId;
    const canonicalId = attendance.id;
    const scope = { attendance: {}, sessionRosterSnapshots: {}, outbox: {} };
    await database.applyBatch(scope, {
      prepare(current) {
        const currentMutation = current.outbox.find((row) => row.id === mutation.id);
        if (!currentMutation) return Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const writes = Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const source = current.attendance.find((row) => row.id === sourceId) ?? null;
        const target = current.attendance.find((row) => row.id === canonicalId) ?? null;
        const diagnostic = conflictDiagnostic(currentMutation, result, now());
        const next = {
          ...(source ?? {}), ...(target ?? {}), ...attendance, id: canonicalId, canonicalId,
          serverCanonical: canonicalSnapshot(attendance),
          ...(diagnostic ? { syncConflicts: [...(target?.syncConflicts ?? source?.syncConflicts ?? []), diagnostic] } : {}),
        };
        if (snapshot?.id) {
          const existingSnapshot = current.sessionRosterSnapshots.find((row) => row.id === snapshot.id);
          pushUniquePut(writes.sessionRosterSnapshots, { ...(existingSnapshot ?? {}), ...snapshot, serverCanonical: canonicalSnapshot(snapshot) });
        }
        const others = current.outbox.filter((row) => row.id !== mutation.id).map((row) =>
          canonicalId !== sourceId ? rewriteMutationReferences(row, 'attendance', sourceId, canonicalId) : row);
        if (canonicalId !== sourceId) writes.attendance.remove.push(sourceId);
        pushUniquePut(writes.attendance, next);
        writes.outbox.remove.push(mutation.id);
        for (const row of others) {
          const before = current.outbox.find((candidate) => candidate.id === row.id);
          if (JSON.stringify(before) !== JSON.stringify(row)) pushUniquePut(writes.outbox, row);
        }
        return writes;
      },
    });
  }

  async function reconcileTeachingCreationReceipt(mutation, result) {
    if (result?.mutationId !== mutation.mutationId) throw new Error('Sync V2 teaching receipt mutationId mismatch');
    const teaching = decodeSyncV2Canonical('teachings', result.canonicalTeaching);
    const items = (result.items ?? []).map((row) => decodeSyncV2Canonical('items', row)).filter(Boolean);
    if (!teaching?.id || items.length !== 5) throw new Error('Sync V2 teaching receipt is incomplete');
    const scope = Object.fromEntries([...SYNC_V2_STORES, 'outbox'].map((store) => [store, {}]));
    await database.applyBatch(scope, { prepare(current) {
      const active = current.outbox.find((row) => row.id === mutation.id);
      if (!active) return Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
      const writes = Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
      const localTeaching = current.teachings.find((row) => row.id === mutation.recordId);
      const localItems = current.items.filter((row) => row.teachingId === mutation.recordId && !row.deleted);
      const role = (item) => `${item.name}|${item.auto ?? ''}|${item.max}|${item.perPoint ?? 1}|${item.penalty ?? 1}`;
      const canonByRole = new Map(items.map((item) => [role(item), item]));
      const mappings = [[mutation.recordId, teaching.id, 'teachings'], ...localItems.map((item) => [item.id, canonByRole.get(role(item))?.id, 'items'])].filter(([, to]) => to);
      const rewritten = current.outbox.filter((row) => row.id !== mutation.id).map((row) => mappings.reduce((next, [from, to, store]) => rewriteMutationReferences(next, store, from, to), row));
      for (const [from, to, store] of mappings) {
        if (from !== to) writes[store].remove.push(from);
        for (const candidateStore of SYNC_V2_STORES) for (const record of current[candidateStore]) {
          const next = rewriteReferenceRecord(candidateStore, record, store, from, to);
          if (next !== record) pushUniquePut(writes[candidateStore], next);
        }
      }
      pushUniquePut(writes.teachings, { ...(localTeaching ?? {}), ...teaching, serverCanonical: canonicalSnapshot(teaching) });
      for (const item of items) pushUniquePut(writes.items, { ...(current.items.find((row) => row.id === item.id) ?? {}), ...item, serverCanonical: canonicalSnapshot(item) });
      writes.outbox.remove.push(mutation.id);
      for (const row of rewritten) { const before = current.outbox.find((old) => old.id === row.id); if (JSON.stringify(before) !== JSON.stringify(row)) pushUniquePut(writes.outbox, row); }
      return writes;
    }});
  }

  async function dependencyReadiness(mutation, rows) {
    for (const dependency of mutation.dependencies ?? []) {
      const identifiedMutation = dependency.mutationId
        ? rows.find((row) => row.mutationId === dependency.mutationId)
        : null;
      if (identifiedMutation?.state === 'rejected') return { state: 'rejected', reason: 'dependency-rejected' };
      if (identifiedMutation) {
        return { state: 'blocked', reason: identifiedMutation.state === 'failed' ? 'dependency-failed' : 'dependency-pending' };
      }
      if (!dependency.store || !dependency.recordId) continue;
      const parent = await database.get(dependency.store, dependency.recordId);
      if (!parent) return { state: 'blocked', reason: 'dependency-not-local-yet' };
      if (parent.deleted) return { state: 'rejected', reason: 'dependency-deleted' };
      if (dependency.requiresServerRevision && normalizeRevision(parent.serverRevision) === 0) {
        return { state: 'blocked', reason: 'dependency-not-authoritative' };
      }
      const createMutation = rows.find((row) => row.store === dependency.store &&
        (row.recordId === dependency.recordId || row.serverRecordId === dependency.recordId) && row.op === 'create');
      if (createMutation?.state === 'rejected') return { state: 'rejected', reason: 'dependency-rejected' };
      if (createMutation) {
        return { state: 'blocked', reason: createMutation.state === 'failed' ? 'dependency-failed' : 'dependency-pending' };
      }
    }
    return { state: 'ready', reason: null };
  }

  async function markRejected(mutation, reason, error = null) {
    await database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const existing = current.outbox.find((row) => row.id === mutation.id);
        if (!existing) return { outbox: operationBatch() };
        return {
          outbox: {
            put: [{
              ...existing,
              state: 'rejected',
              blockedReason: reason,
              lastError: {
                message: error?.message ?? reason,
                code: error?.code ?? null,
                status: error?.status ?? null,
                at: now(),
              },
            }],
            remove: [],
          },
        };
      },
    });
  }

  function isRejectedProtocolError(error) {
    const status = Number(error?.status);
    return error?.code === '22023' || error?.code === '23503' ||
      status === 400 || status === 409 || status === 422;
  }

  async function dispatchPending({ maxMutations = Infinity } = {}) {
    const snapshot = sortMutations(await database.getAll('outbox'));
    const stoppedKeys = new Set();
    const result = { attempted: 0, acknowledged: 0, failed: 0, blocked: 0 };

    for (const original of snapshot) {
      if (result.attempted >= maxMutations) break;
      if (original.state === 'rejected') {
        stoppedKeys.add(original.logicalRecordKey);
        result.blocked++;
        continue;
      }
      if (original.op === 'command' && String(original.command ?? '').startsWith('enrollment:') &&
          typeof transport.applyEnrollmentCommand === 'function') {
        if (stoppedKeys.has(original.logicalRecordKey)) { result.blocked++; continue; }
        const liveRows = sortMutations(await database.getAll('outbox'));
        const live = liveRows.find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, liveRows.filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') {
          await markDependencyBlock(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
        }
        if (readiness.state === 'rejected') {
          await markRejected(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
        }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = await transport.applyEnrollmentCommand({
            mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            command: mutation.command.slice('enrollment:'.length), payload: clone(mutation.patch),
            clientUpdatedAt: mutation.clientUpdatedAt,
          });
          await reconcileEnrollmentCommandReceipt(mutation, receipt);
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
          else await markFailure(mutation, error);
          stoppedKeys.add(mutation.logicalRecordKey);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
      }
      if (original.op === 'command' && original.command === 'attendance:record' &&
          typeof transport.applyAttendanceCommand === 'function') {
        if (stoppedKeys.has(original.logicalRecordKey)) { result.blocked++; continue; }
        const liveRows = sortMutations(await database.getAll('outbox'));
        const live = liveRows.find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, liveRows.filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') {
          await markDependencyBlock(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
        }
        if (readiness.state === 'rejected') {
          await markRejected(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
        }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = await transport.applyAttendanceCommand({
            mutationId: mutation.mutationId, deviceId: mutation.deviceId, attendanceId: mutation.serverRecordId,
            sessionId: mutation.patch.sessionId, studentId: mutation.patch.studentId,
            baseRevision: mutation.baseRevision, patch: Object.fromEntries(Object.entries(mutation.patch)
              .filter(([key]) => key === 'status' || key === 'note')),
            clientUpdatedAt: mutation.clientUpdatedAt,
          });
          await reconcileAttendanceCommandReceipt(mutation, receipt);
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
          else await markFailure(mutation, error);
          stoppedKeys.add(mutation.logicalRecordKey);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
      }
      if (original.op === 'command' && String(original.command ?? '').startsWith('lifecycle:') &&
          typeof transport.applyLifecycleCommand === 'function') {
        const live = (await database.getAll('outbox')).find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, (await database.getAll('outbox')).filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') { await markDependencyBlock(live, readiness.reason); result.blocked++; continue; }
        if (readiness.state === 'rejected') { await markRejected(live, readiness.reason); result.blocked++; continue; }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = await transport.applyLifecycleCommand({ mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            command: mutation.command.slice('lifecycle:'.length), targetId: mutation.patch.targetId, clientUpdatedAt: mutation.clientUpdatedAt });
          if (receipt?.mutationId !== mutation.mutationId) throw new Error('Sync V2 lifecycle receipt mutationId mismatch');
          await database.applyBatch({ outbox: {} }, { prepare: () => ({ outbox: { put: [], remove: [mutation.id] } }) });
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error); else await markFailure(mutation, error);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
      }
      if (original.op === 'command' && original.command === 'teaching:create' && typeof transport.applyTeachingCreationCommand === 'function') {
        const live = (await database.getAll('outbox')).find((row) => row.id === original.id); if (!live) continue;
        const readiness = await dependencyReadiness(live, (await database.getAll('outbox')).filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') { await markDependencyBlock(live, readiness.reason); result.blocked++; continue; }
        if (readiness.state === 'rejected') { await markRejected(live, readiness.reason); result.blocked++; continue; }
        const mutation = await markAttempt(live); result.attempted++;
        try {
          const receipt = await transport.applyTeachingCreationCommand({ mutationId: mutation.mutationId, deviceId: mutation.deviceId, teachingId: mutation.recordId, sectionId: mutation.patch.sectionId, subjectId: mutation.patch.subjectId, termId: mutation.patch.termId, order: mutation.patch.order, itemIds: mutation.patch.itemIds, clientUpdatedAt: mutation.clientUpdatedAt });
          await reconcileTeachingCreationReceipt(mutation, receipt); result.acknowledged++;
        } catch (error) { if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error); else await markFailure(mutation, error); if (isRejectedProtocolError(error)) result.blocked++; else result.failed++; }
        continue;
      }
      if (original.op === 'command' && original.command === 'attendance:fill' && typeof transport.applyFillAttendanceCommand === 'function') {
        const live=(await database.getAll('outbox')).find((row)=>row.id===original.id); if(!live) continue;
        const ready=await dependencyReadiness(live,(await database.getAll('outbox')).filter((row)=>row.id!==live.id));
        if(ready.state==='blocked'){await markDependencyBlock(live,ready.reason);result.blocked++;continue;} if(ready.state==='rejected'){await markRejected(live,ready.reason);result.blocked++;continue;}
        const mutation=await markAttempt(live); result.attempted++;
        try { const receipt=await transport.applyFillAttendanceCommand({mutationId:mutation.mutationId,deviceId:mutation.deviceId,sessionId:mutation.patch.sessionId,status:mutation.patch.status,clientUpdatedAt:mutation.clientUpdatedAt}); if(receipt?.mutationId!==mutation.mutationId) throw new Error('Sync V2 fill receipt mutationId mismatch');
          const snapshot=decodeSyncV2Canonical('sessionRosterSnapshots',receipt.snapshot); const skippedIds=new Set((receipt.skipped??[]).map((row)=>row?.id)); const rows=[...(receipt.applied??[]),...(receipt.skipped??[])].map((row)=>decodeSyncV2Canonical('attendance',row)).filter(Boolean);
          await database.applyBatch({attendance:{},sessionRosterSnapshots:{},outbox:{}},{prepare:(current)=>({attendance:{put:rows.map((row)=>{const prior=current.attendance.find((x)=>x.id===row.id);const next={...prior,...row,serverCanonical:canonicalSnapshot(row)};return skippedIds.has(row.id)?{...next,bulkDisposition:{mutationId:mutation.mutationId,outcome:'skipped',canonicalRevision:row.serverRevision,recordedAt:now()}}:next;}),remove:[]},sessionRosterSnapshots:{put:snapshot?[{...current.sessionRosterSnapshots.find((x)=>x.id===snapshot.id),...snapshot,serverCanonical:canonicalSnapshot(snapshot)}]:[],remove:[]},outbox:{put:[],remove:[mutation.id]}})}); result.acknowledged++;
        } catch(error){if(isRejectedProtocolError(error))await markRejected(mutation,'protocol-rejected',error);else await markFailure(mutation,error);if(isRejectedProtocolError(error))result.blocked++;else result.failed++;} continue;
      }
      if (original.op === 'command') {
        await markDependencyBlock(original, 'command-handler-required');
        stoppedKeys.add(original.logicalRecordKey);
        result.blocked++;
        continue;
      }
      if (stoppedKeys.has(original.logicalRecordKey)) {
        result.blocked++;
        continue;
      }
      const liveRows = sortMutations(await database.getAll('outbox'));
      const live = liveRows.find((row) => row.id === original.id);
      if (!live) continue;
      const readiness = await dependencyReadiness(live, liveRows.filter((row) => row.id !== live.id));
      if (readiness.state === 'blocked') {
        await markDependencyBlock(live, readiness.reason);
        stoppedKeys.add(live.logicalRecordKey);
        result.blocked++;
        continue;
      }
      if (readiness.state === 'rejected') {
        await markRejected(live, readiness.reason);
        stoppedKeys.add(live.logicalRecordKey);
        result.blocked++;
        continue;
      }

      const mutation = await markAttempt(live);
      result.attempted++;
      try {
        const receipt = await transport.applyMutation(mutationEnvelope(mutation));
        await reconcileReceipt(mutation, receipt);
        result.acknowledged++;
      } catch (error) {
        if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
        else await markFailure(mutation, error);
        stoppedKeys.add(mutation.logicalRecordKey);
        if (isRejectedProtocolError(error)) result.blocked++;
        else result.failed++;
      }
    }
    return result;
  }

  async function reconcilePull(store, rows) {
    schemaFor(store);
    const canonicalRows = Array.isArray(rows) ? rows : [];
    await database.applyBatch({ [store]: {}, outbox: {} }, {
      prepare(current) {
        const writes = operationBatch();
        for (const row of canonicalRows) {
          const canonical = decodeSyncV2Canonical(store, row);
          if (!canonical?.id) continue;
          const existing = current[store].find((record) => record.id === canonical.id) ?? null;
          if (existing && normalizeRevision(existing.serverRevision) > normalizeRevision(canonical.serverRevision)) continue;
          const conflicts = existing?.syncConflicts;
          let next = { ...(existing ?? {}), ...canonical };
          next.serverCanonical = canonicalSnapshot(canonical);
          if (conflicts?.length) next.syncConflicts = conflicts;
          next = overlayMutations(
            next,
            pendingForRecord(current.outbox, store, [canonical.id]),
            canonical.deleted === true,
          );
          pushUniquePut(writes, next);
        }
        return { [store]: writes, outbox: operationBatch() };
      },
    });
  }

  async function pullStore(store) {
    const schema = schemaFor(store);
    const rows = await transport.fetchRecords(schema.entity);
    if (!Array.isArray(rows)) throw new Error(`Sync V2 pull expected an array for ${schema.entity}`);
    await reconcilePull(store, rows);
    return rows.length;
  }

  async function pullAll({ stores = SYNC_V2_STORES } = {}) {
    const result = { pulled: 0, failures: [] };
    for (const store of stores) {
      try {
        result.pulled += await pullStore(store);
      } catch (error) {
        result.failures.push({ store, error });
      }
    }
    return result;
  }

  async function sync(options = {}) {
    const pull = await pullAll(options);
    const push = await dispatchPending(options);
    return { pull, push, status: await status() };
  }

  async function status() {
    const outbox = sortMutations(await database.getAll('outbox'));
    const failed = outbox.filter((row) => row.state === 'failed').length;
    const blockedOutbox = outbox.filter((row) => row.state === 'blocked').length;
    const rejected = outbox.filter((row) => row.state === 'rejected').length;
    const pending = outbox.filter((row) => row.state === 'pending').length;
    let conflicts = 0;
    for (const store of SYNC_V2_STORES) {
      const records = await database.getAll(store);
      conflicts += records.reduce((total, record) => total + (record.syncConflicts?.length ?? 0), 0);
    }
    const state = failed ? 'error'
      : rejected ? 'rejected'
      : conflicts ? 'conflicted'
      : blockedOutbox ? 'blocked'
      : pending ? 'pending'
      : 'synced';
    return { state, pending, queued: outbox.length, failed, blocked: blockedOutbox, rejected, conflicts };
  }

  return {
    ensureDeviceId,
    commitMutation,
    queueCommand,
    queueEnrollmentCommand,
    queueAttendanceCommand,
    queueLifecycleCommand,
    queueTeachingCreationCommand,
    queueFillAttendanceCommand,
    dispatchPending,
    reconcilePull,
    pullStore,
    pullAll,
    sync,
    status,
  };
}
