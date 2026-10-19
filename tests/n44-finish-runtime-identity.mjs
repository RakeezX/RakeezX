/** AI: targeted safe identity projection and failclosed guard regression. No network. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {assertRestrictedIdentity} from '../drafts/n44-push/database-transport.mjs';
import {runtimeFailure,requestFailure,identityProjection,identityQueryFailure} from '../drafts/n44-push/runtime-failure.mjs';
const checks=[];
const keys=['loginExact','roleExact','upstreamSsl','clientTlsAuthorized'];
for(const failed of [...keys,'missing_row']){
 let observed={queryCompleted:false,returnedOneRow:false,targetKind:'session'};
 const row=failed==='missing_row'?undefined:{login:failed==='loginExact'?'PRIVATE_USER_CANARY':'n44_service_login',role:failed==='roleExact'?'PRIVATE_ROLE_CANARY':'n44_service_login',ssl:failed!=='upstreamSsl'};
 const client={query:async()=>({rows:row?[row]:[]}),connection:{stream:{authorized:failed!=='clientTlsAuthorized'}}};
 let error;try{await assertRestrictedIdentity(client,v=>observed={...observed,...v});}catch(e){error=e;}
 assert.ok(error);const wire=await requestFailure(runtimeFailure('identity',error,observed)).json();
 assert.equal(wire.status,503);assert.equal(wire.body.identity.queryCompleted,true);assert.equal(wire.body.identity.returnedOneRow,!!row);
 if(failed!=='missing_row')for(const k of keys)assert.equal(wire.body.identity[k],k!==failed);
 assert.equal(JSON.stringify(wire).includes('PRIVATE_'),false);
}
checks.push({name:'identity_predicate_negative_projection',status:'PASS',evidence:'Actual restricted guard denies each false predicate and missing row; only boolean results/query completion and validated target enum survive.'});
const raw=new Error('PRIVATE_PASSWORD_URL_SQL_CANARY');raw.safeReadiness={loginExact:true,roleExact:'true',password:'PRIVATE_CANARY'};
Object.defineProperty(raw.safeReadiness,'upstreamSsl',{get(){throw Error('getter must not execute');}});
Object.defineProperty(raw,'stack',{get(){throw Error('stack must not execute');}});
const projected=await requestFailure(runtimeFailure('identity',raw,{queryCompleted:false,targetKind:'private-host',queryFailure:'private-error'})).json();
assert.deepEqual(projected.body.identity,{loginExact:true,queryCompleted:false});
assert.deepEqual(identityProjection({clientTlsAuthorized:null,roleExact:1}),{});
assert.equal(identityQueryFailure(Error('Query read timeout')),'timeout');
assert.equal(identityQueryFailure(Object.assign(Error('PRIVATE'),{code:'57014'})),'query_cancelled');
assert.equal(identityQueryFailure(Error('PRIVATE')),'pg_or_driver_failure');
const getter=new Error();Object.defineProperty(getter,'message',{get(){throw Error('message getter must not execute');}});
assert.equal(identityQueryFailure(getter),'pg_or_driver_failure');
let observed=false;await assert.rejects(()=>assertRestrictedIdentity({query:async()=>{throw raw;}},()=>{observed=true;}));assert.equal(observed,false);
checks.push({name:'identity_query_classification_and_redaction',status:'PASS',evidence:'Query failure distinguished from completed query; only exact known timeout/cancel conditions classified. Distinctive sensitive values, getters, unknown/string predicates and arbitrary target/error enums excluded.'});
const good=await assertRestrictedIdentity({query:async()=>({rows:[{login:'n44_service_login',role:'n44_backend',ssl:true}]}),connection:{stream:{authorized:true}}});assert.ok(Object.values(good).every(v=>v===true));
checks.push({name:'identity_positive_guard_preserved',status:'PASS',evidence:'Only actual all-true restricted identity/TLS flags pass. No assertion removed or authorized flag synthesized.'});
await writeFile('tests/n44-finish-runtime.identity-local.json',JSON.stringify({aiAuthored:true,runId:'6ab9a796-daf6-4d0b-999e-9abfc756f430',recordedAt:new Date().toISOString(),checks,networkCalls:0},null,2)+'\n');console.log('Identity targeted3 checks PASS');
