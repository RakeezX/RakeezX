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

test("Sync Timestamps Suite", async (t) => {
  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    setMockBackend(backend);
    setMockAuth({ id: "test-user" }, {});
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
  });

  await t.test("Local newer than remote wins (Push)", async () => {
    backend.records["years"] = [{ id: "y1", label: "Remote Label", order: 1, client_updated_at: 1000 }];
    await db.put("years", { id: "y1", label: "Local Label", order: 1, updatedAt: 2000 });
    await store.init();
    
    await sync.syncStructural();
    
    const remote = backend.records["years"].find(r => r.id === "y1");
    assert.equal(remote.label, "Local Label");
  });

  await t.test("Remote newer than local wins (Pull)", async () => {
    backend.records["years"] = [{ id: "y1", label: "Remote Label", order: 1, client_updated_at: 3000 }];
    await db.put("years", { id: "y1", label: "Local Label", order: 1, updatedAt: 2000 });
    await store.init();
    
    await sync.syncStructural();
    
    const local = await db.get("years", "y1");
    assert.equal(local.label, "Remote Label");
  });

  await t.test("Equal timestamp no-op", async () => {
    backend.records["years"] = [{ id: "y1", label: "Remote Label", order: 1, client_updated_at: 2000 }];
    await db.put("years", { id: "y1", label: "Local Label", order: 1, updatedAt: 2000 });
    await store.init();
    
    const stats = await sync.syncStructural();
    assert.equal(stats.years.pushed, 0);
    assert.equal(stats.years.pulled, 0);
  });
});
