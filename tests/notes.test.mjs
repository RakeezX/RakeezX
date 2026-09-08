import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import { makeSession, todayISO } from '../src/models.js';
import { buildBackup, restoreBackup } from '../src/lib/export.js';
import { setMockBackend, setMockAuth } from '../src/lib/cloud.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';

class Backend {
  constructor() {
    this.records = {};
    this.receipts = new Map();
  }
  rows(table) { return this.records[table] ??= []; }
  async fetchRecords(table) { return structuredClone(this.rows(table)); }
  seed(store, record) {
    this.rows(store).push({
      id: record.id,
      ...encodeSyncV2Patch(store, record),
      revision: 1,
      field_revisions: Object.fromEntries(Object.keys(encodeSyncV2Patch(store, record)).map((field) => [field, 1])),
      deleted_at: null,
      client_updated_at: record.updatedAt,
    });
  }
  async applySyncV2Mutation(envelope) {
    const prior = this.receipts.get(envelope.mutationId);
    if (prior) {
      assert.deepEqual(envelope, prior.envelope, 'a V2 retry must preserve its original envelope');
      return structuredClone(prior.result);
    }
    const rows = this.rows(envelope.entity);
    const index = rows.findIndex((row) => row.id === envelope.recordId);
    const existing = index >= 0 ? rows[index] : null;
    const revision = (existing?.revision ?? 0) + 1;
    const canonical = {
      ...(existing ?? {}), id: envelope.recordId, ...structuredClone(envelope.patch), revision,
      field_revisions: Object.fromEntries(Object.keys(envelope.patch).map((field) => [field, revision])),
      deleted_at: envelope.operation === 'delete' ? new Date(envelope.clientUpdatedAt).toISOString() : null,
      client_updated_at: envelope.clientUpdatedAt,
    };
    if (index >= 0) rows[index] = canonical;
    else rows.push(canonical);
    const result = {
      mutationId: envelope.mutationId, entity: envelope.entity, recordId: envelope.recordId,
      canonicalId: canonical.id, outcome: 'applied', appliedGroups: Object.keys(envelope.patch),
      conflictedGroups: [], resultRevision: revision, canonical: structuredClone(canonical),
    };
    this.receipts.set(envelope.mutationId, { envelope: structuredClone(envelope), result: structuredClone(result) });
    return result;
  }
}

async function fresh() {
  await db.clearAll();
  await store.init();
  sync.state.status = 'idle';
}

async function fixture(backend = null) {
  const section = { id: 'notes-section', yearId: 'year-notes', grade: 5, label: 'م', name: 'الخامس / ملاحظات', updatedAt: 1, serverRevision: 1 };
  const teaching = { id: 'notes-teaching', sectionId: section.id, subjectId: 'subject-notes', termId: 'term-notes', order: 0, updatedAt: 1, serverRevision: 1 };
  const student = { id: 'notes-student', name: 'طالب اختبار الملاحظات', status: 'active', updatedAt: 1, serverRevision: 1 };
  const session = { ...makeSession({ id: 'notes-session', teachingId: teaching.id, date: '2026-08-25', period: 1 }), updatedAt: 1, serverRevision: 1 };
  await store.save({ sections: [section], teachings: [teaching], students: [student], sessions: [session] }, { queue: false });
  if (backend) for (const [storeName, record] of Object.entries({ sections: section, teachings: teaching, students: student, sessions: session })) backend.seed(storeName, record);
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
  assert.equal(migrated[0].date, todayISO(new Date(1_700_000_000_000)));
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
  const { student } = await fixture(backend);
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
});

after(async () => {
  setMockBackend(null);
  setMockAuth(null, null);
  store.closeChannel();
  await db.closeDB();
});
