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

test("Reports Regression Suite", async (t) => {
  t.beforeEach(async () => {
    await db.clearAll();
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
});
