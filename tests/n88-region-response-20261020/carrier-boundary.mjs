/** AI: intercepted real source and immutable live-carrier preimage; no network. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const base='10a98fcbec350030c5b72a1ea9132cab196a9ae2',dir=new URL('./',import.meta.url);
const git=p=>execFileSync('git',['show',p],{encoding:'utf8',maxBuffer:4*1024*1024});
const hash=s=>createHash('sha256').update(s).digest('hex');
const entry='drafts/n88-student-portal/cloudflare-entry.mjs';
const baselineSource=git(base+':'+entry),source=readFileSync(entry,'utf8');
const baselineCarrier=git(base+':tests/n88-region-placement-20261020/carrier.mjs');
assert.equal(hash(baselineCarrier),'3fbf524a87ac496fdebc9f74e2ab57ad810661d094d63a9c6148ae1c5d81fd3a');
const regions=['ap-northeast-1','ap-northeast-2','ap-south-1','ap-southeast-1','ap-southeast-2','ca-central-1','us-east-1','us-west-1','us-west-2','eu-central-1','eu-central-2','eu-west-1','eu-west-2','eu-west-3','sa-east-1'];
const additions=[
 ['    let stage = "configuration";','    let stage = "configuration", responseRegion = null;'],
 ['headers: { ...PRIVATE_WEB_HEADERS, "x-n88-transport-stage": stage }','headers: { ...PRIVATE_WEB_HEADERS, "x-n88-transport-stage": stage, ...(responseRegion ? { "x-n88-service-region": responseRegion } : {}) }'],
 ['      if (result.status >= 300 && result.status < 400)',`      const region = result.headers.get("x-sb-edge-region");\n      if (request.method === "POST" && url.pathname === "/api/n88/teacher/class/list" && ${JSON.stringify(regions)}.includes(region)) responseRegion = region;\n      if (result.status >= 300 && result.status < 400)`],
 ['      if (reply.cookie) out.set("set-cookie", reply.cookie);','      if (reply.cookie) out.set("set-cookie", reply.cookie);\n      if (responseRegion) out.set("x-n88-service-region", responseRegion);']
];
let carrier=baselineCarrier;
for(const [before,after] of additions){assert.equal(carrier.split(before).length,2);carrier=carrier.replace(before,after);}
let reversed=carrier;for(const [before,after] of [...additions].reverse())reversed=reversed.replace(after,before);
assert.equal(reversed,baselineCarrier);writeFileSync(new URL('carrier.mjs',dir),carrier);
const load=async text=>(await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).createCloudflareEntry;
const imports=text=>text.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(pathToFileURL(process.cwd()+'/drafts/n88-student-portal/'+p).href));
const pairs=[[await load(imports(baselineSource)),await load(imports(source))],[await load(baselineCarrier),await load(carrier)]];
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_EDGE_URL:'https://synthetic-provider.invalid/functions/v1/n88-student-portal',N88_INGRESS_KEY:'12'.repeat(32)};
const original=crypto.randomUUID;crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000001';
async function invoke(factory,{route='teacher/class/list',method='POST',region=null,status=200,innerStatus=200,malicious=true}={}){
 let sent;
 const entry=factory({now:()=>1760986800000,fetch:async(url,init)=>{sent={url,method:init.method,headers:Object.fromEntries(init.headers),body:init.body,redirect:init.redirect,cache:init.cache};return new Response(JSON.stringify({body:innerStatus===200?{ok:true}:{error:'unavailable',stage:'source'},cookie:null,status:innerStatus}),{status,headers:region===null?{}:{'x-sb-edge-region':region}});}});
 const headers={'cf-connecting-ip':'192.0.2.1',origin:env.N88_PUBLIC_ORIGIN,'content-type':'application/json',authorization:'Bearer synthetic'};
 if(malicious)Object.assign(headers,{'x-region':'eu-central-2','x-sb-edge-region':'us-west-1','x-n88-service-region':'us-east-1',forceFunctionRegion:'us-east-1'});
 const request=new Request(env.N88_PUBLIC_ORIGIN+'/api/n88/'+route,{method,headers,...(method==='POST'?{body:'{"forceFunctionRegion":"us-west-2","synthetic":true}'}:{})});
 Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
 const response=await entry(request,env);
 return {sent,status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
}
try{
 let comparisons=0;
 const routes=['teacher/class/list','teacher/class/issue-missing','teacher/class/rotate','teacher/class/revoke','teacher/class/visibility','teacher/class/guidance-list','teacher/class/guidance-save','student/claim','student/read','student/end'];
 for(const [before,after] of pairs){
  for(const region of [...regions,null,'unknown','AP-SOUTH-1','ap-south-1,us-east-1','POISON-PRIVATE-ID'])for(const innerStatus of [200,503]){
   const options={region,innerStatus},a=await invoke(before,options),b=await invoke(after,options);
   assert.equal(b.sent.headers['x-region'],'ap-south-1');
   assert.equal(b.headers['x-n88-service-region'],regions.includes(region)?region:undefined);
   const finite=b.headers['x-n88-service-region'];delete b.headers['x-n88-service-region'];assert.deepEqual(b,a);
   if(finite){assert.match(b.headers['cache-control'],/no-store/);assert.match(b.headers['cache-control'],/private/);}
   comparisons++;
  }
  for(const route of routes)for(const method of ['GET','POST']){
   const options={route,method,region:'ap-south-1'},a=await invoke(before,options),b=await invoke(after,options);
   if(route==='teacher/class/list'&&method==='POST')delete b.headers['x-n88-service-region'];
   assert.deepEqual(b,a);comparisons++;
  }
  assert.deepEqual(await invoke(after,{region:null,malicious:true}),await invoke(after,{region:null,malicious:false}));
  const a=await invoke(before,{status:503,region:'ap-south-1'}),b=await invoke(after,{status:503,region:'ap-south-1'});
  assert.equal(b.status,503);assert.equal(b.headers['x-n88-service-region'],'ap-south-1');delete b.headers['x-n88-service-region'];assert.deepEqual(b,a);
 }
 const report={status:'PASS',baseSha:base,preimage:'3fbf524a87ac496fdebc9f74e2ab57ad810661d094d63a9c6148ae1c5d81fd3a',carrier:hash(carrier),source:hash(source),comparisons,supportedRegions:regions.length,onlyListResponse:true,clientHeadersIgnored:true,invalidAndMissingUnknown:true,signedEnvelopeBodyUrlAndOtherRoutesUnchanged:true,privacyAndDeadlinesUnchanged:true,realNetworkCalls:0,providerOperations:0,actualExecutionRegion:'UNKNOWN'};
 writeFileSync(new URL('carrier-boundary.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{crypto.randomUUID=original;}
