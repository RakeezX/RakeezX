/** Presentation-only helpers for the existing authoritative session-delete contract. */

const REASON_COPY = Object.freeze({
  archived: 'الفصل مؤرشف، وسجل الحصة محفوظ للقراءة فقط.',
  attendance: 'توجد سجلات حضور مرتبطة بهذه الحصة.',
  'roster-snapshot': 'يوجد كشف طلاب محفوظ مرتبط بهذه الحصة.',
  roster_snapshot: 'يوجد كشف طلاب محفوظ مرتبط بهذه الحصة.',
  notes: 'توجد ملاحظات مرتبطة بهذه الحصة.',
  logs: 'توجد سجلات رصد مرتبطة بهذه الحصة.',
  'class-goal': 'يوجد هدف صفي مرتبط بهذه الحصة.',
  class_goal: 'يوجد هدف صفي مرتبط بهذه الحصة.',
  content: 'تحتوي الحصة على محتوى مسجل.',
  makeup: 'الحصة مرتبطة بحصة تعويضية.',
  status: 'حالة الحصة محفوظة ولا يمكن حذفها.',
  'retained-evidence': 'تحتوي الحصة على بيانات محفوظة.',
  not_found: 'لم تعد الحصة متاحة للحذف.',
  'cloud-reconciliation': 'يجري تحديث البيانات الآن. انتظر اكتماله قبل حذف الحصة.',
});

const REASON_PRIORITY = Object.freeze([
  'archived', 'attendance', 'roster-snapshot', 'roster_snapshot', 'notes', 'logs',
  'class-goal', 'class_goal', 'content', 'makeup', 'status', 'retained-evidence', 'not_found',
  'cloud-reconciliation',
]);

export function friendlySessionDeleteReason(reason) {
  return REASON_COPY[reason] ?? 'تحتوي الحصة على بيانات محفوظة.';
}

export function sessionDeletePresentation({
  evidence = [], archived = false, deleteProtection = null, cloudReconciliation = false,
} = {}) {
  const reasons = [...new Set([
    ...(archived ? ['archived'] : []),
    ...(deleteProtection?.reason ? [deleteProtection.reason] : []),
    ...evidence,
    ...(cloudReconciliation ? ['cloud-reconciliation'] : []),
  ])];
  reasons.sort((left, right) => {
    const leftRank = REASON_PRIORITY.indexOf(left);
    const rightRank = REASON_PRIORITY.indexOf(right);
    return (leftRank < 0 ? REASON_PRIORITY.length : leftRank) -
      (rightRank < 0 ? REASON_PRIORITY.length : rightRank);
  });
  const primary = reasons[0] ?? null;
  return {
    deletable: reasons.length === 0,
    restored: !!deleteProtection,
    primaryReason: primary ? friendlySessionDeleteReason(primary) : '',
    additionalCount: Math.max(0, reasons.length - 1),
  };
}

export function sessionDeleteQueuedCopy({ online = true, syncStatus = 'idle' } = {}) {
  if (!online || syncStatus === 'offline') {
    return 'تم طلب حذف الحصة، وستتم مزامنته عند توفر الاتصال.';
  }
  if (syncStatus === 'auth_required' || syncStatus === 'idle') {
    return 'تم طلب حذف الحصة وحُفظ التغيير على هذا الجهاز.';
  }
  return 'تم طلب حذف الحصة، وجارٍ مزامنة التغيير.';
}
