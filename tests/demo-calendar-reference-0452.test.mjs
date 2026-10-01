import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';

import * as db from '../src/lib/db.js';
import { calendarPresetRecords, getCalendarPreset } from '../src/lib/calendar-presets.js';
import { createDemoDataset, DEMO_SEED_ID, seedDemoWorkspace } from '../src/lib/demo-workspace.js';

function assertOfficialReference(dataset) {
  const official = calendarPresetRecords(getCalendarPreset());
  const year = dataset.years[0];
  const calendar = dataset.calendars[0];
  assert.equal(year.calendarPresetId, official.year.calendarPresetId);
  assert.equal(year.calendarRegion, official.year.calendarRegion);
  assert.equal(year.startDate, official.year.startDate);
  assert.equal(year.endOfYearVacationStart, official.year.endOfYearVacationStart);
  assert.equal(calendar.source, official.calendar.source);
  assert.equal(calendar.presetId, official.calendar.presetId);
  assert.deepEqual(dataset.terms.map(({ index, name, startDate, endDate }) => ({ index, name, startDate, endDate })),
    official.terms.map(({ index, name, startDate, endDate }) => ({ index, name, startDate, endDate })));
  assert.deepEqual(dataset.calendarDays.map(({ date, kind, label, presetId }) => ({ date, kind, label, presetId })),
    official.calendarDays.map(({ date, kind, label, presetId }) => ({ date, kind, label, presetId })));
  assert.ok(dataset.calendarDays.length > 0);
  assert.ok(dataset.terms.every((term) => term.yearId === year.id && term.calendarId === calendar.id));
  assert.ok(dataset.calendarDays.every((day) => day.calendarId === calendar.id));
  assert.ok(dataset.sections.every((section) => section.yearId === year.id));
  assert.ok(dataset.teachings.every((teaching) => teaching.termId === dataset.terms[0].id));
  assert.equal(dataset.outbox.length, 0);
}

test('fresh Demo reference data comes from the Product default Calendar preset', async () => {
  const dataset = createDemoDataset();
  assertOfficialReference(dataset);
  db.selectDatabase('rakeezx-demo');
  await seedDemoWorkspace({ force: true });
  const persisted = Object.fromEntries(await Promise.all(['years', 'terms', 'calendars', 'calendarDays', 'sections', 'teachings', 'outbox']
    .map(async (name) => [name, await db.getAll(name)])));
  assertOfficialReference(persisted);
  assert.equal((await db.get('meta', DEMO_SEED_ID)).version, 4);
  await db.closeDB();
});

test('existing v3 Demo receives official Calendar references without resetting sample content', async () => {
  db.selectDatabase('rakeezx-demo');
  const legacy = createDemoDataset();
  legacy.meta = [{ id: 'demo:workspace-seed-v3', version: 3, updatedAt: 1 }];
  legacy.years = [{ ...legacy.years[0], label: 'سنة تجريبية', calendarPresetId: null, calendarRegion: null }];
  legacy.terms = [{ ...legacy.terms[0], startDate: '2026-08-23', calendarId: null },
    { id: 'demo:term:past', yearId: legacy.years[0].id, index: 2, name: 'فصل تجريبي مكتمل', updatedAt: 1 }];
  legacy.calendars = [{ ...legacy.calendars[0], source: 'custom', label: 'التقويم التجريبي' }];
  legacy.calendarDays = [];
  await db.writeAll(legacy, 'replace');
  const score = { ...legacy.scores[0], value: 7, updatedAt: legacy.scores[0].updatedAt + 1 };
  await db.put('scores', score);
  const before = {
    students: await db.getAll('students'),
    sessions: await db.getAll('sessions'),
    attendance: await db.getAll('attendance'),
  };
  const result = await seedDemoWorkspace();
  assert.equal(result.upgraded, true);
  const persisted = Object.fromEntries(await Promise.all(['years', 'terms', 'calendars', 'calendarDays', 'sections', 'teachings', 'outbox']
    .map(async (name) => [name, await db.getAll(name)])));
  assertOfficialReference(persisted);
  assert.equal(await db.get('terms', 'demo:term:past'), undefined);
  assert.equal((await db.get('scores', score.id)).value, 7);
  for (const [name, rows] of Object.entries(before)) assert.deepEqual(await db.getAll(name), rows);
  assert.equal((await db.get('meta', DEMO_SEED_ID)).version, 4);
  assert.deepEqual(await seedDemoWorkspace(), { seeded: false });
  await db.closeDB();
});

test('Demo upgrade preserves a legacy term when a local teaching still references it', async () => {
  db.selectDatabase('rakeezx-demo');
  const legacy = createDemoDataset();
  legacy.meta = [{ id: 'demo:workspace-seed-v3', version: 3, updatedAt: 1 }];
  legacy.terms.push({ id: 'demo:term:past', yearId: legacy.years[0].id, index: 3,
    name: 'فصل تجريبي مكتمل', updatedAt: 1 });
  const teaching = { ...legacy.teachings[0], id: 'demo:teaching:legacy', termId: 'demo:term:past' };
  legacy.teachings.push(teaching);
  await db.writeAll(legacy, 'replace');
  assert.equal((await seedDemoWorkspace()).upgraded, true);
  assert.equal((await db.get('terms', 'demo:term:past')).id, 'demo:term:past');
  assert.equal((await db.get('teachings', teaching.id)).termId, 'demo:term:past');
  assert.equal((await db.getAll('outbox')).length, 0);
  await db.closeDB();
});
