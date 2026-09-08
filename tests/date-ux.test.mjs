import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtDate, fmtDateFull, fmtDateRange, fmtISODate } from '../src/lib/dom.js';
import { todayISO } from '../src/models.js';
import { reportHeader } from '../src/lib/report-print.js';
import { backupFilenameForDate } from '../src/lib/export.js';

const localDate = (year, month, day) => ({
  getFullYear: () => year,
  getMonth: () => month - 1,
  getDate: () => day,
});

test('Arabic date helpers render valid civil date keys without changing them', () => {
  assert.equal(fmtDateFull('2026-09-06'), '\u20686 سبتمبر 2026\u2069');
  assert.equal(fmtDate('2026-09-06'), '\u2068الأحد 6 سبتمبر 2026\u2069');
  assert.equal(fmtDate('not-a-date'), '');
  assert.match(String(fmtDateRange('2026-09-06', '2026-09-10')), /<bdi>6<\/bdi>.*<bdi>10 سبتمبر 2026<\/bdi>/);
  assert.equal(String(fmtISODate('2026-09-06')), '<bdi class="date-key tabular" dir="ltr">2026-09-06</bdi>');
  assert.equal(fmtISODate('2026-99-06'), '');
});

test('print and backup current-day labels use the local civil date at the Riyadh midnight boundary', () => {
  const justAfterMidnight = localDate(2026, 9, 6);
  assert.equal(todayISO(justAfterMidnight), '2026-09-06');
  assert.equal(backupFilenameForDate(justAfterMidnight), 'rakeezx-backup-2026-09-06.json');
  assert.match(String(reportHeader({ title: 'تقرير', printedOn: todayISO(justAfterMidnight) })), /6 سبتمبر 2026/);
});
