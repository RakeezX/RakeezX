import test from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';

// Setup mock window environment
if (!globalThis.window) {
  globalThis.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    location: { hash: '' }
  };
  globalThis.matchMedia = globalThis.window.matchMedia;
}
if (!globalThis.document) {
  globalThis.document = {
    createElement: () => ({ getContext: () => null, style: {} }),
    querySelector: () => null,
    documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }
  };
}
if (!globalThis.Blob) {
  globalThis.Blob = class Blob {};
}
if (!globalThis.URL) {
  globalThis.URL = { createObjectURL: () => '', revokeObjectURL: () => {} };
}

test('Performance / Stress Suite: ~62k Mixed Dataset', async (t) => {
  try {
    await store.init();

    const writes = { 
      years: [], terms: [], subjects: [], sections: [], teachings: [],
      students: [], enrollments: [], items: [], scores: [], 
      sessions: [], attendance: [] 
    };

    const start = performance.now();

    writes.years.push({ id: 'y1', label: '2025', updatedAt: Date.now() });
    writes.terms.push({ id: 't1', yearId: 'y1', name: 'Term 1', updatedAt: Date.now() });
    
    for (let i = 0; i < 5; i++) writes.subjects.push({ id: `sub-${i}`, name: `Sub ${i}`, updatedAt: Date.now() });
    for (let i = 0; i < 10; i++) writes.sections.push({ id: `sec-${i}`, yearId: 'y1', name: `Sec ${i}`, updatedAt: Date.now() });
    for (let i = 0; i < 20; i++) writes.teachings.push({ id: `tch-${i}`, sectionId: `sec-${i%10}`, subjectId: `sub-${i%5}`, termId: 't1', updatedAt: Date.now() });

    const numStudents = 1000;
    for (let i = 0; i < numStudents; i++) {
      writes.students.push({ id: `std-${i}`, name: `Student ${i}`, status: 'active', updatedAt: Date.now() });
      writes.enrollments.push({ id: `enr-${i}`, studentId: `std-${i}`, sectionId: `sec-${i%10}`, updatedAt: Date.now() });
    }

    // 100 items (5 per teaching)
    for (let t = 0; t < 20; t++) {
      for (let i = 0; i < 5; i++) {
        writes.items.push({ id: `itm-${t}-${i}`, teachingId: `tch-${t}`, name: `Item ${i}`, max: 10, updatedAt: Date.now() });
      }
    }

    // 50,000 scores (50 per student across their items)
    for (let i = 0; i < numStudents; i++) {
      const tchId = i % 10; // mapped to one teaching logically via section
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < 10; k++) {
          writes.scores.push({
            id: `scr-${i}-${j}-${k}`,
            studentId: `std-${i}`,
            itemId: `itm-${tchId}-${j}`,
            value: Math.floor(Math.random() * 10),
            updatedAt: Date.now()
          });
        }
      }
    }

    // 200 sessions (10 per teaching)
    for (let t = 0; t < 20; t++) {
      for (let s = 0; s < 10; s++) {
        writes.sessions.push({ id: `ses-${t}-${s}`, teachingId: `tch-${t}`, date: `2025-01-0${s+1}`, updatedAt: Date.now() });
      }
    }

    // 10,000 attendances (10 per student)
    for (let i = 0; i < numStudents; i++) {
      const tchId = i % 10;
      for (let s = 0; s < 10; s++) {
        writes.attendance.push({
          id: `att-${i}-${s}`,
          studentId: `std-${i}`,
          sessionId: `ses-${tchId}-${s}`,
          status: 'present',
          updatedAt: Date.now()
        });
      }
    }

    await store.save(writes);
    const end = performance.now();
    const totalRecords = Object.values(writes).reduce((acc, arr) => acc + arr.length, 0);

    console.log(`Stress test inserted ${totalRecords} mixed records in ${(end - start).toFixed(2)}ms`);

    assert.equal(store.state.students.length, numStudents);
    assert.equal(store.state.scores.length, 50000);
    assert.equal(store.state.attendance.length, 10000);
  } catch (err) {
    console.error("Stress test failed:", err);
    throw err;
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
