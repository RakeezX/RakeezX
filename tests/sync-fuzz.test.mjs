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

// Simple deterministic random generator for fuzzing
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

test("Sync Fuzz & Stress Suite", async (t) => {
  const seed = 12345; // Fixed seed for determinism
  const rand = mulberry32(seed);
  
  t.beforeEach(async () => {
    backend = new MockCloudBackend();
    setMockBackend(backend);
    setMockAuth({ id: "test-user" }, {});
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
  });

  await t.test(`Fuzz Multi-Device Convergence (Seed: ${seed})`, async () => {
    // Generate realistic graph
    const numYears = Math.floor(rand() * 3) + 1;
    const numTerms = Math.floor(rand() * 2) + 1;
    const numSubjects = Math.floor(rand() * 5) + 1;
    const numSections = Math.floor(rand() * 26) + 5;
    const numTeachings = Math.floor(rand() * 51) + 10;
    
    // We'll just generate the records and push them from Device A
    const now = Date.now();
    
    const years = [];
    for (let i = 0; i < numYears; i++) years.push({ id: `y${i}`, label: `Year ${i}`, order: i, updatedAt: now });
    
    const terms = [];
    for (let i = 0; i < numTerms; i++) terms.push({ id: `t${i}`, yearId: `y0`, label: `Term ${i}`, index: i, updatedAt: now });
    
    const subjects = [];
    for (let i = 0; i < numSubjects; i++) subjects.push({ id: `sub${i}`, name: `Sub ${i}`, updatedAt: now });
    
    const sections = [];
    for (let i = 0; i < numSections; i++) sections.push({ id: `sec${i}`, yearId: `y0`, grade: 1, label: `Sec ${i}`, updatedAt: now });
    
    const teachings = [];
    for (let i = 0; i < numTeachings; i++) teachings.push({ id: `tch${i}`, termId: `t0`, subjectId: `sub0`, sectionId: `sec${i % numSections}`, updatedAt: now });
    
    // Shuffle teachings randomly
    teachings.sort(() => rand() - 0.5);
    
    for (const y of years) await db.put("years", y);
    for (const tm of terms) await db.put("terms", tm);
    for (const sb of subjects) await db.put("subjects", sb);
    for (const sc of sections) await db.put("sections", sc);
    for (const tc of teachings) await db.put("teachings", tc);
    
    await store.init();
    
    // Device A pushes
    await sync.syncStructural();
    
    // init() correctly seeds the mandatory academic foundation. Assert this
    // fuzz graph by its own stable IDs rather than by whole-table counts.
    const remoteCount = (table, records) =>
      backend.records[table].filter((record) => records.some((item) => item.id === record.id)).length;
    assert.equal(remoteCount("years", years), numYears);
    assert.equal(remoteCount("terms", terms), numTerms);
    assert.equal(remoteCount("subjects", subjects), numSubjects);
    assert.equal(remoteCount("sections", sections), numSections);
    assert.equal(remoteCount("teachings", teachings), numTeachings);
    
    // Device B pulls (clean state)
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init(); // Sets default year
    
    await sync.syncStructural();
    
    const bYears = await db.getAll("years");
    const bTeachings = await db.getAll("teachings");
    
    // Default year + pulled years
    assert.ok(bYears.length >= numYears);
    assert.equal(bTeachings.length, numTeachings);
    
    // Device B modifies
    await db.put("teachings", { ...teachings[0], order: 999, updatedAt: Date.now() });
    await store.init();
    await sync.syncStructural();
    
    const updatedRemote = backend.records["teachings"].find(t => t.id === teachings[0].id);
    assert.equal(updatedRemote.order, 999);
  });

  // Cleanup: close open handles so Node test runner exits cleanly.
  // Without this, BroadcastChannel and IndexedDB keep the event loop alive.
  t.after(async () => {
    store.closeChannel();
    db.closeDB();
  });
});
