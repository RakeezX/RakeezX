import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyInactiveIdentity} from './apply-reviewed-maintenance.mjs';
const root='C:/Users/Abody/Projects/RakeezX';
const rt=root+'/artifacts/ops-supervisor-v4';
const id='continuous-n36-300-students-final-zero-20261017';
const hash=x=>createHash('sha256').update(x).digest('hex');
function prepare(){
 const task=JSON.parse(fs.readFileSync(rt+'/queue/'+id+'.json','utf8'));
 const result=JSON.parse(fs.readFileSync(task.attempt.outputPath,'utf8'));
 const original=JSON.parse(fs.readFileSync(root+'/scripts/ops-supervisor-v4/n36-300-students-disappear-20261017.json','utf8')).tasks[0];
 const card={...original,completionMode:'repair_validation_check_names',objective:original.objective+'\nExact check names are seven original required checks, each must be supported by actual proof and passed test execution. Keep official account acceptance and Production publication NOT_RUN, not falsely PASS.',checkNameRepair:{previousResultSha256:hash(JSON.stringify(result)),previousFailureSha256:hash(task.lastFailure),reason:'Align originally passed browser, node, safety, packaging and source tests to seven existing check labels using saved candidate without inventing PASS or changing official-account NOT_RUN.'}};
 const expected={id,status:'blocked',sessionId:task.sessionId,lastRunId:task.attempt.runId,candidateSha:result.candidateSha,baseSha:result.baseSha,queuedBaseSha:task.baseSha,queuedCandidateSha:task.candidateSha??null,worktreePath:task.worktreePath,resultState:'LOCAL_READY'};
 return {task,result,update:{card,expected}};
}
test('allows only current N36 official-account NOT_RUN, never claims PASS for that result',()=>{
 const a=prepare();assert.equal(a.result.checks.find(c=>c.name==='publication_and_official_account').status,'NOT_RUN');assert.equal(verifyInactiveIdentity(a.task,a.result,a.update,'po-20261012-continuous'),true);
});
for(const [name,mutate] of [
 ['any genuinely failing check',a=>a.result.checks[0].status='FAIL'],
 ['an unrelated NOT_RUN',a=>a.result.checks.push({name:'owner_scoped_confirmation',status:'NOT_RUN'})],
 ['different Product with same NOT_RUN',a=>{a.task.productId='N64';a.update.card.productId='N64';}],
 ['falsely marked official PASS but missing required contract',a=>a.update.card.requiredChecks=[]],
 ['change owner-scoped authorization',a=>a.update.card.allowedPaths.push('supabase/migrations/unsafe.sql')],
 ['different candidate',a=>a.update.expected.candidateSha='0'.repeat(40)],
 ['different worker result hash',a=>a.update.card.checkNameRepair.previousResultSha256='0'.repeat(64)],
 ['a different failure reason',a=>a.task.lastFailure='Wrong framework issue'],
 ['missing worker absence',a=>a.task.lastWorkerReap.exactAbsence=false],
 ]){
 test('reject '+name,()=>{const a=prepare();mutate(a);assert.throws(()=>verifyInactiveIdentity(a.task,a.result,a.update,'po-20261012-continuous'))});
}
