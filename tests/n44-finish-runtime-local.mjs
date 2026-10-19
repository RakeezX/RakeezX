/** AI: actual ingress/WebRequest/backend path, injected nonpersonal ports; network denied. */
import '../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createCloudflareEntry} from '../drafts/n44-push/cloudflare-entry.mjs';
import {createWebEntry} from '../drafts/n44-push/web-entry.mjs';
import {runtimeFailure,requestFailure} from '../drafts/n44-push/runtime-failure.mjs';
import {createPostgresRepository} from '../drafts/n44-push/postgres-repository.mjs';
const origin='https://synthetic.invalid',authUrl='https://xlrubcwjqktzzunrvuns.supabase.co',now=Date.now(),source='236f68e0131ca4d2b27fc3014cb33421f90b40c1';
const key=new Uint8Array(32).fill(1),env={N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:authUrl+'/functions/v1/n44-notifications',N44_INGRESS_KEY:'01'.repeat(32)};
const profile={v:2,approvalState:'active',approvalId:'a'.repeat(64),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'b'.repeat(64),observedAt:now-1000,activatedAt:now-500};
const options={now:()=>now,authUrl,origin,apiKey:'FABRICATED_PUBLIC',fetch(){throw Error('external Auth must not run');},providerOrigins:[],crypto:{},rateKey:new Uint8Array(32).fill(2),sessionPolicy:profile,serviceSourceSha:source,ingressKey:key,schedulerKey:new Uint8Array(32).fill(3)};
function request(){const r=new Request(origin+'/api/n44/context/read',{method:'POST',headers:{origin,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.1',authorization:'Bearer N44_FABRICATED_UNAUTHORIZED_20261019'},body:JSON.stringify({workspaceId:'synthetic',deviceId:'synthetic'})});Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return r;}
function gateway(edge){return createCloudflareEntry({now:()=>now,fetch:async(url,init)=>{assert.equal(init.redirect,'manual');return edge(new Request(url,init));}});}
const checks=[];
for(const phase of ['configuration','configuration_origin','configuration_revision','configuration_policy','configuration_transport','configuration_crypto','configuration_provider','connect','identity','set_role','private_session','source','ingress','query','deadline']){
 const sensitive=new Error('FABRICATED_PRIVATE_CANARY_PASSWORD_SQL_TOKEN');Object.defineProperty(sensitive,'message',{get(){throw Error('private error inspected');}});
 const response=requestFailure(runtimeFailure(phase,sensitive));const wire=await response.json();assert.deepEqual(wire,{status:503,body:{error:'unavailable',phase}});assert.equal(response.headers.get('cache-control'),'no-store, private');
 const edge=createWebEntry({...options,acquire:async()=>{throw runtimeFailure(phase,sensitive);}}),publicResponse=await gateway(edge)(request(),env);
  assert.equal(publicResponse.status,503);const publicBody=await publicResponse.json();assert.deepEqual(publicBody,{error:'unavailable',phase},'phase '+phase+' observed '+publicBody.phase);
}
assert.deepEqual(await requestFailure(new Error('unknown private error'),'<private-value>').json(),{status:503,body:{error:'unavailable',phase:'configuration'}});
checks.push({name:'static_phase_redaction_actual_signed_entry',status:'PASS',evidence:'Finite phases only, no error message/property inspection; actual ingress/HMAC/WebRequest/backend acquire failures return public503 with sanitized enum. Unknown input maps fixed configuration.'});
const queries=[];let releases=0;
const acquire=async()=>({async query(sql){queries.push(sql);if(sql.startsWith('insert into n44_push_draft.ingress_nonces'))return {rows:[{nonce:'synthetic'}]};if(sql.startsWith('insert into n44_push_draft.ingress_rates'))return {rows:[{count:1}]};return {rows:[]};},release(){releases++;}});
const valid=createWebEntry({...options,acquire}),response=await gateway(valid)(request(),env);assert.equal(response.status,400);assert.deepEqual(await response.json(),{status:'rejected'});assert.equal(queries.filter(q=>q==='commit').length,2);assert.equal(releases,2);assert.equal(queries.some(q=>/auth\.|owner_id|lock_current_session/.test(q)),false);
checks.push({name:'typed400_full_synthetic_entry_and_durable_ack',status:'PASS',evidence:'Actual ingress/WebRequest/backend + official AuthClient rejects shape-correct nonJWT; both ingress/teacher transactions commit before public typed400; no Auth/owner/canonical query or provider request.'});
const rollback=[];const broken=createWebEntry({...options,acquire:async()=>({async query(sql){rollback.push(sql);if(sql.startsWith('insert into'))throw runtimeFailure('query',new Error('FABRICATED_PRIVATE_QUERY_VALUES'));return {rows:[]};},release(){}})});
const failed=await gateway(broken)(request(),env);assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'unavailable',phase:'query'});assert.equal(rollback.at(-1),'rollback');assert.equal(rollback.includes('commit'),false);
const denied=await valid(new Request(authUrl+'/functions/v1/n44-notifications/dispatch',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'unavailable'});
checks.push({name:'rollback_and_untrusted_deny_unchanged',status:'PASS',evidence:'Actual query failure rolls back with no commit; unsigned preflight remains401 without diagnostic stage. Existing size/HMAC/private/saturation guards retained.'});
for(const code of ['40001','40P01']){
 let acquired=0;const log=[];
 const repository=createPostgresRepository({acquire:async()=>{const attempt=acquired++;return {async query(sql){log.push(sql);if(attempt===0&&sql.startsWith('insert into n44_push_draft.owner_clock'))throw runtimeFailure('query',Object.assign(new Error('FABRICATED_PRIVATE_DRIVER_DETAIL'),{code,severity:'ERROR'}));if(sql.startsWith('select high_water_ms'))return {rows:[{high_water_ms:'0'}]};if(sql.startsWith('select floor'))return {rows:[{now_ms:String(now)}]};return {rows:[]};},release(){}};}});
 assert.equal(await repository.atomic('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',()=>42),42);assert.equal(acquired,2);assert.equal(log.filter(q=>q==='rollback').length,1);assert.equal(log.filter(q=>q==='commit').length,1);
}
let attempts=0;const uncertain=createPostgresRepository({acquire:async()=>{attempts++;return {async query(sql){if(sql.startsWith('select high_water_ms'))return {rows:[{high_water_ms:'0'}]};if(sql.startsWith('select floor'))return {rows:[{now_ms:String(now)}]};if(sql==='commit')throw runtimeFailure('query',Object.assign(new Error('FABRICATED_LOST_ACK'),{code:'ETIMEDOUT'}));return {rows:[]};},release(){}};}});
await assert.rejects(()=>uncertain.atomic('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',()=>42));assert.equal(attempts,1);
const getterError=new Error('private');Object.defineProperty(getterError,'code',{get(){throw Error('private code getter read');}});assert.equal(runtimeFailure('query',getterError).code,undefined);
checks.push({name:'definitive_abort_retry_and_uncertain_ack_no_replay',status:'PASS',evidence:'Actual repository through sanitized query errors retries40001/40P01 only once after rollback; lost COMMIT ACK is not retried or returned. Error getters/arbitrary codes are not copied; public responses remain enum-only.'});
await writeFile('tests/n44-finish-runtime.local.json',JSON.stringify({taskId:'continuous-n44-cloudflare-redirect-transport-fix-20261019',runId:'b7a2a2e4-c4bc-4cce-ac9d-e02740bc494f',recordedAt:new Date().toISOString(),checks,scope:'Injected ports only; no hosted readiness or actual private SQL proof',networkCalls:0},null,2)+'\n');console.log('N44 actual synthetic runtime '+checks.length+' checks PASS.');
