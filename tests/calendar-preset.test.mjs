import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeSection, makeSlot, makeSubject, makeTeaching } from '../src/models.js';
import { getCalendarPreset, GENERAL_1448_1449_PRESET_ID, WESTERN_1448_1449_PRESET_ID } from '../src/lib/calendar-presets.js';

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
      assert.deepEqual(terms.map((term) => [term.index, term.startDate, term.endDate]), [[1, '2026-08-30', '2027-01-07'], [2, '2027-01-17', '2027-07-01']]);
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

    await t.test('switches between General and Western presets updating terms and holidays while keeping local overrides', async () => {
      await reset();
      const year = store.activeYear();
      // Add local custom override
      const custom = await store.ensureCalendar(year.id, 'custom');
      await store.setCalendarDay(custom.id, '2026-10-01', 'holiday', 'إجازة مدرسية خاصة');

      // Switch to General preset
      const genRes = await store.applyCalendarPreset(GENERAL_1448_1449_PRESET_ID);
      assert.equal(genRes.ok, true);
      const genYear = store.getYear(year.id);
      assert.equal(genYear.calendarPresetId, GENERAL_1448_1449_PRESET_ID);
      assert.equal(genYear.startDate, '2026-08-23');
      assert.equal(genYear.endOfYearVacationStart, '2027-06-24');
      const genTerms = store.termsOf(year.id);
      assert.deepEqual(genTerms.map((t) => [t.index, t.startDate, t.endDate]), [
        [1, '2026-08-23', '2027-01-07'],
        [2, '2027-01-17', '2027-06-24'],
      ]);
      // General includes 2027-04-11 extended weekend and 2026-11-29 extended weekend
      assert.ok(store.calendarDayForYear(year.id, '2027-04-11'));
      assert.ok(store.calendarDayForYear(year.id, '2026-11-29'));
      // Custom override remains intact
      assert.equal(store.calendarDayForYear(year.id, '2026-10-01')?.label, 'إجازة مدرسية خاصة');

      // Switch back to Western preset
      const westRes = await store.applyCalendarPreset(WESTERN_1448_1449_PRESET_ID);
      assert.equal(westRes.ok, true);
      const westYear = store.getYear(year.id);
      assert.equal(westYear.calendarPresetId, WESTERN_1448_1449_PRESET_ID);
      assert.equal(westYear.startDate, '2026-08-30');
      assert.equal(westYear.endOfYearVacationStart, '2027-07-01');
      const westTerms = store.termsOf(year.id);
      assert.deepEqual(westTerms.map((t) => [t.index, t.startDate, t.endDate]), [
        [1, '2026-08-30', '2027-01-07'],
        [2, '2027-01-17', '2027-07-01'],
      ]);
      // Western does NOT have 2027-04-11
      assert.equal(store.calendarDayForYear(year.id, '2027-04-11'), null);
      // Western Eid al-Adha starts earlier (2027-04-30)
      assert.ok(store.calendarDayForYear(year.id, '2027-04-30'));
      // Custom override still intact
      assert.equal(store.calendarDayForYear(year.id, '2026-10-01')?.label, 'إجازة مدرسية خاصة');
    });

    await t.test('switches atomically without identity/history loss, foreign-year cleanup or repeat outbox churn', async () => {
      await reset();
      const year = store.activeYear();
      const legacySecond = store.termsOf(year.id)[1];
      await store.patch('terms', legacySecond.id, { endDate: '2027-06-30' });
      await store.applyCalendarPreset(WESTERN_1448_1449_PRESET_ID);
      assert.equal(store.getTerm(legacySecond.id).endDate, '2027-07-01');
      const original = store.termsOf(year.id)[0];
      // Fictional imported term identity: activation must not assume factory IDs.
      await db.remove('terms', original.id);
      store.state.terms = store.state.terms.filter((term) => term.id !== original.id);
      const imported = { ...original, id: 'term:imported-test', name: 'فصل اختبار مستورد' };
      const foreignCalendar = { id: 'cal:foreign-test', yearId: 'year:foreign-test', source: `preset:${WESTERN_1448_1449_PRESET_ID}`, deleted: false };
      const foreignDay = { id: 'day:foreign-test', calendarId: foreignCalendar.id, presetId: WESTERN_1448_1449_PRESET_ID, date: '2026-10-04', kind: 'holiday', deleted: false };
      await store.save({ terms: [imported], calendars: [foreignCalendar], calendarDays: [foreignDay],
        teachings: [{ id: 'teaching:history-test', termId: imported.id, deleted: false }],
        sessions: [{ id: 'session:history-test', teachingId: 'teaching:history-test', date: '2026-09-06', period: 1, status: 'completed', deleted: false }],
        attendance: [{ id: 'attendance:history-test', sessionId: 'session:history-test', studentId: 'student:fictional', status: 'present', deleted: false }],
      });
      const custom = await store.ensureCalendar(year.id, 'custom');
      await store.setCalendarDay(custom.id, '2026-09-23', 'study', 'استثناء المعلم');
      const beforeHistory = await Promise.all(['teachings', 'sessions', 'attendance'].map(db.getAll));
      const beforeForeign = [await db.get('calendars', foreignCalendar.id), await db.get('calendarDays', foreignDay.id)];
      const beforeCustom = await db.getAll('calendarDays').then((days) => days.filter((day) => day.calendarId === custom.id));
      for (const presetId of [GENERAL_1448_1449_PRESET_ID, WESTERN_1448_1449_PRESET_ID, GENERAL_1448_1449_PRESET_ID]) {
        await store.applyCalendarPreset(presetId, { activate: true });
        assert.equal(store.state.device.activeTermId, imported.id);
        assert.equal(store.getTerm(imported.id).name, imported.name);
        assert.equal(store.getTerm(original.id), null);
        const liveCalendars = store.calendarsOf(year.id);
        const official = liveCalendars.filter((cal) => cal.source.startsWith('preset:'));
        assert.equal(official.length, 1);
        assert.equal(official[0].source, `preset:${presetId}`);
        for (const term of store.termsOf(year.id)) assert.ok(liveCalendars.some((cal) => cal.id === term.calendarId));
        for (const day of store.state.calendarDays.filter((day) => !day.deleted)) {
          assert.ok(store.state.calendars.some((cal) => cal.id === day.calendarId && !cal.deleted));
        }
        const snapshot = await Promise.all(['years', 'terms', 'calendars', 'calendarDays', 'outbox', 'device'].map(db.getAll));
        assert.equal((await store.applyCalendarPreset(presetId, { activate: true })).applied, 0);
        assert.deepEqual(await Promise.all(['years', 'terms', 'calendars', 'calendarDays', 'outbox', 'device'].map(db.getAll)), snapshot);
      }
      assert.deepEqual(await Promise.all(['teachings', 'sessions', 'attendance'].map(db.getAll)), beforeHistory);
      assert.deepEqual([await db.get('calendars', foreignCalendar.id), await db.get('calendarDays', foreignDay.id)], beforeForeign);
      assert.deepEqual(await db.getAll('calendarDays').then((days) => days.filter((day) => day.calendarId === custom.id)), beforeCustom);
      assert.ok(store.state.calendarDays.some((day) => day.deleted && day.deletedAt));
      store.state.ready = false; await store.init();
      assert.equal(store.state.device.activeTermId, imported.id);
      assert.equal((await store.applyCalendarPreset(GENERAL_1448_1449_PRESET_ID)).applied, 0);
      assert.equal(store.calendarDayForYear(year.id, '2026-11-29').label, 'إجازة نهاية أسبوع مطولة');
      assert.equal(store.calendarDayForYear(year.id, '2027-04-30'), null);
      assert.ok(store.calendarDayForYear(year.id, '2027-05-07'));
      await assert.rejects(store.applyCalendarPreset('unknown-preset'), /غير متاح/);
    });

    await t.test('accepts adjacent term dates and preserves persisted dates after rejected overlap', async () => {
      await reset();
      const [first, second] = store.termsOf(store.activeYear().id);
      await store.updateTermDates(second.id, '2027-01-08', '2027-06-30');
      assert.equal(store.getTerm(second.id).startDate, '2027-01-08');
      await assert.rejects(store.updateTermDates(first.id, '2026-08-30', '2027-01-08'), /يتداخل تاريخ/);
      await assert.rejects(store.updateTermDates(first.id, '2026-08-30', '2027-01-20'), /يتداخل تاريخ/);
      assert.deepEqual([store.getTerm(first.id).startDate, store.getTerm(first.id).endDate], ['2026-08-30', '2027-01-07']);
      store.state.ready = false; await store.init();
      assert.deepEqual([store.getTerm(first.id).startDate, store.getTerm(first.id).endDate], ['2026-08-30', '2027-01-07']);
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
