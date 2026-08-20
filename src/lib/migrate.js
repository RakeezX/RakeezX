/**
 * MADAR Z — ترحيل المخطط القديم إلى النموذج الجديد.
 *
 * دالة نقية بلا مؤثرات جانبية: تأخذ بيانات بالشكل القديم وتعيدها بالشكل الجديد.
 * تُستعمل في موضعين:
 *   ١. عند أول إقلاع، لنسخ قاعدة النسخة السابقة إلى قاعدة MADAR Z.
 *   ٢. عند استيراد نسخة احتياطية قديمة.
 *
 * الشكل القديم: terms{name,year} · classes{termId,name,grade,subject}
 *               students{classId,rollNo} · attendance{studentId,classId,date}
 */

import {
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeEnrollment, makeSession,
  yearId, termId, subjectId, sectionId, teachingId, enrollmentId, sessionId, attendanceId,
  slugify, now, uid, todayISO,
} from '../models.js';

/** يحوّل الأرقام العربية إلى لاتينية. */
const westernize = (s) =>
  String(s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/**
 * يستخرج بداية السنة الهجرية من نص حر: '١٤٤٨-١٤٤٩' أو '1447' أو '١٤٤٧هـ'.
 * إن تعذّر التحليل يعيد null فيُنشأ سجل سنة يحتاج تصحيحًا يدويًا.
 */
export function parseHijriYear(text) {
  const nums = westernize(text).match(/\d{3,4}/g);
  if (!nums?.length) return null;
  const n = Number(nums[0]);
  return n >= 1300 && n <= 1600 ? n : null;
}

/** يستخرج رقم الفصل الدراسي من اسمه. */
export function parseTermIndex(name, fallback) {
  const t = String(name ?? '');
  if (/الثالث/.test(t)) return 3;
  if (/الثاني/.test(t)) return 2;
  if (/الأول|الاول/.test(t)) return 1;
  const n = westernize(t).match(/\d+/);
  return n ? Number(n[0]) : fallback;
}

/**
 * يفكّك اسم الفصل إلى رمز شعبة: '٤/أ' → 'أ' · 'الرابع ب' → 'ب'.
 * إن تعذّر يعيد الاسم كاملًا رمزًا، فلا تُفقد بيانات ويُصحَّح يدويًا.
 */
export function parseSectionLabel(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return 'أ';
  const slash = raw.split(/[/\\\-–]/);
  if (slash.length > 1) {
    const tail = slash.at(-1).trim();
    if (tail) return tail;
  }
  const parts = raw.split(/\s+/);
  const last = parts.at(-1);
  if (parts.length > 1 && last.length <= 3) return last;
  return raw;
}

/**
 * يحوّل بيانات الشكل القديم إلى الشكل الجديد.
 * يعيد { data, report } — التقرير يوثّق ما تعذّر تحليله.
 */
export function migrateLegacyData(legacy) {
  const stamp = now();
  const warn = [];
  const out = {
    profile: [], years: [], terms: [], subjects: [], sections: [], teachings: [],
    students: [], enrollments: [], items: [], scores: [], slots: [], sessions: [],
    attendance: [], logs: [], calendars: [], calendarDays: [], units: [], lessons: [],
    timeProfiles: [], notes: [], assignments: [], submissions: [],
  };

  const src = (k) => (Array.isArray(legacy?.[k]) ? legacy[k] : []);

  /* ---------- ١. السنوات ---------- */
  const yearByLabel = new Map();
  const oldTerms = src('terms');
  for (const t of oldTerms) {
    const label = String(t.year ?? '').trim() || 'غير محدد';
    if (yearByLabel.has(label)) continue;
    const hijri = parseHijriYear(label);
    if (hijri === null) warn.push(`تعذّر تحليل السنة «${label}» — أُنشئت سنة تحتاج تصحيحًا يدويًا.`);
    const y = makeYear({
      id: hijri ? yearId(hijri) : `y:unknown-${yearByLabel.size + 1}`,
      label: label === 'غير محدد' ? 'سنة تحتاج تصحيحًا' : label,
      hijriStart: hijri ?? 0,
      hijriEnd: hijri ? hijri + 1 : 0,
      order: hijri ?? 9999,
      status: 'active',
      updatedAt: stamp,
    });
    yearByLabel.set(label, y);
    out.years.push(y);
  }
  if (!out.years.length) {
    const y = makeYear({ hijriStart: 1448, updatedAt: stamp });
    yearByLabel.set('__default__', y);
    out.years.push(y);
  }
  const defaultYear = out.years[0];

  /* ---------- ٢. الفصول الدراسية ---------- */
  const termMap = new Map(); // oldTermId → new term
  oldTerms.forEach((t, i) => {
    const y = yearByLabel.get(String(t.year ?? '').trim() || 'غير محدد') ?? defaultYear;
    const index = parseTermIndex(t.name, i + 1);
    const nt = makeTerm({
      id: termId(y.id, index),
      yearId: y.id,
      name: t.name ?? `الفصل الدراسي ${index}`,
      index,
      startDate: null,
      endDate: null,
      status: 'active',
      updatedAt: t.updatedAt ?? stamp,
      deleted: !!t.deleted,
    });
    termMap.set(t.id, nt);
    if (!out.terms.some((x) => x.id === nt.id)) out.terms.push(nt);
  });
  if (!out.terms.length) {
    const nt = makeTerm({ yearId: defaultYear.id, index: 1, updatedAt: stamp });
    out.terms.push(nt);
  }
  const defaultTerm = out.terms[0];
  if (oldTerms.length && termMap.size) warn.push('تواريخ بداية الفصول الدراسية ونهايتها غير معروفة — تحتاج إدخالًا يدويًا.');

  /* ---------- ٣. المواد ---------- */
  const subjectBySlug = new Map();
  for (const c of src('classes')) {
    const name = String(c.subject ?? 'المهارات الرقمية').trim() || 'المهارات الرقمية';
    const slug = slugify(name);
    if (subjectBySlug.has(slug)) continue;
    const s = makeSubject({ id: subjectId(slug), name, slug, updatedAt: stamp });
    subjectBySlug.set(slug, s);
    out.subjects.push(s);
  }
  if (!out.subjects.length) {
    const s = makeSubject({ name: 'المهارات الرقمية', updatedAt: stamp });
    subjectBySlug.set(s.slug, s);
    out.subjects.push(s);
  }

  /* ---------- ٤+٥. الشعب والإسناد ---------- */
  const teachingByClass = new Map(); // oldClassId → teaching
  const sectionByClass = new Map();  // oldClassId → section

  src('classes').forEach((c, i) => {
    const term = termMap.get(c.termId) ?? defaultTerm;
    const year = out.years.find((y) => y.id === term.yearId) ?? defaultYear;
    const grade = Number(c.grade ?? 4);
    const label = parseSectionLabel(c.name);
    if (label === String(c.name ?? '').trim()) {
      warn.push(`اسم الفصل «${c.name}» لم يُفكَّك إلى صف ورمز شعبة — استُعمل الاسم كاملًا رمزًا.`);
    }

    const secId = sectionId(year.id, grade, label);
    let section = out.sections.find((s) => s.id === secId);
    if (!section) {
      section = makeSection({
        id: secId, yearId: year.id, grade, label,
        name: c.name ?? `${grade}/${label}`,
        color: c.color, order: c.order ?? i,
        updatedAt: c.updatedAt ?? stamp, deleted: !!c.deleted,
      });
      out.sections.push(section);
    }
    sectionByClass.set(c.id, section);

    const subj = subjectBySlug.get(slugify(c.subject ?? 'المهارات الرقمية')) ?? out.subjects[0];
    const tch = makeTeaching({
      id: teachingId(section.id, subj.id, term.id),
      sectionId: section.id, subjectId: subj.id, termId: term.id,
      order: c.order ?? i,
      updatedAt: c.updatedAt ?? stamp, deleted: !!c.deleted,
    });
    teachingByClass.set(c.id, tch);
    if (!out.teachings.some((t) => t.id === tch.id)) out.teachings.push(tch);
  });

  /* ---------- ٦. بنود التقييم ---------- */
  for (const it of src('items')) {
    const tch = teachingByClass.get(it.classId);
    if (!tch) continue;
    const { classId, ...rest } = it;
    out.items.push({ ...rest, teachingId: tch.id, unitId: it.unitId ?? null });
  }

  /* ---------- ٧. الدرجات — بلا تغيير ---------- */
  out.scores = src('scores').map((s) => ({ ...s }));

  /* ---------- ٨+٩. الطلاب والانتساب ---------- */
  for (const st of src('students')) {
    const { classId, rollNo, ...rest } = st;
    out.students.push({ ...rest, status: st.status ?? 'active' });

    const section = sectionByClass.get(classId);
    if (!section) continue;
    out.enrollments.push(
      makeEnrollment({
        id: enrollmentId(st.id, section.id),
        studentId: st.id, sectionId: section.id,
        rollNo: rollNo ?? null,
        startDate: null,
        endDate: null,
        status: st.deleted ? 'withdrawn' : 'active',
        updatedAt: st.updatedAt ?? stamp,
        deleted: !!st.deleted,
      })
    );
  }

  /* ---------- ١٠. الحصص من الحضور التاريخي ---------- */
  // لكل (فصل، تاريخ) حصة واحدة برقم ١، لأن المخطط القديم لم يكن يميّز الحصص أصلًا.
  const sessionByKey = new Map();
  for (const a of src('attendance')) {
    const tch = teachingByClass.get(a.classId);
    if (!tch || !a.date) continue;
    const key = `${tch.id}|${a.date}`;
    if (sessionByKey.has(key)) continue;
    const ses = makeSession({
      id: sessionId(tch.id, a.date, 1),
      teachingId: tch.id, date: a.date, period: 1,
      status: 'held',
      updatedAt: a.updatedAt ?? stamp,
    });
    sessionByKey.set(key, ses);
    out.sessions.push(ses);
  }
  if (sessionByKey.size) {
    warn.push(`رُحّل ${sessionByKey.size} يومًا من الحضور إلى حصص برقم ١ — المخطط القديم لم يكن يسجّل رقم الحصة.`);
  }

  /* ---------- ١١. الحضور بمفتاح الحصة ---------- */
  for (const a of src('attendance')) {
    const tch = teachingByClass.get(a.classId);
    if (!tch || !a.date) continue;
    const ses = sessionByKey.get(`${tch.id}|${a.date}`);
    if (!ses) continue;
    out.attendance.push({
      id: attendanceId(a.studentId, ses.id),
      studentId: a.studentId,
      sessionId: ses.id,
      teachingId: tch.id,     // مشتقّان من الحصة — للقراءة السريعة
      date: a.date,
      status: a.status ?? 'present',
      note: a.note ?? '',
      updatedAt: a.updatedAt ?? stamp,
      deleted: !!a.deleted,
    });
  }

  /* ---------- ١٢. الرصد السريع ---------- */
  for (const l of src('logs')) {
    const tch = teachingByClass.get(l.classId);
    if (!tch) continue;
    const { classId, ...rest } = l;
    const ses = sessionByKey.get(`${tch.id}|${l.date}`);
    out.logs.push({ ...rest, teachingId: tch.id, sessionId: ses?.id ?? null });
  }

  /* ---------- ١٣. بيانات المعلّم ---------- */
  // إعدادات الجهاز (المظهر، الفصل النشط) **لا تُنتج هنا** — فهي محلية للجهاز
  // ولا يجوز أن يفرضها ملفٌ قادم من جهاز آخر.
  const oldMeta = src('meta')[0] ?? legacy?.meta ?? null;
  out.profile = [
    {
      id: 'profile',
      teacherName: oldMeta?.teacherName ?? '',
      schoolName: oldMeta?.schoolName ?? '',
      phone: oldMeta?.phone ?? '',
      updatedAt: stamp,
      deleted: false,
    },
  ];

  const counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
  return { data: out, report: { warnings: [...new Set(warn)], counts } };
}

/** هل هذه البيانات على الشكل القديم؟ */
export const isLegacyShape = (data) =>
  !!data &&
  (Array.isArray(data.classes) ||
    (Array.isArray(data.students) && data.students.some((s) => s && 'classId' in s)));
