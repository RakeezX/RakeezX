// AI: real CSV/XLSX parser inputs, explicit mapping and separate class identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readClassFile, detectClassColumns, classGroups } from '../src/lib/class-import-file.js';
const grouped = rows => classGroups(rows, detectClassColumns(rows));
test('CSV BOM, Arabic digits, subject aliases, repeated/invalid names and same name in different classes', async () => {
  const rows = await readClassFile(new File(['\uFEFFالصف,الفصل,المادة,اسم الطالب\n٤,أ,رياضيات,أحمد علي\n4,أ,الرياضيات,أحمد  علي\n4,أ,الرياضيات,123\n4,ب,العلوم,أحمد علي'], 'classes.csv'));
  const groups = grouped(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].preview.counts.ambiguous, 2);
  assert.equal(groups[0].preview.counts.invalid, 1);
  assert.deepEqual(groups[1].preview.names, ['أحمد علي']);
});
test('real XLSX reused vetted parser, alternative headers and manual missing context; optional no names', async () => {
  const rows = await readClassFile(new File([await readFile(new URL('./n12-students.xlsx', import.meta.url))], 'classes.xlsx'));
  const detected = detectClassColumns(rows);
  const groups = classGroups(rows, { ...detected, manual: { grade: 4, label: 'أ', subject: 'العلوم' } });
  assert.deepEqual(groups[0].preview.names, ['طالب إكسل اصطناعي']);
  assert.equal(groups[0].error, '');
  assert.equal(grouped([['Grade','Section','Subject'],[5,'أ','Math']])[0].preview.names.length, 0);
  assert.equal(grouped([['Grade','Section','Subject'],[99,'أ','Math']])[0].grade, null);
  assert.ok(grouped([['Grade','Section','Subject'],['أول','أ','Math']])[0].error);
  assert.ok(grouped([['Grade','Section','Subject'],[4,'','Math']])[0].error);
  assert.ok(grouped([['Grade','Section','Subject'],[4,'أ','=evil']])[0].error);
  assert.throws(()=>classGroups(rows,{...detected,mapping:{grade:0,label:0,subject:-1,name:-1}}));
});
test('same vetted 1MB, 300 student rows, 50 columns and archive bounds', async () => {
  for (const file of [new File(['x'.repeat(1048577)],'bad.csv'),new File(['الصف\n'+Array(301).fill('4').join('\n')],'bad.csv'),new File([Array(51).fill('x').join(',')],'bad.csv'),new File(['not a zip'],'bad.xlsx')]) await assert.rejects(readClassFile(file));
});
test('school metadata must match explicitly; mixed or unknown schools are rejected',()=>{
  const rows=[['المدرسة','الصف','الفصل','المادة'],['مدرسة أ',4,'أ','الرياضيات']];
  assert.throws(()=>grouped(rows));
  assert.throws(()=>classGroups(rows,{...detectClassColumns(rows),schoolName:'مدرسة ب'}));
  assert.equal(classGroups(rows,{...detectClassColumns(rows),schoolName:'مدرسة أ'}).length,1);
  assert.throws(()=>classGroups([...rows,['مدرسة ب',4,'ب','العلوم']],{...detectClassColumns(rows),schoolName:'مدرسة أ'}));
});
