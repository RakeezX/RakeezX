/** AI: affected direct transport and authenticated metadata handler, entirely synthetic. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {databaseConfig,assertRestrictedIdentity} from '../drafts/n44-push/database-transport.mjs';
import {mac,sha} from '../drafts/n44-push/web-protocol.mjs';
const ca=await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/supabase-prod-ca-2021.crt','utf8');
const report={aiAuthored:true,runId:'fdaa4ff1-9221-41b9-8661-8a57a9a6e986',recordedAt:new Date().toISOString(),scope:'Synthetic actual transport module and readiness handler only; no hosted DB or UI proof',checks:{}};
try{
 const password=randomBytes(32).toString('hex'),key=randomBytes(32),base='https://xlrubcwjqktzzunrvuns.supabase.co';
 const env={N44_DATABASE_URL:`postgresql://n44_service_login:${password}@db.xlrubcwjqktzzunrvuns.supabase.co:5432/postgres`,N44_DATABASE_CA_CERT:ca,N44_AUTH_URL:base,N44_INGRESS_KEY:key.toString('hex'),N44_READINESS_ENABLED:'true'};
 const config=databaseConfig(n=>env[n]);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.servername,'db.xlrubcwjqktzzunrvuns.supabase.co');
 for(const url of [env.N44_DATABASE_URL.replace(':5432',':6543'),env.N44_DATABASE_URL.replace('db.xlrubcwjqktzzunrvuns.supabase.co','other.example'),env.N44_DATABASE_URL+'?sslmode=no-verify'])assert.throws(()=>databaseConfig(n=>n==='N44_DATABASE_URL'?url:env[n]));
 assert.throws(()=>databaseConfig(n=>n==='N44_DATABASE_CA_CERT'?'untrusted':env[n]));report.checks.exactDirectHostPortRoleCaAndStrictTls=true;
 const row={login:'n44_service_login',role:'n44_service_login',ssl:true};
 const mock=(r=row,authorized=true)=>({query:async()=>({rows:[r]}),connection:{stream:{authorized}}});
 await assertRestrictedIdentity(mock());
 for(const client of [mock({...row,ssl:false}),mock({...row,login:'other'}),mock({...row,role:'other'}),mock(row,false)])await assert.rejects(()=>assertRestrictedIdentity(client));
 report.checks.poolerUpstreamFalseAndWrongIdentityRemainRejected=true;
 const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 const plugins=[{name:'unused-packages',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js|@noble\/curves\/nist.js|web-push|ipaddr.js)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export const p256={};export class AuthClient {}',loader:'js'}));}}];
 const bundle=await esbuild.build({stdin:{contents:"export {readinessEntry} from './drafts/n44-push/readiness-entry.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,plugins,logLevel:'silent'});
 const {readinessEntry}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
 let checks=0;const check=async()=>{checks++;return {status:'ready',enabled:false,deliveryEnabled:false};};
 const request=async(sigOverride,body='{}')=>{const time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),path='/functions/v1/n44-notifications/readiness';const sig=await mac(key,JSON.stringify(['n44-readiness-v1',base,path,time,nonce,await sha(new TextEncoder().encode(body))]));return new Request(base+path,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-signature':sigOverride??sig},body});};
 assert.equal((await readinessEntry(await request('0'.repeat(64)),n=>env[n],check)).status,401);assert.equal(checks,0);
 const valid=await request();assert.equal((await readinessEntry(valid.clone(),n=>env[n],check)).status,200);assert.equal(checks,1);assert.equal((await readinessEntry(valid,n=>env[n],check)).status,401);assert.equal(checks,1);
 assert.notEqual((await readinessEntry(await request(undefined,'{}'.repeat(3)),n=>env[n],check)).status,200);assert.equal(checks,1);
 report.checks.wrongAuthReplayAndOversizeRejectedBeforeDatabase=true;
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.code==='ERR_ASSERTION'?'n44_direct_readiness_assertion':'n44_direct_readiness_private_details_suppressed';report.location=e.stack?.split('\n').find(l=>l.includes('.mjs:'));process.exitCode=1;}
finally{report.sources={};for(const f of ['drafts/n44-push/database-transport.mjs','drafts/n44-push/readiness-entry.mjs'])report.sources[f]=createHash('sha256').update((await readFile(f,'utf8')).replaceAll('\r\n','\n')).digest('hex');await writeFile('tests/n44-finish-direct-readiness.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
