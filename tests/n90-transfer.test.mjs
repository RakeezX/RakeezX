import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewGradeTransfer, gradeCommand } from '../src/lib/grade-transfer.js';
import { gradeNumber, readGradeFile } from '../src/lib/grade-transfer-parsers.js';
import { exportGradeCsv, suggestNoorGroup } from '../src/lib/grade-transfer-export.js';
import { parseCsv } from '../src/lib/student-import.js';
const base = () => ({ rows: [['name','grade'],['أحمد سالم','١٢٫٥'],['سعيد علي','0']], nameColumn:0,
  mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}], roster:[{id:'a',name:'أحمد سالم'},{id:'b',name:'سعيد علي'}],
  items:[{id:'i',name:'Exam',max:20,teachingId:'t',scoreMode:'direct',serverRevision:1}],
  scores:[{id:'s',studentId:'a',itemId:'i',value:10,serverRevision:2}],
  teaching:{id:'t',termId:'term',serverRevision:1},term:{id:'term',status:'active'},ownerId:'owner',databaseName:'db' });
test('explicit exact mapping, Arabic numbers, zeros, blanks, overwrite review and minimal command',()=>{
  const review=reviewGradeTransfer(base()); assert.equal(review.overwrites,1); assert.equal(review.additions,1);
  assert.equal(review.cells[0].value,12.5); assert.equal(review.cells[1].value,0);
  assert.throws(()=>gradeCommand(review,false)); const command=gradeCommand(review,true);
  assert.equal('entries' in command,false); assert.equal('ownerId' in command,false);
  const blank=base(); blank.rows[1][1]=''; const b=reviewGradeTransfer(blank); assert.equal(b.unchanged,1);assert.equal(b.cells.length,1);
});
test('duplicate, ambiguous, unknown, deleted and invalid values block whole review',()=>{
  for (const change of [b=>b.rows.push(['أحمد سالم','2']),b=>b.roster.push({id:'other',name:'أحمد سالم'}),
    b=>b.rows[1][0]='Unknown',b=>b.roster[0].deleted=true,b=>b.rows[1][1]=new Date(),b=>b.rows[1][1]='=2+2']) {
    const b=base();change(b);const r=reviewGradeTransfer(b);assert.ok(r.rejected.length);assert.throws(()=>gradeCommand(r,true));
  }
  for (const value of ['Infinity','NaN','1/2/2026','-1','1e1','1,000',{},true]) assert.throws(()=>gradeNumber(value));
  assert.equal(gradeNumber('۱۲.۵'),12.5);
});
test('stable identity resolves duplicate names; columns never auto-map; automatic/subitem items refused',()=>{
  const b=base();b.rows=[['name','grade','id'],['أحمد سالم','5','a']];b.idColumn=2;b.mappings.push({kind:'ignore'});b.roster.push({id:'dup',name:'أحمد سالم'});
  assert.equal(reviewGradeTransfer(b).cells[0].studentId,'a');
  for (const fields of [{auto:'attendance'},{scoreMode:'subitems'},{deleted:true}]) {const x=base();Object.assign(x.items[0],fields);assert.throws(()=>reviewGradeTransfer(x));}
  const x=base();x.mappings[1]={kind:'new',id:'new',name:'بند جديد',max:10,confirmed:false};assert.throws(()=>reviewGradeTransfer(x));
  x.mappings[1].confirmed=true;x.rows[1][1]='5';assert.equal(reviewGradeTransfer(x).newItems[0].name,'بند جديد');
  x.mappings[1]={kind:'ignore'};assert.throws(()=>reviewGradeTransfer(x));
});
test('CSV local N12 limits and faithful export with formula-safe text and Noor boundary',async()=>{
  const file=(name,content)=>({name,size:Buffer.byteLength(content),arrayBuffer:async()=>new TextEncoder().encode(content).buffer});
  assert.deepEqual(await readGradeFile(file('a.csv','name,grade\nأحمد,٠')), [['name','grade'],['أحمد','٠']]);
  await assert.rejects(()=>readGradeFile({...file('a.csv','x'),size:1024*1024+1}));
  await assert.rejects(()=>readGradeFile(file('a.csv','name,grade\n'+Array(301).fill('A,0').join('\n'))));
  const csv=exportGradeCsv({roster:[{id:'b',name:'=B'},{id:'a',name:'أحمد'}],items:[{id:'i',name:'Exam',max:20}],ctx:{a:{scoresByItem:{i:{value:0}}},b:{scoresByItem:{}}},className:'5/1',subject:'Math',term:'Term',noorReview:false});
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/'=B/);assert.match(csv,/العظمى 20/);assert.match(csv,/أحمد",0/);assert.doesNotMatch(csv,/معرف الطالب|نوع الملف|الفصل الدراسي/);
  const parsed=parseCsv(csv);assert.equal(parsed.find(row=>row[0]==='أحمد')[1],'0');assert.equal(parsed.find(row=>row[0].includes('=B'))[1],'');
  const alphabetical=exportGradeCsv({roster:[{id:'b',name:'سعيد'},{id:'a',name:'أحمد'}],items:[],ctx:{a:{},b:{}},className:'5/1',subject:'Math',term:'Term'});
  assert.ok(alphabetical.indexOf('أحمد')<alphabetical.indexOf('سعيد'));
});
import { suggestGradeMappings } from '../src/lib/grade-transfer.js';
test('suggestions require unique exact headers and current unique manual targets',()=>{
 const items=[{id:'i',name:'Exam',max:5,serverRevision:1},{id:'auto',name:'Auto',max:5,auto:'attendance',serverRevision:1},{id:'sub',name:'Sub',max:5,scoreMode:'subitems',serverRevision:1}];
 const s=suggestGradeMappings(['اسم الطالب','معرف الطالب','Exam (العظمى 5)','الفصل','المادة','Auto (العظمى 5)','Sub'],items);
 assert.equal(s.nameColumn,0);assert.equal(s.idColumn,1);assert.deepEqual(s.mappings[2],{kind:'existing',itemId:'i'});assert.deepEqual(s.reasons.slice(3),['metadata','metadata','readonly','readonly']);
 for(const headers of [['Exam','Exam'],['Exam','Exam (العظمى 5)'],['exam'],['Exam (العظمى 6)']])assert.ok(suggestGradeMappings(headers,items).mappings.every(m=>m.kind==='ignore'));
 assert.equal(suggestGradeMappings(['اسم الطالب','اسم الطالب'],items).nameColumn,-1);
 assert.equal(suggestGradeMappings(['Exam'],[...items,{id:'duplicate',name:'Exam',max:5,serverRevision:1}]).mappings[0].kind,'ignore');
 assert.equal(suggestGradeMappings(['Exam'],[{...items[0],serverRevision:0}]).mappings[0].kind,'ignore');
});

test('upper values are reviewed as capped, retaining zero and blank and all other validation',()=>{
 for (const value of ['21', '100000', '٧']) {
  const b=base();b.items[0].max=5;b.rows[1][1]=value;
  const r=reviewGradeTransfer(b);assert.equal(r.rejected.length,0);assert.equal(r.entries[0].original,Number(value==='٧'?7:value));assert.equal(r.entries[0].value,5);assert.equal(r.capped,1);assert.equal(r.cells[1].value,0);
 }
 const b=base();b.items[0].max=5;b.rows[1][1]='';assert.equal(reviewGradeTransfer(b).cells.length,1);
});
test('explicit new enrollment identity never uses unknown IDs or ambiguous names',()=>{
 const b=base();b.teaching.sectionId='section';b.allowNewStudents=true;b.newStudentIds={2:{id:'fresh',enrollmentId:'efresh'}};b.rows=[['name','grade'],['طالب جديد','7']];b.items[0].max=5;
 const r=reviewGradeTransfer(b);assert.equal(r.newStudents[0].id,'fresh');assert.equal(r.cells[0].value,5);assert.throws(()=>gradeCommand(r,true));assert.equal(gradeCommand(r,true,true).enrollmentConfirmed,true);
 b.rows.push(['طالب جديد','4']);assert.ok(reviewGradeTransfer(b).rejected.length);
 b.rows=[['name','grade','id'],['طالب جديد','4','unknown']];b.idColumn=2;b.mappings.push({kind:'ignore'});assert.ok(reviewGradeTransfer(b).rejected.length);
});
test('template is blank and direct-only; Noor is exact three columns with explicit compatible 40/60 and missing status',()=>{
 const roster=[{id:'a',name:'أحمد'},{id:'b',name:'=B'}],items=[{id:'p',name:'المهام',max:40},{id:'e',name:'التقويم',max:60}],ctx={a:{scoresByItem:{p:{value:0},e:{value:55}}},b:{scoresByItem:{p:{value:30}}}};
 const blank=parseCsv(exportGradeCsv({roster,items:[...items,{id:'auto',name:'آلي',max:5,auto:'participation'}],ctx,blankTemplate:true}));assert.equal(blank[0].length,3);assert.ok(blank.slice(1).every(r=>r[1]===''&&r[2]===''));assert.ok(!blank[0].some(h=>h.includes('آلي')));
 const input={roster,items,ctx,noorReview:true,noorGroups:{p:'40',e:'60'},noorConfirmed:true};
 const rows=parseCsv(exportGradeCsv(input));assert.deepEqual(rows[0],['اسم الطالب','المهام الأدائية والمشاركة والتفاعل (40)','تقويمات تحريرية وتطبيقات عملية (60)']);assert.ok(rows.every(row=>row.length===3));assert.deepEqual(rows.find(row=>row[0]==='أحمد'),['أحمد','0','55']);assert.equal(rows.find(row=>row[0].includes('=B'))[2],'');
 for (const change of [x=>x.noorConfirmed=false,x=>x.noorGroups.e='',x=>x.items=[...items,{id:'other',name:'Extra',max:5}],x=>x.items=[{...items[0],max:20},items[1]],x=>x.items=[items[0],items[0],items[1]]]) {const x=structuredClone(input);change(x);assert.throws(()=>exportGradeCsv(x));}
});

test('Noor suggestions cover current default item names and still require confirmation',()=>{
 for (const name of ['المشاركة والتفاعل','الواجبات','الأنشطة والمشاريع']) assert.equal(suggestNoorGroup({name}),'40');
 for (const name of ['الاختبارات القصيرة','الاختبار النهائي']) assert.equal(suggestNoorGroup({name}),'60');
 assert.equal(suggestNoorGroup({name:'بند غير معروف'}),'');
});

test('ordinary no-ID CSV roundtrip uses unique names and advanced IDs resolve only explicit identities',()=>{
 const b=base();const ctx={a:{scoresByItem:{i:{value:0}}},b:{scoresByItem:{}}};
 const ordinary=parseCsv(exportGradeCsv({roster:b.roster,items:b.items,ctx}));
 const mapping=suggestGradeMappings(ordinary[0],b.items);
 assert.equal(mapping.nameColumn,0);assert.equal(mapping.idColumn,-1);
 assert.deepEqual(ordinary[0],['اسم الطالب','Exam (العظمى 20)']);
 const r=reviewGradeTransfer({...b,rows:ordinary,...mapping});assert.equal(r.cells[0].value,0);
 const duplicate={...b,rows:ordinary,...mapping,roster:[...b.roster,{id:'dup',name:b.roster[0].name}]};
 assert.ok(reviewGradeTransfer(duplicate).rejected.length);
 const advanced=parseCsv(exportGradeCsv({roster:b.roster,items:b.items,ctx,includeIds:true}));
 assert.equal(advanced[0][0],'معرف الطالب');
 assert.equal(reviewGradeTransfer({...duplicate,rows:advanced,...suggestGradeMappings(advanced[0],b.items)}).rejected.length,0);
});
