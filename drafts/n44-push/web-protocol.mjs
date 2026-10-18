/** AI: shared pure Web API protocol. No app/SDK imports or environment defaults. */
export const PREFIX='/api/n44';
export const ROUTE=/^\/api\/n44\/(?:context\/(?:read|update)|events\/(?:update|authorize)|push\/(?:register|revoke))$/;
export const FORWARDED=Object.freeze(['authorization','origin','content-type','x-n44-csrf','sec-fetch-site']);
export const encodeBytes=bytes=>btoa(String.fromCharCode(...bytes));
export const decodeBytes=value=>{
  if(typeof value!=='string' || value.length>16384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('n44_envelope');
  return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
};
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function sha(bytes) {return hex(await crypto.subtle.digest('SHA-256',bytes));}
export async function mac(key,value) {
  const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value)));
}
export function signingText({origin,path,method,headers,bodyHash,time,nonce,source}) {
  return JSON.stringify(['n44-ingress-v1',origin,path,method,FORWARDED.map(n=>headers.get(n)||''),bodyHash,time,nonce,source]);
}
export async function readBytes(stream,max=12288,signal) {
  if(!stream)return new Uint8Array();
  const reader=stream.getReader();let total=0;const parts=[];
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
  try {for(;;){if(signal?.aborted)throw Error('n44_deadline');const {done,value}=await reader.read();if(done)break;
    total+=value.length;if(total>max)throw Error('n44_body_limit');parts.push(value);}
    const bytes=new Uint8Array(total);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return bytes;
  } finally {signal?.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export const PRIVATE_WEB_HEADERS=Object.freeze({'cache-control':'no-store, private','referrer-policy':'no-referrer',
  'x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff',vary:'Origin','content-type':'application/json; charset=utf-8'});
export const privateResponse=(status=503)=>new Response('{"error":"unavailable"}',{status,headers:PRIVATE_WEB_HEADERS});
