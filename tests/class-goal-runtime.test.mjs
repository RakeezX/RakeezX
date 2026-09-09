import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { buildBackup } from '../src/lib/export.js';
import { makeEnrollment, makeSection, makeSession, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear } from '../src/models.js';

const authoritative = (record, revision = 1) => ({ ...record, canonicalId: record.id, serverRevision: revision });

async function reset() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
}

async function fixture({ date = '2026-09-09' } = {}) {
  const year = authoritative(makeYear({ id: 'goal:year', hijriStart: 1450 }));
  const term = authoritative(makeTerm({ id: 'goal:term', yearId: year.id, index: 1, status: 'active' }));
  const subject = authoritative(makeSubject({ id: 'goal:subject', name: 'رياضيات', slug: 'goal-math' }));
  const section = authoritative(makeSection({ id: 'goal:section', yearId: year.id, grade: 5, label: 'أ' }));
  const teaching = authoritative(makeTeaching({ id: 'goal:teaching', sectionId: section.id, subjectId: subject.id, termId: term.id }));
  const students = [1, 2, 3].map((number) => authoritative(makeStudent({ id: `goal:student:${number}`, name: `طالب ${number}` })));
  const enrollments = students.map((student, index) => authoritative(makeEnrollment({
    id: `goal:enrollment:${index + 1}`, studentId: student.id, sectionId: section.id, rollNo: index + 1,
  })));
  const session = authoritative(makeSession({ id: 'goal:session', teachingId: teaching.id, date, period: 1, status: 'scheduled' }));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students, enrollments, sessions: [session] }, { queue: false });
  return { year, term, subject, section, teaching, students, enrollments, session };
}

beforeEach(reset);
after(() => { store.closeChannel(); db.closeDB(); });

test('goal is durable, constrained, session-aware, and never rewards at timer expiry', async () => {
  const f = await fixture();
  await assert.rejects(store.startClassGoal({ teachingId: f.teaching.id, text: 'x', durationMinutes: 0, rewardPoints: 2, date: f.session.date }), /1 و180/);
  await assert.rejects(store.startClassGoal({ teachingId: f.teaching.id, text: 'x', durationMinutes: 10, rewardPoints: 11, date: f.session.date }), /1 و10/);
  const goal = await store.startClassGoal({ teachingId: f.teaching.id, text: '  ننجز النشاط  ', durationMinutes: 10, rewardPoints: 3, date: f.session.date });
  assert.equal(goal.id, store.classGoalId(f.teaching.id));
  assert.equal(goal.sessionId, f.session.id);
  assert.equal(store.activeClassGoal(f.teaching.id).text, 'ننجز النشاط');
  assert.equal(store.state.logs.length, 0, 'elapsed time is derived and must never create participation rows');
  store.state.ready = false;
  await store.init();
  assert.equal(store.activeClassGoal(f.teaching.id).runId, goal.runId);
  await store.cancelClassGoal(f.teaching.id);
  const dateOnly = await store.startClassGoal({ teachingId: f.teaching.id, text: 'هدف بلا حصة', durationMinutes: 5, rewardPoints: 1, date: '2026-09-10' });
  assert.equal(dateOnly.sessionId, null, 'no artificial session should be materialized for a date-only Goal');
  await assert.rejects(
    store.startClassGoal({ teachingId: f.teaching.id, text: 'ربط غير صالح', durationMinutes: 5, rewardPoints: 1, date: '2026-09-10', sessionId: f.session.id }),
    /لا تنتمي/,
  );
});

test('charter selection is durable, selected-first data is pruned when a rule is deleted', async () => {
  const f = await fixture();
  const first = await store.addClassRule({ teachingId: f.teaching.id, iconKey: 'check', text: 'نستمع' });
  const second = await store.addClassRule({ teachingId: f.teaching.id, iconKey: 'users', text: 'نتعاون' });
  await store.setClassCharterSelection(f.teaching.id, [second.id]);
  assert.deepEqual(store.selectedClassRules(f.teaching.id).map((rule) => rule.id), [second.id]);
  await store.deleteClassRule(second.id);
  assert.deepEqual(store.selectedClassRules(f.teaching.id), []);
  const config = store.state.classCharterSelections.find((row) => row.teachingId === f.teaching.id);
  assert.deepEqual(config.selectedRuleIds, []);
  assert.ok(first);
});

test('reward preview uses exact session membership and excludes absent/excused without duplicates', async () => {
  const f = await fixture();
  await store.save({ sessionRosterSnapshots: [{
    id: store.sessionRosterSnapshotId(f.session.id), sessionId: f.session.id, teachingId: f.teaching.id,
    sectionId: f.section.id, capturedAt: Date.now(), state: 'complete', deleted: false, updatedAt: Date.now(),
    members: [...f.students, f.students[0]].map((student, index) => ({ studentId: student.id, rollNo: index + 1 })),
  }], attendance: [
    { id: 'goal:attendance:2', studentId: f.students[1].id, sessionId: f.session.id, teachingId: f.teaching.id, date: f.session.date, status: 'absent', note: '', deleted: false, updatedAt: Date.now() },
    { id: 'goal:attendance:3', studentId: f.students[2].id, sessionId: f.session.id, teachingId: f.teaching.id, date: f.session.date, status: 'excused', note: '', deleted: false, updatedAt: Date.now() },
  ] }, { queue: false });
  await store.startClassGoal({ teachingId: f.teaching.id, text: 'نشارك', durationMinutes: 5, rewardPoints: 2, date: f.session.date, sessionId: f.session.id });
  const preview = store.classGoalRewardPreview(f.teaching.id);
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.students.map((student) => student.id), [f.students[0].id]);
});

test('reward intent is one durable specialized command and reconciles canonical goal/log rows atomically', async () => {
  const f = await fixture();
  const goal = await store.startClassGoal({ teachingId: f.teaching.id, text: 'نشارك', durationMinutes: 5, rewardPoints: 2, date: f.session.date });
  await db.clearStore('outbox');
  const authoritativeGoal = authoritative({ ...goal, serverRevision: 1 });
  await store.save({ classGoals: [authoritativeGoal] }, { queue: false });
  await store.rewardClassGoal(f.teaching.id);
  await store.rewardClassGoal(f.teaching.id);
  const queued = (await db.getAll('outbox')).filter((row) => row.command === 'class-goal:reward');
  assert.equal(queued.length, 1);
  assert.equal(store.state.logs.length, 0);
  const canonicalLogs = f.students.map((student, index) => ({
    id: `goal-reward:${goal.runId}:${student.id}`, student_id: student.id, teaching_id: f.teaching.id,
    session_id: f.session.id, date: f.session.date, kind: 'participation', delta: 2,
    tag: 'مكافأة هدف الصف', note: `class-goal:${goal.id}:${goal.runId}`,
    revision: 1, field_revisions: { identity: 1, event: 1 }, deleted_at: null, client_updated_at: 50 + index,
  }));
  const engine = createSyncV2Engine({ database: db, transport: {
    async applyClassGoalRewardCommand(envelope) {
      return { mutationId: envelope.mutationId, outcome: 'completed', goal: {
        id: goal.id, teaching_id: f.teaching.id, run_id: goal.runId, date: f.session.date,
        session_id: f.session.id, text: goal.text, preset_key: null, duration_minutes: 5,
        reward_points: 2, state: 'completed', started_at: new Date(goal.startedAt).toISOString(),
        completed_at: new Date().toISOString(), reward_operation_id: goal.runId,
        revision: 2, field_revisions: { identity: 1, goal: 2 }, deleted_at: null, client_updated_at: 60,
      }, logs: canonicalLogs };
    },
    async fetchRecords() { return []; },
  } });
  const result = await engine.dispatchPending();
  assert.deepEqual({ acknowledged: result.acknowledged, failed: result.failed }, { acknowledged: 1, failed: 0 });
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal((await db.get('classGoals', goal.id)).state, 'completed');
  assert.equal((await db.getAll('logs')).filter((row) => row.note?.includes(goal.runId)).length, 3);
});

test('archive cancels active goal locally without reward and closed terms reject new goals', async () => {
  const f = await fixture();
  await store.startClassGoal({ teachingId: f.teaching.id, text: 'ننجز', durationMinutes: 5, rewardPoints: 1, date: f.session.date });
  await store.archiveSection(f.section.id, f.session.date);
  assert.equal(store.classGoalOf(f.teaching.id).state, 'cancelled');
  assert.equal(store.state.logs.length, 0);

  await reset();
  const closed = await fixture();
  await store.save({ terms: [{ ...closed.term, status: 'closed' }] }, { queue: false });
  await assert.rejects(store.startClassGoal({ teachingId: closed.teaching.id, text: 'مغلق', durationMinutes: 5, rewardPoints: 1, date: closed.session.date }), /مغلق/);
});

test('Backup V4 includes Goal and charter selection records without device/outbox data', async () => {
  const f = await fixture();
  const rule = await store.addClassRule({ teachingId: f.teaching.id, iconKey: 'check', text: 'نستمع' });
  await store.setClassCharterSelection(f.teaching.id, [rule.id]);
  await store.startClassGoal({ teachingId: f.teaching.id, text: 'نتعاون', durationMinutes: 10, rewardPoints: 2, date: f.session.date });
  const backup = await buildBackup({ sourceOwnerId: 'owner:test', backupId: 'goal-backup' });
  assert.equal(backup.version, 4);
  assert.equal(backup.data.classGoals.length, 1);
  assert.equal(backup.data.classCharterSelections.length, 1);
  assert.equal('outbox' in backup.data, false);
  assert.equal('device' in backup.data, false);
});
