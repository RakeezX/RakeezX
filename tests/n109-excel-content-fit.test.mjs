// AI-authored N109: inspect actual generated OOXML and use the application's XLSX reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportGradeXlsx } from '../src/lib/grade-transfer-xlsx.js';
import { gradeExportRows } from '../src/lib/grade-transfer-export.js';
import { unzipSync, strFromU8, readSheet } from '../src/lib/student-import-parsers.js';
import { validateXlsxArchive } from '../src/lib/student-import.js';

const fixture = (names = ['علي'], titles = ['أ', 'ب']) => ({
  roster: names.map((name, i) => ({ id: String(i), name })),
  items: titles.map((name, i) => ({ id: String(i), name, max: 100 })),
  ctx: Object.fromEntries(names.map((_, i) => [String(i), { scoresByItem: { 0: { value: 0 }, 1: { value: 12.5 } } }]))
});
function inspect(input) {
  const bytes = exportGradeXlsx(input);
  validateXlsxArchive(bytes.buffer);
  const files = unzipSync(bytes), sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  return {
    bytes, files, sheet,
    widths: [...sheet.matchAll(/<col min="(\d+)" max="\d+" width="([\d.]+)" customWidth="1"\/>/g)].map(m => +m[2]),
    heights: [...sheet.matchAll(/<row r="\d+" ht="([\d.]+)" customHeight="1">/g)].map(m => +m[1])
  };
}

test('n109_content_based_per_column_width_without_waste_and_no_clipping', () => {
  const short = inspect(fixture());
  const longName = inspect(fixture(['أحمد محمد عبدالله عبدالرحمن عبدالعزيز إبراهيم سليمان الحربي الطويل']));
  const mixed = inspect(fixture(['علي'], ['أ', 'عنوان طويل جدًا لتقييم المهام الأدائية والمشاركة والتفاعل اليومي']));
  assert.ok(short.widths.every(w => w >= 4 && w < 24), JSON.stringify(short.widths));
  assert.ok(longName.widths[0] > short.widths[0]);
  assert.deepEqual(longName.widths.slice(1), short.widths.slice(1));
  assert.equal(mixed.widths[0], short.widths[0]);
  assert.equal(mixed.widths[1], short.widths[1]);
  assert.ok(mixed.widths[2] > mixed.widths[1]);
  assert.ok(mixed.widths[2] <= 36);
  assert.ok(mixed.heights[0] > short.heights[0]);
  // Blank and zero grade cells must not inflate widths beyond the actual header.
  const blank = inspect({ ...fixture(), blankTemplate: true });
  assert.deepEqual(blank.widths, short.widths);
  assert.deepEqual(inspect(fixture([], [])).widths, short.widths.slice(0, 1));
});

test('n109_per_row_height_short_rows_compact_and_long_wrap_readable', () => {
  const short = inspect(fixture());
  assert.deepEqual(short.heights, [18, 18]);
  const long = inspect(fixture(['أحمد محمد عبدالله عبدالرحمن عبدالعزيز إبراهيم سليمان الحربي الطويل']));
  assert.ok(long.heights[1] >= 48 && long.heights[1] < 100);
  const multiline = inspect(fixture(['علي\r\nمحمد\nخالد']));
  assert.equal(multiline.heights[1], 48);
  assert.deepEqual(multiline.widths, short.widths);
  const words = inspect(fixture(['WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW']));
  assert.ok(words.heights[1] >= 48);
  const marks = inspect(fixture(['عَلِيّ']));
  assert.deepEqual(marks.widths, short.widths);
  assert.equal(marks.heights[1], 18);
  // No capped height that silently loses text beyond Excel's physical row limit.
  assert.throws(() => exportGradeXlsx(fixture(['اسم\n'.repeat(28)])), /مساحة صف Excel/);
});

test('n109_arabic_RTL_header_name_scores_zero_blank_formula_safe', async () => {
  const names = ['=1+1', '+SUM(A1)', '@cmd', '-1', '\t=cmd', '\n=cmd', 'اسم <عربي> & "خاص"', 'عَلِيّ'];
  const input = fixture(names, ['أ', 'مشاركة الطالب العربية']);
  input.ctx['0'] = {};
  const out = inspect(input), rows = await readSheet(out.bytes.buffer);
  assert.match(out.sheet, /rightToLeft="1"/);
  assert.match(out.sheet, /state="frozen"/);
  const styles = strFromU8(out.files['xl/styles.xml']);
  assert.equal((styles.match(/wrapText="1" readingOrder="2"/g) ?? []).length, 2);
  assert.match(out.sheet, /t="n"><v>0<\/v>/);
  assert.match(out.sheet, /<c r="B\d+" s="0"\/>/);
  assert.match(out.sheet, /&lt;عربي&gt; &amp; &quot;خاص&quot;/);
  assert.doesNotMatch(Object.values(out.files).map(strFromU8).join(''), /<f\b|externalLink|TargetMode|macro/i);
  for (const name of names) assert.ok(rows.some(row => row[0] === name.trim()), name);
  assert.ok(rows.some(row => row[1] === 0));
  assert.ok(rows.some(row => row[1] === null));
});

test('n109_xlsx_roundtrip_300_rows_noor_csv_unchanged', async () => {
  const names = Array.from({ length: 300 }, (_, i) => i ? `طالب اصطناعي ${i}` : 'أحمد محمد عبدالله عبدالرحمن عبدالعزيز إبراهيم سليمان الحربي الطويل');
  const input = fixture(names, ['أ', 'تقويم المهارات العربية الطويل مع المشاركة والتفاعل والمهام والأنشطة']);
  input.ctx['2'] = {};
  const out = inspect(input), rows = await readSheet(out.bytes.buffer);
  assert.equal(rows.length, 301);
  assert.deepEqual(rows, gradeExportRows(input).map(row => row.map(value => value === '' ? null : value)));
  assert.equal(out.heights.length, 301);
  assert.ok(out.heights[0] > 18);
  assert.ok(out.heights.filter(h => h === 18).length >= 299);
  assert.ok(out.heights.every(h => h <= 409));
  assert.equal(Object.keys(out.files).length, 6);
  assert.deepEqual(exportGradeXlsx(input), out.bytes, 'deterministic byte-for-byte output');
  // The unchanged N108 suite checks the exact manual Noor 40/60 and CSV guard.
  assert.throws(() => exportGradeXlsx({ ...input, noorReview: true }));
  assert.throws(() => exportGradeXlsx({ ...input, includeIds: true }));
});
