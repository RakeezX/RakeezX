// AI: exact historical source-declaration correction; no network or runtime mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifiedSourceOnlyDeclarationRepair,verifyInactiveIdentity,validatePayload} from './apply-reviewed-maintenance.mjs';
import {verifiedDeployment,verifiedSourceOnlyPublication} from './controller.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), payload=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const base={task:fixture.task,result:fixture.result,update:payload.cardUpdates[0]};
const check=x=>verifiedSourceOnlyDeclarationRepair(x.task,x.result,x.update);
assert.equal(verifiedSourceOnlyPublication(base.task,base.task.deliveryReceipt),false);
assert.equal(verifiedDeployment(base.task,base.task.deliveryReceipt),false);
assert.equal(check(base),true);
assert.equal(verifiedDeployment({...base.task,...base.update.card},base.task.deliveryReceipt),true);
assert.equal(verifyInactiveIdentity(base.task,base.result,base.update,base.task.activationId),true);
validatePayload(payload);
assert.equal(createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex'),base.update.card.verificationRepair.reviewedFixtureSha256);
const negative={
  candidate:x=>{x.result.candidateSha='a'.repeat(40);},
  run:x=>{x.result.runId='11111111-1111-1111-1111-111111111111';},
  requiredFailure:x=>{x.result.checks[0].status='FAIL';},
  unrelatedNotRun:x=>{x.result.checks.find(c=>c.status==='NOT_RUN').name='unrelated_check';},
  anotherNotRun:x=>{x.result.checks[3].status='NOT_RUN';},
  changedScope:x=>{x.update.card.allowedPaths.push('src/auth.js');},
  liveMutation:x=>{x.update.card.liveMutation=true;},
  providerFailure:x=>{x.task.deliveryReceipt.provider.conclusion='failure';},
  assetMismatch:x=>{x.task.deliveryReceipt.evidence.production.assets[1].observedSha256='a'.repeat(64);},
  wrongPublication:x=>{x.task.deliveryReceipt.publishedSha='b'.repeat(40);},
  alteredAuthority:x=>{x.update.card.releaseAuthority+=' enable live installation';},
  wrongFailure:x=>{x.task.lastFailure='Real service denied';},
  originalSource:x=>{x.task.approvedNote.sha256='c'.repeat(64);}
};
for(const[name,change]of Object.entries(negative)){const x=structuredClone(base);change(x);assert.equal(check(x),false,name);}
console.log(JSON.stringify({status:'PASS',originalRejected:true,exactDeclarationAccepted:true,negativeCases:Object.keys(negative).length,hostedInstallation:'NOT_RUN',mutatedRuntime:false}));
