import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPristinePendingSupersession, revisedTask } from '../apply-reviewed-maintenance.mjs';
const published='c'.repeat(40), candidate='d'.repeat(40);
function fixture(){
  const task={id:'old-n36',activationId:'active',productId:'N36',scopeKey:'old-scope',status:'pending',dependsOn:['blocked-n64'],sessionId:null,attempt:null,candidateSha:null,baseSha:null,worktreePath:null,resultPath:null,runnerPid:null,brokerPid:null,ownedProcesses:null};
  const replacement={id:'new-n36',productId:'N36',status:'awaiting_po',candidateSha:candidate,deliveryReceipt:{taskId:'new-n36',ticketId:'N36',candidateSha:candidate,publishedSha:published,currentMainSha:published,status:'deployed',state:'DEPLOYED_AWAITING_PO',productionDeployed:true,closed:false,verifiedAt:'2026-10-15T09:06:38.892Z',provider:{headSha:published,conclusion:'success'},binding:{candidateAncestorOfPublished:true,previousMainAncestorOfPublished:true,mainContainsPublished:true,checkHeadShaMatches:true},evidence:{immutable:{passed:true,assets:[{verified:true}]},production:{passed:true,assets:[{verified:true}]}}}};
  const card={id:'old-n36',activationId:'active',productId:'N36',scopeKey:'old-scope',completionMode:'superseded_by_verified_delivery',supersededBy:'new-n36',supersedingPublishedSha:published,allowedPaths:['src/a.js'],requiredChecks:['proof']};
  const update={card,expected:{id:'old-n36',status:'pending',sessionId:null,lastRunId:null,candidateSha:null,dependsOn:['blocked-n64']},materialReason:'Retire exact pristine duplicate after verified same-product Production delivery'};
  return {task,replacement,update};
}
test('accepts only pristine unstarted pending duplicate with exact verified delivery',()=>{const f=fixture();assert.equal(verifyPristinePendingSupersession(f.task,f.replacement,f.update,'active'),true);const q=revisedTask(f.task,f.update,'e'.repeat(40),'2026-10-16T12:00:00Z');assert.equal(q.status,'blocked');assert.deepEqual(q.dependsOn,[]);assert.match(q.lastFailure,/SUPERSEDED_BY_VERIFIED_DELIVERY/);assert.equal(q.supersessionEvidence.publishedSha,published);});
for(const [name,change] of [
 ['started session',f=>f.task.sessionId='saved'],
 ['attempt exists',f=>f.task.attempt={runId:'run'}],
 ['dependency drift',f=>f.task.dependsOn=[]],
 ['wrong product',f=>f.replacement.productId='N64'],
 ['not awaiting PO',f=>f.replacement.status='blocked'],
 ['published hash drift',f=>f.replacement.deliveryReceipt.publishedSha='f'.repeat(40)],
 ['provider mismatch',f=>f.replacement.deliveryReceipt.provider.headSha='f'.repeat(40)],
 ['immutable failed',f=>f.replacement.deliveryReceipt.evidence.immutable.passed=false],
 ['production asset failed',f=>f.replacement.deliveryReceipt.evidence.production.assets[0].verified=false]
]) test('rejects '+name,()=>{const f=fixture();change(f);assert.throws(()=>verifyPristinePendingSupersession(f.task,f.replacement,f.update,'active'));});
