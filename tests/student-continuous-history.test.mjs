import 'fake-indexeddb/auto';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import {
  attendanceId, itemScore, makeEnrollment, makeItem, makeNote, makeSection, makeSession,
  makeStudent, makeSubject, makeTeaching, makeTerm, makeYear, scoreId, studentTotal,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

before(async () => {
  cloud.setMockBackend({ getScoreFoundationCapability: () => ({ scoreDomainVersion: 1,
    restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }) });
  await activateSyntheticAccountWorkspace();
});

async function fixture() {
  await db.clearAll();
  await store.init();

  const year = makeYear({ id: 'history:year', hijriStart: 1450, label: '1450–1451 هـ' });
  const term = makeTerm({ id: 'history:term', yearId: year.id, index: 1, name: 'الفصل الأول' });
  const oldTerm = makeTerm({ id: 'history:term:old', yearId: year.id, index: 0, name: 'فصل سابق' });
  const subject = makeSubject({ id: 'history:subject', name: 'المهارات الرقمية' });
  const x = makeSection({ id: 'history:X', yearId: year.id, grade: 4, label: 'أ' });
  const y = makeSection({ id: 'history:Y', yearId: year.id, grade: 4, label: 'ب' });
  const teachingX = makeTeaching({ id: 'history:teaching:X', sectionId: x.id, subjectId: subject.id, termId: term.id });
  const teachingY = makeTeaching({ id: 'history:teaching:Y', sectionId: y.id, subjectId: subject.id, termId: term.id });
  const oldTeachingX = makeTeaching({ id: 'history:teaching:X:old', sectionId: x.id, subjectId: subject.id, termId: oldTerm.id });
  const student = makeStudent({ id: 'history:student:A', name: 'طالب السجل المستمر' });
  const itemX = makeItem({ id: 'history:item:X', teachingId: teachingX.id, name: 'اختبار قصير', max: 10 });
  const itemY = makeItem({ id: 'history:item:Y', teachingId: teachingY.id, name: 'اختبار قصير', max: 10 });
  const oldItemX = makeItem({ id: 'history:item:X:old', teachingId: oldTeachingX.id, name: 'اختبار قصير', max: 10 });
  const scoreX = { id: scoreId(student.id, itemX.id), studentId: student.id, itemId: itemX.id, value: 6, updatedAt: 100, deleted: false };
  const oldScoreX = { id: scoreId(student.id, oldItemX.id), studentId: student.id, itemId: oldItemX.id, value: 9, updatedAt: 50, deleted: false };
  const enrollmentX = makeEnrollment({ studentId: student.id, sectionId: x.id, rollNo: 1, startDate: '2026-08-01' });
  const sessionX = makeSession({ id: 'history:session:X', teachingId: teachingX.id, date: '2026-08-20', period: 2, status: 'held' });
  const attendanceX = {
    id: attendanceId(student.id, sessionX.id), studentId: student.id, sessionId: sessionX.id,
    teachingId: teachingX.id, date: sessionX.date, status: 'absent', updatedAt: 100, deleted: false,
  };
  const logX = {
    id: 'history:log:X', studentId: student.id, teachingId: teachingX.id, sessionId: sessionX.id,
    date: sessionX.date, kind: 'participation', delta: 1, tag: 'مشاركة X', updatedAt: 100, deleted: false,
  };
  const noteX = makeNote({
    id: 'history:note:X', studentId: student.id, teachingId: teachingX.id,
    sessionId: sessionX.id, date: sessionX.date, text: 'ملاحظة X', createdAt: 100, updatedAt: 100,
  });

  await store.save({
    years: [year], terms: [term, oldTerm], subjects: [subject], sections: [x, y],
    teachings: [teachingX, teachingY, oldTeachingX], students: [student], enrollments: [enrollmentX],
    items: [itemX, itemY, oldItemX], scores: [scoreX, oldScoreX],
    sessions: [sessionX], attendance: [attendanceX], logs: [logX], notes: [noteX],
  });
  return {
    x, y, teachingX, teachingY, oldTeachingX, student, itemX, itemY, oldItemX,
    scoreX, oldScoreX, sessionX, attendanceX, logX, noteX,
  };
}

function identitySnapshot(studentId) {
  const history = store.studentHistory(studentId);
  return {
    attendance: history.attendance.map((event) => [event.record.id, event.session?.id, event.teaching?.id, event.section?.id]),
    logs: history.logs.map((event) => [event.record.id, event.session?.id, event.teaching?.id, event.section?.id]),
    notes: history.notes.map((event) => [event.record.id, event.session?.id, event.teaching?.id, event.section?.id]),
    scores: history.scores.map((event) => [event.record.id, event.item.id, event.teaching?.id, event.section?.id]),
  };
}

test('student history remains continuous and context-true across X → Y → X', async () => {
  const f = await fixture();

  let history = store.studentHistory(f.student.id);
  assert.deepEqual(history.attendance.map((event) => event.record.id), [f.attendanceX.id]);
  assert.equal(history.attendance[0].section.id, f.x.id);
  assert.equal(history.attendance[0].session.id, f.sessionX.id);
  assert.deepEqual(new Set(history.scores.map((event) => event.record.id)), new Set([f.scoreX.id, f.oldScoreX.id]));
  assert.equal(history.scores.find((event) => event.record.id === f.scoreX.id).teaching.id, f.teachingX.id);

  await store.transferStudent(f.student.id, f.y.id, { date: '2026-08-25' });
  await store.linkPortableScoreItems(f.itemX.id, f.itemY.id, { confirmed: true });
  history = store.studentHistory(f.student.id);
  assert.deepEqual(
    store.studentContext(f.student.id, f.teachingY.id).attendance,
    [],
    'Y has no current-class attendance immediately after transfer'
  );
  assert.deepEqual(history.attendance.map((event) => event.record.id), [f.attendanceX.id]);
  assert.equal(history.attendance[0].section.id, f.x.id, 'X attendance keeps its original section after transfer');
  assert.equal(history.logs[0].section.id, f.x.id, 'X quick log remains visible after transfer');
  assert.equal(history.notes[0].section.id, f.x.id, 'X note remains visible after transfer');
  assert.equal(history.contexts.find((context) => context.teaching.id === f.teachingX.id).scores[0].record.id, f.scoreX.id);
  assert.equal(itemScore(f.itemY, store.studentContext(f.student.id, f.teachingY.id)), 6, 'same-term portable score remains current in Y');
  assert.deepEqual(studentTotal([f.itemY], store.studentContext(f.student.id, f.teachingY.id)), {
    earned: 6, outOfGraded: 10, outOfAll: 10, missing: 0, pct: 60, pctOfAll: 60,
  });
  assert.notEqual(
    store.studentContext(f.student.id, f.teachingY.id).scoresByItem[f.itemY.id]?.id,
    f.oldScoreX.id,
    'a same-looking score from another term never leaks into current scoring',
  );

  const sessionY = makeSession({ id: 'history:session:Y', teachingId: f.teachingY.id, date: '2026-08-28', period: 4, status: 'held' });
  const attendanceY = {
    id: attendanceId(f.student.id, sessionY.id), studentId: f.student.id, sessionId: sessionY.id,
    teachingId: f.teachingY.id, date: sessionY.date, status: 'present', updatedAt: 200, deleted: false,
  };
  const logY = {
    id: 'history:log:Y', studentId: f.student.id, teachingId: f.teachingY.id, sessionId: sessionY.id,
    date: sessionY.date, kind: 'behavior', delta: -1, tag: 'سلوك Y', updatedAt: 200, deleted: false,
  };
  const noteY = makeNote({
    id: 'history:note:Y', studentId: f.student.id, teachingId: f.teachingY.id,
    sessionId: sessionY.id, date: sessionY.date, text: 'ملاحظة Y', createdAt: 200, updatedAt: 200,
  });
  await store.save({ sessions: [sessionY], attendance: [attendanceY], logs: [logY], notes: [noteY] });

  history = store.studentHistory(f.student.id);
  assert.deepEqual(history.attendance.map((event) => event.record.id), [attendanceY.id, f.attendanceX.id]);
  assert.deepEqual(history.attendance.map((event) => event.section.id), [f.y.id, f.x.id]);
  assert.deepEqual(history.attendance.map((event) => event.session.id), [sessionY.id, f.sessionX.id]);
  assert.deepEqual(history.logs.map((event) => event.section.id), [f.y.id, f.x.id]);
  assert.deepEqual(history.notes.map((event) => event.section.id), [f.y.id, f.x.id]);

  assert.deepEqual(store.studentContext(f.student.id, f.teachingX.id).attendance.map((record) => record.id), [f.attendanceX.id]);
  assert.deepEqual(store.studentContext(f.student.id, f.teachingY.id).attendance.map((record) => record.id), [attendanceY.id]);
  assert.deepEqual(store.attendanceIn(f.sessionX.id).map((record) => record.id), [f.attendanceX.id], 'class attendance read remains unchanged');

  const beforeReturn = identitySnapshot(f.student.id);
  await store.transferStudent(f.student.id, f.x.id, { date: '2026-09-01' });
  assert.deepEqual(identitySnapshot(f.student.id), beforeReturn, 'return transfer does not copy or duplicate history');

  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.deepEqual(identitySnapshot(f.student.id), beforeReturn, 'reload preserves the same continuous projection');

  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-02' });
  await store.archiveSection(f.x.id, '2026-09-03');
  history = store.studentHistory(f.student.id);
  assert.equal(history.contexts.find((context) => context.teaching.id === f.teachingX.id).section.status, 'archived');
  assert.equal(
    history.notes.find((event) => event.record.id === f.noteX.id).record.text,
    'ملاحظة X',
    'archived history remains readable',
  );
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
  cloud.setMockBackend(null);
});
