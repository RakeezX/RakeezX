import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogSourceBinding } from '../apply-reviewed-maintenance.mjs';

const sha='a'.repeat(64);
const task={id:'note-task',activationId:'active',productId:'N44',scopeKey:'scope',requiredChecks:['old-check'],approvedNote:{source:'note-card.json',sha256:sha}};
const update={card:{id:'note-task',activationId:'active',productId:'N44',scopeKey:'scope',requiredChecks:['old-check','new-check']}};

test('accepts exact approved-note source when catalog has no row',()=>{
  assert.deepEqual(catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/note-card.json',sha),{kind:'approved-note',index:-1,baseline:task});
});
test('rejects missing or mismatched approved-note identity',()=>{
  assert.throws(()=>catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/other.json',sha),/Approved-note source identity changed/);
  assert.throws(()=>catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/note-card.json','b'.repeat(64)),/Approved-note source identity changed/);
});
test('retains exact catalog-backed behavior',()=>{
  const row={...task,approvedNote:undefined};
  assert.deepEqual(catalogSourceBinding([row],task,update,'ignored.json',sha),{kind:'catalog',index:0,baseline:row});
});
