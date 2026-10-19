/** AI: actual original Edge entry OFF -> pilot -> OFF cache regression. No network/DB. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
let handler,acquires=0;
globalThis.__pilotPool=class{on(){}async end(){}async connect(){acquires++;throw Error('unsigned must not acquire');}};
const env={N88_ENABLED:'false',N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify({ownerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',classId:'class',teachingId:'teaching',studentIds:['one','two']}),N88_PUBLIC_ORIGIN:'https://rakeezx.com',N88_AUTH_URL:'https://xlrubcwjqktzzunrvuns.supabase.co',N88_DATABASE_URL:'postgresql://n88_backend:SYNTHETIC@db.xlrubcwjqktzzunrvuns.supabase.co:5432/postgres',N88_DATABASE_CA_CERT:await readFile('drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt','utf8'),N88_SERVICE_REVISION:'n88-integrated-class-v1',N88_AUTH_API_KEY:'SYNTHETIC',N88_HMAC_KEY:'a'.repeat(64),N88_INGRESS_KEY:'b'.repeat(64),N88_NUMERIC_KEY:'c'.repeat(64),N88_RESERVATION_KEY:'d'.repeat(64),N88_RECOVERY_ACTIVE_VERSION:'v1',N88_RECOVERY_VERSIONS:'v1',N88_RECOVERY_KEY_v1:'e'.repeat(64)};
globalThis.Deno={env:{get:n=>env[n]},serve:f=>handler=f};globalThis.addEventListener=()=>{};
const plugin={name:'synthetic-unused-transports',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},a=>({contents:a.path==='pg'?'export default {Pool:globalThis.__pilotPool};':'export class AuthClient {}',loader:'js'}));}};
const built=await esbuild.build({entryPoints:['supabase/functions/n88-student-portal/index.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const request=()=>new Request(env.N88_AUTH_URL+'/functions/v1/n88-student-portal/dispatch',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal((await handler(request())).status,503);env.N88_ENABLED='true';assert.equal((await handler(request())).status,401);
env.N88_ENABLED='false';assert.equal((await handler(request())).status,503);env.N88_ENABLED='true';env.N88_ROLLOUT_MODE='unknown';assert.equal((await handler(request())).status,503);
env.N88_ROLLOUT_MODE='pilot';env.N88_PILOT_BINDING='{';assert.equal((await handler(request())).status,503);assert.equal(acquires,0);
const result={status:'PASS',checks:['actual Edge entry does not cache early OFF host','enabled configured pilot reaches signed-transport rejection','OFF/unknown/malformed closes cached service','unsigned requests never acquire private DB'],hostedProof:false};await writeFile('tests/n88-official-activation-pilot-entry.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
