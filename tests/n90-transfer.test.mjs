import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewGradeTransfer, gradeCommand } from '../src/lib/grade-transfer.js';
import { gradeNumber, readGradeFile } from '../src/lib/grade-transfer-parsers.js';
import { exportGradeCsv } from '../src/lib/grade-transfer-export.js';
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
    b=>b.rows[1][0]='Unknown',b=>b.roster[0].deleted=true,b=>b.rows[1][1]='21',b=>b.rows[1][1]=new Date(),b=>b.rows[1][1]='=2+2']) {
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
  const csv=exportGradeCsv({roster:[{id:'b',name:'=B'},{id:'a',name:'أحمد'}],items:[{id:'i',name:'Exam',max:20}],ctx:{a:{scoresByItem:{i:{value:0}}},b:{scoresByItem:{}}},className:'5/1',subject:'Math',term:'Term',noorReview:true});
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/'=B/);assert.match(csv,/العظمى 20/);assert.match(csv,/أحمد",0/);assert.match(csv,/قالب رفع رسمي/);
  const parsed=parseCsv(csv);assert.equal(parsed.find(row=>row[0]==='a')[2],'0');assert.equal(parsed.find(row=>row[0]==='b')[2],'');
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
