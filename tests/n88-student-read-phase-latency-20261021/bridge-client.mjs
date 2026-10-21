/** AI: real Cloudflare/source and packaged boundaries, real client; no network. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createCloudflareEntry as canonical} from '../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {createCloudflareEntry as packaged} from '../../drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs';
import {READ_PHASE_NAMES,validateReadPhases} from '../../drafts/n88-student-portal/web-protocol.mjs';
import {createUnifiedStudentPortalClient,parseStudentReadPhases} from '../../src/lib/student-portal-unified-client.js';
const phases=Object.fromEntries(READ_PHASE_NAMES.map(k=>[k,250])),header='x-n88-student-read-phases',body={version:'n88-student-v3',profile:{name:'SYNTHETIC'}};
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_EDGE_URL:'https://native.synthetic.invalid/functions/v1/n88-student-portal',N88_INGRESS_KEY:'a'.repeat(64)};
const req=(path='/api/n88/student/read',method='GET')=>{const r=new Request(env.N88_PUBLIC_ORIGIN+path,{method,headers:{'cf-connecting-ip':'192.0.2.1'}});r.cf={tlsVersion:'TLSv1.3'};return r;};
const checks=[];
for(const [name,create]of [['canonical',canonical],['packaged',packaged]]){
 const send=async(reply,request=req())=>create({fetch:async()=>Response.json(reply,{headers:{[header]:'UNTRUSTED'}})})(request,env);
 const good=await send({status:200,body,cookie:null,readPhases:phases});assert.equal(good.status,200);assert.deepEqual(JSON.parse(good.headers.get(header)),phases);assert.match(good.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await good.json(),body);
 for(const status of [400,401,409,413,429,503]){
  const base=await send({status,body:{error:'unavailable'},cookie:null});
  const extra=await send({status,body:{error:'unavailable'},cookie:null,readPhases:{private:'NEVER_COPY'}});
  assert.equal(extra.status,base.status);assert.deepEqual([...extra.headers],[...base.headers]);assert.equal(await extra.text(),await base.text());assert.equal(extra.headers.get(header),null);
 }
 for(const invalid of [null,[],{},Object.values(phases),{...phases,total:-250},{...phases,total:20001},{...phases,total:1},{...phases,total:'250'},{...phases,id:'never'},Object.fromEntries(Object.entries(phases).slice(1))]){
  assert(!validateReadPhases(invalid));assert.equal(parseStudentReadPhases(JSON.stringify(invalid)),null);
  assert.equal((await send({status:200,body,cookie:null,readPhases:invalid})).status,503);
 }
 const unknown=await send({status:200,body,cookie:null,readPhases:phases,secret:'never'});assert.equal(unknown.status,503);
 const legacy=await send({status:200,body,cookie:null});assert.equal(legacy.status,200);assert.equal(legacy.headers.get(header),null);
 const wrongRoute=await send({status:200,body:{ended:true},cookie:null,readPhases:phases},req('/api/n88/student/end','POST'));assert.equal(wrongRoute.headers.get(header),null);
 checks.push(name+': typed exact allowlist, no-store, uniform denials, unknown fields, legacy and route isolation');
}
const queue=[],client=createUnifiedStudentPortalClient({fetch:()=>new Promise(resolve=>queue.push(resolve))});
const respond=(i,status=200,p=phases,b=body)=>queue[i](Response.json(b,{status,headers:{[header]:JSON.stringify(p)}}));
const first=client.read({phase:'return'});assert.equal(client.getDiagnostic(),null);respond(0);await first;assert.deepEqual(client.getDiagnostic().readPhases,phases);
const second=client.read();assert.equal(client.getDiagnostic(),null);client.invalidate('hidden');respond(1);await assert.rejects(second);assert.equal(client.getDiagnostic()?.readPhases,undefined);
const older=client.read().catch(e=>e.kind),newer=client.read();respond(2,200,{...phases,total:500});respond(3);assert.equal(await older,'stale');await newer;assert.deepEqual(client.getDiagnostic().readPhases,phases);
const denied=client.read();respond(4,401);await assert.rejects(denied);assert.equal(client.getDiagnostic().readPhases,undefined);
const malformed=client.read();respond(5,200,phases,{version:'invalid'});await assert.rejects(malformed);assert.equal(client.getDiagnostic().readPhases,undefined);
const noValue=client.read();queue[6](Response.json(body));await noValue;assert.equal(client.getDiagnostic().readPhases,undefined);
const end=client.end();respond(7,200,phases,{ended:true});await end;assert.equal(client.getDiagnostic().readPhases,undefined);client.dispose();
checks.push('client: completed successful current GET only; later in-flight, hidden, superseded, denied, malformed, absent, End excluded');
await writeFile('tests/n88-student-read-phase-latency-20261021/bridge-client.json',JSON.stringify({taskId:'continuous-n88-student-read-phase-latency-20261021',runId:'2c1fb6b8-d4ce-428a-8539-65e83d5a6a86',status:'PASS',checks,providerOperations:0},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks}));
