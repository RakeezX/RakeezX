import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { n77Account } from './n77-fixture.mjs';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import { makeSection, makeTeaching } from '../src/models.js';

test('N97 storage rejection after server receipt retains checkpoint, local records and actionable hard failure', async () => {
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
    querySelector: () => ({ setAttribute() {} }) };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: owner }));
    throw new Error(`Unexpected synthetic network call: ${url}`);
  };
  let handle, nativeTransaction;
  try {
    await n77Account(owner);
    await store.save({ sections: [makeSection({ id: 'storage-section', yearId: 'year', grade: 4, label: 'S' })],
      teachings: [makeTeaching({ id: 'storage-teaching', sectionId: 'storage-section', subjectId: 'subject', termId: 'term' })] }, { queue: false });
    await db.clearStore('outbox');
    handle = await db.openDB(); nativeTransaction = handle.transaction;
    let denyStorage = false;
    handle.transaction = function(stores, mode, ...rest) {
      if (denyStorage && mode === 'readwrite') throw new DOMException('Synthetic disk quota rejection', 'QuotaExceededError');
      return nativeTransaction.call(this, stores, mode, ...rest);
    };
    const plan = { ownerId: owner, selectedTeachingId: 'storage-teaching', sectionId: 'storage-section',
      scope: 'section', fingerprint: 'storage-scope', teachingIds: ['storage-teaching'] };
    cloud.setMockBackend({ n77DeleteTeaching: async input => {
      if (!input.commit) return plan;
      denyStorage = true;
      return { ...plan, outcome: 'deleted', mutationId: input.mutationId,
        cascadeTeachingIds: ['storage-teaching'], orphanStudentIds: [] };
    } });
    await assert.rejects(store.deleteTeaching('storage-teaching', await store.previewDeleteTeaching('storage-teaching')), /تعذّر تأكيد نتيجة الحذف/);
    assert.equal((await db.get('teachings', 'storage-teaching')).deleted, false);
    assert.ok((await db.get('device', 'device')).n77DeleteIntent);
    assert.deepEqual(await db.getAll('outbox'), []);
    const summary = await sync.getSyncOperationalSummary();
    assert.equal(summary.state, 'error');
    assert.equal(summary.presentationSeverity.hardFailure, true);
    assert.equal(summary.classDeletionInFlight, false);
    assert.equal(summary.safeToContinueUnrelatedWork, false);
    assert.equal(summary.cloudSyncHealthy, false);
  } finally {
    if (handle) handle.transaction = nativeTransaction;
    cloud.setMockBackend(null); cloud.setMockAuth(null, null);
    store.deactivateWorkspace(); db.closeDB();
  }
});
