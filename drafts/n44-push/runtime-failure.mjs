/** AI: fixed finite request phases only; never retain or inspect private errors. */
import {PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
const phases=new Set(['configuration','configuration_origin','configuration_revision','configuration_policy','configuration_transport','configuration_crypto','configuration_provider','connect','identity','set_role','private_session','source','ingress','query','deadline']);
const tags=new WeakMap();
export function runtimeFailure(phase,cause){
 const safe=tags.get(cause)??(phases.has(phase)?phase:'configuration');
 const error=new Error('n44_request_unavailable');
 // Preserve only definitive transaction-abort metadata consumed by the existing
 // repository's one-retry fence. Never copy messages, arbitrary codes or getters.
 const own=name=>cause&&(typeof cause==='object'||typeof cause==='function')?Object.getOwnPropertyDescriptor(cause,name)?.value:undefined;
 const code=own('code');if(['40001','40P01'].includes(code)&&own('severity')==='ERROR'){error.code=code;error.severity='ERROR';}
 tags.set(error,safe);return error;
}
export function requestFailure(error,fallback='configuration'){
 const phase=tags.get(error)??(phases.has(fallback)?fallback:'configuration');
 // The existing dispatch wire carries the public status inside its envelope.
 // The unchanged ingress returns HTTP503; direct untrusted input stays on its
 // original pre-auth401/400 boundary and never receives a driver error.
 return Response.json({status:503,body:{error:'unavailable',phase}},{headers:PRIVATE_WEB_HEADERS});
}
