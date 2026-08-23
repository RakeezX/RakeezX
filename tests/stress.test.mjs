import test from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import * as store from '../src/store.js';

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

test('Performance / Stress Suite: 1000 students, 50,000 scores', async (t) => {
  try {
    await store.init();

    const numStudents = 1000;
    const numItems = 5;
    const scoresPerItem = 10;

    const writes = { students: [], items: [], scores: [] };

    const start = performance.now();

    for (let i = 0; i < numStudents; i++) {
      writes.students.push({
        id: `s-${i}`,
        name: `Stress Student ${i}`,
        status: 'active',
        updatedAt: Date.now()
      });
    }

    for (let j = 0; j < numItems; j++) {
      writes.items.push({
        id: `i-${j}`,
        teachingId: 'tch1',
        name: `Item ${j}`,
        max: 10,
        updatedAt: Date.now()
      });
    }

    for (let i = 0; i < numStudents; i++) {
      for (let j = 0; j < numItems; j++) {
        for (let k = 0; k < scoresPerItem; k++) {
          writes.scores.push({
            id: `s-${i}_i-${j}_k-${k}`,
            studentId: `s-${i}`,
            itemId: `i-${j}`,
            value: Math.floor(Math.random() * 10),
            updatedAt: Date.now()
          });
        }
      }
    }

    await store.save(writes);
    const end = performance.now();

    console.log(`Stress test inserted ${numStudents} students and ${numStudents * numItems * scoresPerItem} scores in ${(end - start).toFixed(2)}ms`);

    assert.equal(store.state.students.length, numStudents);
    assert.equal(store.state.scores.length, numStudents * numItems * scoresPerItem);
    assert.equal(store.state.items.length, numItems);

    setTimeout(() => process.exit(0), 100);
  } catch (err) {
    console.error("Stress test failed:", err);
    throw err;
  }
});
