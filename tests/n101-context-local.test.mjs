import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

global.document = {
  documentElement: {
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {} },
  },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('N101 existing Calendar preview with valid foreign year/term parents remains read-only', async () => {
  await db.clearAll(); store.state.ready = false; await store.init();
  const { getAffectedSchedule, default: calendarView } = await import('../src/views/calendar.js');
  const [first, second] = store.termsOf(store.activeYear().id);
  await store.save({
    years: [{id:'year:another',hijriStart:1450,hijriEnd:1451,deleted:false}],
    terms: [{id:'term:another-year',yearId:'year:another',index:1,status:'active',deleted:false}],
    teachings: [
      { id: 'tch:preview-current', termId: first.id, deleted: false },
      { id: 'tch:preview-future', termId: second.id, deleted: false },
      { id: 'tch:preview-old', termId: 'term:another-year', deleted: false },
    ],
    slots: [
      { id: 'sl:preview-1', teachingId: 'tch:preview-current', weekday: 3, period: 1, deleted: false },
      { id: 'sl:preview-2', teachingId: 'tch:preview-current', weekday: 3, period: 2, deleted: false },
      { id: 'sl:preview-future', teachingId: 'tch:preview-future', weekday: 3, period: 3, deleted: false },
    ],
    sessions: [
      { id: 'se:preview-current', teachingId: 'tch:preview-current', date: '2026-09-23', period: 1, deleted: false },
      { id: 'se:preview-old', teachingId: 'tch:preview-old', date: '2026-09-23', period: 4, deleted: false },
    ],
  });
  const before = await db.getAll('sessions');
  const affected = getAffectedSchedule('2026-09-23', '2026-09-26');
  assert.deepEqual(affected.map(({ id, type }) => [id, type]), [['se:preview-current', 'session'], ['sl:preview-2', 'slot']]);
  assert.deepEqual(await db.getAll('sessions'), before, 'Preview must be read-only');
  assert.ok(store.calendarRangesOf().some((range) => range.startDate <= '2026-09-23' && range.endDate >= '2026-09-23' && range.source?.startsWith('preset:')), 'National Day retains official range identity');
  assert.ok(calendarView.render().value.includes('data-filter="upcoming"'), 'Default Calendar filter remains upcoming');
});


test('N101 missing calendar parents stop the complete batch before memory or durable writes',async()=>{
  await db.clearAll();store.state.ready=false;await store.init();
  const before=await db.getAll('sessions'),outbox=await db.getAll('outbox'),memory=structuredClone(store.state.sessions),teachings=structuredClone(store.state.teachings);
  await assert.rejects(store.save({teachings:[{id:'invalid:teaching',termId:'missing:term',deleted:false}],sessions:[{id:'invalid:session',teachingId:'invalid:teaching',date:'2026-10-14',period:1,deleted:false}]}),/تعذّر تحديد تقويم الحصة/);
  assert.deepEqual(await db.getAll('sessions'),before);assert.deepEqual(await db.getAll('outbox'),outbox);assert.deepEqual(store.state.sessions,memory);assert.deepEqual(store.state.teachings,teachings);
});
