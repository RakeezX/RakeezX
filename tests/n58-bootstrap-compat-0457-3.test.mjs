import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { installRealtimeFixture } from './helpers/realtime-server-fixture.mjs';
import { lifecycleServer, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';
import { setMockBackend, setMockAuth } from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

for (const current of [false, true]) {
  test(`fresh unselected bootstrap drains its outbox against ${current ? 'N03 then N58' : 'released N03 contract'}`, async () => {
    let pg;
    try {
      setMockAuth(null, null);
      pg = await lifecycleServer({ migration32: true });
      if (current) {
        await pg.exec('create role service_role;');
        await installRealtimeFixture(pg);
      }
      const directory = new URL('../supabase/migrations/', import.meta.url);
      const names = (await readdir(directory)).filter(name => name.endsWith('.sql') && name <= '20261004070002_n58_effective_scope_revalidation.sql').sort();
      const n03 = names.find(name => name.includes('_n03_education_department.sql'));
      assert.ok(n03);
      const pendingMigrations = names.filter(name => {
        const number = Number(name.slice(0, 4));
        return number > 26 && ![29, 30, 32].includes(number) && name !== n03;
      });
      const n58 = pendingMigrations.filter(name => name.includes('_n58_'));
      for (const name of current ? [...pendingMigrations.filter(name => !n58.includes(name)), n03, ...n58] : [n03])
        await pg.exec((await readFile(new URL(name, directory), 'utf8')).replace(/^\uFEFF/, ''));
      const backend = new LifecycleBackend(pg);
      setMockBackend(backend);
      await db.clearAll();
      store.state.ready = false;
      await store.init();
      assert.ok(store.state.years.every(y => y.calendarPresetId == null), 'initialization does not select a preset');
      setMockAuth({ id: OWNER }, { access_token: 'synthetic-bootstrap' });
      sync.state.status = 'idle';
      assert.equal(await sync.syncAll({ full: true }), true);
      const pending = await db.getAll('outbox');
      console.log(JSON.stringify({ contract: current ? 'N58' : 'pre-N58', pending: pending.length, errors: pending.filter(r => r.lastError).map(r => ({ store: r.store, patch: r.patch, error: r.lastError })) }));
      assert.equal(pending.length, 0, 'bootstrap retains no rejected official Calendar or blocked dependent days');
      assert.ok((await backend.fetchRecords('calendar_days')).length > 0);
      assert.ok((await backend.fetchRecords('years')).every(y => y.calendar_preset_id == null));
    } finally {
      setMockAuth(null, null);
      setMockBackend(null);
      await pg?.close();
    }
  });
}

test('custom scope fields and source-free date patches retain their N58 transport authority', () => {
  const dates = { t: { startDate: '2027-07-01', endDate: '2027-07-05' } };
  const custom = encodeSyncV2Patch('calendars', { source: 'custom', presetId: 'sa-general-1448-1449', termDateOverrides: dates });
  assert.equal(custom.preset_id, 'sa-general-1448-1449');
  assert.deepEqual(custom.term_date_overrides.t, { start_date: '2027-07-01', end_date: '2027-07-05' });
  assert.deepEqual(encodeSyncV2Patch('calendars', { termDateOverrides: dates }).term_date_overrides, custom.term_date_overrides);
  for (const source of ['moe', 'preset:sa-western-1448-1449']) {
    const official = { source, presetId: 'sa-western-1448-1449', termDateOverrides: dates };
    assert.deepEqual(encodeSyncV2Patch('calendars', official), { source: 'moe' });
    assert.equal(official.presetId, 'sa-western-1448-1449', 'local legacy metadata remains intact');
    assert.deepEqual(official.termDateOverrides, dates);
  }
});

test.after(async () => { await db.closeDB(); await store.closeChannel(); });
