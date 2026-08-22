import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import * as sync from "../src/lib/sync.js";
import { setMockBackend, setMockAuth } from "../src/lib/cloud.js";

const DEFAULT_TIME_PROFILES = [
  { name: 'التوقيت الصيفي' }
];

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
      items: [], scores: []
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

  await t.test("Push local item and score to cloud", async () => {
    // structural dependencies
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["terms"] = [{ id: "term1", year_id: "year1", label: "T1", index: 1 }];
    backend.records["subjects"] = [{ id: "subj1", name: "Math", slug: "math" }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }];
    
    // items depend on teaching
    await db.put("teachings", { id: "tch1", subjectId: "subj1", sectionId: "sec1", termId: "term1", updatedAt: now });

    // scores depend on student and item
    backend.records["students"] = [{ id: "std1", name: "Ahmed", status: "active", client_updated_at: now }];
    await db.put("students", { id: "std1", name: "Ahmed", status: "active", updatedAt: now }); // also local for scores
    
    await db.put("items", { id: "item1", teachingId: "tch1", name: "Test1", max: 10, updatedAt: now });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 8, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(backend.records["items"]?.length, 1);
    assert.equal(backend.records["items"][0].name, "Test1");
    assert.equal(backend.records["items"][0].teaching_id, "tch1");

    assert.equal(backend.records["scores"]?.length, 1);
    assert.equal(backend.records["scores"][0].student_id, "std1");
    assert.equal(backend.records["scores"][0].item_id, "item1");
    assert.equal(backend.records["scores"][0].value, 8);
  });

  await t.test("Pull remote item and score", async () => {
    // structural dependencies
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["terms"] = [{ id: "term1", year_id: "year1", label: "T1", index: 1 }];
    backend.records["subjects"] = [{ id: "subj1", name: "Math", slug: "math" }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }];
    backend.records["teachings"] = [{ id: "tch1", section_id: "sec1", subject_id: "subj1", term_id: "term1", client_updated_at: now }];
    
    backend.records["students"] = [{ id: "std2", name: "Zaid", status: "active", client_updated_at: now }];
    
    backend.records["items"] = [
      { id: "item2", teaching_id: "tch1", name: "Test2", max: 20, client_updated_at: now }
    ];
    backend.records["scores"] = [
      { id: "score2", student_id: "std2", item_id: "item2", value: 15, client_updated_at: now }
    ];

    await store.init();
    await sync.syncScoring();

    const item = await db.get("items", "item2");
    assert.ok(item);
    assert.equal(item.name, "Test2");

    const score = await db.get("scores", "score2");
    assert.ok(score);
    assert.equal(score.studentId, "std2");
    assert.equal(score.itemId, "item2");
    assert.equal(score.value, 15);
  });

  await t.test("Foreign key protection: missing remote teaching fails sync for items", async () => {
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }];
    // We omit teachings remotely
    backend.records["teachings"] = [];
    
    await db.put("items", { id: "item1", teachingId: "tch_missing", name: "Test", max: 10, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote teaching tch_missing/);
  });

  await t.test("Foreign key protection: missing remote student fails sync for scores", async () => {
    backend.records["years"] = [{ id: "year1", label: "1445", order: 1 }];
    backend.records["sections"] = [{ id: "sec1", year_id: "year1", grade: "1", label: "A", client_updated_at: now }];
    backend.records["teachings"] = [{ id: "tch1", section_id: "sec1", subject_id: "subj1", term_id: "term1", client_updated_at: now }];
    // We omit students remotely
    backend.records["students"] = [];
    
    backend.records["items"] = [{ id: "item1", teaching_id: "tch1", name: "Test", max: 10, client_updated_at: now }];
    
    await db.put("scores", { id: "score1", studentId: "std_missing", itemId: "item1", value: 10, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote student std_missing/);
  });
  
  await t.test("Foreign key protection: missing remote item fails sync for scores", async () => {
    backend.records["students"] = [{ id: "std1", name: "Zaid", status: "active", client_updated_at: now }];
    // We omit items remotely
    backend.records["items"] = [];
    
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item_missing", value: 10, updatedAt: now });

    await store.init();
    await sync.syncScoring();

    assert.equal(sync.state.results.scoring.status, "error");
    assert.match(sync.state.results.scoring.error, /missing remote item item_missing/);
  });
});
