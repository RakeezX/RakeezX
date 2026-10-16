// AI: verify the actual binary bundle and manual names-only interpretation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classKoshoofBundle } from '../src/lib/class-koshoof-bundle.js';
import { unzipSync, strFromU8 } from '../src/lib/student-import-parsers.js';
import { detectClassNameColumn, classGroups } from '../src/lib/class-import-file.js';
const entry = (name, className = 'الرابع / أ') => ({className, roster:[{id:'private-student', name}],items:[{id:'exam',name:'اختبار طويل عربي',max:20}],ctx:{'private-student':{scoresByItem:{exam:{value:0}}}}});
const sheet = bytes => strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
test('separate binary workbooks, UTF8 collision-safe sanitized filenames, zero/blank/RTL, no identity or formula',()=>{
 const a=entry('طالب الأول'), b=entry('طالب الثاني'); b.roster.push({id:'secret',name:'=SUM(A1)'}); b.ctx.secret={scoresByItem:{}};
 const files=classKoshoofBundle([a,b],false),names=files.map(f=>f.filename);
 assert.ok(files.every(f=>f.type.endsWith('spreadsheetml.sheet')));assert.equal(names.length,2);assert.notEqual(names[0],names[1]);
 assert.ok(names.every(n=>n.endsWith('.xlsx')&&!/[\\/:*?"<>|]/.test(n)));
 const first=sheet(files[0].bytes),second=sheet(files[1].bytes);
 assert.match(first,/طالب الأول/);assert.doesNotMatch(first,/طالب الثاني/);assert.match(second,/طالب الثاني/);assert.doesNotMatch(second,/طالب الأول/);
 for(const xml of [first,second]) {assert.match(xml,/rightToLeft="1"/);assert.match(xml,/width="55"/);assert.match(xml,/<v>0<\/v>/);assert.doesNotMatch(xml,/private-student|secret|token|<f\b/);}
 assert.match(second,/<c r="B\d+" s="0"\/>/);assert.match(second,/inlineStr.*=SUM\(A1\)/);
 const namesOnly=classKoshoofBundle([a])[0];assert.ok(namesOnly.filename.endsWith('.xlsx'));assert.doesNotMatch(sheet(namesOnly.bytes),/اختبار طويل عربي|<v>0/);
 assert.throws(()=>classKoshoofBundle([]));
});
test('manual class metadata independent from file; name detection, ambiguity, first student preserved and unsafe preview',()=>{
 const rows=[['الصف','الفصل','المادة','اسم الطالب'],[6,'ب','العلوم','أحمد علي']];
 const detected=detectClassNameColumn(rows),group=classGroups(rows,{...detected,manual:{grade:4,label:'أ',subject:'الرياضيات'}})[0];
 assert.equal(group.grade,4);assert.equal(group.label,'أ');assert.equal(group.subject,'الرياضيات');assert.deepEqual(group.preview.names,['أحمد علي']);
 const noHeader=[['أحمد علي'],['محمد صالح']];assert.equal(detectClassNameColumn(noHeader).header,-1);
 assert.deepEqual(classGroups(noHeader,{...detectClassNameColumn(noHeader),manual:{grade:4,label:'ج',subject:'العلوم'}})[0].preview.names,['أحمد علي','محمد صالح']);
 assert.equal(detectClassNameColumn([['اسم الطالب','الاسم'],['أحمد','محمد']]).mapping.name,-1);
 const bad=[['اسم الطالب'],['أحمد علي'],['أحمد  علي'],['=CMD()']];const p=classGroups(bad,{...detectClassNameColumn(bad),manual:{grade:4,label:'أ',subject:'العلوم'}})[0].preview;
 assert.equal(p.counts.ambiguous,2);assert.equal(p.counts.invalid,1);assert.equal(p.names.length,0);
});
