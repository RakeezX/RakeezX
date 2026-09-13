import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { generateAdvancedPeriods, periodNumbers, periodTime, TIMING_PRESETS,
  makeYear, makeTerm, makeSection, makeTeaching, makeSubject, makeSlot } from '../src/models.js';
import { explicitRecess, getProfileModels, reflowPeriodsWithRecess } from '../src/views/times.js';
import { buildScheduleExportModel, schedulePrintDocument } from '../src/lib/schedule-export.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
after(async () => { store.closeChannel(); await db.closeDB(); });
const config = (gap, recess = { enabled: false }) => ({
  firstPeriodStart: '08:00', periodDuration: 45, count: 4, gap, recess,
});
const profile = (gap, recess) => {
  const cfg = config(gap, recess);
  return { id: 'timing-gap', name: 'توقيت الاختبار', periods: generateAdvancedPeriods(cfg), overrides: { config: cfg } };
};

for (const gap of [0, 1, 5]) {
  test(`generic ${gap}-minute gap changes times, not period/recess identities or print output`, () => {
    const timing = profile(gap);
    const expected = gap === 0 ? ['08:00','08:45','09:30','10:15']
      : gap === 1 ? ['08:00','08:46','09:32','10:18'] : ['08:00','08:50','09:40','10:30'];
    assert.deepEqual(timing.periods.map((p) => p.start), expected);
    assert.deepEqual(periodNumbers(timing), [1,2,3,4]);
    assert.equal(explicitRecess(getProfileModels(timing)[0]), null);
    assert.deepEqual(periodTime(timing, 0, 2), { period:2, start:expected[1], end:gap === 0 ? '09:30' : gap === 1 ? '09:31' : '09:35' });
    const exported = buildScheduleExportModel({ activeTimeProfile: () => timing,
      allSlots: () => [{id:'print-slot',weekday:0,period:2,teachingId:'print-teaching'}],
      getTeaching: () => ({sectionId:'print-section',subjectId:'print-subject'}),
      getSection: () => ({grade:5,label:'اختبار'}), getSubject: () => ({name:'اختبار'}) });
    assert.deepEqual(exported.days[0].periods.map((p) => p.time.start), expected);
    const printed = schedulePrintDocument(exported);
    assert.ok(printed.includes(expected[1]));
    assert.ok(!printed.includes('فسحة'));
    assert.equal(exported.periods.length, 4);
  });
}

test('only explicit recess boundaries are named; built-in Summer/Winter recesses remain supported', () => {
  const timing = profile(1, { enabled:true, afterPeriod:2, duration:20, transition:5 });
  assert.deepEqual(timing.periods.map((p) => p.start), ['08:00','08:46','09:56','10:42']);
  assert.deepEqual(explicitRecess(getProfileModels(timing)[0]), { afterPeriod:2, duration:20, transition:5 });
  for (const type of ['summer','winter','ramadan','hybrid']) {
    const cfg = TIMING_PRESETS[type];
    const models = getProfileModels({ periods:generateAdvancedPeriods(cfg), overrides:{config:cfg} });
    assert.equal(models.filter((model) => explicitRecess(model)).length, ['summer','winter'].includes(type) ? 2 : 0);
  }
  const disabled = profile(1, { enabled:false, afterPeriod:2, duration:20 });
  assert.equal(explicitRecess(getProfileModels(disabled)[0]), null, 'stale disabled configuration is not a recess');
});

test('adding/moving/removing explicit recess preserves generic gaps and numbering', () => {
  const base = profile(5).periods;
  const added = reflowPeriodsWithRecess(base, {previousAfterPeriod:0, gap:5, afterPeriod:2, recessDuration:20});
  assert.deepEqual(added.map((p) => p.start), ['08:00','08:50','09:55','10:45']);
  const moved = reflowPeriodsWithRecess(added, {previousAfterPeriod:2, gap:5, afterPeriod:1, recessDuration:20});
  assert.deepEqual(moved.map((p) => p.start), ['08:00','09:05','09:55','10:45']);
  const removed = reflowPeriodsWithRecess(moved, {previousAfterPeriod:1, gap:5, afterPeriod:0});
  assert.deepEqual(removed, base);
});

test('legacy generic profiles load without writes; explicit persisted model intent is preserved', () => {
  const timing = profile(1);
  const before = structuredClone(timing);
  getProfileModels(timing);
  assert.deepEqual(timing, before);
  const model = {...getProfileModels(timing)[0], afterPeriod:1, recessDuration:1};
  assert.equal(explicitRecess(model)?.afterPeriod, 1, 'never guess away explicit stored intent by duration');
});

test('gap profile and explicit day metadata round-trip through IndexedDB and existing Sync JSON contract; sessions remain canonical/frozen', async () => {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  const timing = profile(1);
  timing.overrides.recessByDay = { '1': {afterPeriod:2, recessDuration:20, recessTransition:0, gap:1} };
  const wire = encodeSyncV2Patch('timeProfiles', timing);
  const decoded = decodeSyncV2Canonical('timeProfiles', {...wire, id:timing.id});
  assert.deepEqual(decoded.overrides, timing.overrides);
  const year = makeYear({id:'gap-year', order:99});
  const term = makeTerm({id:'gap-term', yearId:year.id, index:1, startDate:'2026-09-01', endDate:'2026-09-30'});
  const subject = makeSubject({id:'gap-subject', name:'اختبار'});
  const section = makeSection({id:'gap-section', yearId:year.id, grade:5, label:'اختبار'});
  const teaching = makeTeaching({id:'gap-teaching', termId:term.id, subjectId:subject.id, sectionId:section.id});
  const slot = makeSlot({id:'gap-slot', teachingId:teaching.id, weekday:0, period:2});
  await store.save({timeProfiles:[timing], years:[year], terms:[term], subjects:[subject], sections:[section], teachings:[teaching], slots:[slot]}, {queue:false});
  await store.patchProfile({activeTimeProfileId:timing.id}, {queue:false});
  await store.patchDevice({activeYearId:year.id, activeTermId:term.id}, {queue:false});
  const first = await store.generateSessionsForRange(teaching.id, '2026-09-06', '2026-09-06');
  assert.equal(first.created, 1);
  const session = store.getSession('se:gap-teaching:2026-09-06:2');
  assert.equal(session.startTime, '08:46');
  assert.equal(session.endTime, '09:31');
  assert.equal(session.slotId, slot.id);
  const reopened = await db.getAll('timeProfiles');
  assert.deepEqual(reopened.find((p) => p.id === timing.id).overrides, timing.overrides);
  await store.patch('timeProfiles', timing.id, {periods:profile(5).periods}, null, {queue:false});
  const second = await store.generateSessionsForRange(teaching.id, '2026-09-06', '2026-09-06');
  assert.equal(second.created, 0);
  assert.deepEqual(store.getSession(session.id), session, 'historical session identity and timing stay frozen');
  assert.equal((await db.getAll('attendance')).length, 0, 'timing never creates attendance');
});
