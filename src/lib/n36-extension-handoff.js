// AI: ephemeral transport only. Saving remains in the existing guarded import UI.
import { APP_ORIGIN, handoffRoute, validateHandoff as validateLegacyHandoff, handoffBundle } from './n36-extension-protocol.js';
import { validateBundle } from './teacher-setup-import.js';
// Additive visible-department adapter. The immutable legacy transport still
// validates every envelope/row/fence, while the existing bundle validates metadata.
export function validateHandoff(value,now=Date.now()){
 const department=value?.version===3&&Array.isArray(value.setup)?value.setup.filter(c=>c?.category==='department'):[];
 if(!department.length)return validateLegacyHandoff(value,now);
 if(department.length!==1||value.setup.length>6||value.setup.reduce((n,c)=>n+(c?.rows?.length??601),0)>600)throw Error('HANDOFF_SETUP');
 const checked=validateBundle({schema:'rakeez-private-teacher-setup',version:1,categories:department}).categories[0];
 if(checked.provenance.length!==1||checked.provenance[0]!=='teacher-readonly-run')throw Error('HANDOFF_SETUP');
 const legacy=validateLegacyHandoff({...value,setup:value.setup.filter(c=>c.category!=='department')},now);
 if(new TextEncoder().encode(JSON.stringify(value)).length>100000)throw Error('HANDOFF_LIMIT_OR_EXPIRED');
 return {...legacy,setup:[...legacy.setup,checked]};
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
  const response = await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('HANDOFF_TIMEOUT')),5000);
    chrome.runtime.sendMessage(request.extensionId,{type:'n36-claim',nonce:request.nonce},result=>{
      clearTimeout(timer);
      if(chrome.runtime.lastError || !result?.ok) reject(Error(['HANDOFF_DOCUMENT_OR_ROUTE','HANDOFF_SENDER','HANDOFF_EXPIRED_OR_DENIED','HANDOFF_LIMIT_OR_EXPIRED'].includes(result?.code)?result.code:'HANDOFF_UNAVAILABLE')); else resolve(result);
    });
  });
  const envelope=validateHandoff(response.envelope);
  return {envelope,bundle:handoffBundle(envelope.version===3?{...envelope,setup:envelope.setup.filter(c=>c.category!=='department')}:envelope),request};
}

// AI: counts only, bound by the extension to the original receiver tab and nonce.
export async function reportHandoffOutcome(request,outcome){
 if(location.origin!==APP_ORIGIN||!request)return false;
 return new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),1500);chrome.runtime.sendMessage(request.extensionId,{type:'n36-outcome',nonce:request.nonce,outcome},r=>{clearTimeout(timer);resolve(!chrome.runtime.lastError&&r?.ok===true);});});
}
