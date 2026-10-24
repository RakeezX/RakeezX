// AI: actual publisher receipt, pure classification only; no provider/republication.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifiedAppliedFunctionSourceRecord, verifiedDeployment} from '../controller.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./n44-applied-function-record.fixture.json',import.meta.url)));
const pair=()=>structuredClone(fixture);
test('actual already-applied151136 source record qualifies without changing receipt',()=>{
 const {task,receipt}=pair(),before=JSON.stringify(receipt);
 assert.equal(verifiedAppliedFunctionSourceRecord(task,receipt),true);
 assert.equal(verifiedDeployment(task,receipt),true);
 assert.equal(JSON.stringify(receipt),before);
 assert.equal(receipt.poPersonallyTested,false);assert.equal(receipt.closed,false);
});
test('other tasks, live actions and wrong declared service identity never inherit exception',()=>{
 for(const mutate of [t=>t.id+='-other',t=>t.productId='N88',t=>t.liveMutation=true,
   t=>t.liveAuthorizationRef='another-live-scope',t=>t.preparationAuthority.appliedVersion='20261024150000',
   t=>t.preparationAuthority.appliedSqlSha256='0'.repeat(64),t=>t.preparationAuthority.providerOperations=1,
   t=>t.allowedPaths.push('src/app.js')]){
  const {task,receipt}=pair();mutate(task);assert.equal(verifiedDeployment(task,receipt),false);
 }
});
test('old alias, extra source or changed SQL bytes cannot be acknowledged',()=>{
 for(const mutate of [r=>r.changedPaths[1]='supabase/migrations/20261024150000_n44_atomic_item_cleanup.sql',
   r=>r.changedPaths.push('src/app.js'),r=>r.evidence.production.assets.find(x=>x.repoPath.endsWith('.sql')).observedSha256='0'.repeat(64),
   r=>r.evidence.immutable.assets.find(x=>x.repoPath.endsWith('.sql')).expectedSha256='0'.repeat(64)]){
  const {task,receipt}=pair();mutate(receipt);assert.equal(verifiedDeployment(task,receipt),false);
 }
});
test('provider, candidate binding and served-source negative guards remain necessary',()=>{
 for(const mutate of [r=>r.provider.conclusion='failure',r=>r.binding.candidateAncestorOfPublished=false,
   r=>r.publishedSha='0'.repeat(40),r=>r.evidence.production.passed=false,
   r=>r.evidence.immutable.assets.find(x=>x.repoPath.endsWith('.md')).verified=false,
   r=>r.evidence.production.assets.find(x=>x.repoPath.endsWith('.sql')).statusCode=404]){
  const {task,receipt}=pair();mutate(receipt);assert.equal(verifiedDeployment(task,receipt),false);
 }
});
test('ordinary documents-only publication remains unqualified',()=>{
 const {task,receipt}=pair();receipt.changedPaths=receipt.changedPaths.filter(x=>x.endsWith('.md'));
 assert.equal(verifiedDeployment(task,receipt),false);
});
