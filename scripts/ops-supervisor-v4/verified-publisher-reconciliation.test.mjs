import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifiedDeployment} from './controller.mjs';
import {verifyInactiveIdentity,revisedTask} from './apply-reviewed-maintenance.mjs';
const rt='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4',repo='C:/Users/Abody/Projects/RakeezX';
const id='continuous-n36-madrasati-roster-official-feedback-20261017';
const parse=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sha=x=>createHash('sha256').update(x).digest('hex');
const make=()=>{
 const task=parse(rt+'/queue/'+id+'.json'),result=parse(task.attempt.outputPath);
 const source=parse(repo+'/scripts/ops-supervisor-v4/n36-madrasati-real-roster-evidence-20261017.json').tasks[0];
 const card={...source,completionMode:'reconcile_verified_publication',verificationRepair:{
   publishedSha:task.deliveryReceipt.publishedSha,
   priorReceiptSha256:sha(JSON.stringify(task.deliveryReceipt,null,2)+'\n'),
   reviewedFixtureSha256:'a'.repeat(64),
   reason:'Reconcile exact provider/production cryptographic receipt after first-party controller allowlist update; preserve original user result and worker SHA.'
 }};
 const expected={id,status:'blocked',sessionId:task.sessionId,lastRunId:task.attempt.runId,
  candidateSha:result.candidateSha,baseSha:result.baseSha,worktreePath:task.worktreePath,resultState:'LOCAL_READY'};
 return {task,result,update:{card,expected}};
};
const confirm=x=>verifyInactiveIdentity(x.task,x.result,x.update,'po-20261012-continuous');
test('actual Product receipt is fully verified after exact pinned provider label update',()=>{
 const x=make();assert.equal(x.task.status,'blocked');assert.equal(x.task.deliveryReceipt.status,'deployed');
 assert.equal(verifiedDeployment(x.task,x.task.deliveryReceipt),true);
 const index=x.task.deliveryReceipt.evidence.production.assets.find(a=>a.repoPath==='index.html');
 assert.equal(index.verified,true);assert.ok(index.providerTransforms.includes('cloudflare-analytics-20261017'));
});
test('reconcile only exact genuinely deployed current N36 candidate without claiming PO acceptance',()=>{
 const x=make();assert.equal(confirm(x),true);
 const next=revisedTask(x.task,x.update,'f'.repeat(40),'2026-10-17T00:54:15.177Z');
 assert.equal(next.status,'awaiting_po');assert.equal(next.productionVerifiedAt,x.task.deliveryReceipt.verifiedAt);
 assert.equal(next.sessionId,x.task.sessionId);assert.equal(next.candidateSha,x.task.candidateSha);
 assert.equal(next.deliveryReceipt.publishedSha,x.task.deliveryReceipt.publishedSha);
 assert.notEqual(next.closed,true); // awaiting PO never invents acceptance
});
for(const [name,mutate] of [
 ['unverified production',x=>x.task.deliveryReceipt.evidence.production.passed=false],
 ['incorrect provider head',x=>x.task.deliveryReceipt.provider.headSha='0'.repeat(40)],
 ['altered beacon transform',x=>x.task.deliveryReceipt.evidence.production.assets.find(a=>a.repoPath==='index.html').providerTransforms=['unknown-script']],
 ['changed receipt bytes',x=>x.task.deliveryReceipt.verifiedAt='2030-01-01T00:00:00Z'],
 ['no worker absence',x=>x.task.lastWorkerReap.exactAbsence=false],
 ['unapproved live operation',x=>x.update.card.liveMutation=true],
 ['expanded class access path',x=>x.update.card.allowedPaths.push('supabase/migrations/bad.sql')],
 ['weakened required guards',x=>x.update.card.requiredChecks=[]],
 ['actual source failed test',x=>x.result.checks[0].status='FAIL'],
 ['wrong candidate',x=>x.update.expected.candidateSha='0'.repeat(40)],
 ['not genuinely controller-mismatched',x=>x.task.lastFailure='Another error']
]){
 test('reject '+name,()=>{const x=make();mutate(x);assert.throws(()=>confirm(x));});
}
