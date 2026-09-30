import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { PGlite } from '@electric-sql/pglite';
import { buildBackup, restoreBackup, validateBackupIntegrity } from '../src/lib/export.js';
import { calendarRangeIdentity } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

test('range parser uses exact calendar/date boundaries and never guesses legacy grouping', () => {
  const calendarId = 'cal:year:custom';
  const date = '2026-10-05';
  const modern = { calendarId, date, id: `cd:${calendarId}:range:with:colon:${date}` };
  assert.equal(calendarRangeIdentity(modern), 'range:with:colon');
  assert.equal(calendarRangeIdentity({ ...modern, rangeId: 'stored:identity' }), 'stored:identity');
  const legacy = { calendarId, date, id: `cd:${calendarId}:${date}` };
  assert.equal(calendarRangeIdentity(legacy), `legacy:${calendarId}:${legacy.id}`);
  const malformed = { calendarId, date, id: `cd:${calendarId}:different-date:2026-10-06` };
  assert.equal(calendarRangeIdentity(malformed), `legacy:${calendarId}:${malformed.id}`);
  assert.notEqual(calendarRangeIdentity(legacy), calendarRangeIdentity({ ...legacy, id: `${legacy.id}:other` }));
});

async function setup() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  return store.ensureCalendar(store.activeYear().id, 'custom');
}

async function roundTrip(ids) {
  const wanted = new Set(ids);
  const decoded = store.state.calendarDays.filter((day) => wanted.has(day.id)).map((day) =>
    decodeSyncV2Canonical('calendarDays', {
      id: day.id, ...encodeSyncV2Patch('calendarDays', day), revision: 1,
      deleted_at: day.deleted ? new Date(day.updatedAt).toISOString() : null,
      client_updated_at: day.updatedAt,
    }));
  store.state.calendarDays = store.state.calendarDays.map((day) =>
    decoded.find((canonical) => canonical.id === day.id) ?? day);
  await db.putMany('calendarDays', decoded);
  return decoded;
}

test('modern Calendar range identity survives canonical round-trip and remains editable/deletable', async () => {
  try {
    const calendar = await setup();
    const id = await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-05',
      endDate: '2026-10-07', kind: 'holiday', label: 'استثناء واحد' });
    const original = store.calendarDaysOf(calendar.id);
    assert.equal(original.filter((day) => day.rangeId === id).length, 3);
    const decoded = await roundTrip(original.map((day) => day.id));
    assert.equal(decoded.every((day) => !day.rangeId), true);
    assert.equal(store.calendarRangesOf().filter((range) => range.calendarId === calendar.id).length, 1);
    assert.equal(store.calendarRangesOf().find((range) => range.id === id)?.days.length, 3);
    await store.saveCalendarRange({ id, calendarId: calendar.id, startDate: '2026-10-05',
      endDate: '2026-10-06', kind: 'holiday', label: 'تعديل' });
    assert.equal(store.calendarRangesOf().find((range) => range.id === id)?.days.length, 2);
    const retainedBeforeNoop = store.calendarDaysOf(calendar.id).map((day) => [day.id, day.updatedAt]);
    const outboxBeforeNoop = (await db.getAll('outbox')).length;
    await store.saveCalendarRange({ id, calendarId: calendar.id, startDate: '2026-10-05',
      endDate: '2026-10-06', kind: 'holiday', label: 'تعديل' });
    assert.deepEqual(store.calendarDaysOf(calendar.id).map((day) => [day.id, day.updatedAt]), retainedBeforeNoop);
    assert.equal((await db.getAll('outbox')).length, outboxBeforeNoop);
    const removedDay = store.state.calendarDays.find((day) => day.date === '2026-10-07' && day.calendarId === calendar.id);
    assert.equal(removedDay.deleted, true);
    assert.ok((await db.getAll('outbox')).some((entry) => entry.store === 'calendarDays' &&
      entry.recordId === removedDay.id && entry.op === 'delete'));
    await store.saveCalendarRange({ id, calendarId: calendar.id, startDate: '2026-10-05',
      endDate: '2026-10-07', kind: 'holiday', label: 'تعديل' });
    const revivedDate = store.calendarDaysOf(calendar.id).find((day) => day.date === '2026-10-07');
    assert.notEqual(revivedDate.id, removedDay.id);
    assert.equal(calendarRangeIdentity({ ...revivedDate, rangeId: undefined }), id);
    await roundTrip(store.calendarDaysOf(calendar.id).map((day) => day.id));
    assert.equal(store.calendarRangesOf().find((range) => range.id === id)?.days.length, 3);
    await store.removeCalendarRange(calendar.id, id);
    assert.equal(store.calendarRangesOf().some((range) => range.id === id), false);
    assert.equal(store.state.calendarDays.filter((day) => day.calendarId === calendar.id && day.deleted).length, 4);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('genuine legacy single-day exception retains its record identity during edit and delete', async () => {
  try {
    const calendar = await setup();
    await store.setCalendarDay(calendar.id, '2026-10-05', 'holiday', 'قديم');
    const original = store.calendarDaysOf(calendar.id)[0];
    const key = `legacy:${calendar.id}:${original.id}`;
    await roundTrip([original.id]);
    assert.equal(store.calendarRangesOf().find((range) => range.id === key)?.days.length, 1);
    await store.saveCalendarRange({ id: key, calendarId: calendar.id, startDate: '2026-10-05',
      kind: 'holiday', label: 'معدّل' });
    assert.equal(store.calendarDaysOf(calendar.id).length, 1);
    assert.equal(store.calendarDaysOf(calendar.id)[0].id, original.id);
    assert.equal(store.calendarDaysOf(calendar.id)[0].label, 'معدّل');
    await store.removeCalendarRange(calendar.id, key);
    assert.equal(store.calendarDaysOf(calendar.id).length, 0);
    assert.ok((await db.getAll('outbox')).some((entry) => entry.store === 'calendarDays' &&
      entry.recordId === original.id && entry.op === 'delete'));
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('a fresh device reconstructs one synced multi-day range from canonical rows', async () => {
  try {
    const calendar = await setup();
    const year = store.activeYear();
    const id = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-11', endDate: '2026-10-13', kind: 'holiday', label: 'جهازان' });
    const canonicalDays = store.calendarDaysOf(calendar.id).map((day) =>
      decodeSyncV2Canonical('calendarDays', {
        id: day.id, ...encodeSyncV2Patch('calendarDays', day), revision: 1,
        deleted_at: null, client_updated_at: day.updatedAt,
      }));
    await db.clearAll();
    await db.putMany('years', [year]);
    await db.putMany('calendars', [calendar]);
    await db.putMany('calendarDays', canonicalDays);
    store.state.ready = false;
    await store.init();
    const ranges = store.calendarRangesOf(year.id).filter((range) => range.calendarId === calendar.id);
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].id, id);
    assert.equal(ranges[0].days.length, 3);
    await store.removeCalendarRange(calendar.id, id);
    assert.equal(store.calendarRangesOf(year.id).some((range) => range.id === id), false);
    assert.equal((await db.getAll('outbox')).filter((entry) =>
      entry.store === 'calendarDays' && entry.op === 'delete').length, 3);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('legacy move, modern move, recreation and independent equal-label ranges preserve IDs', async () => {
  try {
    const calendar = await setup();
    await store.setCalendarDay(calendar.id, '2026-10-05', 'holiday', 'مشترك');
    const legacyId = store.calendarDaysOf(calendar.id)[0].id;
    const legacyKey = `legacy:${calendar.id}:${legacyId}`;
    await roundTrip([legacyId]);
    await store.saveCalendarRange({ id: legacyKey, calendarId: calendar.id,
      startDate: '2026-10-06', kind: 'holiday', label: 'مشترك' });
    assert.equal(store.state.calendarDays.find((day) => day.id === legacyId)?.deleted, true);
    const movedLegacy = store.calendarDaysOf(calendar.id)[0];
    assert.equal(calendarRangeIdentity({ ...movedLegacy, rangeId: undefined }), legacyKey);

    const modern = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-08', kind: 'holiday', label: 'مشترك' });
    await store.saveCalendarRange({ id: modern, calendarId: calendar.id,
      startDate: '2026-10-09', kind: 'holiday', label: 'مشترك' });
    assert.equal(store.state.calendarDays.find((day) => day.date === '2026-10-08')?.deleted, true);
    const adjacent = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-10', kind: 'holiday', label: 'مشترك' });
    const far = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-20', kind: 'holiday', label: 'مشترك' });
    await roundTrip(store.calendarDaysOf(calendar.id).map((day) => day.id));
    assert.deepEqual(new Set(store.calendarRangesOf().filter((range) => range.calendarId === calendar.id)
      .map((range) => range.id)), new Set([legacyKey, modern, adjacent, far]));

    await store.removeCalendarRange(calendar.id, modern);
    const old = store.state.calendarDays.find((day) => day.date === '2026-10-09' && day.calendarId === calendar.id);
    const replacement = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-09', kind: 'holiday', label: 'جديد' });
    assert.notEqual(replacement, modern);
    assert.equal(old.deleted, true);
    assert.equal(store.calendarDaysOf(calendar.id).filter((day) => day.date === '2026-10-09').length, 1);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('official ranges reject edit/delete and backup/restore retains modern identity', async () => {
  try {
    const calendar = await setup();
    const id = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-05', endDate: '2026-10-06', kind: 'holiday', label: 'محلي' });
    const official = await store.ensureCalendar(store.activeYear().id, 'preset:test');
    await assert.rejects(store.saveCalendarRange({ id: 'official', calendarId: official.id,
      startDate: '2026-10-07', kind: 'holiday', label: 'رسمي' }), /رسمية/);
    await assert.rejects(store.removeCalendarRange(official.id, 'official'), /رسمية/);
    const backup = await buildBackup({ sourceOwnerId: null });
    assert.equal((await validateBackupIntegrity(backup)).ok, true);
    await db.clearAll();
    await restoreBackup(backup, 'replace');
    assert.equal((await db.getAll('calendarDays')).filter((day) => day.rangeId === id).length, 2);
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('server natural date uniqueness remains occupied by a tombstone', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create table calendar_days (
      id text primary key, owner_id text not null, calendar_id text not null,
      date date not null, deleted_at timestamptz,
      constraint calendar_days_natural_uniq unique(owner_id, calendar_id, date)
    );`);
    await pg.query("insert into calendar_days values ('old', 'owner', 'calendar', '2026-10-05', now())");
    await assert.rejects(
      pg.query("insert into calendar_days values ('new', 'owner', 'calendar', '2026-10-05', null)"),
      /calendar_days_natural_uniq/,
    );
  } finally {
    await pg.close();
  }
});

test('range writes and outbox share one IndexedDB transaction', async () => {
  await db.clearAll();
  await assert.rejects(db.putAcross({
    calendarDays: [{ id: 'atomic:day', calendarId: 'atomic:calendar', date: '2026-10-05' }],
    outbox: [{ missingPrimaryKey: true }],
  }));
  assert.equal(await db.get('calendarDays', 'atomic:day'), undefined);
  await db.closeDB();
});
