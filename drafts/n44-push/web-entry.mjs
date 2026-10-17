/** AI: private Supabase WebRequest entry. No browser service secrets or direct public trust. */
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {createBackend} from './backend.mjs';
import {parseBody} from './runtime-gateway.mjs';
import {ROUTE,FORWARDED,readBytes,decodeBytes,sha,mac,signingText,privateResponse,PRIVATE_WEB_HEADERS} from './web-protocol.mjs';
export function createWebEntry(options) {
 const backend=createBackend(options),now=options.now??Date.now;let running=0;
 return async request=>{
  if(running>=4)return privateResponse();running++;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  const work=async()=>{
   try {
    const u=new URL(request.url),h=request.headers,schedule=u.pathname==='/functions/v1/n44-notifications/schedule';
    if(u.origin!==options.authUrl||u.search||request.method!=='POST'||h.get('content-type')!=='application/json'||h.has('content-encoding')||
      !['/functions/v1/n44-notifications/dispatch','/functions/v1/n44-notifications/schedule'].includes(u.pathname))return privateResponse(400);
    const e={time:h.get('x-n44-time'),nonce:h.get('x-n44-nonce'),source:h.get('x-n44-source')},sig=h.get('x-n44-signature');
    if(!/^\d{10}$/.test(e.time??'')||Math.abs(now()/1000-Number(e.time))>15||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/).test(e.nonce??'')||
     !/^[a-f0-9]{64}$/.test(e.source??'')||!/^[a-f0-9]{64}$/.test(sig??''))return privateResponse(401);
    const bytes=await readBytes(request.body,32768,abort.signal),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),envelope=parseBody(text,32768);
    let expected,path,authorization,body;
    if(schedule){
     if(!recordSchedule(envelope))return privateResponse(400);
     expected=await mac(options.schedulerKey,JSON.stringify(['n44-scheduler-v1',u.origin,u.pathname,await sha(bytes),e.time,e.nonce,e.source]));
    }else{
     if(!envelope||Object.keys(envelope).sort().join(',')!=='body,headers,method,path'||!ROUTE.test(envelope.path)||envelope.method!=='POST'||
       !Array.isArray(envelope.headers)||envelope.headers.length!==FORWARDED.length||!envelope.headers.every(v=>typeof v==='string'&&v.length<=8192))return privateResponse(400);
     const forwarded=new Headers(FORWARDED.map((n,i)=>[n,envelope.headers[i]])),raw=decodeBytes(envelope.body);
     if(raw.length>12288||forwarded.get('origin')!==options.origin||forwarded.get('content-type')!=='application/json'||forwarded.get('x-n44-csrf')!=='1'||
       forwarded.get('sec-fetch-site')&&forwarded.get('sec-fetch-site')!=='same-origin')return privateResponse(401);
     expected=await mac(options.ingressKey,signingText({origin:options.origin,path:envelope.path,method:'POST',headers:forwarded,bodyHash:await sha(raw),...e}));
     path=envelope.path.slice('/api/n44'.length);authorization=forwarded.get('authorization');body=parseBody(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    }
    if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(sig,'hex')))return privateResponse(401);
    if(!await backend.ingress({...e,kind:schedule?'scheduler':'teacher'},abort.signal))return privateResponse(429);
    const result=schedule?await backend.schedule(envelope,abort.signal):await backend.teacher(path,authorization,body,abort.signal);
    if(abort.signal.aborted)return privateResponse();
    const status=result.status==='unavailable'?503:result.status==='limited'?429:['rejected','stale'].includes(result.status)?400:200;
    return schedule?Response.json(result,{status,headers:PRIVATE_WEB_HEADERS}):Response.json({status,body:result},{headers:PRIVATE_WEB_HEADERS});
   }catch{return privateResponse();}
  };
  try{const pending=work().finally(()=>{running--;});return await Promise.race([pending,new Promise(resolve=>abort.signal.addEventListener('abort',()=>resolve(privateResponse()),{once:true}))]);}
  finally{clearTimeout(timer);abort.abort();}
 };
}
const recordSchedule=e=>e&&Object.keys(e).sort().join(',')==='cursor,limit,operation';
