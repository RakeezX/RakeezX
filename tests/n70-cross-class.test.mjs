import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import reportsIndex from '../src/views/reports-index.js';
import crossClass from '../src/views/cross-class-reports.js';
import { match } from '../src/router.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), getElementById: () => null,
};
global.matchMedia = () => ({ matches: false });
global.location = { hash: '#/reports' };

test('N70 routes, class hierarchy, report reasons and filters use current Product data', async () => {
  db.closeDB();
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  try {
    const year = store.activeYear();
    const term = store.activeTerm();
    await store.save({
      sections: [{ id: 'n70-section', yearId: year.id, grade: 4, section: 'أ' }],
      subjects: [{ id: 'n70-subject', name: 'رياضيات' }],
      teachings: [{ id: 'n70-teaching', sectionId: 'n70-section', subjectId: 'n70-subject', termId: term.id }],
      students: [{ id: 'n70-student', name: 'طالب الاختبار', rollNo: 1 }],
      enrollments: [{ id: 'n70-enrollment', studentId: 'n70-student', sectionId: 'n70-section', status: 'active' }],
      items: [{ id: 'n70-item', teachingId: 'n70-teaching', name: 'واجب', max: 10 }],
      scores: [{ id: 'n70-score', studentId: 'n70-student', itemId: 'n70-item', value: 2 }],
    });
    const hub = String(reportsIndex.render());
    assert.ok(hub.indexOf('تقارير الفصول') < hub.indexOf('جميع الفصول'));
    assert.deepEqual([...hub.matchAll(/data-n70-destination>([^<]+)/g)].map((m) => m[1]),
      ['الحصص والحضور', 'الدرجات', 'طلاب يحتاجون متابعة']);
    assert.equal(match('/reports/grades')?.route.path, '/reports/grades');
    assert.equal(match('/reports/followup')?.route.path, '/reports/followup');

    location.hash = '#/reports/grades';
    crossClass.onMount();
    const grades = String(crossClass.render());
    assert.match(grades, /طالب الاختبار/);
    assert.match(grades, /طباعة التقرير/);
    assert.match(grades, /data-change="n70-grade"/);
    assert.match(grades, /data-change="n70-filter"/);

    location.hash = '#/reports/followup';
    crossClass.onMount();
    const followup = String(crossClass.render());
    assert.match(followup, /طالب الاختبار/);
    assert.match(followup, /الدرجات دون 50٪/);
    assert.match(followup, /n70-class/);
    crossClass.actions['n70-search']({ value: 'لا يوجد طالب' });
    assert.match(String(crossClass.render()), /لا نتائج مطابقة/);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
