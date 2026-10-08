import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { makeEnrollment, makeItem, makeSection, makeSession, makeStudent, makeTeaching } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const account = {
  id: 'account:synthetic', type: 'account', authUserId: owner,
  databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ownershipState: 'claimed',
  syncEligible: true, broadcastChannelName: 'test:n77-guard',
};

async function fixture() {
  const section = makeSection({ id: 'section:n77', yearId: store.activeYear().id, grade: 5, label: '1' });
  const teaching = makeTeaching({ id: 'teaching:n77', sectionId: section.id, subjectId: store.subjects()[0].id, termId: store.activeTerm().id });
  const student = makeStudent({ id: 'student:n77', name: 'Synthetic Student' });
  const enrollment = makeEnrollment({ id: 'enrollment:n77', studentId: student.id, sectionId: section.id, yearId: section.yearId });
  const item = makeItem({ id: 'item:n77', teachingId: teaching.id, name: 'Synthetic Item', maxScore: 10 });
  const session = makeSession({ id: 'session:n77', teachingId: teaching.id, date: '2026-10-08', period: 1 });
  const score = { id: 'score:n77', studentId: student.id, itemId: item.id, value: 8, deleted: false, updatedAt: 1 };
  const attendance = { id: 'attendance:n77', studentId: student.id, sessionId: session.id, teachingId: teaching.id, date: session.date, status: 'present', deleted: false, updatedAt: 1 };
  await store.save({ sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [item], sessions: [session], scores: [score], attendance: [attendance] }, { queue: false });
  await db.clearStore('outbox');
  return { section, teaching };
}

const watched = ['sections', 'teachings', 'students', 'enrollments', 'items', 'sessions', 'scores', 'attendance', 'outbox'];
async function snapshot() {
  return Object.fromEntries(await Promise.all(watched.map(async (name) => [name, await db.getAll(name)])));
}

test('account legacy class and Teaching Delete fail before local or queued writes, online and offline', async () => {
  store.activateWorkspace(account);
  cloud.setMockAuth({ id: owner, email: 'synthetic@example.test' }, { access_token: 'synthetic' });
  try {
    await db.clearAll();
    await store.init();
    const { section, teaching } = await fixture();
    const rejected = { id: 'v2:n77-rejected', state: 'rejected', command: 'lifecycle:delete_class', recordId: section.id };
    await db.put('outbox', rejected);
    for (const online of [true, false]) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } });
      const beforeDb = await snapshot();
      const beforeMemory = Object.fromEntries(watched.filter((name) => name !== 'outbox').map((name) => [name, structuredClone(store.state[name])]));
      for (const action of [() => store.deleteClass(section.id), () => store.deleteTeaching(teaching.id), () => store.deleteSection(section.id)]) {
        await assert.rejects(action(), (error) => error.code === 'N77_CLIENT_UPDATE_REQUIRED' && /حدّث ركيز/.test(error.message));
      }
      assert.deepEqual(await snapshot(), beforeDb);
      for (const [name, rows] of Object.entries(beforeMemory)) assert.deepEqual(store.state[name], rows, `${name} changed`);
    }
    await store.patch('sections', section.id, { color: '#123456' });
    assert.equal(store.getSection(section.id).color, '#123456');
    assert.deepEqual(await db.get('outbox', rejected.id), rejected);
  } finally {
    cloud.setMockAuth(null, null);
    store.deactivateWorkspace('n77-account-test-done');
  }
});

test('isolated Demo keeps its existing local class deletion path', async () => {
  store.activateWorkspace(demoDescriptor());
  try {
    await db.clearAll();
    await store.init();
    const section = makeSection({ id: 'section:demo-n77', yearId: store.activeYear().id, grade: 5, label: '1' });
    await store.save({ sections: [section] }, { queue: false });
    assert.equal(await store.deleteClass(section.id), true);
    assert.equal(store.getSection(section.id), null);
    assert.deepEqual(await db.getAll('outbox'), []);
  } finally {
    store.deactivateWorkspace('n77-demo-test-done');
  }
});
