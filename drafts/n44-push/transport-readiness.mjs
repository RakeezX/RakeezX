/** Fixed-host NON-PUSH readiness. No account, subscription, SQL or sender call. */
import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {publicAddress} from './provider-policy.mjs';
import {inspectSenderMaterial} from './sender-material.mjs';
import {TRANSPORT_HOST} from './transport-contract.mjs';
export {TRANSPORT_PURPOSE,TRANSPORT_PROJECT,TRANSPORT_HOST} from './transport-contract.mjs';
const base=()=>({status:'unavailable',runtime:'0',family:'none',materialReady:false,pairValid:false,senderConstructed:false,unsafeDiagnostics:false,dnsPublic:false,pinMatch:false,nativeTlsVerified:false,nodeSocketSeen:false,nodeSecureConnectSeen:false,nodeCertRejected:false,headClass:'none',phase:'material',reason:'unclassified',closed:true,noRetry:true});
export function transportWindowValid(gate,now){return gate&&Object.keys(gate).sort().join(',')==='expiresAt,startsAt'&&Number.isSafeInteger(gate.startsAt)&&Number.isSafeInteger(gate.expiresAt)&&gate.startsAt<=now&&now<gate.expiresAt&&gate.expiresAt-gate.startsAt>0&&gate.expiresAt-gate.startsAt<=1800000;}
export function selectPublicPin(answers){if(!Array.isArray(answers)||!answers.length||answers.length>16||answers.some(a=>!a||!publicAddress(a.address,a.family)))throw Error('dns');return Object.freeze({address:answers[0].address,family:answers[0].family});}
export async function nativePinnedTls(pin,{runtime=globalThis.Deno,signal,port=443}={}){
 let tcp,tls,pendingCount=0,outcome;const result=value=>(outcome={...value,closed:false}),close=()=>{try{tls?.close();}catch{}try{tcp?.close();}catch{}};
 const abort=()=>close();signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted)return result({verified:false,pinMatch:false,reason:'deadline'});
  if(!runtime?.connect||!runtime?.startTls)return result({verified:false,pinMatch:false,reason:'unsupported'});
  pendingCount++;const pending=runtime.connect({hostname:pin.address,port,transport:'tcp'}).then(conn=>{tcp=conn;if(signal?.aborted){close();throw Error('deadline');}return conn;}).finally(()=>pendingCount--);
  await bounded(pending,signal);if(tcp.remoteAddr?.hostname!==pin.address)return result({verified:false,pinMatch:false,reason:'pin'});
  pendingCount++;const upgrading=runtime.startTls(tcp,{hostname:TRANSPORT_HOST}).then(conn=>{tls=conn;tcp=null;if(signal?.aborted){close();throw Error('deadline');}return conn;}).finally(()=>pendingCount--);
  await bounded(upgrading,signal);
  if(typeof tls.handshake!=='function')return result({verified:false,pinMatch:true,reason:'unsupported'});
  await bounded(tls.handshake(),signal);if(signal?.aborted)throw Error('deadline');
  return result({verified:true,pinMatch:true,reason:'none'});
 }catch(e){return result({verified:false,pinMatch:!!tls,reason:signal?.aborted?'deadline':['InvalidData','BadResource'].includes(e.name)?'trust':'network'});}
 finally{signal?.removeEventListener('abort',abort);close();if(outcome)outcome.closed=pendingCount===0;}
}
function bounded(promise,signal){if(signal?.aborted)return Promise.reject(Error('deadline'));return new Promise((resolve,reject)=>{const stop=()=>reject(Error('deadline'));signal?.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',stop));});}
export async function nodeHeadRoot(pin,{httpsRequest=request,signal,port=443}={}){
 const result={nodeSocketSeen:false,nodeSecureConnectSeen:false,nodeCertRejected:false,pinMatch:false,headClass:'none',reason:'unsupported'};
 return await new Promise(resolve=>{let req,res,done=false;const finish=()=>{if(done)return;done=true;signal?.removeEventListener('abort',stop);res?.destroy();req?.destroy();resolve(result);};const stop=()=>{result.reason='deadline';finish();};signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return;}
  try{req=httpsRequest({protocol:'https:',hostname:TRANSPORT_HOST,port,path:'/',method:'HEAD',headers:{},servername:TRANSPORT_HOST,rejectUnauthorized:true,checkServerIdentity,minVersion:'TLSv1.2',agent:false,autoSelectFamily:false,family:pin.family,maxHeaderSize:8192,signal,lookup(host,opts,callback){if(host!==TRANSPORT_HOST){callback(Error('pin'));return;}if(opts?.all)callback(null,[{...pin}]);else callback(null,pin.address,pin.family);}},response=>{res=response;if(!result.nodeSecureConnectSeen||!result.pinMatch){result.reason='unsupported';finish();return;}const code=response.statusCode;result.headClass=Number.isInteger(code)&&code>=200&&code<600?Math.floor(code/100)+'xx':'none';result.reason=result.headClass==='none'?'unclassified':'none';finish();});
   req.on('error',error=>{if(!done){result.nodeCertRejected=['ERR_TLS_CERT_ALTNAME_INVALID','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED'].includes(error?.code);result.reason=signal?.aborted?'deadline':result.nodeCertRejected?'trust':'network';finish();}});
   req.on('socket',socket=>{result.nodeSocketSeen=true;socket.once('secureConnect',()=>{result.nodeSecureConnectSeen=true;result.pinMatch=socket.remoteAddress===pin.address;if(socket.authorized!==true){result.nodeCertRejected=true;result.reason='trust';finish();return;}if(!result.pinMatch){result.reason='pin';finish();return;}req.end();});});
  }catch{result.reason='network';finish();}
 });
}
export async function probeTransport(readEnv,{expiresAt,signal}={},ports={}){
 const result=base(),material=(ports.inspect??inspectSenderMaterial)(readEnv);Object.assign(result,material);
 const version=String(globalThis.Deno?.version?.deno??process.versions?.node??'0');result.runtime=/^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(version)?version:'0';
 if(!result.materialReady||!result.pairValid||!result.senderConstructed||result.unsafeDiagnostics)return result;
 if(readEnv('N44_DELIVERY_ENABLED')!=='false'||readEnv('N44_ONE_DEVICE_TEST_JSON')!=='null')return result;
 const abort=new AbortController(),remaining=Math.min(9000,expiresAt-Date.now());if(remaining<1){result.reason='deadline';return result;}
 const timer=setTimeout(()=>abort.abort(),remaining),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)abort.abort();
 try{result.phase='dns';const answers=await bounded((ports.resolve??lookup)(TRANSPORT_HOST,{all:true,verbatim:true}),abort.signal);let pin;try{pin=selectPublicPin(answers);}catch{result.reason='dns';return result;}result.dnsPublic=true;result.family=String(pin.family);
  result.phase='native_tls';const native=await(ports.native??nativePinnedTls)(pin,{signal:abort.signal});result.nativeTlsVerified=native.verified;result.pinMatch=native.pinMatch;if(native.closed===false)result.closed=false;if(!native.verified){result.reason=native.reason;return result;}
  result.phase='node_head';const node=await(ports.head??nodeHeadRoot)(pin,{signal:abort.signal});Object.assign(result,node);result.status=node.reason==='none'?'ready':'unavailable';result.phase='closed';return result;
 }catch{result.reason=abort.signal.aborted?'deadline':'network';return result;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
