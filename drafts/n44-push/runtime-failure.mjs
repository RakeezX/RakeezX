/** AI: finite request phases and trusted acquisition categories; never retain private errors. */
import {PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
const phases=new Set(['configuration','configuration_origin','configuration_revision','configuration_policy','configuration_transport','configuration_crypto','configuration_provider','connect','identity','set_role','private_session','source','ingress','query','deadline','registration_input','registration_auth','registration_protect','registration_repository']);
const tags=new WeakMap();
const own=(value,name)=>{try{return value&&(typeof value==='object'||typeof value==='function')?Object.getOwnPropertyDescriptor(value,name)?.value:undefined;}catch{return undefined;}};
// Scalar own properties only. No nested causes, variable text or raw error retained.
function connectionCategory(cause){
 const code=own(cause,'code'),message=own(cause,'message');
 if(['ETIMEDOUT','ERR_SOCKET_CONNECTION_TIMEOUT'].includes(code)||['timeout exceeded when trying to connect','Connection terminated due to connection timeout'].includes(message))return 'timeout';
 if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'dns';
 if(['ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code))return 'tls';
 if(code==='ECONNREFUSED')return 'connection_refused';
 if(['ECONNRESET','EPIPE','08003','08006'].includes(code)||['Connection terminated unexpectedly','Connection terminated'].includes(message))return 'connection_closed';
 if(['28P01','28000'].includes(code))return 'login_rejected';
 return 'driver_failure';
}
// Only an already-tagged actual acquisition failure can cross the trusted boundary.
export const taggedConnectionCategory=error=>tags.get(error)?.phase==='connect'?tags.get(error).connectionCategory:undefined;
export function identityProjection(value){
 const out={};
 for(const name of ['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','queryCompleted','returnedOneRow']){const v=own(value,name);if(typeof v==='boolean')out[name]=v;}
 for(const [name,allowed] of [['targetKind',['direct','session']],['queryFailure',['timeout','query_cancelled','pg_or_driver_failure']]]){const v=own(value,name);if(allowed.includes(v))out[name]=v;}
 return out;
}
export function identityQueryFailure(cause){
 return own(cause,'message')==='Query read timeout'?'timeout':own(cause,'code')==='57014'?'query_cancelled':'pg_or_driver_failure';
}
export function runtimeFailure(phase,cause,identity){
 const prior=tags.get(cause),safe=prior?.phase??(phases.has(phase)?phase:'configuration');
 const error=new Error('n44_request_unavailable');
 // Preserve only definitive transaction-abort metadata consumed by the existing
 // repository's one-retry fence. Never copy messages, arbitrary codes or getters.
 const code=own(cause,'code');if(['40001','40P01'].includes(code)&&own(cause,'severity')==='ERROR'){error.code=code;error.severity='ERROR';}
 const projected=prior?.identity??(safe==='identity'?identityProjection({...identityProjection(identity),...identityProjection(own(cause,'safeReadiness'))}):{});
 tags.set(error,{phase:safe,identity:projected,...(prior?.connectionCategory?{connectionCategory:prior.connectionCategory}:!prior&&phase==='connect'?{connectionCategory:connectionCategory(cause)}:{})});return error;
}
export function requestFailure(error,fallback='configuration'){
 return failureResponse(error,fallback,false);
}
/** Only the exact signed, unexpired old-target read-only inspection calls this. */
export function operatorInspectionFailure(error){return failureResponse(error,'ingress',true);}
function failureResponse(error,fallback,diagnostic){
 const tag=tags.get(error),phase=tag?.phase??(phases.has(fallback)?fallback:'configuration');
 // The existing dispatch wire carries the public status inside its envelope.
 // The unchanged ingress returns HTTP503; direct untrusted input stays on its
 // original pre-auth401/400 boundary and never receives a driver error.
 const category=diagnostic?taggedConnectionCategory(error):undefined;
 return Response.json({status:503,body:{error:'unavailable',phase,...(tag?.identity&&Object.keys(tag.identity).length?{identity:tag.identity}:{}),...(category?{connectionCategory:category}:{})}},{headers:PRIVATE_WEB_HEADERS});
}
