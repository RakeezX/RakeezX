import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import { setMockBackend, setMockAuth } from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import { makeTimeProfile, DEFAULT_TIME_PROFILES } from '../src/models.js';

class StrictBackend {
  constructor() {
    this.records = {};
    this.profile = null;
    this.rejectTimeProfiles = false;
  }
  async fetchProfile() { return this.profile; }
  async insertProfile(profile) { this.profile = { ...profile }; return this.profile; }
  async updateProfile(profile) { this.profile = { ...this.profile, ...profile }; return this.profile; }
  async fetchRecords(table) { return this.records[table] ?? []; }
  async upsertRecords(table, records) {
    if (table === 'time_profiles' && (this.rejectTimeProfiles || records.some((record) => !record.name))) {
      throw new Error('null value in column "name" of relation "time_profiles" violates not-null constraint');
    }
    const target = this.records[table] ??= [];
    for (const record of records) {
      const index = target.findIndex((existing) => existing.id === record.id);
      if (index >= 0) target[index] = { ...record, client_updated_at: Date.now() };
      else target.push({ ...record, client_updated_at: Date.now() });
    }
    return { success: true };
  }
}

function resetSync() {
  sync.state.status = 'idle';
  sync.state.results = { profile: null, structural: null, students: null, notes: null };
}

test('legacy nameless time profile is repaired before authenticated automatic sync and replaces its stale outbox payload', async () => {
  const backend = new StrictBackend();
  setMockBackend(backend);
  setMockAuth({ id: 'legacy-profile-owner' }, {});
  await db.clearAll();

  const oldStamp = 1_700_000_000_000;
  const legacy = {
    id: 'legacy-time-profile', name: null, order: 4,
    periods: [{ period: 1, start: '07:00', end: '07:45' }], overrides: {},
    activeFrom: null, activeTo: null, deleted: false, updatedAt: oldStamp,
  };
  await db.put('timeProfiles', legacy);
  await db.put('outbox', {
    id: `timeProfiles:${legacy.id}`, store: 'timeProfiles', recordId: legacy.id,
    op: 'put', fields: null, updatedAt: oldStamp, queuedAt: oldStamp,
  });

  await store.init();
  const repaired = await db.get('timeProfiles', legacy.id);
  const queued = await db.get('outbox', `timeProfiles:${legacy.id}`);
  assert.equal(repaired.name, 'ملف توقيت قديم (-profile)');
  assert.deepEqual(repaired.periods, legacy.periods);
  assert.equal(repaired.id, legacy.id);
  assert.notEqual(queued.updatedAt, oldStamp);
  assert.equal(queued.updatedAt, repaired.updatedAt);
  assert.equal(makeTimeProfile({ name: null }).name, 'ملف توقيت');

  resetSync();
  assert.equal(await sync.syncAll({ full: true }), true);
  assert.equal(sync.state.status, 'synced');
  assert.equal(backend.records.time_profiles.find((profile) => profile.id === legacy.id)?.name, repaired.name);
  assert.equal((await db.getAll('outbox')).some((entry) => entry.id === queued.id), false);

  store.closeChannel();
  db.closeDB();
});

test('notes sync reports its own success when a separate timetable sync has failed', async () => {
  const backend = new StrictBackend();
  setMockBackend(backend);
  setMockAuth({ id: 'notes-isolation-owner' }, {});
  await db.clearAll();
  await store.init();
  resetSync();

  await store.createTimeProfile({ name: 'ملف يرفضه خادم الاختبار', periods: [] });
  backend.rejectTimeProfiles = true;
  await sync.syncTimetable();
  assert.equal(sync.state.results.timetable.status, 'error');

  const student = { id: 'notes-isolation-student', name: 'طالب ملاحظات', status: 'active', deleted: false, updatedAt: Date.now() };
  await store.save({ students: [student] });
  const note = await store.addStudentNote({ studentId: student.id, text: 'ملاحظة مستقلة عن الجدول' });
  await sync.syncNotes();


  assert.equal(sync.state.results.notes.status, 'success');
  assert.equal(sync.state.results.notes.error, undefined);
  assert.equal(backend.records.notes.some((record) => record.id === note.id), true);

  store.closeChannel();
  db.closeDB();
});


test('fresh authenticated profile reconciliation preserves named tombstones through post-login class and Quick Log sync', async () => {
  const backend = new StrictBackend();
  const remoteStamp = 1_700_000_000_000;
  backend.records.time_profiles = DEFAULT_TIME_PROFILES.map((profile, index) => ({
    id: 'remote-profile-' + index,
    name: profile.name,
    order: index,
    periods: profile.periods,
    overrides: profile.overrides,
    active_from: null,
    active_to: null,
    client_updated_at: remoteStamp,
  }));
  setMockBackend(backend);
  setMockAuth({ id: 'fresh-profile-owner' }, {});
  await db.clearAll();
  await store.init();
  resetSync();

  assert.equal(await sync.syncAll({ full: true }), true);
  const remappedTombstones = (await db.getAll('timeProfiles')).filter((profile) => profile.deleted);
  assert.equal(remappedTombstones.length, DEFAULT_TIME_PROFILES.length);
  assert.ok(remappedTombstones.every((profile) => typeof profile.name === 'string' && profile.name.trim()));

  const section = await store.createSection({ grade: 5, label: 'أ', name: '5/أ' });
  const teaching = await store.createTeaching({ sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id });
  const stamp = Date.now();
  const student = { id: 'fresh-flow-student', name: 'طالب اختبار', status: 'active', deleted: false, updatedAt: stamp };
  const enrollment = { id: 'fresh-flow-enrollment', studentId: student.id, sectionId: section.id, rollNo: 1, status: 'active', deleted: false, updatedAt: stamp };
  await store.save({ students: [student], enrollments: [enrollment] });
  await store.addLog({ teachingId: teaching.id, studentId: student.id, kind: 'participation', delta: 1, date: '2026-08-31' });

  const queuedProfiles = (await db.getAll('outbox')).filter((entry) => entry.store === 'timeProfiles').map((entry) => store.state.timeProfiles.find((profile) => profile.id === entry.recordId));
  assert.ok(queuedProfiles.every((profile) => typeof profile?.name === 'string' && profile.name.trim()));
  assert.equal(await sync.syncAll({ full: false }), true);
  const allProfiles = await db.getAll('timeProfiles');
  assert.ok(allProfiles.every((profile) => typeof profile.name === 'string' && profile.name.trim()));
  assert.ok((backend.records.time_profiles ?? []).every((profile) => typeof profile.name === 'string' && profile.name.trim()));
  assert.equal(sync.state.results.timetable.status, 'success');

  store.closeChannel();
  db.closeDB();
});
