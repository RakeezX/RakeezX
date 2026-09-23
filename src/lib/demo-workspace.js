import * as db from './db.js';
import {
  makeCalendar, makeEnrollment, makeGroupArrangement, makeItem, makeSection,
  makeSession, makeSlot, makeStudent, makeSubject, makeTeaching, makeTerm,
  makeScoreSubitem, makeScoreSubitemCompletion,
  makeTimeProfile, makeYear, scoreId, attendanceId, DEFAULT_TIME_PROFILES,
  DEFAULT_TIME_PROFILE_IDS, periodTime,
} from '../models.js';
import { projectSubitemScore } from './score-foundation.js';

export const DEMO_ACTIVE_STORAGE_KEY = 'rakeezx-demo-session-v1';
export const LEGACY_DEMO_ACTIVE_STORAGE_KEY = 'rakeezx-demo-active-v1';
export const DEMO_PREPARING = 'preparing';
export const DEMO_ACTIVE = 'active';
export const DEMO_SEED_ID = 'demo:workspace-seed-v3';
const PREVIOUS_DEMO_SEED_ID = 'demo:workspace-seed-v2';
const FIXED_TIME = Date.parse('2026-09-01T06:00:00.000Z');
const CLASS_PLAN = Object.freeze([
  { grade: 4, label: '1', students: 23, slots: [[0, 1], [2, 3]] },
  { grade: 4, label: '2', students: 25, slots: [[0, 2], [3, 4]] },
  { grade: 5, label: '1', students: 21, slots: [[1, 1], [4, 3]] },
  { grade: 5, label: '2', students: 24, slots: [[1, 2], [2, 4]] },
  { grade: 6, label: '1', students: 22, slots: [[3, 1], [4, 2]] },
  { grade: 4, label: '3', students: 23, slots: [[0, 3], [4, 1]] },
  { grade: 5, label: '3', students: 21, slots: [[1, 3], [3, 2]] },
  { grade: 6, label: '2', students: 25, slots: [[2, 1], [4, 4]] },
]);
const CLASS_COLORS = Object.freeze(['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#be123c', '#0891b2', '#4f46e5', '#65a30d']);
const FIRST_NAMES = Object.freeze([
  'أحمد', 'محمد', 'عبدالله', 'سلمان', 'خالد', 'تركي', 'فيصل', 'ناصر', 'سعد', 'عمر', 'زياد', 'مازن',
  'راكان', 'عبدالعزيز', 'يوسف', 'إبراهيم', 'صالح', 'حمد', 'بدر', 'فهد', 'وليد', 'أنس', 'معاذ', 'ياسر',
]);
const FATHER_NAMES = Object.freeze([
  'محمد', 'عبدالله', 'خالد', 'سعد', 'عبدالرحمن', 'إبراهيم', 'صالح', 'ناصر', 'فهد', 'سلمان',
  'أحمد', 'عبدالعزيز', 'حمد', 'فيصل', 'تركي', 'ماجد', 'يوسف', 'علي', 'حسن',
]);
const FAMILY_NAMES = Object.freeze([
  'العتيبي', 'القحطاني', 'الدوسري', 'الشهري', 'الغامدي', 'الحربي', 'الزهراني', 'المطيري', 'العنزي', 'الشمري',
  'المالكي', 'القرني', 'العمري', 'الجهني', 'السبيعي', 'الرويلي', 'التميمي', 'العسيري', 'البلوي', 'الحازمي',
]);
const SESSION_DATE_BY_WEEKDAY = Object.freeze({ 0: '2026-09-06', 1: '2026-09-07', 2: '2026-09-08', 3: '2026-09-09', 4: '2026-09-10' });

const record = (value) => ({ updatedAt: FIXED_TIME, deleted: false, ...value });

export function demoRequestState(storage = globalThis.sessionStorage) {
  try { return storage?.getItem(DEMO_ACTIVE_STORAGE_KEY) ?? null; } catch { return null; }
}

export function isDemoRequested(storage = globalThis.sessionStorage) {
  return [DEMO_PREPARING, DEMO_ACTIVE].includes(demoRequestState(storage));
}

export function isDemoPreparing(storage = globalThis.sessionStorage) {
  return demoRequestState(storage) === DEMO_PREPARING;
}

export function requestDemo(storage = globalThis.sessionStorage) {
  try { storage?.setItem(DEMO_ACTIVE_STORAGE_KEY, DEMO_PREPARING); } catch { /* unavailable storage stays signed out */ }
}

export function markDemoReady(storage = globalThis.sessionStorage) {
  try { storage?.setItem(DEMO_ACTIVE_STORAGE_KEY, DEMO_ACTIVE); } catch { /* unavailable storage stays transient */ }
}

export function clearDemoRequest(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(DEMO_ACTIVE_STORAGE_KEY); } catch { /* storage may be unavailable */ }
}

export function clearLegacyDemoRequest(storage = globalThis.localStorage) {
  try { storage?.removeItem(LEGACY_DEMO_ACTIVE_STORAGE_KEY); } catch { /* storage may be unavailable */ }
}

export function createDemoDataset() {
  const year = makeYear({ id: 'demo:year:1448', hijriStart: 1448, status: 'active', updatedAt: FIXED_TIME });
  const term = makeTerm({ id: 'demo:term:1', yearId: year.id, index: 1, status: 'active', startDate: '2026-08-23', endDate: '2027-01-07', updatedAt: FIXED_TIME });
  const pastTerm = makeTerm({ id: 'demo:term:past', yearId: year.id, index: 2, name: 'فصل تجريبي مكتمل', status: 'closed', startDate: '2026-01-01', endDate: '2026-05-31', updatedAt: FIXED_TIME });
  const subject = makeSubject({ id: 'demo:subject:digital', name: 'المهارات الرقمية', slug: 'demo-digital', updatedAt: FIXED_TIME });
  const timeProfiles = DEFAULT_TIME_PROFILES.map((profile, order) => makeTimeProfile({
    ...structuredClone(profile), order, updatedAt: FIXED_TIME,
  }));
  const timeProfile = timeProfiles.find((profile) => profile.id === DEFAULT_TIME_PROFILE_IDS.summer);
  const calendar = makeCalendar({ id: 'demo:calendar', yearId: year.id, label: 'التقويم التجريبي', updatedAt: FIXED_TIME });
  const sections = CLASS_PLAN.map((plan, index) => makeSection({
    id: `demo:section:${index + 1}`, yearId: year.id, grade: plan.grade,
    label: plan.label, name: `${plan.grade}/${plan.label}`,
    order: index, color: CLASS_COLORS[index], updatedAt: FIXED_TIME,
  }));
  const teachings = sections.map((section, index) => makeTeaching({
    id: `demo:teaching:${index + 1}`, sectionId: section.id, subjectId: subject.id, termId: term.id,
    order: index, updatedAt: FIXED_TIME,
  }));
  const students = [];
  const enrollments = [];
  const items = [];
  const scoreSubitems = [];
  const scoreSubitemCompletions = [];
  const scores = [];
  const slots = [];
  const sessions = [];
  const sessionRosterSnapshots = [];
  const attendance = [];
  const logs = [];
  const notes = [];
  const classRules = [];
  const classGoals = [];
  const classCharterSelections = [];
  const groupArrangements = [];
  let studentNumber = 0;

  teachings.forEach((teaching, classIndex) => {
    const members = [];
    const plan = CLASS_PLAN[classIndex];
    for (let studentIndex = 0; studentIndex < plan.students; studentIndex += 1) {
      studentNumber += 1;
      const n = studentNumber;
      const zeroBased = n - 1;
      const firstIndex = (zeroBased * 5 + 7) % FIRST_NAMES.length;
      const nameBlock = Math.floor(zeroBased / FIRST_NAMES.length);
      const first = FIRST_NAMES[firstIndex];
      const father = FATHER_NAMES[(nameBlock * 7 + firstIndex * 3) % FATHER_NAMES.length];
      const family = FAMILY_NAMES[(zeroBased * 11 + classIndex * 7) % FAMILY_NAMES.length];
      const student = makeStudent({ id: `demo:student:${n}`, name: `${first} ${father} ${family}`, updatedAt: FIXED_TIME });
      students.push(student);
      enrollments.push(makeEnrollment({ id: `demo:enrollment:${n}`, studentId: student.id, sectionId: teaching.sectionId, rollNo: studentIndex + 1, startDate: '2026-08-23', updatedAt: FIXED_TIME }));
      members.push({ studentId: student.id, enrollmentId: `demo:enrollment:${n}`, rollNo: studentIndex + 1 });
      notes.push(record({ id: `demo:note:${n}`, studentId: student.id, teachingId: teaching.id, date: '2026-09-01', kind: 'general', text: studentIndex % 4 === 0 ? 'متابعة إيجابية في نشاط الصف.' : 'ملاحظة تجريبية للعرض.', createdAt: FIXED_TIME }));
    }
    const teachingItems = [
      ['واجب', 10, null], ['مشروع', 20, null], ['اختبار قصير', 20, null], ['مشاركة', 10, 'participation'],
    ].map(([name, max, auto], itemIndex) => makeItem({ id: `demo:item:${classIndex + 1}:${itemIndex + 1}`, teachingId: teaching.id,
      name: classIndex === 1 && itemIndex === 0 ? 'مهام' : name,
      max, auto, order: itemIndex, updatedAt: FIXED_TIME,
      ...(classIndex === 1 && itemIndex === 2 ? { distributionOriginId: 'demo:item:1:3' } : {}),
      ...(classIndex === 0 && itemIndex < 2 ? { scoreMode: 'subitems', distributionMode: itemIndex === 0 ? 'auto' : 'manual' } : {}) }));
    items.push(...teachingItems);
    if (classIndex === 0) {
      for (const [itemIndex, names, values] of [
        [0, ['واجب 1', 'واجب 2', 'واجب 3'], [3.33, 3.33, 3.34]],
        [1, ['مشروع 1', 'مشروع 2', 'مشروع 3'], [5, 5, 10]],
      ]) {
        const item = teachingItems[itemIndex];
        const definitions = names.map((name, index) => makeScoreSubitem({
          id: `demo:subitem:${itemIndex + 1}:${index + 1}`, itemId: item.id,
          name, value: values[index], order: index, updatedAt: FIXED_TIME,
        }));
        scoreSubitems.push(...definitions);
        members.slice(0, 6).forEach((member, index) => {
          const selected = index === 0 ? definitions.slice(0, 2) : index === 1 ? definitions : index === 2 ? [] : definitions.slice(0, 1);
          const completions = selected.map((definition) => makeScoreSubitemCompletion({
            id: `demo:completion:${member.studentId}:${definition.id}`, studentId: member.studentId,
            subitemId: definition.id, checked: true, updatedAt: FIXED_TIME,
          }));
          scoreSubitemCompletions.push(...completions);
          const manual = index === 0 ? 2 : index === 2 ? 0 : null;
          const projection = projectSubitemScore(item, definitions, completions, manual,
            { studentId: member.studentId });
          if (projection.value !== null) scores.push(record({
            id: scoreId(member.studentId, item.id), studentId: member.studentId, itemId: item.id,
            derivedValue: projection.derivedValue, manualValue: projection.manualValue, value: projection.value,
          }));
        });
      }
    }
    for (const member of members) {
      teachingItems.forEach((item, itemIndex) => { if (item.scoreMode === 'subitems') return; scores.push(record({
        id: scoreId(member.studentId, item.id), studentId: member.studentId, itemId: item.id,
        value: item.auto === 'participation' ? (member.rollNo % 6) : Math.min(item.max, 5 + ((member.rollNo + itemIndex * 3) % item.max)),
      })); });
    }
    const teachingSlots = plan.slots.map(([weekday, period], slotIndex) => makeSlot({
      id: `demo:slot:${classIndex + 1}:${slotIndex + 1}`, teachingId: teaching.id, weekday, period, updatedAt: FIXED_TIME,
    }));
    slots.push(...teachingSlots);
    teachingSlots.forEach((slot, sessionIndex) => {
      const date = SESSION_DATE_BY_WEEKDAY[slot.weekday];
      const timing = periodTime(timeProfile, slot.weekday, slot.period, plan.grade);
      const session = makeSession({ id: `demo:session:${classIndex + 1}:${sessionIndex + 1}`, teachingId: teaching.id, date, period: slot.period, slotId: slot.id, status: 'held', startTime: timing.start, endTime: timing.end, timeProfileId: timeProfile.id, covered: 'نشاط تعليمي تجريبي', updatedAt: FIXED_TIME });
      sessions.push(session);
      sessionRosterSnapshots.push(record({ id: `demo:roster:${session.id}`, sessionId: session.id, teachingId: teaching.id, sectionId: teaching.sectionId, capturedAt: FIXED_TIME, members, state: 'complete' }));
      members.forEach((member) => attendance.push(record({
        id: attendanceId(member.studentId, session.id), studentId: member.studentId, sessionId: session.id,
        teachingId: teaching.id, date, status: member.rollNo % 11 === 0 ? 'absent' : member.rollNo % 7 === 0 ? 'late' : 'present', note: '',
      })));
    });
    members.slice(0, 6).forEach((member, index) => logs.push(record({
      id: `demo:log:${classIndex + 1}:${index + 1}`, teachingId: teaching.id, studentId: member.studentId,
      kind: 'participation', delta: 1, tag: 'مشاركة فعّالة', note: '', date: '2026-09-08', sessionId: `demo:session:${classIndex + 1}:2`,
    })));
    const rules = ['الاستعداد قبل بدء الحصة', 'احترام وقت الآخرين', 'المشاركة بإيجابية'].map((text, index) => record({ id: `demo:rule:${classIndex + 1}:${index + 1}`, teachingId: teaching.id, iconKey: 'check', text, createdAt: FIXED_TIME + index }));
    classRules.push(...rules);
    classGoals.push(record({ id: `class-goal:${teaching.id}`, teachingId: teaching.id, runId: `demo:goal-run:${classIndex + 1}`, date: '2026-09-21', sessionId: null, text: 'إنجاز النشاط بدقة وتعاون', presetKey: null, durationMinutes: 20, rewardPoints: 2, state: 'active', startedAt: FIXED_TIME, completedAt: null, rewardOperationId: null }));
    classCharterSelections.push(record({ id: `class-charter-selection:${teaching.id}`, teachingId: teaching.id, selectedRuleIds: rules.map((rule) => rule.id) }));
    const groups = [];
    for (let offset = 0; offset < members.length; offset += 5) {
      groups.push(members.slice(offset, offset + 5).map((member) => member.studentId));
    }
    groupArrangements.push(makeGroupArrangement({ id: `demo:groups:${classIndex + 1}`, teachingId: teaching.id, groups, updatedAt: FIXED_TIME }));
  });

  return {
    profile: [record({ id: 'profile', teacherName: 'معلم ركيز', schoolName: 'مدرسة ركيز التجريبية', phone: '', teacherForm: 'masculine', reportPrincipalName: 'مدير المدرسة', principalName: 'مدير المدرسة', activeTimeProfileId: timeProfile.id })],
    device: [record({ id: 'device', deviceId: 'demo-device', theme: 'light', activeYearId: year.id, activeTermId: term.id, activeTimeProfileId: timeProfile.id, reportPrincipalName: 'مدير المدرسة', lastSyncAt: null, schemaVersion: 7 })],
    meta: [record({ id: DEMO_SEED_ID, version: 3, seededAt: FIXED_TIME })],
    years: [year], terms: [term, pastTerm], subjects: [subject], sections, teachings, students, enrollments,
    items, scoreSubitems, scoreSubitemCompletions, scores, slots, sessions, sessionRosterSnapshots, attendance, logs, calendars: [calendar], calendarDays: [],
    units: [], lessons: [], timeProfiles, notes, classRules, classGoals, classCharterSelections,
    groupArrangements, closedTermReports: [], assignments: [], submissions: [], outbox: [],
  };
}

export async function seedDemoWorkspace({ force = false } = {}) {
  if (db.getActiveDatabaseName() !== 'rakeezx-demo') throw new Error('Demo seed requires the isolated demo database');
  if (!force && await db.get('meta', DEMO_SEED_ID)) return { seeded: false };
  const snapshot = createDemoDataset();
  if (!force && await db.get('meta', PREVIOUS_DEMO_SEED_ID)) {
    const additions = {};
    for (const [storeName, rows] of Object.entries(snapshot)) {
      if (!rows.length) continue;
      const existingIds = new Set((await db.getAll(storeName)).map((row) => row.id));
      const missing = rows.filter((row) => !existingIds.has(row.id));
      if (missing.length) additions[storeName] = missing;
    }
    if (Object.keys(additions).length) await db.putAcross(additions);
    return { seeded: false, upgraded: true, students: snapshot.students.length, sections: snapshot.sections.length };
  }
  await db.writeAll(snapshot, 'replace');
  return { seeded: true, students: snapshot.students.length, sections: snapshot.sections.length };
}
