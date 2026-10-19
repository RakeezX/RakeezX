// AI-authored: diagnostic reproduction only, not on-demand acceptance evidence.
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { makeCalendar, makeSection, makeSlot, makeSubject, makeTeaching, makeTerm, makeTimeProfile, makeYear, shiftDate, todayISO, weekday } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

test('N116 baseline: daily generation freezes unopened lessons before calendar edits', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-05-02T12:00:00Z') });
  try {
    await db.clearAll();
    await store.init();
    const date = todayISO();
    const year = makeYear({ id: 'y:n116', hijriStart: 1450 });
    const term = makeTerm({ id: 'tm:n116', yearId: year.id, index: 1, startDate: shiftDate(date, -1), endDate: shiftDate(date, 7), status: 'active' });
    const subject = makeSubject({ id: 'sub:n116', name: 'مصطنع', slug: 'n116' });
    const section = makeSection({ id: 'sec:n116', yearId: year.id, grade: 5, label: 'أ' });
    const teaching = makeTeaching({ id: 'tch:n116', sectionId: section.id, subjectId: subject.id, termId: term.id });
    const other = makeTeaching({ id: 'tch:n116:other', sectionId: section.id, subjectId: subject.id, termId: term.id });
    const profile = makeTimeProfile({ id: 'tp:n116', periods: [{ period: 1, start: '07:00', end: '07:45' }, { period: 2, start: '08:00', end: '08:45' }] });
    const calendar = makeCalendar({ id: 'cal:n116', yearId: year.id, source: 'custom' });
    await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching, other], timeProfiles: [profile], calendars: [calendar], slots: [
      makeSlot({ teachingId: teaching.id, weekday: weekday(date), period: 1 }),
      makeSlot({ teachingId: teaching.id, weekday: weekday(date), period: 2 }),
      makeSlot({ teachingId: other.id, weekday: weekday(date), period: 1 }),
    ] });
    await store.patchDevice({ activeYearId: year.id, activeTermId: term.id }, { queue: false });
    await store.patchProfile({ activeTimeProfileId: profile.id }, { queue: false });
    assert.equal(store.sessionsOn(date).length, 0);
    const generated = await store.ensureSessionsForDate(date);
    assert.equal(generated.created, 3, 'Unscoped entry creates both periods and the unrelated teaching');
    const frozen = JSON.stringify(store.sessionsOn(date));
    assert.deepEqual(await store.ensureSessionsForDate(date), { created: 0, existing: 3, skipped: 0 });
    await store.setCalendarDay(calendar.id, date, 'holiday', 'إجازة مصطنعة');
    assert.equal(store.isSessionEligibleDate(date), false);
    assert.equal((await store.ensureSessionsForDate(date)).created, 0);
    assert.equal(JSON.stringify(store.sessionsOn(date)), frozen, 'Calendar edit cannot rewrite already-created session identities/history');
    assert.equal(store.sessionsOn(date).every(row => store.attendanceIn(row.id).length === 0), true);
    await writeFile('tests/n116-1019-reproduction.json', JSON.stringify({
      taskId: 'continuous-n116-lesson-generation-on-demand-20261019',
      runId: '9d9ad329-0029-4e7c-8e41-1f817958af6d',
      baseSha: '644e6896c24e02e00d46c558a0f87c563f644870',
      kind: 'baseline-diagnostic-only',
      result: 'Reproduced 3 unopened persisted sessions across 2 teachings; repeat is idempotent; later holiday retains original rows without attendance. This does not prove a hosted Sync failure or an implemented fix.',
      onDemandAcceptance: 'NOT_RUN',
    }, null, 2) + '\n');
  } finally { t.mock.timers.reset(); store.closeChannel(); db.closeDB(); }
});
