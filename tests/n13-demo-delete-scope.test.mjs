import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { seedDemoWorkspace } from '../src/lib/demo-workspace.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { createDemoPackage, demoPackages } from '../src/lib/demo.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('Demo Delete removes one Teaching atomically, then its final Section without sibling or unrelated history loss', async () => {
  store.activateWorkspace(demoDescriptor());
  await seedDemoWorkspace({ force: true });
  await store.init();
  const seeded = store.sections()[0];
  const seededFirst = store.teachings().find((row) => row.sectionId === seeded.id);
  const seededSecond = await store.addSubjectToSection(seeded.id, { token: 'builtin:math' });
  const seededRoster = store.sectionRoster(seeded.id).map((row) => row.id);
  const seededScores = store.state.scores.filter((row) => !row.deleted && store.items(seededFirst.id).some((item) => item.id === row.itemId)).map((row) => row.id);
  await store.deleteDemoTeachingScope(seededSecond.id, seeded.id, 'teaching');
  assert.ok(store.getTeaching(seededFirst.id));
  assert.ok(store.getSection(seeded.id));
  assert.deepEqual(store.sectionRoster(seeded.id).map((row) => row.id), seededRoster);
  assert.ok(seededScores.every((id) => !store.state.scores.find((row) => row.id === id)?.deleted));

  const created = await createDemoPackage();
  const sectionId = created.section.id;
  const firstId = created.teaching.id;
  const second = await store.addSubjectToSection(sectionId, { token: 'builtin:math' });
  const roster = store.sectionRoster(sectionId).map((row) => row.id);
  const other = store.teachings().find((row) => row.sectionId !== sectionId);
  const otherScoreIds = store.state.scores.filter((row) => !row.deleted && store.items(other.id).some((item) => item.id === row.itemId)).map((row) => row.id);
  const firstItems = store.items(firstId).map((row) => row.id);
  const firstSessions = store.state.sessions.filter((row) => row.teachingId === firstId && !row.deleted).map((row) => row.id);
  const firstAttendance = store.state.attendance.filter((row) => firstSessions.includes(row.sessionId) && !row.deleted).map((row) => row.id);
  const secondItems = store.items(second.id).map((row) => row.id);

  await assert.rejects(store.deleteDemoTeachingScope(firstId, sectionId, 'section'), /نطاق الحذف/);
  assert.ok(store.getTeaching(firstId));
  assert.deepEqual(store.sectionRoster(sectionId).map((row) => row.id), roster);

  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (record) {
    if (this.name === 'sessions' && record.id === firstSessions[0] && record.deleted)
      throw new Error('synthetic Demo delete write failure');
    return originalPut.call(this, record);
  };
  try {
    await assert.rejects(store.deleteDemoTeachingScope(firstId, sectionId, 'teaching'), /synthetic Demo delete write failure/);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  assert.ok(store.getTeaching(firstId));
  assert.ok(firstItems.every((id) => !store.state.items.find((row) => row.id === id)?.deleted));
  assert.ok(firstSessions.every((id) => !store.state.sessions.find((row) => row.id === id)?.deleted));
  assert.ok((await demoPackages()).some((row) => row.owned.teachings.includes(firstId)));

  assert.deepEqual(await store.deleteDemoTeachingScope(firstId, sectionId, 'teaching'), { scope: 'teaching' });
  assert.equal(store.getTeaching(firstId), null);
  assert.ok(store.getSection(sectionId));
  assert.ok(store.getTeaching(second.id));
  assert.deepEqual(store.sectionRoster(sectionId).map((row) => row.id), roster);
  assert.deepEqual(store.items(second.id).map((row) => row.id), secondItems);
  for (const [name, ids] of [['items', firstItems], ['sessions', firstSessions], ['attendance', firstAttendance]]) {
    assert.ok(ids.length);
    assert.ok(ids.every((id) => store.state[name].find((row) => row.id === id)?.deleted));
  }
  assert.ok(otherScoreIds.every((id) => !store.state.scores.find((row) => row.id === id)?.deleted));
  assert.ok(seededScores.every((id) => !store.state.scores.find((row) => row.id === id)?.deleted));
  const pkg = (await demoPackages()).find((row) => row.owned.sections.includes(sectionId));
  assert.ok(pkg);
  assert.deepEqual(pkg.owned.teachings, [second.id]);

  await assert.rejects(store.deleteDemoTeachingScope(second.id, sectionId, 'teaching'), /نطاق الحذف/);
  assert.deepEqual(await store.deleteDemoTeachingScope(second.id, sectionId, 'section'), { scope: 'section' });
  assert.equal(store.getSection(sectionId), null);
  assert.equal(store.getTeaching(second.id), null);
  assert.ok(roster.every((id) => !store.getStudent(id)));
  assert.ok(store.getTeaching(other.id));
  assert.ok(otherScoreIds.every((id) => !store.state.scores.find((row) => row.id === id)?.deleted));
  assert.equal((await demoPackages()).some((row) => row.packageId === pkg.packageId), false);
  assert.equal((await db.getAll('outbox')).length, 0);
});
