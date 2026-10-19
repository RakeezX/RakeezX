/** AI: actual original Edge entry/handler, signed readiness and unchanged guard. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHmac,createHash,randomUUID} from 'node:crypto';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const identities=JSON.parse(await readFile('drafts/n88-student-portal/activation/error-boundary-identities.json','utf8'));
let mode='ready',queries=0,closed=0,handler;
class Client{
 constructor(config){assert.equal(new URL(config.connectionString).hostname,'db.xlrubcwjqktzzunrvuns.supabase.co');assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.servername,'db.xlrubcwjqktzzunrvuns.supabase.co');this.connection={stream:{authorized:true}};}
 async connect(){}
 async end(){closed++;}
 async query(sql){queries++;
  if(sql.includes('session_user'))return {rows:[{login:'n88_backend',role:mode==='wrong_owner'?'postgres':'n88_backend',ssl:mode!=='upstream_false'}]};
  if(sql.includes('current_setting'))return {rows:[{role:'n88_backend',error_verbosity:'default',error_parameters:'0',statements:'ddl',duration:'-1',duration_sample:'-1',transaction_sample:'0',audit:null,explain_duration:null,explain_nested:null}]};
  if(sql.includes('pg_get_functiondef'))return {rows:mode==='missing_boundary'?[]:identities};
  throw Error('unexpected private query');
 }
}
globalThis.__n88Client=Client;
const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_AUTH_URL:'https://xlrubcwjqktzzunrvuns.supabase.co',N88_SERVICE_SOURCE_SHA:'1'.repeat(64),N88_HMAC_KEY:'a'.repeat(64),N88_DATABASE_URL:'postgresql://n88_backend:SYNTHETIC@db.xlrubcwjqktzzunrvuns.supabase.co:5432/postgres',N88_DATABASE_CA_CERT:await readFile('drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt','utf8')};
globalThis.Deno={env:{get:n=>env[n]},serve:f=>{handler=f;}};globalThis.addEventListener=()=>{};
const plugin={name:'synthetic-unused-transports',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},a=>({contents:a.path==='pg'?'export default {Client:globalThis.__n88Client};':'export class AuthClient {}',loader:'js'}));}};
const out=await esbuild.build({entryPoints:['supabase/functions/n88-student-portal/index.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});
await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].contents).toString('base64'));
const url=env.N88_AUTH_URL+'/functions/v1/n88-student-portal/readiness';
const request=()=>{
 const time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),body='{}';
 const sig=createHmac('sha256',Buffer.from(env.N88_HMAC_KEY,'hex')).update(JSON.stringify(['n88-readiness-v1',env.N88_AUTH_URL,new URL(url).pathname,time,nonce,createHash('sha256').update(body).digest('hex')])).digest('hex');
 return new Request(url,{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-signature':sig},body});
};
assert.equal((await handler(new Request(url,{method:'POST'}))).status,401);assert.equal(queries,0);
const signed=request();const replay=signed.clone();const response=await handler(signed);
assert.equal(response.status,200);assert.equal((await response.json()).sourceBoundary,true);assert.equal(queries,3);assert.equal(closed,1);
assert.equal((await handler(replay)).status,401);assert.equal(queries,3);
for(const m of ['upstream_false','wrong_owner','missing_boundary']){mode=m;const r=await handler(request());assert.equal(r.status,503);const body=await r.json();assert.equal(body.enabled,false);if(m==='upstream_false')assert.equal(body.upstreamSsl,false);}
assert.equal((await handler(new Request(env.N88_AUTH_URL+'/functions/v1/n88-student-portal/api/n88/student/read'))).status,503);
const receipt={status:'PASS',scope:'Actual Edge entry and signed readiness handler with synthetic PG metadata only',checks:['unsigned rejected before DB','signed metadata/fullTLS/source boundary ready','replay rejected','false upstreamSSL rejected with precise flags','wrong identity rejected','missing boundary rejected','normal Product entry remains OFF'],privateQueries:0,hostedProof:false};
await writeFile('tests/n88-official-activation-direct-readiness.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
