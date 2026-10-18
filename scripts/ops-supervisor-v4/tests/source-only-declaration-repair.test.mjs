import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,verifiedSourceOnlyDeclarationRepair} from '../apply-reviewed-maintenance.mjs';
import {verifiedDeployment} from '../controller.mjs';

const digest=value=>sha256(Buffer.from(JSON.stringify(value,null,2)+'\n'));
function fixture(){
  const id='continuous-n88-current-functional-review-20261018',candidate='a'.repeat(40),base='b'.repeat(40),published='d'.repeat(40);
  const paths=['drafts/n88-student-portal/current-review.mjs','docs/automation-evidence/20261018/N88_CURRENT_FUNCTIONAL_REVIEW.md'];
  const assets=paths.map(repoPath=>({repoPath,urlPath:repoPath,statusCode:200,expectedSha256:'c'.repeat(64),observedSha256:'c'.repeat(64),verified:true}));
  const receipt={status:'deployed',taskId:id,ticketId:'N88',candidateSha:candidate,baseSha:base,publishedSha:published,
    state:'DEPLOYED_AWAITING_PO',productionDeployed:true,closed:false,productSourceChangeObserved:false,changedAssets:[],changedPaths:paths,sourceOnlyPaths:[paths[0]],
    deploymentId:'test-deployment',provider:{headSha:published,status:'completed',conclusion:'success',deploymentId:'test-deployment',previewUrl:'https://test.rakeezx.pages.dev'},
    binding:{candidateSha:candidate,declaredBaseSha:base,publishedSha:published,candidateAncestorOfPublished:true,previousMainAncestorOfPublished:true,mainContainsPublished:true},
    evidence:{immutable:{origin:'https://test.rakeezx.pages.dev',passed:true,assets:structuredClone(assets)},production:{origin:'https://rakeezx.com',passed:true,assets:structuredClone(assets)}}};
  const task={id,productId:'N88',status:'blocked',lastFailure:'Publisher returned incomplete or mismatched deployment proof',candidateSha:candidate,baseSha:base,
    executionMode:'synthetic',liveMutation:false,allowedPaths:paths,verificationPaths:paths,requiredChecks:['current_journey'],
    releaseAuthority:'Explicit PO sole publisher source-only inert launcher release; no hosted activation.',deliveryReceipt:receipt};
  const result={state:'LOCAL_READY',blockerType:'none',blocker:null,checks:[{name:'current_journey',status:'PASS'}]};
  const card={executionMode:task.executionMode,liveMutation:false,allowedPaths:paths,verificationPaths:paths,requiredChecks:task.requiredChecks,releaseAuthority:task.releaseAuthority,
    completionMode:'reconcile_source_only_declaration',preparationAuthority:{publication:true,publicationScope:'inert inactive source-only local N88 review launcher',realData:false,hostedSchemaChange:false,AuthRLSChange:false,realSend:false,liveStudentAccessActivation:false},
    verificationRepair:{publishedSha:published,priorReceiptSha256:digest(receipt),reviewedFixtureSha256:'e'.repeat(64),reason:'Repair missing source-only declaration already explicit in original approved release authority; retain every exact receipt and check.'}};
  return {task,result,update:{card}};
}
test('repairs the exact missing original declaration while preserving complete published proof',()=>{
  const f=fixture();assert.equal(verifiedDeployment(f.task,f.task.deliveryReceipt),false);
  assert.equal(verifiedSourceOnlyDeclarationRepair(f.task,f.result,f.update),true);
  assert.equal(verifiedDeployment({...f.task,preparationAuthority:f.update.card.preparationAuthority},f.task.deliveryReceipt),true);
});
test('never admits missing/failed/NOT_RUN checks or altered receipt proof',()=>{
  for(const change of [f=>f.result.checks[0].status='FAIL',f=>f.result.checks[0].status='NOT_RUN',f=>f.result.checks=[],
    f=>f.task.deliveryReceipt.evidence.production.assets[0].verified=false,f=>f.task.deliveryReceipt.provider.headSha='f'.repeat(40),
    f=>f.task.deliveryReceipt.evidence.immutable.assets.pop(),f=>f.update.card.verificationRepair.priorReceiptSha256='f'.repeat(64)]){
    const f=fixture();change(f);assert.equal(verifiedSourceOnlyDeclarationRepair(f.task,f.result,f.update),false);
  }
});
test('rejects live permissions, expanded scope, unrelated tickets and unsupported authority',()=>{
  for(const change of [f=>f.update.card.preparationAuthority.realData=true,f=>f.update.card.preparationAuthority.AuthRLSChange=true,
    f=>f.update.card.preparationAuthority.liveStudentAccessActivation=true,f=>f.update.card.liveMutation=true,
    f=>f.update.card.allowedPaths=[...f.update.card.allowedPaths,'src/app.js'],f=>f.task.id='another-task',
    f=>f.task.releaseAuthority='generic authority',f=>f.task.preparationAuthority={publication:false},
    f=>f.update.card.requiredChecks=[],f=>f.update.card.verificationPaths=[f.update.card.verificationPaths[0]]]){
    const f=fixture();change(f);assert.equal(verifiedSourceOnlyDeclarationRepair(f.task,f.result,f.update),false);
  }
});
