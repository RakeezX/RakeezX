// AI: affected v1/v2/v3 data boundary regression; rendered journey is separate.
import test from 'node:test';import assert from 'node:assert/strict';
import {validateHandoff,HANDOFF_TTL} from '../../src/lib/n36-extension-protocol.js';
import {parseBundle} from '../../src/lib/teacher-setup-import.js';
import {parseCategoryTable} from '../../extensions/rakeez-teacher-import-helper/categories.js';
const now=Date.now(),base=()=>({schema:'rakeez-extension-names',version:2,source:'madrasati',scope:'reviewed-run',batchId:'a'.repeat(64),complete:false,rows:[{name:'طالب اصطناعي',classroom:'خامس 1'}],createdAt:now,expiresAt:now+HANDOFF_TTL});
const setup=()=>[{category:'classes',provenance:['teacher-readonly-run'],rows:[{classroom:'خامس 1',subject:'العلوم'}]}];
test('old reviewed v1/v2 remain bounded, v3 retains available setup only',()=>{
 const e=base();assert.deepEqual(validateHandoff(e,now),e);
 const v1={...e,version:1};delete v1.batchId;delete v1.complete;assert.deepEqual(validateHandoff(v1,now),v1);
 const v3={...e,version:3,setup:setup()};assert.deepEqual(validateHandoff(v3,now),v3);
 for(const mutate of [v=>v.setup[0].rows[0].nationalID='secret',v=>v.setup[0].rows[0].token='secret',v=>v.setup.push(v.setup[0]),v=>v.setup[0].category='scores',v=>v.setup[0].provenance=['background'],v=>v.batchId='other',v=>v.rows[0].ownerId='other']){const v={...base(),version:3,setup:setup()};mutate(v);assert.throws(()=>validateHandoff(v,now));}
});
test('optional source class subject keeps old class tables compatible',()=>{
 assert.deepEqual(parseCategoryTable('classes','الفصل\nخامس 1'),[{classroom:'خامس 1'}]);
 const rows=parseCategoryTable('classes','الفصل\tالمادة\nخامس 1\tالعلوم');assert.deepEqual(rows,[{classroom:'خامس 1',subject:'العلوم'}]);
 for(const row of [{classroom:'خامس 1'},...rows])assert.deepEqual(parseBundle(JSON.stringify({schema:'rakeez-private-teacher-setup',version:1,categories:[{category:'classes',provenance:['teacher-readonly-run'],rows:[row]}]})).categories[0].rows,[row]);
});
test('full receiver validation rejects invalid metadata and timetable before any writes',()=>{
 for(const c of [{category:'teacher',rows:[{name:'معلم 123'}]},{category:'timetable',rows:[{weekday:'الأحد',period:'1',classroom:'خامس 1',subject:'العلوم',time:'99:99'}]}])assert.throws(()=>parseBundle(JSON.stringify({schema:'rakeez-private-teacher-setup',version:1,categories:[{...c,provenance:['teacher-readonly-run']}]})));
});
