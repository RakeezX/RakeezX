import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createDemoPackage, demoPackages } from '../src/lib/demo.js';
import { makeEnrollment, makeStudent } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

after(() => { store.closeChannel(); db.closeDB(); });

async function fixture() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  const year = store.activeYear();
  const term = store.activeTerm();
  const section = await store.createSection({ yearId: year.id, grade: 4, label: `N13-${Date.now()}` });
  const firstSubject = await store.createSubject({ name: 'N13 first', slug: `n13-first-${Date.now()}` });
  const first = await store.createTeaching({ sectionId: section.id, subjectId: firstSubject.id, termId: term.id });
  const student = makeStudent({ name: 'Synthetic Student' });
  const enrollment = makeEnrollment({ studentId: student.id, sectionId: section.id, yearId: year.id, rollNo: 1 });
  await store.save({ students: [student], enrollments: [enrollment] }, { queue: false });
  return { year, term, section, first, student, enrollment };
}

test('N13 attaches a second Teaching to one durable Section and roster, then reloads', async () => {
  const f = await fixture();
  const before = structuredClone(store.sectionRoster(f.section.id));
  const second = await store.addSubjectToSection(f.section.id, { token: 'builtin:math' });
  assert.notEqual(second.id, f.first.id);
  assert.equal(second.sectionId, f.section.id);
  assert.equal(store.sections(f.year.id).filter((row) => row.id === f.section.id).length, 1);
  assert.deepEqual(store.sectionRoster(f.section.id), before);
  assert.deepEqual(store.students(second.id).map((row) => row.id), [f.student.id]);
  assert.equal(store.items(second.id).length, 5);
  assert.equal(store.items(f.first.id).length, 5);
  assert.ok(store.items(second.id).every((item) => item.teachingId === second.id));
  assert.ok(store.items(f.first.id).every((item) => item.teachingId === f.first.id));

  store.state.ready = false;
  await store.init();
  assert.equal(store.getTeaching(second.id)?.sectionId, f.section.id);
  assert.deepEqual(store.sectionRoster(f.section.id).map((row) => row.id), [f.student.id]);
  assert.equal((await db.getAll('enrollments')).filter((row) => row.sectionId === f.section.id).length, 1);
});

test('N13 rejects duplicate, invalid and unavailable targets without partial records', async () => {
  const f = await fixture();
  const second = await store.addSubjectToSection(f.section.id, { token: 'builtin:math' });
  const before = Object.fromEntries(['subjects', 'sections', 'teachings', 'items', 'enrollments', 'outbox']
    .map((name) => [name, structuredClone(name === 'outbox' ? [] : store.state[name])]));
  await assert.rejects(store.addSubjectToSection(f.section.id, { token: 'builtin:math' }), /موجودة بالفعل/);
  await assert.rejects(store.addSubjectToSection(f.section.id, { token: 'custom', customName: 'رياضيات' }), /موجودة بالفعل/);
  await assert.rejects(store.addSubjectToSection(f.section.id, { token: 'builtin:does-not-exist' }), /اختر مادة/);
  await assert.rejects(store.addSubjectToSection('section:foreign-owner', { token: 'builtin:science' }), /غير متاح/);
  assert.equal(store.getTeaching(second.id)?.sectionId, f.section.id);
  for (const name of ['subjects', 'sections', 'teachings', 'items', 'enrollments']) {
    assert.deepEqual(store.state[name], before[name], `${name} changed after rejected add`);
  }
});

test('N13 rolls back subject, Teaching and default items when the local transaction fails', async () => {
  const f = await fixture();
  const before = Object.fromEntries(['subjects', 'teachings', 'items', 'sections', 'enrollments']
    .map((name) => [name, structuredClone(store.state[name])]));
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, ...args) {
    if (this.name === 'items') throw new Error('synthetic item write failure');
    return originalPut.call(this, value, ...args);
  };
  try {
    await assert.rejects(
      store.addSubjectToSection(f.section.id, { token: 'custom', customName: 'Synthetic N13 new subject' }),
      /تعذّر إضافة المادة/,
    );
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  for (const name of Object.keys(before)) {
    assert.deepEqual(store.state[name], before[name], `${name} changed in memory`);
    const byId = (rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(byId(await db.getAll(name)), byId(before[name]), `${name} changed on disk`);
  }
});

test('N13 Demo second subject stays local and its package owns the added Teaching', async () => {
  await fixture();
  const { section } = await createDemoPackage();
  const before = store.sectionRoster(section.id).map((row) => row.id);
  const second = await store.addSubjectToSection(section.id, { token: 'builtin:science' });
  assert.match(second.id, /^demo:/);
  assert.deepEqual(store.sectionRoster(section.id).map((row) => row.id), before);
  assert.equal(store.items(second.id).length, 5);
  assert.ok(store.items(second.id).every((item) => item.id.startsWith('demo:')));
  const pkg = (await demoPackages()).find((row) => row.owned.sections.includes(section.id));
  assert.ok(pkg.owned.teachings.includes(second.id));
  assert.ok(store.state.teachings.filter((row) => !row.deleted && row.sectionId === section.id).length === 2);
  assert.equal((await db.getAll('outbox')).some((entry) => entry.recordId === second.id), false);
});
