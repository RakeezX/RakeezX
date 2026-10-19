import { Buffer } from 'node:buffer';
/** AI: actual Web Request -> service -> durable repository entry, inactive by default. */
import { timingSafeEqual } from 'node:crypto';
import {composeService} from './runtime.mjs';
import {createTeacherVerifier} from './auth-verifier.mjs';
import {ROUTE,FORWARDED,decodeBytes,readBytes,sha,mac,signingText,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
export function createWebEntry(options) {
  if(!Buffer.isBuffer(options.ingressKey) || options.ingressKey.length!==32)throw Error('n88_ingress_configuration');
  const envelopes=new WeakMap(),now=options.now||Date.now;
  const verifier=createTeacherVerifier(options);
  const adapter={
    verifyTeacher:(r,ports)=>{const e=envelopes.get(r);return e?verifier(e.authorization,e.signal,ports):null;},
    verifyIngress:async(r,{query})=>{
      const e=envelopes.get(r);if(!e || e.signal.aborted || Math.abs(Math.floor(now()/1000)-Number(e.time))>15)return null;
      const result=await query('select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted',[e.nonce,Number(e.time)+16]);
      return result.rows.length===1 && result.rows[0].accepted===true?{clientKey:e.source}:null;
    }
  };
  const service=composeService(options,adapter); let running=0;
  return async request=>{
    if(running>=8)return privateResponse();running++;
    const abort=new AbortController();let timer;
    const work=async()=>{
      try {
        const u=new URL(request.url),wire=request.headers;
        if(u.origin!==options.authUrl || u.pathname!=='/functions/v1/n88-student-portal/dispatch' || u.search || request.method!=='POST' || wire.get('content-type')!=='application/json' || wire.has('content-encoding'))return privateResponse(400);
        const time=wire.get('x-n88-time'),nonce=wire.get('x-n88-nonce'),source=wire.get('x-n88-source'),signature=wire.get('x-n88-signature');
        if(!/^\d{10}$/.test(time||'') || Math.abs(Math.floor(now()/1000)-Number(time))>15 ||
          !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(nonce||'') ||
          !/^[a-f0-9]{64}$/.test(source||'') || !/^[a-f0-9]{64}$/.test(signature||''))return privateResponse(401);
        const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBytes(request.body,24576,abort.signal)));
        if(!envelope || Object.keys(envelope).sort().join(',')!=='body,headers,method,path' || !ROUTE.test(envelope.path) ||
          !['GET','POST'].includes(envelope.method) || !Array.isArray(envelope.headers) || envelope.headers.length!==FORWARDED.length ||
          !envelope.headers.every(v=>typeof v==='string' && v.length<=8200))return privateResponse(400);
        const {path,method}=envelope,h=new Headers(FORWARDED.map((n,i)=>[n,envelope.headers[i]]));
        const cookie=h.get('cookie')||'';
        if(cookie.length>4096 || (cookie.match(/(?:^|;\s*)__Secure-n88-student=/g)||[]).length>1 ||
          (h.get('authorization')||'').length>8200 || h.get('sec-fetch-site') && h.get('sec-fetch-site')!=='same-origin' || h.has('content-encoding'))return privateResponse(400);
        if(method==='POST' && (h.get('origin')!==options.origin || h.get('content-type')!=='application/json' || h.get('x-n88-csrf')!=='1'))return privateResponse(401);
        const bytes=decodeBytes(envelope.body);if(bytes.length>4096)return privateResponse(413);
        const expected=await mac(options.ingressKey,signingText({origin:options.origin,path,method,headers:h,bodyHash:await sha(bytes),time,nonce,source}));
        if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return privateResponse(401);
        let body={};if(bytes.length)body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        if(!body || Array.isArray(body) || typeof body!=='object' || method==='GET' && bytes.length)return privateResponse(400);
        const r={path:path.slice('/api/n88'.length),method,body,headers:Object.fromEntries(['cookie','origin','content-type','x-n88-csrf','sec-fetch-site'].map(n=>[n,h.get(n)||'']))};
        envelopes.set(r,{authorization:h.get('authorization'),signal:abort.signal,time,nonce,source});
        // Cookie/private entry stays in the upstream BODY as well; only the
        // Cloudflare boundary emits it to the same-origin browser response.
        try {const result=await service(r);return Response.json({status:result.status,body:result.body,cookie:result.headers?.['Set-Cookie']||null},{headers:PRIVATE_WEB_HEADERS});}
        finally{envelopes.delete(r);}
      }catch{return privateResponse();}
    };
    try {
      const pending=work().finally(()=>{running--;});
      return await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>{abort.abort();resolve(privateResponse());},18000);})]);
    }finally{clearTimeout(timer);abort.abort();}
  };
}
