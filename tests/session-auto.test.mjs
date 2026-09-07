import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeCalendar, makeSection, makeSlot, makeSubject, makeTeaching, makeTerm, makeTimeProfile, makeYear, shiftDate, todayISO, weekday } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function setup({ slotDate = todayISO() } = {}) {
  await db.clearAll();
  await store.init();
  const today = todayISO();
  const year = makeYear({ id: 'y:auto', hijriStart: 1450 });
  const term = makeTerm({ id: 'tm:auto', yearId: year.id, index: 1, startDate: shiftDate(today, -2), endDate: shiftDate(today, 4), status: 'active' });
  const subject = makeSubject({ id: 'sub:auto', name: 'اختبار الحصص', slug: 'auto-sessions' });
  const section = makeSection({ id: 'sec:auto', yearId: year.id, grade: 5, label: 'أ' });
  const teaching = makeTeaching({ id: 'tch:auto', sectionId: section.id, subjectId: subject.id, termId: term.id });
  const profile = makeTimeProfile({ id: 'tp:auto', periods: [{ period: 1, start: '07:00', end: '07:45' }, { period: 2, start: '08:00', end: '08:45' }] });
  const calendar = makeCalendar({ id: 'cal:auto', yearId: year.id, source: 'custom' });
  const slot = makeSlot({ id: 'sl:auto', teachingId: teaching.id, weekday: weekday(slotDate), period: 1 });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], timeProfiles: [profile], calendars: [calendar], slots: [slot] });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id, activeTimeProfileId: profile.id }, { queue: false });
  return { today, year, term, teaching, profile, calendar, slot };
}

test('SESSION-AUTO materializes only eligible today shells and is idempotent', async (t) => {
  try {
    await t.test('today shell is frozen, has no attendance, and repeated ensure does not duplicate', async () => {
      const f = await setup();
      assert.deepEqual(await store.ensureSessionsForDate(f.today), { created: 1, existing: 0, skipped: 0 });
      const session = store.sessionsOnFor(f.teaching.id, f.today)[0];
      assert.equal(session.slotId, f.slot.id);
      assert.equal(session.startTime, '07:00');
      assert.equal(store.attendanceIn(session.id).length, 0);
      assert.deepEqual(await store.ensureSessionsForDate(f.today), { created: 0, existing: 1, skipped: 0 });
      assert.equal(store.sessionsOnFor(f.teaching.id, f.today).length, 1);
    });

    await t.test('non-study, outside-term, and future dates persist no ordinary session', async () => {
      const future = shiftDate(todayISO(), 1);
      const f = await setup({ slotDate: future });
      await store.setCalendarDay(f.calendar.id, f.today, 'holiday', 'إجازة');
      assert.equal((await store.ensureSessionsForDate(f.today)).created, 0);
      assert.equal(store.sessionsOn(f.today).length, 0);
      assert.equal((await store.ensureSessionsForDate(future)).created, 0);
      assert.equal(store.sessionsOn(future).length, 0);
      assert.equal(store.projectedSessionsForDate(future).length, 1);
      assert.equal(store.isSessionEligibleDate(shiftDate(f.today, 10)), false);
    });

    await t.test('future projections follow a slot edit without materializing future rows', async () => {
      const future = shiftDate(todayISO(), 1);
      const f = await setup({ slotDate: future });
      assert.equal(store.projectedSessionsForDate(future)[0].period, 1);
      await store.editSlot(f.slot.id, { teachingId: f.teaching.id, weekday: weekday(future), period: 2 });
      assert.equal(store.projectedSessionsForDate(future)[0].period, 2);
      assert.equal(store.sessionsOn(future).length, 0);
    });

    await t.test('today existing shell remains unchanged, but a newly applicable period materializes once', async () => {
      const f = await setup();
      await store.ensureSessionsForDate(f.today);
      const original = store.sessionsOnFor(f.teaching.id, f.today)[0];
      await store.editSlot(f.slot.id, { teachingId: f.teaching.id, weekday: weekday(f.today), period: 2 });
      const sessions = store.sessionsOnFor(f.teaching.id, f.today);
      assert.equal(sessions.length, 2);
      assert.equal(store.getSession(original.id).period, 1);
      assert.equal(sessions.find((row) => row.period === 2)?.slotId, f.slot.id);
    });

    await t.test('tombstoned natural identity is never rematerialized and unsafe cancellation is blocked', async () => {
      const f = await setup();
      await store.ensureSessionsForDate(f.today);
      const session = store.sessionsOnFor(f.teaching.id, f.today)[0];
      await store.softDelete('sessions', session.id);
      assert.equal((await store.ensureSessionsForDate(f.today)).created, 0);
      assert.equal(store.getSession(session.id), null);
      const replacement = await store.ensureSession(f.teaching.id, f.today, 2);
      await store.setSessionStatus(replacement.id, 'held');
      await assert.rejects(store.setSessionStatus(replacement.id, 'cancelled'), /لا يمكن إلغاء حصة تم رصد حضورها/);
    });

    await t.test('legacy range generator cannot materialize ordinary future sessions', async () => {
      const f = await setup();
      await assert.rejects(store.generateSessionsForRange(f.teaching.id, shiftDate(f.today, 1), shiftDate(f.today, 1)), /لا تُولَّد الحصص المستقبلية/);
    });
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
