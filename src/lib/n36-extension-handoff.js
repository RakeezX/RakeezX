// AI: ephemeral transport only. Saving remains in the existing guarded import UI.
import { APP_ORIGIN, HANDOFF_TTL, handoffRoute, validateHandoff as validateLegacyHandoff, handoffBundle } from './n36-extension-protocol.js';
import { validateBundle } from './teacher-setup-import.js';
// Additive visible-department adapter. The immutable legacy transport still
// validates every envelope/row/fence, while the existing bundle validates metadata.
// v3 may use a SHORTER remaining window, never extend the original job/review
// deadline. Adapt only timestamps for the immutable legacy row/schema validator;
// return the real createdAt/expiresAt and retain every owner/document fence.
function legacyLifetime(value,now=Date.now()){
 if(value?.version===3&&Object.getPrototypeOf(value)===Object.prototype&&Number.isSafeInteger(value.createdAt)&&Number.isSafeInteger(value.expiresAt)&&value.createdAt<=now+5000&&value.expiresAt>now&&value.expiresAt-value.createdAt>0&&value.expiresAt-value.createdAt<=HANDOFF_TTL)return {...value,createdAt:value.expiresAt-HANDOFF_TTL};
 return value;
}
export function validateHandoff(value,now=Date.now()){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Error('HANDOFF_SCHEMA');
 const bounded=legacyLifetime(value,now);
 const department=value?.version===3&&Array.isArray(value.setup)?value.setup.filter(c=>c?.category==='department'):[];
 if(!department.length){const checked=validateLegacyHandoff(bounded,now);return {...checked,createdAt:value.createdAt};}
 if(department.length!==1||value.setup.length>6||value.setup.reduce((n,c)=>n+(c?.rows?.length??601),0)>600)throw Error('HANDOFF_SETUP');
 const checked=validateBundle({schema:'rakeez-private-teacher-setup',version:1,categories:department}).categories[0];
 if(checked.provenance.length!==1||checked.provenance[0]!=='teacher-readonly-run')throw Error('HANDOFF_SETUP');
 const legacy=validateLegacyHandoff({...bounded,setup:value.setup.filter(c=>c.category!=='department')},now);
 if(new TextEncoder().encode(JSON.stringify(value)).length>100000)throw Error('HANDOFF_LIMIT_OR_EXPIRED');
 return {...legacy,createdAt:value.createdAt,setup:[...legacy.setup,checked]};
}
export function handoffRequest(hash = location.hash) {
  const [path, query] = hash.split('?');
  if (path !== '#/classes/koshoof') return null;
  const params = new URLSearchParams(query);
  if (!params.has('handoff') && !params.has('extension')) return null;
  const extensionId = params.get('extension'), nonce = params.get('handoff');
  if (hash !== handoffRoute(extensionId, nonce)) throw Error('HANDOFF_ROUTE');
  return {extensionId,nonce};
}
export async function claimHandoff(request) {
  if (location.origin !== APP_ORIGIN || !globalThis.chrome?.runtime?.sendMessage) throw Error('HANDOFF_UNAVAILABLE');
  try {
  const response = await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('HANDOFF_TIMEOUT')),5000);
    chrome.runtime.sendMessage(request.extensionId,{type:'n36-claim',nonce:request.nonce},result=>{
      clearTimeout(timer);
      if(chrome.runtime.lastError || !result?.ok) reject(Error(['HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER','HANDOFF_EXPIRED_OR_DENIED','HANDOFF_LIMIT_OR_EXPIRED'].includes(result?.code)?result.code:'HANDOFF_UNAVAILABLE')); else resolve(result);
    });
  });
  const envelope=validateHandoff(response.envelope);
  return {envelope,bundle:handoffBundle(envelope.version===3?{...legacyLifetime(envelope),setup:envelope.setup.filter(c=>c.category!=='department')}:envelope),request};
  }catch(error){
   // Counts-free transport diagnosis only. Worker accepts this solely while the
   // original unclaimed nonce/document still exists; never requeues a claim.
   const code=['HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER','HANDOFF_LIMIT_OR_EXPIRED','HANDOFF_EXPIRED_OR_DENIED','HANDOFF_UNAVAILABLE','HANDOFF_TIMEOUT'].includes(error.message)?error.message:'HANDOFF_UNAVAILABLE';
   try{chrome.runtime.sendMessage(request.extensionId,{type:'n36-claim-failed',nonce:request.nonce,code},()=>{void chrome.runtime.lastError;});}catch{/* Original error remains authoritative. */}
   throw error;
  }
}

// AI: counts only, bound by the extension to the original receiver tab and nonce.
export async function reportHandoffOutcome(request,outcome){
 if(location.origin!==APP_ORIGIN||!request)return false;
 return new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),1500);chrome.runtime.sendMessage(request.extensionId,{type:'n36-outcome',nonce:request.nonce,outcome},r=>{clearTimeout(timer);resolve(!chrome.runtime.lastError&&r?.ok===true);});});
}

// AI: additional session-continuity fence, never JWT-only authorization.
// The authoritative cloud ownership/generation/database/lease guard runs first.
// Claims are used only to DENY a different Auth session; no metadata grants access.
export function captureReceiverSession(cloud){
 const assertOwned=cloud.captureOwnedMutationContext(),initial=cloud.session;
 const sid=token=>{try{const parts=String(token??'').split('.');if(parts.length!==3||parts[1].length>16000)return null;const body=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));return typeof body.session_id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.session_id)?body.session_id.toLowerCase():null;}catch{return null;}};
 const originalSid=sid(initial?.access_token);let retired=false;
 return ()=>{
  try{
   if(retired||typeof initial?.access_token!=='string'||!initial.access_token)throw Error('AUTH_SESSION_CHANGED');
   assertOwned();
   if(!cloud.session?.access_token||cloud.authStatus().state!=='authenticated'||cloud.session.user?.id!==cloud.user?.id)throw Error('AUTH_SESSION_CHANGED');
   if(originalSid?sid(cloud.session.access_token)!==originalSid:cloud.session!==initial&&cloud.session.access_token!==initial?.access_token)throw Error('AUTH_SESSION_CHANGED');
  }catch{retired=true;throw Error('BATCH_OWNER_OR_SESSION_CHANGED');}
 };
}
