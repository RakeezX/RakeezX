/** AI: INACTIVE module Worker for the EXISTING Cloudflare zone /api/n44/* route.
 * No Node host. No live route/config change. Default disabled before any fetch.
 * Provider cf metadata + CF-Connecting-IP at external ingress ONLY. Worker
 * subrequests (CF-Worker header) are denied, including same-zone IP overrides.
 */
import {ROUTE,FORWARDED,readBytes,sha,mac,signingText,encodeBytes,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
export function createCloudflareEntry({fetch:send=globalThis.fetch,now=Date.now}={}) {
  return async (request,env) => {
    if(env?.N44_ENABLED!=='true')return privateResponse();
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
    try {
      const url=new URL(request.url),origin=env.N44_PUBLIC_ORIGIN,upstream=new URL(env.N44_EDGE_URL);
      if(url.origin!==origin || url.protocol!=='https:' || url.search || !ROUTE.test(url.pathname) || request.method!=='POST' ||
        !request.cf || !['TLSv1.2','TLSv1.3'].includes(request.cf.tlsVersion) || request.headers.has('cf-worker') ||
        upstream.protocol!=='https:' || upstream.username || upstream.password || upstream.search || upstream.hash ||
        !/^\/functions\/v1\/n44-notifications$/.test(upstream.pathname))return privateResponse(401);
      // Fail closed on missing/ambiguous provider IP. Never X-Forwarded-For.
      let ip=request.headers.get('cf-connecting-ip');
      if(!ip || ip.length>45 || !/^[a-fA-F0-9:.]+$/.test(ip))return privateResponse(401);
      if(ip.includes(':'))ip=new URL('http://['+ip+']/').hostname.toLowerCase();
      else if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(p=>Number(p)>255 || String(Number(p))!==p))return privateResponse(401);
      const keyText=env.N44_INGRESS_KEY;if(!/^[a-f0-9]{64}$/.test(keyText||''))return privateResponse();
      const key=Uint8Array.from(keyText.match(/../g),x=>parseInt(x,16));
      const headers=new Headers();for(const n of FORWARDED){const v=request.headers.get(n);if(v!==null)headers.set(n,v);}
      const bytes=await readBytes(request.body,12288,abort.signal);
      const time=String(Math.floor(now()/1000)),nonce=crypto.randomUUID(),source=await mac(key,JSON.stringify(['source-v1',ip]));
      const signature=await mac(key,signingText({origin,path:url.pathname,method:request.method,headers,bodyHash:await sha(bytes),time,nonce,source}));
      // Fixed upstream URL and metadata headers: private route, PIN, bearer and
      // cookie occur ONLY in TLS request body, never managed invocation URL/headers.
      const wire=new Headers({'content-type':'application/json'});
      for(const [n,v] of Object.entries({'x-n44-time':time,'x-n44-nonce':nonce,'x-n44-source':source,'x-n44-signature':signature}))wire.set(n,v);
      const payload=JSON.stringify({path:url.pathname,method:request.method,headers:FORWARDED.map(n=>headers.get(n)||''),body:encodeBytes(bytes)});
      if(new TextEncoder().encode(payload).length>32768)return privateResponse(413);
      const result=await send(upstream.href+'/dispatch',{method:'POST',headers:wire,body:payload,
        signal:abort.signal,redirect:'manual',cache:'no-store'});
      // Workers supports manual redirects. Never follow an upstream redirect or
      // expose its location/body through the private application response.
      if(result.status>=300 && result.status<400){void result.body?.cancel().catch(()=>{});return privateResponse();}
      const responseBytes=await readBytes(result.body,2*1024*1024,abort.signal);
      if(!result.ok)return privateResponse(result.status===429?429:result.status>=500?503:401);
      const reply=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(responseBytes));
      if(!reply || Object.keys(reply).sort().join(',')!=='body,status' || ![200,400,401,413,429,503].includes(reply.status))return privateResponse();
      const out=new Headers(PRIVATE_WEB_HEADERS);
      return new Response(JSON.stringify(reply.body),{status:reply.status,headers:out});
    }catch{return privateResponse();}finally{clearTimeout(timer);abort.abort();}
  };
}
export default {fetch:createCloudflareEntry()};
