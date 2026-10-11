import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { sectionKeyMatches } from '../src/lib/sync.js';
import { localDeleteWrites, validateDeletePlan } from '../src/lib/n77-delete.js';
import { makeEnrollment, makeStudent } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('active Section wins over two deleted key peers through restore, reconciliation, add and Delete scope', async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  const year = store.activeYear();
  const term = store.activeTerm();
  const active = await store.createSection({ yearId: year.id, grade: 4, label: 'Overlap' });
  const subject = await store.createSubject({ name: 'Overlap first', slug: 'overlap-first' });
  const first = await store.createTeaching({ sectionId: active.id, subjectId: subject.id, termId: term.id });
  const student = makeStudent({ name: 'Synthetic Overlap Student' });
  const enrollment = makeEnrollment({ studentId: student.id, sectionId: active.id, yearId: year.id, rollNo: 1 });
  await store.save({ students: [student], enrollments: [enrollment] }, { queue: false });
  const deleted = ['old-a', 'old-b'].map((id) => ({ ...active, id: `section:${id}`, deleted: true }));
  const snapshot = Object.fromEntries(await Promise.all(db.STORES.filter((name) => name !== 'device')
    .map(async (name) => [name, name === 'sections' ? [...await db.getAll(name), ...deleted] : await db.getAll(name)])));
  await db.importInitialRestoreSnapshot(snapshot, { id: 'device', deviceId: 'synthetic-overlap',
    initialRestoreReceipt: { protocol: 'CORE_V1', restoreId: 'synthetic-overlap',
      ownerId: 'synthetic-owner', manifestHash: 'synthetic-overlap', completedAt: 1 } });
  store.state.ready = false;
  await store.init();
  assert.deepEqual(store.sections(year.id).filter((row) => row.label === active.label).map((row) => row.id), [active.id]);
  for (const row of deleted) {
    assert.equal(store.getSection(row.id), null);
    assert.equal((await db.get('sections', row.id)).deleted, true);
  }

  const remote = [deleted[0], active, deleted[1]].map((row) => ({ id: row.id, year_id: row.yearId,
    grade: row.grade, label: row.label, deleted_at: row.deleted ? '2026-10-01T00:00:00Z' : null }));
  const selected = sectionKeyMatches(active, remote);
  assert.deepEqual(selected.matches.map((row) => row.id), remote.map((row) => row.id));
  assert.deepEqual(selected.active.map((row) => row.id), [active.id]);

  const legacy = { ...active, id: 'section:legacy-rekey' };
  await db.applyBatch({ sections: {} }, { prepare: () => ({ sections: { put: [legacy] } }) });
  const rekey = await store.rekeyLocalSectionIdentity({ fromSectionId: legacy.id, canonicalSection: active,
    expectedSource: { yearId: year.id, grade: active.grade, label: active.label, deleted: false } });
  assert.equal(rekey.status, 'rekeyed');
  assert.equal(await db.get('sections', legacy.id), undefined);
  assert.ok(store.getSection(active.id));
  assert.ok(deleted.every((row) => store.state.sections.find((item) => item.id === row.id)?.deleted));

  const second = await store.addSubjectToSection(active.id, { token: 'builtin:math' });
  assert.equal(second.sectionId, active.id);
  assert.deepEqual(store.sectionRoster(active.id).map((row) => row.id), [student.id]);
  await assert.rejects(store.addSubjectToSection(deleted[0].id, { token: 'builtin:science' }));
  assert.ok(deleted.every((row) => (store.state.sections.find((item) => item.id === row.id)?.deleted)));

  const plan = { ownerId: 'synthetic-owner', selectedTeachingId: first.id, sectionId: active.id,
    scope: 'teaching', teachingIds: [first.id], fingerprint: 'synthetic-fingerprint' };
  validateDeletePlan(plan, { ownerId: plan.ownerId, teachingId: first.id, sectionId: active.id });
  assert.throws(() => validateDeletePlan(plan, { ownerId: plan.ownerId, teachingId: first.id,
    sectionId: deleted[0].id }));
  const current = { ...Object.fromEntries(await Promise.all(db.STORES.map(async (name) => [name, await db.getAll(name)]))),
    device: [{ id: 'device', n77DeleteIntent: { mutationId: 'synthetic-delete' } }] };
  const writes = localDeleteWrites(current, { ...plan, mutationId: 'synthetic-delete', cascadeTeachingIds: [first.id] }, 1);
  assert.equal(writes.sections, undefined);
  assert.equal(writes.enrollments, undefined);
  assert.deepEqual(writes.teachings.put.map((row) => row.id), [first.id]);
  assert.ok(store.getTeaching(second.id));
  assert.ok(store.getSection(active.id));
  assert.deepEqual(store.sectionRoster(active.id).map((row) => row.id), [student.id]);
});
