import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsv, previewStudentRows, readStudentFile, validateRows, validateXlsxArchive, importContext, confirmStudentImport } from '../src/lib/student-import.js';

test('Arabic UTF-8 BOM, quoted commas, escaped quotes and multiline cells', () => {
  const rows = parseCsv('\uFEFFاسم الطالب,درجة\r\n"طالب، عربي",9\r\n"طالب ""اختبار""",8\r\n"طالب\nجديد",7');
  const preview = previewStudentRows(rows, 0, true, []);
  assert.deepEqual(preview.names, ['طالب، عربي', 'طالب "اختبار"', 'طالب جديد']);
  assert.deepEqual(preview.counts, { new: 3, existing: 0, ambiguous: 0, invalid: 0 });
});

test('existing names and all repeated occurrences are never silently added', () => {
  const rows = [['الاسم'], ['سالم أحمد'], ['سالم  أحمد'], ['مُحمد علي'], ['طالب جديد'], ['123'], [null], ['=HYPERLINK("x")'], ['x'.repeat(81)], ['طالب\u202E']];
  const preview = previewStudentRows(rows, 0, true, [{ name: 'محمد علي' }]);
  assert.deepEqual(preview.counts, { new: 1, existing: 1, ambiguous: 2, invalid: 5 });
  assert.deepEqual(preview.names, ['طالب جديد']);
  assert.equal(previewStudentRows([['اسم مشترك']], 0, false, [{ name: 'اسم مشترك' }, { name: 'اسم مشترك' }]).counts.ambiguous, 1);
});

test('explicit column and header choices; grade cells never enter names', () => {
  const rows = parseCsv('رقم;اسم الطالب;درجة\n1;طالب أول;10\n2;طالب ثان;8');
  assert.deepEqual(previewStudentRows(rows, 1, true, []).names, ['طالب أول', 'طالب ثان']);
  assert.equal(previewStudentRows([['طالب أول']], 0, false, []).counts.new, 1);
});

test('bounded rows, cells and files; malformed CSV and invalid UTF-8 rejected', async () => {
  assert.throws(() => parseCsv('"unclosed'));
  assert.throws(() => validateRows(Array.from({ length: 302 }, () => ['طالب'])));
  assert.throws(() => validateRows([Array(51).fill('طالب')]));
  assert.throws(() => previewStudentRows(Array.from({ length: 301 }, () => ['طالب']), 0, false, []));
  assert.throws(() => validateXlsxArchive(new ArrayBuffer(4)));
  await assert.rejects(readStudentFile(new File([new Uint8Array([255])], 'test.csv')));
  await assert.rejects(readStudentFile(new File(['x'.repeat(1048577)], 'test.csv')));
  await assert.rejects(readStudentFile(new File(['طالب'], 'test.xls')));
});

const demo = { id: 'demo', databaseName: 'demo', type: 'demo', ownershipState: 'demo' };
const teaching = { id: 'teaching', sectionId: 'section' };

test('real XLSX Arabic sheet reads names only; sparse huge row addresses rejected before parsing', async () => {
  const bytes = await readFile(new URL('./n12-students.xlsx', import.meta.url));
  const rows = await readStudentFile(new File([bytes], 'synthetic.xlsx'));
  assert.deepEqual(previewStudentRows(rows, 0, true, []).names, ['طالب إكسل اصطناعي']);
  assert.equal(rows[1][1], 9);
  const sparse = await readFile(new URL('./n12-sparse-oversized.xlsx', import.meta.url));
  await assert.rejects(readStudentFile(new File([sparse], 'synthetic.xlsx')));
});

test('account owner and context guard, including Demo parity', () => {
  assert.ok(importContext(demo, teaching, null));
  const workspace = { id: 'account', databaseName: 'account-db', type: 'account', ownershipState: 'claimed', authUserId: 'A' };
  assert.ok(importContext(workspace, teaching, 'A'));
  assert.equal(importContext(workspace, teaching, 'B'), null);
  assert.equal(importContext({ ...workspace, ownershipState: 'unresolved' }, teaching, 'A'), null);
  assert.equal(importContext(demo, { ...teaching, status: 'archived' }, null), null);
});

test('cancel, duplicate no-op and owner/roster drift perform zero writes; confirmation writes only approved names', async () => {
  let writes = 0, received;
  const preview = previewStudentRows([['طالب جديد', 99]], 0, false, []);
  const options = { approved: true, preview, currentPreview: preview, expectedContext: 'A', currentContext: 'A', write: async (names) => { writes++; received = names; return { added: names.length }; } };
  await confirmStudentImport({ ...options, approved: false });
  await confirmStudentImport({ ...options, currentContext: 'B' });
  const noOp = previewStudentRows([['طالب موجود']], 0, false, [{ name: 'طالب موجود' }]);
  await confirmStudentImport({ ...options, preview: noOp, currentPreview: noOp });
  await assert.rejects(confirmStudentImport({ ...options, currentPreview: previewStudentRows([['طالب جديد', 99]], 0, false, [{ name: 'طالب جديد' }]) }));
  assert.equal(writes, 0);
  assert.deepEqual(await confirmStudentImport(options), { added: 1 });
  assert.deepEqual(received, ['طالب جديد']);
});
