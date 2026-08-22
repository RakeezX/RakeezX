/**
 * RAKEEZ X — المخزن: الحالة في الذاكرة + الحفظ في IndexedDB + الإشعار بالتغيير.
 *
 * كل تعديل يمر من هنا، فيُحفظ فورًا ويُسجَّل في صندوق الصادر (outbox)
 * ليُرفع لاحقًا عند تفعيل المزامنة السحابية.
 */

import * as db from './lib/db.js';

import {
  now, uid, todayISO, scoreId, attendanceId, sessionId, enrollmentId,
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeEnrollment,
  makeSession, makeSlot, makeCalendar, makeTimeProfile, makeProfile, makeDevice,
  defaultItemsFor, DEFAULT_TIME_PROFILES, TERMS_PER_YEAR, termIndexes,
  periodTime, periodNumbers, weekday,
  sortStudents, sortByOrder, indexScores, groupBy, compareArabic, sectionLabel
} from './models.js';

/** إصدار شكل البيانات — يرتفع حين تحتاج السجلات الموجودة ترقية. */
const SCHEMA_VERSION = 4;

/* ---------- الحالة ---------- */

const COLLECTIONS = [
  'years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments',
  'items', 'scores', 'slots', 'sessions', 'attendance', 'logs',
  'calendars', 'calendarDays', 'units', 'lessons', 'timeProfiles',
  'notes', 'assignments', 'submissions',
];

export const state = {
  ready: false,
  /** بيانات المعلّم — تُصدَّر وتُدمج */
  profile: null,
  /** إعدادات هذا الجهاز — لا تغادره */
  device: null,

  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
};

const DEFAULT_PROFILE = makeProfile();
const DEFAULT_DEVICE = makeDevice({ schemaVersion: SCHEMA_VERSION });

/* ---------- الاشتراك ---------- */

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let notifyQueued = false;
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    for (const fn of listeners) fn(state);
  });
}

/* ---------- الإبلاغ عن فشل الحفظ ---------- */

let errorHandler = null;
export const onWriteError = (fn) => { errorHandler = fn; };

function reportWriteError(err, context) {
  console.error('[rakeezx] تعذر الحفظ', context, err);
  console.error('[rakeezx sync db debug] IndexedDB Error Name:', err.name);
  console.error('[rakeezx sync db debug] IndexedDB Error Message:', err.message);
  console.error('[rakeezx sync db debug] IndexedDB Context:', JSON.stringify(context, null, 2));
  try {
    errorHandler?.(err, context);
  } catch (e) {
    console.error('[rakeezx] فشل معالج الأخطاء', e);
  }
}

/* ---------- التنسيق بين التبويبات ---------- */

const TAB_ID = uid();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('rakeezx-data') : null;

function broadcast(changes) {
  if (!channel || !changes.length) return;
  try {
    channel.postMessage({ from: TAB_ID, changes });
  } catch (err) {
    console.warn('[rakeezx] تعذّر إبلاغ التبويبات الأخرى', err);
  }
}

channel?.addEventListener('message', (ev) => {
  if (!ev.data || ev.data.from === TAB_ID) return;
  absorb(ev.data.changes).catch((err) => console.warn('[rakeezx] تعذّر استقبال تغيير', err));
});

/**
 * يُغلق قناة BroadcastChannel.
 * يُستدعى من بيئة الاختبار فقط بعد انتهاء جميع الاختبارات لمنع تسرّب الموارد
 * وإبقاء Node.js حيًّا بعد انتهاء مجموعة الاختبارات.
 */
export function closeChannel() {
  if (channel) channel.close();
}

async function absorb(changes) {
  const byStore = {};
  for (const c of changes ?? []) (byStore[c.store] ??= new Set()).add(c.id);

  for (const [storeName, ids] of Object.entries(byStore)) {
    if (storeName === 'profile' || storeName === 'device') {
      const fresh = await db.get(storeName, storeName);
      if (fresh) state[storeName] = fresh;
      continue;
    }
    const arr = state[storeName];
    if (!Array.isArray(arr)) continue;

    for (const id of ids) {
      const fresh = await db.get(storeName, id);
      const i = arr.findIndex((r) => r.id === id);
      if (fresh) {
        if (i >= 0) arr[i] = fresh;
        else arr.push(fresh);
      } else if (i >= 0) {
        arr.splice(i, 1);
      }
    }
  }
  notify();
}

const changeList = (storeName, records) => records.map((r) => ({ store: storeName, id: r.id }));

/* ---------- الإقلاع والترحيل ---------- */


/**
 * ترقية ٣ → ٤: يفصل سجل الإعدادات الواحد إلى ملف معلّم وإعدادات جهاز.
 * تُشغَّل مرة واحدة، ولا تفقد شيئًا: كل حقل يذهب إلى موضعه الصحيح.
 */
async function splitMetaIfNeeded() {
  const [profile, device, oldMeta] = await Promise.all([
    db.get('profile', 'profile'),
    db.get('device', 'device'),
    db.get('meta', 'meta'),
  ]);
  if (profile && device) return false;

  const src = oldMeta ?? {};
  const nextProfile = profile ?? makeProfile({
    teacherName: src.teacherName ?? '',
    schoolName: src.schoolName ?? '',
    phone: src.phone ?? '',
  });
  const nextDevice = device ?? makeDevice({
    theme: src.theme ?? 'auto',
    activeYearId: src.activeYearId ?? null,
    activeTermId: src.activeTermId ?? null,
    lastSyncAt: src.lastSyncAt ?? null,
    schemaVersion: SCHEMA_VERSION,
  });

  await db.putAcross({ profile: [nextProfile], device: [nextDevice] });
  if (oldMeta) await db.clearStore('meta');   // السجل القديم أدّى دوره
  return true;
}

export async function init() {
  await db.openDB();

  const hadProfile = await db.get('profile', 'profile');
  const hadMeta = await db.get('meta', 'meta');

  await splitMetaIfNeeded();

  const [profile, device, ...loaded] = await Promise.all([
    db.get('profile', 'profile'),
    db.get('device', 'device'),
    ...COLLECTIONS.map((c) => db.getAll(c)),
  ]);

  state.profile = { ...DEFAULT_PROFILE, ...(profile ?? {}) };
  state.device = { ...DEFAULT_DEVICE, ...(device ?? {}) };
  COLLECTIONS.forEach((c, i) => {
    state[c] = loaded[i] ?? [];
  });


  await ensureFoundation();

  applyTheme();
  state.ready = true;
  notify();
  db.persist();
  return state;
}

/**
 * يضمن الأساس: سنة، وفصولها الدراسية بعدد إعداد المنتج، ومادة، وملفات توقيت،
 * ومؤشّرات جهاز صالحة. إجراء متكرر آمن يُصلح أي مؤشّر معلّق بعد استرجاع نسخة.
 */
async function ensureFoundation() {
  const writes = {};
  const push = (k, rec) => {
    (writes[k] ??= []).push(rec);
    if (Array.isArray(state[k])) state[k].push(rec);
  };

  if (!live(state.years).length) push('years', makeYear({ hijriStart: 1448 }));

  // السنة التي نضمن فصولها هي **النشطة**، لا أول سنة في ترتيب الإدخال —
  // وإلا أُنشئ الفصل الثاني لسنة أخرى غير التي يعمل عليها المعلّم.
  const year =
    live(state.years).find((y) => y.id === state.device?.activeYearId) ?? live(state.years)[0];

  // فصول السنة الدراسية بعدد الإعداد الحالي (فصلان)، بلا حذف ما زاد عنها
  const existing = live(state.terms).filter((t) => t.yearId === year.id);
  for (const index of termIndexes()) {
    if (existing.some((t) => t.index === index)) continue;
    push('terms', makeTerm({ yearId: year.id, index, status: index === 1 ? 'active' : 'upcoming' }));
  }

  if (!live(state.subjects).length) push('subjects', makeSubject({ name: 'المهارات الرقمية' }));

  // ملفات التوقيت المبدئية — سجلات قابلة للتعديل، لا ثوابت
  if (!live(state.timeProfiles).length) {
    DEFAULT_TIME_PROFILES.forEach((p, i) => push('timeProfiles', makeTimeProfile({ ...p, order: i })));
  }

  const terms = live(state.terms).filter((t) => t.yearId === year.id)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const profiles = live(state.timeProfiles);

  const patch = {};
  const d = state.device;
  if (!d.activeYearId || !state.years.some((y) => y.id === d.activeYearId && !y.deleted)) {
    patch.activeYearId = year.id;
  }
  if (!d.activeTermId || !state.terms.some((t) => t.id === d.activeTermId && !t.deleted)) {
    patch.activeTermId = terms[0]?.id ?? null;
  }
  if (!d.activeTimeProfileId || !profiles.some((p) => p.id === d.activeTimeProfileId)) {
    patch.activeTimeProfileId = profiles[0]?.id ?? null;
  }
  if (d.schemaVersion !== SCHEMA_VERSION) patch.schemaVersion = SCHEMA_VERSION;

  if (Object.keys(patch).length) {
    state.device = { ...state.device, ...patch, updatedAt: now() };
    writes.device = [state.device];
  }

  if (Object.keys(writes).length) await db.putAcross(writes);
}

/* ---------- الكتابة ---------- */

const outboxEntry = (storeName, rec, fields = null, op = 'put') => ({
  id: `${storeName}:${rec.id}`,
  store: storeName,
  recordId: rec.id,
  op,
  fields: fields ? [...fields] : null,
  updatedAt: rec.updatedAt,
  queuedAt: now(),
});

function applyToMemory(storeName, records) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return [];
  const undo = [];
  for (const rec of records) {
    const i = arr.findIndex((x) => x.id === rec.id);
    undo.push({ index: i, previous: i >= 0 ? arr[i] : null });
    if (i >= 0) arr[i] = rec;
    else arr.push(rec);
  }
  return undo;
}

function revertMemory(storeName, records, undo) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return;
  for (let k = undo.length - 1; k >= 0; k--) {
    const { index, previous } = undo[k];
    if (previous) arr[index] = previous;
    else {
      const i = arr.findIndex((x) => x.id === records[k].id);
      if (i >= 0) arr.splice(i, 1);
    }
  }
}

/** يحفظ سجلات كاملة — للإنشاء والاستيراد الجماعي. للتعديل استعمل patch(). */
export async function save(batch) {
  const writes = {};
  const outbox = [];
  const undos = [];
  const changes = [];

  for (const [storeName, records] of Object.entries(batch)) {
    if (!records?.length) continue;
    writes[storeName] = records;
    undos.push([storeName, records, applyToMemory(storeName, records)]);
    changes.push(...changeList(storeName, records));
    if (storeName !== 'meta') outbox.push(...records.map((r) => outboxEntry(storeName, r)));
  }
  if (!changes.length) return true;

  if (outbox.length) writes.outbox = outbox;
  notify();

  try {
    await db.putAcross(writes);
    broadcast(changes);
    return true;
  } catch (err) {
    for (const [storeName, records, undo] of undos) revertMemory(storeName, records, undo);
    notify();
    reportWriteError(err, { op: 'save', stores: Object.keys(batch) });
    return false;
  }
}

/**
 * تعديل حقول محددة في سجل قائم.
 * الأساس يُقرأ من القرص داخل المعاملة، فلا يُكتب إلا الحقول المطلوبة فوق
 * أحدث نسخة موجودة.
 */
export async function patch(storeName, id, changes, create = null, options = {}) {
  // profile و device سجلان مفردان لا مصفوفتان — ولا يدخل device في الصادر أبدًا
  const singleton = storeName === 'profile' || storeName === 'device';
  const arr = state[storeName];
  const idx = Array.isArray(arr) ? arr.findIndex((r) => r.id === id) : -1;

  const known = singleton ? state[storeName] : idx >= 0 ? arr[idx] : null;
  const base = known ?? create;
  if (!base) return null;

  const preserve = options.preserveTimestamp && changes.updatedAt !== undefined;
  const newStamp = preserve ? changes.updatedAt : now();
  const optimistic = { ...base, ...changes, id, updatedAt: newStamp };
  const undo = singleton ? [] : applyToMemory(storeName, [optimistic]);
  const previous = singleton ? state[storeName] : null;
  if (singleton) state[storeName] = optimistic;
  notify();

  try {
    const [authoritative] = await db.patchMany(
      storeName,
      [{ id, changes, create: create ? { ...create, id } : null }],
      storeName === 'device' ? null : (rec, fields) => outboxEntry(storeName, rec, fields, 'patch'),
      newStamp
    );

    if (!authoritative) {
      if (singleton) state[storeName] = previous;
      else revertMemory(storeName, [optimistic], undo);
      notify();
      return null;
    }

    if (singleton) state[storeName] = authoritative;
    else applyToMemory(storeName, [authoritative]);
    broadcast([{ store: storeName, id }]);
    notify();
    return authoritative;
  } catch (err) {
    if (singleton) state[storeName] = previous;
    else revertMemory(storeName, [optimistic], undo);
    notify();
    reportWriteError(err, { op: 'patch', store: storeName, id, fields: Object.keys(changes) });
    return null;
  }
}

export const touch = (rec, changes = {}) => ({ ...rec, ...changes, updatedAt: now() });

export async function upsert(storeName, rec) {
  const ok = await save({ [storeName]: [rec] });
  return ok ? rec : null;
}

export const softDelete = (storeName, id) => patch(storeName, id, { deleted: true });

/** بيانات المعلّم — تُصدَّر في النسخ الاحتياطية وتُدمج. */
export const patchProfile = (changes, options = {}) => patch('profile', 'profile', changes, { ...DEFAULT_PROFILE }, options);

/** إعدادات هذا الجهاز — لا تغادره ولا يستوردها ملف نسخة. */
export const patchDevice = (changes) => patch('device', 'device', changes, { ...DEFAULT_DEVICE });

async function patchManyRecords(storeName, edits, context) {
  if (!edits.length) return true;
  try {
    const updated = await db.patchMany(storeName, edits,
      (rec, fields) => outboxEntry(storeName, rec, fields, 'patch'));
    applyToMemory(storeName, updated);
    notify();
    broadcast(changeList(storeName, updated));
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

async function cascadeDelete(predicates, context) {
  try {
    const { touched } = await db.markDeleted(predicates, now());
    const changes = [];
    for (const [storeName, ids] of Object.entries(touched)) {
      const arr = state[storeName];
      if (!Array.isArray(arr)) continue;
      for (const id of ids) {
        const i = arr.findIndex((r) => r.id === id);
        if (i >= 0) arr[i] = { ...arr[i], deleted: true, updatedAt: now() };
        changes.push({ store: storeName, id });
      }
    }
    notify();
    broadcast(changes);
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

/* ---------- المظهر ---------- */

export function applyTheme() {
  const t = state.device?.theme ?? 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);

  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1216' : '#0f766e');
}

/* ---------- المحدِّدات ---------- */

const live = (arr) => arr.filter((r) => !r.deleted);

export const years = () => [...live(state.years)].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
export const activeYear = () =>
  state.years.find((y) => y.id === state.device?.activeYearId && !y.deleted) ?? live(state.years)[0] ?? null;

export const termsOf = (yId) =>
  live(state.terms).filter((t) => !yId || t.yearId === yId).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
export const activeTerm = () =>
  state.terms.find((t) => t.id === state.device?.activeTermId && !t.deleted) ??
  termsOf(activeYear()?.id)[0] ?? null;

/** أرقام الفصول الدراسية المستعملة فعلًا في السنة النشطة — وإلا فإعداد المنتج. */
export function activeTermIndexes() {
  const list = termsOf(activeYear()?.id).map((t) => t.index).filter(Boolean);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : termIndexes();
}

export const getTerm = (id) => state.terms.find((t) => t.id === id && !t.deleted) ?? null;
export const getYear = (id) => state.years.find((y) => y.id === id && !y.deleted) ?? null;

/** هل الفصل الدراسي مغلق؟ عندها تُمنع الكتابة عليه. */
export const isTermClosed = (tmId) => {
  const t = getTerm(tmId);
  if (!t) return false;
  const y = getYear(t.yearId);
  return t.status === 'closed' || y?.status === 'archived';
};

export const subjects = () => live(state.subjects).sort((a, b) => compareArabic(a.name, b.name));
export const getSubject = (id) => state.subjects.find((s) => s.id === id && !s.deleted) ?? null;

export const sections = (yId = activeYear()?.id) =>
  sortByOrder(live(state.sections).filter((s) => !yId || s.yearId === yId));
export const getSection = (id) => state.sections.find((s) => s.id === id && !s.deleted) ?? null;

/** الإسنادات التدريسية في فصل دراسي — وهي ما يراه المعلّم في «الفصول». */
export const teachings = (tmId = activeTerm()?.id) =>
  sortByOrder(live(state.teachings).filter((t) => !tmId || t.termId === tmId));
export const getTeaching = (id) => state.teachings.find((t) => t.id === id && !t.deleted) ?? null;

/** وصف مقروء للإسناد: «الرابع الابتدائي / أ · المهارات الرقمية». */
export function teachingLabel(tch) {
  if (!tch) return '';
  const sec = getSection(tch.sectionId);
  const sub = getSubject(tch.subjectId);
  return [sectionLabel(sec), sub?.name].filter(Boolean).join(' · ');
}

export const getStudent = (id) => state.students.find((s) => s.id === id && !s.deleted) ?? null;
export const allStudents = () => live(state.students);

export const enrollmentsOf = (studentId) =>
  live(state.enrollments).filter((e) => e.studentId === studentId);
export const enrollmentsIn = (secId) =>
  live(state.enrollments).filter((e) => e.sectionId === secId);
export const activeEnrollment = (studentId) =>
  enrollmentsOf(studentId).find((e) => e.status === 'active') ?? null;

/**
 * كشف الشعبة: الطلاب المنتسبون حاليًا، مدموجًا معهم rollNo من الانتساب.
 * الشاشات تقرأ الطالب كما كانت تمامًا — ولا تعرف بوجود جدول الانتساب.
 */
export function sectionRoster(secId) {
  const rows = [];
  for (const en of enrollmentsIn(secId)) {
    if (en.status !== 'active') continue;
    const st = getStudent(en.studentId);
    if (!st) continue;
    rows.push({ ...st, rollNo: en.rollNo, enrollmentId: en.id, sectionId: secId });
  }
  return sortStudents(rows);
}

/** كشف الإسناد = كشف شعبته. */
export const students = (tchId) => {
  const tch = getTeaching(tchId);
  return tch ? sectionRoster(tch.sectionId) : [];
};

export const items = (tchId) =>
  sortByOrder(live(state.items).filter((i) => i.teachingId === tchId));

export const scoresOf = (studentId) => live(state.scores).filter((s) => s.studentId === studentId);

export const attendanceOf = (studentId) =>
  live(state.attendance).filter((a) => a.studentId === studentId);

export const logsOf = (studentId) => live(state.logs).filter((l) => l.studentId === studentId);

/* ---------- الحصص ---------- */

export const sessionsOf = (tchId) =>
  live(state.sessions)
    .filter((s) => s.teachingId === tchId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period));

export const sessionsOn = (date) =>
  live(state.sessions).filter((s) => s.date === date).sort((a, b) => a.period - b.period);

export const sessionsOnFor = (tchId, date) =>
  live(state.sessions).filter((s) => s.teachingId === tchId && s.date === date)
    .sort((a, b) => a.period - b.period);

export const getSession = (id) => state.sessions.find((s) => s.id === id && !s.deleted) ?? null;

export const attendanceIn = (sesId) => live(state.attendance).filter((a) => a.sessionId === sesId);

/** كل التواريخ التي فيها حصص لهذا الإسناد، من الأحدث. */
export function sessionDates(tchId) {
  const set = new Set(sessionsOf(tchId).map((s) => s.date));
  return [...set].sort().reverse();
}

export const slotsOf = (tchId) =>
  live(state.slots).filter((s) => s.teachingId === tchId)
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);

export const allSlots = (tmId = activeTerm()?.id) => {
  const ids = new Set(teachings(tmId).map((t) => t.id));
  return live(state.slots).filter((s) => ids.has(s.teachingId))
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);
};

/** عدد الحصص الأسبوعية لإسناد — مشتق من الجدول لا رقم ثابت. */
export const weeklyPeriods = (tchId) => slotsOf(tchId).length;

/* ---------- ملفات توقيت الحصص ---------- */

export const timeProfiles = () => sortByOrder(live(state.timeProfiles));

export const getTimeProfile = (id) =>
  state.timeProfiles.find((p) => p.id === id && !p.deleted) ?? null;

export const activeTimeProfile = () =>
  getTimeProfile(state.device?.activeTimeProfileId) ?? timeProfiles()[0] ?? null;

/** وقت حصة برقمها في يوم — من الملف النشط ما لم يُطلب غيره. */
export const timeFor = (wd, period, profile = activeTimeProfile()) =>
  periodTime(profile, wd, period);

/** أرقام الحصص المتاحة في يوم حسب الملف النشط. */
export const availablePeriods = (wd = null, profile = activeTimeProfile()) =>
  periodNumbers(profile, wd);

export const setActiveTimeProfile = (id) => patchDevice({ activeTimeProfileId: id });

export async function createTimeProfile(data) {
  const p = makeTimeProfile({ order: timeProfiles().length, ...data });
  await save({ timeProfiles: [p] });
  return p;
}

export const deleteTimeProfile = (id) => softDelete('timeProfiles', id);

/* ---------- التقويم ---------- */

export const calendarsOf = (yId) => live(state.calendars).filter((c) => c.yearId === yId);
export const activeCalendar = () => calendarsOf(activeYear()?.id)[0] ?? null;

export const calendarDaysOf = (calId) =>
  live(state.calendarDays).filter((d) => d.calendarId === calId).sort((a, b) => (a.date < b.date ? -1 : 1));

/** تصنيف يوم معيّن في تقويم السنة النشطة — أو null إن لم يُدخل. */
export function calendarDayFor(date) {
  const cal = activeCalendar();
  if (!cal) return null;
  return live(state.calendarDays).find((d) => d.calendarId === cal.id && d.date === date) ?? null;
}

/* ---------- المنهج ---------- */

export const unitsFor = (subId, grade, termIndex) =>
  sortByOrder(
    live(state.units).filter(
      (u) => u.subjectId === subId &&
        (grade === undefined || u.grade === Number(grade)) &&
        (termIndex === undefined || u.termIndex === Number(termIndex))
    )
  );

export const lessonsOf = (unitId) => sortByOrder(live(state.lessons).filter((l) => l.unitId === unitId));
export const getLesson = (id) => state.lessons.find((l) => l.id === id && !l.deleted) ?? null;
export const getUnit = (id) => state.units.find((u) => u.id === id && !u.deleted) ?? null;

/**
 * وحدة المنهج التي يقيسها بند التقييم — من ربطه المباشر أو عبر درسه.
 * أساس تقارير إتقان المفاهيم لاحقًا؛ لا واجهة له بعد.
 */
export function itemCurriculum(item) {
  if (!item) return null;
  const lesson = item.lessonId ? getLesson(item.lessonId) : null;
  const unit = getUnit(item.unitId ?? lesson?.unitId ?? null);
  if (!lesson && !unit) return null;
  return { unit, lesson };
}

/* ---------- سياق الحساب ---------- */

export function teachingContext(tchId) {
  const roster = students(tchId);
  const ids = new Set(roster.map((s) => s.id));

  const scoresByStudent = groupBy(state.scores.filter((s) => ids.has(s.studentId)), 'studentId');
  const attByStudent = groupBy(
    state.attendance.filter((a) => ids.has(a.studentId) && a.teachingId === tchId), 'studentId');
  const logsByStudent = groupBy(
    state.logs.filter((l) => ids.has(l.studentId) && l.teachingId === tchId), 'studentId');

  const classHasParticipation = live(state.logs).some(
    (l) => l.teachingId === tchId && l.kind === 'participation'
  );

  const ctx = Object.create(null);
  for (const s of roster) {
    ctx[s.id] = {
      scoresByItem: indexScores(scoresByStudent[s.id] ?? []),
      attendance: attByStudent[s.id] ?? [],
      logs: logsByStudent[s.id] ?? [],
      classHasParticipation,
    };
  }
  return { roster, items: items(tchId), ctx };
}

/** سياق طالب داخل إسناد محدد — لا يخلط إسنادًا بآخر. */
export function studentContext(studentId, tchId) {
  const inTeaching = (r) => !tchId || r.teachingId === tchId;
  return {
    scoresByItem: indexScores(scoresOf(studentId)),
    attendance: attendanceOf(studentId).filter(inTeaching),
    logs: logsOf(studentId).filter(inTeaching),
    classHasParticipation: tchId
      ? live(state.logs).some((l) => l.teachingId === tchId && l.kind === 'participation')
      : false,
  };
}

/* ---------- عمليات: البنية ---------- */

export async function createYear(data) {
  const y = makeYear(data);
  await save({ years: [y] });
  return y;
}

export async function createTerm(data) {
  const t = makeTerm(data);
  await save({ terms: [t] });
  return t;
}

export async function createSubject(data) {
  const s = makeSubject(data);
  await save({ subjects: [s] });
  return s;
}

export async function createSection(data) {
  const year = activeYear();
  const s = makeSection({ yearId: year?.id, order: sections().length, ...data });
  await save({ sections: [s] });
  return s;
}

/** ينشئ إسنادًا تدريسيًا ومعه بنود التقييم الافتراضية. */
export async function createTeaching({ sectionId: secId, subjectId: subId, termId: tmId }) {
  const term = tmId ?? activeTerm()?.id;
  const tch = makeTeaching({
    sectionId: secId, subjectId: subId, termId: term,
    order: teachings(term).length,
  });
  if (getTeaching(tch.id)) return getTeaching(tch.id);
  await save({ teachings: [tch], items: defaultItemsFor(tch.id) });
  return tch;
}

/** حذف إسناد: يحذف بنوده ودرجاته وحصصه — **ولا يمس الطلاب ولا الشعبة**. */
export async function deleteTeaching(tchId) {
  const itemIds = new Set(state.items.filter((i) => i.teachingId === tchId).map((i) => i.id));
  const sessionIds = new Set(state.sessions.filter((s) => s.teachingId === tchId).map((s) => s.id));
  return cascadeDelete(
    {
      teachings: (t) => t.id === tchId,
      items: (i) => i.teachingId === tchId,
      scores: (s) => itemIds.has(s.itemId),
      slots: (s) => s.teachingId === tchId,
      sessions: (s) => s.teachingId === tchId,
      attendance: (a) => sessionIds.has(a.sessionId),
      logs: (l) => l.teachingId === tchId,
    },
    { op: 'deleteTeaching', tchId }
  );
}

/**
 * حذف شعبة: ينهي انتساب طلابها ويحذف إسناداتها — **ولا يحذف الطلاب أنفسهم**.
 * هوية الطالب مستقلة، فحذف الشعبة لا يجوز أن يمحوه.
 */
export async function deleteSection(secId) {
  const stamp = now();
  for (const tch of live(state.teachings).filter((t) => t.sectionId === secId)) {
    await deleteTeaching(tch.id);
  }
  return cascadeDelete(
    {
      sections: (s) => s.id === secId,
      enrollments: (e) => e.sectionId === secId,
    },
    { op: 'deleteSection', secId }
  );
}

/* ---------- عمليات: الطلاب والانتساب ---------- */

/* ---------- حدود وتحقق على مستوى البيانات ---------- */

/**
 * الحدود تُفرض هنا لا في الشاشة: كل ما يدخل من ملف نسخة أو من المزامنة لاحقًا
 * يمر من طبقة البيانات، والشاشة وحدها لا تكفي حارسًا.
 */
export const LIMITS = {
  nameMaxLength: 80,
  importMaxRows: 300,
  noteMaxLength: 500,
};

/** اسم صالح: ليس فارغًا ولا مسافات، ومقصوص عند الحد. */
export function normalizeName(value) {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;
  return name.slice(0, LIMITS.nameMaxLength);
}

/** هل رقم الكشف مأخوذ في هذه الشعبة؟ */
export function rollNoTaken(secId, rollNo, exceptEnrollmentId = null) {
  if (rollNo === null || rollNo === undefined || rollNo === '') return false;
  return enrollmentsIn(secId).some(
    (e) => e.status === 'active' && e.rollNo === Number(rollNo) && e.id !== exceptEnrollmentId
  );
}

const nextRollNo = (secId) =>
  enrollmentsIn(secId).reduce((m, e) => Math.max(m, e.rollNo ?? 0), 0) + 1;

/** يضبط رقم كشف مع منع التكرار داخل الشعبة. يعيد {ok, reason}. */
export async function setRollNo(enrollmentId, rollNo) {
  const en = state.enrollments.find((e) => e.id === enrollmentId && !e.deleted);
  if (!en) return { ok: false, reason: 'notFound' };

  const value = rollNo === null || rollNo === '' ? null : Number(rollNo);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 999)) {
    return { ok: false, reason: 'range' };
  }
  if (rollNoTaken(en.sectionId, value, en.id)) return { ok: false, reason: 'duplicate' };

  await patch('enrollments', en.id, { rollNo: value });
  return { ok: true };
}

/** يضيف طالبًا جديدًا وينسبه لشعبة. يرفض الاسم الفارغ. */
export async function addStudent(secId, name, { rollNo = null, note = '' } = {}) {
  const clean = normalizeName(name);
  if (!clean) return null;

  const student = {
    id: uid(), updatedAt: now(), deleted: false,
    name: clean, note: String(note ?? '').slice(0, LIMITS.noteMaxLength), status: 'active',
  };
  const nextRoll = rollNo ?? nextRollNo(secId);
  const en = makeEnrollment({ studentId: student.id, sectionId: secId, rollNo: nextRoll });
  await save({ students: [student], enrollments: [en] });
  return student;
}

/** يعدّل اسم طالب — يرفض الفارغ ويقصّ الطويل. */
export async function renameStudent(studentId, name) {
  const clean = normalizeName(name);
  if (!clean) return null;
  return patch('students', studentId, { name: clean });
}

/**
 * استيراد أسماء دفعة واحدة.
 * يعيد { added, skippedInvalid, skippedOverLimit } — فيعرف المعلّم ما لم يدخل ولماذا.
 */
export async function importStudents(secId, names) {
  const clean = [];
  let skippedInvalid = 0;

  for (const raw of names ?? []) {
    const n = normalizeName(raw);
    if (!n) { skippedInvalid++; continue; }
    clean.push(n);
  }

  const skippedOverLimit = Math.max(0, clean.length - LIMITS.importMaxRows);
  const accepted = clean.slice(0, LIMITS.importMaxRows);

  let roll = nextRollNo(secId) - 1;
  const stamp = now();
  const students = [];
  const enrollments = [];

  for (const name of accepted) {
    const st = { id: uid(), updatedAt: stamp, deleted: false, name, note: '', status: 'active' };
    students.push(st);
    enrollments.push(
      makeEnrollment({ studentId: st.id, sectionId: secId, rollNo: ++roll, updatedAt: stamp })
    );
  }
  if (students.length) await save({ students, enrollments });
  return { added: students.length, skippedInvalid, skippedOverLimit };
}

/**
 * نقل طالب بين شعبتين: يُنهى الانتساب القديم ويُفتح جديد.
 * لا يُحذف الطالب ولا تُنشأ له هوية جديدة، ودرجاته وحضوره السابقان يبقيان
 * مربوطين بإسنادات شعبته السابقة.
 */
export async function transferStudent(studentId, toSectionId, { date = todayISO(), note = '' } = {}) {
  const current = activeEnrollment(studentId);
  if (current?.sectionId === toSectionId) return current;

  if (current) {
    await patch('enrollments', current.id, {
      status: 'transferred', endDate: date, transferNote: note,
    });
  }

  const id = enrollmentId(studentId, toSectionId);
  const existing = state.enrollments.find((e) => e.id === id);
  if (existing) {
    return patch('enrollments', id, {
      status: 'active', startDate: date, endDate: null, deleted: false,
      rollNo: existing.rollNo ?? nextRollNo(toSectionId),
    });
  }

  const en = makeEnrollment({
    studentId, sectionId: toSectionId, rollNo: nextRollNo(toSectionId), startDate: date,
  });
  await save({ enrollments: [en] });
  return en;
}

/** خروج الطالب من المدرسة — بلا حذف، فيبقى سجله التاريخي كاملًا. */
export async function withdrawStudent(studentId, { date = todayISO(), note = '' } = {}) {
  const current = activeEnrollment(studentId);
  if (current) {
    await patch('enrollments', current.id, {
      status: 'withdrawn', endDate: date, transferNote: note,
    });
  }
  return patch('students', studentId, { status: 'withdrawn' });
}

/** عودة طالب غادر. */
export async function reinstateStudent(studentId, secId, { date = todayISO() } = {}) {
  await patch('students', studentId, { status: 'active' });
  return transferStudent(studentId, secId, { date });
}

/** حذف نهائي (ناعم) للطالب — للخطأ في الإدخال لا للانتقال. */
export async function deleteStudent(studentId) {
  return cascadeDelete(
    {
      students: (s) => s.id === studentId,
      enrollments: (e) => e.studentId === studentId,
      scores: (s) => s.studentId === studentId,
      attendance: (a) => a.studentId === studentId,
      logs: (l) => l.studentId === studentId,
    },
    { op: 'deleteStudent', studentId }
  );
}

export async function renumberRoster(secId) {
  const edits = sectionRoster(secId).map((s, i) => ({
    id: enrollmentId(s.id, secId),
    changes: { rollNo: i + 1 },
  }));
  return patchManyRecords('enrollments', edits, { op: 'renumberRoster', secId });
}

/* ---------- عمليات: بنود ودرجات ---------- */

export function clampScore(value, itemId) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const item = state.items.find((i) => i.id === itemId);
  const max = Number.isFinite(item?.max) ? item.max : Infinity;
  return Math.min(max, Math.max(0, n));
}

export function setScore(studentId, itemId, value) {
  const id = scoreId(studentId, itemId);
  return patch('scores', id, { value: clampScore(value, itemId), deleted: false }, {
    id, studentId, itemId, value: null, deleted: false, updatedAt: now(),
  });
}

export function deleteItem(itemId) {
  return cascadeDelete(
    { items: (i) => i.id === itemId, scores: (s) => s.itemId === itemId },
    { op: 'deleteItem', itemId }
  );
}

export const reorderItems = (pairs) =>
  patchManyRecords('items', pairs.map((p) => ({ id: p.id, changes: { order: p.order } })),
    { op: 'reorderItems' });

/* ---------- عمليات: الحصص والحضور ---------- */

/**
 * يجلب حصة أو ينشئها.
 * إن وافق التاريخ إجازة في التقويم، تُنشأ الحصة بحالة `cancelled_holiday`
 * فلا تُحسب حصة فائتة ولا تولّد غيابًا.
 */
export async function ensureSession(tchId, date, period = 1, extra = {}) {
  const id = sessionId(tchId, date, period);
  const existing = getSession(id);
  if (existing) return existing;

  const day = calendarDayFor(date);
  const holiday = day && !['study', 'exam', 'event'].includes(day.kind);

  // يُطبع وقت الحصة فيها الآن من الملف النشط. تغيير الملف لاحقًا لا يمسّها.
  const profile = activeTimeProfile();
  const t = timeFor(weekday(date), period, profile);
  const slot = live(state.slots).find(
    (s) => s.teachingId === tchId && s.weekday === weekday(date) && s.period === period
  );

  const ses = makeSession({
    teachingId: tchId, date, period,
    slotId: slot?.id ?? null,
    startTime: t?.start ?? '',
    endTime: t?.end ?? '',
    timeProfileId: profile?.id ?? null,
    status: holiday ? 'cancelled_holiday' : 'scheduled',
    reason: holiday ? day.label || 'إجازة رسمية' : '',
    ...extra,
  });
  await save({ sessions: [ses] });
  return ses;
}

export const setSessionStatus = (sesId, status, reason = '') =>
  patch('sessions', sesId, { status, reason });

/** يضبط حضور طالب في حصة. لا يُنشأ حضور إلا لحصة قائمة. */
export async function setAttendance(sesId, studentId, status) {
  const ses = getSession(sesId);
  if (!ses) return null;
  const id = attendanceId(studentId, sesId);
  const rec = await patch('attendance', id, { status, deleted: false }, {
    id, studentId, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
    status, note: '', deleted: false, updatedAt: now(),
  });
  // أول رصد حضور يعني أن الحصة نُفّذت
  if (rec && ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return rec;
}

/** يرصد كل الطلاب غير المرصودين في حصة بحالة واحدة. */
export async function fillAttendance(sesId, status = 'present') {
  const ses = getSession(sesId);
  if (!ses) return 0;
  const roster = students(ses.teachingId);
  const existing = new Set(attendanceIn(sesId).map((a) => a.studentId));
  const stamp = now();

  const recs = roster
    .filter((s) => !existing.has(s.id))
    .map((s) => ({
      id: attendanceId(s.id, sesId), updatedAt: stamp, deleted: false,
      studentId: s.id, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
      status, note: '',
    }));

  if (recs.length) await save({ attendance: recs });
  if (ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return recs.length;
}

/* ---------- عمليات: الجدول والتقويم ---------- */

export async function addSlot(tchId, weekday, period, times = {}) {
  const slot = makeSlot({ teachingId: tchId, weekday, period, ...times });
  if (live(state.slots).some((s) => s.id === slot.id)) return null;
  await save({ slots: [slot] });
  return slot;
}

export const removeSlot = (slotId) => softDelete('slots', slotId);

export async function ensureCalendar(yId = activeYear()?.id, source = 'custom') {
  const existing = calendarsOf(yId).find((c) => c.source === source);
  if (existing) return existing;
  const cal = makeCalendar({ yearId: yId, source });
  await save({ calendars: [cal] });
  return cal;
}

export async function setCalendarDay(calId, date, kind, label = '') {
  const { calendarDayId, makeCalendarDay } = await import('./models.js');
  const id = calendarDayId(calId, date);
  return patch('calendarDays', id, { kind, label, deleted: false },
    makeCalendarDay({ calendarId: calId, date, kind, label }));
}

export const removeCalendarDay = (id) => softDelete('calendarDays', id);

/* ---------- عمليات: الرصد السريع ---------- */

export async function addLog({ teachingId: tchId, studentId, kind, delta, tag = '', note = '', date, sessionId: sesId = null }) {
  const rec = {
    id: uid(), updatedAt: now(), deleted: false,
    teachingId: tchId, studentId, kind, delta, tag, note,
    sessionId: sesId,
    date: date ?? todayISO(),
  };
  await save({ logs: [rec] });
  return rec;
}

export async function undoLastLog(studentId, kind, date = todayISO()) {
  const today = logsOf(studentId)
    .filter((l) => l.date === date && l.kind === kind)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const last = today.at(-1);
  if (!last) return false;
  await patch('logs', last.id, { deleted: true });
  return true;
}
