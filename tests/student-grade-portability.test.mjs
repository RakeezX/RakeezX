import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {
  makeEnrollment, makeItem, makeSection, makeStudent, makeSubject,
  makeTeaching, makeTerm, makeYear, scoreId, itemScore, studentTotal,
} from '../src/models.js';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });

async function fresh() {
  await db.clearAll();
  await store.init();
}

async function fixture() {
  await fresh();
  const year = makeYear({ id: 'grade-portability:year', hijriStart: 1450 });
  const term = makeTerm({ id: 'grade-portability:term', yearId: year.id, index: 1 });
  const subject = makeSubject({ id: 'grade-portability:subject', name: 'الرياضيات' });
  const x = makeSection({ id: 'grade-portability:X', yearId: year.id, grade: 4, label: 'أ' });
  const y = makeSection({ id: 'grade-portability:Y', yearId: year.id, grade: 4, label: 'ب' });
  const teachingX = makeTeaching({ id: 'grade-portability:teaching:X', sectionId: x.id, subjectId: subject.id, termId: term.id });
  const teachingY = makeTeaching({ id: 'grade-portability:teaching:Y', sectionId: y.id, subjectId: subject.id, termId: term.id });
  const student = makeStudent({ id: 'grade-portability:student', name: 'طالب النقل' });
  const examX = makeItem({ id: 'grade-portability:item:exam:X', teachingId: teachingX.id, name: 'اختبار قصير', max: 10 });
  const examY = makeItem({ id: 'grade-portability:item:exam:Y', teachingId: teachingY.id, name: ' اختبار قصير ', max: 10 });
  const projectX = makeItem({ id: 'grade-portability:item:project:X', teachingId: teachingX.id, name: 'مشروع', max: 20 });
  const projectY = makeItem({ id: 'grade-portability:item:project:Y', teachingId: teachingY.id, name: 'مشروع', max: 10 });
  const examScore = { id: scoreId(student.id, examX.id), studentId: student.id, itemId: examX.id, value: 0, deleted: false, updatedAt: 1 };
  const projectScore = { id: scoreId(student.id, projectX.id), studentId: student.id, itemId: projectX.id, value: 18, deleted: false, updatedAt: 1 };
  await store.save({
    years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teachingX, teachingY],
    students: [student], enrollments: [makeEnrollment({ studentId: student.id, sectionId: x.id, rollNo: 1 })],
    items: [examX, examY, projectX, projectY], scores: [examScore, projectScore],
  });
  return { x, y, teachingX, teachingY, student, examX, examY, projectX, projectY, examScore, projectScore };
}

test('manual grades follow a student across same-subject, same-term transfer without copying score records', async () => {
  const f = await fixture();
  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });

  let yContext = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(yContext.scoresByItem[f.examY.id]?.id, f.examScore.id, 'compatible Y item projects the existing X score');
  assert.equal(itemScore(f.examY, yContext), 0, 'a recorded zero remains a real grade');
  assert.equal(itemScore(f.projectY, yContext), null, 'same-name item with a different maximum remains unrecorded');
  assert.deepEqual(studentTotal(store.items(f.teachingY.id), yContext), {
    earned: 0, outOfGraded: 10, outOfAll: 20, missing: 1, pct: 0, pctOfAll: 0,
  });

  await store.setScore(f.student.id, f.examY.id, 7);
  assert.equal(store.scoresOf(f.student.id).filter((score) => !score.deleted).length, 2, 'editing in Y updates the existing score instead of copying it');
  assert.equal(store.scoresOf(f.student.id).find((score) => score.id === f.examScore.id)?.value, 7);
  yContext = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(itemScore(f.examY, yContext), 7);

  await store.transferStudent(f.student.id, f.x.id, { date: '2026-09-08' });
  const xContext = store.studentContext(f.student.id, f.teachingX.id);
  assert.equal(itemScore(f.examX, xContext), 7, 'returning to X keeps the updated shared score');
  assert.equal(store.scoresOf(f.student.id).filter((score) => !score.deleted).length, 2, 'return transfer creates no duplicate scores');

  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-15' });
  await store.setScore(f.student.id, f.projectY.id, 0);
  assert.equal(itemScore(f.projectY, store.studentContext(f.student.id, f.teachingY.id)), 0, 'a new zero on an unmatched item is recorded, not treated as missing');
  assert.equal(store.scoresOf(f.student.id).filter((score) => !score.deleted).length, 3, 'only the genuinely new unmatched Y item creates a score');

  await db.closeDB();
  store.state.ready = false;
  await store.init();
  const afterReload = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(itemScore(f.examY, afterReload), 7, 'portable projection is stable after reload');
  assert.equal(itemScore(f.projectY, afterReload), 0, 'recorded zero remains stable after reload');
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
});
