import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import { makeSession } from '../src/models.js';
import { buildBackup, restoreBackup } from '../src/lib/export.js';
import { setMockBackend, setMockAuth } from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';

class Backend {
  constructor() { this.records = {}; }
  async fetchRecords(table) { return this.records[table] || []; }
  async upsertRecords(table, records) {
    const target = this.records[table] ??= [];
    for (const record of records) {
      const index = target.findIndex((item) => item.id === record.id);
      if (index >= 0) target[index] = { ...record };
      else target.push({ ...record });
    }
    return { success: true };
  }
}

async function fresh() {
  await db.clearAll();
  await store.init();
  sync.state.status = 'idle';
}

async function fixture() {
  const section = await store.createSection({ grade: 5, label: 'م', name: 'الخامس / ملاحظات' });
  const teaching = await store.createTeaching({ sectionId: section.id });
  const student = await store.addStudent(section.id, 'طالب اختبار الملاحظات');
  const session = makeSession({ teachingId: teaching.id, date: '2026-08-25', period: 1 });
  await store.save({ sessions: [session] });
  return { section, teaching, student, session };
}

test('dated student notes retain history, context, transfers, reloads, and backups', async () => {
  await fresh();
  const { section, teaching, student, session } = await fixture();
  assert.deepEqual(store.notesOf(student.id), []);

  const first = await store.addStudentNote({ studentId: student.id, text: 'يحتاج متابعة في مهارة الطباعة', date: '2026-08-20', createdAt: 100 });
  const second = await store.addStudentNote({ studentId: student.id, text: 'تحسن في استخدام لوحة المفاتيح', date: '2026-08-25', createdAt: 200, teachingId: teaching.id, sessionId: session.id });
  assert.ok(first && second);
  assert.deepEqual(store.notesOf(student.id).map((note) => note.id), [second.id, first.id]);
  assert.equal(store.notesOf(student.id)[0].teachingId, teaching.id);
  assert.equal(store.notesOf(student.id)[0].sessionId, session.id);

  const nextSection = await store.createSection({ grade: 6, label: 'م', name: 'السادس / ملاحظات' });
  await store.transferStudent(student.id, nextSection.id);
  assert.equal(store.notesOf(student.id).length, 2);
  await store.editStudentNote(second.id, 'تحسن واضح في استخدام لوحة المفاتيح');
  assert.equal(store.notesOf(student.id)[0].text, 'تحسن واضح في استخدام لوحة المفاتيح');
  await store.deleteStudentNote(first.id);
  assert.equal(store.getStudent(student.id)?.id, student.id);
  assert.deepEqual(store.notesOf(student.id).map((note) => note.id), [second.id]);

  const backup = await buildBackup();
  assert.equal(backup.data.notes.some((note) => note.id === second.id), true);
  await db.clearAll();
  await restoreBackup(backup, 'replace');
  await store.init();
  assert.equal(store.notesOf(student.id)[0].text, 'تحسن واضح في استخدام لوحة المفاتيح');
  assert.equal(store.getSection(section.id)?.id, section.id);
});

test('legacy student.note migrates exactly once using its historical timestamp', async () => {
  await db.clearAll();
  await db.put('students', { id: 'legacy-student', name: 'طالب قديم', note: 'ملاحظة قديمة', status: 'active', updatedAt: 1_700_000_000_000, deleted: false });
  await store.init();
  const migrated = store.notesOf('legacy-student');
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].id, 'legacy-note:legacy-student');
  assert.equal(migrated[0].text, 'ملاحظة قديمة');
  assert.equal(migrated[0].date, '2023-11-14');
  await store.migrateLegacyStudentNotes();
  await db.closeDB();
  await store.init();
  assert.equal(store.notesOf('legacy-student').length, 1);
});

test('notes converge on fresh devices and preserve tombstones; demo-student notes stay local', async () => {
  const backend = new Backend();
  setMockBackend(backend);
  setMockAuth({ id: 'notes-user' }, {});
  await fresh();
  const { student } = await fixture();
  const note = await store.addStudentNote({ studentId: student.id, text: 'ملاحظة مزامنة' });
  await sync.syncNotes();
  assert.equal(sync.state.results.notes.status, 'success');
  assert.equal(backend.records.notes?.some((item) => item.id === note.id), true);

  await db.clearAll();
  await store.init();
  await sync.syncNotes();
  assert.equal(store.notesOf(student.id)[0].text, 'ملاحظة مزامنة');
  await new Promise((resolve) => setTimeout(resolve, 2));
  await store.editStudentNote(note.id, 'ملاحظة مزامنة معدلة');
  await sync.syncNotes();

  await db.clearAll();
  await store.init();
  await sync.syncNotes();
  assert.equal(store.notesOf(student.id)[0].text, 'ملاحظة مزامنة معدلة');
  await store.deleteStudentNote(note.id);
  await sync.syncNotes();
  assert.equal(backend.records.notes.find((item) => item.id === note.id).deleted_at !== null, true);

  await db.clearAll();
  await store.init();
  await sync.syncNotes();
  assert.deepEqual(store.notesOf(student.id), []);

  const demoStudent = { id: 'demo:student-notes', name: 'طالب تجريبي', status: 'active', updatedAt: Date.now(), deleted: false };
  await store.save({ students: [demoStudent] });
  const demoNote = await store.addStudentNote({ studentId: demoStudent.id, text: 'ملاحظة محلية تجريبية' });
  assert.equal(demoNote.id.startsWith('demo:'), true);
  assert.equal((await db.getAll('outbox')).some((entry) => entry.recordId === demoNote.id), false);
  store.closeChannel();
  db.closeDB();
});