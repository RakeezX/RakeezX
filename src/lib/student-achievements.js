import { itemScore } from '../models.js';

/** Read-only facts from the same owner-scoped evidence shown on the profile. */
export function studentAchievements({ studentId, history, items, gradeCtx }) {
  const own = (events) => events.filter(({ record }) => record.studentId === studentId && !record.deleted);
  const participation = own(history.logs).filter(({ record }) =>
    record.kind === 'participation' && Number.isFinite(record.delta) && record.delta > 0).length;
  const present = own(history.attendance).filter(({ record }) => record.status === 'present').length;
  // Automatic projections are already represented by attendance/participation.
  // A manual maximum must be reached by the saved value, not by clamping corrupt data.
  const fullMarks = items.filter((item) => {
    const score = gradeCtx.scoresByItem?.[item.id];
    return !item.deleted && !item.auto && Number.isFinite(item.max) && item.max > 0 &&
      score?.studentId === studentId && !score.deleted && score.value !== null &&
      score.value !== undefined && Number(score.value) === item.max && itemScore(item, gradeCtx) === item.max;
  }).length;
  return [
    participation ? { key: 'participation', count: participation, title: 'مشاركات إيجابية', detail: 'مرات رصد مشاركة بنقاط موجبة · كل السجل', source: 'سجل المشاركة والسلوك' } : null,
    present ? { key: 'attendance', count: present, title: 'حصص بحضور مسجّل', detail: 'حصص مسجلة «حاضر» · كل السجل', source: 'سجل الحضور المستمر' } : null,
    fullMarks ? { key: 'scores', count: fullMarks, title: 'بنود بدرجة كاملة', detail: 'بنود تقييم يدوية · الإسناد المعروض فقط', source: 'الدرجات المعروضة' } : null,
  ].filter(Boolean);
}
