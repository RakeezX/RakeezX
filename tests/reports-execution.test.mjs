import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

async function setup() {
  await db.clearAll(); await store.init();
  await store.save({
    years: [{ id: 'y:r', label: 'TEST' }], terms: [{ id: 'tm:r', yearId: 'y:r', name: 'الفصل الأول' }], subjects: [{ id: 'sub:r', name: 'رياضيات' }],
    sections: [{ id: 'sec:r', yearId: 'y:r', grade: 4, label: 'أ' }], teachings: [{ id: 'tch:r', sectionId: 'sec:r', subjectId: 'sub:r', termId: 'tm:r' }],
    students: [{ id: 'st:r1', name: 'طالب ١' }, { id: 'st:r2', name: 'طالب ٢' }], enrollments: [{ id: 'en:r1', studentId: 'st:r1', sectionId: 'sec:r', status: 'active' }, { id: 'en:r2', studentId: 'st:r2', sectionId: 'sec:r', status: 'active' }],
    slots: [{ id: 'sl:r', teachingId: 'tch:r', weekday: 0, period: 1 }],
    sessions: [
      { id: 'ses:done', teachingId: 'tch:r', slotId: 'sl:r', date: '2026-08-23', period: 1, startTime: '07:00', endTime: '07:45' },
      { id: 'ses:pending', teachingId: 'tch:r', date: '2026-08-24', period: 2, startTime: '07:00', endTime: '07:45' },
      { id: 'ses:future', teachingId: 'tch:r', date: '2026-08-25', period: 1, startTime: '07:00', endTime: '07:45' },
      { id: 'ses:holiday', teachingId: 'tch:r', date: '2026-08-24', period: 3, status: 'cancelled_holiday' },
    ],
    attendance: [{ id: 'at:r1', studentId: 'st:r1', sessionId: 'ses:done' }, { id: 'at:r2', studentId: 'st:r2', sessionId: 'ses:done' }],
  });
  await store.patchDevice({ activeYearId: 'y:r', activeTermId: 'tm:r' });
}

test('execution report counts historical completed/pending/future sessions without treating future or holidays as debt', async () => {
  await setup();
  const report = store.executionReport({ yearId: 'y:r', termId: 'tm:r', reference: new Date('2026-08-24T12:00:00') });
  assert.deepEqual(report.counts, { generated: 4, completed: 1, pending: 1, future: 1, excluded: 1 });
  assert.equal(report.percentage, 50);
  await store.editSlot('sl:r', { teachingId: 'tch:r', weekday: 1, period: 4 });
  assert.equal(store.executionReport({ yearId: 'y:r', termId: 'tm:r', reference: new Date('2026-08-24T12:00:00') }).rows.find((r) => r.session.id === 'ses:done').session.startTime, '07:00');
  await store.editSection('sec:r', { grade: 5, label: 'ب' });
  assert.equal(store.executionReport({ yearId: 'y:r', termId: 'tm:r' }).rows[0].section.label, 'ب');
});

after(async () => { store.closeChannel(); await db.closeDB(); });