/** AI: trusted server-only approval. Never populate from an HTTP body or browser. */
import {createHash} from 'node:crypto';
import {id,uuid,rate,record} from './shared.mjs';
export const DEVICE_TEST_ID='n44-one-device-20261019';
export const DEVICE_CAPABILITY='n44-single-device-20261019-v1';
export const DEVICE_TEST_END=Date.parse('2026-10-20T00:00:00Z');
const scopeKeys=['testId','runId','ownerId','workspaceId','deviceId','expiresAt','target'];
export function deviceApproval(value,now) {
 if(!record(value,scopeKeys)||value.testId!==DEVICE_TEST_ID||!uuid(value.runId)||
   ![value.ownerId,value.workspaceId,value.deviceId].every(id)||!Number.isSafeInteger(value.expiresAt)||
   value.expiresAt<=now||value.expiresAt>now+86400000||value.expiresAt>DEVICE_TEST_END||now>=DEVICE_TEST_END||
   Math.floor((value.expiresAt-1)/86400000)!==Math.floor(now/86400000))return null;
 if(value.target!==null&&(!record(value.target,['registrationId','eventId'])||!uuid(value.target.registrationId)||
   typeof value.target.eventId!=='string'||!/^[a-zA-Z0-9_:%.-]{1,240}$/.test(value.target.eventId)))return null;
 return Object.freeze(structuredClone(value));
}
export function publicDeviceConfiguration(approval,ownerId,scope,publicKey,source,now) {
 const a=deviceApproval(approval,now);
 if(!a||ownerId!==a.ownerId||scope.workspaceId!==a.workspaceId||scope.deviceId!==a.deviceId||
   !/^B[A-Za-z0-9_-]{86}$/.test(publicKey??'')||!(/^[a-f0-9]{40}$/).test(source??''))return {status:'disabled'};
 return {status:'ready',protocol:'n44-browser-v2',capability:DEVICE_CAPABILITY,serviceRevision:'n44-browser-service-v2',
   serviceSourceSha:source,publicKey,expiresAt:a.expiresAt,deliveryEnabled:false,schedulerEnabled:false};
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
  if(tx.get('budgets',total))return false;
  const binding=createHash('sha256').update(JSON.stringify([a.testId,a.runId,a.ownerId,a.workspaceId,a.deviceId,a.target.registrationId,a.target.eventId])).digest('hex');
  if(!rate(tx,total,now,86400000,1))return false;
  return rate(tx,'day:'+DEVICE_TEST_ID+':'+binding,now,86400000,1);
 };
}
