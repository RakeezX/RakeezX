import 'fake-indexeddb/auto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from './helpers/synthetic-workspace.mjs';
import { makeEnrollment, makeItem, makeSection, makeStudent, makeSubject,
  makeTeaching, makeTerm, makeYear } from '../src/models.js';

global.document = {
  visibilityState: 'visible',
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), addEventListener() {},
};
global.matchMedia = () => ({ matches: false });

before(async () => {
  cloud.setMockBackend(null);
  await activateSyntheticAccountWorkspace();
});
after(async () => { store.closeChannel(); await db.closeDB(); cloud.setMockBackend(null); });

async function fixture() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  const authoritative = (record) => ({ ...record, canonicalId: record.id, serverRevision: 1 });
  const year = authoritative(makeYear({ id: 'incident:year' }));
  const term = authoritative(makeTerm({ id: 'incident:term', yearId: year.id }));
  const subject = authoritative(makeSubject({ id: 'incident:subject' }));
  const section = authoritative(makeSection({ id: 'incident:section', yearId: year.id, grade: 4 }));
  const teaching = authoritative(makeTeaching({ id: 'incident:teaching', sectionId: section.id,
    subjectId: subject.id, termId: term.id }));
  const students = Array.from({ length: 7 }, (_, index) =>
    authoritative(makeStudent({ id: `incident:student:${index}`, name: `طالب ${index + 1}` })));
  const enrollments = students.map((student, index) => authoritative(makeEnrollment({
    id: `incident:enrollment:${index}`, studentId: student.id, sectionId: section.id, rollNo: index + 1,
  })));
  const items = Array.from({ length: 4 }, (_, index) => authoritative(makeItem({
    id: `incident:item:${index}`, teachingId: teaching.id, max: 10,
  })));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section],
    teachings: [teaching], students, enrollments, items }, { queue: false });
  await db.clearStore('outbox');
  return { students, items };
}

function transport() {
  const sent = [];
  const remote = new Map();
  return {
    sent, remote,
    async applyMutation(envelope) {
      sent.push(structuredClone(envelope));
      if (envelope.entity === 'scores' && envelope.operation === 'create' &&
          (!envelope.patch.student_id || !envelope.patch.item_id)) {
        throw Object.assign(new Error('STUDENT_TOMBSTONED'), { code: '23503', status: 409 });
      }
      const previous = remote.get(envelope.recordId);
      const row = { ...(previous ?? {}), ...envelope.patch, id: envelope.recordId,
        revision: (previous?.revision ?? 0) + 1, deleted_at: null };
      remote.set(envelope.recordId, row);
      return { mutationId: envelope.mutationId, canonicalId: envelope.recordId,
        canonical: row, resultRevision: row.revision, outcome: 'applied' };
    },
    async fetchRecords() { return []; },
    async getScoreDomainSnapshot() { return { items: [], score_subitems: [],
      score_subitem_completions: [], scores: [] }; },
  };
}

function engineWith(source) {
  return createSyncV2Engine({ database: db, transport: source,
    ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => SYNTHETIC_WORKSPACE_OWNER });
}

test('seven students across four DIRECT items queue 28 complete creates, then ordinary patches', async () => {
  const { students, items } = await fixture();
  for (const student of students) for (const item of items) {
    await store.setScore(student.id, item.id, 5);
  }
  const pending = (await db.getAll('outbox')).filter((row) => row.store === 'scores');
  assert.equal(pending.length, 28);
  assert.ok(pending.every((row) => row.op === 'create' && row.patch.student_id &&
    row.patch.item_id && row.patch.value === 5 && row.ownerId === SYNTHETIC_WORKSPACE_OWNER));
  const source = transport();
  const engine = engineWith(source);
  const first = await engine.dispatchPending();
  assert.equal(first.acknowledged, 28);
  assert.equal(first.failed + first.blocked, 0);
  assert.equal(source.remote.size, 28);
  assert.equal((await engine.dispatchPending()).attempted, 0);
  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.equal((await db.getAll('scores')).length, 28);
  assert.equal((await db.getAll('outbox')).length, 0);
  await store.setScore(students[0].id, items[0].id, 7);
  const [edit] = await db.getAll('outbox');
  assert.equal(edit.op, 'patch');
  assert.equal(edit.patch.value, 7);
  assert.equal(Object.hasOwn(edit.patch, 'student_id'), false);
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  assert.equal(source.remote.size, 28);
  assert.equal(source.remote.get(edit.recordId).value, 7);
});

test('28 rejected 01C envelopes recover once from canonical local scores without losing the old evidence', async () => {
  const { students, items } = await fixture();
  for (const student of students) for (const item of items) await store.setScore(student.id, item.id, 5);
  for (const row of await db.getAll('outbox')) {
    await db.put('outbox', { ...row, patch: { value: 5 }, fields: ['value'],
      localPatch: { value: 5 }, state: 'rejected', attemptCount: 1,
      lastError: { code: '23503', message: 'STUDENT_TOMBSTONED', status: 409 } });
  }
  const source = transport();
  const engine = engineWith(source);
  assert.equal(await engine.recoverRejectedScoreCreates(), 28);
  assert.equal(await engine.recoverRejectedScoreCreates(), 0);
  const outbox = await db.getAll('outbox');
  assert.equal(outbox.filter((row) => row.state === 'superseded').length, 28);
  assert.equal(outbox.filter((row) => row.state === 'pending').length, 28);
  assert.ok(outbox.filter((row) => row.state === 'pending').every((row) =>
    row.patch.student_id && row.patch.item_id && row.patch.value === 5));
  assert.equal((await engine.status()).rejectedCount, 0);
  assert.equal((await engine.status()).queuedCount, 28);
  const pushed = await engine.dispatchPending();
  assert.equal(pushed.acknowledged, 28);
  assert.equal(source.remote.size, 28);
  assert.equal((await engine.status()).queuedCount, 0);
  assert.equal((await db.getAll('outbox')).filter((row) => row.state === 'superseded').length, 28);
  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.equal((await db.getAll('scores')).length, 28);
  assert.equal((await engine.dispatchPending()).attempted, 0);
});

test('a cloud snapshot cannot erase an unsent local DIRECT score during recovery', async () => {
  const { students, items } = await fixture();
  await store.setScore(students[0].id, items[0].id, 6);
  const [original] = await db.getAll('outbox');
  await db.put('outbox', { ...original, patch: { value: 6 }, localPatch: { value: 6 },
    state: 'rejected', lastError: { code: '23503', message: 'STUDENT_TOMBSTONED' } });
  const source = transport();
  source.getScoreDomainSnapshot = async () => ({
    items: items.map((item) => ({ id: item.id, owner_id: SYNTHETIC_WORKSPACE_OWNER, teaching_id: item.teachingId,
      name: item.name, max: item.max, score_mode: 'direct', revision: 1, deleted_at: null })),
    score_subitems: [], score_subitem_completions: [], scores: [],
  });
  const engine = engineWith(source);
  const local = (await db.getAll('scores'))[0];
  const pull = await engine.pullAll({ stores: ['scores'], scoreDomainSnapshot: true });
  assert.deepEqual(pull.failures, []);
  assert.equal((await db.get('scores', local.id)).value, 6);
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  assert.equal(source.remote.get(local.id).value, 6);
});

test('malformed pending create is stopped locally; unrelated rejections and other owners are not repaired', async () => {
  const { students, items } = await fixture();
  await store.setScore(students[0].id, items[0].id, 5);
  const [original] = await db.getAll('outbox');
  await db.put('outbox', { ...original, patch: { value: 5 }, localPatch: { value: 5 },
    state: 'pending' });
  const source = transport();
  const engine = engineWith(source);
  assert.equal((await engine.dispatchPending()).blocked, 1);
  assert.equal(source.sent.length, 0);
  assert.equal((await db.get('outbox', original.id)).state, 'rejected');
  await db.put('outbox', { ...(await db.get('outbox', original.id)),
    lastError: { code: '23503', message: 'A_DIFFERENT_ERROR' } });
  assert.equal(await engine.recoverRejectedScoreCreates(), 0);
  assert.equal((await db.getAll('outbox')).length, 1);
  await db.put('outbox', { ...(await db.get('outbox', original.id)),
    lastError: { code: '23503', message: 'STUDENT_TOMBSTONED' } });
  const foreignEngine = createSyncV2Engine({ database: db, transport: source,
    ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  assert.equal(await foreignEngine.recoverRejectedScoreCreates(), 0);
  assert.equal((await db.getAll('outbox')).length, 1);
});
