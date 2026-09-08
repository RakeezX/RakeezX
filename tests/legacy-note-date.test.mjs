import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import { todayISO } from '../src/models.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

test('legacy note migration uses device-local civil dates and preserves its existing guards', async () => {
  await db.clearAll();
  const cases = [
    ['late-evening', '2026-09-07T20:59:00.000Z', '2026-09-07'],
    ['midnight', '2026-09-07T21:00:00.000Z', '2026-09-08'],
    ['after-midnight', '2026-09-07T21:30:00.000Z', '2026-09-08'],
    ['pre-crossover', '2026-09-07T23:59:00.000Z', '2026-09-08'],
    ['post-crossover', '2026-09-08T00:00:00.000Z', '2026-09-08'],
  ];
  for (const [id, instant, expected] of cases) {
    await db.put('students', {
      id: `legacy-${id}`, name: 'طالب قديم', note: 'ملاحظة قديمة', status: 'active',
      updatedAt: Date.parse(instant), deleted: false,
    });
    assert.equal(todayISO(new Date(instant)), expected, `fixture uses local civil date for ${id}`);
  }
  await store.init();
  for (const [id, , expected] of cases) {
    assert.equal(store.notesOf(`legacy-${id}`)[0].date, expected);
  }
  assert.equal((await db.getAll('outbox')).some((entry) => entry.store === 'notes' && entry.recordId === 'legacy-note:legacy-midnight'), true);
  await store.migrateLegacyStudentNotes();
  assert.equal(store.notesOf('legacy-midnight').length, 1, 'deterministic migration remains idempotent');

  await db.clearAll();
  const tombstoneId = 'legacy-note:tombstoned-student';
  await db.put('students', { id: 'fallback-student', name: 'طالب', note: 'بلا ختم', status: 'active', deleted: false });
  await db.put('students', { id: 'tombstoned-student', name: 'طالب', note: 'لا تعاد', status: 'active', updatedAt: Date.parse('2026-09-07T21:30:00.000Z'), deleted: false });
  await db.put('students', { id: 'demo:legacy-student', name: 'طالب تجريبي', note: 'محلي', status: 'active', updatedAt: Date.parse('2026-09-07T21:30:00.000Z'), deleted: false });
  await db.put('notes', { id: tombstoneId, studentId: 'tombstoned-student', text: 'قديم', kind: 'legacy', date: '2026-09-01', deleted: true, updatedAt: 1 });
  await store.init();
  assert.equal(store.notesOf('fallback-student')[0].date, todayISO(), 'missing source timestamp retains the existing local-today fallback');
  assert.equal(store.notesOf('tombstoned-student').length, 0, 'tombstoned deterministic ID is never recreated');
  const demo = store.notesOf('demo:legacy-student')[0];
  assert.equal(demo.id, 'demo:legacy-note:demo:legacy-student');
  assert.equal((await db.getAll('outbox')).some((entry) => entry.recordId === demo.id), false, 'demo migration remains local only');
  store.closeChannel();
  await db.closeDB();
});
