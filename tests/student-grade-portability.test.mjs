import 'fake-indexeddb/auto';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import {
  makeEnrollment, makeItem, makeSection, makeStudent, makeSubject,
  makeTeaching, makeTerm, makeYear, scoreId, itemScore, studentTotal,
} from '../src/models.js';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });

before(async () => {
  cloud.setMockBackend({ getScoreFoundationCapability: () => ({ scoreDomainVersion: 1,
    restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }) });
  await activateSyntheticAccountWorkspace();
});

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

test('historical name/max match fails closed; reviewed mapping restores intended transfer portability', async () => {
  const f = await fixture();
  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });

  let yContext = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(yContext.scoresByItem[f.examY.id], undefined, 'name/max alone cannot bind historical scores');
  assert.equal(store.scoresOf(f.student.id).find((score) => score.id === f.examScore.id)?.value, 0);
  await store.linkPortableScoreItems(f.examX.id, f.examY.id, { confirmed: true });
  yContext = store.studentContext(f.student.id, f.teachingY.id);
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

test('independent copied item does not project or mutate a prior class score', async () => {
  const f = await fixture();
  const independent = makeItem({
    id: 'grade-portability:item:independent:Y', teachingId: f.teachingY.id,
    name: f.examX.name, max: f.examX.max,
  });
  await store.save({ items: [independent] });
  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });

  assert.equal(itemScore(independent, store.studentContext(f.student.id, f.teachingY.id)), null);
  await store.setScore(f.student.id, independent.id, 8);
  assert.equal(store.scoresOf(f.student.id).find((score) => score.itemId === f.examX.id)?.value, 0);
  assert.equal(store.scoresOf(f.student.id).find((score) => score.itemId === independent.id)?.value, 8);
  assert.equal(itemScore(independent, store.studentContext(f.student.id, f.teachingY.id)), 8);
});

test('ambiguous historical name/max edits remain local to the destination item', async () => {
  const f = await fixture();
  const second = makeItem({
    id: 'grade-portability:item:second:Y', teachingId: f.teachingY.id,
    name: f.examX.name, max: f.examX.max,
  });
  await store.save({ items: [second] });
  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });
  assert.equal(store.studentContext(f.student.id, f.teachingY.id).scoresByItem[f.examY.id], undefined);
  await store.setScore(f.student.id, f.examY.id, 9);
  assert.equal(store.scoresOf(f.student.id).find((score) => score.id === f.examScore.id)?.value, 0);
  assert.equal(store.scoresOf(f.student.id).find((score) => score.itemId === f.examY.id)?.value, 9);
  assert.equal(store.studentContext(f.student.id, f.teachingY.id).scoresByItem[second.id], undefined);
});

test('one-time distribution copy creates an independent item and no portable mapping', async () => {
  const f = await fixture();
  const preview = store.previewScoreDistributionCopy(f.teachingX.id);
  assert.equal(preview.length, 1);
  const result = await store.applyScoreDistributionCopy(f.teachingX.id, [f.teachingY.id], {
    [`${f.teachingY.id}:${f.examX.id}`]: 'add',
    [`${f.teachingY.id}:${f.projectX.id}`]: 'add',
  });
  const copied = store.items(f.teachingY.id).find((item) => item.distributionOriginId === f.examX.id);
  assert.ok(copied);
  assert.notEqual(copied.id, f.examX.id);
  assert.equal(copied.portabilityGroupId, null);
  assert.ok(result.itemIds.includes(copied.id));
  const queued = await db.getAll('outbox');
  const copiedMutations = queued.filter((row) => result.itemIds.includes(row.recordId));
  assert.equal(copiedMutations.length, result.itemIds.length);
  assert.ok(copiedMutations.every((row) => row.command === 'score:copy_definition'));
  assert.equal(queued.some((row) => result.subitemIds.includes(row.recordId)), false,
    'copied definitions do not use forbidden generic subitem mutations');
  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });
  assert.equal(store.studentContext(f.student.id, f.teachingY.id).scoresByItem[copied.id], undefined);
  assert.equal(store.scoresOf(f.student.id).find((score) => score.id === f.examScore.id)?.value, 0);
});

test('compatible automatic items aggregate X and Y records while incompatible settings stay unrecorded', async () => {
  const f = await fixture();
  const participationX = makeItem({ id: 'grade-portability:item:participation:X', teachingId: f.teachingX.id, name: 'مشاركة', max: 10, auto: 'participation', perPoint: 1 });
  const participationY = makeItem({ id: 'grade-portability:item:participation:Y', teachingId: f.teachingY.id, name: 'مشاركة', max: 10, auto: 'participation', perPoint: 1 });
  const attendanceX = makeItem({ id: 'grade-portability:item:attendance:X', teachingId: f.teachingX.id, name: 'الحضور', max: 10, auto: 'attendance', penalty: 2 });
  const attendanceY = makeItem({ id: 'grade-portability:item:attendance:Y', teachingId: f.teachingY.id, name: 'الحضور', max: 10, auto: 'attendance', penalty: 2 });
  const incompatibleX = makeItem({ id: 'grade-portability:item:incompatible:X', teachingId: f.teachingX.id, name: 'مشاركة إضافية', max: 10, auto: 'participation', perPoint: 1 });
  const incompatibleY = makeItem({ id: 'grade-portability:item:incompatible:Y', teachingId: f.teachingY.id, name: 'مشاركة إضافية', max: 10, auto: 'participation', perPoint: 2 });
  await store.save({
    items: [participationX, participationY, attendanceX, attendanceY, incompatibleX, incompatibleY],
    logs: [{ id: 'grade-portability:log:X', studentId: f.student.id, teachingId: f.teachingX.id, kind: 'participation', delta: 3, deleted: false, updatedAt: 1 }],
    attendance: [
      { id: 'grade-portability:attendance:X:absent', studentId: f.student.id, teachingId: f.teachingX.id, status: 'absent', deleted: false, updatedAt: 1 },
      { id: 'grade-portability:attendance:X:present', studentId: f.student.id, teachingId: f.teachingX.id, status: 'present', deleted: false, updatedAt: 1 },
    ],
  });

  await store.transferStudent(f.student.id, f.y.id, { date: '2026-09-01' });
  await store.linkPortableScoreItems(participationX.id, participationY.id, { confirmed: true });
  await store.linkPortableScoreItems(attendanceX.id, attendanceY.id, { confirmed: true });
  let yContext = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(itemScore(participationY, yContext), 3, 'X participation follows the student to Y');
  assert.equal(itemScore(attendanceY, yContext), 8, 'X attendance-derived score follows the student to Y');
  assert.equal(itemScore(incompatibleY, yContext), null, 'different per-point configuration is not projected');
  const yGrades = store.teachingContext(f.teachingY.id).ctx[f.student.id];
  assert.equal(itemScore(participationY, yGrades), 3, 'the destination Grades screen receives the same participation projection');
  assert.equal(itemScore(attendanceY, yGrades), 8, 'the destination Grades screen receives the same attendance projection');

  await store.save({
    logs: [{ id: 'grade-portability:log:Y', studentId: f.student.id, teachingId: f.teachingY.id, kind: 'participation', delta: 2, deleted: false, updatedAt: 2 }],
    attendance: [{ id: 'grade-portability:attendance:Y:absent', studentId: f.student.id, teachingId: f.teachingY.id, status: 'absent', deleted: false, updatedAt: 2 }],
  });
  yContext = store.studentContext(f.student.id, f.teachingY.id);
  assert.equal(itemScore(participationY, yContext), 5, 'new Y participation combines with X');
  assert.equal(itemScore(attendanceY, yContext), 6, 'new Y absence combines with X');
  const combinedTotal = studentTotal([participationY, attendanceY], yContext);
  assert.deepEqual(
    { earned: combinedTotal.earned, outOfGraded: combinedTotal.outOfGraded, outOfAll: combinedTotal.outOfAll, missing: combinedTotal.missing },
    { earned: 11, outOfGraded: 20, outOfAll: 20, missing: 0 },
  );
  assert.equal(Math.round(combinedTotal.pct), 55);

  await store.transferStudent(f.student.id, f.x.id, { date: '2026-09-08' });
  const xContext = store.studentContext(f.student.id, f.teachingX.id);
  assert.equal(itemScore(participationX, xContext), 5, 'returning to X retains the combined participation score');
  assert.equal(itemScore(attendanceX, xContext), 6, 'returning to X retains the combined attendance score');
  assert.equal(store.logsOf(f.student.id).length, 2, 'projection adds no log records');
  assert.equal(store.attendanceOf(f.student.id).length, 3, 'projection adds no attendance records');
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
  cloud.setMockBackend(null);
});
