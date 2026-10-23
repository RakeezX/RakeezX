/** AI: exact runtime dependency expectations, independent N44 map, whole-transition equality. */
import {canonical,hash,baselineKeysetDigest,priorSource,successorSource} from './transition-guards.mjs';
export const fixedRuntimeKeys=['N88_AUTH_API_KEY','N88_AUTH_URL','N88_DATABASE_CA_CERT','N88_DATABASE_URL','N88_ENABLED','N88_HMAC_KEY','N88_INGRESS_KEY','N88_NUMERIC_KEY','N88_PILOT_BINDING','N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED','N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256','N88_PUBLIC_ORIGIN','N88_READINESS_ENABLED','N88_RECOVERY_ACTIVE_VERSION','N88_RECOVERY_VERSIONS','N88_RESERVATION_KEY','N88_ROLLOUT_MODE','N88_SERVICE_REVISION','N88_SERVICE_SOURCE_SHA'];
export const originalRecoveryVersion='n88_1792356057764';
export const opaqueUnreadKeys=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_EMAIL_API_TOKEN','SUPABASE_ANON_KEY','SUPABASE_DB_URL','SUPABASE_JWKS','SUPABASE_PUBLISHABLE_KEYS','SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL','SUPPORT_NOTIFICATION_SCHEDULER_SECRET'];
export const n44Keys=['N44_AUTH_API_KEY','N44_AUTH_URL','N44_CRYPTO_JSON','N44_DATABASE_CA_CERT','N44_DATABASE_URL','N44_DELIVERY_ENABLED','N44_ENABLED','N44_INGRESS_KEY','N44_ONE_DEVICE_TEST_JSON','N44_PROVIDER_ORIGINS_JSON','N44_PUBLIC_ORIGIN','N44_RATE_KEY','N44_READINESS_ENABLED','N44_SCHEDULER_KEY','N44_SERVICE_REVISION','N44_SERVICE_SOURCE_SHA','N44_SESSION_POLICY_JSON'];
export const dependencyAbsentKeys=['NODE_PG_FORCE_NATIVE','PGBINARY','PGOPTIONS','PGSSLNEGOTIATION','PGCLIENT_ENCODING','PGREPLICATION'];
const fail=c=>{throw Error('n88_runtime_configuration_'+c);};
export function exactRuntimeKeys(version){if(version!==originalRecoveryVersion)fail('recovery_version');return [...fixedRuntimeKeys,'N88_RECOVERY_KEY_'+version].sort((a,b)=>a.localeCompare(b));}
export function qualifyRuntimeConfiguration({current,expectedRuntime,n44ExpectedMap,dependencyProof,expectedPin=priorSource}){
 const rows=canonical(current),expected=canonical(expectedRuntime),foreign=canonical(n44ExpectedMap);
 if(![priorSource,successorSource].includes(expectedPin))fail('pin_identity');
 const names=exactRuntimeKeys(originalRecoveryVersion),allNames=[...names,...n44Keys,...opaqueUnreadKeys].sort((a,b)=>a.localeCompare(b));
 if(hash(JSON.stringify(rows.map(r=>r.name)))!==baselineKeysetDigest||JSON.stringify(rows.map(r=>r.name))!==JSON.stringify(allNames))fail('whole_keyset');
 if(JSON.stringify(expected.map(r=>r.name))!==JSON.stringify(names)||JSON.stringify(foreign.map(r=>r.name))!==JSON.stringify([...n44Keys].sort((a,b)=>a.localeCompare(b))))fail('expected_keyset');
 if(dependencyProof?.status!=='PASS'||dependencyProof.priorSource!==priorSource||dependencyProof.successorSource!==successorSource||dependencyProof.completeIndirectReview!==true||JSON.stringify(dependencyProof.fixedRuntimeKeys)!==JSON.stringify([...fixedRuntimeKeys].sort())||dependencyProof.dynamicRecoveryPrefix!=='N88_RECOVERY_KEY_'||dependencyProof.unknownDependencies!==0)fail('dependency_proof');
 if(expected.find(r=>r.name==='N88_RECOVERY_ACTIVE_VERSION').digest!==hash(originalRecoveryVersion)||expected.find(r=>r.name==='N88_RECOVERY_VERSIONS').digest!==hash(originalRecoveryVersion))fail('recovery_injection');
 for(const r of [...expected,...foreign]){const want=r.name==='N88_SERVICE_SOURCE_SHA'?hash(expectedPin):r.digest;if(rows.find(v=>v.name===r.name)?.digest!==want)fail('expected_value_'+r.name.toLowerCase());}
 const nonPin=rows.filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA');
 return {status:'PASS',pinDigest:hash(expectedPin),currentNonPinDigest:hash(JSON.stringify(nonPin)),keysetDigest:baselineKeysetDigest,runtimeExpectedKeys:names,n44ExpectedKeys:n44Keys,opaqueUnreadKeys,historicalWholeAggregate:'NOT_PROVEN; preserved separately',opaqueHistoricalValuesVerified:false,unknownRuntimeDriftAccepted:false};
}
export function requireWholeTransitionEqual(before,after,expectedPin){
 const a=canonical(before),b=canonical(after);
 if(JSON.stringify(a.map(r=>r.name))!==JSON.stringify(b.map(r=>r.name))||hash(JSON.stringify(b.map(r=>r.name)))!==baselineKeysetDigest)fail('transition_keyset');
 for(const r of b){if(r.digest!==(r.name==='N88_SERVICE_SOURCE_SHA'?hash(expectedPin):a.find(v=>v.name===r.name).digest))fail('transition_changed_'+r.name.toLowerCase());}
 return true;
}
