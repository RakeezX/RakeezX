/** AI: authenticated metadata-only readiness in ORIGINAL inactive function; no private operations. */
import pg from 'pg';
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {databaseConfig,assertRestrictedIdentity} from './database-transport.mjs';
import {assertPrivateDatabaseSession} from './existing-host.mjs';
import {supportedSessionPolicy} from './session-policy.mjs';
import {p256} from '@noble/curves/nist.js';
import {publicDeviceConfiguration} from './one-device-test.mjs';
import {mac,sha,readBytes,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
import {privateQuery} from './activation/private-error-boundary.mjs';
import {boundedAdmissionMaintenance,admissionSnapshot,pruneExpiredAdmission} from './expired-admission.mjs';
import {ADMISSION_PURPOSE,admissionApproval} from './admission-authority.mjs';
import {TRANSPORT_PURPOSE,TRANSPORT_PROJECT,transportWindowValid,probeTransport} from './transport-readiness.mjs';
import {TRANSPORT_WINDOW} from './transport-window.mjs';
import {validateTransportResult} from './transport-contract.mjs';
import {NATIVE_PURPOSE,NATIVE_MODE,probeNativeTransport,validateNativeResult} from './native-readiness.mjs';
let busy=0;const nonces=new Map();
export function deviceReadinessConfiguration(readEnv) {
 if(readEnv('N44_DELIVERY_ENABLED')!=='false')return {status:'disabled'};
 try {
  const a=JSON.parse(readEnv('N44_ONE_DEVICE_TEST_JSON')??'null'),c=JSON.parse(readEnv('N44_CRYPTO_JSON')??'null');
  const v=c?.vapidKeys?.find(([id])=>id===c.activeVapidKeyId)?.[1];
  const secret=Buffer.from(v?.privateKey??'','base64url');
  try {if(secret.length!==32||!p256.utils.isValidPrivateKey(secret)||Buffer.from(p256.getPublicKey(secret,false)).toString('base64url')!==v.publicKey)return {status:'disabled'};}
  finally {secret.fill(0);}
  return {...publicDeviceConfiguration(a,a?.ownerId,a??{},v.publicKey,readEnv('N44_SERVICE_SOURCE_SHA'),Date.now()),targetBound:a?.target!==null};
 }catch{return {status:'disabled'};}
}
export async function checkReadiness(readEnv,admission=null){
 const source=readEnv('N44_SERVICE_SOURCE_SHA'),profile=JSON.parse(readEnv('N44_SESSION_POLICY_JSON')??'null');
 if(!supportedSessionPolicy(profile,Date.now(),source))throw Error('n44_session_policy_readback_missing');
 const client=new pg.Client(databaseConfig(readEnv));
 let stage='connect';try{
  await client.connect();stage='reset_role';await client.query('reset role');stage='identity';const identity=await assertRestrictedIdentity(client);
  stage='set_role';await client.query('set role n44_backend');stage='source_boundary';await assertPrivateDatabaseSession(client);
  let admissionResult;
  if(admission){if(!admissionApproval(readEnv,admission.mode,admission.mode==='repair'?admission.nonce:admission.reconcileNonce))throw Error('n44_admission_capability_expired');stage='admission';let committed=false;const query=(s,v=[])=>privateQuery(client,s,v);try{await query('begin');await query("set local statement_timeout='3000ms'");await query("set local lock_timeout='1000ms'");await query('set local synchronous_commit=on');if(admission.mode==='repair'){let reservationExpiredNoncesRemoved=0;await query('select pg_advisory_xact_lock(44002,hashtext($1))',['scheduler']);let scheduler=(await query('select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2',['scheduler',129])).rows.length;if(scheduler>=128){reservationExpiredNoncesRemoved=await pruneExpiredAdmission(query,'nonce',Date.now());scheduler=(await query('select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2',['scheduler',129])).rows.length;}if(scheduler>=128)throw Error('n44_admission_active_scheduler_capacity');const marker=await query('insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values($1,$2,$3) on conflict do nothing returning nonce',[admission.nonce,'scheduler',admission.expiresAt]);if(marker.rows.length!==1)throw Error('n44_admission_replay');admissionResult={...await boundedAdmissionMaintenance(query,Date.now()),reservationExpiredNoncesRemoved,maxTotalExpiredNonceRows:300};}else admissionResult={snapshot:await admissionSnapshot(query),readOnly:true};if(!admissionApproval(readEnv,admission.mode,admission.mode==='repair'?admission.nonce:admission.reconcileNonce))throw Error('n44_admission_capability_expired');await query('commit');committed=true;}finally{if(!committed)await query('rollback').catch(()=>{});}}
  return {status:'ready',...identity,sourceBoundary:true,source,enabled:readEnv('N44_ENABLED')==='true',deliveryEnabled:readEnv('N44_DELIVERY_ENABLED')==='true',optIn:deviceReadinessConfiguration(readEnv),...(admissionResult?{admission:admissionResult}:{})};
 }catch(e){return {status:'unavailable',stage,...(e.safeReadiness??{}),code:/^(n44_[a-z_]+|[A-Z][A-Z0-9_]{2,40})$/.test(e.code??e.message)?(e.code??e.message):'n44_runtime_unavailable',source,enabled:false,deliveryEnabled:false};}
 finally{await client.end().catch(()=>{});}
}
export async function readinessEntry(request,readEnv,check=checkReadiness,transport={gate:TRANSPORT_WINDOW,probe:probeTransport,nativeProbe:probeNativeTransport}){
 if(readEnv('N44_READINESS_ENABLED')!=='true'||busy>=2)return privateResponse();
 try{
  const u=new URL(request.url),time=request.headers.get('x-n44-time'),nonce=request.headers.get('x-n44-nonce'),signature=request.headers.get('x-n44-signature'),key=readEnv('N44_INGRESS_KEY');
  if(u.origin!==readEnv('N44_AUTH_URL')||u.pathname!=='/functions/v1/n44-notifications/readiness'||u.search||request.method!=='POST'||request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding')||!/^[a-f0-9]{64}$/.test(key??'')||!/^\d{10}$/.test(time??'')||Math.abs(Date.now()/1000-Number(time))>15||!/^[a-f0-9-]{36}$/.test(nonce??'')||!/^[a-f0-9]{64}$/.test(signature??''))return privateResponse(401);
  const body=new TextDecoder().decode(await readBytes(request.body,2,AbortSignal.timeout(2000)));if(body!=='{}')return privateResponse(401);
  const transportFields=['x-n44-transport-purpose','x-n44-project','x-n44-source','x-n44-mode','x-n44-expires'];
  if(transportFields.some(k=>request.headers.has(k))){
   const source=request.headers.get('x-n44-source'),mode=request.headers.get('x-n44-mode'),expires=request.headers.get('x-n44-expires');
   const native=request.headers.get('x-n44-transport-purpose')===NATIVE_PURPOSE,expectedPurpose=native?NATIVE_PURPOSE:TRANSPORT_PURPOSE;
   const allowed=new Set([...transportFields,'x-n44-time','x-n44-nonce','x-n44-signature']);
   if([...request.headers.keys()].some(k=>k.startsWith('x-n44-')&&!allowed.has(k))||request.headers.get('x-n44-transport-purpose')!==expectedPurpose||request.headers.get('x-n44-project')!==TRANSPORT_PROJECT||mode!==(native?NATIVE_MODE:'native-and-head')||!/^[a-f0-9]{40}$/.test(source??'')||source!==readEnv('N44_SERVICE_SOURCE_SHA')||!/^\d{10}$/.test(expires??'')||Number(expires)<=Date.now()/1000||Number(expires)>Number(time)+12||!transportWindowValid(transport.gate,Date.now())||Number(expires)*1000>transport.gate.expiresAt||readEnv('N44_ONE_DEVICE_TEST_JSON')!=='null'||readEnv('N44_DELIVERY_ENABLED')!=='false')return privateResponse(401);
   const expected=await mac(Buffer.from(key,'hex'),JSON.stringify([expectedPurpose,TRANSPORT_PROJECT,source,mode,u.origin,u.pathname,time,nonce,expires,await sha(new TextEncoder().encode(body))]));
   if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return privateResponse(401);
   for(const[n,t]of nonces)if(t<Date.now()-15000)nonces.delete(n);
   if(nonces.has(nonce)||nonces.size>=100)return privateResponse(401);nonces.set(nonce,Date.now());
   busy++;try{const result=native?validateNativeResult(await transport.nativeProbe(readEnv,{expiresAt:Number(expires)*1000,signal:request.signal})):validateTransportResult(await transport.probe(readEnv,{expiresAt:Number(expires)*1000,signal:request.signal}));return Response.json(result,{status:result.status==='ready'?200:503,headers:PRIVATE_WEB_HEADERS});}finally{busy--;}
  }
  const purpose=request.headers.get('x-n44-admission-purpose'),mode=request.headers.get('x-n44-admission-mode');let admission=null;
  if(purpose!==null||mode!==null){if(purpose!==ADMISSION_PURPOSE||!(admission=admissionApproval(readEnv,mode,nonce)))return privateResponse(401);}
  const expected=await mac(Buffer.from(key,'hex'),JSON.stringify(admission?[ADMISSION_PURPOSE,mode,u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body)),admission.approvalId,admission.source]:['n44-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
  if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return privateResponse(401);
  for(const [n,t]of nonces)if(t<Date.now()-15000)nonces.delete(n);
  if(nonces.has(nonce)||nonces.size>=100)return privateResponse(401);nonces.set(nonce,Date.now());
  busy++;try{const result=await check(readEnv,admission);return Response.json(result,{status:result.status==='ready'?200:503,headers:PRIVATE_WEB_HEADERS});}finally{busy--;}
 }catch{return privateResponse();}
}
