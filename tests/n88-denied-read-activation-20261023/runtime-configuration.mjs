/** AI: affected exact-runtime/opaque-transition guards, fabricated digests only. */
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {fixedRuntimeKeys,originalRecoveryVersion,exactRuntimeKeys,n44Keys,opaqueUnreadKeys,qualifyRuntimeConfiguration,requireWholeTransitionEqual} from '../../drafts/n88-student-portal/activation/denied-read-20261023/runtime-configuration.mjs';
import {hash,priorSource,successorSource} from '../../drafts/n88-student-portal/activation/denied-read-20261023/transition-guards.mjs';
const expected=exactRuntimeKeys(originalRecoveryVersion).map(name=>({name,digest:hash(name)}));for(const n of ['N88_RECOVERY_ACTIVE_VERSION','N88_RECOVERY_VERSIONS'])expected.find(r=>r.name===n).digest=hash(originalRecoveryVersion);expected.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').digest=hash(priorSource);
const foreign=n44Keys.map(name=>({name,digest:hash('foreign-'+name)})),current=[...expected,...foreign,...opaqueUnreadKeys.map(name=>({name,digest:hash('opaque-'+name)}))];
const proof={status:'PASS',priorSource,successorSource,completeIndirectReview:true,fixedRuntimeKeys:[...fixedRuntimeKeys].sort(),dynamicRecoveryPrefix:'N88_RECOVERY_KEY_',unknownDependencies:0};
const qualify=(patch={})=>qualifyRuntimeConfiguration({current,expectedRuntime:expected,n44ExpectedMap:foreign,dependencyProof:proof,...patch});
assert.equal(qualify().opaqueHistoricalValuesVerified,false);
const withChange=(name,digest)=>current.map(r=>r.name===name?{name,digest}:r);
for(const name of exactRuntimeKeys(originalRecoveryVersion))assert.throws(()=>qualify({current:withChange(name,hash('changed'))}));
assert.throws(()=>qualify({expectedRuntime:expected.slice(1)}));assert.throws(()=>qualify({current:[...current,{name:'N88_RECOVERY_KEY_injected',digest:hash('injected')}]}));assert.throws(()=>exactRuntimeKeys('injected'));
assert.throws(()=>qualify({dependencyProof:{...proof,unknownDependencies:1}}));assert.throws(()=>qualify({dependencyProof:{...proof,fixedRuntimeKeys:[]}}));assert.throws(()=>qualify({current:[...current,{name:'PGOPTIONS',digest:hash('injected')}]}));
assert.throws(()=>qualify({current:withChange('N44_SESSION_POLICY_JSON',hash('stale-policy'))}));
const next=withChange('N88_SERVICE_SOURCE_SHA',hash(successorSource));assert.equal(requireWholeTransitionEqual(current,next,successorSource),true);
for(const name of [...opaqueUnreadKeys,...n44Keys,...exactRuntimeKeys(originalRecoveryVersion).filter(n=>n!=='N88_SERVICE_SOURCE_SHA')])assert.throws(()=>requireWholeTransitionEqual(current,next.map(r=>r.name===name?{name,digest:hash('concurrent')}:r),successorSource));
assert.equal(qualify({current:withChange('SUPABASE_JWKS',hash('opaque-only-observed'))}).status,'PASS'); // no historical claim
writeFileSync('tests/n88-denied-read-activation-20261023/runtime-configuration.json',JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,providerOperations:0,checks:['every omitted/changed consumed key denied','exact recovery versions and unexpected dependency denied','exact whole keyset rejects PG/new keys','stale N44 expected policy denied','every non-pin entry including opaque entries must remain unchanged across operation','opaque unread values are observation only with no historical verification claim'],historicWholeAggregate:'NOT_PROVEN'},null,2)+'\n');console.log('PASS: exact runtime expectations, full classification, stale policy and every-entry concurrency guards.');
