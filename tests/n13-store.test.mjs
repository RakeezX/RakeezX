import 'fake-indexeddb/auto';
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { n13Account } from './n13-fixture.mjs';
import { buildBackup } from '../src/lib/export.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { makeYear, makeTerm, makeSubject, makeSession, makeStudent, makeEnrollment } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
const dump = async () => Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
let year, term, firstSubject, secondSubject;
beforeEach(async () => {
  await n13Account();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  year = makeYear({ id: 'n13-year', hijriStart: 1450 });
  term = makeTerm({ id: 'n13-term', yearId: year.id });
  firstSubject = makeSubject({ id: 'n13-arabic', name: 'العربية', slug: 'n13-arabic' });
  secondSubject = makeSubject({ id: 'n13-science', name: 'العلوم', slug: 'n13-science' });
  await store.save({ years: [year], terms: [term, makeTerm({ yearId: year.id, index: 2, status: 'upcoming' })], subjects: [firstSubject, secondSubject] }, { queue: false });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id });
  await db.clearStore('outbox');
});
after(() => { store.closeChannel(); db.closeDB(); });
const create = (section, subject = firstSubject) => store.createTeaching({ sectionId: section.id, subjectId: subject.id, termId: term.id });

test('shared creation preserves roster IDs, labels/colors and natural identity through rapid retries/reload', async () => {
  const section = await store.createSection({ grade: 4, label: 'أ', color: '#1d4ed8' });
  const first = await create(section);
  const student = await store.addStudent(section.id, 'طالب اصطناعي');
  const before = await dump();
  const [second, retry] = await Promise.all([create(section, secondSubject), create(section, secondSubject)]);
  assert.equal(second.id, retry.id);
  assert.equal((await create(section, secondSubject)).id, second.id);
  for (const name of ['sections', 'students', 'enrollments']) assert.deepEqual(await db.getAll(name), before[name]);
  assert.deepEqual(store.students(first.id).map(row => row.id), [student.id]);
  assert.deepEqual(store.students(second.id).map(row => row.id), [student.id]);
  assert.equal(store.items(second.id).length, 5);
  assert.equal((await db.getAll('outbox')).filter(row => row.command === 'teaching:create' && row.recordId === second.id).length, 1);
  const beforeReload = await dump();
  db.closeDB(); store.state.ready = false; await store.init();
  assert.equal((await create(section, secondSubject)).id, second.id);
  assert.deepEqual(await dump(), beforeReload);
});

test('invalid/missing/archived references, year mismatch, closed term and teaching tombstone fail before writes', async () => {
  const section = await store.createSection({ grade: 4, label: '1' });
  const otherYear = makeYear({ id: 'other-year', hijriStart: 1452 });
  const otherTerm = makeTerm({ id: 'other-term', yearId: otherYear.id });
  await store.save({ years: [otherYear], terms: [otherTerm] }, { queue: false });
  const invalid = [
    { sectionId: 'missing', subjectId: firstSubject.id, termId: term.id },
    { sectionId: section.id, subjectId: '', termId: term.id },
    { sectionId: section.id, subjectId: 'missing', termId: term.id },
    { sectionId: section.id, subjectId: firstSubject.id, termId: 'missing' },
    { sectionId: section.id, subjectId: firstSubject.id, termId: otherTerm.id },
  ];
  for (const input of invalid) {
    const before = await dump(); await assert.rejects(store.createTeaching(input)); assert.deepEqual(await dump(), before);
  }
  await store.save({ terms: [{ ...term, status: 'closed' }] }, { queue: false });
  let before = await dump(); await assert.rejects(create(section)); assert.deepEqual(await dump(), before);
  await store.save({ terms: [term] }, { queue: false });
  const teaching = await create(section);
  await store.deleteClassFromTeaching(teaching.id, store.classDeleteScope(teaching.id).signature);
  before = await dump(); await assert.rejects(create(section)); assert.deepEqual(await dump(), before);
  const archived = await store.createSection({ grade: 4, label: '2' });
  await store.archiveSection(archived.id);
  before = await dump(); await assert.rejects(create(archived)); assert.deepEqual(await dump(), before);
});

test('account roster, grades, sessions/attendance and report contexts remain independent through serialization', async () => {
  const section = await store.createSection({ grade: 5, label: 'مشترك' });
  const first = await create(section);
  const second = await create(section, secondSubject);
  const unrelated = await store.createSection({ grade: 6, label: 'آخر' });
  await create(unrelated);
  const student = await store.addStudent(section.id, 'طالب أول');
  const manualFirst = store.items(first.id).find(item => !item.auto);
  const manualSecond = store.items(second.id).find(item => !item.auto);
  await store.setScore(student.id, manualFirst.id, 8);
  await store.setScore(student.id, manualSecond.id, 3);
  const sessions = [first, second].map((teaching, index) => makeSession({ id: `n13-session-${index}`, teachingId: teaching.id, date: '2026-09-01', period: index + 1 }));
  await store.save({ sessions });
  await store.setAttendance(sessions[0].id, student.id, 'absent');
  await store.setAttendance(sessions[1].id, student.id, 'present');
  const before = await dump();
  await store.renameStudent(student.id, 'طالب معدّل');
  const added = await store.addStudent(section.id, 'طالب مضاف');
  for (const teaching of [first, second]) {
    assert.deepEqual(store.students(teaching.id).map(row => row.name), ['طالب معدّل', 'طالب مضاف']);
    assert.equal(store.students(teaching.id)[1].id, added.id);
  }
  for (const name of ['scores', 'sessions', 'attendance', 'teachings', 'items', 'sections']) assert.deepEqual(await db.getAll(name), before[name]);
  for (const [teaching, item, value, session, status] of [[first, manualFirst, 8, sessions[0], 'absent'], [second, manualSecond, 3, sessions[1], 'present']]) {
    const report = store.teachingContext(teaching.id);
    assert.equal(report.ctx[student.id].scoresByItem[item.id].value, value);
    assert.deepEqual(report.items.map(row => row.teachingId), Array(5).fill(teaching.id));
    const attendance = store.attendanceReportContext(teaching.id);
    assert.deepEqual(attendance.sessions.map(row => row.id), [session.id]);
    assert.equal(attendance.attendanceBySession.get(session.id).get(student.id).status, status);
  }
  for (const name of ['teachings', 'enrollments', 'scores', 'sessions', 'attendance']) {
    for (const row of await db.getAll(name)) {
      const decoded = decodeSyncV2Canonical(name, { id: row.id, ...encodeSyncV2Patch(name, row) });
      assert.equal(decoded.id, row.id);
      for (const key of ['sectionId', 'teachingId', 'studentId', 'subjectId', 'termId', 'itemId', 'sessionId']) if (key in row) assert.equal(decoded[key], row[key]);
    }
  }
  const backup = await buildBackup();
  assert.equal(backup.data.enrollments.filter(row => row.sectionId === section.id).length, 2);
  assert.equal(backup.data.teachings.filter(row => row.sectionId === section.id).length, 2);
  db.closeDB(); store.state.ready = false; await store.init();
  assert.equal(store.teachingContext(first.id).ctx[student.id].scoresByItem[manualFirst.id].value, 8);
  assert.equal(store.teachingContext(second.id).ctx[student.id].scoresByItem[manualSecond.id].value, 3);
});

test('scope-aware pristine delete, scope drift, and both retained-data blockers preserve exact disk/outbox', async () => {
  const section = await store.createSection({ grade: 4, label: 'حذف' });
  const first = await create(section);
  const second = await create(section, secondSubject);
  const shown = store.classDeleteScope(second.id);
  assert.equal(shown.kind, 'subject');
  await store.deleteClassFromTeaching(second.id, shown.signature);
  assert.ok(store.getSection(section.id)); assert.ok(store.getTeaching(first.id));
  assert.equal(store.getTeaching(second.id), null);
  const before = await dump();
  await assert.rejects(create(section, secondSubject), /محذوفة/);
  assert.deepEqual(await dump(), before);
  await assert.rejects(store.deleteClassFromTeaching(first.id, shown.signature), /تغيّرت/);
  assert.deepEqual(await dump(), before);
  // A retained Teaching tombstone blocks the final full-class deletion.
  assert.equal(store.classDeleteScope(first.id).kind, 'class');
  await assert.rejects(store.deleteClassFromTeaching(first.id, store.classDeleteScope(first.id).signature), /بيانات محفوظة/);
  assert.deepEqual(await dump(), before);
  const pristine = await store.createSection({ grade: 4, label: 'فارغ' });
  const last = await create(pristine);
  await store.deleteClassFromTeaching(last.id, store.classDeleteScope(last.id).signature);
  assert.equal(store.getSection(pristine.id), null);
  const retained = await store.createSection({ grade: 4, label: 'محفوظ' });
  const a = await create(retained), b = await create(retained, secondSubject);
  const student = makeStudent({ id: 'retained-student', name: 'طالب محفوظ' });
  await store.save({ students: [student], enrollments: [makeEnrollment({ sectionId: retained.id, studentId: student.id, yearId: year.id })] });
  const retainedBefore = await dump();
  await assert.rejects(store.deleteClassFromTeaching(b.id, store.classDeleteScope(b.id).signature), /بيانات محفوظة/);
  await assert.rejects(store.deleteClass(retained.id), /بيانات محفوظة/);
  assert.ok(store.getTeaching(a.id));
  assert.deepEqual(await dump(), retainedBefore);
  assert.equal((await db.getAll('outbox')).some(row => row.command === 'n77_delete_teaching'), false);
});
