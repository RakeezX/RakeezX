import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

test('Demo suspension stays local with no Product outbox or cloud access', async () => {
  store.activateWorkspace(demoDescriptor());
  try {
    await db.clearAll();
    store.state.ready = false;
    await store.init();
    const calendar = await store.ensureCalendar(store.activeYear().id, 'custom');
    const id = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-05', kind: 'suspension', label: 'تعليق تجريبي' });
    assert.equal(store.calendarRangesOf().find((range) => range.id === id)?.kind, 'suspension');
    assert.equal((await db.getAll('outbox')).length, 0);
    assert.equal(runtimeSyncOwnershipGuard.cloudAccess().allowed, false);
    assert.equal(runtimeSyncOwnershipGuard.enqueueAccess().allowed, false);
  } finally {
    store.closeChannel();
    await db.closeDB();
    store.deactivateWorkspace('calendar-suspension-0446-demo-done');
  }
});
