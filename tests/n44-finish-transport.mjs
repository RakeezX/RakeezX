/** AI: narrowly exercises the actual ingress and packaged handler; no live credentials. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCloudflareEntry} from '../drafts/n44-push/cloudflare-entry.mjs';
import {FORWARDED,sha,mac,signingText,PRIVATE_WEB_HEADERS} from '../drafts/n44-push/web-protocol.mjs';
const origin='https://synthetic.invalid',edge='https://edge.synthetic.invalid/functions/v1/n44-notifications';
const env={N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:edge,N44_INGRESS_KEY:'ab'.repeat(32)};
const now=1792389600000,body='{}';
function request({path='/context/read',headers={},method='POST',cf={tlsVersion:'TLSv1.3'},data=body}={}){
 const r=new Request(origin+'/api/n44'+path,{method,headers:{origin,authorization:'Bearer FABRICATED_UNAUTHORIZED','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.1',...headers},...(method==='POST'?{body:data}:{})});
 Object.defineProperty(r,'cf',{value:cf});return r;
}
async function privateReply(r,status){assert.equal(r.status,status);assert.deepEqual(await r.json(),{error:'unavailable'});for(const [k,v]of Object.entries(PRIVATE_WEB_HEADERS))assert.equal(r.headers.get(k),v);assert.equal(r.headers.has('location'),false);}
const checks=[];
for(const [name,factory]of [['source',createCloudflareEntry],['bundle',(await import('../drafts/n44-push/activation/bundle/cloudflare/worker.mjs')).createCloudflareEntry]]){
 let calls=0;
 const handler=factory({now:()=>now,fetch:async(url,init)=>{
  calls++;assert.equal(url,edge+'/dispatch');assert.equal(init.redirect,'manual');assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');
  const h=new Headers(init.headers),e=JSON.parse(init.body),forwarded=new Headers(FORWARDED.map((n,i)=>[n,e.headers[i]]));
  assert.equal(e.path,'/api/n44/context/read');assert.equal(e.method,'POST');assert.equal(atob(e.body),body);
  assert.equal(h.has('authorization'),false);assert.equal(h.has('cookie'),false);
  const key=Uint8Array.from(env.N44_INGRESS_KEY.match(/../g),x=>parseInt(x,16));
  assert.equal(h.get('x-n44-source'),await mac(key,JSON.stringify(['source-v1','192.0.2.1'])));
  assert.equal(h.get('x-n44-signature'),await mac(key,signingText({origin,path:e.path,method:e.method,headers:forwarded,bodyHash:await sha(new TextEncoder().encode(body)),time:h.get('x-n44-time'),nonce:h.get('x-n44-nonce'),source:h.get('x-n44-source')})));
  return new Response('upstream private details',{status:401});
 }});
 await privateReply(await handler(request(),env),401);assert.equal(calls,1);
 checks.push({name:name+'_manual_forward_and_hmac',status:'PASS',evidence:'Actual handler invoked fixed dispatch once with manual redirect, original body-only bearer and valid source/body HMAC; upstream401 sanitized.'});
 for(const status of [300,301,302,303,304,307,308,399]){
  let attempted=0,cancelled=false;
  const h=factory({fetch:async()=>{attempted++;return {status,ok:false,body:new ReadableStream({pull(){throw Error('redirect body must not be read');},cancel(){cancelled=true;}}),headers:new Headers({location:'https://redirect.synthetic.invalid/private'})};}});
  await privateReply(await h(request(),env),503);assert.equal(attempted,1);assert.equal(cancelled,true);
 }
 const stalledCancel=factory({fetch:async()=>({status:302,body:{cancel:()=>new Promise(()=>{})}})});
 let deadline;try{const denied=await Promise.race([stalledCancel(request(),env),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('redirect cancel stalled private response')),500);})]);await privateReply(denied,503);}finally{clearTimeout(deadline);}
 checks.push({name:name+'_explicit_redirect_rejection',status:'PASS',evidence:'300/301/302/303/304/307/308/399 rejected503 without following, reading or exposing redirect body/location. Stalled body cancellation cannot delay rejection.'});
 let unexpected=0;const guarded=factory({fetch:async()=>{unexpected++;throw Error('guard must prevent forwarding');}});
 for(const patch of [{path:'/status'},{method:'GET'},{headers:{'cf-worker':'synthetic.invalid'}},{headers:{'cf-connecting-ip':''}},{headers:{'cf-connecting-ip':'999.0.2.1'}},{cf:null},{cf:{tlsVersion:'TLSv1.1'}},{path:'/context/read?query=1'}])await privateReply(await guarded(request(patch),env),401);
 await privateReply(await guarded(request(),{...env,N44_ENABLED:'false'}),503);
 await privateReply(await guarded(request(),{...env,N44_EDGE_URL:'http://edge.synthetic.invalid/functions/v1/n44-notifications'}),401);
 await privateReply(await guarded(request({data:'x'.repeat(12289)}),env),503);assert.equal(unexpected,0);
 for(const [status,expected]of [[401,401],[429,429],[500,503]])await privateReply(await factory({fetch:async()=>new Response('private upstream details',{status})})(request(),env),expected);
 await privateReply(await factory({fetch:async()=>new Response('x'.repeat(2*1024*1024+1))})(request(),env),503);
 const success=await factory({fetch:async()=>Response.json({status:200,body:{status:'absent'}})})(request(),env);
 assert.equal(success.status,200);assert.deepEqual(await success.json(),{status:'absent'});
 checks.push({name:name+'_existing_guards_private_body_bounds',status:'PASS',evidence:'Unchanged disabled/method/route/query/provider TLS/worker-IP/upstream HTTPS/body guards reject before fetch; oversized upstream body fails closed.'});
}
const hash=b=>createHash('sha256').update(b).digest('hex');
await writeFile('tests/n44-finish-transport.local.json',JSON.stringify({aiAuthored:true,taskId:'continuous-n44-cloudflare-redirect-transport-fix-20261019',runId:'9485ed5a-6fed-4e65-a831-343a6bd11186',recordedAt:new Date().toISOString(),checks,sourceSha256:hash((await readFile('drafts/n44-push/cloudflare-entry.mjs','utf8')).replaceAll('\r\n','\n')),bundleSha256:hash(await readFile('drafts/n44-push/activation/bundle/cloudflare/worker.mjs')),localForwardAttempted:true,rejectsRedirects:true,statusPathForwards:false,networkCalls:0},null,2)+'\n');
console.log('N44 transport: '+checks.length+' affected source/bundle checks PASS; /status rejects before forwarding.');
