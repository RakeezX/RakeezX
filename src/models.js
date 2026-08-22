/**
 * RAKEEZ X — نموذج البيانات ومنطق الحساب.
 *
 * ثلاثة محاور منفصلة عمدًا:
 *   الشعبة   (section)  = مجموعة الطلاب «٤/أ»                 — تعيش سنة كاملة
 *   الإسناد  (teaching) = «أُدرّس المهارات الرقمية لـ ٤/أ في الفصل الأول» — يعيش فصلًا دراسيًا
 *   المنهج   (unit/lesson) = «مهارات رقمية · رابع · الفصل الأول» — يعيش سنوات، بلا شعبة
 *
 * كل سجل يحمل: id · updatedAt · deleted
 *   - updatedAt يحسم أي التغييرين أحدث عند المزامنة بين الأجهزة.
 *   - deleted حذف ناعم، لأن الحذف الصلب لا يمكن مزامنته.
 */

/* ---------- أساسيات ---------- */

export const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

export const now = () => Date.now();

/** تاريخ اليوم بتوقيت الجهاز على صيغة YYYY-MM-DD. */
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/** يوم الأسبوع 0=الأحد … 6=السبت */
export function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** الجمعة والسبت عطلة افتراضيًا — ويغلبها التقويم الدراسي متى أُدخل. */
export const isWeekend = (iso) => [5, 6].includes(weekday(iso));

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/** أيام الدراسة المعتادة في السعودية. */
export const SCHOOL_WEEKDAYS = [0, 1, 2, 3, 4];

/* ---------- المعرّفات المشتقة ---------- */
/**
 * حيث يوجد مفتاح طبيعي نشتق المعرّف منه بدل توليده عشوائيًا.
 * الفائدة: جهازان يعملان دون إنترنت يولّدان **نفس المعرّف** لنفس الحقيقة،
 * فيندمجان عند المزامنة بدل أن يتضاعفا.
 */
/**
 * عدد الفصول الدراسية في السنة عند إعداد RAKEEZ X الحالي.
 * **النموذج يدعم أي عدد** — السنة قائمة فصول لا حقول ثابتة — وهذا الرقم إعداد
 * المنتج اليوم فقط، فرفعه إلى ٣ لاحقًا لا يحتاج أي ترحيل.
 */
export const TERMS_PER_YEAR = 2;

export const TERM_NAMES = ['', 'الفصل الدراسي الأول', 'الفصل الدراسي الثاني', 'الفصل الدراسي الثالث'];
export const TERM_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث'];

/** أرقام الفصول الدراسية المعتمدة اليوم: [1, 2] */
export const termIndexes = () => Array.from({ length: TERMS_PER_YEAR }, (_, i) => i + 1);

export const yearId = (hijriStart) => `y:${hijriStart}-${Number(hijriStart) + 1}`;
export const termId = (yId, index) => `tm:${yId}:${index}`;
export const subjectId = (slug) => `sub:${slug}`;
export const sectionId = (yId, grade, label) => `sec:${yId}:${grade}:${label}`;
export const teachingId = (secId, subId, tmId) => `tch:${secId}|${subId}|${tmId}`;
export const enrollmentId = (studentId, secId) => `en:${studentId}:${secId}`;
export const slotId = (tchId, wd, period) => `sl:${tchId}:${wd}:${period}`;
export const sessionId = (tchId, date, period) => `se:${tchId}:${date}:${period}`;
export const attendanceId = (studentId, sesId) => `at:${studentId}:${sesId}`;
export const scoreId = (studentId, itemId) => `sc:${studentId}:${itemId}`;
export const calendarId = (yId, source) => `cal:${yId}:${source}`;
export const calendarDayId = (calId, date) => `cd:${calId}:${date}`;
export const submissionId = (studentId, assignmentId) => `sb:${studentId}:${assignmentId}`;

/** السجلات الحدثية (الرصد السريع والملاحظات) تبقى بمعرّف عشوائي: كل حدث مستقل. */

/** يحوّل نصًا عربيًا إلى معرّف لاتيني ثابت للمادة. */
export function slugify(text) {
  const map = {
    'المهارات الرقمية': 'digital-skills',
    'الحاسب الآلي': 'computer',
    'الرياضيات': 'math',
    'العلوم': 'science',
    'اللغة العربية': 'arabic',
    'اللغة الإنجليزية': 'english',
  };
  const trimmed = String(text ?? '').trim();
  if (map[trimmed]) return map[trimmed];
  const ascii = trimmed.toLowerCase().replace(/[^\w؀-ۿ]+/g, '-').replace(/^-|-$/g, '');
  return ascii || 'subject-' + uid().slice(0, 6);
}

/* ---------- الصفوف ---------- */

export const GRADES = [
  { v: 1,  label: 'الأول الابتدائي',   stage: 'ابتدائي' },
  { v: 2,  label: 'الثاني الابتدائي',  stage: 'ابتدائي' },
  { v: 3,  label: 'الثالث الابتدائي',  stage: 'ابتدائي' },
  { v: 4,  label: 'الرابع الابتدائي',  stage: 'ابتدائي' },
  { v: 5,  label: 'الخامس الابتدائي',  stage: 'ابتدائي' },
  { v: 6,  label: 'السادس الابتدائي',  stage: 'ابتدائي' },
  { v: 7,  label: 'الأول المتوسط',     stage: 'متوسط' },
  { v: 8,  label: 'الثاني المتوسط',    stage: 'متوسط' },
  { v: 9,  label: 'الثالث المتوسط',    stage: 'متوسط' },
  { v: 10, label: 'الأول الثانوي',     stage: 'ثانوي' },
  { v: 11, label: 'الثاني الثانوي',    stage: 'ثانوي' },
  { v: 12, label: 'الثالث الثانوي',    stage: 'ثانوي' },
];

export const gradeLabel = (v) => GRADES.find((g) => g.v === Number(v))?.label ?? '';

export const sectionLabel = (sec) => sec ? `${gradeLabel(sec.grade)} / ${sec.label}` : '';

export const SECTION_COLORS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#b45309', '#0369a1', '#4d7c0f', '#9d174d'];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * لون آمن للحقن في سمة style.
 * تهريب HTML يحمي من الوسوم ولا يحمي من CSS: قيمة مثل
 * `red;background-image:url(http://x/leak.png)` تجعل المتصفح يصدر طلبًا لمضيف غريب.
 */
export const safeColor = (v, fallback = SECTION_COLORS[0]) =>
  typeof v === 'string' && HEX_COLOR.test(v.trim()) ? v.trim() : fallback;

/* ---------- الحالات ---------- */

export const YEAR_STATUS = { active: 'جارية', archived: 'مؤرشفة' };

export const TERM_STATUS = { upcoming: 'قادم', active: 'جارٍ', closed: 'منتهٍ' };

export const STUDENT_STATUS = { active: 'مستمر', withdrawn: 'غادر المدرسة' };

export const ENROLLMENT_STATUS = {
  active: 'مُنتسب',
  transferred: 'انتقل',
  withdrawn: 'غادر',
  completed: 'أكمل',
};

export const ATTENDANCE = {
  present: { label: 'حاضر',  short: 'ح', color: 'present' },
  late:    { label: 'متأخر', short: 'ت', color: 'late' },
  excused: { label: 'مستأذن', short: 'ذ', color: 'excused' },
  absent:  { label: 'غائب',  short: 'غ', color: 'absent' },
};
export const ATTENDANCE_ORDER = ['present', 'late', 'excused', 'absent'];

/** حالات الحصة السبع. */
export const SESSION_STATUS = {
  scheduled:         { label: 'مجدولة',          tone: '',        counts: false },
  held:              { label: 'تمت',             tone: 'ok',      counts: true },
  missed:            { label: 'لم تتم',          tone: 'danger',  counts: true },
  postponed:         { label: 'مؤجلة',           tone: 'warn',    counts: true },
  cancelled:         { label: 'أُلغيت',           tone: 'warn',    counts: true },
  cancelled_holiday: { label: 'إجازة رسمية',      tone: 'info',    counts: false },
  makeup:            { label: 'حصة تعويضية',      tone: 'brand',   counts: true },
};
export const SESSION_STATUS_ORDER = [
  'scheduled', 'held', 'missed', 'postponed', 'cancelled', 'cancelled_holiday', 'makeup',
];

/** الحصص التي لا تُحسب في نسبة التنفيذ ولا تولّد غيابًا. */
export const isNonTeachingSession = (status) =>
  status === 'cancelled_holiday' || status === 'scheduled';

/** أيام التقويم الدراسي. */
export const CALENDAR_KIND = {
  study:    { label: 'يوم دراسة',    teaching: true },
  exam:     { label: 'اختبارات',     teaching: true },
  event:    { label: 'فعالية',       teaching: true },
  holiday:  { label: 'إجازة',        teaching: false },
  national: { label: 'اليوم الوطني', teaching: false },
  founding: { label: 'يوم التأسيس',  teaching: false },
};
export const CALENDAR_KIND_ORDER = ['study', 'holiday', 'national', 'founding', 'exam', 'event'];

/** هل يوم بهذا التصنيف يُدرَّس فيه؟ */
export const isTeachingDay = (kind) => CALENDAR_KIND[kind]?.teaching ?? true;

/* ---------- ملفات توقيت الحصص ---------- */

/**
 * ملف التوقيت يحمل أوقات الحصص مرة واحدة، فلا يُدخل المعلّم ساعة ودقيقة مع كل
 * حصة يضيفها للجدول. ويقبل استثناءً ليوم بعينه (`overrides`) للأيام التي يختلف
 * دوامها — كيوم عن بُعد داخل التوقيت المدمج.
 *
 * `periods`   : [{ period, start, end }] — الافتراضي لكل الأيام
 * `overrides` : { '3': [{ period, start, end }] } — مفتاحه رقم اليوم (٠ الأحد)
 */

/** يبني قائمة حصص متتابعة: بداية، ومدة، وفاصل. */
export function buildPeriods(count, startTime, minutes, breakMinutes) {
  const [h, m] = startTime.split(':').map(Number);
  let cursor = h * 60 + m;
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

  return Array.from({ length: count }, (_, i) => {
    const start = cursor;
    const end = start + minutes;
    cursor = end + breakMinutes;
    return { period: i + 1, start: fmt(start), end: fmt(end) };
  });
}

export const makeTimeProfile = (o = {}) => ({
  ...base(),
  name: o.name ?? 'ملف توقيت',
  order: o.order ?? 0,
  periods: o.periods ?? buildPeriods(7, '07:00', 40, 5),
  overrides: o.overrides ?? {},
  activeFrom: o.activeFrom ?? null,
  activeTo: o.activeTo ?? null,
  ...o,
});

/**
 * الملفات المبدئية — **سجلات قابلة للتعديل والحذف وإعادة التسمية**، لا ثوابت
 * في الشيفرة. تُنشأ مرة واحدة عند أول تشغيل ثم تصير ملك المعلّم.
 */
export const DEFAULT_TIME_PROFILES = [
  {
    name: 'التوقيت الصيفي',
    periods: buildPeriods(7, '06:45', 40, 5),
  },
  {
    name: 'التوقيت الشتوي',
    periods: buildPeriods(7, '07:30', 40, 5),
  },
  {
    name: 'توقيت رمضان',
    periods: buildPeriods(5, '09:00', 30, 5),
  },
  {
    name: 'التوقيت المدمج',
    periods: buildPeriods(7, '06:45', 40, 5),
    // مثال جاهز للتعديل: يوم عن بُعد بأوقات مختلفة
    overrides: { 3: buildPeriods(5, '09:00', 30, 10) },
  },
];

/** وقت حصة برقمها في يوم معيّن — يقدّم استثناء اليوم على الافتراضي. */
export function periodTime(profile, weekday, period) {
  if (!profile) return null;
  const ov = profile.overrides?.[String(weekday)] ?? profile.overrides?.[weekday];
  const list = Array.isArray(ov) && ov.length ? ov : profile.periods;
  return list?.find((p) => Number(p.period) === Number(period)) ?? null;
}

/** أرقام الحصص المتاحة في ملف توقيت ليوم معيّن. */
export function periodNumbers(profile, weekday = null) {
  if (!profile) return [1, 2, 3, 4, 5, 6, 7];
  const ov = weekday !== null ? profile.overrides?.[String(weekday)] : null;
  const list = Array.isArray(ov) && ov.length ? ov : profile.periods;
  return (list ?? []).map((p) => Number(p.period));
}

export const fmtRange = (t) => (t ? `${t.start} – ${t.end}` : '');

/* ---------- الإعدادات: حساب مقابل جهاز ---------- */

/**
 * فُصلت عمدًا إلى سجلين:
 *   profile — بيانات المعلّم. تخصّ الحساب، تُصدَّر في النسخ الاحتياطية وتُدمج.
 *   device  — إعدادات هذا الجهاز. **لا تُصدَّر ولا تُستورد أبدًا**، فلا يغيّر
 *             ملفُ نسخةٍ من جهاز آخر مظهرَك ولا فصلك الدراسي النشط.
 */
export const makeProfile = (o = {}) => ({
  id: 'profile',
  updatedAt: now(),
  deleted: false,
  teacherName: o.teacherName ?? '',
  schoolName: o.schoolName ?? '',
  phone: o.phone ?? '',
  ...o,
});

export const makeDevice = (o = {}) => ({
  id: 'device',
  updatedAt: now(),
  deleted: false,
  theme: o.theme ?? 'auto',
  activeYearId: o.activeYearId ?? null,
  activeTermId: o.activeTermId ?? null,
  activeTimeProfileId: o.activeTimeProfileId ?? null,
  lastSyncAt: o.lastSyncAt ?? null,
  schemaVersion: o.schemaVersion ?? 4,
  ...o,
});

/* ---------- وسوم الرصد السريع ---------- */

export const LOG_TAGS = {
  participation: {
    up:   ['إجابة صحيحة', 'مشاركة فعّالة', 'سؤال جيد', 'ساعد زميله', 'أنجز التدريب'],
    down: ['لم يشارك', 'لم يحضر الأدوات'],
  },
  behavior: {
    up:   ['التزام ممتاز', 'تعاون', 'محافظة على الجهاز', 'نظام ونظافة'],
    down: ['إزعاج', 'عبث بالجهاز', 'تأخر عن العمل', 'مقاطعة'],
  },
};

/* ---------- المصانع ---------- */

const base = () => ({ id: uid(), updatedAt: now(), deleted: false });

export const makeYear = (o = {}) => {
  const hijriStart = Number(o.hijriStart ?? 1448);
  return {
    ...base(),
    id: o.id ?? yearId(hijriStart),
    label: o.label ?? `${hijriStart}-${hijriStart + 1}`,
    hijriStart,
    hijriEnd: o.hijriEnd ?? hijriStart + 1,
    order: o.order ?? hijriStart,
    status: o.status ?? 'active',
    ...o,
  };
};

export const makeTerm = (o = {}) => {
  const yId = o.yearId;
  const index = Number(o.index ?? 1);
  return {
    ...base(),
    id: o.id ?? termId(yId, index),
    yearId: yId,
    name: o.name ?? `الفصل الدراسي ${['', 'الأول', 'الثاني', 'الثالث'][index] ?? index}`,
    index,
    startDate: o.startDate ?? null,
    endDate: o.endDate ?? null,
    status: o.status ?? 'active',
    calendarId: o.calendarId ?? null,
    ...o,
  };
};

export const makeSubject = (o = {}) => {
  const slug = o.slug ?? slugify(o.name ?? 'المهارات الرقمية');
  return {
    ...base(),
    id: o.id ?? subjectId(slug),
    name: o.name ?? 'المهارات الرقمية',
    slug,
    ...o,
  };
};

export const makeSection = (o = {}) => ({
  ...base(),
  id: o.id ?? sectionId(o.yearId, o.grade ?? 4, o.label ?? 'أ'),
  yearId: o.yearId,
  grade: Number(o.grade ?? 4),
  label: o.label ?? 'أ',
  name: o.name ?? `${o.grade ?? 4}/${o.label ?? 'أ'}`,
  color: safeColor(o.color),
  order: o.order ?? 0,
  ...o,
});

export const makeTeaching = (o = {}) => ({
  ...base(),
  id: o.id ?? teachingId(o.sectionId, o.subjectId, o.termId),
  sectionId: o.sectionId,
  subjectId: o.subjectId,
  termId: o.termId,
  order: o.order ?? 0,
  ...o,
});

export const makeStudent = (o = {}) => ({
  ...base(),
  name: o.name ?? '',
  note: o.note ?? '',
  status: o.status ?? 'active',
  ...o,
});

export const makeEnrollment = (o = {}) => ({
  ...base(),
  id: o.id ?? enrollmentId(o.studentId, o.sectionId),
  studentId: o.studentId,
  sectionId: o.sectionId,
  rollNo: o.rollNo ?? null,
  startDate: o.startDate ?? todayISO(),
  endDate: o.endDate ?? null,
  status: o.status ?? 'active',
  transferNote: o.transferNote ?? '',
  ...o,
});

export const makeItem = (o = {}) => ({
  ...base(),
  teachingId: o.teachingId,
  name: o.name ?? '',
  max: o.max ?? 10,
  order: o.order ?? 0,
  /** null = إدخال يدوي · 'participation' · 'attendance' */
  auto: o.auto ?? null,
  perPoint: o.perPoint ?? 1,
  penalty: o.penalty ?? 1,
  /**
   * ربط اختياري بالمنهج — يحوّل التقرير من «الطالب ٦٢٪» إلى
   * «يحتاج دعمًا في الوحدة الثالثة · درس البوابات المنطقية».
   * كلاهما اختياري: بند عام (اختبار نهائي) يبقى بلا ربط.
   * الدرس أدقّ من الوحدة، والوحدة تُشتق منه إن وُجد.
   */
  unitId: o.unitId ?? null,
  lessonId: o.lessonId ?? null,
  ...o,
});

/** الخانة في الجدول الأسبوعي — بلا أوقات، فالوقت يأتي من ملف التوقيت. */
export const makeSlot = (o = {}) => ({
  ...base(),
  id: o.id ?? slotId(o.teachingId, o.weekday, o.period),
  teachingId: o.teachingId,
  weekday: Number(o.weekday ?? 0),
  period: Number(o.period ?? 1),
  ...o,
});

/**
 * الحصة تحمل **وقتها الفعلي مطبوعًا فيها** عند إنشائها، لا مرجعًا يُقرأ لاحقًا.
 * فتغيير ملف التوقيت من صيفي إلى شتوي لا يمس الحصص الماضية إطلاقًا —
 * وتبقى مسجّلة بوقتها الذي نُفّذت فيه فعلًا.
 */
export const makeSession = (o = {}) => ({
  ...base(),
  id: o.id ?? sessionId(o.teachingId, o.date, o.period ?? 1),
  teachingId: o.teachingId,
  date: o.date ?? todayISO(),
  period: Number(o.period ?? 1),
  slotId: o.slotId ?? null,
  startTime: o.startTime ?? '',
  endTime: o.endTime ?? '',
  timeProfileId: o.timeProfileId ?? null,
  status: o.status ?? 'scheduled',
  reason: o.reason ?? '',
  makeupForId: o.makeupForId ?? null,
  lessonId: o.lessonId ?? null,
  note: o.note ?? '',
  homework: o.homework ?? '',
  covered: o.covered ?? '',
  ...o,
});

export const makeCalendar = (o = {}) => ({
  ...base(),
  id: o.id ?? calendarId(o.yearId, o.source ?? 'custom'),
  yearId: o.yearId,
  source: o.source ?? 'custom',   // moe | custom
  label: o.label ?? 'التقويم الدراسي',
  ...o,
});

export const makeCalendarDay = (o = {}) => ({
  ...base(),
  id: o.id ?? calendarDayId(o.calendarId, o.date),
  calendarId: o.calendarId,
  date: o.date,
  kind: o.kind ?? 'holiday',
  label: o.label ?? '',
  ...o,
});

export const makeUnit = (o = {}) => ({
  ...base(),
  subjectId: o.subjectId,
  grade: Number(o.grade ?? 4),
  termIndex: Number(o.termIndex ?? 1),
  name: o.name ?? '',
  order: o.order ?? 0,
  plannedSessions: o.plannedSessions ?? 0,
  ...o,
});

export const makeLesson = (o = {}) => ({
  ...base(),
  unitId: o.unitId,
  name: o.name ?? '',
  order: o.order ?? 0,
  plannedSessions: o.plannedSessions ?? 1,
  ...o,
});

/** كيان الملاحظات المؤرّخة — النموذج جاهز، ولا واجهة له في الموجة الأولى. */
export const makeNote = (o = {}) => ({
  ...base(),
  studentId: o.studentId ?? null,
  teachingId: o.teachingId ?? null,
  sessionId: o.sessionId ?? null,
  date: o.date ?? todayISO(),
  kind: o.kind ?? 'general',
  text: o.text ?? '',
  ...o,
});

/** الواجبات والتسليمات — النموذج جاهز، ولا واجهة لهما في الموجة الأولى. */
export const makeAssignment = (o = {}) => ({
  ...base(),
  teachingId: o.teachingId,
  lessonId: o.lessonId ?? null,
  itemId: o.itemId ?? null,
  title: o.title ?? '',
  assignedDate: o.assignedDate ?? todayISO(),
  dueDate: o.dueDate ?? null,
  max: o.max ?? 10,
  ...o,
});

export const makeSubmission = (o = {}) => ({
  ...base(),
  id: o.id ?? submissionId(o.studentId, o.assignmentId),
  studentId: o.studentId,
  assignmentId: o.assignmentId,
  status: o.status ?? 'pending',   // pending | submitted | late | missing
  score: o.score ?? null,
  note: o.note ?? '',
  ...o,
});

/* ---------- قالب بنود التقييم الافتراضي ---------- */

export const DEFAULT_ITEMS = [
  { name: 'المشاركة والتفاعل', max: 10, auto: 'participation', perPoint: 1 },
  { name: 'الواجبات',          max: 10 },
  { name: 'الأنشطة والمشاريع', max: 20 },
  { name: 'الاختبارات القصيرة', max: 20 },
  { name: 'الاختبار النهائي',   max: 40 },
];

export const defaultItemsFor = (tchId) =>
  DEFAULT_ITEMS.map((t, i) => makeItem({ ...t, teachingId: tchId, order: i }));

/* ---------- الترتيب ---------- */

const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

export const compareArabic = (a, b) => collator.compare(a ?? '', b ?? '');

/** ترتيب الطلاب: برقم الكشف إن وُجد، وإلا أبجديًا. */
export function sortStudents(students) {
  return [...students].sort((a, b) => {
    const ar = a.rollNo ?? Infinity;
    const br = b.rollNo ?? Infinity;
    if (ar !== br) return ar - br;
    return collator.compare(a.name, b.name);
  });
}

export const sortByOrder = (arr) =>
  [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || collator.compare(a.name ?? '', b.name ?? ''));

/* ---------- الحساب ---------- */

export function netPoints(logs, kind = null) {
  let n = 0;
  for (const l of logs) {
    if (l.deleted) continue;
    if (kind && l.kind !== kind) continue;
    n += l.delta;
  }
  return n;
}

export const absenceCount = (records) => records.filter((a) => !a.deleted && a.status === 'absent').length;

/**
 * درجة بند واحد لطالب واحد.
 * تُعاد null إذا لم يُرصد شيء بعد — وهو فرق جوهري عن الصفر.
 */
export function itemScore(item, ctx) {
  if (item.auto === 'participation') {
    // ما دام الإسناد كله بلا رصد مشاركة، فالبند لم يُرصد بعد — لا أن الطالب صفر.
    if (!ctx.classHasParticipation) return null;
    const pts = Math.max(0, netPoints(ctx.logs ?? [], 'participation'));
    return Math.min(item.max, pts * (item.perPoint ?? 1));
  }
  if (item.auto === 'attendance') {
    if (!ctx.attendance?.length) return null;
    const misses = absenceCount(ctx.attendance);
    return Math.max(0, item.max - misses * (item.penalty ?? 1));
  }

  const s = ctx.scoresByItem?.[item.id];
  if (!s || s.deleted || s.value === null || s.value === undefined) return null;

  // تقييد عند القراءة: سجل قديم أو ملف نسخة قد يحمل قيمة خارج النطاق،
  // وقيمة واحدة فاسدة تكفي لإفساد مجموع الطالب ومتوسط الفصل.
  const v = Number(s.value);
  if (!Number.isFinite(v)) return null;
  return Math.min(item.max, Math.max(0, v));
}

/**
 * مجموع درجة الطالب.
 * البنود غير المرصودة تُستثنى من المقام وتبقى في الكلي، فيرى المعلّم الفرق
 * بين طالب درجته ناقصة وطالب لم يُرصد له بعد.
 */
export function studentTotal(items, ctx) {
  let earned = 0;
  let outOfGraded = 0;
  let outOfAll = 0;
  let missing = 0;

  for (const item of items) {
    if (item.deleted) continue;
    outOfAll += item.max;
    const v = itemScore(item, ctx);
    if (v === null) {
      missing++;
      continue;
    }
    earned += v;
    outOfGraded += item.max;
  }

  return {
    earned,
    outOfGraded,
    outOfAll,
    missing,
    pct: outOfGraded > 0 ? (earned / outOfGraded) * 100 : null,
    pctOfAll: outOfAll > 0 ? (earned / outOfAll) * 100 : null,
  };
}

export function masteryBand(pct) {
  if (pct === null || pct === undefined) return { key: 'none', label: 'لم يُرصد', badge: '' };
  if (pct >= 80) return { key: 'high', label: 'متقن', badge: 'badge--ok' };
  if (pct >= 50) return { key: 'mid', label: 'متذبذب', badge: 'badge--warn' };
  return { key: 'low', label: 'يحتاج دعم', badge: 'badge--danger' };
}

/* ---------- تجميع مساعد ---------- */

export function groupBy(records, key) {
  const out = Object.create(null);
  for (const r of records) {
    if (r.deleted) continue;
    const k = r[key];
    (out[k] ??= []).push(r);
  }
  return out;
}

export function indexScores(scores) {
  const out = Object.create(null);
  for (const s of scores) {
    if (s.deleted) continue;
    out[s.itemId] = s;
  }
  return out;
}
