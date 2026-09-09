import 'fake-indexeddb/auto';
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { buildBackup } from '../src/lib/export.js';
import {
  groupArrangementId, makeEnrollment, makeSection, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear,
} from '../src/models.js';

const authoritative = (record, revision = 1) => ({
  ...record, canonicalId: record.id, serverRevision: revision, deleted: false,
});

async function reset() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
}

async function fixture() {
  const year = authoritative(makeYear({ id: 'groups:year', hijriStart: 1450 }));
  const term = authoritative(makeTerm({ id: 'groups:term', yearId: year.id, index: 1 }));
  const subject = authoritative(makeSubject({ id: 'groups:subject', name: 'رياضيات', slug: 'groups-math' }));
  const section = authoritative(makeSection({ id: 'groups:section', yearId: year.id, grade: 5, label: 'أ' }));
  const teaching = authoritative(makeTeaching({ id: 'groups:teaching', sectionId: section.id, subjectId: subject.id, termId: term.id }));
  const students = [1, 2, 3].map((number) => authoritative(makeStudent({ id: `groups:student:${number}`, name: `طالب ${number}` })));
  const enrollments = students.map((student, index) => authoritative(makeEnrollment({
    id: `groups:enrollment:${index + 1}`, studentId: student.id, sectionId: section.id, rollNo: index + 1,
  })));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students, enrollments }, { queue: false });
  return { year, term, subject, section, teaching, students, enrollments };
}

beforeEach(reset);
after(() => { store.closeChannel(); db.closeDB(); });

test('custom arrangement is durable, ID-only, duplicate-safe, and queues one V2 mutation', async () => {
  const f = await fixture();
  const [a, b, c] = f.students.map((student) => student.id);
  const saved = await store.saveGroupArrangement(f.teaching.id, [[a, b, a, 'missing'], [c, b]]);
  assert.equal(saved.id, groupArrangementId(f.teaching.id));
  assert.deepEqual(saved.groups, [[a, b], [c]]);
  assert.equal(new Set(saved.groups.flat()).size, 3);
  assert.equal(saved.groups.flat().every((id) => typeof id === 'string'), true);
  const queued = (await db.getAll('outbox')).filter((row) => row.store === 'groupArrangements');
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0].dependencies, [{ store: 'teachings', recordId: f.teaching.id, requiresServerRevision: true }]);

  store.state.ready = false;
  await store.init();
  assert.deepEqual(store.groupArrangementOf(f.teaching.id).groups, [[a, b], [c]]);
});

test('roster projection prunes transferred students, adds new eligible students, and never rewrites the saved base', async () => {
  const f = await fixture();
  const [a, b, c] = f.students.map((student) => student.id);
  await store.saveGroupArrangement(f.teaching.id, [[a, b], [c]]);
  const stored = structuredClone(store.groupArrangementOf(f.teaching.id).groups);
  await store.save({ enrollments: [{ ...f.enrollments[1], status: 'withdrawn', endDate: '2026-09-09' }] }, { queue: false });
  const newcomer = authoritative(makeStudent({ id: 'groups:student:4', name: 'طالب 4' }));
  const enrollment = authoritative(makeEnrollment({ id: 'groups:enrollment:4', studentId: newcomer.id, sectionId: f.section.id, rollNo: 4 }));
  await store.save({ students: [newcomer], enrollments: [enrollment] }, { queue: false });

  const projected = store.projectGroupArrangement(f.teaching.id);
  assert.equal(projected.flat().includes(b), false);
  assert.equal(projected.flat().includes(newcomer.id), true);
  assert.equal(new Set(projected.flat()).size, projected.flat().length);
  assert.deepEqual(store.groupArrangementOf(f.teaching.id).groups, stored,
    'roster and attendance projections must not destructively rewrite the base arrangement');

  await store.save({ attendance: [{
    id: 'groups:attendance', sessionId: 'groups:session', studentId: a,
    teachingId: f.teaching.id, date: '2026-09-09', status: 'absent', note: '', updatedAt: Date.now(), deleted: false,
  }] }, { queue: false });
  assert.deepEqual(store.groupArrangementOf(f.teaching.id).groups, stored);
});

test('archived teaching remains readable but rejects arrangement writes', async () => {
  const f = await fixture();
  const groups = [[f.students[0].id], [f.students[1].id, f.students[2].id]];
  await store.saveGroupArrangement(f.teaching.id, groups);
  await store.save({ sections: [{ ...f.section, status: 'archived', archivedAt: new Date().toISOString(), archiveDate: '2026-09-09' }] }, { queue: false });
  assert.deepEqual(store.projectGroupArrangement(f.teaching.id), groups);
  await assert.rejects(store.saveGroupArrangement(f.teaching.id, [groups.flat()]), /مؤرشف/);
});

test('legacy device arrangement migrates once and V4 backup includes the synced domain', async () => {
  const f = await fixture();
  const groups = [[f.students[0].id, f.students[1].id], [f.students[2].id]];
  await store.patchDevice({ groupArrangements: { [f.teaching.id]: groups } });
  store.state.ready = false;
  await store.init();
  assert.deepEqual(store.groupArrangementOf(f.teaching.id).groups, groups);
  assert.deepEqual(store.state.device.groupArrangements, {});
  assert.equal((await db.getAll('outbox')).filter((row) => row.store === 'groupArrangements').length, 1);
  const backup = await buildBackup({ sourceOwnerId: 'owner:groups', backupId: 'groups-backup' });
  assert.deepEqual(backup.data.groupArrangements.map((record) => record.groups), [groups]);
  assert.equal(backup.baselines.groupArrangements.length, 1);
});
