import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { itemScore, makeEnrollment, makeItem, makeSection, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear } from '../src/models.js';
import { inlineQuickLog, recordInlineQuickLog, flushInlineQuickLogEffect } from '../src/views/grades.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { GenericV2Backend } from './helpers/generic-v2-backend.mjs';
import { setRepaint } from '../src/repaint.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), addEventListener() {},
  getElementById: () => null,
};
global.CSS = { escape: (value) => value };
global.matchMedia = () => ({ matches: false });
const vibrations = [];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate(value) { vibrations.push(value); } } });
setRepaint(() => {});

test('N84 records one Quick Log event per action and projects after reload without changing scores', async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  const year = makeYear({ id: 'n84-year' });
  const term = makeTerm({ id: 'n84-term', yearId: year.id });
  const subject = makeSubject({ id: 'n84-subject' });
  const section = makeSection({ id: 'n84-section', yearId: year.id, grade: 4 });
  const teaching = makeTeaching({ id: 'n84-teaching', sectionId: section.id, subjectId: subject.id, termId: term.id });
  const student = makeStudent({ id: 'n84-student', name: 'طالب تجريبي' });
  const enrollment = makeEnrollment({ id: 'n84-enrollment', studentId: student.id, sectionId: section.id, rollNo: 1 });
  const participation = makeItem({ id: 'n84-participation', teachingId: teaching.id, name: 'مشاركة', auto: 'participation', max: 10, perPoint: 2 });
  const attendance = makeItem({ id: 'n84-attendance', teachingId: teaching.id, name: 'حضور', auto: 'attendance', max: 10 });
  const manual = makeItem({ id: 'n84-manual', teachingId: teaching.id, name: 'واجب', max: 10 });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [participation, attendance, manual] });
  await store.setScore(student.id, manual.id, 7);
  const button = (itemId, delta) => {
    const buttons = [{ disabled: false }, { disabled: false }];
    return { dataset: { workspace: store.getActiveWorkspace().id, item: itemId, student: student.id, delta: String(delta) }, closest: () => ({ querySelectorAll: () => buttons }) };
  };
  try {
    assert.match(String(inlineQuickLog(participation, student)), /data-act="n84-log"/);
    assert.equal(String(inlineQuickLog(attendance, student)), '');
    assert.equal(String(inlineQuickLog(manual, student)), '');
    assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), null);
    for (const [delta, expected] of [[1, 2], [-1, 0]]) {
      const before = store.state.logs.length;
      await Promise.all([
        recordInlineQuickLog(button(participation.id, delta), null, { id: teaching.id }),
        recordInlineQuickLog(button(participation.id, delta), null, { id: teaching.id }),
      ]);
      assert.equal(store.state.logs.length, before + 1);
      assert.equal(store.state.logs.at(-1).kind, 'participation');
      assert.equal(store.state.logs.at(-1).delta, delta);
      assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), expected);
      assert.equal(store.state.scores.filter((score) => score.itemId === participation.id).length, 0);
      const recorded = await db.get('logs', store.state.logs.at(-1).id);
      assert.equal(recorded.delta, delta);
      const queued = (await db.getAll('outbox')).filter(row => row.store === 'logs' && row.recordId === recorded.id);
      assert.equal(queued.length, 1);
      assert.equal(queued[0].ownerId, store.getActiveWorkspace().authUserId);
      assert.equal(queued[0].localPatch.studentId, student.id);
      flushInlineQuickLogEffect({ querySelector: () => null });
    }
    const count = store.state.logs.length;
    await recordInlineQuickLog(button(attendance.id, 1), null, { id: teaching.id });
    await recordInlineQuickLog(button(manual.id, 1), null, { id: teaching.id });
    await recordInlineQuickLog(button(participation.id, 2), null, { id: teaching.id });
    await recordInlineQuickLog(button(participation.id, 1), null, { id: 'wrong-teaching' });
    const foreignButton = button(participation.id, 1);
    foreignButton.dataset.student = 'another-student';
    await recordInlineQuickLog(foreignButton, null, { id: teaching.id });
    assert.equal(store.state.logs.length, count);
    // An actual disk failure is swallowed by store.save; the inline action must
    // neither acknowledge it nor leave a phantom log/outbox row or score.
    const connection = await db.openDB();
    const transaction = connection.transaction;
    const beforeOutbox = await db.getAll('outbox');
    const feedbackCount = vibrations.length;
    const consoleError = console.error;
    let failedWrites = 0;
    connection.transaction = function(names, mode, ...args) {
      if (mode === 'readwrite' && Array.from(names).includes('logs')) {
        failedWrites++;
        throw new DOMException('Synthetic disk full', 'QuotaExceededError');
      }
      return transaction.call(this, names, mode, ...args);
    };
    console.error = () => {};
    try {
      await recordInlineQuickLog(button(participation.id, 1), null, { id: teaching.id });
    } finally {
      connection.transaction = transaction;
      console.error = consoleError;
    }
    assert.equal(failedWrites, 1);
    assert.equal(store.state.logs.length, count);
    assert.equal((await db.getAll('logs')).length, count);
    assert.deepEqual(await db.getAll('outbox'), beforeOutbox);
    assert.equal(vibrations.length, feedbackCount);
    flushInlineQuickLogEffect({ querySelector() { assert.fail('Failed save must not produce a score pulse'); } });
    assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), 0);
    // An unresolved owner cannot create a log or confirm success.
    const workspace = store.getActiveWorkspace();
    runtimeSyncOwnershipGuard.setWorkspace({ type: 'unresolved', ownershipState: 'unresolved' });
    try {
      await recordInlineQuickLog(button(participation.id, 1), null, { id: teaching.id });
    } finally {
      runtimeSyncOwnershipGuard.setWorkspace(workspace);
    }
    assert.equal(store.state.logs.length, count);
    assert.deepEqual(await db.getAll('outbox'), beforeOutbox);
    assert.equal(vibrations.length, feedbackCount);
    // The failed action releases its lock; the next legitimate action persists.
    await recordInlineQuickLog(button(participation.id, 1), null, { id: teaching.id });
    assert.equal(store.state.logs.length, count + 1);
    assert.equal(vibrations.length, feedbackCount + 1);
    await db.closeDB();
    store.state.ready = false;
    await store.init();
    const ctx = store.teachingContext(teaching.id).ctx[student.id];
    assert.equal(itemScore(participation, ctx), 2);
    assert.equal(itemScore(manual, ctx), 7);
    assert.equal(itemScore(attendance, ctx), null);
    assert.equal(store.state.logs.length, 3);
    // Existing projection bounds are log semantics: each tap remains one event,
    // including a tap beyond a displayed bound; no grade is materialized.
    for (const [delta, expected] of [[-1, 0], [-1, 0], [1, 0], [1, 2], [1, 4], [1, 6], [1, 8], [1, 10], [1, 10]]) {
      const before = store.state.logs.length;
      await recordInlineQuickLog(button(participation.id, delta), null, { id: teaching.id });
      assert.equal(store.state.logs.length, before + 1);
      assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), expected);
    }
    const logsBeforeDenial = await db.getAll('logs');
    const outboxBeforeDenial = await db.getAll('outbox');
    const staleButton = button(participation.id, 1);
    staleButton.dataset.workspace = 'account:stale-owner';
    await recordInlineQuickLog(staleButton, null, { id: teaching.id });
    const active = store.getActiveWorkspace();
    runtimeSyncOwnershipGuard.setWorkspace({ ...active, authUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    try {
      await recordInlineQuickLog(button(participation.id, 1), null, { id: teaching.id });
    } finally { runtimeSyncOwnershipGuard.setWorkspace(active); }
    assert.deepEqual(await db.getAll('logs'), logsBeforeDenial);
    assert.deepEqual(await db.getAll('outbox'), outboxBeforeDenial);

    // Actual N84 IndexedDB outbox is passed through the existing Sync engine.
    // Only the remote transport is synthetic; it models idempotent receipts.
    const backend = new GenericV2Backend();
    const receipts = new Map();
    let authenticatedOwner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let calls = 0, pulls = 0, dropReceipt = true;
    const engine = createSyncV2Engine({ database: db, ownershipGuard: runtimeSyncOwnershipGuard,
      currentAuthenticatedUserId: () => authenticatedOwner,
      transport: {
        async applyMutation(envelope) {
          calls++;
          if (!receipts.has(envelope.mutationId)) receipts.set(envelope.mutationId, await backend.applySyncV2Mutation(envelope));
          if (envelope.entity === 'logs' && dropReceipt) { dropReceipt = false; throw new Error('Synthetic lost receipt'); }
          return structuredClone(receipts.get(envelope.mutationId));
        },
        async fetchRecords(entity) { pulls++; return backend.fetchRecords(entity); },
      },
    });
    const denied = await engine.dispatchPending();
    assert.ok(denied.ownershipBlocked > 0);
    assert.equal(calls, 0);
    assert.equal((await engine.pullAll({ stores: ['logs'] })).ownershipBlocked, true);
    assert.equal(pulls, 0);
    assert.deepEqual(await db.getAll('logs'), logsBeforeDenial);
    runtimeSyncOwnershipGuard.setWorkspace({ ...active, authUserId: authenticatedOwner });
    assert.ok((await engine.dispatchPending()).ownershipBlocked > 0);
    assert.equal(calls, 0);
    runtimeSyncOwnershipGuard.setWorkspace(active);
    authenticatedOwner = active.authUserId;
    assert.equal((await engine.dispatchPending()).failed, 1);
    const pendingRetry = (await db.getAll('outbox')).find(row => row.store === 'logs');
    assert.ok(pendingRetry);
    await db.closeDB();
    store.state.ready = false;
    await store.init();
    assert.equal((await db.get('outbox', pendingRetry.id)).mutationId, pendingRetry.mutationId);
    assert.equal((await engine.dispatchPending()).failed, 0);
    assert.equal((await db.getAll('outbox')).filter(row => row.store === 'logs').length, 0);
    assert.equal(backend.table('logs').length, logsBeforeDenial.length);
    assert.equal(new Set(backend.table('logs').map(row => row.id)).size, logsBeforeDenial.length);
    assert.equal((await engine.dispatchPending()).attempted, 0);
    await engine.pullStore('logs');
    await engine.pullStore('logs');
    await db.closeDB();
    store.state.ready = false;
    await store.init();
    assert.equal(store.state.logs.length, logsBeforeDenial.length);
    assert.equal(itemScore(participation, store.teachingContext(teaching.id).ctx[student.id]), 10);
    assert.equal(itemScore(manual, store.teachingContext(teaching.id).ctx[student.id]), 7);
    assert.equal(store.state.scores.filter(score => score.itemId === participation.id).length, 0);

  } finally {
    store.closeChannel();
    db.closeDB();
  }
});
