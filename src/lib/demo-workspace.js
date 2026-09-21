import * as db from './db.js';
import {
  makeCalendar, makeEnrollment, makeGroupArrangement, makeItem, makeSection,
  makeSession, makeSlot, makeStudent, makeSubject, makeTeaching, makeTerm,
  makeTimeProfile, makeYear, scoreId, attendanceId,
} from '../models.js';

export const DEMO_ACTIVE_STORAGE_KEY = 'rakeezx-demo-active-v1';
export const DEMO_SEED_ID = 'demo:workspace-seed-v1';
const FIXED_TIME = Date.parse('2026-09-01T06:00:00.000Z');

const record = (value) => ({ updatedAt: FIXED_TIME, deleted: false, ...value });

export function isDemoRequested(storage = globalThis.localStorage) {
  try { return storage?.getItem(DEMO_ACTIVE_STORAGE_KEY) === '1'; } catch { return false; }
}

export function requestDemo(storage = globalThis.localStorage) {
  storage?.setItem(DEMO_ACTIVE_STORAGE_KEY, '1');
}

export function clearDemoRequest(storage = globalThis.localStorage) {
  storage?.removeItem(DEMO_ACTIVE_STORAGE_KEY);
}

export function createDemoDataset() {
  const year = makeYear({ id: 'demo:year:1448', hijriStart: 1448, status: 'active', updatedAt: FIXED_TIME });
  const term = makeTerm({ id: 'demo:term:1', yearId: year.id, index: 1, status: 'active', startDate: '2026-08-23', endDate: '2027-01-07', updatedAt: FIXED_TIME });
  const pastTerm = makeTerm({ id: 'demo:term:past', yearId: year.id, index: 2, name: 'فصل تجريبي مكتمل', status: 'closed', startDate: '2026-01-01', endDate: '2026-05-31', updatedAt: FIXED_TIME });
  const subject = makeSubject({ id: 'demo:subject:digital', name: 'المهارات الرقمية', slug: 'demo-digital', updatedAt: FIXED_TIME });
  const timeProfile = makeTimeProfile({ id: 'demo:time-profile', name: 'التوقيت التجريبي', order: 0, updatedAt: FIXED_TIME });
  const calendar = makeCalendar({ id: 'demo:calendar', yearId: year.id, label: 'التقويم التجريبي', updatedAt: FIXED_TIME });
  const sections = Array.from({ length: 5 }, (_, index) => makeSection({
    id: `demo:section:${index + 1}`, yearId: year.id, grade: 4 + (index % 3),
    label: String.fromCharCode(0x0623 + index), name: `${4 + (index % 3)}/${String.fromCharCode(0x0623 + index)}`,
    order: index, color: ['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#be123c'][index], updatedAt: FIXED_TIME,
  }));
  const teachings = sections.map((section, index) => makeTeaching({
    id: `demo:teaching:${index + 1}`, sectionId: section.id, subjectId: subject.id, termId: term.id,
    order: index, updatedAt: FIXED_TIME,
  }));
  const names = ['أحمد','محمد','عبدالله','سلمان','خالد','تركي','فيصل','ناصر','سعد','عمر','زياد','مازن'];
  const students = [];
  const enrollments = [];
  const items = [];
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

  teachings.forEach((teaching, classIndex) => {
    const members = [];
    for (let studentIndex = 0; studentIndex < 12; studentIndex += 1) {
      const n = classIndex * 12 + studentIndex + 1;
      const student = makeStudent({ id: `demo:student:${n}`, name: `${names[studentIndex]} ${['العتيبي','القحطاني','الدوسري','الشهري','الغامدي'][classIndex]}`, updatedAt: FIXED_TIME });
      students.push(student);
      enrollments.push(makeEnrollment({ id: `demo:enrollment:${n}`, studentId: student.id, sectionId: teaching.sectionId, rollNo: studentIndex + 1, startDate: '2026-08-23', updatedAt: FIXED_TIME }));
      members.push({ studentId: student.id, enrollmentId: `demo:enrollment:${n}`, rollNo: studentIndex + 1 });
      notes.push(record({ id: `demo:note:${n}`, studentId: student.id, teachingId: teaching.id, date: '2026-09-01', kind: 'general', text: studentIndex % 4 === 0 ? 'متابعة إيجابية في نشاط الصف.' : 'ملاحظة تجريبية للعرض.', createdAt: FIXED_TIME }));
    }
    const teachingItems = [
      ['واجب', 10, null], ['مشروع', 20, null], ['اختبار قصير', 20, null], ['مشاركة', 10, 'participation'],
    ].map(([name, max, auto], itemIndex) => makeItem({ id: `demo:item:${classIndex + 1}:${itemIndex + 1}`, teachingId: teaching.id, name, max, auto, order: itemIndex, updatedAt: FIXED_TIME }));
    items.push(...teachingItems);
    for (const member of members) {
      teachingItems.forEach((item, itemIndex) => scores.push(record({
        id: scoreId(member.studentId, item.id), studentId: member.studentId, itemId: item.id,
        value: item.auto === 'participation' ? (member.rollNo % 6) : Math.min(item.max, 5 + ((member.rollNo + itemIndex * 3) % item.max)),
      })));
    }
    const slot = makeSlot({ id: `demo:slot:${classIndex + 1}`, teachingId: teaching.id, weekday: classIndex % 5, period: (classIndex % 4) + 1, updatedAt: FIXED_TIME });
    slots.push(slot);
    ['2026-09-01', '2026-09-08'].forEach((date, sessionIndex) => {
      const session = makeSession({ id: `demo:session:${classIndex + 1}:${sessionIndex + 1}`, teachingId: teaching.id, date, period: slot.period, slotId: slot.id, status: 'held', startTime: '07:00', endTime: '07:45', timeProfileId: timeProfile.id, covered: 'نشاط تعليمي تجريبي', updatedAt: FIXED_TIME });
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
    groupArrangements.push(makeGroupArrangement({ id: `demo:groups:${classIndex + 1}`, teachingId: teaching.id, groups: [
      members.slice(0, 6).map((m) => m.studentId),
      members.slice(6).map((m) => m.studentId),
    ], updatedAt: FIXED_TIME }));
  });

  return {
    profile: [record({ id: 'profile', teacherName: 'معلم ركيز', schoolName: 'مدرسة ركيز التجريبية', phone: '', teacherForm: 'masculine', reportPrincipalName: 'مدير المدرسة', principalName: 'مدير المدرسة', activeTimeProfileId: timeProfile.id })],
    device: [record({ id: 'device', deviceId: 'demo-device', theme: 'light', activeYearId: year.id, activeTermId: term.id, activeTimeProfileId: timeProfile.id, reportPrincipalName: 'مدير المدرسة', lastSyncAt: null, schemaVersion: 7 })],
    meta: [record({ id: DEMO_SEED_ID, version: 1, seededAt: FIXED_TIME })],
    years: [year], terms: [term, pastTerm], subjects: [subject], sections, teachings, students, enrollments,
    items, scores, slots, sessions, sessionRosterSnapshots, attendance, logs, calendars: [calendar], calendarDays: [],
    units: [], lessons: [], timeProfiles: [timeProfile], notes, classRules, classGoals, classCharterSelections,
    groupArrangements, closedTermReports: [], assignments: [], submissions: [], outbox: [],
  };
}

export async function seedDemoWorkspace({ force = false } = {}) {
  if (db.getActiveDatabaseName() !== 'rakeezx-demo') throw new Error('Demo seed requires the isolated demo database');
  if (!force && await db.get('meta', DEMO_SEED_ID)) return { seeded: false };
  const snapshot = createDemoDataset();
  await db.writeAll(snapshot, 'replace');
  return { seeded: true, students: snapshot.students.length, sections: snapshot.sections.length };
}
