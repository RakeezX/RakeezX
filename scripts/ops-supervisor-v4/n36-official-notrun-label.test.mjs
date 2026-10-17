import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyInactiveIdentity} from './apply-reviewed-maintenance.mjs';
const repo='C:/Users/Abody/Projects/RakeezX';
const rt=repo+'/artifacts/ops-supervisor-v4';
const id='continuous-n36-available-partial-class-import-no-total-cap-20261017';
const sha=s=>createHash('sha256').update(s).digest('hex');
const load=()=>{
 const task=JSON.parse(readFileSync(rt+'/queue/'+id+'.json','utf8'));
 const result=JSON.parse(readFileSync(task.attempt.outputPath,'utf8'));
 const old=JSON.parse(readFileSync(repo+'/scripts/ops-supervisor-v4/n36-available-partial-class-import-no-total-cap-20261017.json','utf8')).tasks[0];
 const card={...old,completionMode:'repair_validation_check_names',
 objective:old.objective+'\nThe existing PASS groups are real, but the nine original required check names were not written by the worker; accurately reconcile source-grounded evidence in the preserved session. Production and voluntary official-user test are NOT_RUN, not PASS.',
 checkNameRepair:{previousResultSha256:sha(JSON.stringify(result)),previousFailureSha256:sha(task.lastFailure),
 reason:'The previously executed N36 source, 31-scenario browser, N12 owner, package and nullable rollover checks are genuinely PASS, but the worker used grouped headings rather than the original nine mandatory names. Real official account and Cloudflare production remain NOT_RUN, so recover exact saved session to cite proofs without inventing PASS.'}};
 const expected={id,status:'blocked',sessionId:task.sessionId,lastRunId:task.attempt.runId,
 candidateSha:result.candidateSha,baseSha:result.baseSha,queuedBaseSha:task.baseSha,
 queuedCandidateSha:task.candidateSha??null,worktreePath:task.worktreePath,resultState:'LOCAL_READY'};
 return {task,result,update:{card,expected}};
};
test('N36 only: current publication_and_official_source NOT_RUN preserved and saved identity validated',()=>{
 const x=load();assert.equal(x.result.checks.find(c=>c.name==='Production_parity_and_official_source_acceptance').status,'NOT_RUN');
 assert.equal(verifyInactiveIdentity(x.task,x.result,x.update,'po-20261012-continuous'),true);
});
for(const [name,mutate] of [
 ['a real FAIL',x=>x.result.checks[0].status='FAIL'],
 ['an unrelated NOT_RUN',x=>x.result.checks.push({name:'skip_owner_invariant',status:'NOT_RUN'})],
 ['different product with same NOT_RUN',x=>{x.task.productId='N64';x.update.card.productId='N64';}],
 ['weakening source required checks',x=>x.update.card.requiredChecks=[]],
 ['extending path to SQL',x=>x.update.card.allowedPaths.push('supabase/migrations/unapproved.sql')],
 ['tampered worker JSON hash',x=>x.update.card.checkNameRepair.previousResultSha256='0'.repeat(64)],
 ['tampered error hash',x=>x.update.card.checkNameRepair.previousFailureSha256='0'.repeat(64)],
 ['missing exact worker-reap evidence',x=>x.task.lastWorkerReap.exactAbsence=false],
 ['a different session',x=>x.task.sessionId='another-session'],
 ]){
 test('reject '+name,()=>{const x=load();mutate(x);assert.throws(()=>verifyInactiveIdentity(x.task,x.result,x.update,'po-20261012-continuous'));});
}
