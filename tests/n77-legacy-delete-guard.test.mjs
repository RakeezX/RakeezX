import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

const originalDocument = globalThis.document;
const originalMatchMedia = globalThis.matchMedia;
const originalNavigator = globalThis.navigator;
globalThis.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
globalThis.matchMedia = () => ({ matches: false });

after(() => {
  store.closeChannel();
  db.closeDB();
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalMatchMedia === undefined) delete globalThis.matchMedia;
  else globalThis.matchMedia = originalMatchMedia;
  if (originalNavigator === undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
});

test('legacy and ownerless Delete attempts preserve Product rows and rejected outbox evidence', async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  const section = await store.createSection({ grade: 5, label: 'synthetic guard' });
  const teaching = await store.createTeaching({ sectionId: section.id });
  const rejected = { id: 'synthetic:rejected-delete', state: 'rejected', command: 'lifecycle:delete_class', recordId: section.id };
  await db.put('outbox', rejected);
  const watched = ['sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'slots',
    'sessions', 'attendance', 'notes', 'outbox'];

  for (const online of [true, false]) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } });
    const before = Object.fromEntries(await Promise.all(watched.map(async (name) => [name, await db.getAll(name)])));
    for (const call of [
      () => store.deleteTeaching(teaching.id),
      () => store.deleteClass(section.id),
      () => store.deleteSection(section.id),
    ]) {
      await assert.rejects(call(), { name: 'Error' });
      for (const name of watched) assert.deepEqual(await db.getAll(name), before[name], `${name} changed`);
    }
    assert.deepEqual(await db.get('outbox', rejected.id), rejected);
  }

  store.deactivateWorkspace('n77-claimed-test-done');
  store.activateWorkspace({ type: 'account', ownershipState: 'unresolved', syncEligible: false,
    authUserId: null, databaseName: 'rakeezx-user-cccccccccccccccccccccccccccccccc', broadcastChannelName: 'n77-ownerless-test' });
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    const before = await db.getAll('outbox');
    await assert.rejects(() => store.previewDeleteTeaching(teaching.id), { name: 'Error' });
    await assert.rejects(() => store.deleteTeaching(teaching.id), { name: 'Error' });
    assert.deepEqual(await db.getAll('outbox'), before);
  } finally {
    store.deactivateWorkspace('n77-ownerless-test-done');
  }
});
