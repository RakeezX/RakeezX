/** AI: INACTIVE module Worker for the EXISTING Cloudflare zone /api/n88/* route.
 * No Node host. No live route/config change. Default disabled before any fetch.
 * Provider cf metadata + CF-Connecting-IP at external ingress ONLY. Worker
 * subrequests (CF-Worker header) are denied, including same-zone IP overrides.
 */
import {ROUTE,FORWARDED,readBytes,sha,mac,signingText,encodeBytes,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
import {privateAssets} from './activation/private-document.mjs';
export function createCloudflareEntry({fetch:send=globalThis.fetch,now=Date.now}={}) {
  return async (request,env) => {
    if(env?.N88_ENABLED!=='true')return privateResponse();
    const documentUrl=new URL(request.url);
    if(documentUrl.origin===env.N88_PUBLIC_ORIGIN&&request.cf&&['TLSv1.2','TLSv1.3'].includes(request.cf.tlsVersion)&&!request.headers.has('cf-worker')&&
       !documentUrl.search&&['GET','HEAD'].includes(request.method)&&Object.hasOwn(privateAssets,documentUrl.pathname)){
      const asset=privateAssets[documentUrl.pathname];
      const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
      return new Response(request.method==='HEAD'?null:bytes,{headers:{...PRIVATE_WEB_HEADERS,'content-type':asset.type,
        'Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
    }
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),19000);
    let stage='configuration',responseRegion=null;
    const unavailable=()=>new Response('{"error":"unavailable"}',{status:503,headers:{...PRIVATE_WEB_HEADERS,'x-n88-transport-stage':stage,...(responseRegion?{'x-n88-service-region':responseRegion}:{})}});
    try {
      const url=new URL(request.url),origin=env.N88_PUBLIC_ORIGIN,upstream=new URL(env.N88_EDGE_URL);
      if(url.origin!==origin || url.protocol!=='https:' || url.search || !ROUTE.test(url.pathname) || !['GET','POST'].includes(request.method) ||
        !request.cf || !['TLSv1.2','TLSv1.3'].includes(request.cf.tlsVersion) || request.headers.has('cf-worker') ||
        upstream.protocol!=='https:' || upstream.username || upstream.password || upstream.search || upstream.hash ||
        !/^\/functions\/v1\/n88-student-portal$/.test(upstream.pathname))return privateResponse(401);
      // Fail closed on missing/ambiguous provider IP. Never X-Forwarded-For.
      let ip=request.headers.get('cf-connecting-ip');
      if(!ip || ip.length>45 || !/^[a-fA-F0-9:.]+$/.test(ip))return privateResponse(401);
      if(ip.includes(':'))ip=new URL('http://['+ip+']/').hostname.toLowerCase();
      else if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(p=>Number(p)>255 || String(Number(p))!==p))return privateResponse(401);
      const keyText=env.N88_INGRESS_KEY;if(!/^[a-f0-9]{64}$/.test(keyText||'')){stage='key-configuration';return unavailable();}
      stage='envelope';
      const key=Uint8Array.from(keyText.match(/../g),x=>parseInt(x,16));
      const headers=new Headers();for(const n of FORWARDED){const v=request.headers.get(n);if(v!==null)headers.set(n,v);}
      const bytes=await readBytes(request.body,4096,abort.signal);
      const time=String(Math.floor(now()/1000)),nonce=crypto.randomUUID(),source=await mac(key,JSON.stringify(['source-v1',ip]));
      const signature=await mac(key,signingText({origin,path:url.pathname,method:request.method,headers,bodyHash:await sha(bytes),time,nonce,source}));
      // Fixed upstream URL and metadata headers: private route, PIN, bearer and
      // cookie occur ONLY in TLS request body, never managed invocation URL/headers.
      const wire=new Headers({'content-type':'application/json'});
      // Trusted placement is carrier-owned, outside the unchanged signed envelope.
      if(request.method==='POST'&&url.pathname==='/api/n88/teacher/class/list')wire.set('x-region','ap-south-1');
      for(const [n,v] of Object.entries({'x-n88-time':time,'x-n88-nonce':nonce,'x-n88-source':source,'x-n88-signature':signature}))wire.set(n,v);
      const payload=JSON.stringify({path:url.pathname,method:request.method,headers:FORWARDED.map(n=>headers.get(n)||''),body:encodeBytes(bytes)});
      if(new TextEncoder().encode(payload).length>24576)return privateResponse(413);
      stage='upstream';
      const result=await send(upstream.href+'/dispatch',{method:'POST',headers:wire,body:payload,
        signal:abort.signal,redirect:'manual',cache:'no-store'});
      // Only the trusted native response can attest placement; never client input.
      const region=result.headers.get('x-sb-edge-region');
      if(request.method==='POST'&&url.pathname==='/api/n88/teacher/class/list'&&['ap-northeast-1','ap-northeast-2','ap-south-1','ap-southeast-1','ap-southeast-2','ca-central-1','us-east-1','us-west-1','us-west-2','eu-central-1','eu-central-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1'].includes(region))responseRegion=region;
      // Workers does not implement redirect:'error'. Reject redirects explicitly
      // without following Location or forwarding the signed/private envelope.
      if(result.status>=300&&result.status<400)return privateResponse(401);
      stage='upstream-body';
      const responseBytes=await readBytes(result.body,2*1024*1024,abort.signal);
      if(!result.ok){if(result.status>=500){stage='upstream-http-5xx';return unavailable();}return privateResponse(401);}
      stage='reply';
      const reply=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(responseBytes));
      if(!reply || Object.keys(reply).sort().join(',')!=='body,cookie,status' || ![200,400,401,409,413,429,503].includes(reply.status) ||
        reply.cookie!==null && (typeof reply.cookie!=='string' || reply.cookie.length>4096)){stage='reply-shape';return unavailable();}
      const out=new Headers(PRIVATE_WEB_HEADERS);if(reply.cookie)out.set('set-cookie',reply.cookie);
      if(responseRegion)out.set('x-n88-service-region',responseRegion);
      // Finite operational phase only; never reflect arbitrary upstream values.
      if(reply.status===503&&['acquire','begin','snapshot','repository','teacher','source','synchronize','projection'].includes(reply.body?.stage))out.set('x-n88-service-stage',reply.body.stage);
      return new Response(JSON.stringify(reply.body),{status:reply.status,headers:out});
    }catch{return unavailable();}finally{clearTimeout(timer);abort.abort();}
  };
}
export default {fetch:createCloudflareEntry()};
