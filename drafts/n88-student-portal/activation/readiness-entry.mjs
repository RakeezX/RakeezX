/** AI: signed, metadata-only readiness in the original inactive production function. */
import pg from 'pg';
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {databaseConfig,assertRestrictedTransport} from './database-transport.mjs';
import {assertPrivateDatabaseSession} from '../existing-host.mjs';
import {mac,sha,readBytes,privateResponse,PRIVATE_WEB_HEADERS} from '../web-protocol.mjs';
let busy=0;const nonces=new Map();
export async function checkReadiness(readEnv){
 const source=readEnv('N88_SERVICE_SOURCE_SHA');const client=new pg.Client(databaseConfig(readEnv));let stage='connect',identity={};
 try{
  await client.connect();stage='identity';identity=await assertRestrictedTransport(client);
  stage='source_boundary';await assertPrivateDatabaseSession(client);
  return {status:'ready',...identity,sourceBoundary:true,source,enabled:readEnv('N88_ENABLED')==='true'};
 }catch(e){return {status:'unavailable',stage,...identity,...(e.safeReadiness??{}),code:/^(n88_[a-z_]+|[A-Z0-9]{5})$/.test(e.code??e.message)?(e.code??e.message):'n88_runtime_unavailable',source,enabled:false};}
 finally{await client.end().catch(()=>{});}
}
export async function readinessEntry(request,readEnv,check=checkReadiness){
 if(readEnv('N88_READINESS_ENABLED')!=='true'||busy>=2)return privateResponse();
 try{
  const u=new URL(request.url),time=request.headers.get('x-n88-time'),nonce=request.headers.get('x-n88-nonce'),sig=request.headers.get('x-n88-signature'),key=readEnv('N88_HMAC_KEY');
  if(u.origin!==readEnv('N88_AUTH_URL')||u.pathname!=='/functions/v1/n88-student-portal/readiness'||u.search||request.method!=='POST'||request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding')||!/^[a-f0-9]{64}$/.test(key??'')||!/^\d{10}$/.test(time??'')||Math.abs(Date.now()/1000-Number(time))>15||!/^[a-f0-9-]{36}$/.test(nonce??'')||!/^[a-f0-9]{64}$/.test(sig??''))return privateResponse(401);
  const body=new TextDecoder().decode(await readBytes(request.body,2,AbortSignal.timeout(2000)));if(body!=='{}')return privateResponse(401);
  const expected=await mac(Buffer.from(key,'hex'),JSON.stringify(['n88-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
  if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(sig,'hex')))return privateResponse(401);
  for(const [n,t]of nonces)if(t<Date.now()-15000)nonces.delete(n);
  if(nonces.has(nonce)||nonces.size>=100)return privateResponse(401);nonces.set(nonce,Date.now());
  busy++;try{const result=await check(readEnv);return Response.json(result,{status:result.status==='ready'?200:503,headers:PRIVATE_WEB_HEADERS});}finally{busy--;}
 }catch{return privateResponse();}
}
