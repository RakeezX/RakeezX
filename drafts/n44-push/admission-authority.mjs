/** AI: fixed original-custodian metadata/expired-maintenance capability, OFF by default. */
import {record,uuid} from './shared.mjs';
export const ADMISSION_PURPOSE='n44-admission-v1';
export const ADMISSION_RUN='045a8fe7-37cf-4a83-90e5-eca302f0f53a';
export const ADMISSION_END=Date.parse('2026-10-24T01:36:37.207Z');
export function admissionApproval(readEnv,mode,nonce,now=Date.now()){
 try{const a=JSON.parse(readEnv('N44_ONE_DEVICE_TEST_JSON')??'null');if(!record(a,['purpose','runId','approvalId','source','nonce','reconcileNonce','expiresAt','maintenance'])||a.purpose!==ADMISSION_PURPOSE||a.runId!==ADMISSION_RUN||!uuid(a.approvalId)||!uuid(a.nonce)||!uuid(a.reconcileNonce)||a.nonce===a.reconcileNonce||a.source!==readEnv('N44_SERVICE_SOURCE_SHA')||!/^[a-f0-9]{40}$/.test(a.source)||a.expiresAt!==ADMISSION_END||a.maintenance!==true||readEnv('N44_DELIVERY_ENABLED')!=='false'||now<Date.parse('2026-10-23T23:36:37.207Z')||now>=ADMISSION_END||!['repair','read'].includes(mode)||nonce!==(mode==='repair'?a.nonce:a.reconcileNonce))return null;return Object.freeze({...a,mode});}catch{return null;}
}
