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
/** ترتيب عرض الرصد السريع فقط؛ أحدث حضور مسجل زمنيًا هو المرجع، والسجل الفارغ لا يمحوه. */
export function quickLogAttendanceState(roster, sessions, attendanceForSession) {
  const latestRecorded = new Map();
  const chronological = [...sessions].sort((a, b) => a.period - b.period);
  for (const session of chronological) {
    for (const record of attendanceForSession(session.id)) {
      if (record?.status) latestRecorded.set(record.studentId, record.status);
    }
  }
  return roster.map((student) => {
    const status = latestRecorded.get(student.id) ?? null;
    return { student, status, unavailable: status === 'absent' || status === 'excused' };
  });
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
export const sectionId = () => `sec:${uid()}`;
export const teachingId = (secId, subId, tmId) => `tch:${secId}|${subId}|${tmId}`;
export const enrollmentId = (studentId, secId) => `en:${studentId}:${secId}`;
export const slotId = () => `sl:${uid()}`;
export const sessionId = (tchId, date, period) => `se:${tchId}:${date}:${period}`;
export const attendanceId = (studentId, sesId) => `at:${studentId}:${sesId}`;
export const scoreId = (studentId, itemId) => `sc:${studentId}:${itemId}`;
export const scoreSubitemCompletionId = (studentId, subitemId) => `ssc:${studentId}:${subitemId}`;
export const groupArrangementId = (teachingId) => `group-arrangement:${teachingId}`;
export const calendarId = (yId, source) => `cal:${yId}:${source}`;
export const calendarDayId = (calId, date) => `cd:${calId}:${date}`;

// Sync V2 persists Calendar day IDs but not local range metadata. The exact
// calendar/date boundaries distinguish modern range IDs from legacy day IDs.
export function calendarRangeIdentity(day) {
  if (typeof day?.rangeId === 'string' && day.rangeId) return day.rangeId;
  const calendarId = String(day?.calendarId ?? '');
  const date = String(day?.date ?? '');
  const id = String(day?.id ?? '');
  const prefix = `cd:${calendarId}:`;
  const suffix = `:${date}`;
  if (calendarId && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      id.startsWith(prefix) && id.endsWith(suffix)) {
    const middle = id.slice(prefix.length, -suffix.length);
    if (middle) {
      // A renewed day uses a new record ID while retaining its range key.
      const renewed = middle.match(/^(.*):rev:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
      return renewed?.[1] || middle;
    }
  }
  return `legacy:${calendarId}:${id}`;
}

export const calendarRangeDayId = (calendarId, rangeId, date, renewalId = null) =>
  `cd:${calendarId}:${rangeId}${renewalId ? `:rev:${renewalId}` : ''}:${date}`;
export const submissionId = (studentId, assignmentId) => `sb:${studentId}:${assignmentId}`;
export const closedTermReportId = (termId) => `ctr:${termId}:${uid()}`;

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

// Timing-model editing consumes the existing canonical catalog; no second list.
export const GRADE_CATALOG = GRADES;

export const gradeLabel = (v) => GRADES.find((g) => g.v === Number(v))?.label ?? '';

export const sectionLabel = (sec) => sec ? `${gradeLabel(sec.grade)} / ${sec.label}` : '';

/** Conservative comparison-only normalization for section labels. */
export function normalizeSectionLabel(label) {
  return String(label ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[إأآٱ]/g, 'ا');
}

/** Search normalization preserves stored text while making Arabic lookup forgiving. */
export function normalizeSearchText(text) {
  return normalizeSectionLabel(text).toLowerCase();
}
export const SECTION_COLORS = [
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#e11d48',
  '#d97706',
  '#059669',
  '#ea580c',
  '#0284c7',
  '#c026d3',
  '#4f46e5',
  '#65a30d',
  '#9f1239',
  '#581c87',
  '#9a3412',
  '#065f46',
  '#475569',
];

/**
 * اختيار تلقائي للون الشعبة عند إنشاء فصل جديد.
 * يفضّل الألوان غير المستخدمة في الشعب الحالية، ثم الأقل استخدامًا، بالترتيب المعتمد للوحة الألوان.
 */
export function autoAssignSectionColor(existingSections = []) {
  const usedCounts = new Map();
  for (const c of SECTION_COLORS) usedCounts.set(c, 0);
  for (const s of existingSections) {
    if (s?.color && usedCounts.has(s.color)) {
      usedCounts.set(s.color, usedCounts.get(s.color) + 1);
    }
  }
  let minCount = Infinity;
  let bestColor = SECTION_COLORS[0];
  for (const c of SECTION_COLORS) {
    const count = usedCounts.get(c) || 0;
    if (count < minCount) {
      minCount = count;
      bestColor = c;
    }
  }
  return bestColor;
}

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

export const SECTION_STATUS = { active: 'نشط', archived: 'مؤرشف' };

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
  remote:   { label: 'عن بُعد',      teaching: true },
  holiday:  { label: 'إجازة',        teaching: false },
  suspension: { label: 'تعليق دراسة', teaching: false },
  national: { label: 'اليوم الوطني', teaching: false },
  founding: { label: 'يوم التأسيس',  teaching: false },
};
export const CALENDAR_KIND_ORDER = ['study', 'remote', 'holiday', 'suspension', 'national', 'founding', 'exam', 'event'];

/** هل يوم بهذا التصنيف يُدرَّس فيه؟ */
export const isTeachingDay = (kind) => CALENDAR_KIND[kind]?.teaching ?? true;

/** Display-only Calendar context for the existing non-counting session status. */
export function sessionCalendarPresentation(session, calendarDay) {
  const base = SESSION_STATUS[session?.status] ?? SESSION_STATUS.scheduled;
  if (session?.status !== 'cancelled_holiday' || calendarDay?.kind !== 'suspension') {
    return { ...base, reason: session?.reason ?? '' };
  }
  const reason = /^إجازة(?:\s|$)/u.test(session.reason ?? '')
    ? calendarDay.label || CALENDAR_KIND.suspension.label
    : session.reason ?? '';
  return { ...base, label: CALENDAR_KIND.suspension.label, reason };
}

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

/** 
 * يولّد حصص بتوقيتات متقدمة (طابور، فُسح مخصصة لصفوف معينة).
 * config = {
 *   assembly: { enabled: true, start: '06:45', duration: 15 },
 *   firstPeriodStart: '07:00',
 *   periodDuration: 45,
 *   count: 7,
 *   recess: {
 *     enabled: true,
 *     duration: 20,
 *     transition: 5,
 *     rules: [
 *       { grades: [4], afterPeriod: 2 },
 *       { grades: [5, 6], afterPeriod: 3 }
 *     ]
 *   }
 * }
 */
export function isValidRecessPosition(afterPeriod, count) {
  const position = Number(afterPeriod);
  const periods = Number(count);
  return Number.isInteger(position) && Number.isInteger(periods) && position >= 1 && position < periods;
}

export function recessPositions(count) {
  const periods = Number(count);
  if (!Number.isInteger(periods) || periods < 2) return [];
  return Array.from({ length: periods - 1 }, (_, index) => index + 1);
}

export function generateAdvancedPeriods(config) {
  const parseTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fmt = (mins) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  };

  const periods = [];
  const count = Number(config.count) || 0;
  const rules = config.recess?.enabled && config.recess?.rules?.length
    ? config.recess.rules.filter((rule) => isValidRecessPosition(rule.afterPeriod, count))
    : [];
  const globalRecessAfter = isValidRecessPosition(config.recess?.afterPeriod, count)
    ? Number(config.recess.afterPeriod)
    : null;
  
  if (!rules.length) {
    // Basic flat generation, but check if there's a simple global recess
    let cursor = parseTime(config.firstPeriodStart);
    for (let i = 1; i <= count; i++) {
      const start = cursor;
      const end = start + config.periodDuration;
      periods.push({ period: i, start: fmt(start), end: fmt(end) });
      cursor = end;
      if (config.recess?.enabled && i === globalRecessAfter) {
        cursor += (config.recess.duration || 0) + (config.recess.transition || 0);
      } else {
        cursor += (config.gap || 0);
      }
    }
    return periods;
  }

  // Complex generation: track each rule group and the default group independently.
  // The 'default' group is for grades not covered by any rule, but the prompt says 
  // "all grades converge again at P4", which means they just follow the max time? 
  // Actually, if we compute each rule path, and a default path:
  const paths = [
    ...rules.map(r => ({ grades: r.grades, afterPeriod: r.afterPeriod })),
    { grades: null, afterPeriod: Math.max(...rules.map(r => r.afterPeriod)) } // Default follows the latest break
  ];

  for (let path of paths) {
    let cursor = parseTime(config.firstPeriodStart);
    for (let i = 1; i <= count; i++) {
      const start = cursor;
      const end = start + config.periodDuration;
      
      const p = { period: i, start: fmt(start), end: fmt(end) };
      if (path.grades) p.grades = path.grades;
      periods.push(p);
      
      cursor = end;
      if (config.recess?.enabled && i === path.afterPeriod) {
        cursor += (config.recess.duration || 0) + (config.recess.transition || 0);
      } else {
        cursor += (config.gap || 0);
      }
    }
  }

  // Deduplicate identical periods
  const unique = [];
  const sig = (p) => `${p.period}|${p.start}|${p.end}`;
  const grouped = {};
  for (let p of periods) {
    const s = sig(p);
    if (!grouped[s]) grouped[s] = [];
    if (p.grades) grouped[s].push(...p.grades);
    else grouped[s].isDefault = true;
  }
  
  for (let s in grouped) {
    const [periodStr, startStr, endStr] = s.split('|');
    const p = { period: Number(periodStr), start: startStr, end: endStr };
    if (!grouped[s].isDefault) {
      // Only keep unique grades
      p.grades = Array.from(new Set(grouped[s])).sort((a, b) => a - b);
    }
    unique.push(p);
  }
  
  // Sort by period, then by whether it has grades (default last)
  unique.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    if (a.grades && !b.grades) return -1;
    if (!a.grades && b.grades) return 1;
    return 0;
  });

  return unique;
}

export const makeTimeProfile = (o = {}) => ({
  ...base(),
  ...o,
  name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'ملف توقيت',
  order: o.order ?? 0,
  periods: o.periods ?? buildPeriods(7, '07:00', 40, 5),
  overrides: o.overrides ?? {},
  activeFrom: o.activeFrom ?? null,
  activeTo: o.activeTo ?? null,
});

export const TIMING_PRESETS = {
  summer: {
    type: 'summer', gap: 0,
    assembly: { enabled: true, start: '06:45', duration: 15 },
    firstPeriodStart: '07:00', periodDuration: 45, count: 7,
    recess: {
      enabled: true, duration: 20, transition: 5,
      rules: [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }]
    }
  },
  winter: {
    type: 'winter', gap: 0,
    assembly: { enabled: true, start: '07:15', duration: 15 },
    firstPeriodStart: '07:30', periodDuration: 45, count: 7,
    recess: {
      enabled: true, duration: 20, transition: 0,
      rules: [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }]
    }
  },
  ramadan: {
    type: 'ramadan', gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: '09:00', periodDuration: 35, count: 6,
    recess: { enabled: false }
  },
  remote: {
    type: 'remote', gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: '07:00', periodDuration: 30, count: 8,
    recess: { enabled: false }
  },
  custom: {
    type: 'custom', gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: '07:00', periodDuration: 40, count: 7,
    recess: { enabled: false }
  },
  hybrid: {
    type: 'hybrid', gap: 0,
    assembly: { enabled: false },
    firstPeriodStart: '07:00', periodDuration: 30, count: 8,
    recess: { enabled: false }
  }
};

/**
 * الملفات المبدئية — **سجلات قابلة للتعديل والحذف وإعادة التسمية**، لا ثوابت
 * في الشيفرة. تُنشأ مرة واحدة عند أول تشغيل ثم تصير ملك المعلّم.
 */
export const DEFAULT_TIME_PROFILE_IDS = Object.freeze({
  summer: 'time-profile:default:summer',
  winter: 'time-profile:default:winter',
  ramadan: 'time-profile:default:ramadan',
  hybrid: 'time-profile:default:hybrid',
});

export const DEFAULT_TIME_PROFILES = [
  {
    id: DEFAULT_TIME_PROFILE_IDS.summer,
    name: 'التوقيت الصيفي',
    periods: generateAdvancedPeriods(TIMING_PRESETS.summer),
    overrides: { config: TIMING_PRESETS.summer }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.winter,
    name: 'التوقيت الشتوي',
    periods: generateAdvancedPeriods(TIMING_PRESETS.winter),
    overrides: { config: TIMING_PRESETS.winter }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.ramadan,
    name: 'توقيت رمضان',
    periods: generateAdvancedPeriods(TIMING_PRESETS.ramadan),
    overrides: { config: TIMING_PRESETS.ramadan }
  },
  {
    id: DEFAULT_TIME_PROFILE_IDS.hybrid,
    name: 'التوقيت المدمج',
    periods: generateAdvancedPeriods(TIMING_PRESETS.hybrid),
    overrides: { config: TIMING_PRESETS.hybrid, remote: generateAdvancedPeriods(TIMING_PRESETS.remote) }
  }
];

/** وقت حصة برقمها في يوم معيّن — يقدّم استثناء اليوم على الافتراضي. إذا مُرر الصف الدراسي يُفضل المخصص له. */
export function periodTime(profile, weekday, period, grade = null) {
  if (!profile) return null;
  const ov = profile.overrides?.[String(weekday)] ?? profile.overrides?.[weekday];
  const list = Array.isArray(ov) && ov.length ? ov : profile.periods;
  const matches = list?.filter((p) => Number(p.period) === Number(period)) ?? [];
  
  if (!matches.length) return null;
  
  if (grade !== null) {
    const exact = matches.find((p) => Array.isArray(p.grades) && p.grades.includes(Number(grade)));
    if (exact) return exact;
  }
  
  return matches.find((p) => !p.grades) ?? matches[0];
}

/** أرقام الحصص المتاحة في ملف توقيت ليوم معيّن. */
export function periodNumbers(profile, weekday = null) {
  if (!profile) return [1, 2, 3, 4, 5, 6, 7];
  const ov = weekday !== null ? profile.overrides?.[String(weekday)] : null;
  const list = Array.isArray(ov) && ov.length ? ov : profile.periods;
  return Array.from(new Set((list ?? []).map((p) => Number(p.period)))).sort((a, b) => a - b);
}


/* ---------- الإعدادات: حساب مقابل جهاز ---------- */

/**
 * فُصلت عمدًا إلى سجلين:
 *   profile — بيانات المعلّم. تخصّ الحساب، تُصدَّر في النسخ الاحتياطية وتُدمج.
 *   device  — إعدادات هذا الجهاز. **لا تُصدَّر ولا تُستورد أبدًا**، فلا يغيّر
 *             ملفُ نسخةٍ من جهاز آخر مظهرَك أو فصلك الدراسي النشط.
 */
export const makeProfile = (o = {}) => ({
  id: 'profile',
  updatedAt: now(),
  deleted: false,
  teacherName: o.teacherName ?? '',
  schoolName: o.schoolName ?? '',
  phone: o.phone ?? '',
  teacherForm: o.teacherForm === 'feminine' ? 'feminine' : 'masculine',
  educationDepartment: o.educationDepartment ?? null,
  // اسم المدير جزء من هوية الحساب المتزامنة. نحتفظ بالاسم القديم للتوافق
  // مع النسخ المحلية السابقة التي استخدمت principalName.
  reportPrincipalName: o.reportPrincipalName ?? o.principalName ?? '',
  principalName: o.principalName ?? o.reportPrincipalName ?? '',
  // اختيار ملف التوقيت قرار للحساب كله. يظل null إلى أن يختار المعلّم صراحةً.
  activeTimeProfileId: o.activeTimeProfileId ?? null,
  ...o,
});

export const makeDevice = (o = {}) => ({
  id: 'device',
  updatedAt: now(),
  deleted: false,
  theme: o.theme ?? 'light',
  activeYearId: o.activeYearId ?? null,
  activeTermId: o.activeTermId ?? null,
  activeTimeProfileId: o.activeTimeProfileId ?? null,
  reportPrincipalName: o.reportPrincipalName ?? '',
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
  id: o.id ?? sectionId(),
  yearId: o.yearId,
  grade: Number(o.grade ?? 4),
  label: o.label ?? 'أ',
  name: o.name ?? `${o.grade ?? 4}/${o.label ?? 'أ'}`,
  color: safeColor(o.color),
  order: o.order ?? 0,
  status: o.status ?? 'active',
  archivedAt: o.archivedAt ?? null,
  archiveDate: o.archiveDate ?? null,
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
  scoreMode: o.scoreMode ?? 'direct',
  distributionMode: o.distributionMode ?? null,
  // Only an explicitly reviewed group establishes cross-teaching equivalence.
  portabilityGroupId: o.portabilityGroupId ?? null,
  distributionOriginId: o.distributionOriginId ?? null,
  distributionVersion: o.distributionVersion ?? 1,
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

export const makeScoreSubitem = (o = {}) => ({
  ...base(),
  itemId: o.itemId,
  name: o.name ?? '',
  value: o.value ?? 0,
  order: o.order ?? 0,
  distributionVersion: o.distributionVersion ?? 1,
  ...o,
});

export const makeScoreSubitemCompletion = (o = {}) => ({
  ...base(),
  id: o.id ?? scoreSubitemCompletionId(o.studentId, o.subitemId),
  studentId: o.studentId,
  subitemId: o.subitemId,
  checked: o.checked === true,
  ...o,
});

/** الخانة في الجدول الأسبوعي — بلا أوقات، فالوقت يأتي من ملف التوقيت. */
export const makeSlot = (o = {}) => ({
  ...base(),
  id: o.id ?? slotId(),
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

/** ملاحظة طالب مؤرّخة: سجل مستقل قابل للمزامنة، لا حقلًا قابلًا للاستبدال. */
export const makeNote = (o = {}) => ({
  ...base(),
  createdAt: o.createdAt ?? now(),
  studentId: o.studentId ?? null,
  teachingId: o.teachingId ?? null,
  sessionId: o.sessionId ?? null,
  date: o.date ?? todayISO(),
  kind: o.kind ?? 'general',
  text: o.text ?? '',
  ...o,
});

/** قانون صفي مستقل يتبع الإسناد التدريسي، بلا ترتيب أو حالة عرض في V1. */
export const makeClassRule = (o = {}) => ({
  ...base(),
  createdAt: o.createdAt ?? now(),
  teachingId: o.teachingId,
  iconKey: o.iconKey ?? '',
  text: o.text ?? '',
  ...o,
});

/** ترتيب مجموعات واحد متزامن لكل إسناد؛ هوية الأعضاء دائمًا student.id. */
export const makeGroupArrangement = (o = {}) => ({
  ...base(),
  id: o.id ?? groupArrangementId(o.teachingId),
  teachingId: o.teachingId,
  groups: Array.isArray(o.groups) ? o.groups : [],
  ...o,
});

/** مجموعة تقارير فصل مغلق. المحتوى الكامل يأتي من أمر الإغلاق الخادمي فقط. */
export const makeClosedTermReport = (o = {}) => ({
  ...base(),
  id: o.id ?? closedTermReportId(o.termId),
  termId: o.termId,
  yearId: o.yearId,
  version: Number(o.version ?? 1),
  supersedesId: o.supersedesId ?? null,
  sourceManifest: o.sourceManifest ?? [],
  payload: o.payload ?? {},
  state: 'complete',
  createdAt: o.createdAt ?? now(),
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
  const hasAutomaticProjection = Object.prototype.hasOwnProperty.call(ctx.automaticByItem ?? {}, item.id);
  const automatic = hasAutomaticProjection ? ctx.automaticByItem[item.id] : null;
  if (item.auto === 'participation') {
    // ما دام الإسناد كله بلا رصد مشاركة، فالبند لم يُرصد بعد — لا أن الطالب صفر.
    if (hasAutomaticProjection && !automatic) return null;
    if (!(hasAutomaticProjection ? automatic.classHasParticipation : ctx.classHasParticipation)) return null;
    const pts = Math.max(0, netPoints(hasAutomaticProjection ? automatic.logs : ctx.logs ?? [], 'participation'));
    return Math.min(item.max, pts * (item.perPoint ?? 1));
  }
  if (item.auto === 'attendance') {
    if (hasAutomaticProjection && !automatic) return null;
    const attendance = hasAutomaticProjection ? automatic.attendance : ctx.attendance;
    if (!attendance?.length) return null;
    const misses = absenceCount(attendance);
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
