import assert from 'node:assert/strict';
import {gradeCsvFilename,exportGradeCsv,exportNamesTemplate} from '../src/lib/grade-transfer-export.js';
import {parseCsv} from '../src/lib/student-import.js';
assert.equal(gradeCsvFilename({className:'رابع / 1',namesOnly:true}),'كشف أسماء طلاب فصل رابع 1 - ركيز المعلم.csv');
assert.equal(gradeCsvFilename({className:'خامس ألف'}),'كشف درجات طلاب فصل خامس ألف - ركيز المعلم.csv');
assert.equal(gradeCsvFilename({className:'خامس ألف',noorReview:true}),'كشف رصد نور فصل خامس ألف - ركيز المعلم.csv');
assert.equal(gradeCsvFilename({blankTemplate:true}),'نموذج أسماء الطلاب - ركيز المعلم.csv');
for(const className of [' /\\:*?"<>|\r\n\tفصل  أ  ','x'.repeat(300),'.','\u202eفصل\u0000']){const f=gradeCsvFilename({className});assert.doesNotMatch(f,/[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u202e]/);assert.ok(f.length<150);}
const empty=exportNamesTemplate();assert.equal(empty.charCodeAt(0),0xfeff);const rows=parseCsv(empty);assert.deepEqual(rows[0],['اسم الطالب']);assert.ok(rows.slice(1).every(r=>r.every(v=>v==='')));
const roster=[{id:'secret-student-id',name:'=CMD()'}],items=[{id:'i',name:'+formula',max:10}];
const csv=exportGradeCsv({roster,items,ctx:{'secret-student-id':{scoresByItem:{}}}});assert.equal(csv.charCodeAt(0),0xfeff);assert.doesNotMatch(csv,/secret-student-id/);assert.match(csv,/['‘]=CMD/);assert.match(csv,/['‘]\+formula/);
assert.match(exportGradeCsv({roster,items,ctx:{'secret-student-id':{scoresByItem:{}}},includeIds:true}),/secret-student-id/);
assert.deepEqual(parseCsv(exportGradeCsv({roster,items:[],ctx:{'secret-student-id':{scoresByItem:{}}}}))[0],['اسم الطالب']);
console.log('PASS safe class filenames, empty template, BOM, formula escaping, plain and optional-ID CSV');
