/** AI: default-disabled, fixed old-target capability. No caller-selected IDs/SQL. */
import {createHash} from 'node:crypto';
import {record,uuid,id} from '../shared.mjs';
import {exactOperatorCleanup} from './exact-operator-cleanup.mjs';
export const DISPOSAL='n44-exact-old-disposal-v1',DISPOSITION='n44-exact-old-disposition-v1';
export const DISPOSAL_END=Date.parse('2026-10-24T01:36:37.207Z');
const scopeDigest='feb87890d4966dcf23b415cb0512855647f628e539b65c90e829882453e955e4';
const registrationDigest='3ea8ae0c36fc364a7e9dbc9be5f3f364dfa04d0879d8fc29f4ba1b9f1d713fdd';
const hash=v=>createHash('sha256').update(v).digest('hex');
export function disposalApproval(v,source,now) {
 if(!record(v,['purpose','approvalId','source','ownerId','workspaceId','deviceId','registrationId','nonce','expiresAt','consentRevision'])||
   v.purpose!==DISPOSAL||!uuid(v.approvalId)||!uuid(v.nonce)||!uuid(v.ownerId)||!uuid(v.registrationId)||
   ![v.workspaceId,v.deviceId,v.consentRevision].every(id)||!/^([a-f0-9]{40})$/.test(source??'')||v.source!==source||
   v.expiresAt!==DISPOSAL_END||now<Date.parse('2026-10-23T23:36:37.207Z')||now>=v.expiresAt||
   hash(JSON.stringify({ownerId:v.ownerId,workspaceId:v.workspaceId,deviceId:v.deviceId}))!==scopeDigest||hash(v.registrationId)!==registrationDigest)return null;
 return Object.freeze(structuredClone(v));
}
export function disposalRequest(a,e,nonce) {
 return !!a&&record(e,['operation','cursor','limit'])&&[DISPOSAL,DISPOSITION].includes(e.operation)&&e.cursor===a.approvalId&&e.limit===1&&
   (e.operation!==DISPOSAL||nonce===a.nonce);
}
export const disposalPurpose=(operation,approvalId)=>operation+':'+approvalId;
export function disposeExactHosted(tx,a,{inspect=false}={}) {
 if(!disposalApproval(a,a.source,tx.time(0)))throw Error('n44_disposal_database_expiry');
 return exactOperatorCleanup(tx,{ownerId:a.ownerId,workspaceId:a.workspaceId,deviceId:a.deviceId,registrationId:a.registrationId,newConsentRevision:a.consentRevision},{inspect});
}
