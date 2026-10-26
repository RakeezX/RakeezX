/**
 * Curriculum V2 integration candidate — SYNTHETIC LOCAL STAGING ONLY.
 * Additive object stores use the real Product IndexedDB transaction/lease guard.
 * No Product action imports this module, no live Outbox is created, and no
 * Supabase request is made before migration and owner/RLS verification.
 */
import * as defaultDB from './db.js';
import { evaluateSectionCurriculumScope, evaluateTeachingCourseBinding } from './curriculum-context-v2.js';
import { v2ScopeToCloud, v2BindingToCloud } from './curriculum-v2-sync-contract.js';

export const CURRICULUM_V2_SIDECAR_STORES = Object.freeze([
  'sectionCurriculumScopes', 'teachingCourseBindings',
]);
export const CURRICULUM_V2_STAGING_FORMAT = 'RAKEEZ_CURRICULUM_V2_SYNTHETIC_V1';

const fault = (code) => Object.assign(new Error(code), { code });
const required = (value) => typeof value === 'string' && value.trim().length > 0;
const active = (rows, id, code) => {
  const row = rows.find((entry) => entry.id === id && !entry.deleted);
  if (!row) throw fault(code);
  return row;
};
const unique = (rows) => new Set(rows.map((row) => row.id)).size === rows.length;
const hasValidTombstone = (row) => typeof row?.deleted === 'boolean' &&
  (row.deleted === true ? Number.isSafeInteger(Date.parse(row.deletedAt)) &&
    Date.parse(row.deletedAt) === row.updatedAt : row.deletedAt == null);
const hasNoActiveDuplicates = (rows, key) => {
  const active = rows.filter((r) => !r.deleted).map(key);
  return new Set(active).size === active.length;
};
const digest = async (value) => {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const pendingOutbox = (store, record, op = 'upsert') => ({
  id: `curriculum-v2-synthetic:${store}:${record.id}`,
  protocol: 'curriculum-v2-synthetic',
  ownerId: record.ownerId,
  store, recordId: record.id, op, state: 'pending',
  updatedAt: record.updatedAt, queuedAt: record.updatedAt,
  baseRevision: record.serverRevision ?? 0,
});

export function createCurriculumV2StagingBridge({
  database = defaultDB, currentOwner, clock = () => Date.now(),
  allowSyntheticWrites = false,
} = {}) {
  // Never allow accidental activation on the real account/database.
  const assertSynthetic = () => {
    if (!allowSyntheticWrites || database.getActiveDatabaseName() !== 'rakeezx-demo')
      throw fault('CURRICULUM_V2_STAGING_ONLY');
  };
  const assertOwner = (ownerId) => {
    assertSynthetic();
    if (!required(ownerId) || typeof currentOwner !== 'function' || currentOwner() !== ownerId)
      throw fault('CURRICULUM_V2_OWNER_CONTEXT_CHANGED');
  };
  const nextTime = (previous = null) => {
    const now = Number(clock());
    const value = Math.max(now, Number(previous?.updatedAt ?? 0) + 1);
    if (!Number.isSafeInteger(value) || value <= 0) throw fault('CURRICULUM_V2_CLOCK_INVALID');
    return value;
  };
  const validateScope = (draft) => {
    if (draft?.state !== 'draft' || draft.writeAllowed !== false || !required(draft.identity) ||
        !required(draft.ownerId) || !required(draft.sectionId)) throw fault('CURRICULUM_V2_SCOPE_DRAFT_INVALID');
    const proposed = evaluateSectionCurriculumScope({
      ownerId: draft.ownerId, sectionId: draft.sectionId, yearId: draft.yearId,
      program: draft.program, stage: draft.stage, level: draft.level,
      track: draft.track, legacyGrade: draft.legacyGrade,
    });
    if (proposed.state !== 'draft' || proposed.identity !== draft.identity ||
        proposed.scopeKey !== draft.scopeKey || proposed.edition !== draft.edition)
      throw fault('CURRICULUM_V2_SCOPE_SOURCE_MISMATCH');
  };
  const validateBinding = (draft, scope) => {
    if (draft?.state !== 'draft' || draft.writeAllowed !== false ||
        !required(draft.identity) || draft.ownerId !== scope.ownerId)
      throw fault('CURRICULUM_V2_BINDING_DRAFT_INVALID');
    const proposed = evaluateTeachingCourseBinding({
      ownerId: scope.ownerId, sectionScope: { ...scope, state: 'draft' },
      sectionId: draft.sectionId, teachingId: draft.teachingId,
      subjectId: draft.subjectId, termId: draft.termId, name: draft.courseName,
      kind: draft.kind, sourcePage: draft.sourcePage,
    });
    if (proposed.state !== 'draft' || proposed.identity !== draft.identity ||
        proposed.courseKey !== draft.courseKey || proposed.edition !== draft.edition)
      throw fault('CURRICULUM_V2_BINDING_SOURCE_MISMATCH');
  };
  const validateSection = (section, year, record) => {
    if (section.yearId !== record.yearId || year.id !== record.yearId ||
        (record.legacyGrade != null && Number(section.grade) !== Number(record.legacyGrade)))
      throw fault('CURRICULUM_V2_LEGACY_SECTION_MISMATCH');
    if ([section, year].some((row) => row.ownerId && row.ownerId !== record.ownerId))
      throw fault('CURRICULUM_V2_OWNER_CONTEXT_CHANGED');
  };

  async function saveScope(draft) {
    assertOwner(draft?.ownerId);
    validateScope(draft);
    let saved;
    await database.applyBatch({ years: {}, sections: {}, sectionCurriculumScopes: {}, outbox: {} }, {
      productWrite: true,
      prepare(current) {
        assertOwner(draft.ownerId);
        const section = active(current.sections, draft.sectionId, 'CURRICULUM_V2_SECTION_MISSING');
        const year = active(current.years, draft.yearId, 'CURRICULUM_V2_YEAR_MISSING');
        validateSection(section, year, draft);
        const existing = current.sectionCurriculumScopes.find((r) => r.id === draft.identity);
        if (existing?.deleted) throw fault('CURRICULUM_V2_TOMBSTONE_RESURRECTION');
        if (existing && existing.scopeKey !== draft.scopeKey)
          throw fault('CURRICULUM_V2_CONTEXT_CHANGE_REQUIRES_REVIEW');
        if (current.sectionCurriculumScopes.some((r) => !r.deleted &&
            r.ownerId === draft.ownerId && r.sectionId === draft.sectionId && r.id !== draft.identity))
          throw fault('CURRICULUM_V2_ACTIVE_SCOPE_COLLISION');
        saved = {
          id: draft.identity, ownerId: draft.ownerId, sectionId: draft.sectionId,
          yearId: draft.yearId, program: draft.program, stage: draft.stage,
          level: draft.level, track: draft.track, edition: draft.edition,
          scopeKey: draft.scopeKey, legacyGrade: draft.legacyGrade ?? null,
          sourceUrl: draft.dataSource, updatedAt: nextTime(existing),
          serverRevision: existing?.serverRevision ?? null,
          deleted: false, syncStatus: 'synthetic_staged_only',
        };
        return { sectionCurriculumScopes: { put: [saved] },
          outbox: { put: [pendingOutbox('sectionCurriculumScopes', saved)] } };
      },
    });
    assertOwner(draft.ownerId);
    return structuredClone(saved);
  }

  async function saveBinding(draft) {
    assertOwner(draft?.ownerId);
    let saved;
    await database.applyBatch({
      sectionCurriculumScopes: {}, teachingCourseBindings: {}, teachings: {},
      sections: {}, subjects: {}, terms: {}, outbox: {},
    }, {
      productWrite: true,
      prepare(current) {
        assertOwner(draft.ownerId);
        const scope = active(current.sectionCurriculumScopes, draft.sectionScopeIdentity, 'CURRICULUM_V2_SCOPE_MISSING');
        if (scope.ownerId !== draft.ownerId || scope.sectionId !== draft.sectionId)
          throw fault('CURRICULUM_V2_PARENT_MISMATCH');
        validateBinding(draft, scope);
        const teaching = active(current.teachings, draft.teachingId, 'CURRICULUM_V2_TEACHING_MISSING');
        const subject = active(current.subjects, draft.subjectId, 'CURRICULUM_V2_SUBJECT_MISSING');
        const term = active(current.terms, draft.termId, 'CURRICULUM_V2_TERM_MISSING');
        const section = active(current.sections, draft.sectionId, 'CURRICULUM_V2_SECTION_MISSING');
        if ([teaching, subject, term, section].some((row) => row.ownerId && row.ownerId !== draft.ownerId))
          throw fault('CURRICULUM_V2_OWNER_CONTEXT_CHANGED');
        if (teaching.sectionId !== section.id || teaching.subjectId !== subject.id ||
            teaching.termId !== term.id || term.yearId !== scope.yearId)
          throw fault('CURRICULUM_V2_LEGACY_BINDING_MISMATCH');
        const existing = current.teachingCourseBindings.find((r) => r.id === draft.identity);
        if (existing?.deleted) throw fault('CURRICULUM_V2_TOMBSTONE_RESURRECTION');
        if (existing && (existing.courseKey !== draft.courseKey ||
            existing.sectionScopeIdentity !== draft.sectionScopeIdentity))
          throw fault('CURRICULUM_V2_COURSE_CHANGE_REQUIRES_REVIEW');
        if (current.teachingCourseBindings.some((r) => !r.deleted &&
            r.ownerId === draft.ownerId && r.teachingId === draft.teachingId && r.id !== draft.identity))
          throw fault('CURRICULUM_V2_ACTIVE_BINDING_COLLISION');
        saved = {
          id: draft.identity, ownerId: draft.ownerId, sectionId: draft.sectionId,
          sectionScopeIdentity: draft.sectionScopeIdentity, teachingId: draft.teachingId,
          subjectId: draft.subjectId, termId: draft.termId, courseKey: draft.courseKey,
          name: draft.courseName, kind: draft.kind, sourceUrl: draft.sourceUrl,
          sourcePage: Number(draft.sourceUrl?.match(/#page=(\d+)/)?.[1]) || null,
          edition: draft.edition, updatedAt: nextTime(existing),
          serverRevision: existing?.serverRevision ?? null,
          deleted: false, syncStatus: 'synthetic_staged_only',
        };
        return { teachingCourseBindings: { put: [saved] },
          outbox: { put: [pendingOutbox('teachingCourseBindings', saved)] } };
      },
    });
    assertOwner(draft.ownerId);
    return structuredClone(saved);
  }

  async function retire(ownerId, store, id) {
    assertOwner(ownerId);
    if (!CURRICULUM_V2_SIDECAR_STORES.includes(store)) throw fault('CURRICULUM_V2_UNKNOWN_STORE');
    let retired;
    await database.applyBatch({
      [store]: {}, outbox: {}, ...(store === 'sectionCurriculumScopes' ? { teachingCourseBindings: {} } : {}),
    }, {
      productWrite: true,
      prepare(current) {
        assertOwner(ownerId);
        const row = current[store].find((r) => r.id === id && r.ownerId === ownerId);
        if (!row) throw fault('CURRICULUM_V2_FOREIGN_OR_MISSING_RECORD');
        if (store === 'sectionCurriculumScopes' &&
            current.teachingCourseBindings.some((r) => !r.deleted && r.ownerId === ownerId && r.sectionScopeIdentity === id))
          throw fault('CURRICULUM_V2_ACTIVE_BINDINGS');
        const updatedAt = nextTime(row);
        retired = row.deleted ? row : { ...row, deleted: true, deletedAt: new Date(updatedAt).toISOString(),
          updatedAt };
        return { [store]: { put: [retired] },
          outbox: { put: retired === row ? [] : [pendingOutbox(store, retired, 'delete')] } };
      },
    });
    assertOwner(ownerId);
    return structuredClone(retired);
  }

  async function snapshot(ownerId) {
    assertOwner(ownerId);
    const result = {};
    for (const name of CURRICULUM_V2_SIDECAR_STORES) {
      const rows = await database.getAll(name);
      assertOwner(ownerId);
      result[name] = rows.filter((r) => r.ownerId === ownerId).map((r) => structuredClone(r))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    return result;
  }
  async function backup(ownerId) {
    const data = await snapshot(ownerId);
    const unsigned = {
      format: CURRICULUM_V2_STAGING_FORMAT, version: 1, sourceOwnerId: ownerId, data,
    };
    return { ...unsigned, sha256: await digest(unsigned) };
  }
  async function previewCloudRows(ownerId) {
    const data = await snapshot(ownerId);
    return Object.freeze({
      enabled: false, reason: 'SUPABASE_STAGING_RLS_AND_MIGRATION_NOT_VERIFIED',
      scopes: data.sectionCurriculumScopes.map((r) => v2ScopeToCloud(r, ownerId, { deviceId: 'synthetic-only' })),
      bindings: data.teachingCourseBindings.map((r) => v2BindingToCloud(r, ownerId, { deviceId: 'synthetic-only' })),
    });
  }
  async function restoreIntoEmpty(ownerId, bundle) {
    assertOwner(ownerId);
    const { sha256, ...unsigned } = bundle ?? {};
    if (unsigned.format !== CURRICULUM_V2_STAGING_FORMAT || unsigned.version !== 1 ||
        unsigned.sourceOwnerId !== ownerId || typeof sha256 !== 'string' ||
        await digest(unsigned) !== sha256) throw fault('CURRICULUM_V2_BACKUP_INTEGRITY_INVALID');
    const scopes = unsigned.data?.sectionCurriculumScopes;
    const bindings = unsigned.data?.teachingCourseBindings;
    if (!Array.isArray(scopes) || !Array.isArray(bindings) || !unique(scopes) || !unique(bindings) ||
        [...scopes, ...bindings].some((r) => r.ownerId !== ownerId || !required(r.id) ||
          !Number.isSafeInteger(r.updatedAt) || r.updatedAt <= 0 ||
          (r.serverRevision != null && (!Number.isSafeInteger(r.serverRevision) || r.serverRevision < 1))))
      throw fault('CURRICULUM_V2_BACKUP_ROWS_INVALID');
    if (![...scopes, ...bindings].every(hasValidTombstone) ||
        !hasNoActiveDuplicates(scopes, (r) => r.sectionId) ||
        !hasNoActiveDuplicates(bindings, (r) => r.teachingId))
      throw fault('CURRICULUM_V2_BACKUP_LIFECYCLE_INVALID');
    let count = 0;
    await database.applyBatch({
      sectionCurriculumScopes: {}, teachingCourseBindings: {}, years: {}, sections: {},
      teachings: {}, subjects: {}, terms: {}, outbox: {},
    }, {
      productWrite: true,
      prepare(current) {
        assertOwner(ownerId);
        if (current.sectionCurriculumScopes.some((r) => r.ownerId === ownerId) ||
            current.teachingCourseBindings.some((r) => r.ownerId === ownerId))
          throw fault('CURRICULUM_V2_RESTORE_NOT_EMPTY');
        if (current.outbox.some((r) => r.protocol === 'curriculum-v2-synthetic'))
          throw fault('CURRICULUM_V2_RESTORE_PENDING_OUTBOX');
        for (const scope of scopes) {
          const year = active(current.years, scope.yearId, 'CURRICULUM_V2_YEAR_MISSING');
          const section = active(current.sections, scope.sectionId, 'CURRICULUM_V2_SECTION_MISSING');
          validateSection(section, year, scope);
          const checked = evaluateSectionCurriculumScope({
            ownerId, sectionId: scope.sectionId, yearId: scope.yearId,
            program: scope.program, stage: scope.stage, level: scope.level,
            track: scope.track, legacyGrade: scope.legacyGrade,
          });
          if (checked.state !== 'draft' || checked.identity !== scope.id ||
              checked.scopeKey !== scope.scopeKey || checked.edition !== scope.edition ||
              checked.dataSource !== scope.sourceUrl ||
              scope.syncStatus !== 'synthetic_staged_only')
            throw fault('CURRICULUM_V2_BACKUP_SCOPE_MISMATCH');
        }
        for (const binding of bindings) {
          const scope = scopes.find((r) => r.id === binding.sectionScopeIdentity);
          if (!scope || (scope.deleted && !binding.deleted) || scope.sectionId !== binding.sectionId)
            throw fault('CURRICULUM_V2_BACKUP_PARENT_MISMATCH');
          const teaching = active(current.teachings, binding.teachingId, 'CURRICULUM_V2_TEACHING_MISSING');
          active(current.subjects, binding.subjectId, 'CURRICULUM_V2_SUBJECT_MISSING');
          const term = active(current.terms, binding.termId, 'CURRICULUM_V2_TERM_MISSING');
          if ([teaching, term].some((row) => row.ownerId && row.ownerId !== ownerId))
            throw fault('CURRICULUM_V2_OWNER_CONTEXT_CHANGED');
          if (teaching.sectionId !== binding.sectionId || teaching.subjectId !== binding.subjectId ||
              teaching.termId !== binding.termId || term.yearId !== scope.yearId)
            throw fault('CURRICULUM_V2_BACKUP_BINDING_MISMATCH');
          const expected = evaluateTeachingCourseBinding({
            ownerId, sectionScope: { ...scope, state: 'draft' },
            sectionId: binding.sectionId, teachingId: binding.teachingId,
            subjectId: binding.subjectId, termId: binding.termId,
            name: binding.name, kind: binding.kind, sourcePage: binding.sourcePage,
          });
          if (expected.state !== 'draft' || expected.identity !== binding.id ||
              expected.courseKey !== binding.courseKey ||
              expected.courseName !== binding.name || expected.kind !== binding.kind ||
              expected.edition !== binding.edition || expected.sourceUrl !== binding.sourceUrl ||
              binding.syncStatus !== 'synthetic_staged_only')
            throw fault('CURRICULUM_V2_BACKUP_COURSE_MISMATCH');
        }
        count = scopes.length + bindings.length;
        return {
          sectionCurriculumScopes: { put: scopes },
          teachingCourseBindings: { put: bindings },
        };
      },
    });
    assertOwner(ownerId);
    return { imported: count, synced: false, cloudRestoreSupported: false };
  }
  return Object.freeze({
    saveScope, saveBinding, retireScope: (owner, id) => retire(owner, 'sectionCurriculumScopes', id),
    retireBinding: (owner, id) => retire(owner, 'teachingCourseBindings', id),
    snapshot, backup, restoreIntoEmpty, previewCloudRows,
    pushToCloud() { throw fault('CURRICULUM_V2_CLOUD_SCHEMA_NOT_VERIFIED'); },
  });
}
