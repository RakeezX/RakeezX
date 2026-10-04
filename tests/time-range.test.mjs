import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { formatTimeRange, fmtSessionTime, fmtTimeRange } from '../src/lib/dom.js';

test('session time display uses ASCII HH:mm without changing stored values', () => {
  const session = Object.freeze({ startTime: '08:02:00', endTime: '08:32:00' });
  assert.equal(fmtSessionTime(session.startTime), '08:02');
  assert.equal(fmtSessionTime(session.endTime), '08:32');
  assert.equal(fmtSessionTime('8:02'), '08:02');
  assert.equal(fmtSessionTime('٠٨:٠٢:٠٠'), '08:02');
  assert.equal(fmtSessionTime('۰۸:۳۲:۰۰'), '08:32');
  assert.equal(fmtSessionTime('08:30:00.250'), '08:30');
  assert.equal(fmtSessionTime('25:99:00'), '25:99:00');
  const markup = fmtTimeRange(session.startTime, session.endTime).value;
  assert.match(markup, /data-time-token="start">08:02</);
  assert.match(markup, /data-time-token="end">08:32</);
  assert.doesNotMatch(markup, /08:02:00|08:32:00/);
  assert.equal(formatTimeRange(session.startTime, session.endTime), '08:02 – 08:32');
  assert.deepEqual(session, { startTime: '08:02:00', endTime: '08:32:00' });
});

test('Home, Teaching and Attendance display paths do not interpolate raw session times', () => {
  for (const name of ['home.js', 'teaching-hub.js', 'attendance.js']) {
    const source = readFileSync(new URL(`../src/views/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\$\{\s*\w+\.(?:startTime|endTime)\s*\}/, name);
    assert.match(source, /fmtTimeRange\(/, name);
  }
  const attendance = readFileSync(new URL('../src/views/attendance.js', import.meta.url), 'utf8');
  assert.match(attendance, /fmtSessionTime\(entry\.startTime\)/);
  assert.match(attendance, /<bdi dir="ltr">\$\{fmtSessionTime/);
});

test('canonical time range text preserves chronological start-to-end order', () => {
  assert.equal(formatTimeRange('07:00', '07:45'), '07:00 – 07:45');
  assert.equal(formatTimeRange('09:00', '09:35'), '09:00 – 09:35');
  assert.equal(formatTimeRange('11:55', '12:30'), '11:55 – 12:30');
});
test('canonical time range markup keeps the range RTL and each time token LTR-safe', () => {
  const markup = fmtTimeRange('07:00', '07:45').value;
  assert.ok(markup.startsWith('<span class="time-range">'));
  assert.ok(!markup.includes('class="time-range" dir="ltr"'));
  assert.match(markup, /data-time-token="start">07:00/);
  assert.match(markup, /data-time-token="end">07:45/);
  assert.equal((markup.match(/class="time-range__token" dir="ltr"/g) ?? []).length, 2);
});
