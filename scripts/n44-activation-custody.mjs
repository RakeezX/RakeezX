/** AI: exact N44 custodian. No operation at import; no private values in CLI args/output. */
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,privateDecrypt,createPrivateKey,constants,pbkdf2Sync,createHmac,createHash,createECDH} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,unlink,readdir,rmdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';import path from 'node:path';
const project='xlrubcwjqktzzunrvuns',run='8288de34-7362-4946-b319-79a28e864be8';
// Current authorized continuation owns the phase lease; recovery remains bound to its original owner.
const operationRun='fdaa4ff1-9221-41b9-8661-8a57a9a6e986';
const taskId='continuous-n44-finish-bounded-service-activation-20261018';
const root=process.cwd(),base=path.resolve('drafts/n44-push/activation');
const phase='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-live/owned-'+run+'.tmp';
const marker={run,project,phase,purpose:'N44 exact restricted service custody'};
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const fail=code=>{throw Error(code);};
// Supavisor compatibility contract: current provisioning4096; historical16384 stays explicit.
export function deriveScram(password,salt=randomBytes(16),iterations=4096){
 const salted=pbkdf2Sync(password,salt,iterations,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest();
 try{return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${createHash('sha256').update(client).digest('base64')}:${createHmac('sha256',salted).update('Server Key').digest('base64')}`;}
 finally{salted.fill(0);client.fill(0);}
}
function dpapi(bytes,protect){
 const code=`Add-Type -AssemblyName System.Security; $n44Memory=New-Object System.IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($n44Memory); $n44Bytes=$n44Memory.ToArray(); $n44Protected=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($n44Bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Array]::Clear($n44Bytes,0,$n44Bytes.Length); [Console]::Write([Convert]::ToBase64String($n44Protected)); [Array]::Clear($n44Protected,0,$n44Protected.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 if(r.status!==0)fail('n44_dpapi_unavailable');
 const value=Buffer.from(r.stdout.toString().trim(),'base64');r.stdout.fill(0);r.stderr.fill(0);return value;
}
async function owned(){assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);}
async function load(){await owned();const b=dpapi(await readFile(path.join(phase,'recovery.dpapi')),false);try{return JSON.parse(b.toString());}finally{b.fill(0);}}
async function save(state){await owned();const b=Buffer.from(JSON.stringify(state));try{await writeFile(path.join(phase,'recovery.dpapi'),dpapi(b,true));}finally{b.fill(0);}}
async function official(args){
 const r=spawnSync(process.execPath,[cli,...args],{windowsHide:true,timeout:30000,maxBuffer:1048576});
 // Even failure diagnostics may contain provider SQL detail. Never emit them.
 const status=r.status,raw=r.stdout.toString();r.stdout.fill(0);r.stderr.fill(0);
 if(status!==0)fail('n44_official_cli_failed_'+(status??'timeout'));
 try{return JSON.parse(raw);}catch{try{return JSON.parse(raw.slice(raw.indexOf('{')));}catch{return {acknowledged:true};}}
}
async function sqlFile(text){
 await owned();const file=path.join(phase,'owned-input.sql');
 try{await writeFile(file,text,{flag:'wx'});return await official(['db','query','--linked','--project-ref',project,'--file',file,'--output','json']);}
 finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function lease(){
 const l=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/live-mutation.json','utf8'));
 if(l.taskId!==taskId||l.owner?.token!==operationRun||l.resource!=='live-mutation')fail('n44_live_phase_not_owned');
}
export async function execute(action,value){
 if(action==='--prepare-directory'){
  await mkdir(path.dirname(phase),{recursive:true});await mkdir(phase,{recursive:false});
  // Only this newly created directory; avoid the known PowerShell.Security module defect.
  const ps="$d=[Console]::In.ReadToEnd();$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetAccessRuleProtection($true,$false);$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$r=New-Object System.Security.AccessControl.FileSystemAccessRule($u,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r);[System.IO.Directory]::SetAccessControl($d,$a);$v=[System.IO.Directory]::GetAccessControl($d);$q=@($v.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]));if(-not $v.AreAccessRulesProtected -or $q.Count -ne 1 -or $q[0].IdentityReference -ne $u -or $q[0].FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl){throw 'fresh custody directory mismatch'}";
  const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:phase,windowsHide:true,timeout:10000});
  if(r.status!==0)fail('n44_fresh_directory_protection_failed');
  await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
  return {freshDirectoryProtected:true,phase,secretsGenerated:false};
 }
 if(action==='--local-file-proof'){
  await owned();const f=path.join(phase,'proof.tmp'),canary='FABRICATED_N44_OWNED_INPUT';
  try{await writeFile(f,'N44_PROOF='+JSON.stringify(canary)+'\n',{flag:'wx'});
   const r=spawnSync(process.execPath,['-e',"const f=require('fs').readFileSync(process.argv[1],'utf8');if(!f.startsWith('N44_PROOF='))process.exit(1);",f],{windowsHide:true,timeout:10000});
   if(r.status!==0)fail('n44_owned_input_proof_failed');
  }finally{await unlink(f);}
  return {protectedOwnedInputAndNonEchoingChild:true,ownedTransientRemoved:true};
 }
 if(action==='--empty-cleanup'){
  await owned();const files=await readdir(phase);if(files.length!==1||files[0]!=='owner.json')fail('n44_custody_not_empty');
  await unlink(path.join(phase,'owner.json'));await rmdir(phase);return {emptyOwnedDirectoryRemoved:true};
 }
 await lease();
 if(action==='--init'){
  await owned();try{await readFile(path.join(phase,'recovery.dpapi'));fail('n44_already_initialized');}catch(e){if(e.code!=='ENOENT')throw e;}
  const proof=JSON.parse(await readFile('tests/n44-finish-boundary.result.json','utf8'));
  if(proof.runId!==run||!proof.cleanup.postgresStopped||proof.checks.some(c=>c.status!=='PASS'))fail('n44_local_boundary_not_certified');
  const source=value;if(!/^[a-f0-9]{40}$/.test(source??''))fail('n44_source_missing');
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537});
  const der=privateKey.export({format:'der',type:'pkcs8'}),vapid=createECDH('prime256v1');vapid.generateKeys();
  const key=()=>randomBytes(32).toString('hex');
  const profile=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-session-policy-dashboard-readonly.json','utf8'));
  if(profile.normalized.singleSessionPerUser!==false||profile.normalized.timeboxSeconds!==null||profile.normalized.inactivityTimeoutSeconds!==null)fail('n44_profile_unsupported');
  const now=Date.now(),observedAt=Date.parse(profile.observations.observedAt);if(now-observedAt>86400000||now<observedAt)fail('n44_profile_stale');
  const policy={v:2,approvalState:'active',approvalId:key(),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:profile.metadataSha256,observedAt,activatedAt:now};
  try{await save({project,run,source,recipient:der.toString('base64'),password:key(),rate:key(),sealing:key(),endpoint:key(),binding:key(),vapidPrivate:vapid.getPrivateKey().toString('base64url'),vapidPublic:vapid.getPublicKey().toString('base64url'),policy,loginAttempted:false,loginVerified:false,installed:false});}finally{der.fill(0);}
  return {publicJwk:publicKey.export({format:'jwk'}),source,secretValuesReturned:false,protection:'DPAPI CurrentUser + own restricted directory'};
 }
 const state=await load();
 if(action==='--post-cache-session'||action==='--precise-session'){
  const precise=action==='--precise-session';
  const evidence=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-20261019-supabase28p01/n44-provider-cache-refreshed.json','utf8'));
  if(evidence.project!==project||evidence.role!=='n44_service_login'||evidence.eventId!=='390bbf31-fab1-42ae-afb0-1b212fc61889'||evidence.ownRoleFilteredCounts?.validation_cache_updated_events!==1)fail('n44_cache_evidence_missing');
  if(!state.disarmed||state.installed||state.loginVerified||!state.iterationCompatibilityRepaired||state.scramIterations!==4096||!state.iterationCorrectedAttempt||(precise?(!state.postCacheAttempted||state.preciseIdentityAttempted):state.postCacheAttempted))fail('n44_post_cache_state_mismatch');
  const disabled="rolname='n44_service_login' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)";
  const pre=await sqlFile(`select count(*)=1 as owned_disabled from pg_roles where ${disabled};`);
  if(pre.rows?.[0]?.owned_disabled!==true)fail('n44_post_cache_disarm_drift');
  if(precise)state.preciseIdentityAttempted=true;else state.postCacheAttempted=true;await save(state);
  try{
   await sqlFile(`begin;do $n44$ begin if (select count(*) from pg_roles where ${disabled})<>1 then raise exception 'n44_owned_state_changed';end if;alter role n44_service_login login;grant n44_backend to n44_service_login with inherit false,set true,admin false;end $n44$;commit;select true as restored;`);
   state.disarmed=false;await save(state);
   const proof=await execute('--check-session');
   return {...proof,postObservedCacheRefresh:true,attempts:1,verifierWrites:0};
  }catch(e){
   const disarm=await execute('--disarm-login');
   await writeFile(base+'/precise-session-disposition.json',JSON.stringify({projectId:project,runId:operationRun,recordedAt:new Date().toISOString(),preciseIdentityAttempts:1,verifierWrites:0,disarm,providerRuntimeEnabled:false,privateValuesReturned:false},null,2)+'\n');
   throw e;
  }
 }
 if(['--ingress','--scheduler'].includes(action)){
  const name=action.slice(2),worker='n44-notifications-'+name;if(state[name])fail('n44_key_already_bound');
  const der=Buffer.from(state.recipient,'base64');let plain;
  try{plain=privateDecrypt({key:createPrivateKey({key:der,format:'der',type:'pkcs8'}),oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(value,'base64'));
   const e=JSON.parse(plain.toString());if(e.project!==project||e.worker!==worker||!/^[a-f0-9]{64}$/.test(e.key))fail('n44_envelope_invalid');
   state[name]=e.key;if(state.ingress&&state.scheduler){if(state.ingress===state.scheduler)fail('n44_key_separation');delete state.recipient;}await save(state);
  }finally{der.fill(0);plain?.fill(0);}return {worker,ciphertextReceived:true,valuesReturned:false};
 }
 if(action==='--provision-login'){
  if(state.loginAttempted)fail('n44_login_attempt_consumed');
  const pre=await sqlFile("select rolname from pg_roles where rolname='n44_service_login';");if(pre.rows?.length!==0)fail('n44_login_collision');
  state.loginAttempted=true;await save(state);
  await sqlFile(`begin;create role n44_service_login login nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit password '${deriveScram(state.password)}';grant n44_backend to n44_service_login with inherit false,set true,admin false;commit;`);
  state.loginAcknowledged=true;await save(state);return {exactLoginCreated:true,valuesReturned:false};
 }
 if(action==='--check-session'){
  if(!state.loginAcknowledged)fail('n44_login_not_acknowledged');
  const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
  const ca=await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/supabase-prod-ca-2021.crt','utf8');
  if(createHash('sha256').update(ca).digest('hex')!=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7')fail('n44_ca_mismatch');
  const host='aws-0-ap-south-1.pooler.supabase.com',client=new Client({host,port:5432,user:'n44_service_login.'+project,password:state.password,database:'postgres',ssl:{ca,rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,statement_timeout:3000,query_timeout:4000,application_name:'n44-private-server'});
  let sessionStage='connect';try{await client.connect();sessionStage='identity';const before=(await client.query('select session_user as login,current_user as role,pg_backend_pid() as pid,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as upstream_ssl')).rows[0];
   // Fixed nonprivate checkpoint before enforcing the guard; no private runtime query.
   await writeFile(base+'/hosted-session-precise-identity.json',JSON.stringify({projectId:project,runId:operationRun,loginExact:before.login==='n44_service_login',roleExact:before.role==='n44_service_login',upstreamSsl:before.upstream_ssl===true,clientTlsAuthorized:client.connection.stream.authorized===true},null,2)+'\n');
   if(before.login!=='n44_service_login'||before.role!==before.login||!before.upstream_ssl||!client.connection.stream.authorized)fail('n44_tls_role_mismatch');
   sessionStage='set_role';await client.query('set role n44_backend');await client.query('begin');const after=(await client.query('select current_user as role,pg_backend_pid() as pid')).rows[0];await client.query('rollback');if(after.role!=='n44_backend'||after.pid!==before.pid)fail('n44_session_transport_mismatch');
   sessionStage='local_guard_bundle';const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
   const unused={name:'unused-packages',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js|@noble\/curves\/nist.js|web-push|ipaddr.js)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export const p256={};export class AuthClient {}',loader:'js'}));}};
   const bundle=await esbuild.build({stdin:{contents:"export {assertPrivateDatabaseSession} from './drafts/n44-push/existing-host.mjs';",resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,plugins:[unused],logLevel:'silent'});
   const {assertPrivateDatabaseSession}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));sessionStage='source_guard';await assertPrivateDatabaseSession(client);
   state.loginVerified=true;await save(state);return {restrictedLoginAndSetRole:true,sessionMode:true,tls:client.connection.stream.getProtocol(),hostnameVerified:true,upstreamSsl:true,actualSourcePrivacyBoundary:true};
  }catch(e){const safeCode=/^[A-Z0-9_]{3,60}$/.test(e.code??'')?e.code:'UNCLASSIFIED';await writeFile(base+'/hosted-session-precise-diagnostic.json',JSON.stringify({projectId:project,runId:operationRun,status:'FAIL',stage:sessionStage,code:safeCode,authenticationSucceeded:sessionStage!=='connect',privateDiagnosticsSuppressed:true},null,2)+'\n');if(/^n44_/.test(e.message))throw e;fail('n44_session_'+sessionStage+'_'+safeCode);}finally{await client.end().catch(()=>{});}
 }
 if(action==='--install-env'){
  if(!state.loginVerified||!state.ingress||!state.scheduler||state.installed)fail('n44_install_gate_missing');
  const pub=JSON.parse(await readFile(base+'/public-provider-config.json','utf8'));if(pub.project!==project||!pub.authPublicKey)fail('n44_public_config_missing');
  const crypto={activeKeyId:'v1',fingerprintKeyId:'v1',activeVapidKeyId:'v1',sealingKeys:[['v1',state.sealing]],endpointHmacKeys:[['v1',state.endpoint]],bindingHmacKeys:[['v1',state.binding]],vapidKeys:[['v1',{publicKey:state.vapidPublic,privateKey:state.vapidPrivate,subject:'https://rakeezx.com'}]]};
  const env={N44_ENABLED:'false',N44_DELIVERY_ENABLED:'false',N44_PUBLIC_ORIGIN:'https://rakeezx.com',N44_AUTH_URL:'https://'+project+'.supabase.co',N44_AUTH_API_KEY:pub.authPublicKey,N44_SERVICE_REVISION:'n44-browser-service-v2',N44_SERVICE_SOURCE_SHA:state.source,N44_SESSION_POLICY_JSON:JSON.stringify(state.policy),N44_DATABASE_URL:`postgresql://n44_service_login.${project}:${state.password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,N44_DATABASE_CA_CERT:await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/supabase-prod-ca-2021.crt','utf8'),N44_INGRESS_KEY:state.ingress,N44_SCHEDULER_KEY:state.scheduler,N44_RATE_KEY:state.rate,N44_CRYPTO_JSON:JSON.stringify(crypto),N44_PROVIDER_ORIGINS_JSON:JSON.stringify(['https://fcm.googleapis.com'])};
  const f=path.join(phase,'owned-env.tmp');try{await writeFile(f,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',f]);state.installed=true;await save(state);}finally{await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  state.envDigests=Object.fromEntries(Object.entries(env).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]));await save(state);
  return {installed:true,enabled:false,names:Object.keys(env),publicVapidKey:state.vapidPublic,policyApprovalId:state.policy.approvalId,source:state.source};
 }
 if(action==='--verify-env'){
  if(!state.installed||!state.envDigests)fail('n44_not_installed');
  const actual=await official(['secrets','list','--project-ref',project,'--output','json']);
  const rows=Array.isArray(actual)?actual:actual.rows;if(!Array.isArray(rows))fail('n44_secret_metadata_shape');
  for(const [name,digest]of Object.entries(state.envDigests))if(!rows.some(r=>r.name===name&&r.digest===digest))fail('n44_secret_digest_mismatch');
  return {namesAndDigestsMatched:Object.keys(state.envDigests).sort(),source:state.source,serviceEnabled:!!state.serviceEnabled,deliveryEnabled:false,policyApprovalId:state.policy.approvalId};
 }
 if(action==='--enable-service'){
  if(!state.installed||!state.loginVerified)fail('n44_service_enable_gate_missing');
  const proof=JSON.parse(await readFile(base+'/hosted-off-readback.json','utf8'));if(proof.source!==state.source||proof.status!=='PASS'||proof.deliveryEnabled!==false)fail('n44_off_readback_missing');
  await sqlEnv({N44_ENABLED:'true',N44_DELIVERY_ENABLED:'false'});state.envDigests.N44_ENABLED=createHash('sha256').update('true').digest('hex');state.serviceEnabled=true;await save(state);return {serviceEnabled:true,deliveryEnabled:false};
 }
 if(action==='--disable'){
  // Nonsecret fail-closed flags first; no table drop, policy change or send replay.
  await sqlEnv({N44_ENABLED:'false',N44_DELIVERY_ENABLED:'false'});
  if(state.loginAcknowledged)await sqlFile('alter role n44_service_login nologin;');
  state.serviceEnabled=false;state.disarmed=true;await save(state);return {edgeDisabled:true,deliveryDisabled:true,ownedLoginDisabled:!!state.loginAcknowledged};
 }
 if(action==='--disarm-login'){
  if(!state.loginAcknowledged||state.installed||state.serviceEnabled)fail('n44_login_disarm_scope_mismatch');
  await sqlFile('begin;alter role n44_service_login nologin;revoke n44_backend from n44_service_login;commit;');
  const r=await sqlFile("select rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,pg_has_role('n44_service_login','n44_backend','member') as backend_member from pg_roles where rolname='n44_service_login';");
  if(r.rows?.length!==1||Object.values(r.rows[0]).some(Boolean))fail('n44_login_disarm_readback_failed');
  state.disarmed=true;state.loginVerified=false;await save(state);
  return {ownedLoginDisabled:true,backendMembershipRevoked:true,restrictedFlagReadback:r.rows[0],encryptedRecoveryRetained:true,providerRuntimeEverEnabled:false};
 }
 fail('n44_unknown_action');
}
async function sqlEnv(env){const f=path.join(phase,'owned-flags.tmp');try{await writeFile(f,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',f]);}finally{await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log(JSON.stringify(await execute(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^n44_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n44_custody_failed_private_diagnostics_suppressed'}));process.exitCode=1;}}
