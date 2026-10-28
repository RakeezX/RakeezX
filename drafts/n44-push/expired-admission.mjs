/** AI: existing typed protocol-bookkeeping operations only. No active counter reset. */
export const NONCE_QUERY='select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2';
export const RATE_QUERY='select key from n44_push_draft.ingress_rates where kind=$1 limit 2049';
export const CLOCK_QUERY='select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms';
export const NONCE_PURGE='delete from n44_push_draft.ingress_nonces where nonce in(select nonce from n44_push_draft.ingress_nonces where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)';
export const RATE_PURGE='delete from n44_push_draft.ingress_rates where key in(select key from n44_push_draft.ingress_rates where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)';
export async function pruneExpiredAdmission(query,kind,now){
 if(!['nonce','rate'].includes(kind)||!Number.isSafeInteger(now))throw Error('n44_admission_expiry_clock');
 const r=await query(CLOCK_QUERY),databaseNow=Number(r.rows?.[0]?.now_ms);if(r.rows.length!==1||!Number.isSafeInteger(databaseNow)||databaseNow<=0)throw Error('n44_admission_expiry_clock');
 const result=await query(kind==='nonce'?NONCE_PURGE:RATE_PURGE,[Math.min(now,databaseNow)]);if(!Number.isSafeInteger(result.rowCount)||result.rowCount<0||result.rowCount>100)throw Error('n44_admission_expiry_result');return result.rowCount;
}
export async function admissionSnapshot(query){
 const nonceCounts={};for(const [scope,limit]of [['teacher',4097],['scheduler',129]])nonceCounts[scope]=(await query(NONCE_QUERY,[scope,limit])).rows.length;
 const rateKeyCounts={};for(const kind of ['global','peer','owner','scheduler'])rateKeyCounts[kind]=(await query(RATE_QUERY,[kind])).rows.length;
 return {nonceCounts,rateKeyCounts};
}
export async function boundedAdmissionMaintenance(query,now){
 const before=await admissionSnapshot(query);let expiredNoncesRemoved=0,expiredRateKeysRemoved=0;
 if(before.nonceCounts.teacher>=4096||before.nonceCounts.scheduler>=128){expiredNoncesRemoved=await pruneExpiredAdmission(query,'nonce',now);if(expiredNoncesRemoved===100){const middle=await admissionSnapshot(query);if(middle.nonceCounts.teacher>=4096||middle.nonceCounts.scheduler>=128)expiredNoncesRemoved+=await pruneExpiredAdmission(query,'nonce',now);}}
 if(Object.values(before.rateKeyCounts).some(n=>n>=2048))expiredRateKeysRemoved=await pruneExpiredAdmission(query,'rate',now);
 const after=await admissionSnapshot(query);return {before,expiredNoncesRemoved,expiredRateKeysRemoved,after,teacherNonceCapacityRestored:before.nonceCounts.teacher>=4096&&after.nonceCounts.teacher<4096&&expiredNoncesRemoved>0,rateKeyCapacityRestored:['global','peer','owner','scheduler'].some(k=>before.rateKeyCounts[k]>=2048&&after.rateKeyCounts[k]<2048)&&expiredRateKeysRemoved>0,expiryCutoff:'strictly before min(actual database clock, actual application clock)',maxExpiredNonceRows:200,maxExpiredRateRows:100,activeLimitsUnchanged:true};
}
