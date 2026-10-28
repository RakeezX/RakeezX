/** Separately qualified native-only NONPUSH contract. Old Node proof is retained. */
import {lookup} from 'node:dns/promises';
import {inspectSenderMaterial} from './sender-material.mjs';
import {selectPublicPin} from './transport-readiness.mjs';
import {TRANSPORT_HOST} from './transport-contract.mjs';
import {nativeHttpExchange} from './native-http-transport.mjs';
export {NATIVE_PURPOSE,NATIVE_MODE} from './transport-contract.mjs';
import {validateNativeResult} from './transport-contract.mjs';
export {validateNativeResult} from './transport-contract.mjs';
export async function probeNativeTransport(readEnv,{expiresAt,signal}={},ports={}){
 const v={status:'unavailable',runtime:'0',serviceRegion:'unknown',family:'none',materialReady:false,pairValid:false,senderConstructed:false,unsafeDiagnostics:false,dnsPublic:false,pinMatch:false,tlsVerified:false,requestWritten:false,closed:true,noRetry:true,headClass:'none',phase:'material',reason:'unclassified'};
 Object.assign(v,(ports.inspect??inspectSenderMaterial)(readEnv));const version=String(globalThis.Deno?.version?.deno??'0');v.runtime=/^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(version)?version:'0';const region=readEnv('SB_REGION');v.serviceRegion=region==='ap-south-1'?region:region?'other':'unknown';
 if(!v.materialReady||!v.pairValid||!v.senderConstructed||v.unsafeDiagnostics||readEnv('N44_ONE_DEVICE_TEST_JSON')!=='null'||readEnv('N44_DELIVERY_ENABLED')!=='false')return v;
 const controller=new AbortController(),stop=()=>controller.abort(),remaining=Math.min(9000,expiresAt-Date.now());if(!Number.isFinite(remaining)||remaining<1){v.reason='deadline';return v;}const timer=setTimeout(stop,remaining);signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
 try{v.phase='dns';const aborted=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('deadline')),{once:true});if(controller.signal.aborted)reject(Error('deadline'));});const answers=await Promise.race([(ports.resolve??lookup)(TRANSPORT_HOST,{all:true,verbatim:true}),aborted]);let pin;try{pin=selectPublicPin(answers);}catch{v.reason='dns';return v;}v.dnsPublic=true;v.family=String(pin.family);
  const r=await(ports.exchange??nativeHttpExchange)({hostname:TRANSPORT_HOST,pin,method:'HEAD',path:'/',headers:{},body:new Uint8Array(),signal:controller.signal,deadlineMs:remaining});for(const k of['pinMatch','tlsVerified','requestWritten','closed','phase','reason'])v[k]=r[k];v.headClass=r.statusCode>=200&&r.statusCode<600?Math.floor(r.statusCode/100)+'xx':'none';v.status=r.reason==='none'&&r.closed?'ready':'unavailable';return validateNativeResult(v);
 }catch{v.reason=controller.signal.aborted?'deadline':'network';return v;}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
}
