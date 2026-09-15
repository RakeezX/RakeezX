import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import { studentTotal } from "../src/models.js";

test("Scoring Business Rules Suite", async (t) => {
  t.beforeEach(async () => {
    await db.clearAll();
    store.state.ready = false;
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  });

  t.after(async () => {
    store.closeChannel();
    db.closeDB();
  });

  await t.test("Non-scored item must not count as zero", async () => {
    const now = Date.now();
    await db.put("items", { id: "item1", max: 10, deleted: false, updatedAt: now });
    await db.put("items", { id: "item2", max: 10, deleted: false, updatedAt: now });
    
    // std1 has score for item1, but NO score for item2
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 8, deleted: false, updatedAt: now });
    
    await store.init();
    const items = store.state.items.filter(i => !i.deleted);
    
    // mock context
    const ctx = {
      scoresByItem: {
        "item1": store.state.scores.find(s => s.itemId === "item1")
      }
    };
    
    const totals = studentTotal(items, ctx);
    
    assert.equal(totals.earned, 8);
    assert.equal(totals.outOfGraded, 10);
    assert.equal(totals.outOfAll, 20);
    assert.equal(totals.missing, 1);
    assert.equal(totals.pct, 80);
    assert.equal(totals.pctOfAll, 40);
  });

  await t.test("Multiple items and students calculations", async () => {
    const now = Date.now();
    await db.put("items", { id: "item1", max: 10, deleted: false, updatedAt: now });
    await db.put("items", { id: "item2", max: 20, deleted: false, updatedAt: now });
    
    // std1
    await db.put("scores", { id: "score_s1_i1", studentId: "std1", itemId: "item1", value: 5, deleted: false, updatedAt: now });
    await db.put("scores", { id: "score_s1_i2", studentId: "std1", itemId: "item2", value: 20, deleted: false, updatedAt: now });
    
    // std2
    await db.put("scores", { id: "score_s2_i1", studentId: "std2", itemId: "item1", value: 10, deleted: false, updatedAt: now });
    
    await store.init();
    const items = store.state.items.filter(i => !i.deleted);
    
    const ctx1 = { scoresByItem: { "item1": store.state.scores.find(s => s.id === "score_s1_i1"), "item2": store.state.scores.find(s => s.id === "score_s1_i2") } };
    const ctx2 = { scoresByItem: { "item1": store.state.scores.find(s => s.id === "score_s2_i1") } };
    
    const total1 = studentTotal(items, ctx1);
    assert.equal(total1.earned, 25);
    assert.equal(total1.outOfGraded, 30);
    assert.equal(total1.pct, (25/30)*100);
    
    const total2 = studentTotal(items, ctx2);
    assert.equal(total2.earned, 10);
    assert.equal(total2.outOfGraded, 10);
    assert.equal(total2.pct, 100);
  });

  await t.test("Score update and persistence failure isolation", async () => {
    const now = Date.now();
    await db.put("students", { id: "std1", name: "Test Student", status: "active", deleted: false, updatedAt: now });
    await db.put("items", { id: "item1", max: 10, deleted: false, updatedAt: now });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 5, deleted: false, updatedAt: now });
    await store.init();
    
    // Valid update
    await store.patch("scores", "score1", { value: 9 });
    let memScore = store.state.scores.find(s => s.id === "score1");
    assert.equal(memScore.value, 9);
    
    // reload to verify persistence
    await store.init();
    memScore = store.state.scores.find(s => s.id === "score1");
    assert.equal(memScore.value, 9);
  });
});
