/** AI: affected original Worker fetch compatibility and no-redirect disclosure. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createCloudflareEntry} from '../drafts/n88-student-portal/cloudflare-entry.mjs';
const request=()=>{const r=new Request('https://rakeezx.com/api/n88/teacher/class/list',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1','content-type':'application/json',origin:'https://rakeezx.com','x-n88-csrf':'1'},body:'{}'});r.cf={tlsVersion:'TLSv1.3'};return r;};
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://rakeezx.com',N88_EDGE_URL:'https://xlrubcwjqktzzunrvuns.supabase.co/functions/v1/n88-student-portal',N88_INGRESS_KEY:'a'.repeat(64)};
let calls=0;
for(const status of [200,302]){
 const handle=createCloudflareEntry({fetch:async(url,init)=>{calls++;assert.equal(url,env.N88_EDGE_URL+'/dispatch');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');return status===302?new Response(null,{status,headers:{location:'https://synthetic-untrusted.invalid'}}):Response.json({status:401,body:{error:'unavailable'},cookie:null});}});
 assert.equal((await handle(request(),env)).status,401);
}
assert.equal(calls,2);
const failed=await createCloudflareEntry({fetch:async()=>{throw Error('PRIVATE_CANARY');}})(request(),env);
assert.equal(failed.status,503);assert.equal(failed.headers.get('x-n88-transport-stage'),'upstream');assert.equal(await failed.text(),'{"error":"unavailable"}');
const result={status:'PASS',checks:['Workers supported manual redirect mode','3xx rejected without following Location or forwarding envelope','upstream generic denial preserved','only fixed transport-stage diagnostic, no private error'],primaryDocumentation:'https://developers.cloudflare.com/workers/runtime-apis/request/',hostedProof:false};await writeFile('tests/n88-official-activation-pilot-transport.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
