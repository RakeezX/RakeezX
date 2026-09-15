import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMobileScheduleDay, weeklySessionsLabel } from '../src/views/schedule.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

after(() => {
  store.closeChannel();
  db.closeDB();
});

test('Schedule defaults to Today only on a teachable school day', () => {
  assert.equal(defaultMobileScheduleDay({ today: 0 }), '0');
  assert.equal(defaultMobileScheduleDay({ today: 4 }), '4');
  assert.equal(defaultMobileScheduleDay({ today: 5 }), 'all');
  assert.equal(defaultMobileScheduleDay({ today: 6 }), 'all');
  assert.equal(defaultMobileScheduleDay({ today: 2, calendarKind: 'holiday' }), 'all');
});

test('Schedule uses natural Arabic weekly-session wording', () => {
  assert.equal(weeklySessionsLabel(1), 'حصة واحدة أسبوعيًا');
  assert.equal(weeklySessionsLabel(2), 'حصتان أسبوعيًا');
  assert.equal(weeklySessionsLabel(3), '3 حصص أسبوعيًا');
  assert.equal(weeklySessionsLabel(10), '10 حصص أسبوعيًا');
  assert.equal(weeklySessionsLabel(11), '11 حصة أسبوعيًا');
});
