import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimeRange } from '../src/lib/dom.js';

test('canonical time range text preserves chronological start-to-end order', () => {
  assert.equal(formatTimeRange('07:00', '07:45'), '07:00 – 07:45');
  assert.equal(formatTimeRange('09:00', '09:35'), '09:00 – 09:35');
  assert.equal(formatTimeRange('11:55', '12:30'), '11:55 – 12:30');
});