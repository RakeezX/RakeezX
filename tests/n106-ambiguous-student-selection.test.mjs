// AI-authored N106: identity choices are explicit, current, one-to-one and class-bound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGradeTransfer, rosterChoiceBinding} from '../src/lib/grade-transfer.js';

function fixture() {
 const roster=['a','b'].map((id,i)=>({id,name:'ناصر حمد',serverRevision:1,ownerId:'owner',displayNo:i+1}));
 return {rows:[['اسم الطالب','درجة'],['ناصر حمد','0']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}],
  roster,items:[{id:'i',name:'اختبار',teachingId:'t',max:10,serverRevision:1}],scores:[],
  teaching:{id:'t',termId:'term',sectionId:'section',serverRevision:1},term:{id:'term',status:'active'},ownerId:'owner',databaseName:'owned'};
}
function choose(f) { f.studentChoices={2:{studentId:'a',confirmed:true,binding:rosterChoiceBinding(f)}};return f; }
test('no guessed match; explicit current selection accepts zero',()=>{
 const f=fixture();assert.equal(reviewGradeTransfer(f).rejected[0].reason,'اسم ملتبس');
 choose(f);const r=reviewGradeTransfer(f);assert.equal(r.rejected.length,0);assert.equal(r.cells[0].studentId,'a');assert.equal(r.cells[0].value,0);
});
test('unapproved, foreign, missing, renamed, revised and switched roster identities reject',()=>{
 for(const change of [f=>f.studentChoices[2].confirmed=false,f=>f.studentChoices[2].studentId='foreign',
  f=>f.roster.shift(),f=>f.roster[0].name='اسم مختلف',f=>f.roster[0].serverRevision++,
  f=>f.ownerId='other',f=>f.databaseName='other',f=>f.teaching.sectionId='other',f=>f.teaching.serverRevision++,
  f=>f.studentChoices[99]={...f.studentChoices[2]},f=>f.roster[0].enrollmentId='replaced',f=>f.roster[0].rollNo=99]) {
   const f=choose(fixture());change(f);assert.throws(()=>reviewGradeTransfer(f));
 }
});
test('two file rows cannot choose one student; distinct choices can',()=>{
 const f=choose(fixture());f.rows.push(['ناصر حمد','1']);f.studentChoices[3]={...f.studentChoices[2]};
 assert.equal(reviewGradeTransfer(f).rejected.length,2);
 f.studentChoices[3].studentId='b';assert.equal(reviewGradeTransfer(f).rejected.length,0);
});
test('valid legacy ID remains accepted; wrong-name or foreign ID rejected',()=>{
 const f=fixture();f.rows=[['اسم الطالب','درجة','معرف الطالب'],['ناصر حمد','0','b']];f.idColumn=2;f.mappings.push({kind:'ignore'});
 assert.equal(reviewGradeTransfer(f).cells[0].studentId,'b');
 f.rows[1][2]='foreign';assert.equal(reviewGradeTransfer(f).rejected.length,1);
 f.rows[1][2]='b';f.rows[1][0]='اسم آخر';assert.equal(reviewGradeTransfer(f).rejected.length,1);
});
