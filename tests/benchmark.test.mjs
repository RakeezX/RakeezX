import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = {
  documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } },
  querySelector: () => ({ setAttribute: () => {} })
};
global.matchMedia = () => ({ matches: false });

import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import { setMockBackend, setMockAuth } from '../src/lib/cloud.js';

class MockCloudBackend {
  constructor() {
    this.records = {};
  }
  async fetchRecords(tableName) {
    return this.records[tableName] || [];
  }
  async upsertRecords(tableName, records) {
    if (!this.records[tableName]) this.records[tableName] = [];
    const table = this.records[tableName];
    for (const rec of records) {
      const idx = table.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        table[idx] = { ...rec, client_updated_at: rec.client_updated_at || Date.now() };
      } else {
        table.push({ ...rec, client_updated_at: rec.client_updated_at || Date.now() });
      }
    }
    return { success: true };
  }
}

// Cleanup after ALL benchmark tests complete to close the IndexedDB and BroadcastChannel.
// Without this, Node's event loop stays alive indefinitely.
after(async () => {
  store.closeChannel();
  db.closeDB();
});

test('Boot time benchmark', async () => {
  // Isolated setup: fresh backend and clear DB before this test.
  const backend = new MockCloudBackend();
  setMockBackend(backend);
  setMockAuth({ id: 'test' }, {});
  db.closeDB();
  await db.clearAll();
  await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });

  // Seed DB with many records
  const startWrite = Date.now();
  for (let i = 0; i < 1000; i++) {
    await db.put('students', { id: `std${i}`, name: `Student ${i}`, status: 'active', updatedAt: startWrite });
    await db.put('attendance', { id: `att${i}`, studentId: `std${i}`, sessionId: 'ses1', teachingId: 'tch1', date: '2026-08-01', status: 'present', updatedAt: startWrite });
  }

  const startBoot = Date.now();
  await store.init();
  const bootMs = Date.now() - startBoot;

  console.log(`[Benchmark] Boot time for 2000 records: ${bootMs}ms`);

  assert.ok(bootMs < 1000, 'Boot time should be under 1 second for 2000 records');
});

test('Sync time benchmark', async () => {
  // Isolated setup: fresh backend and clear DB before this test.
  const backend = new MockCloudBackend();
  setMockBackend(backend);
  setMockAuth({ id: 'test' }, {});
  db.closeDB();
  await db.clearAll();
  await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
  await store.init();

  // Seed Cloud with many records
  const startWrite = Date.now();
  backend.records['students'] = [];
  backend.records['attendance'] = [];
  backend.records['sessions'] = [{ id: 'ses1', teaching_id: 'tch1', date: '2026-08-01', period: 1, status: 'scheduled', client_updated_at: startWrite }];
  backend.records['teachings'] = [{ id: 'tch1', subject_id: 'sub1', section_id: 'sec1', client_updated_at: startWrite }];
  for (let i = 0; i < 500; i++) {
    backend.records['students'].push({ id: `remote_std${i}`, name: `Remote Student ${i}`, status: 'active', client_updated_at: startWrite });
    backend.records['attendance'].push({ id: `remote_att${i}`, student_id: `remote_std${i}`, session_id: 'ses1', teaching_id: 'tch1', date: '2026-08-01', status: 'present', client_updated_at: startWrite });
  }

  const startSync = Date.now();
  await sync.syncStructural();
  await sync.syncStudents();
  await sync.syncTimetable();
  const syncMs = Date.now() - startSync;

  console.log(`[Benchmark] Full sync time for 1000 pulled records: ${syncMs}ms`);

  assert.ok(syncMs < 1500, 'Sync time should be reasonable');
});
