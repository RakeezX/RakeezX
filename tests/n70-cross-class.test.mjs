import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import reportsIndex from '../src/views/reports-index.js';
import crossClass from '../src/views/cross-class-reports.js';
import { match } from '../src/router.js';
import { reportContext } from './n09-report-harness-20261023/fixture.mjs';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), getElementById: () => null,
};
global.matchMedia = () => ({ matches: false });
global.location = { hash: '#/reports' };

test('N70 routes, class hierarchy, report reasons and filters use current Product data', async () => {
  try {
    const { year, term, save } = await reportContext();
    await save({
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
    assert.equal((grades.match(/data-act="n70-csv"/g) || []).length, 1);

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let blob = null;
    let filename = '';
    URL.createObjectURL = (value) => { blob = value; return 'blob:n70-test'; };
    URL.revokeObjectURL = () => {};
    document.createElement = () => ({ style: {}, click() { filename = this.download; }, remove() {} });
    document.body = { append() {} };
    try {
      crossClass.actions['n70-csv']();
      assert.equal(filename, 'درجات-جميع-الفصول.csv');
      const gradeCSV = await blob.text();
      assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.match(gradeCSV, /طالب الاختبار/);
      assert.match(gradeCSV, /,2,10,20,/);
      assert.doesNotMatch(gradeCSV, /n70-student|n70-teaching|n70-score/);

      location.hash = '#/reports/followup';
      crossClass.onMount();
      crossClass.actions['n70-csv']();
      assert.equal(filename, 'متابعة-الطلاب-جميع-الفصول.csv');
      assert.match(await blob.text(), /الدرجات دون 50٪/);

      blob = null;
      crossClass.actions['n70-search']({ value: 'لا يوجد طالب' });
      crossClass.actions['n70-csv']();
      assert.equal(blob, null, 'zero visible rows must not download');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    location.hash = '#/reports/followup';
    crossClass.onMount();
    const followup = String(crossClass.render());
    assert.match(followup, /طالب الاختبار/);
    assert.match(followup, /الدرجات دون 50٪/);
    assert.match(followup, /n70-class/);
    crossClass.actions['n70-search']({ value: 'لا يوجد طالب' });
    assert.match(String(crossClass.render()), /لا نتائج مطابقة/);

    store.deactivateWorkspace('n70-owner-switch');
    await reportContext({ ownerId: '22222222-2222-4222-8222-222222222222' });
    for (const route of ['grades', 'followup']) {
      location.hash = `#/reports/${route}`;
      crossClass.onMount();
      const isolated = String(crossClass.render());
      assert.match(isolated, /لا نتائج مطابقة/);
      assert.doesNotMatch(isolated, /طالب الاختبار|n70-student/);
    }
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
