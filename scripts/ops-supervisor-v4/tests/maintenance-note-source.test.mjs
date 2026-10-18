import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalogSourceBinding, reviewedSourcePreimageMatches } from '../apply-reviewed-maintenance.mjs';

const sha='a'.repeat(64);
const task={id:'note-task',activationId:'active',productId:'N44',scopeKey:'scope',requiredChecks:['old-check'],approvedNote:{source:'note-card.json',sha256:sha}};
const update={card:{id:'note-task',activationId:'active',productId:'N44',scopeKey:'scope',requiredChecks:['old-check','new-check']}};

test('accepts exact approved-note source when catalog has no row',()=>{
  assert.deepEqual(catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/note-card.json',sha),{kind:'approved-note',index:-1,baseline:task,approvedNoteSha256:sha});
});
test('rejects missing or mismatched approved-note identity',()=>{
  assert.throws(()=>catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/other.json',sha),/Approved-note source identity changed/);
  assert.throws(()=>catalogSourceBinding([],task,update,'scripts/ops-supervisor-v4/note-card.json','b'.repeat(64)),/Approved-note source is not the latest reviewed owned maintenance chain/);
});
test('retains exact catalog-backed behavior',()=>{
  const row={...task,approvedNote:undefined};
  assert.deepEqual(catalogSourceBinding([row],task,update,'ignored.json',sha),{kind:'catalog',index:0,baseline:row});
});

test('adopts only the exact unpublished approved-note source preimage',()=>{
  const canonical=Buffer.from('approved note source');
  const exactSha=createHash('sha256').update(canonical).digest('hex');
  const file={expectedCanonicalSha256:exactSha};
  assert.equal(reviewedSourcePreimageMatches(null,null,canonical,file,exactSha),true);
  assert.equal(reviewedSourcePreimageMatches(null,null,canonical,file,'b'.repeat(64)),false);
  assert.equal(reviewedSourcePreimageMatches(Buffer.from('remote'),null,canonical,file,exactSha),false);
});
