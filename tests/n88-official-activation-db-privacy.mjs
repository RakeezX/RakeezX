/** AI: actual source session guard branches, no server/secrets/hosted writes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
// The narrow metadata guard has no package dependency. Remove unused external
// package side effects only; exercise the actual exported source function.
const unused={name:'unused-packages-only',setup(build){build.onResolve({filter:/^(pg|@supabase\/auth-js)$/},args=>({path:args.path,namespace:'unused',sideEffects:false}));build.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {}; export class AuthClient {}',loader:'js'}));}};
const result=await esbuild.build({stdin:{contents:"export {assertPrivateDatabaseSession} from './drafts/n88-student-portal/existing-host.mjs';",resolveDir:process.cwd(),sourcefile:'privacy-guard-entry.mjs'},bundle:true,format:'esm',platform:'node',write:false,plugins:[unused],logLevel:'silent'});
const {assertPrivateDatabaseSession:guard}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const safe={role:'n88_backend',error_verbosity:'terse',error_parameters:'0',statements:'ddl',duration:'-1',duration_sample:'-1',transaction_sample:'0',audit:'none',explain_duration:'10000',explain_nested:'off'};
const identities=JSON.parse(await readFile('drafts/n88-student-portal/activation/error-boundary-identities.json','utf8'));
let checks=0;
async function exercise(row,pass,boundary=identities){let queries=0;const client={query:async sql=>{queries++;assert.ok(sql.startsWith('select current_user as role')||sql.startsWith('select p.proname'));assert.ok(!/\b(?:alter|set|update|insert|delete)\b/i.test(sql));return {rows:sql.startsWith('select p.proname')?boundary:row==null?[]:[row]};}};if(pass)await guard(client);else await assert.rejects(guard(client),{message:'n88_database_unavailable'});assert.ok(queries>=1&&queries<=2);checks++;}
await exercise(safe,true);await exercise({...safe,statements:'none',audit:null,explain_duration:null,explain_nested:null},true);
await exercise({...safe,error_verbosity:'default'},true);
await exercise({...safe,error_verbosity:'default'},false,[]);
await exercise(safe,false,identities.map((i,n)=>n?i:{...i,definer:true}));
for(const patch of [{role:'postgres'},{role:'service_role'},{error_verbosity:'verbose'},{error_parameters:'-1'},{statements:'mod'},{statements:'all'},{duration:'10000'},{duration_sample:'0'},{transaction_sample:'0.01'},{transaction_sample:null},{audit:'all'},{explain_duration:'3000'},{explain_duration:'0'},{explain_duration:'10000',explain_nested:'on'},{explain_duration:'unknown'}])await exercise({...safe,...patch},false);
await exercise(null,false);
const meta=JSON.parse(await readFile('drafts/n88-student-portal/activation/provider-privacy-readback.json','utf8'));
const actual=meta.database.settings;
await exercise({...safe,error_verbosity:actual.log_error_verbosity,error_parameters:actual.log_parameter_max_length_on_error,statements:actual.log_statement,duration:actual.log_min_duration_statement,duration_sample:actual.log_min_duration_sample,transaction_sample:actual.log_transaction_sample_rate,audit:actual['pgaudit.log'],explain_duration:actual['auto_explain.log_min_duration'],explain_nested:actual['auto_explain.log_nested_statements']},true);
await assert.rejects(guard({query:async()=>{throw Error('synthetic metadata failure');}}));
// Actual gateway -> Web entry -> service -> repository -> bound Pool acquisition.
// Only DB transport/Auth provider packages are fabricated; no replacement service.
const transport={name:'fabricated-transport-only',setup(build){
 build.onResolve({filter:/^(pg|@supabase\/auth-js)$/},args=>({path:args.path,namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='pg'?`export default {Pool:class {on(){} async connect(){return globalThis.__n88PrivacyFixture.connect();} async end(){}}};`:'export class AuthClient {}',loader:'js'}));
}};
const bound=await esbuild.build({stdin:{contents:"export {createExistingHost} from './drafts/n88-student-portal/existing-host.mjs'; export {createCloudflareEntry} from './drafts/n88-student-portal/cloudflare-entry.mjs';",resolveDir:process.cwd(),sourcefile:'bound-privacy-entry.mjs'},bundle:true,format:'esm',platform:'node',write:false,plugins:[transport],logLevel:'silent'});
const {createExistingHost,createCloudflareEntry}=await import('data:text/javascript;base64,'+Buffer.from(bound.outputFiles[0].contents).toString('base64'));
let connects=0,releases=0;const queries=[];
globalThis.__n88PrivacyFixture={connect(){connects++;return {query:async sql=>{queries.push(sql);return {rows:[{...safe,error_verbosity:'default'}]};},release:e=>{assert.equal(e.message,'n88_database_unavailable');releases++;}};}};
const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_AUTH_URL:'https://auth.synthetic.invalid',N88_DATABASE_URL:'postgresql://n88_backend:FABRICATED_PASSWORD@db.synthetic.invalid/postgres',N88_SERVICE_REVISION:'n88-integrated-class-v1',N88_AUTH_API_KEY:'FABRICATED_PUBLIC_KEY',N88_HMAC_KEY:'1'.repeat(64),N88_INGRESS_KEY:'2'.repeat(64),N88_NUMERIC_KEY:'3'.repeat(64),N88_RESERVATION_KEY:'4'.repeat(64),N88_RECOVERY_ACTIVE_VERSION:'probe_v1',N88_RECOVERY_VERSIONS:'probe_v1',N88_RECOVERY_KEY_probe_v1:'5'.repeat(64)};
let host;
try{
 host=createExistingHost(name=>env[name]);
 const gateway=createCloudflareEntry({fetch:(url,init)=>host.handle(new Request(url,init))});
 const request=new Request('https://synthetic.invalid/api/n88/student/claim',{method:'POST',headers:{origin:'https://synthetic.invalid','content-type':'application/json','cf-connecting-ip':'192.0.2.88','x-n88-csrf':'1','sec-fetch-site':'same-origin'},body:JSON.stringify({code:'1'+'2'.repeat(5)})});
 Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
 const response=await gateway(request,{...env,N88_EDGE_URL:'https://auth.synthetic.invalid/functions/v1/n88-student-portal'});
 assert.equal(connects,1,'bound pool must be reached');assert.equal(releases,1);assert.equal(queries.length,2);assert.ok(queries[0].startsWith('select current_user as role'));assert.equal(response.status,401);
 assert.ok(!queries.some(sql=>sql.includes('from n88_private.')||sql.includes('from rakeezx.')));
 assert.ok(!(await response.text()).includes('default'));
}finally{await host?.close();delete globalThis.__n88PrivacyFixture;}
const out={aiAuthored:true,taskId:'continuous-n88-official-student-portal-activation-20261018',runId:'6085920e-db53-474e-9ba9-d2e1efa73012',at:new Date().toISOString(),checks:[
 {name:'actual_source_private_session_guard',status:'PASS',evidence:`Actual source guard exercised in ${checks} metadata cases. Observed default/ddl/error-parameter0 is accepted only with all exact boundary identities/ACL verified. Missing/modified boundary, unknown capture posture, owner/admin, unsafe parameter/statement/duration/audit/explain settings rejected. Read-only metadata only; no logging change.`},
 {name:'actual_bound_service_acquire_failure',status:'PASS',evidence:'Actual signed gateway -> Web/service/repository -> bound Pool acquisition returns generic401 and destroys client when observed default posture has no matching boundary. Exactly two metadata queries, zero private/canonical operations. Only DB/Auth transport packages fabricated; no live credentials/network.'}],hostedWrites:0,fullHostedServicePass:false};
await writeFile('tests/n88-official-activation-db-privacy.json',JSON.stringify(out,null,2)+'\n');console.log('N88 affected capture/boundary guard PASS; hosted activation not asserted');
