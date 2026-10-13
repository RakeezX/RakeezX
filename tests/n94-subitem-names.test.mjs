import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSubitemName } from '../src/lib/subitem-default-name.js';

test('known parent intent, whitespace and diacritics', () => {
  for (const parent of ['الواجبات','الواجب','واجبات','واجب','  الوَاجِبَات  ']) {
    assert.equal(defaultSubitemName(parent), 'واجب1');
    assert.equal(defaultSubitemName(parent, [{name:'واجب1'}]), 'واجب2');
  }
  for (const parent of ['المشاريع','المشروع','مشاريع','مشروع','  المَشَارِيع  '])
    assert.equal(defaultSubitemName(parent), 'مشروع1');
});
test('first unused suffix, readable unknown parent, immutable inputs', () => {
  const rows = [{name:'واجب1',id:'old'}, {name:'واجب٣'}, {name:'اسمي المخصص'}];
  const before = structuredClone(rows);
  assert.equal(defaultSubitemName('الواجبات',rows),'واجب2');
  assert.deepEqual(rows,before);
  assert.equal(defaultSubitemName('التجارب العلمية',[{name:'التجارب العلمية 1'}]),'التجارب العلمية 2');
  assert.equal(defaultSubitemName('  نشاط مُميّز  '),'نشاط مُميّز 1');
});
