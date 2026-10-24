import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFullMarks, sortCertificateTeachings } from '../src/lib/certificate-selection.js';

const studentId = 'student-a';
const items = [{ id: 'homework', max: 10 }, { id: 'project', max: 20 }];
const manualContext = (values = [10, 20]) => ({
  scoresByItem: Object.fromEntries(items.flatMap((item, index) => index in values
    ? [[item.id, { studentId, itemId: item.id, value: values[index] }]] : [])),
});

test('honors require every live manual item to be fully recorded, not just the graded subset', () => {
  assert.equal(hasFullMarks(items, manualContext(), studentId), true);
  assert.equal(hasFullMarks(items, manualContext(['10', '20']), studentId), true);
  for (const [name, values] of [['partial', [10, 19]], ['zero', [10, 0]], ['missing item', [10]], ['no recording', []]]) {
    assert.equal(hasFullMarks(items, manualContext(values), studentId), false, name);
  }
  assert.equal(hasFullMarks(items, undefined, studentId), false);
});

test('empty, deleted-only and invalid-max item sets cannot qualify', () => {
  assert.equal(hasFullMarks([], manualContext(), studentId), false);
  assert.equal(hasFullMarks(items.map(item => ({ ...item, deleted: true })), manualContext(), studentId), false);
  assert.equal(hasFullMarks([...items, { id: 'retired', max: 10, deleted: true }], manualContext(), studentId), true);
  for (const max of [0, -1, NaN, Infinity, '10']) {
    assert.equal(hasFullMarks([{ ...items[0], max }], manualContext(), studentId), false, `invalid maximum ${max}`);
  }
});

test('manual full marks reject corrupt or foreign records and accept an owner-matched portable score', () => {
  for (const record of [
    { studentId, value: 21 },
    { studentId, value: null },
    { studentId, value: undefined },
    { studentId, value: 'invalid' },
    { studentId, value: 20, deleted: true },
    { studentId: 'another-student', value: 20 },
  ]) {
    const ctx = manualContext();
    ctx.scoresByItem.project = record;
    assert.equal(hasFullMarks(items, ctx, studentId), false);
  }
  const portable = manualContext();
  portable.scoresByItem.project.itemId = 'original-project-in-former-class';
  const before = structuredClone({ items, portable });
  assert.equal(hasFullMarks(items, portable, studentId), true);
  assert.deepEqual({ items, portable }, before);
});

test('automatic items use the canonical capped participation and attendance projections', () => {
  const automaticItems = [
    { id: 'participation', max: 10, auto: 'participation', perPoint: 2 },
    { id: 'attendance', max: 10, auto: 'attendance', penalty: 1 },
  ];
  const full = {
    classHasParticipation: false, logs: [], attendance: [],
    automaticByItem: {
      participation: { classHasParticipation: true, logs: [{ studentId, kind: 'participation', delta: 20 }] },
      attendance: { attendance: [{ studentId, status: 'present' }] },
    },
  };
  assert.equal(hasFullMarks(automaticItems, full, studentId), true);
  for (const changed of [
    { participation: { classHasParticipation: true, logs: [{ studentId, kind: 'participation', delta: 4 }] } },
    { participation: { classHasParticipation: false, logs: [] } },
    { participation: null },
    { attendance: { attendance: [] } },
    { attendance: { attendance: [{ studentId, status: 'absent' }] } },
  ]) {
    assert.equal(hasFullMarks(automaticItems, { ...full, automaticByItem: { ...full.automaticByItem, ...changed } }, studentId), false);
  }
  assert.equal(hasFullMarks([{ ...items[0], auto: 'unknown-auto' }], manualContext(), studentId), false);
});

test('certificate choices follow academic grade, natural section 1/2/10, Arabic subject and stable identity order', () => {
  const sections = {
    fourth1: { grade: 4, label: '1', order: 99 },
    fourth2: { grade: 4, label: '2', order: 1 },
    fourth10: { grade: 4, label: '١٠', order: 0 },
    fifth1: { grade: 5, label: '1', order: -1 },
    secondary1: { grade: 10, label: '1', order: -2 },
  };
  const subjects = { math: { name: 'الرياضيات' }, digital: { name: 'المهارات الرقمية' } };
  const input = Object.freeze([
    { id: 'secondary', sectionId: 'secondary1', subjectId: 'math' },
    { id: 'fourth-10', sectionId: 'fourth10', subjectId: 'digital' },
    { id: 'fourth-2', sectionId: 'fourth2', subjectId: 'digital' },
    { id: 'fourth-1-digital', sectionId: 'fourth1', subjectId: 'digital' },
    { id: 'fourth-1-math-z', sectionId: 'fourth1', subjectId: 'math' },
    { id: 'fifth', sectionId: 'fifth1', subjectId: 'digital' },
    { id: 'fourth-1-math-a', sectionId: 'fourth1', subjectId: 'math' },
  ].map(item => Object.freeze(item)));
  const original = [...input];
  const sorted = sortCertificateTeachings(input, { getSection: id => sections[id], getSubject: id => subjects[id] });
  assert.deepEqual(sorted.map(item => item.id), ['fourth-1-math-a', 'fourth-1-math-z', 'fourth-1-digital', 'fourth-2', 'fourth-10', 'fifth', 'secondary']);
  assert.notEqual(sorted, input);
  assert.deepEqual(input, original);
});
