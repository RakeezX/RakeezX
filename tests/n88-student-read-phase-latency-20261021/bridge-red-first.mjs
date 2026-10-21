/** AI: actual receipt-bound Cloudflare handler, synthetic upstream envelopes only.
 * Explicit expected RED: characterize the missing bridge, not a rendered UI PASS.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='tests/n88-student-read-phase-latency-20261021/';
const file='tests/n88-student-quiet-fast-return-20261021/carrier.mjs';
const source=await readFile(file,'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(await readFile('tests/n88-student-quiet-fast-return-20261021/static-delivery.json','utf8'));
const bundle=JSON.parse(await readFile('tests/n88-student-quiet-fast-return-20261021/bundle-preparation.json','utf8'));
assert.equal(receipt.status,'PASS');assert.equal(receipt.sourceExact,true);assert.equal(sha(source),bundle.carrierSha256);
const {createCloudflareEntry}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_EDGE_URL:'https://synthetic-service.invalid/functions/v1/n88-student-portal',N88_INGRESS_KEY:'a'.repeat(64)};
const request=()=>{const r=new Request(env.N88_PUBLIC_ORIGIN+'/api/n88/student/read',{headers:{'cf-connecting-ip':'192.0.2.1'}});r.cf={tlsVersion:'TLSv1.3'};return r;};
const ordinary={status:200,body:{version:'n88-student-v3'},cookie:null};
const safeFiniteValue={pool:250,boundary:250,snapshot:250,sync:250,projection:250,guidance:250,commit:250,total:1750};
const header='x-n88-student-read-phases';
async function send(reply,headers={}){const h=createCloudflareEntry({fetch:async()=>Response.json(reply,{headers})});return h(request(),env);}
const control=await send(ordinary);assert.equal(control.status,200);assert.equal(control.headers.get(header),null);
const serviceOnly=await send(ordinary,{[header]:JSON.stringify(safeFiniteValue)});assert.equal(serviceOnly.status,200);assert.equal(serviceOnly.headers.get(header),null);
const extended=await send({...ordinary,phaseTiming:safeFiniteValue});assert.equal(extended.status,503);assert.equal(extended.headers.get('x-n88-transport-stage'),'reply-shape');assert.equal(extended.headers.get(header),null);assert.match(extended.headers.get('cache-control'),/no-store/);
const denied=await send({status:401,body:{error:'unavailable'},cookie:null});assert.equal(denied.status,401);assert.equal(denied.headers.get(header),null);
const report={taskId:'continuous-n88-student-read-phase-latency-20261021',runId:'5f1e5bac-172f-4c84-a95e-81370ee532dd',characterization:'PASS',diagnosticAcceptance:'FAIL',expectedRed:true,carrier:{path:file,sha256:sha(source),receipt:'tests/n88-student-quiet-fast-return-20261021/static-delivery.json',receiptSha256:sha(await readFile('tests/n88-student-quiet-fast-return-20261021/static-delivery.json'))},ordinarySuccessfulEnvelope:200,serviceOnlyHeader:'DROPPED',finiteExtendedEnvelope:{status:extended.status,stage:extended.headers.get('x-n88-transport-stage')},deniedHeaderAbsent:true,missingAllowedPath:'drafts/n88-student-portal/cloudflare-entry.mjs',reason:'Strict production-carrier reply shape admits only body,cookie,status. Its canonical Cloudflare source is absent from the activated allowedPaths. Do not patch a generated bundle as a source-scope bypass.',renderedUi:'NOT_RUN: characterization only; no frontend source change',providerOperations:0};
await writeFile(dir+'bridge-red-first.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
