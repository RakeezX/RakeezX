// AI: ephemeral transport only. Saving remains in the existing guarded import UI.
import { APP_ORIGIN, handoffRoute, validateHandoff, handoffBundle } from './n36-extension-protocol.js';
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
      if(chrome.runtime.lastError || !result?.ok) reject(Error('HANDOFF_UNAVAILABLE')); else resolve(result);
    });
  });
  const envelope=validateHandoff(response.envelope);
  return {envelope,bundle:handoffBundle(envelope)};
}
