import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import { buildBackup, validateBackup, validateBackupIntegrity, restoreBackup } from "../src/lib/export.js";

test("Backup and Restore Suite", async (t) => {
  t.beforeEach(async () => {
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  });

  t.afterEach(async () => {
    store.closeChannel();
    await db.closeDB();
  });

  const now = Date.now();

  await t.test("Build, Validate, and Restore full backup", async () => {
    // 1. Create Data
    await db.put("years", { id: "y1", label: "1445", order: 1, deleted: false, updatedAt: now });
    await db.put("terms", { id: "t1", yearId: "y1", label: "T1", index: 1, deleted: false, updatedAt: now });
    await db.put("subjects", { id: "sub1", name: "Math", slug: "math", deleted: false, updatedAt: now });
    await db.put("sections", { id: "sec1", yearId: "y1", grade: 1, label: "A", deleted: false, updatedAt: now });
    await db.put("teachings", { id: "tch1", sectionId: "sec1", subjectId: "sub1", termId: "t1", deleted: false, updatedAt: now });
    await db.put("students", { id: "std1", name: "Ahmed", deleted: false, updatedAt: now });
    await db.put("enrollments", { id: "enr1", studentId: "std1", sectionId: "sec1", deleted: false, updatedAt: now });
    await db.put("timeProfiles", { id: "tp1", name: "Morning", periods: [], deleted: false, updatedAt: now });
    await db.put("slots", { id: "slot1", teachingId: "tch1", weekday: 0, period: 1, deleted: false, updatedAt: now });
    await db.put("sessions", { id: "sess1", teachingId: "tch1", date: "2026-08-01", period: 1, deleted: false, updatedAt: now });
    await db.put("attendance", { id: "att1", studentId: "std1", sessionId: "sess1", status: "present", deleted: false, updatedAt: now });
    await db.put("items", { id: "item1", teachingId: "tch1", name: "Quiz 1", max: 10, deleted: false, updatedAt: now });
    await db.put("scores", { id: "score1", studentId: "std1", itemId: "item1", value: 10, deleted: false, updatedAt: now });

    // Intentional exclusion (should not be exported or should be ignored)
    await db.put("device", { id: "device", lastSyncAt: 5 });

    // 2. Actual Backup
    const backup = await buildBackup();
    
    // 3. Inspect Backup
    assert.ok(backup.data.years.length === 1);
    assert.ok(backup.data.device === undefined, "Device store must be intentionally excluded");
    
    const check = validateBackup(backup);
    assert.ok(check.ok);

    // 4. Clear Isolated DB
    await db.clearAll();
    
    // 5. Actual Restore (merge)
    const res = await restoreBackup(backup, "merge");
    
    // 6. store.init() and verify
    await store.init();
    
    assert.ok(store.state.years.some(y => y.id === "y1"));
    assert.ok(store.state.terms.some(t => t.id === "t1"));
    assert.ok(store.state.subjects.some(s => s.id === "sub1"));
    assert.ok(store.state.sections.some(s => s.id === "sec1"));
    assert.ok(store.state.teachings.some(t => t.id === "tch1"));
    assert.ok(store.state.students.some(s => s.id === "std1"));
    assert.ok(store.state.enrollments.some(e => e.id === "enr1"));
    assert.ok(store.state.timeProfiles.some(tp => tp.id === "tp1"));
    assert.ok(store.state.slots.some(s => s.id === "slot1"));
    assert.ok(store.state.sessions.some(s => s.id === "sess1"));
    assert.ok(store.state.attendance.some(a => a.id === "att1"));
    assert.ok(store.state.items.some(i => i.id === "item1"));
    assert.ok(store.state.scores.some(s => s.id === "score1"));
  });

  await t.test("Negative Cases: Validation", async () => {
    // malformed JSON simulation
    assert.ok(!validateBackup("not a json").ok);
    assert.ok(!validateBackup({ app: "wrong" }).ok); // invalid root
    assert.ok(!validateBackup({ app: "rakeezx", version: 9999 }).ok); // unsupported version

    const belowSupported = { app: "rakeezx", version: 2, data: { students: [{ id: "old", name: "Old" }] } };
    assert.equal(validateBackup(belowSupported).code, "UNSUPPORTED_BACKUP_VERSION");
    await assert.rejects(restoreBackup(belowSupported), (error) => error.code === "UNSUPPORTED_BACKUP_VERSION");

    const future = { app: "rakeezx", version: 5, data: { students: [{ id: "future", name: "Future" }] } };
    assert.equal(validateBackup(future).code, "UNSUPPORTED_BACKUP_VERSION");
    await assert.rejects(restoreBackup(future), (error) => error.code === "UNSUPPORTED_BACKUP_VERSION");

    const parsed = JSON.parse(JSON.stringify(belowSupported));
    assert.equal(typeof parsed, "object", "JSON parsing only establishes that the file was read");
    assert.equal((await validateBackupIntegrity(parsed)).ok, false, "parsed content is not implicitly validated");
    
    const corruptedRecord = {
      app: "rakeezx", version: 3, data: { years: [{ no_id: "missing" }] }
    };
    assert.ok(!validateBackup(corruptedRecord).ok);
    
    const validButEmpty = { app: "rakeezx", version: 3, data: { years: [] } };
    assert.ok(!validateBackup(validButEmpty).ok); // no records
  });
});
