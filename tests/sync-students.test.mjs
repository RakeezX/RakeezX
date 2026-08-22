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

test("Sync Students & Enrollments Suite", async (t) => {
  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    setMockBackend(backend);
    setMockAuth({ id: "test-user" }, {});
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
  });

  t.after(async () => {
    await db.closeDB();
    await store.closeChannel();
  });

  const now = Date.now();

  await t.test("Push local student and enrollment to cloud", async () => {
    // structural dependencies
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    await db.put("sections", { id: "sec1", yearId: "year1", grade: "1", label: "A", updatedAt: now });

    await db.put("students", { id: "std1", name: "Ahmed", status: "active", updatedAt: now });
    await db.put("enrollments", { id: "enr1", studentId: "std1", sectionId: "sec1", status: "active", updatedAt: now });

    await store.init();
    await sync.syncStudents();

    assert.equal(backend.records["students"]?.length, 1);
    assert.equal(backend.records["students"][0].name, "Ahmed");

    assert.equal(backend.records["enrollments"]?.length, 1);
    assert.equal(backend.records["enrollments"][0].student_id, "std1");
    assert.equal(backend.records["enrollments"][0].section_id, "sec1");
  });

  await t.test("Pull remote student and enrollment", async () => {
    // Set up remote structural dependencies for enrollments
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["sections"] = [
      { id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }
    ];

    backend.records["students"] = [
      { id: "std2", name: "Zaid", status: "active", client_updated_at: now }
    ];
    backend.records["enrollments"] = [
      { id: "enr2", student_id: "std2", section_id: "sec1", status: "active", client_updated_at: now }
    ];

    await store.init();
    await sync.syncStudents();

    const std = await db.get("students", "std2");
    assert.ok(std);
    assert.equal(std.name, "Zaid");

    const enr = await db.get("enrollments", "enr2");
    assert.ok(enr);
    assert.equal(enr.studentId, "std2");
    assert.equal(enr.sectionId, "sec1");
  });

  await t.test("Foreign key protection: missing remote student fails sync", async () => {
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }];
    // We omit students remotely
    backend.records["students"] = [];
    
    // We create a local enrollment but no local student
    await db.put("enrollments", { id: "enr2", studentId: "std_missing", sectionId: "sec1", status: "active", updatedAt: now });

    await store.init();
    await sync.syncStudents();

    assert.equal(sync.state.results.students.status, "error");
    assert.match(sync.state.results.students.error, /missing remote student std_missing/);
  });

  await t.test("Foreign key protection: missing remote section fails sync", async () => {
    backend.records["students"] = [{ id: "std2", name: "Zaid", status: "active", client_updated_at: now }];
    // Section is NOT defined locally or remotely
    backend.records["sections"] = [];
    
    await db.put("enrollments", { id: "enr2", studentId: "std2", sectionId: "sec_missing", status: "active", updatedAt: now });

    await store.init();
    await sync.syncStudents();

    assert.equal(sync.state.results.students.status, "error");
    assert.match(sync.state.results.students.error, /missing remote section sec_missing/);
  });
});
