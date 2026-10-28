import {POSTCLICK_AUTHORITY as POSTCLICK} from './postclick-authority.mjs';
import {WITNESS_SIXTH_AUTHORITY as SIXTH} from './witness-sixth-authority.mjs';
import {PR6_CLOSED_FOURTH as PR6_CLOSED} from './pr6-closed-fourth.mjs';
import {USER_CLOSED_FOURTH as USER_CLOSED} from './user-closed-fourth-envelope.mjs';
import {CLOSED_FOURTH_SUCCESSOR as CLOSED} from './closed-fourth-successor.mjs';
/** AI: trusted server-only approval. Never populate from an HTTP body or browser. */
import {createHash} from 'node:crypto';
import {id,uuid,rate,record,principal,current} from './shared.mjs';
import {CURRENT_REQUEST_RUN,CURRENT_REQUEST_HASH,FOURTH_REQUEST_RUN,FOURTH_REQUEST_HASH,FOURTH_CREATED_AT,FOURTH_HARD_END,FOURTH_MAX_WINDOW_MS} from './current-request-authority.mjs';
export const DEVICE_TEST_ID='n44-one-device-20261019';
export const DEVICE_CAPABILITY='n44-single-device-20261019-v1';
export const DEVICE_TEST_END=Date.parse('2026-10-20T00:00:00Z');
export const CAUSAL_REGISTRATION_RUN='6a501522-53d1-4cc3-b256-bca6bcd95e4b';
export const CURRENT_SCOPE_END=Date.parse('2026-10-24T19:29:56.557Z');
export const ADDITIONAL_TEST_RUN='adaae40f-d43b-43cb-92a4-235255d3abc7';
const ADDITIONAL_AUTHORITY='4fcaaa0de1c60e2ae2071f989203c8c160e5b68a260f3e00a575a643aa61288a';
export const SUCCESSOR_GENERATION_RUN='453ac381-c43d-4cf7-bcc9-2ecf5edd6a2a';
export const SUCCESSOR_HARD_END=Date.parse('2026-10-24T23:55:00.000Z');
const successorKeys=['v','runId','predecessorRun','startsAt'];
function successorAllowed(value,now){return record(value,successorKeys)&&value.v===1&&value.runId===SUCCESSOR_GENERATION_RUN&&value.predecessorRun===ADDITIONAL_TEST_RUN&&Number.isSafeInteger(value.startsAt)&&value.startsAt>=Date.parse('2026-10-24T22:40:31.104Z')&&value.startsAt<=Date.parse('2026-10-24T23:25:00.000Z')&&value.startsAt<=now;}
export const REVIEWED_COMPLETION_SHA256='34d866d04feecfccad4898e5874769568aaa54f5bc5f17b2dfbc973d2f8c48d0';
export const REVIEWED_EIGHT_GENERATION=CURRENT_REQUEST_RUN+':reviewed-eight';
const reviewedEight=c=>c?.v===2&&c.reviewedCompletionSha256===REVIEWED_COMPLETION_SHA256&&c.priorRegistrationAcks===7;
const currentGeneration=a=>reviewedEight(a?.currentRequest)?REVIEWED_EIGHT_GENERATION:CURRENT_REQUEST_RUN;
const scopeKeys=['testId','runId','ownerId','workspaceId','deviceId','expiresAt','target'];
const fourthKeys=['v','authoritySha256','predecessorRun','policyApprovalId','priorRegistrationAcks','priorSenderRequests','maxSenderRequests','startsAt','serviceSourceSha','previousRegistrationId'];
export const FOURTH_REGISTRATION_GENERATION=FOURTH_REQUEST_RUN+':registration-nine';
const postClick=a=>a?.runId===POSTCLICK.runId&&a?.currentRequest?.v===5;
const witnessedSixth=a=>a?.runId===SIXTH.runId&&a?.currentRequest?.v===6;
export const POSTCLICK_REGISTRATION_GENERATION=FOURTH_REQUEST_RUN+':registration-ten';
export const WITNESS_SIXTH_REGISTRATION_GENERATION=FOURTH_REQUEST_RUN+':registration-eleven';
const registrationGeneration=a=>witnessedSixth(a)?WITNESS_SIXTH_REGISTRATION_GENERATION:postClick(a)?POSTCLICK_REGISTRATION_GENERATION:FOURTH_REGISTRATION_GENERATION;
const closedEnvelope=a=>witnessedSixth(a)?SIXTH:postClick(a)?POSTCLICK:a?.currentRequest?.v===4?(a.runId===CLOSED.runId?CLOSED:a.runId===USER_CLOSED.runId?USER_CLOSED:a.runId===PR6_CLOSED.runId?PR6_CLOSED:null):null;
const successorFourth=a=>!!closedEnvelope(a);
const fourth=a=>a?.runId===FOURTH_REQUEST_RUN&&a?.currentRequest?.v===3||successorFourth(a);
const fourthEnd=a=>successorFourth(a)?closedEnvelope(a).hardEnd:FOURTH_HARD_END;
function fourthRequestAllowed(value,now){
 const c=value?.currentRequest,newScope=closedEnvelope(value),bound=newScope?{hash:newScope.authoritySha256,predecessor:FOURTH_REQUEST_RUN,created:newScope.createdAt,end:newScope.hardEnd}:{hash:FOURTH_REQUEST_HASH,predecessor:CURRENT_REQUEST_RUN,created:FOURTH_CREATED_AT,end:FOURTH_HARD_END};
 return record(value,[...scopeKeys,'currentRequest'])&&fourth(value)&&record(c,fourthKeys)&&c.authoritySha256===bound.hash&&c.predecessorRun===bound.predecessor&&
  /^[a-f0-9]{64}$/.test(c.policyApprovalId??'')&&/^[a-f0-9]{40}$/.test(c.serviceSourceSha??'')&&uuid(c.previousRegistrationId)&&c.priorRegistrationAcks===(witnessedSixth(value)?10:postClick(value)?9:8)&&c.priorSenderRequests===(witnessedSixth(value)?5:postClick(value)?4:3)&&c.maxSenderRequests===(witnessedSixth(value)?6:postClick(value)?5:4)&&
  Number.isSafeInteger(c.startsAt)&&Number.isSafeInteger(value.expiresAt)&&c.startsAt>=bound.created&&c.startsAt<=now&&now<value.expiresAt&&value.expiresAt<=bound.end&&value.expiresAt>c.startsAt&&value.expiresAt-c.startsAt<=FOURTH_MAX_WINDOW_MS&&
  Math.floor((value.expiresAt-1)/86400000)===Math.floor(c.startsAt/86400000)&&(!value.target||value.target.registrationId!==c.previousRegistrationId);
}
function currentRequestAllowed(value,now){
 // Bounds come only from source-bound server configuration. Original custody
 // reserves the ONE scope before installing it; browser bodies cannot set it.
 const c=value?.currentRequest,w={startsAt:c?.startsAt,expiresAt:value?.expiresAt};
 return record(value,[...scopeKeys,'currentRequest'])&&value.runId===CURRENT_REQUEST_RUN&&(record(c,['v','authoritySha256','predecessorRun','policyApprovalId','priorRegistrationAcks','priorSenderRequests','maxSenderRequests','startsAt'])&&c.v===1&&c.priorRegistrationAcks===6||record(c,['v','authoritySha256','predecessorRun','policyApprovalId','priorRegistrationAcks','priorSenderRequests','maxSenderRequests','startsAt','reviewedCompletionSha256'])&&reviewedEight(c))&&c.authoritySha256===CURRENT_REQUEST_HASH&&c.predecessorRun===SUCCESSOR_GENERATION_RUN&&/^[a-f0-9]{64}$/.test(c.policyApprovalId)&&c.priorSenderRequests===2&&c.maxSenderRequests===3&&Number.isSafeInteger(w.startsAt)&&Number.isSafeInteger(w.expiresAt)&&w.startsAt>=Date.parse('2026-10-25T09:02:13.565Z')&&w.startsAt<=now&&now<w.expiresAt&&w.expiresAt-w.startsAt>0&&w.expiresAt-w.startsAt<=3600000&&Math.floor((w.expiresAt-1)/86400000)===Math.floor(w.startsAt/86400000);
}
const firstMarker='day:'+DEVICE_TEST_ID,additionalMarker=firstMarker+':additional:'+ADDITIONAL_TEST_RUN;
const generationMarker=run=>firstMarker+':registration-generation:'+run;
const currentSendMarker=firstMarker+':authority:'+CURRENT_REQUEST_RUN;
const oldTwoSpent=tx=>tx.get('budgets',firstMarker)?.count===1&&tx.get('budgets',additionalMarker)?.count===1;
const fourthSendMarker=firstMarker+':authority:'+FOURTH_REQUEST_RUN;
const fifthSendMarker=fourthSendMarker+':postclick-fifth';
const sixthSendMarker=fourthSendMarker+':witness-sixth';
const sendMarker=a=>witnessedSixth(a)?sixthSendMarker:postClick(a)?fifthSendMarker:fourthSendMarker;
const oldFourSpent=tx=>oldThreeSpent(tx)&&eighthGenerationSpent(tx)&&tx.get('budgets',fourthSendMarker)?.count===1&&tx.get('budgets',generationMarker(FOURTH_REGISTRATION_GENERATION))?.count===1;
const oldFiveSpent=tx=>oldFourSpent(tx)&&tx.get('budgets',fifthSendMarker)?.count===1&&tx.get('budgets',generationMarker(POSTCLICK_REGISTRATION_GENERATION))?.count===1;
const fourthBinding=(a,rid)=>generationMarker(registrationGeneration(a))+':binding:'+createHash('sha256').update(JSON.stringify([a.ownerId,a.workspaceId,a.deviceId,rid,a.currentRequest.previousRegistrationId,a.currentRequest.policyApprovalId,a.currentRequest.serviceSourceSha,a.currentRequest.startsAt,a.expiresAt])).digest('hex');
const oldThreeSpent=tx=>oldTwoSpent(tx)&&tx.get('budgets',currentSendMarker)?.count===1;
const eighthGenerationSpent=tx=>tx.get('budgets',generationMarker(SUCCESSOR_GENERATION_RUN))?.count===1&&tx.get('budgets',generationMarker(CURRENT_REQUEST_RUN))?.count===1&&tx.get('budgets',generationMarker(REVIEWED_EIGHT_GENERATION))?.count===1;
// Original budget codec/SQL stays unchanged. The compiled request window must
// end in its original UTC bucket; rollover expires this authority, never renews it.
const consumeCurrentDay=(tx,key,now)=>{if(tx.get('budgets',key))return false;return rate(tx,key,now,86400000,1);};
// Fixed fourth markers survive UTC rollover until this authority is permanently
// expired. No arbitrary key, ceiling or rollover-reset option is accepted.
const consumeFourth=(tx,key,now,end=FOURTH_HARD_END)=>{
 if(![fourthSendMarker,generationMarker(FOURTH_REGISTRATION_GENERATION),fifthSendMarker,generationMarker(POSTCLICK_REGISTRATION_GENERATION),sixthSendMarker,generationMarker(WITNESS_SIXTH_REGISTRATION_GENERATION)].includes(key)||now>=end||tx.get('budgets',key))return false;
 // Keep the unchanged day-budget codec, using the final authorized UTC bucket.
 // Presence, not bucket equality, is the one-use guard for this fixed authority.
 const bucket=Math.floor((end-1)/86400000);
 tx.set('budgets',key,{bucket,count:1,expiresAt:(bucket+1)*86400000});return true;
};
export function deviceApproval(value,now) {
 const currentRequest=currentRequestAllowed(value,now)||fourthRequestAllowed(value,now);
 const renewed=value?.expiresAt===Date.parse('2026-10-24T19:29:56.557Z')&&now>=Date.parse('2026-10-24T17:59:56.555Z')&&now<value.expiresAt;
 const causal=record(value,[...scopeKeys,'registrationRecovery'])&&value.runId===CAUSAL_REGISTRATION_RUN&&value.expiresAt===CURRENT_SCOPE_END&&record(value.registrationRecovery,['v','policyApprovalId'])&&value.registrationRecovery.v===1&&/^[a-f0-9]{64}$/.test(value.registrationRecovery.policyApprovalId);
 const successor=value?.additionalTest?.successorGeneration;
 const additionalShape=record(value?.additionalTest,['v','authoritySha256','policyApprovalId'])||record(value?.additionalTest,['v','authoritySha256','policyApprovalId','successorGeneration'])&&successorAllowed(successor,now)&&value.expiresAt<=SUCCESSOR_HARD_END&&value.expiresAt-successor.startsAt<=5400000;
 const additional=record(value,[...scopeKeys,'additionalTest'])&&value.runId===ADDITIONAL_TEST_RUN&&additionalShape&&value.additionalTest.v===1&&value.additionalTest.authoritySha256===ADDITIONAL_AUTHORITY&&/^[a-f0-9]{64}$/.test(value.additionalTest.policyApprovalId)&&now>=Date.parse('2026-10-24T18:53:23.615Z')&&value.expiresAt<=now+5400000;
 if((!record(value,scopeKeys)&&!causal&&!additional&&!currentRequest)||value.testId!==DEVICE_TEST_ID||!uuid(value.runId)||
   ![value.ownerId,value.workspaceId,value.deviceId].every(id)||!Number.isSafeInteger(value.expiresAt)||
   value.expiresAt<=now||value.expiresAt>now+86400000||(value.expiresAt>DEVICE_TEST_END&&!renewed&&!additional&&!currentRequest)||(now>=DEVICE_TEST_END&&!renewed&&!additional&&!currentRequest)||
   !currentRequest&&Math.floor((value.expiresAt-1)/86400000)!==Math.floor(now/86400000))return null;
 if(value.target!==null&&(!record(value.target,['registrationId','eventId'])||!uuid(value.target.registrationId)||
   typeof value.target.eventId!=='string'||!/^[a-zA-Z0-9_:%.-]{1,240}$/.test(value.target.eventId)))return null;
 return Object.freeze(structuredClone(value));
}
export function publicDeviceConfiguration(approval,ownerId,scope,publicKey,source,now) {
 const a=deviceApproval(approval,now);
 if(!a||ownerId!==a.ownerId||scope.workspaceId!==a.workspaceId||scope.deviceId!==a.deviceId||
   fourth(a)&&a.currentRequest.serviceSourceSha!==source||
   !/^B[A-Za-z0-9_-]{86}$/.test(publicKey??'')||!(/^[a-f0-9]{40}$/).test(source??''))return {status:'disabled'};
 return {status:'ready',protocol:'n44-browser-v2',capability:DEVICE_CAPABILITY,serviceRevision:'n44-browser-service-v2',
   serviceSourceSha:source,publicKey,expiresAt:a.expiresAt,deliveryEnabled:false,schedulerEnabled:false};
}
/** AI: one recovery of this approved physical device, never revival of an ID.
 * Called only inside the existing owner/session-locked registration snapshot.
 * A committed revoked row (with erased secrets) is retained, not deleted.
 */
/** Pure locked-snapshot classifier: never calls rate or writes state. */
export function classifyDeviceRegistration(tx,auth,request,approval,now,{preview=false}={}) {
 const a=deviceApproval(approval,now),deny=category=>({allowed:false,category});
 if(!a)return deny('expired');if(auth.ownerId!==a.ownerId)return deny('owner');
 if(request.workspaceId!==a.workspaceId||request.deviceId!==a.deviceId)return deny('scope');
 const prior=tx.rows('registrations').filter(r=>r.workspaceId===a.workspaceId&&r.deviceId===a.deviceId&&r.registrationId!==request.registrationId);
 const total='day:'+DEVICE_TEST_ID,recovery=total+':registration-recovery';
 if(fourth(a)){
  if(a.target!==null)return deny('targetBound');
  if(!principal(auth,now)||!auth.sessionRevision.endsWith(':'+a.currentRequest.policyApprovalId))return deny('currentPolicy');
  const ctx=tx.context(a.workspaceId,a.deviceId);if(!preview&&!current(ctx,auth,now))return deny('currentContext');
  const previous=tx.get('registrations',a.currentRequest.previousRegistrationId);
  if(!previous||previous.workspaceId!==a.workspaceId||previous.deviceId!==a.deviceId||previous.state!=='revoked'||previous.sealed!==null||previous.fingerprint!==null||previous.bindingFingerprint!==null)return deny('eighthRegistrationNotRevoked');
  if(!preview&&(ctx.pushConsent!==true||ctx.consentRevision!==request.consent?.revision||ctx.consentRevision===previous.consentRevision))return deny('freshConsentRequired');
  if(request.registrationId&&tx.get('registrations',request.registrationId))return deny('reusedID');
  if(!prior.length||prior.some(r=>r.state!=='revoked'||r.sealed!==null||r.fingerprint!==null||r.bindingFingerprint!==null))return deny('priorHistory');
  if(!oldThreeSpent(tx))return deny('priorThreeMissing');
  if(!eighthGenerationSpent(tx))return deny('eighthGenerationMissing');
  if(postClick(a)&&!oldFourSpent(tx))return deny('priorFourMissing');
  if(witnessedSixth(a)&&!oldFiveSpent(tx))return deny('priorFiveMissing');
  if(tx.get('budgets',sendMarker(a)))return deny(postClick(a)?'fifthSendConsumed':'fourthSendConsumed');
  const key=generationMarker(registrationGeneration(a));if(tx.get('budgets',key))return deny('consumedGeneration');
  return {allowed:true,category:postClick(a)?'postclickFifthRegistrationTen':'instrumentedFourthRegistrationNine',oneUseKey:key};
 }
 if(a.currentRequest){
  if(a.target!==null)return deny('targetBound');
  if(!principal(auth,now)||!auth.sessionRevision.endsWith(':'+a.currentRequest.policyApprovalId))return deny('currentPolicy');
  const ctx=tx.context(a.workspaceId,a.deviceId);if(!preview&&!current(ctx,auth,now))return deny('currentContext');
  if(!preview&&(ctx.pushConsent!==true||ctx.consentRevision!==request.consent?.revision))return deny('staleConsent');
  if(request.registrationId&&tx.get('registrations',request.registrationId))return deny('reusedID');
  if(!prior.length||prior.some(r=>r.state!=='revoked'||r.sealed!==null||r.fingerprint!==null||r.bindingFingerprint!==null))return deny('priorHistory');
  if(!oldTwoSpent(tx))return deny('priorTwoMissing');
  if(tx.get('budgets',generationMarker(SUCCESSOR_GENERATION_RUN))?.count!==1)return deny('predecessorGenerationMissing');
  if(tx.get('budgets',currentSendMarker))return deny('currentSendConsumed');
  if(reviewedEight(a.currentRequest)&&tx.get('budgets',generationMarker(CURRENT_REQUEST_RUN))?.count!==1)return deny('seventhGenerationMissing');
  const key=generationMarker(currentGeneration(a));if(tx.get('budgets',key))return deny('consumedGeneration');
  return {allowed:true,category:reviewedEight(a.currentRequest)?'reviewedRequestEight':'currentRequestSeven',oneUseKey:key};
 }
 if(a.additionalTest){
  if(a.target!==null)return deny('targetBound');
  if(!principal(auth,now)||!auth.sessionRevision.endsWith(':'+a.additionalTest.policyApprovalId))return deny('currentPolicy');
  // Configuration precedes the normal authenticated context/consent setup.
  // Preview publishes no registration permit; actual acceptance stays strict.
  const ctx=tx.context(a.workspaceId,a.deviceId);if(!preview&&!current(ctx,auth,now))return deny('currentContext');
  if(!preview&&(ctx.pushConsent!==true||ctx.consentRevision!==request.consent?.revision))return deny('staleConsent');
  if(request.registrationId&&tx.get('registrations',request.registrationId))return deny('reusedID');
  // This locked snapshot contains only this owner's device history. The global
  // lifetime ACK cap belongs to the protected operator ledger/trusted scope.
  if(!prior.length||prior.some(r=>r.state!=='revoked'||r.sealed!==null||r.fingerprint!==null||r.bindingFingerprint!==null))return deny('priorHistory');
  // The original spent marker is a prerequisite, never reset or rewritten.
  if(tx.get('budgets',total)?.count!==1)return deny('firstAttemptMissing');
  if(tx.get('budgets',total+':additional:'+ADDITIONAL_TEST_RUN))return deny('additionalSendConsumed');
  const predecessor=total+':registration-generation:'+ADDITIONAL_TEST_RUN;
  const successor=a.additionalTest.successorGeneration;
  if(successor&&tx.get('budgets',predecessor)?.count!==1)return deny('predecessorGenerationMissing');
  const generation=total+':registration-generation:'+(successor?SUCCESSOR_GENERATION_RUN:ADDITIONAL_TEST_RUN);
  if(tx.get('budgets',generation))return deny('consumedGeneration');
  return {allowed:true,category:'explicitAdditionalTest',recoveryKey:generation};
 }
 if(a.registrationRecovery){
  if(a.target!==null)return deny('targetBound');
  if(!principal(auth,now)||!auth.sessionRevision.endsWith(':'+a.registrationRecovery.policyApprovalId))return deny('currentPolicy');
  const ctx=tx.context(a.workspaceId,a.deviceId);if(!preview&&!current(ctx,auth,now))return deny('currentContext');
  if(!preview&&(ctx.pushConsent!==true||ctx.consentRevision!==request.consent?.revision))return deny('staleConsent');
  if(request.registrationId&&tx.get('registrations',request.registrationId))return deny('reusedID');
  if(!prior.length)return deny('historyMissing');
  if(prior.some(r=>r.state!=='revoked'))return deny('activePrior');
  if(prior.some(r=>r.sealed!==null||r.fingerprint!==null||r.bindingFingerprint!==null))return deny('priorSecrets');
  if(tx.get('budgets',total))return deny('totalSendBudget');
  const generation=total+':registration-generation:'+a.runId;
  if(tx.get('budgets',generation))return deny('consumedGeneration');
  return {allowed:true,category:'trustedCurrentGeneration',recoveryKey:generation};
 }
 if(!prior.length)return {allowed:true,category:'fresh'};
 if(a.target!==null||tx.get('registrations',request.registrationId))return deny('reusedID');
 if(tx.get('budgets',total))return deny('totalSendBudget');if(tx.get('budgets',recovery))return deny('oldRecoveryBudget');
 if(prior.some(r=>r.state!=='revoked'||r.sealed!==null||r.fingerprint!==null||r.bindingFingerprint!==null))return deny('activePrior');
 if(prior.some(r=>r.sessionId!==auth.sessionId))return deny('priorSession');
 if(prior.some(r=>r.sessionRevision!==auth.sessionRevision))return deny('priorSessionRevision');
 return {allowed:true,category:'legacyRecovery',recoveryKey:recovery};
}
export function admitDeviceRegistration(tx,auth,request,approval,now) {
 if(fourth(approval))now=tx.time(now);
 const verdict=classifyDeviceRegistration(tx,auth,request,approval,now);
 if(verdict.allowed&&fourth(approval)){
  if(!consumeFourth(tx,verdict.oneUseKey,now,fourthEnd(approval)))return false;
  const marker=tx.get('budgets',verdict.oneUseKey);tx.set('budgets',fourthBinding(approval,request.registrationId),marker);return true;
 }
 return verdict.allowed&&(verdict.oneUseKey?(fourth(approval)?consumeFourth:consumeCurrentDay)(tx,verdict.oneUseKey,now):!verdict.recoveryKey||rate(tx,verdict.recoveryKey,now,86400000,1));
}
export function oneDeviceGuard(approval) {
 // Clone once. A caller cannot widen a running private capability by mutation.
 const fixed=approval&&structuredClone(approval);
 return (tx,ownerId,r,payload,now)=>{
  const a=deviceApproval(fixed,now);
  if(!a?.target||ownerId!==a.ownerId||r.workspaceId!==a.workspaceId||r.deviceId!==a.deviceId||
    r.registrationId!==a.target.registrationId||payload.id!==a.target.eventId)return false;
  // Fixed authority marker prevents a different event/run from replenishing the
  // total budget. Approval expires within this UTC bucket before any reset.
  const total='day:'+DEVICE_TEST_ID;
  if(fourth(a)){
   const previous=tx.get('registrations',a.currentRequest.previousRegistrationId),ctx=tx.context(a.workspaceId,a.deviceId);
   if(!oldThreeSpent(tx)||!eighthGenerationSpent(tx)||tx.get('budgets',generationMarker(registrationGeneration(a)))?.count!==1||postClick(a)&&!oldFourSpent(tx)||witnessedSixth(a)&&!oldFiveSpent(tx)||tx.get('budgets',fourthBinding(a,r.registrationId))?.count!==1||
    !previous||previous.workspaceId!==a.workspaceId||previous.deviceId!==a.deviceId||previous.state!=='revoked'||previous.sealed!==null||previous.fingerprint!==null||previous.bindingFingerprint!==null||
    !current(ctx,r,now)||ctx.pushConsent!==true||ctx.consentRevision!==r.consentRevision||ctx.consentRevision===previous.consentRevision)return false;
   return consumeFourth(tx,sendMarker(a),now,fourthEnd(a));
  }
  if(a.currentRequest){
   if(!oldTwoSpent(tx)||tx.get('budgets',generationMarker(currentGeneration(a)))?.count!==1||reviewedEight(a.currentRequest)&&tx.get('budgets',generationMarker(CURRENT_REQUEST_RUN))?.count!==1)return false;
   return consumeCurrentDay(tx,currentSendMarker,now);
  }
  if(a.additionalTest){
   if(tx.get('budgets',total)?.count!==1)return false;
   const extra=total+':additional:'+ADDITIONAL_TEST_RUN;
   if(tx.get('budgets',extra))return false;
   return rate(tx,extra,now,86400000,1);
  }
  if(tx.get('budgets',total))return false;
  const binding=createHash('sha256').update(JSON.stringify([a.testId,a.runId,a.ownerId,a.workspaceId,a.deviceId,a.target.registrationId,a.target.eventId])).digest('hex');
  if(!rate(tx,total,now,86400000,1))return false;
  return rate(tx,'day:'+DEVICE_TEST_ID+':'+binding,now,86400000,1);
 };
}
