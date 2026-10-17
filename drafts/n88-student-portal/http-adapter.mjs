import { Buffer } from 'node:buffer';
/** AI: inactive Node HTTP adapter. No listener, imports in app, proxy trust or logs. */
import { PRIVATE_HEADERS } from './service.mjs';
const unavailable={error:'unavailable'};
export function createHttpAdapter({ service, origin, verifyTeacher, deadlineMs=12000, maxBodyBytes=4096, maxConcurrent=8, trustedSocket }) {
  if(typeof service!=='function' || typeof verifyTeacher!=='function' || typeof trustedSocket!=='function' || new URL(origin).origin!==origin ||
    !Number.isInteger(deadlineMs) || deadlineMs<10 || deadlineMs>30000 || !Number.isInteger(maxBodyBytes) || maxBodyBytes<2 || maxBodyBytes>16384 ||
    !Number.isInteger(maxConcurrent) || maxConcurrent<1 || maxConcurrent>32) throw Error('n88_http_configuration');
  const envelopes=new WeakMap(); let running=0;
  const ingress=r=>envelopes.get(r)?.ingress;
  const teacher=(r,ports)=>envelopes.get(r)?.teacher(ports);
  async function handle(req,res) {
    let live=true,timer;
    const send=(status,body,headers={})=>{if(!live || res.destroyed || res.writableEnded)return;live=false;
      res.writeHead(status,{...PRIVATE_HEADERS,...headers,'Content-Type':'application/json; charset=utf-8','Connection':'close'});
      res.end(JSON.stringify(body));};
    if(running>=maxConcurrent) {send(503,unavailable);return;}
    running++;
    const abort=new AbortController();
    const work=async()=>{
      // No absolute URLs, querystrings, percent aliases, duplicate headers or forwarding.
      const seen=new Set();
      for(let i=0;i<(req.rawHeaders||[]).length;i+=2) {const n=req.rawHeaders[i].toLowerCase();if(seen.has(n)) {send(400,unavailable);return;}seen.add(n);}
      const h=req.headers;
      if(Object.keys(h).some(n=>n==='forwarded'||n.startsWith('x-forwarded-')) ||
        h.host!==new URL(origin).host || !/^\/api\/n88\/(?:teacher\/(?:students|issue|revoke|publish)|s\/[A-Za-z0-9_-]{43}\/(?:claim|read|logout))$/.test(req.url||'') ||
        !['GET','POST'].includes(req.method) || (h['sec-fetch-site'] && h['sec-fetch-site']!=='same-origin')) {send(400,unavailable);return;}
      if(req.method==='POST' && (h.origin!==origin || h['content-type']!=='application/json' || h['x-n88-csrf']!=='1' || h['content-encoding'])) {send(401,unavailable);return;}
      if(h.cookie && (Buffer.byteLength(h.cookie)>4096 || (h.cookie.match(/(?:^|;\s*)__Secure-n88=/g)||[]).length>1)) {send(400,unavailable);return;}
      let size=0;const parts=[];
      if(h['content-length'] && (!/^\d+$/.test(h['content-length']) || Number(h['content-length'])>maxBodyBytes)) {send(413,unavailable);return;}
      for await(const part of req) {if(!live)return;size+=part.length;if(size>maxBodyBytes){send(413,unavailable);return;}parts.push(part);}
      if(!live)return;
      let body={};
      if(size) {try {body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}catch{send(400,unavailable);return;}}
      if(!body || Array.isArray(body) || typeof body!=='object' || (req.method==='GET' && size)) {send(400,unavailable);return;}
      const ingress=await trustedSocket(req.socket,abort.signal);
      if(!ingress?.clientKey){send(401,unavailable);return;}
      const r={path:req.url.slice('/api/n88'.length),method:req.method,headers:{origin:h.origin,'sec-fetch-site':h['sec-fetch-site'],
        'content-type':h['content-type'],'x-n88-csrf':h['x-n88-csrf'],cookie:h.cookie||''},body};
      // Auth sees only the bearer, never owner/class/body or unverified metadata.
      const auth=ports=>r.path.startsWith('/teacher/')?verifyTeacher(h.authorization,abort.signal,ports):null;
      if(!live)return;
      envelopes.set(r,{ingress,teacher:auth});
      try {const result=await service(r);send(result.status,result.body,result.headers);}finally{envelopes.delete(r);}
    };
    try {
      // Keep the concurrency slot until detached work actually settles. A timed
      // out upstream must not let unbounded replacement requests enter.
      const pending=work().finally(()=>{running--;});
      await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>{send(503,unavailable);abort.abort();req.destroy();resolve();},deadlineMs);})]);
    } catch {send(503,unavailable);}
    finally {clearTimeout(timer);abort.abort();}
  }
  return Object.freeze({handle,verifyIngress:ingress,verifyTeacher:teacher});
}
