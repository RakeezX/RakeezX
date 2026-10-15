// AI-authored: ZIP integrity, typed data and unchanged CSV/Noor contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportGradeXlsx } from '../src/lib/grade-transfer-xlsx.js';
import { exportGradeCsv, gradeExportRows, gradeCsvFilename } from '../src/lib/grade-transfer-export.js';
import { unzipSync, strFromU8 } from '../src/lib/student-import-parsers.js';
import { validateXlsxArchive, parseCsv } from '../src/lib/student-import.js';

export function fixture() {
  const names = ['أحمد محمد عبدالله عبدالرحمن عبدالعزيز إبراهيم سليمان الحربي الطويل', '=1+1', '+SUM(A1)', '@cmd', '-1', '\t=cmd', '\n=cmd', 'اسم <عربي> & "خاص"'];
  const roster = Array.from({ length: 300 }, (_, n) => ({ id: 'private-id-' + n, name: names[n] ?? `طالب اصطناعي ${n}` }));
  const items = [{ id: 'a', name: 'عنوان المعلم الطويل لتقييم المهام الأدائية والمشاركة والتفاعل اليومي', max: 40 }, { id: 'b', name: 'تقويمات تحريرية وتطبيقات عملية', max: 60 }];
  const ctx = Object.fromEntries(roster.map((s, index) => [s.id, { scoresByItem: index % 2 ? {} : { a: { value: 0 }, b: { value: 12.5 } } }]));
  return { roster, items, ctx, className: 'الرابع / أ' };
}
test('stored ZIP has valid CRC, fixed bounded parts, no active content and readable widths', () => {
  const input = fixture(), bytes = exportGradeXlsx(input);
  validateXlsxArchive(bytes.buffer);
  const files = unzipSync(bytes), sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.equal(Object.keys(files).length, 6);
  assert.match(sheet, /rightToLeft="1"/); assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /width="55"/); assert.match(sheet, /width="40"/);
  assert.equal((sheet.match(/<row /g) ?? []).length, 301);
  assert.match(sheet, /t="n"><v>0<\/v>/); assert.match(sheet, /<c r="B\d+" s="0"\/>/);
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=1\+1/);
  assert.match(sheet, /&lt;عربي&gt; &amp; &quot;خاص&quot;/);
  const all = Object.values(files).map(strFromU8).join('');
  assert.doesNotMatch(all, /<f\b|externalLink|TargetMode|macro|private-id-|token/i);
  assert.match(all, /wrapText="1"/);
  // Check CRC independently from ZIP decompression, which need not validate it.
  const view = new DataView(bytes.buffer); let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true), start = pos + 30 + view.getUint16(pos + 26, true);
    let crc = -1;
    for (const byte of bytes.slice(start, start + size)) { crc ^= byte; for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
    assert.equal((crc ^ -1) >>> 0, view.getUint32(pos + 14, true)); pos = start + size;
  }
  assert.equal(view.getUint32(pos, true), 0x02014b50);
});
test('CSV and exact manual Noor 40/60 preserve injection guard, zero, missing and filenames', () => {
  const input = fixture(), rows = parseCsv(exportGradeCsv(input));
  assert.equal(rows.length, 301); assert.ok(rows.some(r => r[0] === "'=1+1"));
  assert.ok(rows.some(r => r[1] === '0')); assert.ok(rows.some(r => r[1] === ''));
  const noor = parseCsv(exportGradeCsv({ ...input, noorReview: true, noorGroups: { a: '40', b: '60' }, noorConfirmed: true }));
  assert.ok(noor.every(row => row.length === 3)); assert.ok(noor.some(row => row[1] === '0' && row[2] === '12.5'));
  assert.ok(noor.some(row => row[1] === '' && row[2] === ''));
  assert.deepEqual(gradeExportRows({ ...input, roster: [], items: [] }), [['اسم الطالب']]);
  assert.equal(gradeCsvFilename({ className: input.className, namesOnly: true }), 'كشف أسماء طلاب فصل الرابع أ - ركيز المعلم.csv');
  assert.throws(() => exportGradeXlsx({ ...input, includeIds: true }));
});
