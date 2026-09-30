import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDemoDataset, clearDemoRequest, demoRequestState, isDemoPreparing,
  isDemoRequested, markDemoReady, requestDemo, seedDemoWorkspace,
} from '../src/lib/demo-workspace.js';
import * as db from '../src/lib/db.js';
import { getCalendarPreset } from '../src/lib/calendar-presets.js';
import { createSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { DEFAULT_TIME_PROFILES } from '../src/models.js';
import { demoOutputMarker, markDemoExportRows } from '../src/lib/report-print.js';
import * as store from '../src/store.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('demo marker has explicit preparing and active session states', () => {
  const storage = memoryStorage();
  assert.equal(isDemoRequested(storage), false);
  requestDemo(storage);
  assert.equal(isDemoRequested(storage), true);
  assert.equal(isDemoPreparing(storage), true);
  assert.equal(demoRequestState(storage), 'preparing');
  markDemoReady(storage);
  assert.equal(isDemoPreparing(storage), false);
  assert.equal(demoRequestState(storage), 'active');
  clearDemoRequest(storage);
  assert.equal(isDemoRequested(storage), false);
});

test('deterministic demo dataset is substantial, isolated, and excludes deferred domains', () => {
  const first = createDemoDataset();
  const second = createDemoDataset();
  assert.deepEqual(first, second);
  assert.equal(first.sections.length, 8);
  assert.equal(first.students.length, 184);
  assert.equal(first.enrollments.length, 184);
  assert.equal(first.teachings.length, 8);
  assert.ok(first.attendance.length >= 200);
  assert.ok(first.scores.length >= 400);
  assert.ok(first.logs.length >= 25);
  assert.ok(first.notes.length >= 100);
  assert.equal(first.units.length, 0);
  assert.equal(first.lessons.length, 0);
  assert.equal(first.assignments.length, 0);
  assert.equal(first.submissions.length, 0);
  assert.equal(first.outbox.length, 0);
  assert.equal(first.years[0].calendarPresetId, getCalendarPreset('general').id);
  assert.ok(first.terms.some((term) => term.name === 'الفصل الدراسي الثاني' && term.calendarId === 'demo:calendar:official'));
  assert.equal(first.calendarDays.length, getCalendarPreset('general').holidays.reduce((count, holiday) => count + (Date.parse(holiday.endDate) - Date.parse(holiday.startDate)) / 86400000 + 1, 0));
  assert.equal(new Set(first.calendarDays.map((day) => day.rangeId)).size, getCalendarPreset('general').holidays.length);
  const standardProfileIds = new Set(DEFAULT_TIME_PROFILES.map((profile) => profile.id));
  for (const rows of Object.values(first).filter(Array.isArray)) {
    for (const row of rows) {
      assert.ok(row.id === 'profile' || row.id === 'device' || standardProfileIds.has(row.id) || String(row.id).includes('demo:'), `unexpected demo id: ${row.id}`);
    }
  }
});

test('Demo v3 upgrades its official calendar without erasing local edits, and reset restores the preset', async () => {
  db.selectDatabase('rakeezx-demo');
  const sample = createDemoDataset();
  const oldYear = { id: sample.years[0].id, hijriStart: 1448, status: 'active', updatedAt: 1, deleted: false };
  const oldTerm = { id: sample.terms[0].id, yearId: oldYear.id, index: 1, name: 'الفصل الدراسي الأول', startDate: sample.terms[0].startDate, endDate: sample.terms[0].endDate, calendarId: null, updatedAt: 1, deleted: false };
  const localDay = { id: 'demo:local-day', calendarId: 'demo:calendar', date: '2026-10-14', kind: 'holiday', label: 'إجازة تجريبية محلية', updatedAt: 2, deleted: false };
  await db.writeAll({ meta: [{ id: 'demo:workspace-seed-v3', version: 3 }], years: [oldYear], terms: [oldTerm], calendars: [sample.calendars[0]], calendarDays: [localDay] }, 'replace');
  const upgrade = await seedDemoWorkspace();
  assert.equal(upgrade.upgraded, true);
  assert.deepEqual(await db.get('calendarDays', localDay.id), localDay);
  assert.equal((await db.get('years', oldYear.id)).calendarPresetId, getCalendarPreset('general').id);
  assert.equal((await db.get('terms', oldTerm.id)).calendarId, 'demo:calendar:official');
  assert.equal((await db.getAll('calendarDays')).filter((day) => day.calendarId === 'demo:calendar:official').length, sample.calendarDays.length);
  assert.ok(await db.get('meta', 'demo:workspace-seed-v4'));
  assert.deepEqual(await seedDemoWorkspace(), { seeded: false });
  const reset = await seedDemoWorkspace({ force: true });
  assert.equal(reset.seeded, true);
  assert.equal(await db.get('calendarDays', localDay.id), undefined);
  assert.equal((await db.getAll('calendarDays')).length, sample.calendarDays.length);
  await db.closeDB();
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

  assert.deepEqual(dataset.sections.map((section) => `${section.grade}:${section.label}`).sort(), [
    '4:1', '4:2', '4:3', '5:1', '5:2', '5:3', '6:1', '6:2',
  ]);
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
  const weekdayLoads = new Map();
  for (const teaching of dataset.teachings) {
    const teachingSlots = dataset.slots.filter((slot) => slot.teachingId === teaching.id);
    assert.equal(teachingSlots.length, 2);
    for (const slot of teachingSlots) {
      const key = `${slot.weekday}:${slot.period}`;
      assert.equal(occupied.has(key), false, `teacher schedule collision at ${key}`);
      occupied.add(key);
      weekdayLoads.set(slot.weekday, (weekdayLoads.get(slot.weekday) ?? 0) + 1);
    }
  }
  assert.equal(dataset.slots.length, 16);
  assert.deepEqual([...weekdayLoads.entries()].sort(([a], [b]) => a - b), [[0, 3], [1, 3], [2, 3], [3, 3], [4, 4]]);

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
  for (const snapshot of dataset.sessionRosterSnapshots) {
    assert.ok(sessionIds.has(snapshot.sessionId));
    assert.ok(teachingIds.has(snapshot.teachingId));
    for (const member of snapshot.members) {
      assert.ok(studentIds.has(member.studentId));
      assert.ok(dataset.enrollments.some((enrollment) => enrollment.id === member.enrollmentId && enrollment.studentId === member.studentId));
    }
  }
  for (const note of dataset.notes) {
    assert.ok(studentIds.has(note.studentId));
    assert.ok(teachingIds.has(note.teachingId));
  }
  for (const log of dataset.logs) {
    assert.ok(studentIds.has(log.studentId));
    assert.ok(teachingIds.has(log.teachingId));
    assert.ok(sessionIds.has(log.sessionId));
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

test('external output markers are Demo-only', () => {
  store.activateWorkspace(demoDescriptor());
  assert.match(String(demoOutputMarker()), /بيانات تجريبية/);
  assert.deepEqual(markDemoExportRows([['الطالب']]), [['بيانات تجريبية'], ['الطالب']]);
  store.deactivateWorkspace('test-complete');
  assert.equal(String(demoOutputMarker()), '');
  assert.deepEqual(markDemoExportRows([['الطالب']]), [['الطالب']]);
});
