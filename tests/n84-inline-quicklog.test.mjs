import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { itemScore, makeEnrollment, makeItem, makeSection, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear } from '../src/models.js';
import { inlineQuickLog, recordInlineQuickLog } from '../src/lib/work-n84-inline.js';
import { setRepaint } from '../src/repaint.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), addEventListener() {},
};
global.matchMedia = () => ({ matches: false });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate() {} } });
setRepaint(() => {});

test('N84 records one Quick Log event per action and projects after reload without changing scores', async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  const year = makeYear({ id: 'n84-year' });
  const term = makeTerm({ id: 'n84-term', yearId: year.id });
  const subject = makeSubject({ id: 'n84-subject' });
  const section = makeSection({ id: 'n84-section', yearId: year.id, grade: 4 });
  const teaching = makeTeaching({ id: 'n84-teaching', sectionId: section.id, subjectId: subject.id, termId: term.id });
  const student = makeStudent({ id: 'n84-student', name: 'طالب تجريبي' });
  const enrollment = makeEnrollment({ id: 'n84-enrollment', studentId: student.id, sectionId: section.id, rollNo: 1 });
  const participation = makeItem({ id: 'n84-participation', teachingId: teaching.id, name: 'مشاركة', auto: 'participation', max: 10, perPoint: 2 });
  const attendance = makeItem({ id: 'n84-attendance', teachingId: teaching.id, name: 'حضور', auto: 'attendance', max: 10 });
  const manual = makeItem({ id: 'n84-manual', teachingId: teaching.id, name: 'واجب', max: 10 });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [participation, attendance, manual] });
  await store.setScore(student.id, manual.id, 7);
  const button = (itemId, delta) => {
    const buttons = [{ disabled: false }, { disabled: false }];
    return { dataset: { item: itemId, student: student.id, delta: String(delta) }, closest: () => ({ querySelectorAll: () => buttons }) };
  };
  try {
    assert.match(String(inlineQuickLog(participation, student)), /data-act="n84-log"/);
    assert.equal(String(inlineQuickLog(attendance, student)), '');
    assert.equal(String(inlineQuickLog(manual, student)), '');
    assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), null);
    for (const [delta, expected] of [[1, 2], [-1, 0]]) {
      const before = store.state.logs.length;
      await recordInlineQuickLog(button(participation.id, delta), null, { id: teaching.id });
      assert.equal(store.state.logs.length, before + 1);
      assert.equal(store.state.logs.at(-1).kind, 'participation');
      assert.equal(store.state.logs.at(-1).delta, delta);
      assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), expected);
      assert.equal(store.state.scores.filter((score) => score.itemId === participation.id).length, 0);
    }
    const count = store.state.logs.length;
    await recordInlineQuickLog(button(attendance.id, 1), null, { id: teaching.id });
    await recordInlineQuickLog(button(manual.id, 1), null, { id: teaching.id });
    await recordInlineQuickLog(button(participation.id, 2), null, { id: teaching.id });
    await recordInlineQuickLog(button(participation.id, 1), null, { id: 'wrong-teaching' });
    assert.equal(store.state.logs.length, count);
    await db.closeDB();
    store.state.ready = false;
    await store.init();
    const ctx = store.teachingContext(teaching.id).ctx[student.id];
    assert.equal(itemScore(participation, ctx), 0);
    assert.equal(itemScore(manual, ctx), 7);
    assert.equal(itemScore(attendance, ctx), null);
    assert.equal(store.state.logs.length, 2);
  } finally {
    store.closeChannel();
    db.closeDB();
  }
});
