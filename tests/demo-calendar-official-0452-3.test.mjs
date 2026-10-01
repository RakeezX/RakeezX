import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { applyDemoCalendarPreset, createDemoDataset, seedDemoWorkspace } from '../src/lib/demo-workspace.js';
import { calendarPresetRecords, getCalendarPreset, GENERAL_1448_1449_PRESET_ID,
  WESTERN_1448_1449_PRESET_ID } from '../src/lib/calendar-presets.js';
import { demoDescriptor } from '../src/lib/workspaces.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

const historicalStores = ['students', 'teachings', 'sections', 'scores', 'sessions', 'attendance'];

async function counts() {
  const [years, terms, calendars, days, outbox] = await Promise.all(
    ['years', 'terms', 'calendars', 'calendarDays', 'outbox'].map((name) => db.getAll(name)));
  return {
    years: years.filter((row) => !row.deleted),
    terms: terms.filter((row) => !row.deleted),
    calendars: calendars.filter((row) => !row.deleted),
    days: days.filter((row) => !row.deleted),
    outbox,
  };
}

function assertReference(actual, presetId) {
  const preset = getCalendarPreset(presetId);
  const reference = calendarPresetRecords(preset);
  assert.deepEqual(actual.years.map((row) => row.id), ['demo:year:1448']);
  assert.equal(actual.years[0].calendarPresetId, presetId);
  assert.deepEqual(actual.terms.map((row) => row.id), ['demo:term:1', 'demo:term:2']);
  assert.deepEqual(actual.terms.map((row) => [row.startDate, row.endDate]),
    reference.terms.map((row) => [row.startDate, row.endDate]));
  assert.deepEqual(actual.calendars.map((row) => row.id), ['demo:calendar']);
  assert.equal(actual.calendars[0].source, `preset:${presetId}`);
  assert.equal(actual.days.length, reference.calendarDays.length);
  assert.equal(actual.days.some((row) => row.date === '2026-09-23' && row.kind === 'national'), true);
  assert.equal(actual.outbox.length, 0);
}

test('fresh and upgraded Demo use official Calendar data with stable local identities and history', async () => {
  store.activateWorkspace(demoDescriptor());
  try {
    await db.clearAll();
    await seedDemoWorkspace({ force: true });
    assertReference(await counts(), WESTERN_1448_1449_PRESET_ID);

    // Simulate the shipped v3 Demo; the upgrade must change Calendar records only.
    const old = createDemoDataset();
    old.meta = [{ id: 'demo:workspace-seed-v3', version: 3, seededAt: 1, updatedAt: 1, deleted: false }];
    old.terms = [old.terms[0], { ...old.terms[1], id: 'demo:term:past', name: 'فصل تجريبي مكتمل',
      startDate: '2026-01-01', endDate: '2026-05-31', status: 'closed' }];
    old.years[0].calendarPresetId = undefined;
    old.calendars[0].source = 'custom';
    old.calendarDays = [];
    old.device[0].preferredEducationRegion = undefined;
    await db.writeAll(old, 'replace');
    const historyBefore = Object.fromEntries(await Promise.all(historicalStores.map(async (name) =>
      [name, await db.getAll(name)])));
    const upgrade = await seedDemoWorkspace();
    assert.equal(upgrade.upgraded, true);
    assertReference(await counts(), WESTERN_1448_1449_PRESET_ID);
    assert.equal((await db.get('terms', 'demo:term:past')).deleted, true);
    for (const name of historicalStores) assert.deepEqual(await db.getAll(name), historyBefore[name], name);

    await store.init();
    for (const presetId of [GENERAL_1448_1449_PRESET_ID, WESTERN_1448_1449_PRESET_ID,
      GENERAL_1448_1449_PRESET_ID, WESTERN_1448_1449_PRESET_ID]) {
      assert.equal((await applyDemoCalendarPreset(presetId)).ok, true);
      assertReference(await counts(), presetId);
      assert.equal(store.state.device.preferredEducationRegion, presetId);
      for (const name of historicalStores) assert.deepEqual(await db.getAll(name), historyBefore[name], name);
    }

    store.deactivateWorkspace('demo-calendar-reload');
    store.activateWorkspace(demoDescriptor());
    assert.equal((await seedDemoWorkspace()).seeded, false);
    await store.init();
    assertReference(await counts(), WESTERN_1448_1449_PRESET_ID);
    assert.equal(store.state.device.preferredEducationRegion, WESTERN_1448_1449_PRESET_ID);
  } finally {
    store.closeChannel();
    store.deactivateWorkspace('demo-calendar-test-done');
  }
});

test('upgrading a Demo retains a legacy term referenced by historical teaching', async () => {
  store.activateWorkspace(demoDescriptor());
  try {
    await db.clearAll();
    const old = createDemoDataset();
    old.meta = [{ id: 'demo:workspace-seed-v3', version: 3, seededAt: 1, updatedAt: 1, deleted: false }];
    old.terms = [old.terms[0], { ...old.terms[1], id: 'demo:term:past', name: 'فصل تجريبي مكتمل' }];
    old.teachings[0].termId = 'demo:term:past';
    old.calendarDays = [];
    await db.writeAll(old, 'replace');
    await seedDemoWorkspace();
    assert.equal((await db.get('terms', 'demo:term:past')).deleted, false);
    assert.equal((await db.get('teachings', old.teachings[0].id)).termId, 'demo:term:past');
    assert.equal((await db.getAll('terms')).filter((term) => !term.deleted).length, 3);
  } finally {
    store.closeChannel();
    store.deactivateWorkspace('demo-calendar-history-test-done');
  }
});
