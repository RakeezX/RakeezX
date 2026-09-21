import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoDataset, clearDemoRequest, isDemoRequested, requestDemo } from '../src/lib/demo-workspace.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { DEFAULT_TIME_PROFILES } from '../src/models.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('demo marker is explicit and reversible', () => {
  const storage = memoryStorage();
  assert.equal(isDemoRequested(storage), false);
  requestDemo(storage);
  assert.equal(isDemoRequested(storage), true);
  clearDemoRequest(storage);
  assert.equal(isDemoRequested(storage), false);
});

test('deterministic demo dataset is substantial, isolated, and excludes deferred domains', () => {
  const first = createDemoDataset();
  const second = createDemoDataset();
  assert.deepEqual(first, second);
  assert.equal(first.sections.length, 5);
  assert.equal(first.students.length, 115);
  assert.equal(first.enrollments.length, 115);
  assert.equal(first.teachings.length, 5);
  assert.ok(first.attendance.length >= 200);
  assert.ok(first.scores.length >= 400);
  assert.ok(first.logs.length >= 25);
  assert.ok(first.notes.length >= 100);
  assert.equal(first.units.length, 0);
  assert.equal(first.lessons.length, 0);
  assert.equal(first.assignments.length, 0);
  assert.equal(first.submissions.length, 0);
  assert.equal(first.outbox.length, 0);
  const standardProfileIds = new Set(DEFAULT_TIME_PROFILES.map((profile) => profile.id));
  for (const rows of Object.values(first).filter(Array.isArray)) {
    for (const row of rows) {
      assert.ok(row.id === 'profile' || row.id === 'device' || standardProfileIds.has(row.id) || String(row.id).includes('demo:'), `unexpected demo id: ${row.id}`);
    }
  }
});

test('demo roster, naming, timetable, and canonical timing profiles are realistic and consistent', () => {
  const dataset = createDemoDataset();
  const studentIds = new Set(dataset.students.map((student) => student.id));
  const sectionIds = new Set(dataset.sections.map((section) => section.id));
  const teachingIds = new Set(dataset.teachings.map((teaching) => teaching.id));
  const sessionIds = new Set(dataset.sessions.map((session) => session.id));
  const itemIds = new Set(dataset.items.map((item) => item.id));
  const enrollmentBySection = new Map(dataset.sections.map((section) => [
    section.id,
    dataset.enrollments.filter((enrollment) => enrollment.sectionId === section.id),
  ]));

  assert.equal(new Set(dataset.students.map((student) => student.name)).size, dataset.students.length);
  for (const section of dataset.sections) {
    assert.match(section.label, /^\d+$/);
    const enrollments = enrollmentBySection.get(section.id);
    assert.ok(enrollments.length >= 20 && enrollments.length <= 26);
    const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
    const surnames = dataset.students.filter((student) => enrolledIds.has(student.id)).map((student) => student.name.split(' ').at(-1));
    const surnameCounts = surnames.reduce((counts, surname) => counts.set(surname, (counts.get(surname) ?? 0) + 1), new Map());
    assert.ok(surnameCounts.size >= 15, `section ${section.id} lacks mixed surnames`);
    assert.ok(Math.max(...surnameCounts.values()) <= 2, `section ${section.id} is dominated by one surname`);
  }

  const occupied = new Set();
  for (const teaching of dataset.teachings) {
    const teachingSlots = dataset.slots.filter((slot) => slot.teachingId === teaching.id);
    assert.equal(teachingSlots.length, 2);
    for (const slot of teachingSlots) {
      const key = `${slot.weekday}:${slot.period}`;
      assert.equal(occupied.has(key), false, `teacher schedule collision at ${key}`);
      occupied.add(key);
    }
  }

  assert.deepEqual(dataset.timeProfiles.map(({ id, name, periods, overrides }) => ({ id, name, periods, overrides })), DEFAULT_TIME_PROFILES);
  assert.equal(dataset.timeProfiles.some((profile) => /تجريبي|demo/i.test(profile.name)), false);

  for (const enrollment of dataset.enrollments) {
    assert.ok(studentIds.has(enrollment.studentId));
    assert.ok(sectionIds.has(enrollment.sectionId));
  }
  for (const teaching of dataset.teachings) assert.ok(sectionIds.has(teaching.sectionId));
  for (const slot of dataset.slots) assert.ok(teachingIds.has(slot.teachingId));
  for (const session of dataset.sessions) {
    assert.ok(teachingIds.has(session.teachingId));
    assert.ok(dataset.slots.some((slot) => slot.id === session.slotId && slot.teachingId === session.teachingId));
  }
  for (const attendance of dataset.attendance) {
    assert.ok(studentIds.has(attendance.studentId));
    assert.ok(sessionIds.has(attendance.sessionId));
  }
  for (const score of dataset.scores) {
    assert.ok(studentIds.has(score.studentId));
    assert.ok(itemIds.has(score.itemId));
  }
  for (const arrangement of dataset.groupArrangements) {
    const teaching = dataset.teachings.find((entry) => entry.id === arrangement.teachingId);
    const enrolledIds = new Set(enrollmentBySection.get(teaching.sectionId).map((enrollment) => enrollment.studentId));
    for (const memberId of arrangement.groups.flat()) assert.ok(enrolledIds.has(memberId));
  }
});

test('demo descriptor is denied cloud enqueue and pull by Owner Guard', () => {
  const workspace = demoDescriptor();
  assert.equal(workspace.databaseName, 'rakeezx-demo');
  assert.equal(workspace.syncEligible, false);
  const guard = createSyncOwnershipGuard({ workspace });
  assert.equal(guard.enqueueAccess().allowed, false);
  assert.equal(guard.enqueueAccess().reason, 'demo-sync-disabled');
  assert.equal(guard.cloudAccess().allowed, false);
  assert.equal(guard.cloudAccess().reason, 'demo-sync-disabled');
});
