import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeSlot,
  makeCalendar, makeTimeProfile,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function setup() {
  await db.clearAll();
  await store.init();

  const year = makeYear({ id: 'y:sessions', hijriStart: 1450, label: 'سنة الاختبار', order: 99 });
  const term = makeTerm({ id: 'tm:sessions:1', yearId: year.id, index: 1, startDate: '2026-08-23', endDate: '2026-09-30', status: 'active' });
  const subject = makeSubject({ id: 'sub:sessions', name: 'المهارات الرقمية', slug: 'sessions' });
  const section = makeSection({ id: 'sec:sessions', yearId: year.id, grade: 5, label: 'أ' });
  const teaching = makeTeaching({ id: 'tch:sessions', sectionId: section.id, subjectId: subject.id, termId: term.id });
  const summer = makeTimeProfile({
    id: 'tp:summer', name: 'صيف الاختبار', activeFrom: '2026-08-01', activeTo: '2026-09-30',
    periods: [{ period: 1, start: '07:00', end: '07:45' }, { period: 4, start: '09:30', end: '10:15' }],
    overrides: { config: { type: 'summer' } },
  });
  const hybrid = makeTimeProfile({
    id: 'tp:hybrid', name: 'مدمج الاختبار',
    periods: [{ period: 1, start: '08:00', end: '08:30' }, { period: 4, start: '09:30', end: '10:00' }],
    overrides: {
      config: { type: 'hybrid' },
      remote: [{ period: 1, start: '07:00', end: '07:30' }, { period: 4, start: '08:30', end: '09:00' }],
    },
  });
  const calendar = makeCalendar({ id: 'cal:sessions', yearId: year.id, source: 'custom' });
  const sunday = makeSlot({ id: 'sl:sunday', teachingId: teaching.id, weekday: 0, period: 1 });
  const tuesday = makeSlot({ id: 'sl:tuesday', teachingId: teaching.id, weekday: 2, period: 1 });

  await store.save({
    years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching],
    timeProfiles: [summer, hybrid], calendars: [calendar], slots: [sunday, tuesday],
  });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id, activeTimeProfileId: hybrid.id, lastSyncAt: 0 });
  return { year, term, subject, section, teaching, summer, hybrid, calendar, sunday, tuesday };
}

test('session range generation preserves dated timetable history', async (t) => {
  try {
    await t.test('generates physical and remote snapshots, skips holidays, and is idempotent', async () => {
      const f = await setup();
      await store.setCalendarDay(f.calendar.id, '2026-08-25', 'remote', 'عن بُعد');
      await store.setCalendarDay(f.calendar.id, '2026-08-30', 'holiday', 'إجازة');

      const first = await store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-30');
      const physical = store.getSession(`se:${f.teaching.id}:2026-08-23:1`);
      const remote = store.getSession(`se:${f.teaching.id}:2026-08-25:1`);

      assert.equal(first.created, 2);
      assert.equal(first.holidays, 1);
      assert.equal(physical.startTime, '07:00');
      assert.equal(physical.endTime, '07:45');
      assert.equal(physical.timeProfileId, f.summer.id);
      assert.equal(remote.startTime, '07:00');
      assert.equal(remote.endTime, '07:30');
      assert.equal(remote.timeProfileId, f.hybrid.id);
      assert.equal(store.getSession(`se:${f.teaching.id}:2026-08-30:1`), null);

      const again = await store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-30');
      assert.equal(again.created, 0);
      assert.equal(again.existing, 2);
      assert.equal(store.sessionsOf(f.teaching.id).length, 2);
    });

    await t.test('attendance reuses generated and lazily created sessions without duplicates', async () => {
      const f = await setup();
      await store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-23');
      const generated = store.getSession(`se:${f.teaching.id}:2026-08-23:1`);
      const reused = await store.ensureSession(f.teaching.id, '2026-08-23', 1);
      assert.equal(reused.id, generated.id);

      const lazy = await store.ensureSession(f.teaching.id, '2026-09-06', 1);
      const later = await store.generateSessionsForRange(f.teaching.id, '2026-09-06', '2026-09-06');
      assert.equal(later.created, 0);
      assert.equal(later.existing, 1);
      assert.equal(store.getSession(lazy.id).id, lazy.id);
    });

    await t.test('slot edits affect future generation only and reload preserves prior sessions', async () => {
      const f = await setup();
      await store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-23');
      const historical = store.getSession(`se:${f.teaching.id}:2026-08-23:1`);
      await store.editSlot(f.sunday.id, { weekday: 1, period: 4, teachingId: f.teaching.id });
      await store.generateSessionsForRange(f.teaching.id, '2026-08-24', '2026-08-24');
      const future = store.getSession(`se:${f.teaching.id}:2026-08-24:4`);

      assert.equal(historical.period, 1);
      assert.equal(historical.slotId, f.sunday.id);
      assert.equal(historical.startTime, '07:00');
      assert.ok(future);
      assert.equal(future.period, 4);
      assert.equal(future.slotId, f.sunday.id);

      store.state.ready = false;
      await store.init();
      assert.equal(store.getSession(historical.id).startTime, '07:00');
      assert.equal(store.getSession(future.id).period, 4);
    });

    await t.test('clips a partially overlapping range and explains zero-candidate ranges', async () => {
      const f = await setup();
      const clipped = await store.generateSessionsForRange(f.teaching.id, '2026-08-01', '2026-08-23');
      assert.equal(clipped.created, 1);
      assert.equal(clipped.startDate, '2026-08-23');
      assert.equal(clipped.endDate, '2026-08-23');
      assert.equal(clipped.clipped, true);

      await assert.rejects(
        store.generateSessionsForRange(f.teaching.id, '2026-08-24', '2026-08-24'),
        /لا توجد حصص في الجدول ضمن النطاق المختار/
      );
    });

    await t.test('rejects a teaching with no timetable slots instead of reporting ambiguous zeroes', async () => {
      const f = await setup();
      await store.removeSlot(f.sunday.id);
      await store.removeSlot(f.tuesday.id);
      await assert.rejects(
        store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-23'),
        /لا توجد حصص في الجدول لهذا الفصل ضمن الإعداد الحالي/
      );
    });
    await t.test('generated sessions use the durable V2 outbox path', async () => {
      const f = await setup();
      await store.generateSessionsForRange(f.teaching.id, '2026-08-23', '2026-08-23');
      const outbox = await db.getAll('outbox');
      const sessionWrite = outbox.find((row) => row.store === 'sessions');
      assert.equal(sessionWrite.protocol, 'v2');
      assert.equal(sessionWrite.op, 'create');
      assert.equal(sessionWrite.recordId, `se:${f.teaching.id}:2026-08-23:1`);
    });
  } finally {
    store.closeChannel();
    await db.closeDB();
  }
});
