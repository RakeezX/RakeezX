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

test('N13 Product add-subject lookup accepts seeded and new Demo Sections', async () => {
  store.activateWorkspace(demoDescriptor());
  await seedDemoWorkspace({ force: true });
  await store.init();

  const seeded = store.sections()[0];
  const created = await createDemoPackage();
  const packageBefore = (await demoPackages()).find((pkg) => pkg.owned.sections.includes(created.section.id));
  assert.ok(packageBefore);
  assert.equal((await db.get('meta', 'demo:packages')).packages.some((pkg) => pkg.owned.sections.includes(seeded.id)), false);

  for (const section of [seeded, created.section]) {
    const rosterBefore = store.sectionRoster(section.id).map((student) => student.id);
    const first = store.teachings().find((teaching) => teaching.sectionId === section.id);
    const firstItems = store.items(first.id).map((item) => item.id);
    const added = await store.addSubjectToSection(section.id, { token: 'builtin:math' });
    assert.equal(added.sectionId, section.id);
    assert.notEqual(added.id, first.id);
    assert.match(added.id, /^demo:/);
    assert.equal(store.teachings().filter((teaching) => teaching.sectionId === section.id).length, 2);
    assert.deepEqual(store.sectionRoster(section.id).map((student) => student.id), rosterBefore);
    assert.deepEqual(store.students(added.id).map((student) => student.id), rosterBefore);
    assert.deepEqual(store.items(first.id).map((item) => item.id), firstItems);
    assert.equal(store.items(added.id).length, 5);
    assert.ok(store.items(added.id).every((item) => item.teachingId === added.id && item.id.startsWith('demo:')));
  }

  const packageAfter = (await demoPackages()).find((pkg) => pkg.packageId === packageBefore.packageId);
  assert.equal(packageAfter.owned.teachings.length, packageBefore.owned.teachings.length + 1);
  assert.equal(packageAfter.owned.items.length, packageBefore.owned.items.length + 5);
  assert.equal((await db.getAll('outbox')).length, 0);
});
