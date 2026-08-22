import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { setMockBackend } from "../src/lib/cloud.js";
import * as sync from "../src/lib/sync.js";
import * as store from "../src/store.js";
import * as db from "../src/lib/db.js";

class MockCloudBackend {
  constructor() {
    this.records = {};
  }
  
  async fetchRecords(tableName) {
    return this.records[tableName] || [];
  }
  
  async upsertRecords(tableName, records) {
    if (!this.records[tableName]) this.records[tableName] = [];
    const table = this.records[tableName];
    
    for (const rec of records) {
      const idx = table.findIndex(r => r.id === rec.id);
      if (idx >= 0) table[idx] = { ...rec, client_updated_at: Date.now() };
      else table.push({ ...rec, client_updated_at: Date.now() });
    }
    return { success: true };
  }
}

test("Sync Suite", async (t) => {
  let backend = new MockCloudBackend();
  setMockBackend(backend);
  
  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    setMockBackend(backend);
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  });

  await t.test("Scenario A: Structural remote -> fresh device convergence", async () => {
    backend.records["years"] = [{ id: "y1", label: "1445", order: 1 }];
    backend.records["terms"] = [{ id: "t1", year_id: "y1", label: "T1" }];
    backend.records["subjects"] = [{ id: "sub1", name: "Math" }];
    backend.records["sections"] = [{ id: "sec1", year_id: "y1", grade: 1, label: "A" }];
    backend.records["teachings"] = [{ id: "tch1", term_id: "t1", subject_id: "sub1", section_id: "sec1" }];
    
    await sync.syncStructural();
    
    const localYears = await db.getAll("years");
    assert.equal(localYears.length, 1);
  });

  await t.test("Scenario C: Fresh-device timetable convergence", async () => {
    backend.records["time_profiles"] = [
      { id: "remote1", name: "التوقيت الصيفي", periods: [] },
      { id: "remote2", name: "التوقيت الشتوي", periods: [] },
      { id: "remote3", name: "توقيت رمضان", periods: [] },
      { id: "remote4", name: "التوقيت المدمج", periods: [] }
    ];
    await db.put("timeProfiles", { id: "local1", name: "التوقيت الصيفي", periods: [] });
    await db.put("timeProfiles", { id: "local2", name: "التوقيت الشتوي", periods: [] });
    await store.patchDevice({ activeTimeProfileId: "local1" });
    
    await sync.syncTimetable();
    
    assert.equal(backend.records["time_profiles"].length, 4); // D. Anti-duplication test
    const device = await db.get("device", "device");
    assert.equal(device.activeTimeProfileId, "remote1"); // K. Device remapping
  });

  await t.test("Scenario G/H/I: Dependency integrity and makeup order", async () => {
    await db.put("sessions", { id: "parent1", timeProfileId: "tp1", teachingId: "tch1", date: "2026-08-01", period: 1 });
    await db.put("sessions", { id: "child1", timeProfileId: "tp1", teachingId: "tch1", date: "2026-08-02", period: 1, makeupForId: "parent1" });
    await db.put("sessions", { id: "grandchild1", timeProfileId: "tp1", teachingId: "tch1", date: "2026-08-03", period: 1, makeupForId: "child1" });
    
    await sync.syncTimetable();
    assert.equal(backend.records["sessions"]?.length, 3);
  });
});

