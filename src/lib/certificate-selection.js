import { compareArabic, itemScore } from '../models.js';
import { compareAcademicClasses } from './class-order.js';

/** Presentation order only; never change the saved teaching order. */
export function sortCertificateTeachings(teachings, { getSection, getSubject }) {
  return [...teachings].sort((left, right) =>
    compareAcademicClasses(getSection(left.sectionId), getSection(right.sectionId))
    || compareArabic(getSubject(left.subjectId)?.name, getSubject(right.subjectId)?.name)
    || compareArabic(left.id, right.id));
}

/** Read-only shortcut eligibility, independent of manual certificate selection. */
export function hasFullMarks(items, gradeCtx, studentId) {
  const counted = items.filter(item => !item.deleted);
  if (!gradeCtx || !counted.length) return false;
  return counted.every(item => {
    if (!Number.isFinite(item.max) || item.max <= 0) return false;
    if (itemScore(item, gradeCtx) !== item.max) return false;
    if (item.auto === 'participation' || item.auto === 'attendance') return true;
    if (item.auto) return false;
    const score = gradeCtx.scoresByItem?.[item.id];
    // Keep reviewed portability: the source item ID can differ from this item.
    // A corrupt over-maximum manual score must not qualify via display clamping.
    return !!score && !score.deleted && score.studentId === studentId
      && score.value !== null && score.value !== undefined
      && Number(score.value) === item.max;
  });
}
