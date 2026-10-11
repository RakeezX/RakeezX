import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

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

test('unvalidated direct Delete entry points fail before any local cascade or outbox write', async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  const section = await store.createSection({ grade: 5, label: 'synthetic guard' });
  const teaching = await store.createTeaching({ sectionId: section.id });
  const collections = ['sections', 'teachings', 'items', 'scores', 'slots', 'sessions', 'sessionRosterSnapshots',
    'attendance', 'logs', 'notes', 'students', 'enrollments', 'outbox'];

  for (const [scenario, online] of [['online without a server plan', true], ['offline', false], ['repeat without a server plan', true]]) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } });
    const before = Object.fromEntries(await Promise.all(collections.map(async (name) => [name, await db.getAll(name)])));
    for (const [path, call] of [
      ['subject only', () => store.deleteTeaching(teaching.id)],
      ['whole class', () => store.deleteClass(section.id)],
      ['internal section', () => store.deleteSection(section.id)],
    ]) {
      await assert.rejects(call(), { name: 'Error' }, `${scenario}: ${path}`);
      for (const name of collections) {
        assert.deepEqual(await db.getAll(name), before[name], `${scenario}: ${path} changed ${name}`);
      }
      assert.equal(store.getSection(section.id)?.deleted, false);
      assert.equal(store.getTeaching(teaching.id)?.deleted, false);
    }
  }
});
