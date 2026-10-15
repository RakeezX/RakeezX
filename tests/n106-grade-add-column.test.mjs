// AI-authored N106: unmatched later columns remain inert until explicit mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestGradeMappings,reviewGradeTransfer} from '../src/lib/grade-transfer.js';
test('fourth unknown grade column can map manually; new maximum requires approval',()=>{
 const rows=[['اسم الطالب','أول (العظمى 10)','ثان (العظمى 10)','ثالث (العظمى 10)','غير معروف'],['طالب واحد','1','2','','0']];
 const items=['أول','ثان','ثالث','رابع'].map((name,i)=>({id:'i'+i,name,max:10,teachingId:'t',serverRevision:1}));
 const proposed=suggestGradeMappings(rows[0],items,{teachingId:'t'});assert.equal(proposed.reasons[4],'exception');assert.equal(proposed.mappings[4].kind,'ignore');
 const f={...proposed,rows,items,roster:[{id:'a',name:'طالب واحد',serverRevision:1}],scores:[],teaching:{id:'t',termId:'term',sectionId:'s',serverRevision:1},term:{id:'term',status:'active'}};
 assert.equal(reviewGradeTransfer(f).cells.length,2);
 f.mappings[4]={kind:'existing',itemId:'i3'};assert.equal(reviewGradeTransfer(f).cells.find(c=>c.itemId==='i3').value,0);
 f.mappings[4]={kind:'new',id:'new',name:'رابع يدوي',max:5,confirmed:false};assert.throws(()=>reviewGradeTransfer(f),/CONFIRM/);
 f.mappings[4].confirmed=true;assert.equal(reviewGradeTransfer(f).newItems[0].max,5);
});
