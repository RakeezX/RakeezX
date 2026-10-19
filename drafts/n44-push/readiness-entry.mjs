/** AI: authenticated metadata-only readiness in ORIGINAL inactive function; no private operations. */
import pg from 'pg';
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {databaseConfig,assertRestrictedIdentity} from './database-transport.mjs';
import {assertPrivateDatabaseSession} from './existing-host.mjs';
import {supportedSessionPolicy} from './session-policy.mjs';
import {mac,sha,readBytes,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
let busy=0;const nonces=new Map();
export async function checkReadiness(readEnv){
 const source=readEnv('N44_SERVICE_SOURCE_SHA'),profile=JSON.parse(readEnv('N44_SESSION_POLICY_JSON')??'null');
 if(!supportedSessionPolicy(profile,Date.now(),source))throw Error('n44_session_policy_readback_missing');
 const client=new pg.Client(databaseConfig(readEnv));
 let stage='connect';try{
  await client.connect();stage='identity';const identity=await assertRestrictedIdentity(client);
  stage='set_role';await client.query('set role n44_backend');stage='source_boundary';await assertPrivateDatabaseSession(client);
  return {status:'ready',...identity,sourceBoundary:true,source,enabled:readEnv('N44_ENABLED')==='true',deliveryEnabled:readEnv('N44_DELIVERY_ENABLED')==='true'};
 }catch(e){return {status:'unavailable',stage,...(e.safeReadiness??{}),code:/^(n44_[a-z_]+|[A-Z][A-Z0-9_]{2,40})$/.test(e.code??e.message)?(e.code??e.message):'n44_runtime_unavailable',source,enabled:false,deliveryEnabled:false};}
 finally{await client.end().catch(()=>{});}
}
export async function readinessEntry(request,readEnv,check=checkReadiness){
 if(readEnv('N44_READINESS_ENABLED')!=='true'||busy>=2)return privateResponse();
 try{
  const u=new URL(request.url),time=request.headers.get('x-n44-time'),nonce=request.headers.get('x-n44-nonce'),signature=request.headers.get('x-n44-signature'),key=readEnv('N44_INGRESS_KEY');
  if(u.origin!==readEnv('N44_AUTH_URL')||u.pathname!=='/functions/v1/n44-notifications/readiness'||u.search||request.method!=='POST'||request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding')||!/^[a-f0-9]{64}$/.test(key??'')||!/^\d{10}$/.test(time??'')||Math.abs(Date.now()/1000-Number(time))>15||!/^[a-f0-9-]{36}$/.test(nonce??'')||!/^[a-f0-9]{64}$/.test(signature??''))return privateResponse(401);
  const body=new TextDecoder().decode(await readBytes(request.body,2,AbortSignal.timeout(2000)));if(body!=='{}')return privateResponse(401);
  const expected=await mac(Buffer.from(key,'hex'),JSON.stringify(['n44-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
  if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return privateResponse(401);
  for(const [n,t]of nonces)if(t<Date.now()-15000)nonces.delete(n);
  if(nonces.has(nonce)||nonces.size>=100)return privateResponse(401);nonces.set(nonce,Date.now());
  busy++;try{const result=await check(readEnv);return Response.json(result,{status:result.status==='ready'?200:503,headers:PRIVATE_WEB_HEADERS});}finally{busy--;}
 }catch{return privateResponse();}
}
