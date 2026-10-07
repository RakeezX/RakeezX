import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { CALENDAR_KIND, isTeachingDay, sessionCalendarPresentation, todayISO } from '../src/models.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { buildBackup, validateBackupIntegrity } from '../src/lib/export.js';
import { seedBackupRows } from './helpers/seed-backup.mjs';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function setup() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  return store.ensureCalendar(store.activeYear().id, 'custom');
}

test('suspension is distinct, non-teaching and remains distinct through reload, Sync and Backup/Restore', async () => {
  try {
    const calendar = await setup();
    const suspensionId = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-05', kind: 'suspension', label: 'تعليق للأحوال الجوية' });
    const holidayId = await store.saveCalendarRange({ calendarId: calendar.id,
      startDate: '2026-10-06', kind: 'holiday', label: 'إجازة محلية' });
    assert.equal(CALENDAR_KIND.suspension.label, 'تعليق دراسة');
    assert.equal(isTeachingDay('suspension'), false);
    assert.equal(isTeachingDay('holiday'), false);
    assert.equal(isTeachingDay('remote'), true);
    assert.deepEqual(store.calendarRangesOf().filter((range) => [suspensionId, holidayId].includes(range.id))
      .map((range) => range.kind).sort(), ['holiday', 'suspension']);
    const suspension = store.calendarRangesOf().find((range) => range.id === suspensionId).days[0];
    const canonical = decodeSyncV2Canonical('calendarDays', {
      id: suspension.id, ...encodeSyncV2Patch('calendarDays', suspension), revision: 1,
      deleted_at: null, client_updated_at: suspension.updatedAt,
    });
    assert.equal(canonical.kind, 'suspension');
    const backup = await buildBackup({ sourceOwnerId: null });
    assert.equal((await validateBackupIntegrity(backup)).ok, true);
    await db.clearAll();
  await seedBackupRows(backup);
    store.state.ready = false;
    await store.init();
    assert.equal(store.calendarRangesOf().find((range) => range.id === suspensionId)?.kind, 'suspension');
    assert.equal(store.calendarRangesOf().find((range) => range.id === holidayId)?.kind, 'holiday');
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});

test('session presentation resolves the teaching year, and existing cancelled_holiday remains non-counting', async () => {
  try {
    const calendar = await setup();
    const year = store.activeYear();
    const term = store.activeTerm();
    const teaching = store.teachings(term.id)[0] ?? { id: 'tch:suspension', termId: term.id };
    if (!store.getTeaching(teaching.id)) await store.save({ teachings: [teaching] });
    await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-05',
      kind: 'suspension', label: 'تعليق للأحوال الجوية' });
    const session = await store.ensureSession(teaching.id, '2026-10-05', 1);
    assert.equal(session.status, 'cancelled_holiday');
    assert.equal(store.sessionStatusPresentation(session).label, 'تعليق دراسة');
    assert.equal(store.sessionStatusPresentation(session).counts, false);
    assert.equal(store.sessionCalendarDay(session).kind, 'suspension');
    assert.equal(store.isSessionEligibleDate('2026-10-05', { year, term }), false);
    assert.equal(sessionCalendarPresentation({ status: 'cancelled_holiday', reason: 'إجازة رسمية' },
      { kind: 'suspension', label: 'تعليق' }).reason, 'تعليق');
    assert.equal(sessionCalendarPresentation({ status: 'cancelled_holiday', reason: 'إجازة نهاية أسبوع' },
      { kind: 'suspension', label: 'تعليق' }).reason, 'تعليق');
    await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-06',
      kind: 'holiday', label: 'إجازة محلية' });
    const holiday = await store.ensureSession(teaching.id, '2026-10-06', 1);
    assert.equal(store.sessionStatusPresentation(holiday).label, 'إجازة رسمية');
    await store.saveCalendarRange({ calendarId: calendar.id, startDate: '2026-10-07',
      kind: 'remote', label: 'تعليم عن بُعد' });
    const remote = await store.ensureSession(teaching.id, '2026-10-07', 1);
    assert.equal(remote.status, 'scheduled');
    await store.saveCalendarRange({ calendarId: calendar.id, startDate: todayISO(),
      kind: 'suspension', label: 'تعليق اليوم' });
    assert.equal(store.isSessionEligibleDate(todayISO(), { year, term }), false);
    assert.equal((await store.ensureSessionsForDate(todayISO())).created, 0);

    // The active year's holiday cannot override the historical teaching year.
    store.state.years.push({ id: 'year:historic-0446', deleted: false });
    store.state.terms.push({ id: 'term:historic-0446', yearId: 'year:historic-0446', deleted: false });
    store.state.calendars.push({ id: 'cal:historic-0446', yearId: 'year:historic-0446', source: 'custom', deleted: false });
    store.state.calendarDays.push({ id: 'day:historic-0446', calendarId: 'cal:historic-0446',
      date: '2026-10-06', kind: 'suspension', label: 'تعليق قديم', deleted: false });
    store.state.teachings.push({ id: 'tch:historic-0446', termId: 'term:historic-0446', deleted: false });
    const historicSession = { teachingId: 'tch:historic-0446', date: '2026-10-06',
      status: 'cancelled_holiday', reason: 'إجازة رسمية' };
    assert.equal(store.calendarDayForYear(year.id, '2026-10-06').kind, 'holiday');
    assert.equal(store.sessionCalendarDay(historicSession).kind, 'suspension');
    assert.equal(store.sessionStatusPresentation(historicSession).label, 'تعليق دراسة');
    assert.equal(store.sessionStatusPresentation(historicSession).reason, 'تعليق قديم');
    store.state.teachings.find((record) => record.id === 'tch:historic-0446').deleted = true;
    store.state.terms.find((record) => record.id === 'term:historic-0446').deleted = true;
    assert.equal(store.sessionCalendarDay(historicSession).kind, 'suspension');
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
