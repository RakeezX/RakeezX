/** AI: exact operator disposal, not an authenticated-user action or HTTP API.
 * Caller proves immutable custody binding. Repository supplies owner lock/DB time.
 * Only existing typed repository operations; no SQL, sender or provider capability.
 */
import {id,uuid,record} from '../shared.mjs';
import {createHash} from 'node:crypto';
const deny=()=>{throw Error('n44_operator_cleanup_binding');};
export function assertImmutableCleanupBinding({approval,recovery,marker,receipt,failedRegistrationId}) {
  if(!approval||!recovery||!marker||!receipt||marker.consumed!==true||recovery.consumed!==true||recovery.registeredAck!==true||
    !uuid(recovery.registrationId)||recovery.registrationId===failedRegistrationId||receipt.registeredAck!==true||receipt.providerSendAttempts!==0||
    receipt.runId!==recovery.executionRun||receipt.source!==recovery.source||marker.executionRun!==recovery.executionRun||marker.source!==recovery.source||
    marker.approvalRun!==approval.runId||!['ownerId','workspaceId','deviceId'].every(k=>marker[k]===approval[k])||
    receipt.registrationIdentityDigest!==createHash('sha256').update(recovery.registrationId).digest('hex'))deny();
}
export function exactOperatorCleanup(tx,target,{inspect=false}={}) {
  if(!record(target,['ownerId','workspaceId','deviceId','registrationId','newConsentRevision'])||
    !uuid(target.ownerId)||!uuid(target.registrationId)||![target.workspaceId,target.deviceId,target.newConsentRevision].every(id))deny();
  const now=tx.time(0),r=tx.get('registrations',target.registrationId),ctx=tx.context(target.workspaceId,target.deviceId);
  const rows=tx.rows('registrations');
  if(rows.some(x=>x.registrationId!==target.registrationId&&x.workspaceId===target.workspaceId&&x.deviceId===target.deviceId&&x.state==='active'))deny();
  if(r&&(r.workspaceId!==target.workspaceId||r.deviceId!==target.deviceId))deny();
  if(!r)return {status:'absent',complete:ctx?.pushConsent===false,registrationState:'absent',contextDisposition:ctx?ctx.pushConsent?'consent_true_not_changed':'consent_false':'absent',rowWrites:0,databaseTime:now};
  if(!ctx)return {status:'context_absent',complete:false,registrationState:r.state,contextDisposition:'absent',rowWrites:0,databaseTime:now};
  if(ctx.sessionId!==r.sessionId||ctx.sessionRevision!==r.sessionRevision||r.state==='active'&&ctx.consentRevision!==r.consentRevision)deny();
  const jobs=tx.rows('deliveries').filter(j=>j.registrationId===r.registrationId);
  if(jobs.some(j=>j.workspaceId!==target.workspaceId||j.deviceId!==target.deviceId))deny();
  const pending=jobs.filter(j=>!['sent','uncertain','dead','suppressed'].includes(j.state));
  const registrationChange=r.state==='active',consentChange=ctx.pushConsent===true;
  if(inspect)return {status:registrationChange||consentChange||pending.length?'needs_cleanup':'already_disposed',complete:!registrationChange&&!consentChange&&!pending.length,registrationState:r.state,contextDisposition:consentChange?'consent_true':'consent_false',rowWrites:0,databaseTime:now};
  let rowWrites=0;
  if(registrationChange){tx.releaseEndpoint(r.fingerprint,r.registrationId);tx.set('registrations',r.registrationId,{...r,state:'revoked',sealed:null,fingerprint:null,bindingFingerprint:null});rowWrites++;}
  for(const job of pending){tx.set('deliveries',job.key,{...job,state:job.state==='sending'?'uncertain':'suppressed'});rowWrites++;}
  if(consentChange){tx.set('contexts',JSON.stringify([target.workspaceId,target.deviceId]),{...ctx,pushConsent:false,consentRevision:target.newConsentRevision});rowWrites++;}
  return {status:rowWrites?'disposed':'already_disposed',complete:true,registrationState:registrationChange?'revoked':r.state,contextDisposition:'consent_false',rowWrites,registrationChanges:Number(registrationChange),consentChanges:Number(consentChange),deliveryChanges:pending.length,databaseTime:now};
}
