import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNeedsAttention } from '../src/views/home.js';

test('Needs attention includes only due incomplete sessions, excludes the focus, and caps at two', () => {
  const sessions = [
    { id: 'older', endTime: '07:45', status: 'scheduled' },
    { id: 'newer', endTime: '08:45', status: 'scheduled' },
    { id: 'latest', endTime: '09:30', status: 'scheduled' },
    { id: 'future', endTime: '10:30', status: 'scheduled' },
    { id: 'complete', endTime: '08:30', status: 'scheduled' },
    { id: 'cancelled', endTime: '09:00', status: 'cancelled' },
  ];
  const now = new Date(2026, 8, 9, 9, 15);
  const attendanceState = (session) => session.id === 'complete' ? 'completed' : 'pending';

  const ids = (items) => items.map((session) => session.id);
  assert.deepEqual(ids(selectNeedsAttention(sessions, { now, attendanceState })), ['newer', 'older']);
  assert.deepEqual(ids(selectNeedsAttention(sessions, {
    now, attendanceState, excludeSessionId: 'newer',
  })), ['older']);
  assert.deepEqual(ids(selectNeedsAttention(sessions, { now, attendanceState, limit: 1 })), ['newer']);
});

test('Needs attention waits for the local scheduled end time', () => {
  const sessions = [{ id: 'later', endTime: '09:30', status: 'scheduled' }];
  assert.deepEqual(selectNeedsAttention(sessions, {
    now: new Date(2026, 8, 9, 9, 29),
  }).map((session) => session.id), []);
  assert.deepEqual(selectNeedsAttention(sessions, {
    now: new Date(2026, 8, 9, 9, 30),
  }).map((session) => session.id), ['later']);
});
