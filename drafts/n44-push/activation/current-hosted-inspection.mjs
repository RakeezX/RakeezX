/** AI: distinct default-disabled current-target READ ONLY capability. No mutator. */
import {createHash} from 'node:crypto';
import {record,uuid,id} from '../shared.mjs';
import {exactOperatorCleanup} from './exact-operator-cleanup.mjs';
import {mac,sha} from '../web-protocol.mjs';
export const CURRENT_INSPECTION='n44-current-registration-inspection-v1';
const hash=v=>createHash('sha256').update(v).digest('hex');
export const inspectionPreferences=p=>hash(JSON.stringify([p.lesson,p.due,p.lessonMinutes,[...p.dueDays].sort(),p.timezone,p.quiet===null?null:[p.quiet.start,p.quiet.end]]));
export function inspectionApproval(v,source,now){
 if(!record(v,['purpose','approvalId','source','ownerId','workspaceId','deviceId','registrationId','nonce','approvedAt','expiresAt','preferencesSha256'])||
 v.purpose!==CURRENT_INSPECTION||![v.approvalId,v.ownerId,v.registrationId,v.nonce].every(uuid)||![v.workspaceId,v.deviceId].every(id)||
 !/^[a-f0-9]{40}$/.test(source??'')||v.source!==source||!/^[a-f0-9]{64}$/.test(v.preferencesSha256??'')||
 ![v.approvedAt,v.expiresAt,now].every(Number.isSafeInteger)||v.approvedAt>now||now>=v.expiresAt||v.expiresAt<=v.approvedAt||v.expiresAt-v.approvedAt>900000)return null;
 return Object.freeze(structuredClone(v));
}
export const inspectionRequest=(a,e,nonce)=>!!a&&record(e,['operation','cursor','limit'])&&e.operation===CURRENT_INSPECTION&&e.cursor===a.approvalId&&e.limit===1&&nonce===a.nonce;
export const inspectionPurpose=a=>CURRENT_INSPECTION+':'+hash(JSON.stringify([a.approvalId,a.source,a.ownerId,a.workspaceId,a.deviceId,a.registrationId,a.nonce,a.approvedAt,a.expiresAt,a.preferencesSha256]));
export function inspectCurrent(tx,a){
 if(!inspectionApproval(a,a.source,tx.time(0)))throw Error('n44_current_inspection_expired');
 const ctx=tx.context(a.workspaceId,a.deviceId),registration=tx.get('registrations',a.registrationId);
 // Scope comes exclusively from protected configuration, never the request body.
 if(!ctx||registration&&(registration.workspaceId!==a.workspaceId||registration.deviceId!==a.deviceId))throw Error('n44_current_inspection_target');
 const r=exactOperatorCleanup(tx,{ownerId:a.ownerId,workspaceId:a.workspaceId,deviceId:a.deviceId,registrationId:a.registrationId,newConsentRevision:'inspection-only'},{inspect:true});
 const preferencesMatch=inspectionPreferences(ctx.preferences)===a.preferencesSha256;
 return {status:'inspection',complete:r.complete&&preferencesMatch,registration:['revoked','absent'].includes(r.registrationState)?r.registrationState:'other',consentFalse:ctx.pushConsent===false,pendingJobsEmpty:!tx.rows('deliveries').some(j=>j.registrationId===a.registrationId&&!['sent','uncertain','dead','suppressed'].includes(j.state)),preferencesMatch};
}
/** Future protected custodian only. Exporting never invokes any network operation. */
export async function signedCurrentInspection(url,key,a,now=Date.now){
 if(!inspectionApproval(a,a.source,now()))throw Error('n44_current_inspection_approval');
 const u=new URL(url);if(u.protocol!=='https:'||u.origin!=='https://xlrubcwjqktzzunrvuns.supabase.co'||u.pathname!=='/functions/v1/n44-notifications/schedule'||u.search||u.hash||u.username||u.password)throw Error('n44_current_inspection_origin');
 const bytes=new TextEncoder().encode(JSON.stringify({operation:CURRENT_INSPECTION,cursor:a.approvalId,limit:1})),time=String(Math.floor(now()/1000)),source=await mac(key,inspectionPurpose(a));
 const signature=await mac(key,JSON.stringify(['n44-scheduler-v1',u.origin,u.pathname,await sha(bytes),time,a.nonce,source]));
 return new Request(url,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':a.nonce,'x-n44-source':source,'x-n44-signature':signature},body:bytes});
}
