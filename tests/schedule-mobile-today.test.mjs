import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMobileScheduleDay } from '../src/views/schedule.js';

test('Schedule defaults to Today only on a teachable school day', () => {
  assert.equal(defaultMobileScheduleDay({ today: 0 }), '0');
  assert.equal(defaultMobileScheduleDay({ today: 4 }), '4');
  assert.equal(defaultMobileScheduleDay({ today: 5 }), 'all');
  assert.equal(defaultMobileScheduleDay({ today: 6 }), 'all');
  assert.equal(defaultMobileScheduleDay({ today: 2, calendarKind: 'holiday' }), 'all');
});
