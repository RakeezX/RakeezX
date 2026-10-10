import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { crossClassCSVRows } from '../src/views/cross-class-reports.js';
import { safeReportCSVText, toCSV } from '../src/lib/export.js';

test('N70 CSV contains only visible fields, preserves actual zero and leaves missing scores blank', () => {
  const rows = [
    { s: { id: 'private-student-id', name: '=A1,"طالب"\nثان' }, section: 'الرابع أ', subject: 'رياضيات',
      teaching: { id: 'private-teaching-id' }, total: { earned: 0, outOfGraded: 10, pct: 0, missing: 1 }, reasons: ['الدرجات دون 50٪'] },
    { s: { id: 'hidden-id', name: 'طالب ثان' }, section: 'الرابع ب', subject: 'علوم',
      total: { earned: 0, outOfGraded: 0, pct: null, missing: 2 }, reasons: ['لم يُرصد له شيء'] },
  ];
  const grades = crossClassCSVRows(rows, false);
  assert.deepEqual(grades[1].slice(3), [0, 10, 0, '1 بنود غير مرصودة']);
  assert.deepEqual(grades[2].slice(3), ['', '', '', '2 بنود غير مرصودة']);
  const followup = crossClassCSVRows(rows, true);
  assert.deepEqual(followup[1].slice(3), [0, 0, 10, 'الدرجات دون 50٪']);
  assert.deepEqual(followup[2].slice(3), ['', '', '', 'لم يُرصد له شيء']);
  for (const csv of [toCSV(grades), toCSV(followup)]) {
    assert.match(csv, /"'=A1,""طالب""\nثان"/);
    assert.doesNotMatch(csv, /private-student-id|private-teaching-id|hidden-id/);
  }
  const dangerous = crossClassCSVRows([{ ...rows[0], subject: ' @SUM(1)', reasons: ['\t=1+1'] }], true);
  assert.equal(dangerous[1][2], "' @SUM(1)");
  assert.equal(dangerous[1][6], "'\t=1+1");
});

test('N70 report text guard blocks formula prefixes after leading whitespace and controls', () => {
  for (const input of ['=1+1', '+cmd', '-cmd', '@SUM(1)', ' \t\r\n=1', '\u0000@x', '\u200f=1']) {
    assert.ok(safeReportCSVText(input).startsWith("'"), JSON.stringify(input));
  }
  assert.equal(safeReportCSVText('طالب، عادي'), 'طالب، عادي');
  assert.equal(toCSV([['طالب,"اسم"\nآخر']]), '"طالب,""اسم""\nآخر"');
  assert.equal(toCSV([['عربي']]), 'عربي');
});

test('N70 normal and archive actions retain separate locations and one button each', () => {
  const execution = readFileSync(new URL('../src/views/execution-report.js', import.meta.url), 'utf8');
  const crossClass = readFileSync(new URL('../src/views/cross-class-reports.js', import.meta.url), 'utf8');
  assert.match(execution, /execution-report-head-actions[\s\S]*data-act="print"[\s\S]*data-act="csv"/);
  assert.match(execution, /archiveRoute \? html`<div class="btn-row mt-6 noprint report-actions">[\s\S]*data-act="print"[\s\S]*data-act="csv"/);
  assert.match(crossClass, /n70-head-actions[\s\S]*data-act="n70-print"[\s\S]*data-act="n70-csv"/);
  assert.match(crossClass, /if \(!rows.length\) \{ toast\('لا نتائج للتصدير', 'warn'\); return; \}/);
  assert.match(crossClass, /markDemoExportRows\(crossClassCSVRows\(rows, isFollowup\)\)/);
  const css = readFileSync(new URL('../src/styles/work-n70.css', import.meta.url), 'utf8');
  assert.match(css, /\.execution-report-head-actions \{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.n70-head-actions \{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.execution-report-head-actions \.btn,\.n70-head-actions \.btn \{ min-height:44px; \}/);
  assert.match(css, /@media\(max-width:540px\)/);
  assert.match(css, /\.n70-head-actions \{ width:100%; \}/);
});
