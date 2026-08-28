import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimeRange, fmtTimeRange } from '../src/lib/dom.js';

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
