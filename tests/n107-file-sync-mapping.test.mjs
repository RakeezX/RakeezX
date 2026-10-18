// AI-authored N107: mapping safety against the actual creation definition resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultItemsFor} from '../src/models.js';
import {suggestGradeMappings} from '../src/lib/grade-transfer.js';
const header=['اسم الطالب','المشاركة والتفاعل (العظمى 20)','الأنشطة والمشاريع (العظمى 20)','الواجبات (العظمى 20)'];
const defaults=()=>defaultItemsFor('t').map(row=>({...row,serverRevision:1,ownerId:'owner'}));
const mapping=items=>suggestGradeMappings(header,items,{teachingId:'t',ownerId:'owner'});
test('canonical defaults: activities reused, automatic protected, homework max mismatch never guessed',()=>{
 const rows=defaults(),result=mapping(rows);
 assert.equal(result.mappings[2].itemId,rows[2].id);
 assert.equal(result.reasons[1],'readonly');assert.equal(result.mappings[1].kind,'ignore');
 assert.equal(result.reasons[3],'exception');assert.equal(result.mappings[3].kind,'ignore');
 assert.equal(result.mappings.filter(m=>m.kind==='new').length,0);
});
test('existing owned homework20 and activities20 map to their exact identities; duplicate, automatic and foreign candidates refuse',()=>{
 const rows=defaults();rows[1].max=20;
 assert.equal(mapping(rows).mappings[3].itemId,rows[1].id);
 assert.equal(mapping(rows).mappings[2].itemId,rows[2].id);
 assert.equal(mapping([...rows,{...rows[2],id:'duplicate'}]).mappings[2].kind,'ignore');
 assert.equal(mapping([...rows,{...rows[2],id:'calculated',auto:'participation'}]).reasons[2],'readonly');
 const foreign=rows.map(r=>({...r,ownerId:'other'}));
 assert.ok(mapping(foreign).mappings.every(m=>m.kind!=='existing'));
 assert.equal(mapping(rows.map(r=>({...r,teachingId:'other'}))).mappings.some(m=>m.kind==='existing'),false);
});
test('duplicate source columns and unacknowledged existing items cannot bind by name alone',()=>{
 const rows=defaults(),h=[header[0],header[2],header[2]];
 assert.ok(suggestGradeMappings(h,rows,{teachingId:'t',ownerId:'owner'}).mappings.every(m=>m.kind==='ignore'));
 rows[2].serverRevision=0;
 assert.equal(mapping(rows).mappings[2].kind,'ignore');
});
