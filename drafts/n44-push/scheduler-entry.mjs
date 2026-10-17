/** AI: bounded private cron driver. Exporting never registers a scheduled live job. */
import {mac,sha,readBytes,privateResponse} from './web-protocol.mjs';
export async function signedScheduleRequest(url,key,body,now=Date.now) {
 const bytes=new TextEncoder().encode(JSON.stringify(body)),time=String(Math.floor(now()/1000)),nonce=crypto.randomUUID(),source=await mac(key,'n44-private-scheduler');
 const u=new URL(url),signature=await mac(key,JSON.stringify(['n44-scheduler-v1',u.origin,u.pathname,await sha(bytes),time,nonce,source]));
 return new Request(url,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-source':source,'x-n44-signature':signature},body:bytes});
}
export async function runScheduled(env,{fetch:send=globalThis.fetch}={}) {
 if(env?.N44_ENABLED!=='true'||env.N44_SCHEDULER_ENABLED!=='true')return {status:'disabled'};
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45000);
 try {
  const url=new URL(env.N44_EDGE_URL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/functions/v1/n44-notifications')throw Error();
  if(!/^[a-f0-9]{64}$/.test(env.N44_SCHEDULER_KEY??''))throw Error();
  const key=Uint8Array.from(env.N44_SCHEDULER_KEY.match(/../g),x=>parseInt(x,16));
  const invoke=async body=>{const request=await signedScheduleRequest(url.href+'/schedule',key,body);
   const response=await send(request,{signal:abort.signal,redirect:'error',cache:'no-store'});if(!response.ok)throw Error();
   return JSON.parse(new TextDecoder().decode(await readBytes(response.body,8192,abort.signal)));};
  let cursor=null;for(let page=0;page<4;page++){const r=await invoke({operation:'due',cursor,limit:25});if(r.status!=='completed')throw Error();cursor=r.cursor;if(!cursor)break;}
  await invoke({operation:'cleanup',cursor:null,limit:25});return {status:'completed'};
 }catch{return {status:'unavailable'};}finally{clearTimeout(timer);abort.abort();}
}
export default {scheduled(_event,env,ctx){ctx.waitUntil(runScheduled(env));},fetch:()=>privateResponse()};
