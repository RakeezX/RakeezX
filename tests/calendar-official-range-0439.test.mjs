import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { decodeSyncV2Canonical, encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import { getCalendarPreset, officialPresetRangeIdentity } from '../src/lib/calendar-presets.js';
import { shiftDate } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

test('official preset ranges retain exact identity across canonical Sync and a fresh device', async () => {
  try {
    await db.clearAll();
    store.state.ready = false;
    await store.init();
    const year = store.activeYear();
    const calendar = store.calendarsOf(year.id).find((item) => item.source.startsWith('preset:'));
    const preset = getCalendarPreset(calendar.source.slice('preset:'.length));
    const original = store.calendarDaysOf(calendar.id);
    const before = store.calendarRangesOf(year.id).filter((range) => range.calendarId === calendar.id);
    assert.equal(before.length, preset.holidays.length);
    const canonical = original.map((day) => decodeSyncV2Canonical('calendarDays', {
      id: day.id, ...encodeSyncV2Patch('calendarDays', day), revision: 1,
      deleted_at: null, client_updated_at: day.updatedAt,
    }));
    assert.equal(canonical.every((day) => !day.rangeId && !day.rangeStart && !day.rangeEnd), true);
    await db.clearAll();
    await db.putMany('years', [year]);
    await db.putMany('calendars', [calendar]);
    await db.putMany('calendarDays', canonical);
    const persisted = await db.getAll('calendarDays');
    store.state.ready = false;
    await store.init();
    const ranges = store.calendarRangesOf(year.id).filter((range) => range.calendarId === calendar.id);
    assert.equal(ranges.length, preset.holidays.length);
    assert.equal(ranges.filter((range) => range.days.length > 1).length, preset.holidays.filter((holiday) => holiday.startDate !== holiday.endDate).length);
    for (const holiday of preset.holidays) {
      const id = `${preset.id}:${holiday.startDate}`;
      const range = ranges.find((item) => item.id === id);
      assert.ok(range, id);
      let duration = 0;
      for (let date = holiday.startDate; date <= holiday.endDate; date = shiftDate(date, 1)) duration++;
      assert.equal(range.days.length, duration, id);
      assert.equal(range.startDate, holiday.startDate);
      assert.equal(range.endDate, holiday.endDate);
    }
    assert.equal(new Set(ranges.map((range) => range.id)).size, ranges.length);
    assert.deepEqual(await db.getAll('calendarDays'), persisted, 'display reconstruction must not rewrite official rows');
    await assert.rejects(store.saveCalendarRange({ id: ranges[0].id, calendarId: calendar.id,
      startDate: ranges[0].startDate, kind: ranges[0].kind, label: ranges[0].label }), /رسمية/);
    await assert.rejects(store.removeCalendarRange(calendar.id, ranges[0].id), /رسمية/);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('unknown, unexpected and drifted official rows fail safe as independent legacy days', async () => {
  const preset = getCalendarPreset();
  const calendar = { id: 'cal:official:unknown-check', source: `preset:${preset.id}` };
  const holiday = preset.holidays.find((item) => item.startDate !== item.endDate);
  const day = { id: `cd:${calendar.id}:${holiday.startDate}`, calendarId: calendar.id,
    date: holiday.startDate, kind: holiday.kind, label: holiday.label };
  assert.equal(officialPresetRangeIdentity(calendar, day), `${preset.id}:${holiday.startDate}`);
  assert.equal(officialPresetRangeIdentity({ ...calendar, source: 'preset:unknown' }, day), null);
  assert.equal(officialPresetRangeIdentity(calendar, { ...day, date: '2030-01-01' }), null);
  assert.equal(officialPresetRangeIdentity(calendar, { ...day, kind: 'study' }), null);
  assert.equal(officialPresetRangeIdentity(calendar, { ...day, label: 'older preset wording' }), null);
  assert.equal(officialPresetRangeIdentity({ ...calendar, source: 'custom' }, day), null);
  assert.equal(officialPresetRangeIdentity(calendar, { ...day, calendarId: 'other' }), null);
  try {
    await db.clearAll();
    store.state.ready = false;
    await store.init();
    const year = store.activeYear();
    const unknownCalendar = { ...calendar, yearId: year.id, source: 'preset:unknown' };
    store.state.calendars.push(unknownCalendar);
    store.state.calendarDays.push(
      { ...day, calendarId: unknownCalendar.id, date: '2026-09-23', id: 'unknown:1' },
      { ...day, calendarId: unknownCalendar.id, date: '2026-09-24', id: 'unknown:2' },
    );
    const ranges = store.calendarRangesOf(year.id).filter((range) => range.calendarId === unknownCalendar.id);
    assert.deepEqual(ranges.map((range) => range.id), [
      `legacy:${unknownCalendar.id}:unknown:1`, `legacy:${unknownCalendar.id}:unknown:2`,
    ]);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
