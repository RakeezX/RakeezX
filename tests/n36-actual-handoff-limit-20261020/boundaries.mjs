// AI: narrowed v3 lifetime compatibility must not relax legacy/row/schema limits.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {validateHandoff as extension,HANDOFF_TTL} from '../../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {validateHandoff as application} from '../../src/lib/n36-extension-handoff.js';
const now=Date.now(),base={schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',batchId:'a'.repeat(64),complete:true,setup:[],createdAt:now,expiresAt:now+HANDOFF_TTL-1,rows:[{name:'طالب اصطناعي',classroom:'خامس1'}]};
const checks=[];
for(const [name,validate] of [['extension',extension],['application',application]]){
 for(const duration of [1,60000,HANDOFF_TTL-1,HANDOFF_TTL]){const value={...base,expiresAt:now+duration};const result=validate(value,now);assert.equal(result.createdAt,now);assert.equal(result.expiresAt,now+duration);}
 for(const value of [{...base,expiresAt:now},{...base,expiresAt:now-1},{...base,expiresAt:now+HANDOFF_TTL+1},{...base,createdAt:now+5001,expiresAt:now+10000},{...base,rows:Array(301).fill(base.rows[0])},{...base,rows:[base.rows[0],base.rows[0]]},{...base,unexpected:true},Object.assign(Object.create(null),base),{...base,version:2,setup:undefined}])assert.throws(()=>validate(value,now));
 const v2={...base,version:2};delete v2.setup;assert.throws(()=>validate(v2,now));assert.equal(validate({...v2,expiresAt:now+HANDOFF_TTL},now).version,2);
 const department={...base,setup:[{category:'department',provenance:['teacher-readonly-run'],rows:[{name:'الرياض'}]}]};assert.equal(validate(department,now).expiresAt,base.expiresAt);
 checks.push({name,status:'PASS',evidence:'Positive short v3 window through exact TTL, original timestamps retained; expired/future/overlong/over-row/duplicate/extra-key/prototype/legacy-short envelopes denied. Department path retains same lifetime.'});
}
await fs.writeFile('tests/n36-actual-handoff-limit-20261020/boundaries.json',JSON.stringify({status:'PASS',checks},null,2)+'\n');console.log('PASS bounded v3 and unchanged legacy/schema/row fences');
