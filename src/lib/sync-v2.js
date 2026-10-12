/**
 * RAKEEZ X — Sync V2 client foundation.
 *
 * This module is intentionally isolated from the current Production V1 sync
 * coordinator.  It provides the durable mutation/reconciliation primitives
 * that V2C can wire into runtime store actions after the server cutover.
 */

import * as databaseDefault from './db.js';
import { applySyncV2Mutation, applySyncV2EnrollmentCommand, applySyncV2AttendanceCommand, applySyncV2SessionDeleteCommand, applySyncV2LifecycleCommand, applySyncV2SectionLifecycleCommand, applySyncV2TeachingCreationCommand, applySyncV2FillAttendanceCommand, applySyncV2ClosedTermReportCommand, applySyncV2ClassGoalRewardCommand, applyScoreSubitemCommand, applyScoreConfigurationCommand, applyScoreDistributionCopyCommand, getScoreDomainSnapshot, fetchRecords } from './cloud.js';
import { DEFAULT_TIME_PROFILE_IDS } from '../models.js';
import { uid } from '../models.js';
import { projectSubitemScore, scoreCents } from './score-foundation.js';
import { applyScoreDistributionPlan, renameScoreItem } from './cloud.js';
import { createSyncOwnershipGuard, ownershipBlockedError, SYNC_OWNERSHIP_BLOCKED } from './sync-ownership.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => value == null ? value : structuredClone(value);

export const SYNC_V2_SCHEMAS = Object.freeze({
  profile: {
    entity: 'profile',
    fields: {
      teacherName: 'teacher_name', schoolName: 'school_name', phone: 'phone', teacherForm: 'teacher_form',
      educationDepartment: 'education_department',
      reportPrincipalName: 'report_principal_name', activeTimeProfileId: 'active_time_profile_id',
    },
    references: { activeTimeProfileId: 'timeProfiles' },
  },
  years: {
    entity: 'years',
    fields: { label: 'label', hijriStart: 'hijri_start', hijriEnd: 'hijri_end', order: 'order', status: 'status', calendarPresetId: 'calendar_preset_id' },
  },
  calendars: {
    entity: 'calendars',
    fields: { yearId: 'year_id', source: 'source', label: 'label', presetId: 'preset_id', termDateOverrides: 'term_date_overrides' },
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
  units: {
    entity: 'units',
    fields: {
      subjectId: 'subject_id', grade: 'grade', termIndex: 'term_index', name: 'name',
      order: 'order', plannedSessions: 'planned_sessions',
    },
    references: { subjectId: 'subjects' },
  },
  lessons: {
    entity: 'lessons',
    fields: { unitId: 'unit_id', name: 'name', order: 'order', plannedSessions: 'planned_sessions' },
    references: { unitId: 'units' },
  },
  assignments: {
    entity: 'assignments',
    fields: { teachingId: 'teaching_id', lessonId: 'lesson_id', itemId: 'item_id', title: 'title', assignedDate: 'assigned_date', dueDate: 'due_date', max: 'max' },
    references: { teachingId: 'teachings', lessonId: 'lessons', itemId: 'items' },
  },
  submissions: {
    entity: 'submissions',
    fields: { studentId: 'student_id', assignmentId: 'assignment_id', status: 'status', score: 'score', note: 'note' },
    references: { studentId: 'students', assignmentId: 'assignments' },
  },
  sections: {
    entity: 'sections',
    fields: {
      yearId: 'year_id', grade: 'grade', label: 'label', name: 'name', color: 'color', order: 'order',
      status: 'status', archivedAt: 'archived_at', archiveDate: 'archive_date',
    },
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
  classRules: {
    entity: 'class_rules',
    fields: { teachingId: 'teaching_id', iconKey: 'icon_key', text: 'text' },
    references: { teachingId: 'teachings' },
  },
  classGoals: {
    entity: 'class_goals',
    fields: {
      teachingId: 'teaching_id', runId: 'run_id', date: 'date', sessionId: 'session_id',
      text: 'text', presetKey: 'preset_key', durationMinutes: 'duration_minutes',
      rewardPoints: 'reward_points', state: 'state', startedAt: 'started_at',
      completedAt: 'completed_at', rewardOperationId: 'reward_operation_id',
    },
    references: { teachingId: 'teachings', sessionId: 'sessions' },
  },
  classCharterSelections: {
    entity: 'class_charter_selections',
    fields: { teachingId: 'teaching_id', selectedRuleIds: 'selected_rule_ids' },
    references: { teachingId: 'teachings' },
  },
  groupArrangements: {
    entity: 'group_arrangements',
    fields: { teachingId: 'teaching_id', groups: 'groups' },
    references: { teachingId: 'teachings' },
  },
  items: {
    entity: 'items',
    fields: {
      teachingId: 'teaching_id', name: 'name', max: 'max',
      auto: 'auto', perPoint: 'per_point', penalty: 'penalty', unitId: 'unit_id', lessonId: 'lesson_id', order: 'order',
      scoreMode: 'score_mode', distributionMode: 'distribution_mode', portabilityGroupId: 'portability_group_id',
      distributionVersion: 'distribution_version', distributionOriginId: 'distribution_origin_id',
    },
    references: { teachingId: 'teachings', unitId: 'units', lessonId: 'lessons' },
  },
  scoreSubitems: {
    entity: 'score_subitems',
    fields: { itemId: 'item_id', name: 'name', value: 'value', order: 'order', distributionVersion: 'distribution_version', distributionOriginId: 'distribution_origin_id',
      startDate: 'start_date', dueDate: 'due_date', latePoints: 'late_points' },
    references: { itemId: 'items' },
  },
  scoreSubitemCompletions: {
    entity: 'score_subitem_completions',
    fields: { studentId: 'student_id', subitemId: 'subitem_id', checked: 'checked', completionState: 'completion_state' },
    references: { studentId: 'students', subitemId: 'scoreSubitems' },
  },
  scores: {
    entity: 'scores',
    fields: { studentId: 'student_id', itemId: 'item_id', value: 'value', manualValue: 'manual_value', derivedValue: 'derived_value' },
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
      reason: 'reason', makeupForId: 'makeup_for_id', lessonId: 'lesson_id', note: 'note', homework: 'homework', covered: 'covered', calendarContext: 'calendar_context',
    },
    references: { teachingId: 'teachings', slotId: 'slots', timeProfileId: 'timeProfiles', makeupForId: 'sessions', lessonId: 'lessons' },
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
  closedTermReports: {
    entity: 'closed_term_reports',
    readOnly: true,
    fields: {
      termId: 'term_id', yearId: 'year_id', version: 'version', supersedesId: 'supersedes_id',
      sourceManifest: 'source_manifest', payload: 'payload', state: 'state', createdAt: 'created_at',
    },
    references: { termId: 'terms', yearId: 'years', supersedesId: 'closedTermReports' },
  },
});

export const SYNC_V2_STORES = Object.freeze(Object.keys(SYNC_V2_SCHEMAS));

const SAFE_FEATURE_CATEGORY = Object.freeze({
  profile: 'account',
  years: 'academic', calendars: 'academic', calendarDays: 'academic', terms: 'academic',
  subjects: 'classes', sections: 'classes', teachings: 'classes',
  units: 'curriculum', lessons: 'curriculum',
  students: 'students', enrollments: 'students', notes: 'students',
  classRules: 'classes', classGoals: 'classes', classCharterSelections: 'classes', groupArrangements: 'classes',
  items: 'assessment', scoreSubitems: 'assessment', scoreSubitemCompletions: 'assessment', scores: 'assessment', logs: 'assessment',
  timeProfiles: 'schedule', slots: 'schedule', sessions: 'schedule',
  sessionRosterSnapshots: 'attendance', attendance: 'attendance',
  closedTermReports: 'reports',
  assignments: 'assessment', submissions: 'assessment',
});

const SAFE_REASON = Object.freeze({
  error: ['temporary_sync_failure', 'تعذّر إرسال بعض التغييرات وستُعاد المحاولة.'],
  rejected: ['server_rejected_change', 'يوجد تغيير لم يقبله الخادم ويحتاج تدخّلًا.'],
  blocked: ['waiting_for_related_data', 'توجد تغييرات تنتظر اكتمال بيانات مرتبطة.'],
  pending: ['waiting_for_upload', 'توجد تغييرات محفوظة محليًا بانتظار الرفع.'],
  synced: ['none', 'لا توجد تغييرات حالية تحتاج إجراءً.'],
});

/**
 * Privacy-safe, read-only projection of durable Sync V2 state.
 * It deliberately exposes no record/mutation identity, patches, receipts, or raw errors.
 */
export function summarizeSyncV2OperationalState({ outbox = [], recordsByStore = {} } = {}) {
  const rows = Array.isArray(outbox) ? outbox.filter((row) => row?.protocol === 'v2' && row.state !== 'superseded') : [];
  const pendingCount = rows.filter((row) => row.state === 'pending').length;
  const failedCount = rows.filter((row) => row.state === 'failed').length;
  const blockedCount = rows.filter((row) => row.state === 'blocked').length;
  const rejectedCount = rows.filter((row) => row.state === 'rejected').length;
  let historicalConflictCount = 0;
  const historicalCategories = new Set();
  for (const [store, records] of Object.entries(recordsByStore ?? {})) {
    if (!Array.isArray(records)) continue;
    const count = records.reduce((total, record) => total + (Array.isArray(record?.syncConflicts) ? record.syncConflicts.length : 0), 0);
    historicalConflictCount += count;
    if (count && SAFE_FEATURE_CATEGORY[store]) historicalCategories.add(SAFE_FEATURE_CATEGORY[store]);
  }
  const state = failedCount ? 'error'
    : rejectedCount ? 'rejected'
    : blockedCount ? 'blocked'
    : pendingCount ? 'pending'
    : 'synced';
  const affectedCategories = new Set(rows.map((row) => SAFE_FEATURE_CATEGORY[row.store]).filter(Boolean));
  const [reasonCategory, reasonLabel] = SAFE_REASON[state];
  return Object.freeze({
    state,
    queuedCount: rows.length,
    pendingCount,
    failedCount,
    blockedCount,
    rejectedCount,
    historicalConflictCount,
    conflicts: historicalConflictCount,
    actionableSyncIssue: state !== 'synced',
    affectedCategories: Object.freeze([...affectedCategories].sort()),
    historicalConflictCategories: Object.freeze([...historicalCategories].sort()),
    reasonCategory,
    reasonLabel,
  });
}

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
  if (store === 'classGoals' && ['startedAt', 'completedAt'].includes(field) && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (store === 'closedTermReports' && field === 'createdAt' && Number.isFinite(value)) {
    return new Date(value).toISOString();
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
  if (store === 'classGoals' && ['startedAt', 'completedAt'].includes(field)) {
    if (value == null) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
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
  if (store === 'scoreSubitems') {
    record.startDate ??= null;
    record.dueDate ??= null;
    record.latePoints = record.latePoints == null ? null : Number(record.latePoints);
  }
  if (store === 'scoreSubitemCompletions') record.completionState ??= record.checked ? 'regular' : null;
  if (store === 'sections') {
    record.status ??= 'active';
    record.archivedAt ??= null;
    record.archiveDate ??= null;
  }
  if (store === 'profile') record.principalName = record.reportPrincipalName ?? '';
  if (['classRules', 'scoreSubitems'].includes(store) && row.created_at) {
    const createdAt = Date.parse(row.created_at);
    if (Number.isFinite(createdAt)) record.createdAt = createdAt;
  }
  if (store === 'closedTermReports' && row.created_at) {
    const createdAt = Date.parse(row.created_at);
    if (Number.isFinite(createdAt)) record.createdAt = createdAt;
  }
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
    .filter((row) => row?.protocol === 'v2' && row.state !== 'superseded')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.id).localeCompare(String(b.id)));
}

function missingScoreCreateIdentity(mutation) {
  return mutation?.store === 'scores' && mutation.op === 'create' &&
    (!mutation.patch?.student_id || !mutation.patch?.item_id);
}

function pendingForRecord(rows, store, ids, excludingId = null) {
  const accepted = new Set(ids.filter(Boolean));
  return sortMutations(rows).filter((mutation) =>
    mutation.id !== excludingId && mutation.store === store &&
    (accepted.has(mutation.recordId) || accepted.has(mutation.serverRecordId) || accepted.has(mutation.canonicalId))
  );
}

function pendingAttendanceForRecord(rows, record) {
  return sortMutations(rows).filter((mutation) => mutation.store === 'attendance' &&
    ([mutation.recordId, mutation.serverRecordId, mutation.canonicalId].includes(record.id) ||
      (mutation.command === 'attendance:record' && mutation.patch?.sessionId === record.sessionId &&
        mutation.patch?.studentId === record.studentId)));
}

function adoptAttendanceCanonical(current, canonical, outbox) {
  const aliases = current.attendance.filter((row) => row.id === canonical.id ||
    (row.studentId === canonical.studentId && row.sessionId === canonical.sessionId));
  const prior = [...aliases].sort((a,b) => normalizeRevision(b.serverRevision) - normalizeRevision(a.serverRevision))[0];
  const acceptCanonical = normalizeRevision(canonical.serverRevision) >= normalizeRevision(prior?.serverRevision);
  const record = { ...prior, ...(acceptCanonical ? canonical : {}), id:canonical.id,canonicalId:canonical.id,
    serverCanonical:acceptCanonical ? canonicalSnapshot(canonical) : prior?.serverCanonical };
  delete record.syncCreatePending;
  const conflicts = aliases.flatMap((row) => row.syncConflicts ?? []);
  if (conflicts.length) record.syncConflicts = [...new Map(conflicts.map((row) => [JSON.stringify(row),row])).values()];
  const remove = aliases.filter((row) => row.id !== canonical.id).map((row) => row.id);
  let remapped = outbox;
  for (const id of remove) remapped = remapped.map((row) => row.envelopeLocked ? row :
    rewriteMutationReferences(row,'attendance',id,canonical.id));
  return {record,remove,outbox:remapped,acceptCanonical};
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
    // Specialized attendance commands already persist their intent in patch.
    // Older queued commands have an empty localPatch: keep that intent visible
    // through canonical receipts/pulls without rewriting a locked envelope.
    if (mutation.op === 'command' && mutation.command === 'attendance:record') {
      for (const field of ['status', 'note']) {
        if (hasOwn(mutation.patch ?? {}, field)) next[field] = clone(mutation.patch[field]);
      }
    }
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
    lifecycle: 'historical_reconciled',
    mutationId: mutation.mutationId,
    outcome: result.outcome ?? 'conflict',
    fields: [...(mutation.fields ?? [])],
    groups: [...groups],
    rejectedPatch: clone(mutation.patch ?? {}),
    canonicalRevision: normalizeRevision(result.resultRevision),
    recordedAt: stamp,
  };
}

const DEFAULT_TIME_PROFILE_ID_SET = new Set(Object.values(DEFAULT_TIME_PROFILE_IDS));

function isDefaultTimeProfileBootstrapAdoption(mutation, result, canonical, canonicalId) {
  return mutation.bootstrap === true && mutation.store === 'timeProfiles' && mutation.op === 'create' &&
    DEFAULT_TIME_PROFILE_ID_SET.has(mutation.recordId) && canonical?.id === mutation.recordId &&
    canonicalId === mutation.recordId && ['conflict', 'canonicalized', 'tombstoned'].includes(result?.outcome);
}

// The owner-global Timing Profile is a single explicit preference. When two
// devices select it from the same revision, the server returns one canonical
// value. The losing optimistic choice is fully reconciled from that canonical
// row, so retaining a permanent conflict badge would be stale rather than
// actionable. Other profile fields keep their ordinary conflict diagnostics.
function isTimingSelectionCanonicalConvergence(mutation, result, canonical) {
  return mutation.store === 'profile' && mutation.op === 'patch' &&
    mutation.fields?.length === 1 && mutation.fields[0] === 'active_time_profile_id' &&
    Array.isArray(result?.conflictedGroups) && result.conflictedGroups.length === 1 &&
    result.conflictedGroups[0] === 'timing_selection' &&
    Object.hasOwn(canonical ?? {}, 'activeTimeProfileId');
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
  if (mutation.command === 'session:delete' && targetStore === 'sessions') {
    for (const patch of [localPatch, serverPatch]) {
      if (patch.sessionId === oldId) {
        patch.sessionId = newId;
        changed = true;
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
    applySessionDeleteCommand: applySyncV2SessionDeleteCommand,
    applyLifecycleCommand: applySyncV2LifecycleCommand,
    applySectionLifecycleCommand: applySyncV2SectionLifecycleCommand,
    applyTeachingCreationCommand: applySyncV2TeachingCreationCommand,
    applyFillAttendanceCommand: applySyncV2FillAttendanceCommand,
    applyClosedTermReportCommand: applySyncV2ClosedTermReportCommand,
    applyClassGoalRewardCommand: applySyncV2ClassGoalRewardCommand,
    applyScoreSubitemCommand,
    applyScoreConfigurationCommand,
    applyScoreDistributionCopyCommand,
    applyScoreDistributionPlan,
    renameScoreItem,
    getScoreDomainSnapshot,
    fetchRecords: (entity) => fetchRecords(entity),
  };
}

export function createSyncV2Engine({
  database = databaseDefault,
  transport = defaultTransport(),
  now = () => Date.now(),
  makeId = uid,
  ownershipGuard = createSyncOwnershipGuard(),
  currentAuthenticatedUserId = () => null,
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
        const mutation = ownershipGuard.bindNewCommand({
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
        });
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
        queued = ownershipGuard.bindNewCommand({
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
        });
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

  async function queueSessionDeleteCommand({ sessionId, dependencies = [] }) {
    if (!sessionId) throw new Error('Invalid Sync V2 session delete command');
    const existing = await database.get('sessions', sessionId);
    return queueCommand({
      store: 'sessions', recordId: sessionId, command: 'session:delete',
      patch: { sessionId }, groups: ['__deleted__'],
      dependencies: uniqueDependencies([
        { store: 'sessions', recordId: sessionId, requiresServerRevision: true }, ...dependencies,
      ]),
      baseRevision: normalizeRevision(existing?.serverRevision),
    });
  }

  async function queueLifecycleCommand({ command, targetId, dependencies = [] }) {
    if (!['delete_item', 'delete_teaching', 'delete_student', 'delete_class', 'archive_class', 'reopen_class'].includes(command) || !targetId) throw new Error('Invalid Sync V2 lifecycle command');
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
      queued = ownershipGuard.bindNewCommand({ id: `v2:${mutationId}`, protocol: 'v2', mutationId, deviceId, store: 'teachings', entity: 'teachings',
        recordId: teaching.id, serverRecordId: teaching.id, canonicalId: teaching.id, logicalRecordKey: `teachings:${teaching.id}`,
        op: 'command', command: 'teaching:create', patch: { sectionId: teaching.sectionId, subjectId: teaching.subjectId, termId: teaching.termId, order: teaching.order ?? 0, itemIds: items.map((item) => item.id) },
        localPatch: {}, fields: [], groups: ['__create__'], dependencies: uniqueDependencies([{ store: 'sections', recordId: teaching.sectionId, requiresServerRevision: true }, { store: 'subjects', recordId: teaching.subjectId, requiresServerRevision: true }, { store: 'terms', recordId: teaching.termId, requiresServerRevision: true }, ...dependencies]),
        sequence, clientUpdatedAt: stamp, queuedAt: stamp, state: 'pending', attemptCount: 0, envelopeLocked: false, lastError: null, blockedReason: null });
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
        delete next.syncCreatePending;
        next.serverRevision = Math.max(existingRevision, resultRevision);
        if (acceptCanonical) next.serverCanonical = canonicalSnapshot({ ...canonical, id: canonicalId, canonicalId });
        else if (target?.serverCanonical ?? source?.serverCanonical) {
          next.serverCanonical = clone(target?.serverCanonical ?? source?.serverCanonical);
        }
        // Concurrent first-use devices intentionally create the same four
        // stable preset IDs. The server's same-ID create response is canonical
        // adoption for bootstrap work, not a teacher-visible conflict. This is
        // deliberately restricted to the four Product-owned bootstrap IDs;
        // ordinary/custom Timing Profile creates keep normal conflict handling.
        const diagnostic = isDefaultTimeProfileBootstrapAdoption(
          currentMutation, result, canonical, canonicalId,
        ) || isTimingSelectionCanonicalConvergence(currentMutation, result, canonical)
          ? null
          : conflictDiagnostic(currentMutation, result, stamp);
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
          const next = { ...(existing ?? {}), ...row, serverCanonical: canonicalSnapshot(row) };
          delete next.syncCreatePending;
          pushUniquePut(writes.enrollments, next);
        }
        const student = current.students.find((row) => row.id === payload.studentId);
        if (['conflict', 'rejected'].includes(result.outcome) && student) {
          pushUniquePut(writes.students, {
            ...student,
            syncConflicts: [...(student.syncConflicts ?? []), {
              lifecycle: 'historical_reconciled',
              mutationId: mutation.mutationId, outcome: result.outcome, groups: ['__membership__'],
              rejectedPatch: clone(payload), recordedAt: now(),
            }],
          });
        }
        const revisions = new Map(canonicalRows.map((row) => [row.id, normalizeRevision(row.serverRevision)]));
        const others = current.outbox.filter((row) => row.id !== mutation.id).map((row) => {
          const rewritten = remap ? rewriteMutationReferences(row, 'enrollments', remap.from, remap.to) : row;
          const revision = revisions.get(rewritten.recordId);
          if (rewritten.store !== 'enrollments' || revision == null || rewritten.envelopeLocked || rewritten.op === 'create') return rewritten;
          return { ...rewritten, baseRevision: revision, state: rewritten.state === 'blocked' ? 'pending' : rewritten.state, blockedReason: null };
        });
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
    const scope = { attendance: {}, sessionRosterSnapshots: {}, outbox: {} };
    await database.applyBatch(scope, {
      prepare(current) {
        const currentMutation = current.outbox.find((row) => row.id === mutation.id);
        if (!currentMutation) return Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const writes = Object.fromEntries(Object.keys(scope).map((store) => [store, operationBatch()]));
        const adopted = adoptAttendanceCanonical(current, attendance, current.outbox.filter((row) => row.id !== mutation.id));
        const diagnostic = conflictDiagnostic(currentMutation, result, now());
        let next = adopted.record;
        if (diagnostic) next.syncConflicts = [...(next.syncConflicts ?? []),diagnostic];
        if (snapshot?.id) {
          const existingSnapshot = current.sessionRosterSnapshots.find((row) => row.id === snapshot.id);
          pushUniquePut(writes.sessionRosterSnapshots, { ...(existingSnapshot ?? {}), ...snapshot, serverCanonical: canonicalSnapshot(snapshot) });
        }
        let others = adopted.outbox;
        const successors = pendingAttendanceForRecord(others, attendance);
        others = others.map((row) => {
          if (!adopted.acceptCanonical || result.outcome !== 'applied' || row.envelopeLocked ||
              row.command !== 'attendance:record' || row.sequence <= mutation.sequence ||
              !successors.some((candidate) => candidate.id === row.id)) return row;
          return { ...row, baseRevision: Math.max(normalizeRevision(row.baseRevision), next.serverRevision),
            state: row.state === 'blocked' ? 'pending' : row.state, blockedReason: null };
        });
        next = overlayMutations(next, pendingAttendanceForRecord(others, next), next.deleted === true);
        writes.attendance.remove.push(...adopted.remove);
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

  async function reconcileFillAttendanceReceipt(mutation, receipt) {
    if (receipt?.mutationId !== mutation.mutationId) throw new Error('Sync V2 fill receipt mutationId mismatch');
    const snapshot = decodeSyncV2Canonical('sessionRosterSnapshots', receipt.snapshot);
    const skippedIds = new Set((receipt.skipped ?? []).map((row) => row?.id));
    const rows = [...(receipt.applied ?? []), ...(receipt.skipped ?? [])]
      .map((row) => decodeSyncV2Canonical('attendance', row)).filter(Boolean);
    await database.applyBatch({ attendance: {}, sessionRosterSnapshots: {}, outbox: {} }, {
      prepare(current) {
        if (!current.outbox.some((row) => row.id === mutation.id)) return {};
        let others = current.outbox.filter((row) => row.id !== mutation.id);
        const remove = [];
        const attendance = rows.map((row) => {
          const adopted = adoptAttendanceCanonical(current,row,others);
          others = adopted.outbox;
          remove.push(...adopted.remove);
          // Only a row created by THIS successful fill supplies a causal base.
          // Skipped rows may contain another device's work; retain stale-base
          // conflict protection, and never change already-sent envelopes.
          if (adopted.acceptCanonical && !skippedIds.has(row.id)) {
            const successors = pendingAttendanceForRecord(others,row);
            others = others.map((pending) => {
              if (pending.command !== 'attendance:record' || pending.envelopeLocked ||
                  pending.sequence <= mutation.sequence ||
                  !successors.some((candidate) => candidate.id === pending.id)) return pending;
              return { ...pending, baseRevision: Math.max(normalizeRevision(pending.baseRevision), row.serverRevision),
                state: pending.state === 'blocked' ? 'pending' : pending.state, blockedReason: null };
            });
          }
          let next = adopted.record;
          if (skippedIds.has(row.id)) next.bulkDisposition = { mutationId: mutation.mutationId,
            outcome: 'skipped', canonicalRevision: row.serverRevision, recordedAt: now() };
          next = overlayMutations(next, pendingAttendanceForRecord(others,row), next.deleted === true);
          return next;
        });
        return {
          attendance: { put: attendance, remove },
          sessionRosterSnapshots: { put: snapshot ? [{ ...current.sessionRosterSnapshots.find((row) => row.id === snapshot.id),
            ...snapshot, serverCanonical: canonicalSnapshot(snapshot) }] : [], remove: [] },
          outbox: { put: others.filter((row) => row !== current.outbox.find((prior) => prior.id === row.id)), remove: [mutation.id] },
        };
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
      const retiredItemIds = new Set(mappings.filter(([from, to, store]) => store === 'items' && from !== to).map(([from]) => from));
      const rewritten = current.outbox.filter((row) => row.id !== mutation.id).map((row) => mappings.reduce((next, [from, to, store]) => rewriteMutationReferences(next, store, from, to), row));
      for (const [from, to, store] of mappings) {
        if (from !== to) writes[store].remove.push(from);
        for (const candidateStore of SYNC_V2_STORES) for (const record of current[candidateStore]) {
          // Retired defaults are replaced by the receipt, not re-put with a new Teaching reference.
          if (candidateStore === 'items' && retiredItemIds.has(record.id)) continue;
          const next = rewriteReferenceRecord(candidateStore, record, store, from, to);
          if (next !== record) pushUniquePut(writes[candidateStore], next);
        }
      }
      const nextTeaching = { ...(localTeaching ?? {}), ...teaching, serverCanonical: canonicalSnapshot(teaching) };
      delete nextTeaching.syncCreatePending;
      pushUniquePut(writes.teachings, nextTeaching);
      for (const item of items) {
        const nextItem = { ...(current.items.find((row) => row.id === item.id) ?? {}), ...item, serverCanonical: canonicalSnapshot(item) };
        delete nextItem.syncCreatePending;
        pushUniquePut(writes.items, nextItem);
      }
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
      const deletingThisSession = mutation.command === 'session:delete' && dependency.store === 'sessions' &&
        [mutation.recordId, mutation.serverRecordId, mutation.canonicalId].includes(dependency.recordId);
      if (parent.deleted && !deletingThisSession) return { state: 'rejected', reason: 'dependency-deleted' };
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

  async function markOwnershipBlocked(mutation, access) {
    await database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const existing = current.outbox.find((row) => row.id === mutation.id);
        if (!existing) return { outbox: operationBatch() };
        return {
          outbox: {
            put: [{
              ...existing,
              state: 'blocked',
              blockedReason: `ownership:${access.reason}`,
              lastError: {
                message: `Sync ownership blocked: ${access.reason}`,
                code: SYNC_OWNERSHIP_BLOCKED,
                retryable: false,
                at: now(),
              },
            }],
            remove: [],
          },
        };
      },
    });
  }

  // The 01C client could persist a complete local score but queue only its
  // edited value for CREATE. Repair only that exact rejected server signature.
  // The rejected envelope remains durable evidence; an atomic new command is
  // created with a fresh identity and the original is marked superseded.
  async function recoverRejectedScoreCreates() {
    const workspace = ownershipGuard.getWorkspace();
    if (workspace?.type !== 'account' || workspace.ownershipState !== 'claimed') return 0;
    const outbox = await database.getAll('outbox');
    let recovered = 0;
    for (const original of outbox) {
      if (original?.protocol !== 'v2' || original.state !== 'rejected' ||
          !missingScoreCreateIdentity(original) || original.lastError?.code !== '23503' ||
          !String(original.lastError?.message ?? '').includes('STUDENT_TOMBSTONED') ||
          !ownershipGuard.cloudAccess({ operation: 'dispatch',
            authenticatedUserId: currentAuthenticatedUserId(), command: original }).allowed) continue;
      await database.applyBatch({ scores: {}, students: {}, items: {}, outbox: {} }, {
        prepare(current) {
          const prior = current.outbox.find((row) => row.id === original.id);
          const score = current.scores.find((row) => row.id === original.recordId);
          const student = current.students.find((row) => row.id === score?.studentId);
          const item = current.items.find((row) => row.id === score?.itemId);
          const other = current.outbox.some((row) => row.id !== original.id && row.state !== 'superseded' &&
            row.store === 'scores' && row.recordId === original.recordId);
          if (!prior || prior.state !== 'rejected' || !missingScoreCreateIdentity(prior) ||
              prior.lastError?.code !== '23503' ||
              !String(prior.lastError?.message ?? '').includes('STUDENT_TOMBSTONED') ||
              !score || score.deleted || Number(score.serverRevision ?? 0) !== 0 ||
              !score.studentId || !score.itemId || !student || student.deleted || student.status !== 'active' ||
              !item || item.deleted || other ||
              !hasOwn(prior.localPatch ?? {}, 'value') ||
              !Object.is(prior.localPatch.value, score.value)) return { outbox: operationBatch() };
          const localPatch = Object.fromEntries(Object.keys(SYNC_V2_SCHEMAS.scores.fields)
            .filter((field) => hasOwn(score, field)).map((field) => [field, clone(score[field])]));
          const patch = encodeSyncV2Patch('scores', localPatch);
          if (!patch.student_id || !patch.item_id) return { outbox: operationBatch() };
          const mutationId = makeId();
          const stamp = now();
          const replacement = ownershipGuard.bindNewCommand({
            id: `v2:${mutationId}`, protocol: 'v2', mutationId, deviceId: prior.deviceId,
            store: 'scores', entity: 'scores', recordId: score.id,
            serverRecordId: score.canonicalId ?? score.id, canonicalId: score.canonicalId ?? score.id,
            logicalRecordKey: `scores:${score.canonicalId ?? score.id}`, op: 'create', baseRevision: 0,
            patch, localPatch, fields: Object.keys(patch).sort(), groups: [],
            dependencies: inferredDependencies('scores', score, current, []),
            sequence: sortMutations(current.outbox).reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1,
            clientUpdatedAt: score.updatedAt ?? stamp, queuedAt: stamp,
            state: 'pending', attemptCount: 0, envelopeLocked: false,
            lastError: null, blockedReason: null,
          });
          recovered++;
          return { outbox: { put: [{ ...prior, state: 'superseded', supersededByMutationId: mutationId,
            supersededAt: stamp, recoveryReason: 'score-create-identity-01c' }, replacement], remove: [] } };
        },
      });
    }
    return recovered;
  }

  function isRejectedProtocolError(error) {
    const status = Number(error?.status);
    return error?.code === '22023' || error?.code === '23503' ||
      status === 400 || status === 409 || status === 422;
  }

  async function reconcileScoreDomainReceipt(mutation, receipt) {
    if (receipt?.mutationId !== mutation.mutationId) {
      throw new Error('Score domain receipt mutationId mismatch');
    }
    const configuration = ['score:configure', 'score:copy_definition', 'score:rename'].includes(mutation.command);
    const score = configuration ? null : decodeSyncV2Canonical('scores', receipt.score);
    const completion = receipt.completion
      ? decodeSyncV2Canonical('scoreSubitemCompletions', receipt.completion) : null;
    const item = configuration ? decodeSyncV2Canonical('items', receipt.item) : null;
    const subitems = configuration ? (receipt.subitems ?? []).map((row) =>
      decodeSyncV2Canonical('scoreSubitems', row)) : [];
    const scores = configuration ? (receipt.scores ?? []).map((row) =>
      decodeSyncV2Canonical('scores', row)) : [score];
    if (configuration ? !item?.id || subitems.some((row) => !row?.id) || scores.some((row) => !row?.id)
      : !score?.id || (mutation.command === 'score:set_completion' && !completion?.id)) {
      throw new Error('Score domain receipt is incomplete');
    }
    await database.applyBatch({ items: {}, scoreSubitems: {}, scoreSubitemCompletions: {}, scores: {}, outbox: {} }, {
      prepare(current) {
        const pending = current.outbox.filter((row) => row.id !== mutation.id &&
          String(row.command ?? '').startsWith('score:') && row.state !== 'rejected');
        const protectedByLaterCommand = (store, row) => pending.some((command) => {
          if (command.sequence <= mutation.sequence) return false;
          if (store === 'items' || store === 'scoreSubitems') {
            return command.command === 'score:configure' &&
              command.patch?.itemId === (store === 'items' ? row.id : row.itemId);
          }
          if (store === 'scores') return command.patch?.itemId === row.itemId &&
            (command.command === 'score:configure' || command.patch?.studentId === row.studentId);
          return command.command === 'score:set_completion' &&
            command.patch?.studentId === row.studentId && command.patch?.subitemId === row.subitemId;
        });
        const adopt = (store, rows) => rows.filter(Boolean).map((row) => {
          const local = current[store].find((candidate) => candidate.id === row.id);
          if (local && protectedByLaterCommand(store, row)) return local;
          const next = { ...(local ?? {}), ...row, serverCanonical: canonicalSnapshot(row) };
          delete next.syncCreatePending;
          return next;
        });
        return {
          items: { put: adopt('items', item ? [item] : []) },
          scoreSubitems: { put: adopt('scoreSubitems', subitems) },
          scoreSubitemCompletions: { put: adopt('scoreSubitemCompletions', completion ? [completion] : []) },
          scores: { put: adopt('scores', scores) },
          outbox: { remove: [mutation.id] },
        };
      },
    });
  }

  async function reconcileDistributionReceipt(mutation, receipt) {
    const entries = [['items', 'items'], ['scoreSubitems', 'score_subitems'],
      ['scoreSubitemCompletions', 'score_subitem_completions'], ['scores', 'scores']];
    if (receipt?.mutationId !== mutation.mutationId || receipt?.planId !== mutation.patch.planId ||
        receipt?.protocol !== 'N73_D119_V2') throw new Error('Distribution receipt binding mismatch');
    const owner = currentAuthenticatedUserId();
    const access = ownershipGuard.cloudAccess({ operation: 'dispatch', authenticatedUserId: owner, command: mutation });
    if (!access.allowed) throw ownershipBlockedError(access);
    const canonical = Object.fromEntries(entries.map(([store, entity]) => {
      const rows = receipt[entity];
      if (!Array.isArray(rows) || rows.some(row => row.owner_id !== owner || !row.id || !normalizeRevision(row.revision)) ||
          new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Distribution receipt owner or row mismatch');
      return [store, rows.map(row => decodeSyncV2Canonical(store, row))];
    }));
    await database.applyBatch({ items: {}, scoreSubitems: {}, scoreSubitemCompletions: {}, scores: {}, outbox: {} }, {
      prepare(current) {
        if (owner !== currentAuthenticatedUserId()) throw new Error('Distribution owner changed');
        const result = { outbox: { remove: [mutation.id] } };
        for (const [store] of entries) result[store] = { put: canonical[store].map(row => {
          const prior = current[store].find(local => local.id === row.id);
          // A later local command remains an overlay. The canonical tombstone
          // always wins and cannot be resurrected by that stale command.
          const later = current.outbox.some(command => command.id !== mutation.id && command.sequence > mutation.sequence &&
            command.state !== 'rejected' && (command.store === store && command.recordId === row.id ||
              command.patch?.itemId === (store === 'items' ? row.id : row.itemId)));
          if (later && prior && !row.deleted) return { ...prior, serverRevision: row.serverRevision,
            fieldRevisions: row.fieldRevisions, serverCanonical: canonicalSnapshot(row) };
          const next = { ...(prior ?? {}), ...row, serverCanonical: canonicalSnapshot(row) };
          delete next.syncCreatePending; return next;
        }) };
        return result;
      },
    });
  }

  async function dispatchPending({ maxMutations = Infinity, onlyMutationId = null } = {}) {
    await recoverRejectedScoreCreates();
    const snapshot = sortMutations((await database.getAll('outbox')).filter((row) => row.protocol === 'v2'));
    const stoppedKeys = new Set();
    const result = { attempted: 0, acknowledged: 0, failed: 0, blocked: 0 };

    for (const original of snapshot) {
      if (onlyMutationId && original.mutationId !== onlyMutationId) continue;
      if (result.attempted >= maxMutations) break;
      const ownership = ownershipGuard.cloudAccess({
        operation: 'dispatch',
        authenticatedUserId: currentAuthenticatedUserId(),
        command: original,
      });
      if (!ownership.allowed) {
        await markOwnershipBlocked(original, ownership);
        stoppedKeys.add(original.logicalRecordKey);
        result.blocked++;
        result.ownershipBlocked = (result.ownershipBlocked ?? 0) + 1;
        result.blockReason ??= ownership.reason;
        continue;
      }
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
        if (liveRows.some((row) => row.sequence < live.sequence && row.patch?.sessionId === live.patch.sessionId &&
            (row.command === 'attendance:fill' ||
              (row.command === 'attendance:record' && row.patch?.studentId === live.patch.studentId)))) {
          await markDependencyBlock(live, 'attendance-predecessor-pending');
          stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
        }
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
      if (original.op === 'command' && original.command === 'session:delete' &&
          typeof transport.applySessionDeleteCommand === 'function') {
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
          const receipt = await transport.applySessionDeleteCommand({
            mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            sessionId: mutation.patch.sessionId, clientUpdatedAt: mutation.clientUpdatedAt,
          });
          if (receipt?.mutationId !== mutation.mutationId) throw new Error('Sync V2 session delete receipt mutationId mismatch');
          const canonical = decodeSyncV2Canonical('sessions', receipt.session);
          await database.applyBatch({ sessions: {}, outbox: {} }, {
            prepare(current) {
              const existing = current.sessions.find((row) => row.id === mutation.recordId);
              const session = canonical ? {
                ...(existing ?? {}), ...canonical,
                serverCanonical: canonicalSnapshot(canonical),
                ...(receipt.outcome === 'protected' ? {
                  deleteProtection: { mutationId: mutation.mutationId, reason: receipt.reason ?? 'retained-evidence', recordedAt: now() },
                } : {}),
              } : existing;
              if (session && receipt.outcome !== 'protected') delete session.deleteProtection;
              return {
                sessions: { put: session ? [session] : [], remove: [] },
                outbox: { put: [], remove: [mutation.id] },
              };
            },
          });
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
          (typeof transport.applyLifecycleCommand === 'function' || typeof transport.applySectionLifecycleCommand === 'function')) {
        const live = (await database.getAll('outbox')).find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, (await database.getAll('outbox')).filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') { await markDependencyBlock(live, readiness.reason); result.blocked++; continue; }
        if (readiness.state === 'rejected') { await markRejected(live, readiness.reason); result.blocked++; continue; }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const command = mutation.command.slice('lifecycle:'.length);
          const sectionLifecycle = ['archive_class', 'reopen_class'].includes(command);
          const apply = sectionLifecycle && typeof transport.applySectionLifecycleCommand === 'function'
            ? transport.applySectionLifecycleCommand : transport.applyLifecycleCommand;
          const receipt = await apply({ mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            command, targetId: mutation.patch.targetId, archiveDate: mutation.patch.archiveDate ?? null,
            clientUpdatedAt: mutation.clientUpdatedAt });
          if (receipt?.mutationId !== mutation.mutationId) throw new Error('Sync V2 lifecycle receipt mutationId mismatch');
          const canonicalSection = sectionLifecycle ? decodeSyncV2Canonical('sections', receipt.section) : null;
          await database.applyBatch(sectionLifecycle ? { sections: {}, outbox: {} } : { outbox: {} }, {
            prepare: (current) => ({
              ...(sectionLifecycle ? { sections: {
                put: canonicalSection ? [{ ...(current.sections.find((row) => row.id === canonicalSection.id) ?? {}),
                  ...canonicalSection, serverCanonical: canonicalSnapshot(canonicalSection) }] : [], remove: [],
              } } : {}),
              outbox: { put: [], remove: [mutation.id] },
            }),
          });
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
        try { const receipt=await transport.applyFillAttendanceCommand({mutationId:mutation.mutationId,deviceId:mutation.deviceId,sessionId:mutation.patch.sessionId,status:mutation.patch.status,clientUpdatedAt:mutation.clientUpdatedAt});
          await reconcileFillAttendanceReceipt(mutation, receipt); result.acknowledged++;
        } catch(error){if(isRejectedProtocolError(error))await markRejected(mutation,'protocol-rejected',error);else await markFailure(mutation,error);if(isRejectedProtocolError(error))result.blocked++;else result.failed++;} continue;
      }
      if (original.op === 'command' && String(original.command ?? '').startsWith('term-report:') &&
          typeof transport.applyClosedTermReportCommand === 'function') {
        const live = (await database.getAll('outbox')).find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, (await database.getAll('outbox')).filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') { await markDependencyBlock(live, readiness.reason); result.blocked++; continue; }
        if (readiness.state === 'rejected') { await markRejected(live, readiness.reason); result.blocked++; continue; }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = await transport.applyClosedTermReportCommand({
            mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            command: mutation.command.slice('term-report:'.length),
            termId: mutation.patch.termId, reportId: mutation.patch.reportId,
            supersedesId: mutation.patch.supersedesId,
            sourceManifest: clone(mutation.patch.sourceManifest), payload: clone(mutation.patch.payload),
            clientUpdatedAt: mutation.clientUpdatedAt,
          });
          if (receipt?.mutationId !== mutation.mutationId) throw new Error('Closed-term report receipt mutationId mismatch');
          if (receipt.outcome === 'rejected_source_changed') {
            await database.remove('outbox', mutation.id);
            result.acknowledged++;
            continue;
          }
          const report = decodeSyncV2Canonical('closedTermReports', receipt.report);
          const term = decodeSyncV2Canonical('terms', receipt.term);
          if (!report?.id || report.state !== 'complete' || !term?.id) throw new Error('Closed-term report receipt is incomplete');
          await database.applyBatch({ closedTermReports: {}, terms: {}, outbox: {} }, {
            prepare(current) {
              const currentReport = current.closedTermReports.find((row) => row.id === report.id);
              const currentTerm = current.terms.find((row) => row.id === term.id);
              return {
                closedTermReports: { put: [{ ...(currentReport ?? {}), ...report, serverCanonical: canonicalSnapshot(report) }], remove: [] },
                terms: { put: [{ ...(currentTerm ?? {}), ...term, serverCanonical: canonicalSnapshot(term) }], remove: [] },
                outbox: { put: [], remove: [mutation.id] },
              };
            },
          });
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
          else await markFailure(mutation, error);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
      }
      if (original.op === 'command' && original.command === 'class-goal:reward' &&
          typeof transport.applyClassGoalRewardCommand === 'function') {
        const liveRows = sortMutations(await database.getAll('outbox'));
        const live = liveRows.find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, liveRows.filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') { await markDependencyBlock(live, readiness.reason); result.blocked++; continue; }
        if (readiness.state === 'rejected') { await markRejected(live, readiness.reason); result.blocked++; continue; }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = await transport.applyClassGoalRewardCommand({
            mutationId: mutation.mutationId, deviceId: mutation.deviceId,
            goalId: mutation.patch.goalId, runId: mutation.patch.runId,
            clientUpdatedAt: mutation.clientUpdatedAt,
          });
          if (receipt?.mutationId !== mutation.mutationId) throw new Error('Class goal reward receipt mutationId mismatch');
          const goal = decodeSyncV2Canonical('classGoals', receipt.goal);
          const logs = (receipt.logs ?? []).map((row) => decodeSyncV2Canonical('logs', row)).filter(Boolean);
          if (!goal?.id || goal.state !== 'completed') throw new Error('Class goal reward receipt is incomplete');
          await database.applyBatch({ classGoals: {}, logs: {}, outbox: {} }, {
            prepare(current) {
              return {
                classGoals: { put: [{ ...(current.classGoals.find((row) => row.id === goal.id) ?? {}), ...goal, serverCanonical: canonicalSnapshot(goal) }], remove: [] },
                logs: { put: logs.map((row) => ({ ...(current.logs.find((item) => item.id === row.id) ?? {}), ...row, serverCanonical: canonicalSnapshot(row) })), remove: [] },
                outbox: { put: [], remove: [mutation.id] },
              };
            },
          });
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
          else await markFailure(mutation, error);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
      }
      if (original.op === 'command' && String(original.command ?? '').startsWith('score:')) {
        if (stoppedKeys.has(original.logicalRecordKey)) { result.blocked++; continue; }
        const liveRows = sortMutations(await database.getAll('outbox'));
        const live = liveRows.find((row) => row.id === original.id);
        if (!live) continue;
        const readiness = await dependencyReadiness(live, liveRows.filter((row) => row.id !== live.id));
        if (readiness.state === 'blocked') {
          await markDependencyBlock(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey);
          result.blocked++; continue;
        }
        if (readiness.state === 'rejected') {
          await markRejected(live, readiness.reason); stoppedKeys.add(live.logicalRecordKey);
          result.blocked++; continue;
        }
        if (live.command === 'score:copy_definition' && !live.envelopeLocked &&
            !Number(live.patch.sourceRevision)) {
          const source = await database.get('items', live.patch.sourceItemId);
          if (!normalizeRevision(source?.serverRevision)) {
            await markDependencyBlock(live, 'copy-source-not-authoritative');
            stoppedKeys.add(live.logicalRecordKey); result.blocked++; continue;
          }
          await database.applyBatch({ outbox: {} }, { prepare(current) {
            const existing = current.outbox.find((row) => row.id === live.id);
            if (!existing || existing.envelopeLocked) return { outbox: operationBatch() };
            return { outbox: { put: [{ ...existing, patch: {
              ...existing.patch, sourceRevision: normalizeRevision(source.serverRevision),
            } }] } };
          } });
        }
        const mutation = await markAttempt(live);
        result.attempted++;
        try {
          const receipt = mutation.command === 'score:distribution_apply'
            ? await transport.applyScoreDistributionPlan({ mutationId: mutation.mutationId,
              deviceId: mutation.deviceId, ...clone(mutation.patch) })
            : mutation.command === 'score:rename'
            ? await transport.renameScoreItem({ mutationId: mutation.mutationId,
              deviceId: mutation.deviceId, ...clone(mutation.patch) })
            : mutation.command === 'score:copy_definition'
            ? await transport.applyScoreDistributionCopyCommand({ mutationId: mutation.mutationId,
              deviceId: mutation.deviceId, sourceItemId: mutation.patch.sourceItemId,
              sourceRevision: mutation.patch.sourceRevision,
              targetTeachingId: mutation.patch.targetTeachingId,
              newItemId: mutation.patch.newItemId, subitemIds: clone(mutation.patch.subitemIds),
              conflictChoice: mutation.patch.conflictChoice })
            : mutation.command === 'score:configure'
            ? await transport.applyScoreConfigurationCommand({ mutationId: mutation.mutationId,
              deviceId: mutation.deviceId, itemId: mutation.patch.itemId,
              expectedVersion: mutation.patch.expectedVersion, payload: clone(mutation.patch.payload) })
            : await transport.applyScoreSubitemCommand({ mutationId: mutation.mutationId,
              deviceId: mutation.deviceId, command: mutation.command.slice('score:'.length),
              itemId: mutation.patch.itemId, studentId: mutation.patch.studentId,
              subitemId: mutation.patch.subitemId ?? null, checked: mutation.patch.checked ?? null,
              manualValue: mutation.patch.manualValue ?? null,
              ...(Object.hasOwn(mutation.patch, 'completionState') ? { completionState: mutation.patch.completionState } : {}) });
          if (mutation.command === 'score:distribution_apply') await reconcileDistributionReceipt(mutation, receipt);
          else await reconcileScoreDomainReceipt(mutation, receipt);
          result.acknowledged++;
        } catch (error) {
          if (isRejectedProtocolError(error)) await markRejected(mutation, 'protocol-rejected', error);
          else await markFailure(mutation, error);
          stoppedKeys.add(mutation.logicalRecordKey);
          if (isRejectedProtocolError(error)) result.blocked++; else result.failed++;
        }
        continue;
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

      if (missingScoreCreateIdentity(live)) {
        await markRejected(live, 'score-create-identity-missing');
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
        const recordWrites = operationBatch();
        const outboxWrites = operationBatch();
        let workingOutbox = current.outbox;
        for (const row of canonicalRows) {
          const canonical = decodeSyncV2Canonical(store, row);
          if (!canonical?.id) continue;
          if (store === 'attendance') {
            const adopted = adoptAttendanceCanonical(current,canonical,workingOutbox);
            workingOutbox = adopted.outbox;
            const next = overlayMutations(adopted.record,pendingAttendanceForRecord(workingOutbox,canonical),adopted.record.deleted === true);
            pushUniquePut(recordWrites,next);
            recordWrites.remove.push(...adopted.remove);
            for (const mutation of workingOutbox) {
              if (mutation !== current.outbox.find((prior) => prior.id === mutation.id)) pushUniquePut(outboxWrites,mutation);
            }
            continue;
          }
          const existing = current[store].find((record) => record.id === canonical.id) ?? null;
          if (existing && normalizeRevision(existing.serverRevision) > normalizeRevision(canonical.serverRevision)) continue;
          const pendingScoreDomain = existing && current.outbox.some((mutation) => {
            if (mutation.protocol !== 'v2' || !String(mutation.command ?? '').startsWith('score:') ||
                mutation.state === 'rejected') return false;
            const patch = mutation.patch ?? {};
            if (store === 'items') return mutation.command === 'score:configure' && patch.itemId === existing.id;
            if (store === 'scoreSubitems') return mutation.command === 'score:configure' && patch.itemId === existing.itemId;
            if (store === 'scoreSubitemCompletions') return mutation.command === 'score:set_completion' &&
              patch.studentId === existing.studentId && patch.subitemId === existing.subitemId;
            if (store === 'scores') return patch.itemId === existing.itemId &&
              (mutation.command === 'score:configure' || patch.studentId === existing.studentId);
            return false;
          });
          if (pendingScoreDomain) continue; // Keep the complete optimistic local projection until its domain receipt.
          // The offline-first bootstrap runs before Auth and therefore cannot
          // know whether this account already owns its singleton/default rows.
          // A pull of the same durable identity is authoritative proof that the
          // bootstrap create is redundant. Adopt it without dispatching a
          // guaranteed create-existing conflict, while retaining and rebasing
          // any later teacher-authored mutation for that record.
          const bootstrapCreates = current.outbox.filter((mutation) =>
            mutation.protocol === 'v2' && mutation.bootstrap === true && mutation.store === store &&
            mutation.op === 'create' &&
            [mutation.recordId, mutation.serverRecordId, mutation.canonicalId].includes(canonical.id));
          const bootstrapIds = new Set(bootstrapCreates.map((mutation) => mutation.id));
          const remainingOutbox = current.outbox.filter((mutation) => !bootstrapIds.has(mutation.id));
          const rebasedOutbox = bootstrapIds.size ? remainingOutbox.map((mutation) => {
            if (mutation.protocol !== 'v2' || mutation.store !== store || mutation.op === 'create' ||
                mutation.envelopeLocked ||
                ![mutation.recordId, mutation.serverRecordId, mutation.canonicalId].includes(canonical.id)) return mutation;
            return {
              ...mutation,
              baseRevision: normalizeRevision(canonical.serverRevision),
              state: mutation.state === 'blocked' ? 'pending' : mutation.state,
              blockedReason: null,
            };
          }) : remainingOutbox;
          const conflicts = existing?.syncConflicts;
          let next = { ...(existing ?? {}), ...canonical };
          delete next.syncCreatePending;
          next.serverCanonical = canonicalSnapshot(canonical);
          if (conflicts?.length) next.syncConflicts = conflicts;
          next = overlayMutations(
            next,
            pendingForRecord(rebasedOutbox, store, [canonical.id]),
            canonical.deleted === true,
          );
          pushUniquePut(recordWrites, next);
          outboxWrites.remove.push(...bootstrapIds);
          for (const mutation of rebasedOutbox) {
            const previous = current.outbox.find((candidate) => candidate.id === mutation.id);
            if (previous && JSON.stringify(previous) !== JSON.stringify(mutation)) {
              pushUniquePut(outboxWrites, mutation);
            }
          }
        }
        return { [store]: recordWrites, outbox: outboxWrites };
      },
    });
  }

  async function pullStore(store) {
    const ownership = ownershipGuard.cloudAccess({
      operation: 'pull', authenticatedUserId: currentAuthenticatedUserId(),
    });
    if (!ownership.allowed) throw ownershipBlockedError(ownership);
    const schema = schemaFor(store);
    const rows = await transport.fetchRecords(schema.entity);
    if (!Array.isArray(rows)) throw new Error(`Sync V2 pull expected an array for ${schema.entity}`);
    await reconcilePull(store, rows);
    return rows.length;
  }

  async function pullScoreDomainSnapshot() {
    if (typeof transport.getScoreDomainSnapshot !== 'function') {
      throw new Error('Atomic score-domain snapshot transport is unavailable');
    }
    const raw = await transport.getScoreDomainSnapshot();
    const entries = [
      ['items', 'items'], ['scoreSubitems', 'score_subitems'],
      ['scoreSubitemCompletions', 'score_subitem_completions'], ['scores', 'scores'],
    ];
    const canonical = {};
    for (const [store, key] of entries) {
      if (!Array.isArray(raw?.[key])) throw new Error(`Incomplete atomic score-domain snapshot: ${key}`);
      canonical[store] = raw[key].map((row) => {
        if (row?.owner_id !== currentAuthenticatedUserId()) {
          throw new Error('Atomic score-domain snapshot owner mismatch');
        }
        const decoded = decodeSyncV2Canonical(store, row);
        if (!decoded?.id) throw new Error(`Invalid atomic score-domain row: ${key}`);
        return decoded;
      });
    }
    const itemIds = new Set(canonical.items.map((row) => row.id));
    const definitions = new Map(canonical.scoreSubitems.map((row) => [row.id, row]));
    const scorePairs = new Map(canonical.scores.filter((row) => !row.deleted)
      .map((row) => [`${row.studentId}\0${row.itemId}`, row]));
    for (const row of canonical.scoreSubitems) {
      if (!itemIds.has(row.itemId)) throw new Error('Score-domain snapshot has an orphan definition');
    }
    for (const row of canonical.scoreSubitemCompletions) {
      if (!definitions.has(row.subitemId)) throw new Error('Score-domain snapshot has an orphan completion');
    }
    const pairs = new Set([...scorePairs.keys(), ...canonical.scoreSubitemCompletions
      .filter((row) => row.checked && !row.deleted && !definitions.get(row.subitemId)?.deleted)
      .map((row) => `${row.studentId}\0${definitions.get(row.subitemId).itemId}`)]);
    for (const pair of pairs) {
      const [studentId, itemId] = pair.split('\0');
      const item = canonical.items.find((row) => row.id === itemId);
      if (!item || item.deleted) continue;
      const score = scorePairs.get(pair);
      if (!score) throw new Error('Score-domain snapshot lacks a materialized score');
      const projected = projectSubitemScore(item,
        canonical.scoreSubitems.filter((row) => row.itemId === itemId),
        canonical.scoreSubitemCompletions.filter((row) => row.studentId === studentId),
        score.manualValue ?? null, { studentId });
      for (const field of ['derivedValue', 'manualValue', 'value']) {
        if (scoreCents(score[field], { allowBlank: true }) !==
            scoreCents(projected[field], { allowBlank: true })) {
          throw new Error('Score-domain snapshot projection disagrees with components');
        }
      }
    }
    await database.applyBatch({ items: {}, scoreSubitems: {}, scoreSubitemCompletions: {}, scores: {}, outbox: {} }, {
      prepare(current) {
        if (current.outbox.some((row) => row.protocol === 'v2' && row.state !== 'rejected' &&
            String(row.command ?? '').startsWith('score:'))) {
          return Object.fromEntries(entries.map(([store]) => [store, operationBatch()]));
        }
        const localDefinitions = new Map(current.scoreSubitems.map((row) => [row.id, row]));
        const covered = {
          items: (row) => itemIds.has(row.id),
          scoreSubitems: (row) => itemIds.has(row.itemId),
          scoreSubitemCompletions: (row) => itemIds.has(localDefinitions.get(row.subitemId)?.itemId),
          scores: (row) => itemIds.has(row.itemId),
        };
        const result = {};
        for (const [store] of entries) {
          const remoteIds = new Set(canonical[store].map((row) => row.id));
          const locallyPending = (row) => store === 'scores' && current.outbox.some((mutation) =>
            mutation.protocol === 'v2' && mutation.state !== 'superseded' &&
            mutation.store === 'scores' && mutation.recordId === row.id);
          result[store] = {
            put: canonical[store].filter((row) => !locallyPending(row)).map((row) => {
              const local = current[store].find((candidate) => candidate.id === row.id);
              return { ...(local ?? {}), ...row, serverCanonical: canonicalSnapshot(row) };
            }),
            remove: current[store].filter((row) => covered[store](row) && !remoteIds.has(row.id) && !locallyPending(row))
              .map((row) => row.id),
          };
        }
        return result;
      },
    });
    return Object.values(canonical).reduce((sum, rows) => sum + rows.length, 0);
  }

  async function pullAll({ stores = SYNC_V2_STORES, scoreDomainSnapshot = false, readConcurrency = 1 } = {}) {
    const ownership = ownershipGuard.cloudAccess({
      operation: 'pull', authenticatedUserId: currentAuthenticatedUserId(),
    });
    if (!ownership.allowed) {
      return {
        pulled: 0, failures: [], blocked: true, ownershipBlocked: true,
        blockReason: ownership.reason, retryable: false,
      };
    }
    await recoverRejectedScoreCreates();
    const result = { pulled: 0, failures: [], blocked: false, ownershipBlocked: false };
    const width = Number.isInteger(readConcurrency) ? Math.max(1, Math.min(4, readConcurrency)) : 1;
    // Fetch independent owner-filtered table snapshots in bounded groups.
    // Apply in the original store order: dependency/remap/overlay semantics
    // remain in reconcilePull, and the atomic score snapshot stays last.
    for (let offset = 0; offset < stores.length; offset += width) {
      const group = stores.slice(offset, offset + width);
      if (width === 1) {
        try { result.pulled += await pullStore(group[0]); }
        catch (error) { result.failures.push({ store: group[0], error }); }
        continue;
      }
      const owner = currentAuthenticatedUserId();
      const fetched = await Promise.allSettled(group.map(async (store) => {
        const access = ownershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: owner });
        if (!access.allowed) throw ownershipBlockedError(access);
        const rows = await transport.fetchRecords(schemaFor(store).entity);
        if (!Array.isArray(rows)) throw new Error(`Sync V2 pull expected an array for ${schemaFor(store).entity}`);
        return rows;
      }));
      for (let index = 0; index < group.length; index++) {
        const store = group[index], response = fetched[index];
        try {
          if (response.status === 'rejected') throw response.reason;
          const access = ownershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: currentAuthenticatedUserId() });
          if (owner !== currentAuthenticatedUserId() || !access.allowed) throw ownershipBlockedError(access);
          await reconcilePull(store, response.value);
          result.pulled += response.value.length;
        } catch (error) { result.failures.push({ store, error }); }
      }
    }
    if (scoreDomainSnapshot && !result.failures.length &&
        stores.some((store) => ['items', 'scores', 'scoreSubitems', 'scoreSubitemCompletions'].includes(store))) {
      try {
        result.pulled += await pullScoreDomainSnapshot();
      } catch (error) {
        result.failures.push({ store: 'scoreDomainSnapshot', error });
      }
    }
    return result;
  }

  async function sync(options = {}) {
    const pull = await pullAll(options);
    if (pull.ownershipBlocked) return { pull, push: null, status: await status() };
    const push = await dispatchPending(options);
    return { pull, push, status: await status() };
  }

  async function status() {
    const outbox = sortMutations((await database.getAll('outbox')).filter((row) => row.protocol === 'v2'));
    const recordsByStore = {};
    for (const store of SYNC_V2_STORES) {
      recordsByStore[store] = await database.getAll(store);
    }
    const summary = summarizeSyncV2OperationalState({ outbox, recordsByStore });
    return {
      ...summary,
      // Backward-compatible count names for existing internal callers.
      pending: summary.pendingCount,
      queued: summary.queuedCount,
      failed: summary.failedCount,
      blocked: summary.blockedCount,
      rejected: summary.rejectedCount,
    };
  }

  return {
    ensureDeviceId,
    commitMutation,
    queueCommand,
    queueEnrollmentCommand,
    queueAttendanceCommand,
    queueSessionDeleteCommand,
    queueLifecycleCommand,
    queueTeachingCreationCommand,
    queueFillAttendanceCommand,
    dispatchPending,
    recoverRejectedScoreCreates,
    reconcilePull,
    pullStore,
    pullAll,
    sync,
    status,
  };
}
