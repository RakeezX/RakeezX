import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeSection, makeSlot, makeSubject, makeTeaching } from '../src/models.js';
import { getCalendarPreset, WESTERN_1448_1449_PRESET_ID } from '../src/lib/calendar-presets.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function reset() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
}

function expectedRange(startDate, endDate, label) {
  const preset = getCalendarPreset();
  const range = preset.holidays.find((holiday) => holiday.label === label);
  assert.deepEqual({ startDate: range.startDate, endDate: range.endDate }, { startDate, endDate });
}

test('Western Region 1448/1449 calendar preset', async (t) => {
  try {
    await t.test('creates the approved empty-user foundation with exact terms and inclusive holidays', async () => {
      await reset();
      const preset = getCalendarPreset(WESTERN_1448_1449_PRESET_ID);
      const year = store.years().find((item) => item.calendarPresetId === preset.id);
      assert.equal(year.label, '1448–1449 هـ');
      assert.equal(year.startDate, '2026-08-30');
      assert.equal(year.endOfYearVacationStart, '2027-07-01');
      assert.equal(year.nextAcademicYearStart, '2027-08-29');
      const terms = store.termsOf(year.id);
      assert.equal(terms.length, 2);
      assert.deepEqual(terms.map((term) => [term.index, term.startDate, term.endDate]), [[1, '2026-08-30', '2027-01-07'], [2, '2027-01-17', '2027-06-30']]);
      expectedRange('2026-09-23', '2026-09-26', 'إجازة اليوم الوطني');
      expectedRange('2026-11-20', '2026-11-28', 'إجازة الخريف');
      expectedRange('2027-01-08', '2027-01-16', 'إجازة منتصف العام');
      expectedRange('2027-02-19', '2027-02-22', 'إجازة يوم التأسيس');
      expectedRange('2027-02-26', '2027-03-13', 'إجازة عيد الفطر');
      expectedRange('2027-04-30', '2027-05-22', 'إجازة عيد الأضحى');
      assert.equal(store.calendarDayForYear(year.id, '2026-09-23').kind, 'national');
      assert.equal(store.calendarDayForYear(year.id, '2026-09-26').kind, 'national');
      assert.equal(store.calendarDayForYear(year.id, '2026-09-27'), null);
    });

    await t.test('is idempotent and preserves unrelated data and local overrides', async () => {
      await reset();
      const year = store.activeYear();
      const before = { years: store.years().length, terms: store.termsOf(year.id).length, days: store.calendarsOf(year.id).flatMap((calendar) => store.calendarDaysOf(calendar.id)).length };
      await store.save({ years: [{ id: 'y:manual', label: 'سنة يدوية', hijriStart: 1450, deleted: false, updatedAt: Date.now() }] });
      const custom = await store.ensureCalendar(year.id, 'custom');
      await store.setCalendarDay(custom.id, '2026-09-23', 'study', 'استثناء محلي');
      const first = await store.applyCalendarPreset();
      const second = await store.applyCalendarPreset();
      assert.equal(first.ok, true); assert.equal(second.ok, true); assert.equal(second.applied, 0);
      assert.ok(store.getYear('y:manual'));
      assert.equal(store.termsOf(year.id).length, before.terms);
      assert.equal(store.calendarsOf(year.id).flatMap((calendar) => store.calendarDaysOf(calendar.id)).length, before.days + 1);
      assert.equal(store.calendarDayForYear(year.id, '2026-09-23').label, 'استثناء محلي');
    });

    await t.test('calendar days control generated sessions and exclude official holidays from attendance/report debt', async () => {
      await reset();
      const year = store.activeYear();
      const term = store.termsOf(year.id)[0];
      const subject = makeSubject({ id: 'sub:preset', name: 'اختبار', slug: 'preset' });
      const section = makeSection({ id: 'sec:preset', yearId: year.id, grade: 4, label: 'أ' });
      const teaching = makeTeaching({ id: 'tch:preset', sectionId: section.id, subjectId: subject.id, termId: term.id });
      const sunday = makeSlot({ id: 'sl:preset:sunday', teachingId: teaching.id, weekday: 0, period: 1 });
      const wednesday = makeSlot({ id: 'sl:preset:wednesday', teachingId: teaching.id, weekday: 3, period: 1 });
      await store.save({ subjects: [subject], sections: [section], teachings: [teaching], slots: [sunday, wednesday] });
      const result = await store.generateSessionsForRange(teaching.id, '2026-09-20', '2026-09-26');
      assert.equal(result.created, 1);
      assert.equal(result.holidays, 1);
      assert.ok(store.getSession(`se:${teaching.id}:2026-09-20:1`));
      assert.equal(store.getSession(`se:${teaching.id}:2026-09-23:1`), null);
      const holidaySession = await store.ensureSession(teaching.id, '2026-09-23', 1);
      assert.equal(holidaySession.status, 'cancelled_holiday');
      assert.equal(store.attendanceCompleteness(holidaySession, new Date('2026-09-24T12:00:00')).state, 'excluded');
      const report = store.executionReport({ yearId: year.id, termId: term.id, reference: new Date('2026-09-24T12:00:00') });
      assert.equal(report.counts.generated, 2);
      assert.equal(report.counts.excluded, 1);
      assert.equal(report.counts.pending, 1);
    });
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});