import 'fake-indexeddb/auto';
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import {
  DEFAULT_TIME_PROFILES, makeEnrollment, makeSection, makeSession, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear,
} from '../src/models.js';

global.document = {
  visibilityState: 'visible',
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
  addEventListener() {},
};
global.matchMedia = () => ({ matches: false });

const authoritative = (record, revision = 1) => ({
  ...record, canonicalId: record.id, serverRevision: revision,
});

async function resetStore() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
}

async function seedRoster() {
  const year = authoritative(makeYear({ id: 'v2e1:year', hijriStart: 1450 }));
  const term = authoritative(makeTerm({ id: 'v2e1:term', yearId: year.id, index: 1 }));
  const subject = authoritative(makeSubject({ id: 'v2e1:subject', name: 'رياضيات', slug: 'math' }));
  const x = authoritative(makeSection({ id: 'v2e1:x', yearId: year.id, grade: 4, label: 'أ' }));
  const y = authoritative(makeSection({ id: 'v2e1:y', yearId: year.id, grade: 4, label: 'ب' }));
  const teaching = authoritative(makeTeaching({
    id: 'v2e1:teaching', sectionId: x.id, subjectId: subject.id, termId: term.id,
  }));
  const a = authoritative(makeStudent({ id: 'v2e1:a', name: 'طالب أ' }));
  const b = authoritative(makeStudent({ id: 'v2e1:b', name: 'طالب ب' }));
  const c = authoritative(makeStudent({ id: 'v2e1:c', name: 'طالب ج' }));
  const enrollments = [
    authoritative(makeEnrollment({ id: 'v2e1:ax', studentId: a.id, sectionId: x.id, rollNo: 1 })),
    authoritative(makeEnrollment({ id: 'v2e1:bx', studentId: b.id, sectionId: x.id, rollNo: 2 })),
    authoritative(makeEnrollment({ id: 'v2e1:cy', studentId: c.id, sectionId: y.id, rollNo: 1 })),
  ];
  const session = authoritative(makeSession({
    id: 'v2e1:session', teachingId: teaching.id, date: '2026-09-06', period: 1, status: 'scheduled',
  }));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [x, y], teachings: [teaching], students: [a, b, c], enrollments, sessions: [session] }, { queue: false });
  return { year, term, subject, x, y, teaching, a, b, c, session };
}

beforeEach(async () => {
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
  await resetStore();
});

test('offline-first foundation creates are explicitly marked as bootstrap work', async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  const outbox = (await db.getAll('outbox')).filter((row) => row.protocol === 'v2');
  assert.ok(outbox.length > 0);
  assert.equal(outbox.every((row) => row.op === 'create' && row.bootstrap === true), true);
  assert.deepEqual(
    store.timeProfiles().map((profile) => profile.id).sort(),
    DEFAULT_TIME_PROFILES.map((profile) => profile.id).sort(),
  );
  assert.deepEqual(
    store.timeProfiles().map((profile) => profile.overrides?.config?.type).sort(),
    ['hybrid', 'ramadan', 'summer', 'winter'],
  );
});

test('retained default Timing Profile tombstones are not recreated during bootstrap', async () => {
  await db.clearAll();
  const deleted = {
    ...DEFAULT_TIME_PROFILES[0],
    order: 0,
    deleted: true,
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put('timeProfiles', deleted);
  store.state.ready = false;
  await store.init();

  assert.equal(store.timeProfiles().length, 0);
  assert.equal(store.state.timeProfiles.length, 1);
  assert.equal(store.state.timeProfiles[0].id, deleted.id);
  assert.equal(store.state.timeProfiles[0].deleted, true);
  assert.equal((await db.getAll('outbox')).some((row) => row.store === 'timeProfiles'), false);
});

test('section creation without an active academic year is rejected before queuing cloud work', async () => {
  await db.clearStore('outbox');
  store.state.years = store.state.years.map((year) => ({ ...year, deleted: true }));

  await assert.rejects(
    store.createSection({ grade: 10, label: 'بلا سنة' }),
    /السنة الدراسية النشطة/,
  );

  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal(store.state.sections.some((section) => section.label === 'بلا سنة'), false);
});

test('reachable store actions emit only V2 generic or specialized mutations', async () => {
  const f = await seedRoster();

  const createdTeaching = await store.createTeaching({ sectionId: f.y.id, subjectId: f.subject.id, termId: f.term.id });
  let rows = await db.getAll('outbox');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].command, 'teaching:create');
  assert.equal(rows.some((row) => row.protocol !== 'v2'), false);
  assert.equal(store.state.items.filter((item) => item.teachingId === createdTeaching.id).length, 5);

  const defaultItem = store.state.items.find((item) => item.teachingId === createdTeaching.id);
  await db.clearStore('outbox');
  await store.setScore(f.c.id, defaultItem.id, 0);
  rows = await db.getAll('outbox');
  assert.equal(rows[0].op, 'create');
  assert.equal(rows[0].localPatch.value, 0);
  await db.clearStore('outbox');
  await store.setScore(f.c.id, defaultItem.id, null);
  rows = await db.getAll('outbox');
  assert.equal(rows[0].localPatch.value, null);

  await db.clearStore('outbox');
  await store.renameStudent(f.a.id, 'طالب أ المعدل');
  rows = await db.getAll('outbox');
  assert.equal(rows[0].op, 'patch');
  assert.deepEqual(rows[0].fields, ['name']);

  await db.clearStore('outbox');
  const slot = await store.addSlot(f.teaching.id, 1, 2);
  rows = await db.getAll('outbox');
  assert.equal(rows[0].op, 'create');
  await db.clearStore('outbox');
  await store.removeSlot(slot.id);
  rows = await db.getAll('outbox');
  assert.equal(rows[0].op, 'delete');

  await db.clearStore('outbox');
  await store.setAttendance(f.session.id, f.a.id, 'present');
  rows = await db.getAll('outbox');
  assert.deepEqual(rows.map((row) => row.command), ['attendance:record']);
  assert.ok(store.sessionRosterSnapshot(f.session.id));

  await db.clearStore('outbox');
  await store.fillAttendance(f.session.id, 'absent');
  rows = await db.getAll('outbox');
  assert.deepEqual(rows.map((row) => row.command), ['attendance:fill']);

  await db.clearStore('outbox');
  await store.transferStudent(f.a.id, f.y.id, { date: '2026-09-06' });
  rows = await db.getAll('outbox');
  assert.deepEqual(rows.map((row) => row.command), ['enrollment:transfer']);
  assert.deepEqual(store.students(createdTeaching.id).map((student) => student.rollNo), [1, 2]);
  assert.deepEqual(store.students(f.teaching.id).map((student) => student.rollNo), [1]);

  await db.clearStore('outbox');
  const itemId = defaultItem.id;
  await store.deleteItem(itemId);
  rows = await db.getAll('outbox');
  assert.deepEqual(rows.map((row) => row.command), ['lifecycle:delete_item']);
  assert.equal(rows.every((row) => row.protocol === 'v2'), true);
});

test('manual roster repair is unreachable while automatic transfer renumber remains active', async () => {
  const source = await readFile(new URL('../src/views/students.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /data-act=["']renumber["']/);
  assert.doesNotMatch(source, /store\.renumberRoster\s*\(/);
  const f = await seedRoster();
  await store.transferStudent(f.a.id, f.y.id);
  assert.deepEqual(store.students(f.teaching.id).map((student) => student.rollNo), [1]);
});

test('enroll/withdraw and Timing Profile writes use their approved V2 paths', async () => {
  const f = await seedRoster();
  const added = await store.addStudent(f.x.id, 'طالب د');
  let rows = await db.getAll('outbox');
  assert.equal(rows.some((row) => row.store === 'students' && row.op === 'create'), true);
  assert.equal(rows.some((row) => row.command === 'enrollment:enroll'), true);
  assert.equal(rows.every((row) => row.protocol === 'v2'), true);

  await db.clearStore('outbox');
  await store.withdrawStudent(added.id, { date: '2026-09-07' });
  rows = await db.getAll('outbox');
  assert.deepEqual(rows.map((row) => row.command), ['enrollment:withdraw']);

  await db.clearStore('outbox');
  const profile = store.state.timeProfiles.find((record) => !record.deleted);
  await store.patch('timeProfiles', profile.id, {
    periods: structuredClone(profile.periods),
    overrides: { ...(profile.overrides ?? {}), gap: 7 },
  });
  rows = await db.getAll('outbox');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].protocol, 'v2');
  assert.equal(rows[0].store, 'timeProfiles');
  assert.deepEqual(rows[0].fields.sort(), ['overrides', 'periods']);
});

class GenericV2Backend {
  constructor() { this.tables = new Map(); this.failNext = false; }
  table(entity) {
    if (!this.tables.has(entity)) this.tables.set(entity, new Map());
    return this.tables.get(entity);
  }
  async fetchRecords(entity) { return structuredClone([...this.table(entity).values()]); }
  async applySyncV2Mutation(envelope) {
    if (this.failNext) { this.failNext = false; throw new Error('temporary test outage'); }
    const table = this.table(envelope.entity);
    const prior = table.get(envelope.recordId);
    const revision = (prior?.revision ?? 0) + 1;
    const canonical = {
      ...(prior ?? {}), id: envelope.recordId, ...structuredClone(envelope.patch), revision,
      field_revisions: Object.fromEntries(Object.keys(envelope.patch).map((field) => [field, revision])),
      deleted_at: envelope.operation === 'delete' ? new Date(envelope.clientUpdatedAt).toISOString() : null,
      client_updated_at: envelope.clientUpdatedAt,
    };
    table.set(canonical.id, canonical);
    return {
      mutationId: envelope.mutationId, entity: envelope.entity, recordId: envelope.recordId,
      canonicalId: canonical.id, outcome: 'applied', appliedGroups: Object.keys(envelope.patch),
      conflictedGroups: [], resultRevision: revision, canonical: structuredClone(canonical),
    };
  }
}

test('V2 coordinator performs quiet automatic sync and manual retry without V1 dispatch', async () => {
  const backend = new GenericV2Backend();
  cloud.setMockBackend(backend);
  cloud.setMockAuth({ id: 'v2e1-owner' }, { access_token: 'test-token' });
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  assert.equal(await sync.syncAll({ full: true }), true);
  assert.equal((await db.getAll('outbox')).filter((row) => row.protocol === 'v2').length, 0);

  sync.init();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const section = await store.createSection({ grade: 5, label: 'تلقائي' });
  await new Promise((resolve, reject) => {
    const until = Date.now() + 4_000;
    const poll = () => {
      if (backend.table('sections').has(section.id)) return resolve();
      if (Date.now() >= until) return reject(new Error('automatic V2 sync did not run'));
      setTimeout(poll, 25);
    };
    poll();
  });

  const retrySection = await store.createSection({ grade: 5, label: 'يدوي' });
  const renderEvents = [];
  const unsubscribe = store.subscribe((_state, update) => renderEvents.push(update.render));
  backend.failNext = true;
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await sync.syncAll({ full: false }), false);
  } finally {
    console.warn = warn;
  }
  assert.equal(await sync.syncAll({ full: false }), true, 'manual retry cancels the scheduled wait and retries immediately');
  assert.ok(backend.table('sections').has(retrySection.id));
  assert.equal((await db.getAll('outbox')).some((row) => row.protocol !== 'v2'), false);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(renderEvents.includes(true), false, 'authoritative revision/status metadata does not repaint the page');

  renderEvents.length = 0;
  const remote = backend.table('sections').get(retrySection.id);
  backend.table('sections').set(retrySection.id, {
    ...remote, name: 'خامس/بعيد', revision: remote.revision + 1,
    field_revisions: { ...remote.field_revisions, name: remote.revision + 1 },
  });
  assert.equal(await sync.syncAll({ full: true }), true);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(renderEvents.includes(true), true, 'a genuine remote field change still reaches the renderer');
  unsubscribe();
});

after(async () => {
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
  store.closeChannel();
  db.closeDB();
});
