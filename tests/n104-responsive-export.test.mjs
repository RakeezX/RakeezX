// AI-authored focused N104/N107 presentation and data-preservation checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {classKoshoofBundle} from '../src/lib/class-koshoof-bundle.js';
import {gradeCsvFilename,exportNoorReview} from '../src/lib/grade-transfer-export.js';
import {exportGradeXlsx} from '../src/lib/grade-transfer-xlsx.js';
import {unzipSync,strFromU8} from '../src/lib/student-import-parsers.js';
const base='7fb1bd31eab8f1838db71f16e37fc9a57aceae1b';
const before=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const current=async f=>(await readFile(f,'utf8')).replace(/\r\n/g,'\n');
const entry={className:'الرابع الابتدائي / 1 · المهارات الرقمية · 1448-1449 · الفصل الدراسي الأول',filenameClassName:'الرابع الابتدائي 1 · المهارات الرقمية',year:'1448-1449',term:'الفصل الدراسي الأول',subject:'المهارات الرقمية',roster:[{id:'s1',name:'Synthetic one'},{id:'s2',name:'Synthetic two'}],items:[{id:'exam',name:'Exam',max:20}],ctx:{s1:{scoresByItem:{exam:{value:0}}},s2:{scoresByItem:{exam:{value:19}}}}};
test('short safe identity, collisions and exactly unchanged workbook bytes/rows/scores',()=>{
 const files=classKoshoofBundle([entry,entry],false);
 assert.equal(classKoshoofBundle([entry])[0].filename,'كشف أسماء طلاب الرابع الابتدائي 1 · المهارات الرقمية - ركيز المعلم.xlsx');
 assert.equal(files[0].filename,'كشف درجات طلاب الرابع الابتدائي 1 · المهارات الرقمية - ركيز المعلم.xlsx');
 assert.match(files[1].filename,/ \(2\)\.xlsx$/);
 assert.deepEqual(files[0].bytes,exportGradeXlsx({...entry,includeIds:false,noorReview:false}));
 assert.deepEqual(classKoshoofBundle([entry])[0].bytes,exportGradeXlsx({...entry,items:[],includeIds:false,noorReview:false}));
 const xml=strFromU8(unzipSync(files[0].bytes)['xl/worksheets/sheet1.xml']);
 assert.match(xml,/Synthetic one/);assert.match(xml,/Synthetic two/);assert.match(xml,/<v>0<\/v>/);assert.match(xml,/<v>19<\/v>/);assert.match(xml,/Exam/);
 const unsafe=gradeCsvFilename({filenameClassName:' أ/ب\\ج:*?"<>|\u0000\u202e  ',namesOnly:true});assert.doesNotMatch(unsafe,/[\\/:*?"<>|\u0000\u202e]/);
 assert.equal(gradeCsvFilename({filenameClassName:'e\u0301'}),gradeCsvFilename({filenameClassName:'é'}));
});
test('unchanged workbook engine, Noor math, ownership/term and import guards; immutable extension 0.5.9',async()=>{
 for(const f of ['src/lib/grade-transfer-xlsx.js','src/store.js','src/views/teachings.js','src/router.js'])assert.equal(await current(f),before(f));
 const lib=await current('src/lib/grade-transfer-export.js');assert.equal(lib.slice(lib.indexOf('export function suggestNoorGroup')),before('src/lib/grade-transfer-export.js').slice(before('src/lib/grade-transfer-export.js').indexOf('export function suggestNoorGroup')));
 const view=await current('src/views/class-import-center.js'),old=before('src/views/class-import-center.js');
 for(const [start,end]of [['function extensionOwnerBinding()', 'function directExtensionEntry()'],['async function receiveExtension()', 'function transferPanel('],['function contextRoute(', 'export const koshoofCenter'],['function readTransferMappings(', 'function transferExport('],['function bindTransfer(', 'const accessible'],['function exportEntries()', 'function noorPane(']]) {
  const part=s=>{assert.ok(s.indexOf(start)>=0&&s.indexOf(end)>s.indexOf(start));return s.slice(s.indexOf(start),s.indexOf(end)).replace(', filenameClassName: filenameTeachingLabel(row)','');};assert.equal(part(view),part(old));
 }
 for(const ext of ['zip','manifest.json']){const f='assets/extensions/rakeez-teacher-import-helper-0.5.9.'+ext;assert.deepEqual(await readFile(f),execFileSync('git',['show',base+':'+f]));}
});
test('Noor retains 40/60 zero versus blank and rejects unconfirmed grouping',()=>{
 const options={...entry,items:[{id:'a',max:40},{id:'b',max:60}],groups:{a:'40',b:'60'},confirmed:true,ctx:{s1:{scoresByItem:{a:{value:0},b:{value:60}}},s2:{scoresByItem:{a:{value:20}}}}};
 const csv=exportNoorReview(options);assert.match(csv,/"Synthetic one",0,60/);assert.match(csv,/"Synthetic two",20,""/);assert.throws(()=>exportNoorReview({...options,confirmed:false}));assert.throws(()=>exportNoorReview({...options,groups:{a:'40',b:'40'}}));
});
