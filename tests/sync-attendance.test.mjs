import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });

import { setMockBackend, setMockAuth } from "../src/lib/cloud.js";
import * as sync from "../src/lib/sync.js";
import * as store from "../src/store.js";
import * as db from "../src/lib/db.js";

class MockCloudBackend {
  constructor() {
    this.records = {};
  }
  async fetchRecords(tableName) { return this.records[tableName] || []; }
  async upsertRecords(tableName, records) {
    if (!this.records[tableName]) this.records[tableName] = [];
    const table = this.records[tableName];
    for (const rec of records) {
      const idx = table.findIndex(r => r.id === rec.id);
      if (idx >= 0) table[idx] = { ...rec, client_updated_at: rec.client_updated_at || Date.now() };
      else table.push({ ...rec, client_updated_at: rec.client_updated_at || Date.now() });
    }
    return { success: true };
  }
}

let backend;

test("Sync Attendance Suite", async (t) => {
  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    setMockBackend(backend);
    setMockAuth({ id: "test-user" }, {});
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
  });

  const setupBase = async () => {
    const now = Date.now();
    await db.put("students", { id: "std1", name: "Ahmed", status: "active", updatedAt: now });
    await db.put("students", { id: "std2", name: "Zaid", status: "active", updatedAt: now });
    await db.put("teachings", { id: "tch1", sectionId: "sec1", subjectId: "sub1", termId: "t1", updatedAt: now });
    await db.put("sessions", { id: "ses1", teachingId: "tch1", date: "2024-01-01", period: 1, status: "scheduled", updatedAt: now });

    // Remote requires the parents!
    backend.records["students"] = [
      { id: "std1", name: "Ahmed", client_updated_at: now },
      { id: "std2", name: "Zaid", client_updated_at: now }
    ];
    backend.records["years"] = [{ id: "y1", label: "1445", order: 1 }];
    backend.records["terms"] = [{ id: "t1", year_id: "y1", label: "T1" }];
    backend.records["subjects"] = [{ id: "sub1", name: "Math" }];
    backend.records["sections"] = [{ id: "sec1", year_id: "y1", grade: 1, label: "A" }];
    backend.records["teachings"] = [
      { id: "tch1", section_id: "sec1", subject_id: "sub1", term_id: "t1", client_updated_at: now }
    ];
    backend.records["sessions"] = [
      { id: "ses1", teaching_id: "tch1", date: "2024-01-01", period: 1, status: "scheduled", client_updated_at: now }
    ];
    await store.init();
  };

  await t.test("Initial push and immediate no-op", async () => {
    await setupBase();
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: Date.now() });
    await store.init();

    let stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 1);
    assert.equal(stats.attendance.pulled, 0);

    stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 0);
    assert.equal(stats.attendance.pulled, 0);
  });

  await t.test("Fresh device pull", async () => {
    await setupBase();
    backend.records["attendance"] = [
      { id: "att1", student_id: "std1", session_id: "ses1", teaching_id: "tch1", date: "2024-01-01", status: "excused", client_updated_at: Date.now() }
    ];

    let stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pulled, 1);

    await store.init();
    const atts = await db.getAll("attendance");
    assert.equal(atts.length, 1);
    assert.equal(atts[0].status, "excused");
  });

  await t.test("Conflict: Local newer wins", async () => {
    await setupBase();
    backend.records["attendance"] = [
      { id: "att1", student_id: "std1", session_id: "ses1", teaching_id: "tch1", date: "2024-01-01", status: "excused", client_updated_at: 1000 }
    ];
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "absent", updatedAt: 2000 });
    await store.init();

    let stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 1);
    assert.equal(stats.attendance.pulled, 0);
    assert.equal(backend.records["attendance"][0].status, "absent");
  });

  await t.test("Conflict: Remote newer wins", async () => {
    await setupBase();
    backend.records["attendance"] = [
      { id: "att1", student_id: "std1", session_id: "ses1", teaching_id: "tch1", date: "2024-01-01", status: "present", client_updated_at: 3000 }
    ];
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "absent", updatedAt: 2000 });
    await store.init();

    let stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 0);
    assert.equal(stats.attendance.pulled, 1);

    await store.init();
    const atts = await db.getAll("attendance");
    assert.equal(atts[0].status, "present");
  });

  await t.test("Missing remote session fails", async () => {
    await setupBase();
    backend.records["sessions"] = []; // Remote session missing!
    await db.remove("sessions", "ses1"); // Local session missing too!
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: Date.now() });
    await store.init();

    await sync.syncTimetable();
    assert.equal(sync.state.results.timetable.status, "error");
    assert.match(sync.state.results.timetable.error, /missing remote session ses1/);
  });

  await t.test("Missing remote student fails", async () => {
    await setupBase();
    backend.records["students"] = []; // Remote student missing!
    await db.remove("students", "std1"); // Local student missing too!
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: Date.now() });
    await store.init();

    await sync.syncTimetable();
    assert.equal(sync.state.results.timetable.status, "error");
    assert.match(sync.state.results.timetable.error, /missing remote student std1/);
  });

  await t.test("Unmarked students remain without records", async () => {
    await setupBase();
    // Only student 1 is marked.
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: Date.now() });
    await store.init();

    await sync.syncTimetable();

    assert.equal(backend.records["attendance"].length, 1);
    assert.equal(backend.records["attendance"][0].student_id, "std1");
  });

  await t.test("Multiple sessions on same day for same student", async () => {
    await setupBase();
    const now = Date.now();
    await db.put("sessions", { id: "ses2", teachingId: "tch1", date: "2024-01-01", period: 2, status: "scheduled", updatedAt: now });
    backend.records["sessions"].push({ id: "ses2", teaching_id: "tch1", date: "2024-01-01", period: 2, status: "scheduled", client_updated_at: now });

    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });
    await db.put("attendance", { id: "att2", studentId: "std1", sessionId: "ses2", teachingId: "tch1", date: "2024-01-01", status: "excused", updatedAt: now });
    await store.init();

    await sync.syncTimetable();

    assert.equal(backend.records["attendance"].length, 2);
    assert.equal(backend.records["attendance"].find(r => r.session_id === "ses1").status, "present");
    assert.equal(backend.records["attendance"].find(r => r.session_id === "ses2").status, "excused");
  });

  await t.test("Equal timestamps - no op", async () => {
    await setupBase();
    const now = Date.now();
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });
    backend.records["attendance"] = [{ id: "att1", student_id: "std1", session_id: "ses1", teaching_id: "tch1", date: "2024-01-01", status: "late", client_updated_at: now }];
    await store.init();
    const stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 0);
    assert.equal(stats.attendance.pulled, 0);
  });

  await t.test("No duplicate attendance rows", async () => {
    await setupBase();
    const now = Date.now();
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });
    backend.records["attendance"] = [{ id: "att1", student_id: "std1", session_id: "ses1", teaching_id: "tch1", date: "2024-01-01", status: "present", client_updated_at: now }];
    await store.init();
    await sync.syncTimetable();
    await sync.syncTimetable();
    const localAtt = await db.getAll("attendance");
    assert.equal(localAtt.length, 1);
  });

  await t.test("Moved student keeps historical attendance correctly", async () => {
    await setupBase();
    const now = Date.now();
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });

    await db.put("sections", { id: "sec2", yearId: "y1", grade: 2, label: "A", updatedAt: now });
    await db.put("teachings", { id: "tch2", sectionId: "sec2", subjectId: "sub1", termId: "t1", updatedAt: now });

    backend.records["sections"].push({ id: "sec2", year_id: "y1", grade: 2, label: "A", client_updated_at: now });
    backend.records["teachings"].push({ id: "tch2", section_id: "sec2", subject_id: "sub1", term_id: "t1", client_updated_at: now });

    await store.init();
    const stats = await sync.syncTimetable();

    assert.equal(stats.attendance.pushed, 1);
    const remoteAtt = backend.records["attendance"][0];
    assert.equal(remoteAtt.teaching_id, "tch1");
  });

  await t.test("session.lessonId = null", async () => {
    await setupBase();
    const now = Date.now();
    await db.put("sessions", { id: "ses2", teachingId: "tch1", date: "2024-01-01", period: 2, status: "scheduled", lessonId: null, updatedAt: now });
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "ses2", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });
    await store.init();

    const stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 1);
  });



  await t.test("50-student roster", async () => {
    await setupBase();
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      await db.put("students", { id: `std_bulk_${i}`, name: `Student ${i}`, status: "active", updatedAt: now });
      backend.records["students"].push({ id: `std_bulk_${i}`, name: `Student ${i}`, client_updated_at: now });
      await db.put("attendance", { id: `att_bulk_${i}`, studentId: `std_bulk_${i}`, sessionId: "ses1", teachingId: "tch1", date: "2024-01-01", status: "present", updatedAt: now });
    }
    await store.init();
    const stats = await sync.syncTimetable();
    assert.equal(stats.attendance.pushed, 50);
  });

  // Cleanup: close open handles so Node test runner exits cleanly.
  // Without this, BroadcastChannel and IndexedDB keep the event loop alive.
  t.after(async () => {
    store.closeChannel();
    db.closeDB();
  });
});
