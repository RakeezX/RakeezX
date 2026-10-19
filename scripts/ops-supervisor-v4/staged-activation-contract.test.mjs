// AI: synthetic metadata only; never performs provider, Auth, student or browser actions.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {verifiedActivationStageContinuation,N88_FINAL_CHECKS,N88_PILOT_CHECKS,STAGED_ACTIVATION_MODE} from './staged-activation-contract.mjs';
const {verifiedDeployment}=await import(process.env.RAKEEZ_STAGE_TEST_CONTROLLER_URL||'./controller.mjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),receiptSha256=d=>createHash('sha256').update(JSON.stringify(d,null,2)+'\n').digest('hex');
function fixture(){
 const id='continuous-n88-official-student-portal-activation-20261018',candidate='a'.repeat(40),base='b'.repeat(40),published='c'.repeat(40),preview='https://synthetic-stage.pages.dev';
 const asset={repoPath:'src/lib/student-portal-runtime.js',urlPath:'src/lib/student-portal-runtime.js',statusCode:200,expectedSha256:'1'.repeat(64),observedSha256:'1'.repeat(64),verified:true};
 const receipt={status:'deployed',taskId:id,ticketId:'N88',candidateSha:candidate,baseSha:base,publishedSha:published,deploymentId:'synthetic-deployment',productSourceChangeObserved:true,changedAssets:[asset.repoPath],verifiedAt:'2026-10-19T04:00:00Z',
  binding:{candidateSha:candidate,declaredBaseSha:base,publishedSha:published,candidateAncestorOfPublished:true,previousMainAncestorOfPublished:true,mainContainsPublished:true},
  provider:{headSha:published,status:'completed',conclusion:'success',deploymentId:'synthetic-deployment',previewUrl:preview},
  evidence:{immutable:{origin:preview,passed:true,assets:[asset]},production:{origin:'https://rakeezx.com',passed:true,assets:[structuredClone(asset)]}}};
 const stagedActivation={version:1,phase:'pilot',maxTeachers:1,maxFabricatedStudents:2,dataScope:'designated-fabricated-only',publicEnableRequiresHostedProof:true,pilotStageIsNotProductCompletion:true,originalRequiredChecks:[...N88_FINAL_CHECKS],finalRequiredChecks:[...new Set([...N88_FINAL_CHECKS,...N88_PILOT_CHECKS])],finalAcceptance:['Complete the original hosted journey before public activation.']};
 const task={id,productId:'N88',scopeKey:'n88-official-hosted-private-service-activation',liveMutation:true,liveAuthorizationRef:'original-authority',executionMode:'local',status:'awaiting_po',sessionId:'original-session',attempt:{runId:'pilot-run'},candidateSha:candidate,baseSha:base,requiredChecks:[...N88_PILOT_CHECKS],allowedPaths:[asset.repoPath],acceptance:['Pilot scope only; final acceptance remains unperformed.'],stagedActivation,deliveryReceipt:receipt};
 const result={taskId:id,runId:'pilot-run',state:'LOCAL_READY',candidateSha:candidate,baseSha:base,blockerType:'none',blocker:null,checks:[...N88_PILOT_CHECKS.map(name=>({name,status:'PASS'})),...N88_FINAL_CHECKS.filter(n=>!N88_PILOT_CHECKS.includes(n)).map(name=>({name,status:'NOT_RUN'}))]};
 const card={id,productId:'N88',scopeKey:task.scopeKey,liveMutation:true,liveAuthorizationRef:task.liveAuthorizationRef,executionMode:'local',allowedPaths:task.allowedPaths,requiredChecks:[...stagedActivation.finalRequiredChecks],acceptance:stagedActivation.finalAcceptance,stagedActivation:{...stagedActivation,phase:'acceptance-and-public-enable'},completionMode:STAGED_ACTIVATION_MODE,
  verificationRepair:{kind:'verified-pilot-stage-continuation-v1',publishedSha:published,priorReceiptSha256:receiptSha256(receipt),reviewedFixtureSha256:'2'.repeat(64),reason:'The original bounded pilot frontend is verified; resume the same original session for actual hosted acceptance before enabling public access.'}};
 const update={card,expected:{status:'awaiting_po',resultState:'LOCAL_READY',sessionId:task.sessionId,lastRunId:'pilot-run',candidateSha:candidate}};
 return {task,result,update};
}
const verify=f=>verifiedActivationStageContinuation(f.task,f.result,f.update,{verifiedDeployment,receiptSha256,same});
test('verified pilot resumes same session with full original acceptance; it does not close or enable the product',()=>{
 const f=fixture();assert.equal(verify(f),true);assert.equal(f.task.status,'awaiting_po');assert.equal(f.task.stagedActivation.phase,'pilot');
 assert.equal(f.result.checks.some(c=>c.status==='NOT_RUN'),true);
});
const cases={
 'unverified publication':f=>{f.task.deliveryReceipt.provider.conclusion='failure';},
 'wrong prior receipt':f=>{f.update.card.verificationRepair.priorReceiptSha256='f'.repeat(64);},
 'closed ticket':f=>{f.task.status='closed';},
 'wrong session':f=>{f.update.expected.sessionId='another-session';},
 'wrong run':f=>{f.result.runId='another-run';},
 'wrong candidate':f=>{f.result.candidateSha='f'.repeat(40);},
 'different task':f=>{f.task.id='another-task';},
 'expanded pupil budget':f=>{f.task.stagedActivation.maxFabricatedStudents=3;},
 'expanded teacher budget':f=>{f.task.stagedActivation.maxTeachers=2;},
 'public enable without proof':f=>{f.task.stagedActivation.publicEnableRequiresHostedProof=false;},
 'missing final original requirement':f=>{f.task.stagedActivation.finalRequiredChecks.pop();f.update.card.requiredChecks=[...f.task.stagedActivation.finalRequiredChecks];},
 'changed final acceptance':f=>{f.update.card.acceptance=['skip the real journey'];},
 'expanded path scope':f=>{f.update.card.allowedPaths=['**'];},
 'changed live authority':f=>{f.update.card.liveAuthorizationRef='another-authority';},
 'failed pilot isolation':f=>{f.result.checks.find(c=>c.name==='n88_pilot_owner_admission_and_failclosed_rollout').status='FAIL';},
 'missing pilot isolation':f=>{f.result.checks=f.result.checks.filter(c=>c.name!=='n88_pilot_owner_admission_and_failclosed_rollout');},
 'unexpected skipped prerequisite':f=>{f.result.checks.push({name:'required privacy gate',status:'NOT_RUN'});},
 'unresolved blocker':f=>{f.result.blocker='actual provider refusal';},
 'invalid next phase':f=>{f.update.card.stagedActivation.phase='public';}
};
for(const [name,change]of Object.entries(cases))test('stage continuation rejects '+name,()=>{const f=fixture();change(f);assert.equal(verify(f),false);});
export {fixture as makeStageFixture};
