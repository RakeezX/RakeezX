// AI-authored: focused new N107 file-maximum contract fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestGradeMappings,reviewGradeTransfer} from '../src/lib/grade-transfer.js';
import {defaultItemsFor} from '../src/models.js';
const item={id:'manual',name:'الواجبات',teachingId:'t',max:10,serverRevision:4,ownerId:'owner'};
const suggest=(headers,items=[item])=>suggestGradeMappings(headers,items,{teachingId:'t',ownerId:'owner'});
const input=(max=20,scores=[])=>({rows:[['اسم الطالب',`الواجبات (العظمى ${max})`],['مصطنع أول','0'],['مصطنع ثان','']],nameColumn:0,mappings:suggest(['اسم الطالب',`الواجبات (العظمى ${max})`]).mappings,
 roster:[{id:'a',name:'مصطنع أول',serverRevision:1},{id:'b',name:'مصطنع ثان',serverRevision:1}],items:[item],scores,
 teaching:{id:'t',sectionId:'s',termId:'term',serverRevision:1},term:{id:'term'},ownerId:'owner',databaseName:'fabricated'});
test('normalized unique name reuses exact ID with exact smaller/larger/decimal declared file maximum',()=>{
 for(const max of [5,20,19.99]){const i=input(max),r=reviewGradeTransfer(i);assert.equal(i.mappings[1].itemId,'manual');assert.equal(r.maxChanges[0].max,max);assert.equal(r.cells[0].max,max);assert.equal(r.cells[0].value,0);assert.equal(r.newItems.length,0);}
 const r=suggest(['اسم الطالب','الـوَاجبات (العظمى ٢٠)']);assert.equal(r.mappings[1].itemId,'manual');assert.equal(r.mappings[1].fileMax,20);
});
test('no declared valid max preserves existing max without guessing highest mark',()=>{
 for(const header of ['الواجبات','الواجبات (العظمى 0)','الواجبات (العظمى 10000)']){const m=suggest(['اسم الطالب',header]).mappings[1];assert.equal(m.itemId,'manual');assert.equal(m.fileMax,undefined);}
});
test('ambiguity, duplicate source names despite differing maxima, computed/read-only/foreign/deleted destinations are never reused',()=>{
 for(const rows of [[item,{...item,id:'duplicate',max:20}],[{...item,auto:'participation'}],[{...item,scoreMode:'subitems'}],[{...item,readOnly:true}],[{...item,locked:true}],[{...item,parentId:'parent'}],[{...item,ownerId:'foreign'}],[{...item,teachingId:'other'}],[{...item,deleted:true}]])assert.notEqual(suggest(['اسم الطالب','الواجبات (العظمى 20)'],rows).mappings[1].kind,'existing');
 assert.ok(suggest(['اسم الطالب','الواجبات (العظمى 20)','الواجبات (العظمى 30)']).mappings.every(m=>m.kind==='ignore'));
});
test('all scores bind preservation including absent students and blank or reviewed-overwrite cells; unsafe lower max blocks',()=>{
 const scores=[{id:'absent',itemId:'manual',studentId:'absent',value:9,serverRevision:1},{id:'zero',itemId:'manual',studentId:'b',value:0,serverRevision:1}];
 const before=JSON.stringify(scores),r=reviewGradeTransfer(input(20,scores));assert.equal(JSON.stringify(scores),before);assert.equal(r.cells.length,1);assert.equal(r.unchanged,1);
 assert.throws(()=>reviewGradeTransfer(input(5,scores)),/لا يمكن خفض/);
 const overwrite=input(5,[{id:'a-score',itemId:'manual',studentId:'a',value:9,serverRevision:1}]);assert.throws(()=>reviewGradeTransfer(overwrite),/لا يمكن خفض/);
});
test('prospective resolver is exactly actual defaultItemsFor, no parallel defaults',()=>{
 const items=defaultItemsFor('t').map(i=>({...i,serverRevision:1})),m=suggest(['اسم الطالب','الواجبات (العظمى 20)'],items);
 assert.equal(m.mappings[1].itemId,items.find(i=>i.name==='الواجبات').id);assert.equal(m.mappings[1].fileMax,20);assert.equal(m.mappings[1].kind,'existing');
});
