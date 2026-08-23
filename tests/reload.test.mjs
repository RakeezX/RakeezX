import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import test from "node:test";
import assert from "node:assert";
import * as db from "../src/lib/db.js";
import * as store from "../src/store.js";
import { makeTimeProfile } from "../src/models.js";

test("State and Reload Core Matrix Suite", async (t) => {
  t.beforeEach(async () => {
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  });

  t.afterEach(async () => {
    store.closeChannel();
    await db.closeDB();
  });

  await t.test("Full reload across sessions reconstructs state identically", async () => {
    await store.init();
    
    // Create initial state through standard store interfaces
    const tp = makeTimeProfile({ id: "tp_reload", name: "Reload Test", order: 1 });
    await store.save({ timeProfiles: [tp] });
    
    const year = { id: "y1", label: "Y1", order: 1, deleted: false };
    await store.save({ years: [year] });
    
    // Create section
    await store.patch("sections", "sec1", { yearId: "y1", grade: 1, label: "A", deleted: false }, { create: { yearId: "y1", grade: 1, label: "A" } });
    
    // Add multiple students and enrollments
    await store.patch("students", "std1", { name: "Ahmed", deleted: false }, { create: { name: "Ahmed" } });
    await store.patch("enrollments", "enr1", { studentId: "std1", sectionId: "sec1", status: "active", deleted: false }, { create: { studentId: "std1", sectionId: "sec1", status: "active" } });

    // Validate memory
    const stateBefore = {
      years: store.state.years.length,
      sections: store.state.sections.length,
      students: store.state.students.length,
      enrollments: store.state.enrollments.length,
      timeProfiles: store.state.timeProfiles.filter(t => t.id === "tp_reload").length
    };
    
    // Reset memory state, forcing reload from DB
    store.state.ready = false;
    store.state.years = [];
    store.state.sections = [];
    store.state.students = [];
    store.state.enrollments = [];
    store.state.timeProfiles = [];
    
    await store.init();
    
    const stateAfter = {
      years: store.state.years.length,
      sections: store.state.sections.length,
      students: store.state.students.length,
      enrollments: store.state.enrollments.length,
      timeProfiles: store.state.timeProfiles.filter(t => t.id === "tp_reload").length
    };

    assert.deepEqual(stateBefore, stateAfter, "State reloaded from DB must match exactly the state in memory before reload");
    
    const memStudent = store.state.students.find(s => s.id === "std1");
    assert.equal(memStudent.name, "Ahmed", "Deep structure must survive reload");
  });
});
