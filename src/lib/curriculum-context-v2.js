/**
 * Proposed Curriculum V2 contract. Pure and intentionally NOT connected to
 * the Product DB, outbox, cloud or UI. New synced fields require migration
 * and an owner-scoped RLS/service rollout before they may be persisted.
 */
import { OFFICIAL_V6_ROWS, OFFICIAL_V6_GUIDE_URL } from './official-v6-subject-data.js';
import { stageOfLegacyGrade } from './stage-subject-options.js';

export const CURRICULUM_CONTEXT_VERSION = 2;
const safe = (v, tag) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 180 || /[\u0000-\u001f\u007f]/u.test(v)) {
    throw new TypeError('Invalid ' + tag);
  }
  return v.normalize('NFC').trim();
};
const compose = (...values) => values.map(v => v === null ? 'N' : 'V' + encodeURIComponent(String(v))).join('|');
const candidateRows = ctx => OFFICIAL_V6_ROWS.filter(r => r[0] === ctx.program &&
  r[1] === ctx.stage && r[2] === ctx.level && (r[3] || '') === (ctx.track || ''));

export function evaluateSectionCurriculumScope({
  ownerId, sectionId, yearId, program, stage, level, track = null,
  legacyGrade = null, previousScope = null,
} = {}) {
  const ctx = {
    ownerId: safe(ownerId,'owner'), sectionId: safe(sectionId,'section'),
    yearId: safe(yearId,'year'), program: safe(program,'programme'),
    stage: safe(stage,'stage'), level: safe(level,'level'),
    track: track == null || track === '' ? null : safe(track,'track'),
    edition: 'sncc-v6-114', editionConfirmedFor1448: false,
  };
  if (legacyGrade != null) {
    const legacy = stageOfLegacyGrade(legacyGrade);
    if (!legacy || legacy.stage !== ctx.stage || legacy.level !== ctx.level) {
      return { state: 'blocked', reason: 'legacy_grade_mismatch', writeAllowed: false };
    }
  }
  const rows = candidateRows(ctx);
  if (!rows.length) return { state: 'blocked', reason: 'no_verified_scope_in_guide', writeAllowed: false };
  const identity = compose('section-scope-v2',ctx.ownerId,ctx.sectionId,ctx.yearId);
  const scopeKey = compose(ctx.program,ctx.stage,ctx.level,ctx.track,ctx.edition);
  if (previousScope) {
    if (previousScope.ownerId !== ctx.ownerId ||
        previousScope.sectionId !== ctx.sectionId || previousScope.yearId !== ctx.yearId) {
      return { state: 'blocked', reason: 'owner_section_year_mismatch', writeAllowed: false };
    }
    if (previousScope.scopeKey !== scopeKey) {
      return { state: 'conflict', reason: 'existing_cohort_curriculum_conflict', writeAllowed: false };
    }
  }
  return {
    state: 'draft', identity, scopeKey, ...ctx,
    legacyGrade: legacyGrade === null ? null : Number(legacyGrade),
    dataSource: OFFICIAL_V6_GUIDE_URL, indexedOffers: rows.length,
    storage: 'requires_new_versioned_sync_contract',
    ownerVerifiedByProvider: false, writeAllowed: false,
  };
}

export function evaluateTeachingCourseBinding({
  ownerId, sectionScope, sectionId, teachingId, subjectId,
  termId, name, kind = 'course', sourcePage = null,
} = {}) {
  const owner = safe(ownerId,'owner');
  const sec = safe(sectionId,'section');
  const tch = safe(teachingId,'teaching');
  const subject = safe(subjectId,'subject');
  const term = safe(termId,'term');
  const label = safe(name,'course');
  const courseKind = safe(kind,'course-kind');
  if (sectionScope?.state !== 'draft' || sectionScope.ownerId !== owner ||
      sectionScope.sectionId !== sec || !sectionScope.yearId) {
    return { state: 'blocked', reason: 'unverified_owner_or_section_scope', writeAllowed: false };
  }
  const matching = candidateRows(sectionScope).filter(r => r[4] === label && r[5] === courseKind &&
    (sourcePage === null || r[6] === sourcePage));
  if (!matching.length) return { state:'blocked', reason:'course_not_in_section_scope',writeAllowed:false };
  if (matching.length>1) return { state:'review', reason:'ambiguous_source_course',writeAllowed:false };
  const row=matching[0];
  return {
    state:'draft',
    identity:compose('teaching-course-link-v2',owner,tch),
    ownerId:owner,sectionId:sec,teachingId:tch,subjectId:subject,termId:term,
    sectionScopeIdentity:sectionScope.identity,
    courseKey:compose('sncc',row[0],row[1],row[2],row[3]||null,row[4],row[5],row[6]),
    programme:row[0],stage:row[1],level:row[2],track:row[3]||null,
    courseName:row[4],kind:row[5],
    sourceUrl:OFFICIAL_V6_GUIDE_URL+'#page='+row[6],
    edition:'sixth',editionConfirmedFor1448:false,
    ownerVerifiedByProvider:false,
    status:'requires_teacher_and_provider_verification',writeAllowed:false,
  };
}
export function compatibilityDecision(scope) {
  if (scope?.state!=='draft') return {status:'blocked',requiresMigration:true};
  const legacy=scope.legacyGrade;
  if (!legacy) return {status:'v2_section_required',requiresMigration:true};
  return {status:'can_read_legacy_grade',legacyGrade:legacy,requiresMigration:true,
    explanation:'Context fields are absent from current Sync and Cloud adapters'};
}
