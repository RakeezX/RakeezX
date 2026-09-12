import 'fake-indexeddb/auto';
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import {
  makeCalendar, makeEnrollment, makeSection, makeSession, makeSlot, makeStudent,
  makeSubject, makeTeaching, makeTerm, makeYear, todayISO, weekday,
} from '../src/models.js';

global.document = {
  visibilityState: 'visible',
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
  addEventListener() {},
};
global.matchMedia = () => ({ matches: false });

const authoritative = (record, serverRevision = 1) => ({
  ...record, canonicalId: record.id, serverRevision,
});

async function setup(suffix = 'base') {
  const date = todayISO();
  await store.save({ timeProfiles: store.state.timeProfiles.map((profile) => authoritative(profile)) }, { queue: false });
  const year = authoritative(makeYear({ id: `delete:${suffix}:year`, hijriStart: 1450 }));
  const term = authoritative(makeTerm({
    id: `delete:${suffix}:term`, yearId: year.id, index: 1,
    startDate: date, endDate: date, status: 'active',
  }));
  const subject = authoritative(makeSubject({ id: `delete:${suffix}:subject`, name: 'رياضيات', slug: `delete-${suffix}` }));
  const section = authoritative(makeSection({ id: `delete:${suffix}:section`, yearId: year.id, grade: 5, label: suffix }));
  const teaching = authoritative(makeTeaching({ id: `delete:${suffix}:teaching`, sectionId: section.id, subjectId: subject.id, termId: term.id }));
  const student = authoritative(makeStudent({ id: `delete:${suffix}:student`, name: 'طالب اختبار' }));
  const enrollment = authoritative(makeEnrollment({ id: `delete:${suffix}:enrollment`, studentId: student.id, sectionId: section.id, rollNo: 1 }));
  const slot = authoritative(makeSlot({ id: `delete:${suffix}:slot`, teachingId: teaching.id, weekday: weekday(date), period: 1 }));
  const calendar = authoritative(makeCalendar({ id: `delete:${suffix}:calendar`, yearId: year.id, source: 'custom' }));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], slots: [slot], calendars: [calendar] }, { queue: false });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id }, { queue: false });
  return { date, year, term, subject, section, teaching, student, enrollment, slot, calendar };
}

async function addSession(fixture, suffix, changes = {}) {
  const session = authoritative(makeSession({
    id: `delete:${suffix}:session`, teachingId: fixture.teaching.id,
    date: fixture.date, period: Number(changes.period ?? 1), status: 'scheduled', ...changes,
  }));
  await store.save({ sessions: [session] }, { queue: false });
  return session;
}

beforeEach(async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
});
after(() => store.closeChannel());

test('pristine deletion is atomic, durable, specialized, and locally idempotent', async () => {
  const fixture = await setup('pristine');
  const session = await addSession(fixture, 'pristine');

  const deleted = await store.deleteSession(session.id);
  assert.equal(deleted.deleted, true);
  assert.equal((await db.get('sessions', session.id)).deleted, true);
  const queued = (await db.getAll('outbox')).filter((row) => row.command === 'session:delete');
  assert.equal(queued.length, 1);
  assert.equal(queued[0].patch.sessionId, session.id);
  assert.equal(queued[0].protocol, 'v2');

  await store.softDelete('sessions', session.id);
  assert.equal((await db.getAll('outbox')).filter((row) => row.command === 'session:delete').length, 1);
});

test('held/cancelled sessions and retained attendance, snapshot, or makeup evidence are protected', async () => {
  const fixture = await setup('guards');
  const held = await addSession(fixture, 'held', { period: 2, status: 'held' });
  const cancelled = await addSession(fixture, 'cancelled', { period: 3, status: 'cancelled' });
  const withAttendance = await addSession(fixture, 'attendance', { period: 4 });
  const withSnapshot = await addSession(fixture, 'snapshot', { period: 5 });
  const makeupParent = await addSession(fixture, 'makeup-parent', { period: 6 });
  const makeupChild = await addSession(fixture, 'makeup-child', { period: 7, status: 'makeup', makeupForId: makeupParent.id });
  await store.save({
    attendance: [authoritative({ id: 'delete:attendance', studentId: fixture.student.id, sessionId: withAttendance.id, teachingId: fixture.teaching.id, date: fixture.date, status: 'present', note: '', deleted: false, updatedAt: 1 })],
    sessionRosterSnapshots: [authoritative({ id: 'delete:snapshot', sessionId: withSnapshot.id, teachingId: fixture.teaching.id, sectionId: fixture.section.id, capturedAt: 1, members: [], state: 'complete', deleted: false, updatedAt: 1 })],
  }, { queue: false });

  for (const session of [held, cancelled, withAttendance, withSnapshot, makeupParent, makeupChild]) {
    await assert.rejects(store.deleteSession(session.id), /لا يمكن حذف هذه الحصة/);
    assert.equal(store.getSession(session.id)?.deleted, false);
  }
  assert.deepEqual(store.sessionDeleteEvidence(withAttendance.id), ['attendance']);
  assert.deepEqual(store.sessionDeleteEvidence(withSnapshot.id), ['roster-snapshot']);
  assert.ok(store.sessionDeleteEvidence(makeupParent.id).includes('makeup'));
});

test('a deleted natural identity cannot rematerialize through direct, today, or range ensure paths', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-09T12:00:00Z') });
  const fixture = await setup('ensure');
  const session = authoritative(makeSession({ teachingId: fixture.teaching.id, date: fixture.date, period: 1, slotId: fixture.slot.id }));
  await store.save({ sessions: [session] }, { queue: false });
  await store.deleteSession(session.id);

  assert.equal(await store.ensureSession(fixture.teaching.id, fixture.date, 1), null);
  assert.deepEqual(await store.ensureSessionsForDate(fixture.date), { created: 0, existing: 0, skipped: 1 });
  const generated = await store.generateSessionsForRange(fixture.teaching.id, fixture.date, fixture.date);
  assert.equal(generated.created, 0);
  assert.equal(generated.existing, 1);
  assert.equal(store.state.sessions.filter((row) => row.teachingId === fixture.teaching.id && row.date === fixture.date && Number(row.period) === 1).length, 1);
  assert.equal(store.getSession(session.id), null);
});

test('cancellation remains a status transition and is not converted into deletion', async () => {
  const fixture = await setup('cancel');
  const session = await addSession(fixture, 'cancel');
  const cancelled = await store.setSessionStatus(session.id, 'cancelled', 'سبب');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.deleted, false);
  assert.equal((await db.getAll('outbox')).some((row) => row.command === 'session:delete'), false);
  await assert.rejects(store.deleteSession(session.id), /لا يمكن حذف هذه الحصة/);
});

test('a stale offline delete is restored from the canonical protected receipt and network retry keeps one mutationId', async () => {
  const fixture = await setup('stale');
  const session = await addSession(fixture, 'stale');
  await store.deleteSession(session.id);
  const attempts = [];
  const canonical = {
    id: session.id, teaching_id: session.teachingId, slot_id: null, time_profile_id: null,
    date: session.date, period: session.period, start_time: '', end_time: '', status: 'held',
    reason: '', makeup_for_id: null, lesson_id: null, note: '', homework: '', covered: '',
    revision: 2, field_revisions: { status: 2 }, deleted_at: null, client_updated_at: 2,
  };
  const engine = createSyncV2Engine({
    database: db,
    transport: {
      async applySessionDeleteCommand(envelope) {
        attempts.push(structuredClone(envelope));
        if (attempts.length === 1) throw new Error('simulated lost response');
        return { mutationId: envelope.mutationId, outcome: 'protected', reason: 'attendance', session: canonical };
      },
    },
  });

  assert.equal((await engine.dispatchPending()).failed, 1);
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].mutationId, attempts[1].mutationId);
  const restored = await db.get('sessions', session.id);
  assert.equal(restored.deleted, false);
  assert.equal(restored.status, 'held');
  assert.equal(restored.serverRevision, 2);
  assert.equal(restored.deleteProtection.reason, 'attendance');
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal((await engine.status()).state, 'synced');
});

test('offline create then delete preserves delete-wins through canonical session remapping', async () => {
  const fixture = await setup('offline-create');
  const local = await store.ensureSession(fixture.teaching.id, fixture.date, 1);
  await store.deleteSession(local.id);
  const canonicalId = 'delete:offline-create:canonical-session';
  const calls = [];
  const engine = createSyncV2Engine({
    database: db,
    transport: {
      async applyMutation(envelope) {
        calls.push({ kind: 'create', envelope: structuredClone(envelope) });
        return {
          mutationId: envelope.mutationId, canonicalId, outcome: 'canonicalized',
          conflictedGroups: ['__canonical__'], appliedGroups: [], resultRevision: 1,
          canonical: { id: canonicalId, ...envelope.patch, revision: 1, field_revisions: { identity: 1 }, deleted_at: null },
        };
      },
      async applySessionDeleteCommand(envelope) {
        calls.push({ kind: 'delete', envelope: structuredClone(envelope) });
        return {
          mutationId: envelope.mutationId, outcome: 'deleted', reason: null,
          session: {
            id: canonicalId, teaching_id: fixture.teaching.id, slot_id: fixture.slot.id,
            time_profile_id: local.timeProfileId, date: fixture.date, period: 1,
            start_time: local.startTime, end_time: local.endTime, status: 'scheduled', reason: '',
            makeup_for_id: null, lesson_id: null, note: '', homework: '', covered: '',
            revision: 2, field_revisions: { identity: 1, __deleted__: 2 },
            deleted_at: '2026-09-10T08:00:00Z', client_updated_at: 2,
          },
        };
      },
    },
  });

  const result = await engine.dispatchPending();
  assert.deepEqual(result, { attempted: 2, acknowledged: 2, failed: 0, blocked: 0 });
  assert.deepEqual(calls.map((call) => call.kind), ['create', 'delete']);
  assert.equal(calls[1].envelope.sessionId, canonicalId);
  assert.equal(await db.get('sessions', local.id), undefined);
  assert.equal((await db.get('sessions', canonicalId)).deleted, true);
  assert.equal((await db.getAll('outbox')).length, 0);
});
