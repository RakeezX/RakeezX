/** AI: intercepted real carrier boundary; synthetic inputs, no network/credentials. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const base='e225cb07e54ae6175ac7f641ad4027de1d330c07';
const liveCandidate='9c658ade13bddc0289f3e2cf3a7769533280c2ae';
const dir=new URL('./',import.meta.url);
const hash=s=>createHash('sha256').update(s).digest('hex');
const git=p=>execFileSync('git',['show',p],{encoding:'utf8',maxBuffer:4*1024*1024});
const entry='drafts/n88-student-portal/cloudflare-entry.mjs';
const old=git(base+':'+entry),current=readFileSync(entry,'utf8');
const addition="      // Trusted placement is carrier-owned, outside the unchanged signed envelope.\n      if(request.method==='POST'&&url.pathname==='/api/n88/teacher/class/list')wire.set('x-region','ap-south-1');\n";
assert.equal(current.replaceAll('\r\n','\n').replace(addition,''),old.replaceAll('\r\n','\n'));
const baselineBundle=git(liveCandidate+':drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs');
assert.equal(hash(baselineBundle),'dc067be3b58d437d050ca57d2a3634f41f6b1c96d20cfe1114b8e3e988288088');
const anchor='      const wire = new Headers({ "content-type": "application/json" });';
assert.equal(baselineBundle.split(anchor).length,2);
const compiledAddition='\n      if (request.method === "POST" && url.pathname === "/api/n88/teacher/class/list") wire.set("x-region", "ap-south-1");';
const carrier=baselineBundle.replace(anchor,anchor+compiledAddition);
assert.equal(carrier.replace(compiledAddition,''),baselineBundle);
writeFileSync(new URL('carrier.mjs',dir),carrier);
const load=async s=>(await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'))).createCloudflareEntry;
const resolveImports=s=>s.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(pathToFileURL(process.cwd()+'/drafts/n88-student-portal/'+p).href));
const factories=[await load(resolveImports(old)),await load(resolveImports(current)),await load(baselineBundle),await load(carrier)];
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_EDGE_URL:'https://synthetic-provider.invalid/functions/v1/n88-student-portal',N88_INGRESS_KEY:'12'.repeat(32)};
const originalRandom=crypto.randomUUID;
crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000001';
const run=async(factory,path,method,malicious=false)=>{
 let sent=null;
 const handler=factory({now:()=>1760986800000,fetch:async(url,options)=>{
   sent={url,method:options.method,headers:Object.fromEntries(options.headers),body:options.body,redirect:options.redirect,cache:options.cache};
   return new Response(JSON.stringify({body:{ok:true},cookie:null,status:200}));
 }});
 const headers={'cf-connecting-ip':'192.0.2.1',origin:env.N88_PUBLIC_ORIGIN,'content-type':'application/json',authorization:'Bearer synthetic'};
 if(malicious)Object.assign(headers,{'x-region':'eu-central-2',forceFunctionRegion:'us-east-1','x-forwarded-for':'192.0.2.2'});
 const request=new Request(env.N88_PUBLIC_ORIGIN+path,{method,headers,...(method==='POST'?{body:'{"synthetic":true,"forceFunctionRegion":"eu-central-2","x-region":"us-east-1"}'}:{})});
 Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
 const response=await handler(request,env);
 return {sent,status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
};
try{
 const paths=['teacher/class/list','teacher/class/issue-missing','teacher/class/rotate','teacher/class/revoke','teacher/class/visibility','teacher/class/guidance-list','teacher/class/guidance-save','student/claim','student/read','student/end'];
 let comparisons=0;
 for(const path of paths)for(const method of ['GET','POST']){
  const route='/api/n88/'+path;
  for(const [before,after] of [[factories[0],factories[1]],[factories[2],factories[3]]]){
   const a=await run(before,route,method,true),b=await run(after,route,method,true);
   assert.ok(a.sent&&b.sent);
   if(method==='POST'&&path==='teacher/class/list'){
    assert.equal(b.sent.headers['x-region'],'ap-south-1');
    delete b.sent.headers['x-region'];
   }
   assert.deepEqual(b,a);comparisons++;
  }
 }
 for(const factory of [factories[1],factories[3]]){
  assert.deepEqual(await run(factory,'/api/n88/teacher/class/list','POST',true),await run(factory,'/api/n88/teacher/class/list','POST',false));
  const denied=await run(factory,'/api/n88/teacher/class/list?forceFunctionRegion=us-east-1','POST',true);
  assert.equal(denied.status,401);assert.equal(denied.sent,null);
 }
 const proof={status:'PASS',baseSha:base,liveCarrierBasis:liveCandidate,priorCarrier:hash(baselineBundle),carrier:hash(carrier),source:hash(current),comparisons,
  trustedRegion:'ap-south-1',onlyRoute:'POST /api/n88/teacher/class/list',clientOverrideRejected:true,queryOverrideDenied:true,signedEnvelopeBodyUrlAndMetadataIdentical:true,
  unrelatedRoutesIdentical:true,liveCarrierByteDeltaOnlyFixedHeader:true,deadlinesAndPrivateAssetBytesUnchanged:true,networkCalls:0,realCredentials:0,
  limitation:'Synthetic intercepted transport proves placement boundary, not actual execution region or hosted causation.'};
 writeFileSync(new URL('local-boundary.json',dir),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{crypto.randomUUID=originalRandom;}
