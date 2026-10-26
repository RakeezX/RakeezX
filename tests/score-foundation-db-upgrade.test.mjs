import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';

const NEW_STORES = ['scoreSubitems', 'scoreSubitemCompletions', 'sectionCurriculumScopes', 'teachingCourseBindings'];

function openLegacyV7(name = db.DB_NAME) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 7);
    request.onupgradeneeded = () => {
      for (const name of db.STORES.filter((store) => !NEW_STORES.includes(store))) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('existing v7 Product item and score survive cumulative v9 upgrade', async () => {
  const legacy = await openLegacyV7();
  const beforeItem = { id: 'v7:item', teachingId: 'v7:teaching', name: 'اختبار', max: 10, updatedAt: 5 };
  const beforeScore = { id: 'v7:score', itemId: beforeItem.id, studentId: 'v7:student', value: 0, updatedAt: 6 };
  const beforeOutbox = { id: 'v7:mutation', store: 'scores', recordId: beforeScore.id,
    state: 'pending', attempts: 2, mutationId: 'v7:mutation' };
  await new Promise((resolve, reject) => {
    const transaction = legacy.transaction(['items', 'scores', 'outbox'], 'readwrite');
    transaction.objectStore('items').put(beforeItem);
    transaction.objectStore('scores').put(beforeScore);
    transaction.objectStore('outbox').put(beforeOutbox);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  legacy.close();
  const upgraded = await db.openDB();
  assert.equal(upgraded.version, 9);
  assert.deepEqual([...upgraded.objectStoreNames].sort(), [...db.STORES].sort());
  assert.deepEqual(await db.get('items', beforeItem.id), beforeItem);
  assert.deepEqual(await db.get('scores', beforeScore.id), beforeScore);
  assert.deepEqual(await db.get('outbox', beforeOutbox.id), beforeOutbox);
  assert.deepEqual(await db.getAll('scoreSubitems'), []);
  assert.deepEqual(await db.getAll('scoreSubitemCompletions'), []);
  for (const name of NEW_STORES) {
    const tx = upgraded.transaction(name, 'readonly');
    assert.equal(tx.objectStore(name).keyPath, 'id');
    assert.deepEqual([...tx.objectStore(name).indexNames], [], 'new stores use the existing ID-key scan contract');
  }
  await db.closeDB();
  const reopened = await db.openDB();
  assert.equal(reopened.version, 9);
  assert.deepEqual(await db.get('outbox', beforeOutbox.id), beforeOutbox,
    'pending command and retry count survive an actual database reopen');
});

test('a fresh v9 database creates the same complete store and key-path contract', async () => {
  await db.closeDB();
  db.selectDatabase('rakeezx-demo');
  const fresh = await db.openDB();
  assert.equal(fresh.version, 9);
  assert.deepEqual([...fresh.objectStoreNames].sort(), [...db.STORES].sort());
  for (const name of NEW_STORES) {
    const tx = fresh.transaction(name, 'readonly');
    assert.equal(tx.objectStore(name).keyPath, 'id');
    assert.deepEqual([...tx.objectStore(name).indexNames], []);
  }
});

test('an aborted v8 upgrade leaves legacy v7 bytes available for later clean v9 upgrade', async () => {
  await db.closeDB();
  const name = 'rakeezx-user-00000000000000000000000000000001';
  const legacy = await openLegacyV7(name);
  await new Promise((resolve, reject) => {
    const tx = legacy.transaction('items', 'readwrite');
    tx.objectStore('items').put({ id: 'interrupted:item', name: 'unchanged', max: 10 });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  legacy.close();
  await assert.rejects(new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 8);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
  const stillV7 = await openLegacyV7(name);
  assert.equal(stillV7.version, 7);
  stillV7.close();
  db.selectDatabase(name);
  const upgraded = await db.openDB();
  assert.equal(upgraded.version, 9);
  assert.deepEqual(await db.get('items', 'interrupted:item'),
    { id: 'interrupted:item', name: 'unchanged', max: 10 });
});

after(async () => { await db.closeDB(); });
