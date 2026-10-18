/** AI-authored. Explicit scoped custodian; no operation at import.
 * Raw keys/passwords stay in memory/DPAPI or protected transient CLI files.
 * CLI args/output never carry a password, verifier or secret value.
 */
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,privateDecrypt,createPrivateKey,constants,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,unlink,readdir,rmdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const project='xlrubcwjqktzzunrvuns',run='1b9971f9-e3ae-4e07-9d05-52923064dd91';
const root=process.cwd(),base=path.resolve('drafts/n88-student-portal/activation'),phase=path.join(base,'owned-custody-'+run+'.tmp');
const marker={run,project,phase,purpose:'N88 restricted service custody and immutable recovery'};
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const fail=code=>{throw Error(code);};
export function deriveScram(password,salt=randomBytes(16),iterations=16384){
 const salted=pbkdf2Sync(password,salt,iterations,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest();
 try{return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${createHash('sha256').update(client).digest('base64')}:${createHmac('sha256',salted).update('Server Key').digest('base64')}`;}
 finally{salted.fill(0);client.fill(0);}
}
function dpapi(bytes,protect){
 const code=`Add-Type -AssemblyName System.Security; $n88Memory=New-Object System.IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($n88Memory); $n88Bytes=$n88Memory.ToArray(); $n88Protected=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($n88Bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Array]::Clear($n88Bytes,0,$n88Bytes.Length); [Console]::Write([Convert]::ToBase64String($n88Protected)); [Array]::Clear($n88Protected,0,$n88Protected.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 if(r.status!==0)fail('n88_dpapi_unavailable');
 const value=Buffer.from(r.stdout.toString().trim(),'base64');r.stdout.fill(0);r.stderr.fill(0);return value;
}
async function owned(){assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);}
async function load(){await owned();const b=dpapi(await readFile(path.join(phase,'recovery.dpapi')),false);try{return JSON.parse(b.toString());}finally{b.fill(0);}}
async function save(state){await owned();const b=Buffer.from(JSON.stringify(state));try{await writeFile(path.join(phase,'recovery.dpapi'),dpapi(b,true));}finally{b.fill(0);}}
async function official(args){
 const r=spawnSync(process.execPath,[cli,...args],{windowsHide:true,timeout:30000,maxBuffer:1048576});
 // Even failure diagnostics may contain provider SQL detail. Never emit them.
 const status=r.status,raw=r.stdout.toString();r.stdout.fill(0);r.stderr.fill(0);
 if(status!==0)fail('n88_official_cli_failed_'+(status??'timeout'));
 try{return JSON.parse(raw);}catch{return null;}
}
async function sqlFile(text){
 await owned();const file=path.join(phase,'owned-input.sql');
 try{await writeFile(file,text,{flag:'wx'});return await official(['db','query','--linked','--project-ref',project,'--file',file,'--output','json']);}
 finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function execute(action,value){
 if(action==='--discard-empty-preparation'){
  // Only the exact fresh directory created by this run's failed module load;
  // no secrets/marker existed, and no recursive or process cleanup is used.
  const failure=JSON.parse(await readFile(path.join(base,'fresh-directory-initial-failure.json'),'utf8'));
  if(failure.runId!==run||failure.phase!==phase||failure.cause!=='PowerShell.Security module could not be loaded before Set-Acl execution')fail('n88_empty_preparation_ownership_missing');
  if((await readdir(phase)).length!==0)fail('n88_empty_preparation_not_empty');
  await rmdir(phase);return {emptyOwnedPreparationRemoved:true,recursiveDelete:false};
 }
 if(action==='--prepare-directory'){
  await mkdir(phase,{recursive:false});
  // Fresh directory only. No inherited/world access and no existing ACL edits.
  const ps=`$n88Dir=[Console]::In.ReadToEnd(); if(-not [System.IO.Directory]::Exists($n88Dir)){throw 'missing fresh directory'}; $n88Acl=New-Object System.Security.AccessControl.DirectorySecurity; $n88Acl.SetAccessRuleProtection($true,$false); $n88Identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $n88Rule=New-Object System.Security.AccessControl.FileSystemAccessRule($n88Identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $n88Acl.AddAccessRule($n88Rule); [System.IO.Directory]::SetAccessControl($n88Dir,$n88Acl); $n88Readback=[System.IO.Directory]::GetAccessControl($n88Dir); $n88Rules=@($n88Readback.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])); if(-not $n88Readback.AreAccessRulesProtected -or $n88Rules.Count -ne 1 -or $n88Rules[0].IdentityReference -ne $n88Identity -or $n88Rules[0].FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl){throw 'fresh directory custody readback mismatch'}`;
  const sealed=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:phase,windowsHide:true,timeout:10000});if(sealed.status!==0)fail('n88_fresh_secret_directory_protection_failed');
  await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
  return {phase,freshProtectedDirectoryPrepared:true,secretValuesGenerated:false};
 }
 if(action==='--init'){
  const proof=JSON.parse(await readFile(path.join(base,'hosted-boundary-readback.json'),'utf8'));
  if(proof.status!=='PASS'||proof.projectId!==project||proof.privateQueriesAllowed!==false)fail('n88_hosted_boundary_gate_missing');
  await owned();
  try{await readFile(path.join(phase,'recovery.dpapi'));fail('n88_custody_already_initialized');}catch(e){if(e.code!=='ENOENT')throw e;}
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537});
  const der=privateKey.export({format:'der',type:'pkcs8'});
  const state={project,run,recipient:der.toString('base64'),password:randomBytes(32).toString('hex'),hmac:randomBytes(32).toString('hex'),numeric:randomBytes(32).toString('hex'),reservation:randomBytes(32).toString('hex'),recovery:randomBytes(32).toString('hex'),recoveryVersion:'n88_'+Date.now(),loginAttempted:false,loginVerified:false,installed:false};
  try{await save(state);}finally{der.fill(0);}
  return {publicJwk:publicKey.export({format:'jwk'}),phase,protection:'DPAPI CurrentUser + fresh directory current-user ACL',secretValuesReturned:false};
 }
 const state=await load();
 if(action==='--ingress'){
  if(state.ingress)fail('n88_ingress_already_bound');
  const der=Buffer.from(state.recipient,'base64');let plain;
  try{const key=createPrivateKey({key:der,format:'der',type:'pkcs8'});plain=privateDecrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(value,'base64'));const envelope=JSON.parse(plain.toString());if(envelope.project!==project||envelope.worker!=='rakeez-n88-private-ingress'||!/^[a-f0-9]{64}$/.test(envelope.ingress))fail('n88_ingress_envelope_mismatch');state.ingress=envelope.ingress;delete state.recipient;await save(state);}
  finally{der.fill(0);plain?.fill(0);}return {ingressReceived:true,valuesReturned:false};
 }
 if(action==='--provision-login'){
  if(state.loginAttempted)fail('n88_login_attempt_already_consumed');
  const meta=await sqlFile("select rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname='n88_backend';");
  if(meta?.rows?.length!==1||Object.values(meta.rows[0]).some(Boolean))fail('n88_existing_role_not_fresh_restricted');
  state.loginAttempted=true;await save(state);
  await sqlFile(`alter role n88_backend login password '${deriveScram(state.password)}';`);
  state.loginAcknowledged=true;await save(state);return {loginAcknowledged:true,verifierValuesReturned:false};
 }
 if(action==='--check-session'){
  if(!state.loginAttempted)fail('n88_login_not_attempted');
  const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
  const ca=await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8');
  const client=new Client({host:'aws-0-ap-south-1.pooler.supabase.com',port:5432,user:'n88_backend.'+project,password:state.password,database:'postgres',ssl:{ca,rejectUnauthorized:true,servername:'aws-0-ap-south-1.pooler.supabase.com',minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,statement_timeout:3000,query_timeout:4000,application_name:'n88-private-server'});
  try{
   await client.connect();
   const session=(await client.query('select current_user as role,session_user as login,pg_backend_pid() as pid,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as upstream_ssl')).rows[0];
   if(session.role!=='n88_backend'||session.login!=='n88_backend'||!client.connection.stream.authorized||!session.upstream_ssl)fail('n88_restricted_tls_identity_failed');
   await client.query('begin');await client.query("set local search_path=pg_catalog");const current=(await client.query('select pg_backend_pid() as pid,current_user as role')).rows[0];await client.query('rollback');
   if(current.pid!==session.pid||current.role!==session.role)fail('n88_session_mode_identity_failed');
   // Exact actual source guard; only unused package imports are stubbed, not DB.
   const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
   const unused={name:'unused-packages',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export class AuthClient {}',loader:'js'}));}};
   const bundled=await esbuild.build({stdin:{contents:"export {assertPrivateDatabaseSession} from './drafts/n88-student-portal/existing-host.mjs';",resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,plugins:[unused],logLevel:'silent'});
   const {assertPrivateDatabaseSession}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
   await assertPrivateDatabaseSession(client);state.loginVerified=true;await save(state);
   return {restrictedRoleVerified:true,sessionModeVerified:true,frontendTls:client.connection.stream.getProtocol(),upstreamSsl:session.upstream_ssl,actualSourceBoundaryAndCaptureGuard:true};
  }finally{await client.end().catch(()=>{});}
 }
 if(action==='--install-env'){
  if(!state.loginVerified||!state.ingress||state.installed)fail('n88_install_gate_missing');
  const publicConfig=JSON.parse(await readFile(path.join(base,'public-provider-config.json'),'utf8'));
  if(publicConfig.project!==project||typeof publicConfig.authPublicKey!=='string')fail('n88_public_configuration_missing');
  const env={N88_ENABLED:'false',N88_PUBLIC_ORIGIN:'https://rakeezx.com',N88_AUTH_URL:'https://'+project+'.supabase.co',N88_AUTH_API_KEY:publicConfig.authPublicKey,N88_SERVICE_REVISION:'n88-integrated-class-v1',N88_DATABASE_URL:`postgresql://n88_backend.${project}:${state.password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,N88_DATABASE_CA_CERT:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8'),N88_HMAC_KEY:state.hmac,N88_NUMERIC_KEY:state.numeric,N88_RESERVATION_KEY:state.reservation,N88_INGRESS_KEY:state.ingress,N88_RECOVERY_ACTIVE_VERSION:state.recoveryVersion,N88_RECOVERY_VERSIONS:state.recoveryVersion,['N88_RECOVERY_KEY_'+state.recoveryVersion]:state.recovery};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.installed=true;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,names:Object.keys(env),recoveryVersion:state.recoveryVersion,backup:'CurrentUser DPAPI immutable version material retained in owned protected custody; no plaintext temporary input retained'};
 }
 fail('n88_unknown_custodian_action');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log(JSON.stringify(await execute(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_custodian_failed_private_diagnostics_suppressed'}));process.exitCode=1;}}
