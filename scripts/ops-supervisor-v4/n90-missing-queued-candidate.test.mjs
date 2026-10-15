import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyInactiveIdentity } from './apply-reviewed-maintenance.mjs';
const root='C:/Users/Abody/Projects/RakeezX';
const rt=root+'/artifacts/ops-supervisor-v4';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const q=read(rt+'/queue/continuous-n90-unified-import-service-and-release-20261015.json');
const result=read(q.attempt.outputPath);
const oldCard=read(root+'/scripts/ops-supervisor-v4/n90-unified-service-release-20261015.json').tasks[0];
const make=()=>({card:{...oldCard,preparationAuthority:{...oldCard.preparationAuthority,providerCalls:3}},expected:{id:q.id,status:'blocked',sessionId:q.sessionId,lastRunId:q.attempt.runId,candidateSha:result.candidateSha,baseSha:result.baseSha,queuedBaseSha:q.baseSha,queuedCandidateSha:null,worktreePath:q.worktreePath,resultState:'BLOCKED'}});
test('saved N90 blocked worker has exact null queued candidate and newer proven base',()=>{
 assert.equal(q.candidateSha == null,true);assert.notEqual(q.baseSha,result.baseSha);
 assert.equal(result.state,'BLOCKED');assert.equal(q.lastWorkerReap.exactAbsence,true);
 assert.equal(verifyInactiveIdentity(q,result,make(),q.activationId),true);
});
for(const [title,mutator] of [['changed queue base',x=>x.expected.queuedBaseSha='0'.repeat(40)],['false queued candidate',x=>x.expected.queuedCandidateSha='f'.repeat(40)],['changed run',x=>x.expected.lastRunId='wrong-run'],['changed result base',x=>x.expected.baseSha='0'.repeat(40)]]){
 test('refuse '+title,()=>{const x=make();mutator(x);assert.throws(()=>verifyInactiveIdentity(q,result,x,q.activationId));});
}
