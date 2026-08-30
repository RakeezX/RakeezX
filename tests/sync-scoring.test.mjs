import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import * as sync from "../src/lib/sync.js";
import { setMockBackend, setMockAuth } from "../src/lib/cloud.js";

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

test("Sync Scoring Suite", async (t) => {
  const now = Date.now();

  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    await db.clearAll();
    backend.records = {
      years: [], terms: [], subjects: [], sections: [], teachings: [],
      time_profiles: [], slots: [], sessions: [],
      students: [], enrollments: [],
      items: [], scores: [], logs: []
    };
    
    // Inject mock backend
    setMockAuth({ id: "test-user" }, {});
    setMockBackend(backend);
    
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
  });

  t.afterEach(async () => {
    store.closeChannel();
    await db.closeDB();
  });

  // Base structurally valid remote data
  function setupStruct() {
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["terms"] = [{ id: "term1", year_id: "year1", label: "T1", index: 1 }];
    backend.records["subjects"] = [{ id: "subj1", name: "Math", slug: "math" }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: 1, label: "A", client_updated_at: now }];
    backend.records["teachings"] = [{ id: "tch1", section_id: "sec1", subject_id: "subj1", term_id: "term1", client_updated_at: now }];
    backend.records["students"] = [{ id: "std1", name: "Ahmed", status: "active", client_updated_at: now }];
  }

  await t.test("Initial Local Push", async () => {
    setupStruct();
    await db.put("items", { id: "item1", teachingId: "tch1", name: "Test", max: 10, updatedAt: now });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 8, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(backend.records["items"]?.length, 1);
    assert.equal(backend.records["items"][0].name, "Test");
    assert.equal(backend.records["scores"]?.length, 1);
    assert.equal(backend.records["scores"][0].value, 8);
  });

  await t.test("Initial Remote Pull", async () => {
    setupStruct();
    backend.records["items"] = [{ id: "item2", teaching_id: "tch1", name: "Test2", max: 20, client_updated_at: now }];
    backend.records["scores"] = [{ id: "score2", student_id: "std1", item_id: "item2", value: 15, client_updated_at: now }];

    await store.init();
    await sync.syncScoring();

    const item = await db.get("items", "item2");
    assert.ok(item);
    assert.equal(item.name, "Test2");

    const score = await db.get("scores", "score2");
    assert.ok(score);
    assert.equal(score.value, 15);
  });

  await t.test("Immediate No-Op on Second Sync", async () => {
    setupStruct();
    backend.records["items"] = [{ id: "item2", teaching_id: "tch1", name: "Test2", max: 20, client_updated_at: now }];
    backend.records["scores"] = [{ id: "score2", student_id: "std1", item_id: "item2", value: 15, client_updated_at: now }];

    await store.init();
    let stats = await sync.syncScoring();
    assert.equal(stats.items.pulled, 1);
    assert.equal(stats.items.pushed, 0);

    // Second sync should be a true no-op
    sync.state.status = 'idle';
    stats = await sync.syncScoring();
    assert.equal(stats.items.pulled, 0);
    assert.equal(stats.items.pushed, 0);
    assert.equal(stats.scores.pulled, 0);
    assert.equal(stats.scores.pushed, 0);
  });

  await t.test("Local Newer overwrites Remote", async () => {
    setupStruct();
    backend.records["items"] = [{ id: "item1", teaching_id: "tch1", name: "Old", max: 10, client_updated_at: now - 1000 }];
    backend.records["scores"] = [{ id: "score1", student_id: "std1", item_id: "item1", value: 5, client_updated_at: now - 1000 }];

    await db.put("items", { id: "item1", teachingId: "tch1", name: "New", max: 10, updatedAt: now });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 10, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(backend.records["items"][0].name, "New");
    assert.equal(backend.records["scores"][0].value, 10);
  });

  await t.test("Remote Newer overwrites Local", async () => {
    setupStruct();
    backend.records["items"] = [{ id: "item1", teaching_id: "tch1", name: "NewRemote", max: 10, client_updated_at: now }];
    backend.records["scores"] = [{ id: "score1", student_id: "std1", item_id: "item1", value: 9, client_updated_at: now }];

    await db.put("items", { id: "item1", teachingId: "tch1", name: "OldLocal", max: 10, updatedAt: now - 1000 });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 4, updatedAt: now - 1000 });

    await store.init();
    await sync.syncScoring();

    const item = await db.get("items", "item1");
    assert.equal(item.name, "NewRemote");
    const score = await db.get("scores", "score1");
    assert.equal(score.value, 9);
  });

  await t.test("Duplicate Prevention via natural identity", async () => {
    // Sync does not do duplicate prevention on items natively without `context` for natural identity, 
    // but the db schema will enforce it if needed. For now, testing generic pull/push doesn't duplicate.
    setupStruct();
    backend.records["items"] = [{ id: "item1", teaching_id: "tch1", name: "Same", max: 10, client_updated_at: now }];
    
    await db.put("items", { id: "item1", teachingId: "tch1", name: "Same", max: 10, updatedAt: now });

    await store.init();
    const stats = await sync.syncScoring();
    assert.equal(stats.items.pushed, 0); // equal timestamp -> no push, no pull
    assert.equal(stats.items.pulled, 0);
  });

  await t.test("Foreign key protection: missing remote teaching fails sync for items", async () => {
    setupStruct();
    backend.records["teachings"] = [];
    await db.put("items", { id: "item1", teachingId: "tch1", name: "Test", max: 10, updatedAt: now });
    await store.init();
    await sync.syncScoring();
    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote teaching tch1/);
  });

  await t.test("Foreign key protection: missing remote student fails sync for scores", async () => {
    setupStruct();
    backend.records["students"] = [];
    backend.records["items"] = [{ id: "item1", teaching_id: "tch1", name: "Test", max: 10, client_updated_at: now }];
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 10, updatedAt: now });
    await store.init();
    await sync.syncScoring();
    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote student std1/);
  });
  
  await t.test("Foreign key protection: missing remote item fails sync for scores", async () => {
    setupStruct();
    backend.records["items"] = [];
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item_missing", value: 10, updatedAt: now });
    await store.init();
    await sync.syncScoring();
    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote item item_missing/);
  });
  await t.test("Quick Log push, pull, tombstone, and active-store notification", async () => {
    setupStruct();
    const localLog = { id: "log-local", teachingId: "tch1", studentId: "std1", kind: "participation", delta: 2, tag: "", note: "", sessionId: null, date: "2026-08-30", updatedAt: now, deleted: false };
    await store.save({ logs: [localLog] });
    await store.init();
    const first = await sync.syncScoring();
    assert.equal(first.logs.pushed, 1);
    assert.equal(backend.records.logs[0].id, "log-local");
    assert.equal(backend.records.logs[0].student_id, "std1");

    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    backend.records.logs.push({ id: "log-remote", student_id: "std1", teaching_id: "tch1", session_id: null, date: "2026-08-30", kind: "participation", delta: 3, tag: "remote", note: "", client_updated_at: now + 10, deleted_at: null });
    sync.state.status = "idle";
    const second = await sync.syncScoring();
    unsubscribe();
    assert.equal(second.logs.pulled, 1);
    assert.equal((await db.get("logs", "log-remote")).delta, 3);
    assert.deepEqual(backend.records.logs.map((record) => record.id).sort(), ["log-local", "log-remote"]);
    assert.ok(notifications > 0, "remote log pull notifies active store consumers");

    await store.patch("logs", localLog.id, { deleted: true, deletedAt: new Date(now + 20).toISOString(), updatedAt: now + 20 });
    sync.state.status = "idle";
    await sync.syncScoring();
    assert.ok(backend.records.logs.find((record) => record.id === "log-local").deleted_at);
    await sync.syncAll({ full: false });
    assert.equal((await db.getAll("outbox")).some((entry) => entry.store === "logs"), false, "acknowledges the exact synchronized log snapshot");
  });

  await t.test("Quick Log session FK is validated without changing log identity", async () => {
    setupStruct();
    backend.records.sessions = [{ id: "session1", teaching_id: "tch1", date: "2026-08-30", client_updated_at: now }];
    await store.save({ logs: [{ id: "log-session", teachingId: "tch1", studentId: "std1", sessionId: "session1", kind: "behavior", delta: -1, tag: "", note: "", date: "2026-08-30", updatedAt: now, deleted: false }] });
    await store.init();
    const stats = await sync.syncScoring();
    assert.equal(stats.logs.pushed, 1);
    assert.equal(backend.records.logs[0].session_id, "session1");

    backend.records.sessions = [];
    await store.save({ logs: [{ id: "log-missing-session", teachingId: "tch1", studentId: "std1", sessionId: "missing-session", kind: "behavior", delta: -1, tag: "", note: "", date: "2026-08-30", updatedAt: now + 1, deleted: false }] });
    sync.state.status = "idle";
    await sync.syncScoring();
    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote session missing-session/);
  });
});
