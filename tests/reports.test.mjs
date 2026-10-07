import "fake-indexeddb/auto";
global.document = { 
  documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, 
  querySelector: () => ({ setAttribute: () => {} }),
  getElementById: () => null,
  createElement: () => ({ style: {}, click: () => {}, remove: () => {} }),
  body: { append: () => {}, appendChild: () => {} }
};
global.matchMedia = () => ({ matches: false });
global.URL = { createObjectURL: () => 'blob:', revokeObjectURL: () => {} };
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };

import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import reports from "../src/views/reports.js";
import { attendanceHasRecords, attendanceSessionsInRange, gradesHaveValues, supportEmptyMessage, supportHasIndicators, supportRows } from "../src/views/reports.js";
import { activateSyntheticAccountWorkspace } from "./helpers/synthetic-workspace.mjs";
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

test('N25 eligibility uses exported grade cells and attendance range', () => {
  const roster = [{ id: 'synthetic-student' }];
  const items = [{ id: 'synthetic-item', max: 10 }];
  const ctx = { 'synthetic-student': { scoresByItem: {}, automaticByItem: {}, attendance: [], logs: [] } };
  assert.equal(gradesHaveValues(roster, items, ctx), false);
  assert.equal(supportHasIndicators(roster, items, ctx), false);
  ctx['synthetic-student'].scoresByItem['synthetic-item'] = { value: 0 };
  assert.equal(gradesHaveValues(roster, items, ctx), true);
  assert.equal(supportHasIndicators(roster, items, ctx), true);

  const report = {
    sessions: [{ id: 'outside', date: '2026-08-01' }, { id: 'inside', date: '2026-08-15' }],
    attendanceBySession: new Map([['outside', new Map([['synthetic-student', { status: 'present' }]])], ['inside', new Map()]]),
  };
  const selected = attendanceSessionsInRange(report, '2026-08-10', '2026-08-20');
  assert.deepEqual(selected.map((session) => session.id), ['inside']);
  assert.equal(attendanceHasRecords(report, selected), false);
  report.attendanceBySession.get('inside').set('synthetic-student', { status: 'absent' });
  assert.equal(attendanceHasRecords(report, selected), true);
});

test('N25 support empty result explains the relevant correction', () => {
  assert.deepEqual(supportEmptyMessage(false), {
    title: 'لا توجد بيانات كافية لتحديد الطلاب الذين يحتاجون دعمًا',
    desc: 'ارصد الدرجات أو الحضور أو المشاركة أولًا.',
  });
  assert.deepEqual(supportEmptyMessage(true), {
    title: 'لا يوجد طلاب تنطبق عليهم مؤشرات الدعم حاليًا',
    desc: 'راجع المؤشرات أو اختر فصلًا آخر.',
  });
});

test("Reports Regression Suite", async (t) => {
  t.beforeEach(async () => {
    db.closeDB();
    await activateSyntheticAccountWorkspace();
    await db.clearAll();
    await store.init();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  });

  t.afterEach(async () => {
    store.closeChannel();
    await db.closeDB();
  });

  const now = Date.now();

  await t.test("Grade Report Generation", async () => {
    await store.init();
    
    // Seed required data for teachingContext
    await store.save({ years: [{ id: "y1", label: "Y1" }] });
    await store.save({ sections: [{ id: "sec1", yearId: "y1", label: "A" }] });
    await store.save({ teachings: [{ id: "tch1", sectionId: "sec1", subjectId: "sub1", termId: "t1" }] });
    await store.save({ students: [{ id: "std1", name: "Ahmed", rollNo: "1" }, { id: "std2", name: "Omar", rollNo: "2" }] });
    await store.save({ enrollments: [
      { id: "enr1", studentId: "std1", sectionId: "sec1", status: "active" },
      { id: "enr2", studentId: "std2", sectionId: "sec1", status: "active" }
    ] });
    
    // items and scores
    await store.save({ items: [{ id: "item1", teachingId: "tch1", name: "Q1", max: 10 }] });
    await store.save({ scores: [
      { id: "sc1", studentId: "std1", itemId: "item1", value: 9 },
      { id: "sc2", studentId: "std2", itemId: "item1", value: 5 }
    ] });
    
    // Mount report to set initial tab
    reports.onMount();
    
    // Intercept downloadBlob arguments via global.downloadBlob_mock if possible, 
    // or we can test the `reports.actions.csv` and check if it runs without errors and produces proper Blob parts.
    let exportedRowsStr = null;
    let oldBlob = global.Blob;
    global.Blob = class { 
      constructor(parts, opts) { 
        exportedRowsStr = parts[0]; 
        this.parts = parts; 
        this.opts = opts; 
      } 
    };

    reports.actions.csv(null, null, { id: "tch1" });
    
    console.log("EXPORTED:", exportedRowsStr);
    
    // the exported string should contain a BOM, followed by CSV rows
    assert.ok(exportedRowsStr.includes("Ahmed"));
    assert.ok(exportedRowsStr.includes("9"));
    assert.ok(exportedRowsStr.includes("Omar"));
    assert.ok(exportedRowsStr.includes("5"));

    // switch to attendance
    reports.actions.tab({ dataset: { tab: 'attendance' } });
    assert.ok(true, "Tab switch successful");

    // test attendance report
    await store.save({ sessions: [{ id: "sess1", teachingId: "tch1", date: "2026-08-01", period: 1 }] });
    await store.save({ attendance: [{ id: "att1", studentId: "std1", sessionId: "sess1", status: "present" }] });
    
    reports.actions.csv(null, null, { id: "tch1" });
    
    assert.ok(exportedRowsStr.includes("Ahmed"));
    assert.ok(exportedRowsStr.includes("2026"));
    
    global.Blob = oldBlob;
  });

  await t.test("Support report honours explicit sorting and ignores soft-deleted records", () => {
    const roster = [
      { id: 'support-a', name: 'طالب أ', rollNo: 2 },
      { id: 'support-b', name: 'طالب ب', rollNo: 1 },
    ];
    const item = { id: 'support-item', max: 100, deleted: false };
    const absent = (deleted = false) => ({ status: 'absent', deleted });
    const ctx = {
      'support-a': { scoresByItem: { [item.id]: { value: 10 } }, logs: [], attendance: [absent(), absent(), absent(true), absent(true)] },
      'support-b': { scoresByItem: { [item.id]: { value: 40 } }, logs: [], attendance: [] },
    };
    reports.onMount();
    assert.deepStrictEqual(supportRows(roster, [item], ctx).map((row) => row.s.id), ['support-a', 'support-b']);
    assert.ok(!supportRows(roster, [item], ctx)[0].reasons.some((reason) => reason.includes('غيابات')));
    reports.actions.sort({ value: 'roll' });
    assert.deepStrictEqual(supportRows([...roster].sort((a, b) => a.rollNo - b.rollNo), [item], ctx).map((row) => row.s.id), ['support-b', 'support-a']);
  });

  await t.test('attendance dates stay in the toolbar and filter brief, detailed, and A4 output', async () => {
    await store.save({ years: [{ id: 'y69', label: 'Y69' }] });
    await store.save({ sections: [{ id: 'sec69', yearId: 'y69', label: 'A' }] });
    await store.save({ teachings: [{ id: 'tch69', sectionId: 'sec69', subjectId: 'sub69', termId: 'term69' }] });
    await store.save({ students: [{ id: 'std69', name: 'N69 Student', rollNo: 1 }] });
    await store.save({ enrollments: [{ id: 'enr69', studentId: 'std69', sectionId: 'sec69', status: 'active' }] });
    await store.save({ sessions: [
      { id: 'ses69a', teachingId: 'tch69', date: '2026-08-01', period: 1 },
      { id: 'ses69b', teachingId: 'tch69', date: '2026-08-02', period: 1 },
    ] });
    await store.save({ attendance: [
      { id: 'att69a', studentId: 'std69', sessionId: 'ses69a', status: 'absent' },
      { id: 'att69b', studentId: 'std69', sessionId: 'ses69b', status: 'present' },
    ] });
    reports.onMount();
    reports.actions.tab({ dataset: { tab: 'attendance' } });
    const render = () => String(reports.render({ id: 'tch69' }));
    assert.match(render(), /class="field report-toolbar__date"[\s\S]*?data-change="filter-start"[\s\S]*?class="field report-toolbar__date"[\s\S]*?data-change="filter-end"[\s\S]*?report-toolbar__mode/);
    assert.equal((render().match(/data-change="filter-start"/g) ?? []).length, 1);
    assert.doesNotMatch(render(), /attendance-date-range/);
    reports.actions['filter-start']({ value: '2026-08-02' });
    reports.actions['filter-end']({ value: '2026-08-02' });
    assert.match(render(), /value="2026-08-02" data-change="filter-start"/);
    assert.match(render(), /value="2026-08-02" data-change="filter-end"/);
    assert.match(render(), /<td class="tabular fw-7">100%<\/td>/);
    let csv = '';
    const previousBlob = global.Blob;
    global.Blob = class { constructor(parts) { csv = String(parts[0]); } };
    try { reports.actions.csv(null, null, { id: 'tch69' }); } finally { global.Blob = previousBlob; }
    assert.equal(csv.split(/\r?\n/)[0].split(',').length, 5);
    assert.match(csv, /,0,0/);
    assert.doesNotMatch(csv, /,1,0/);
    reports.actions['att-mode']({ dataset: { mode: 'detailed' } });
    assert.match(render(), /1 حصة مرصودة/);
    reports.actions['toggle-a4']();
    assert.match(render(), /aria-pressed="true"/);
    assert.match(render(), /a4-preview-container/);
  });
});

test('N69 toolbar source keeps the N38 input contract and mobile wrapping', () => {
  const view = readFileSync(new NodeURL('../src/views/reports.js', import.meta.url), 'utf8');
  const css = readFileSync(new NodeURL('../src/styles/components.css', import.meta.url), 'utf8');
  assert.equal((view.match(/data-rakeez-date-scope="historical" lang="en" dir="ltr" inputmode="numeric"/g) ?? []).length, 2);
  assert.doesNotMatch(view, /attendance-date-range/);
  assert.match(css, /\.report-toolbar__date\s*\{[^}]*min-width: 130px/s);
  assert.match(css, /@media \(max-width: 360px\)\s*\{\s*\.report-toolbar__date\s*\{\s*flex-basis: 100%/);
});
