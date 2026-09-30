import assert from 'node:assert/strict';
import test from 'node:test';
import { officialRangeChoices } from '../src/lib/calendar-range-choices.js';

test('official selector groups one multi-day range and keeps separated same-name ranges distinct', () => {
  const source = 'preset:general';
  const rows = [
    { id: 'national', source, kind: 'national', label: 'إجازة اليوم الوطني', startDate: '2026-09-23', endDate: '2026-09-26' },
    { id: 'national', source, kind: 'national', label: 'إجازة اليوم الوطني', startDate: '2026-09-24', endDate: '2026-09-24' },
    { id: 'legacy:oct', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2026-10-25', endDate: '2026-10-25' },
    { id: 'legacy:nov-1', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2026-11-28', endDate: '2026-11-28' },
    { id: 'legacy:nov-2', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2026-11-29', endDate: '2026-11-29' },
    { id: 'legacy:apr', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2027-04-11', endDate: '2027-04-11' },
  ];
  const original = structuredClone(rows);
  const choices = officialRangeChoices(rows);
  assert.deepEqual(rows, original, 'normalization cannot mutate official source rows');
  assert.equal(choices.length, 4);
  assert.equal(choices.filter((choice) => choice.label === 'إجازة اليوم الوطني').length, 1);
  assert.deepEqual(choices.filter((choice) => choice.label === 'إجازة نهاية أسبوع مطولة')
    .map(({ startDate, endDate }) => [startDate, endDate]), [
    ['2026-10-25', '2026-10-25'],
    ['2026-11-28', '2026-11-29'],
    ['2027-04-11', '2027-04-11'],
  ]);
});

test('separate range IDs stay separate even when same-name holidays are adjacent', () => {
  const source = 'preset:general';
  const rows = [
    { id: 'preset:oct-1', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2026-10-25', endDate: '2026-10-25' },
    { id: 'preset:oct-2', source, kind: 'holiday', label: 'إجازة نهاية أسبوع مطولة', startDate: '2026-10-26', endDate: '2026-10-26' },
  ];
  assert.equal(officialRangeChoices(rows).length, 2);
});
