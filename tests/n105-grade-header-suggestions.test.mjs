import assert from 'node:assert/strict';
import {suggestGradeMappings, reviewGradeTransfer} from '../src/lib/grade-transfer.js';
const item={id:'i',name:'اختبار قصير',max:10,serverRevision:2,teachingId:'t'};
const detect=(headers,items=[item])=>suggestGradeMappings(['اسم الطالب',...headers],items);
for(const label of ['اختبار قصير','اختبار قصير (العظمى 10)',' اختبار  قصير (العظمى ١٠٫٠٠) ','اختبار قصير (العظمى 10.00)']) assert.deepEqual(detect([label]).mappings[1],{kind:'existing',itemId:'i'});
for(const headers of [['اختبار قصير (العظمى 11)'],['اختبار قصير','اختبار قصير (العظمى 10)'],['اختبار قصير (العظمى 10)','اختبار قصير (العظمى ١٠)'],['اختبار قصير','اختبار قصير']]) assert.ok(detect(headers).mappings.slice(1).every(m=>m.kind==='ignore'));
for(const max of ['0','-1','NaN','Infinity','1e2','10,5','1.234','10000','١٠٠٠٠',''])assert.equal(detect([`جديد (العظمى ${max})`]).mappings[1].kind,'ignore');
for(const extra of [{auto:'participation'},{scoreMode:'subitems'}]){const d=detect(['اختبار قصير (العظمى 10)'],[{...item,...extra}]);assert.equal(d.reasons[1],'readonly');assert.equal(d.mappings[1].kind,'ignore');}
assert.equal(detect(['المشاركة والتفاعل (العظمى 10)'],[]).reasons[1],'readonly');
for(const items of [[{...item,serverRevision:0}],[item,{...item,id:'i2'}]])assert.equal(detect(['اختبار قصير (العظمى 10)'],items).mappings[1].kind,'ignore');
for(const h of ['جديد (العظمى 7.50)','جديد (العظمى ٧٫٥٠)'])assert.deepEqual(detect([h]).mappings[1],{kind:'new',name:'جديد',max:7.5,confirmed:false});
assert.equal(detect(['جديد (العظمى 7)','جديد (العظمى 8)']).mappings[1].kind,'ignore');
assert.equal(detect(['حر غير معروف']).mappings[1].kind,'ignore');
const proposal={...detect(['جديد (العظمى 7)']).mappings[1],id:'new'};
const input={rows:[['اسم الطالب','جديد (العظمى 7)'],['طالب تجريبي','0']],nameColumn:0,mappings:[{kind:'ignore'},proposal],roster:[{id:'s',name:'طالب تجريبي'}],items:[item],scores:[],teaching:{id:'t',termId:'term',serverRevision:1},term:{id:'term',status:'active'},ownerId:'o',databaseName:'db'};
assert.throws(()=>reviewGradeTransfer(input),/GRADE_NEW_ITEM_CONFIRM_REQUIRED/);
console.log('PASS canonical numeric equivalence, duplicate/max conflict, read-only, unpersisted, finite limits, unchecked new proposal');

for(const foreign of [{...item,ownerId:'foreign'},{...item,ownerId:'owner',teachingId:'other'}]){const m=suggestGradeMappings(['اسم الطالب','اختبار قصير (العظمى 10)'],[foreign],{teachingId:'t',ownerId:'owner'}).mappings[1];assert.notEqual(m.kind,'existing');assert.equal(m.confirmed,false);}
console.log('PASS foreign owner and teaching never linked');

assert.equal(suggestGradeMappings(['اسم الطالب','اختبار قصير (العظمى 10)'],[item],{teachingId:'t',ownerId:'owner'}).mappings[1].kind,'existing');
