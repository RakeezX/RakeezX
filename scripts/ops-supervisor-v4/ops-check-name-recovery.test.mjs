import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const external = process.env.RAKEEZ_REVIEW_HELPERS;
const url = external ? new URL('file:///' + external.replaceAll('\\','/')) : new URL('./apply-reviewed-maintenance.mjs', import.meta.url);
const {verifyInactiveIdentity} = await import(url);
const sha = s=>createHash('sha256').update(s).digest('hex');
const root='C:\\Users\\Abody\\Projects\\RakeezX\\.worktrees\\';
const id='continuous-n36-confirmed-bundle-names-import-20261017';
const activationId='po-20261012-continuous';
const base='a'.repeat(40),candidate='b'.repeat(40);
const fail='Candidate validation: Required affected checks have not passed: n36_reviewed_names';
const existingKeys=['n36_reviewed_names','n36_owner_isolation'];
const allowedPaths=['src/views/teacher-setup-import.js','tests/n36-confirmed-bundle-names.test.mjs'];
const result = {
 taskId:id,runId:'run-101',state:'LOCAL_READY',candidateSha:candidate,baseSha:base,worktreePath:root+id,
 changedPaths:[...allowedPaths],
 checks:[{name:'current_owner_browser',status:'PASS',evidence:'19/19 synthetic scenarios'},{name:'safe_upload',status:'PASS',evidence:'9/9 Node checks'},{name:'production_publication',status:'NOT_RUN',evidence:'Publisher owns deployment'}],
 blockerType:'none',blocker:null
};
function fixture() {
 const task={
 id,activationId,productId:'N36',scopeKey:'n36-check-name-recovery',status:'blocked',
 sessionId:'session-101',attempt:{runId:'run-101'},runnerPid:null,brokerPid:null,
 worktreePath:root+id,baseSha:base,candidateSha:null,liveMutation:true,liveAuthorizationRef:'OWNER-CONFIRMED',
 requiredChecks:[...existingKeys],allowedPaths:[...allowedPaths],implementationFailures:2,lastFailure:fail,
 lastWorkerReap:{exactAbsence:true,activationId,runId:'run-101',owners:[{pid:123,createdAt:'2026-10-16T18:00:00Z'}]}
 };
 const card={
 id,activationId,productId:'N36',scopeKey:task.scopeKey,requiredChecks:[...existingKeys],allowedPaths:[...allowedPaths],
 liveMutation:true,liveAuthorizationRef:'OWNER-CONFIRMED',objective:'Review saved evidence with exact acceptance names.',
 completionMode:'repair_validation_check_names',
 checkNameRepair:{previousResultSha256:sha(JSON.stringify(result)),previousFailureSha256:sha(fail),reason:'Preserve the old valid Product candidate and require exact check names on resumed session.'}
 };
 return {task,result:structuredClone(result),update:{card,expected:{id,status:'blocked',sessionId:'session-101',lastRunId:'run-101',candidateSha:candidate,baseSha:base,worktreePath:root+id,resultState:'LOCAL_READY'}}};
}
test('exact offline check-name-only error can resume the same session without falsely passing it',()=>{
 const x=fixture();assert.equal(verifyInactiveIdentity(x.task,x.result,x.update,activationId),true);
});
for(const [title,mutate] of [
 ['real failed worker check',x=>x.result.checks[0].status='FAIL'],
 ['unrelated NOT_RUN test',x=>x.result.checks.push({name:'owner_isolation',status:'NOT_RUN',evidence:''})],
 ['changed required guard names',x=>x.update.card.requiredChecks=[]],
 ['expanded write paths',x=>x.update.card.allowedPaths.push('src/store.js')],
 ['changed release authority',x=>x.update.card.liveAuthorizationRef='ANY-OWNER'],
 ['changed user code paths',x=>x.result.changedPaths.push('src/store.js')],
 ['different saved run result',x=>x.update.card.checkNameRepair.previousResultSha256='f'.repeat(64)],
 ['different prior failure',x=>x.task.lastFailure+='...'],
 ['wrong candidate identity',x=>x.update.expected.candidateSha='f'.repeat(40)],
 ['worker still active',x=>x.task.runnerPid=123],
 ['unproven worker exit',x=>x.task.lastWorkerReap.exactAbsence=false],
 ['worker had deployed already',x=>x.task.deliveryReceipt={status:'deployed'}],
 ['not specifically check-name rejection',x=>x.task.lastFailure='Candidate validation: real test failure'],
 ['different worker result state',x=>x.result.state='NO_CHANGE'],
 ['live production fail disguised',x=>x.result.checks[1].status='FAIL'],
])test('reject '+title,()=>{let x=fixture();mutate(x);assert.throws(()=>verifyInactiveIdentity(x.task,x.result,x.update,activationId));});
