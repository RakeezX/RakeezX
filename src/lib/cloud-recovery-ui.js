/** Pure presentation helpers for the existing conservative Cloud Recovery contract. */

export const CLOUD_RECOVERY_STORE_LABELS = Object.freeze({
  years: 'السنوات الدراسية',
  calendars: 'التقاويم',
  calendarDays: 'أيام التقويم',
  terms: 'الفصول الدراسية',
  subjects: 'المواد',
  sections: 'الشُعب',
  teachings: 'الفصول ومواد التدريس',
  students: 'الطلاب',
  enrollments: 'انتسابات الطلاب',
  timeProfiles: 'ملفات التوقيت',
  profile: 'بيانات المعلّم',
  items: 'عناصر الدرجات',
  slots: 'الحصص الأسبوعية',
  sessions: 'الحصص المؤرخة',
  notes: 'ملاحظات الطلاب',
  classRules: 'مواثيق الصف',
  classCharterSelections: 'اختيارات ميثاق الصف',
  classGoals: 'أهداف الحصص',
  groupArrangements: 'ترتيبات المجموعات',
  scores: 'الدرجات',
  logs: 'الرصدات السريعة',
  sessionRosterSnapshots: 'قوائم الحصص المحفوظة',
  attendance: 'سجلات الحضور',
  closedTermReports: 'تقارير الفصول المغلقة',
  '*': 'بيانات الحساب',
});

export const CLOUD_RECOVERY_STATE_META = Object.freeze({
  add: { label: 'ستتم إضافتها', short: 'إضافة', tone: 'positive' },
  update: { label: 'ستتحدث', short: 'تحديث', tone: 'informational' },
  delete: { label: 'ستُحذف', short: 'حذف', tone: 'danger' },
  keep: { label: 'ستبقى كما هي', short: 'بدون تغيير', tone: 'neutral' },
  cloudOnly: { label: 'موجودة في السحابة فقط', short: 'في السحابة فقط', tone: 'neutral' },
  blocked: { label: 'محظورة وتحتاج مراجعة', short: 'محظور', tone: 'blocked' },
});

const REASON_COPY = Object.freeze({
  'backup-unchanged': 'لم يتغير هذا السجل في النسخة.',
  'no-live-field-change': 'لا يوجد تغيير قابل للتطبيق.',
  'server-only': 'هذا السجل موجود في الحساب السحابي فقط وسيبقى كما هو.',
  'local-only-tombstone': 'سجل حذف محلي بلا أثر سحابي؛ لن يُرسل.',
  'same-field-change': 'تغيّر الجزء نفسه في النسخة والسحابة، لذلك لا يمكن الاختيار تلقائيًا.',
  'delete-versus-newer-server-change': 'النسخة تحذف سجلًا عُدّل لاحقًا في السحابة.',
  'identity-already-exists': 'يوجد سجل سحابي آخر بالهوية نفسها.',
  'server-tombstone': 'السجل محذوف في السحابة ولا يمكن إعادته تلقائيًا.',
  'missing-baseline-evidence': 'لا تتوفر معلومات كافية لمقارنة هذا السجل بأمان.',
  'baseline-row-missing-on-server': 'مرجع المقارنة الموجود في النسخة لم يعد موجودًا في السحابة.',
  'local-only-curriculum-reference': 'يرتبط السجل ببيانات محلية لا تدخل المقارنة السحابية.',
  'closed-term-lifecycle-requires-specialized-review': 'يتعلق السجل بفصل دراسي مغلق ولا يمكن تغييره بهذه الاستعادة.',
  'immutable-record-changed-in-backup': 'هذا سجل تاريخي ثابت ولا يمكن تحديثه بهذه الاستعادة.',
  'legacy-backup-requires-empty-owner': 'نسخة V3 تُستعاد سحابيًا فقط عندما يكون الحساب خاليًا تمامًا.',
  'backup-owner-mismatch': 'النسخة تخص حسابًا مختلفًا.',
  'unknown-backup-owner-requires-empty-owner': 'لا يمكن إثبات مالك النسخة، والحساب ليس خاليًا.',
});

export function cloudRecoveryEntryState(entry) {
  if (entry?.classification === 'SAFE_APPLY') {
    if (entry.operation === 'create') return 'add';
    if (entry.operation === 'patch') return 'update';
    if (entry.operation === 'delete') return 'delete';
  }
  if (entry?.classification === 'KEEP_SERVER') {
    return entry.reason === 'server-only' ? 'cloudOnly' : 'keep';
  }
  return 'blocked';
}

export function summarizeCloudRestorePlan(plan) {
  const summary = { add: 0, update: 0, delete: 0, keep: 0, cloudOnly: 0, blocked: 0 };
  for (const entry of plan?.entries ?? []) summary[cloudRecoveryEntryState(entry)] += 1;
  return summary;
}

export function groupCloudRestoreEntries(plan) {
  const groups = new Map();
  for (const entry of plan?.entries ?? []) {
    const state = cloudRecoveryEntryState(entry);
    const store = entry.store ?? '*';
    const reason = entry.reason ?? '';
    const key = `${state}\u0000${store}\u0000${reason}`;
    const current = groups.get(key) ?? {
      state,
      store,
      label: CLOUD_RECOVERY_STORE_LABELS[store] ?? 'بيانات رَكيز',
      reason: REASON_COPY[reason] ?? (state === 'blocked' ? 'لا يمكن تطبيق هذا السجل تلقائيًا بأمان.' : ''),
      count: 0,
    };
    current.count += 1;
    groups.set(key, current);
  }
  const order = ['blocked', 'delete', 'update', 'add', 'cloudOnly', 'keep'];
  return [...groups.values()].sort((left, right) =>
    order.indexOf(left.state) - order.indexOf(right.state) || left.label.localeCompare(right.label, 'ar'));
}

export function cloudRecoveryErrorPresentation(error) {
  const code = error?.code ?? '';
  const known = {
    AUTH_REQUIRED: ['يلزم تسجيل الدخول', 'سجّل الدخول من مركز المعلّم، ثم أعد المحاولة.', 'auth'],
    OFFLINE: ['يلزم الاتصال بالإنترنت', 'تحقق من الاتصال، ثم أعد المحاولة.', 'offline'],
    SYNC_BUSY: ['المزامنة تعمل الآن', 'انتظر حتى تكتمل المزامنة، ثم أعد المحاولة.', 'sync'],
    RESTORE_OUTBOX_NOT_EMPTY: ['المزامنة غير جاهزة', 'توجد تغييرات محلية لم تكتمل مزامنتها بعد. اتركها تكتمل ثم أعد المحاولة.', 'sync'],
    RESTORE_SYNC_NOT_HEALTHY: ['المزامنة غير جاهزة', 'تعذّر الوصول إلى حالة سحابية مستقرة. أعد المحاولة بعد استقرار المزامنة.', 'sync'],
    UNSUPPORTED_BACKUP_VERSION: ['النسخة غير مدعومة', 'يمكن استخدام نسخة V4، أو نسخة V3 ضمن حدودها الحالية.', 'file'],
    INVALID_BACKUP: ['النسخة غير صالحة', 'تعذّر التحقق من بنية الملف أو سلامة محتواه. لم تتغير بياناتك.', 'file'],
    RESTORE_REVIEW_REQUIRED: ['تغيّرت حالة السحابة', 'لم تبدأ الاستعادة. أعد مراجعة الخطة الجديدة قبل المتابعة.', 'review'],
    CLOUD_RESTORE_RESUME_REQUIRED: ['يلزم إكمال استعادة سابقة', 'أكمل تحديث هذا الجهاز قبل بدء استعادة سحابية جديدة.', 'resume'],
    LOCAL_RECONCILIATION_REQUIRED: ['اكتملت الاستعادة في السحابة', 'يحتاج هذا الجهاز إلى إكمال التحديث بالنسخة النهائية.', 'resume'],
    INVALID_RESTORE_RESUME_STATE: ['تعذّر قراءة حالة الاستعادة', 'لا تبدأ استعادة جديدة. تحتاج الحالة المحفوظة إلى مراجعة تقنية.', 'resume'],
    RESTORE_RESUME_IDENTITY_MISMATCH: ['تغيّرت حالة الاستعادة المحفوظة', 'لم يبدأ إجراء جديد. أعد تحميل الصفحة قبل المحاولة مرة أخرى.', 'resume'],
    NO_RESTORE_TO_RESUME: ['لا توجد استعادة معلّقة', 'أُكمل التحديث بالفعل أو لم يعد هناك إجراء يحتاج إلى استئناف.', 'resume'],
  };
  const [title, message, kind] = known[code] ?? [
    'تعذّر إكمال الاستعادة الآمنة',
    'لم تبدأ استعادة جديدة. تحقق من الاتصال وحالة الحساب ثم أعد المحاولة.',
    'generic',
  ];
  return { code, title, message, kind };
}
