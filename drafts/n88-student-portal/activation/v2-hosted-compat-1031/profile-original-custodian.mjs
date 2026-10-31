/** AI: NEW read-only profile operation in the ORIGINAL protected custody.
 * No activation/reconcile, environment fallback, private export or custody write. */
import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';import {readFile,writeFile,lstat} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {databaseConfig,assertRestrictedTransport} from '../database-transport.mjs';
import {createInheritedVerifier} from '../read-service-20261023/inherited-custody.mjs';
import {qualifyOriginalRuntimeState} from '../denied-read-20261023/runtime-expectations.mjs';
import {safeLoggingProfile} from './boundary.mjs';import {verifyCombined} from './bind.mjs';
export const taskId='continuous-n88-hosted-runtime-compatibility-20261031',runId='269dc6b9-d3e1-4f2c-a5d3-14e741b2a92a',sessionId='01a14fc3-b292-7390-9952-8549a286c80f';
const savedCandidate='e2c8ba5b07b2f0dc5feed907d846e4de60708cd6',baseSha='5e5c19be4779eadb555dc9641f6ae1f91e029cd9';
const original='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',canonical='C:/Users/Abody/Projects/RakeezX';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),runtime=canonical+'/artifacts/ops-supervisor-v4',taskFile=runtime+'/queue/'+taskId+'.json';
const phase=path.join(original,'drafts/n88-student-portal/activation/owned-custody-4ddd5df2-933f-4754-8d04-0d27be47bcff.tmp');
const output=new URL('actual-restricted-profile-session.json',import.meta.url),same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const deny=c=>{throw Error('n88_profile_'+c);};
const json=async f=>JSON.parse((await readFile(f,'utf8')).replace(/^\uFEFF/,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
export const settingNames=Object.freeze(['log_error_verbosity','log_statement','log_parameter_max_length_on_error','log_min_error_statement','log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate','pgaudit.log','auto_explain.log_min_duration','auto_explain.log_parameter_max_length','statement_timeout','lock_timeout']);
export const settingsSql='select name,setting,unit from pg_settings where name=any($1::text[]) order by name';
export const identitySql="select session_user='n88_backend' as session_exact,current_user='n88_backend' as current_exact,r.rolcanlogin as login,r.rolsuper as superuser,r.rolbypassrls as bypass,r.rolcreatedb as create_db,r.rolcreaterole as create_role,r.rolinherit as inherit from pg_roles r where rolname=current_user";
export function qualifyInvocation(card,checkpoint,lease){
 if(card.status!=='running'||card.id!==taskId||card.attempt?.runId!==runId||card.sessionId!==sessionId||card.model!=='gpt-6.1-sol'||card.effort!=='medium'||!same(card.worktreePath,root)||card.baseSha!==baseSha||card.preparationAuthority?.originalPrivateCustodianOnly!==sessionId||!same(card.preparationAuthority?.originalCustodianRoot??'',original))deny('current_card');
 if(checkpoint.taskId!==taskId||checkpoint.runId!==runId||checkpoint.sessionId!==sessionId||!Number.isInteger(checkpoint.runnerPid)||!Number.isFinite(Date.parse(checkpoint.runnerCreatedAt)))deny('checkpoint');
 if(lease.resource!=='integration'||lease.taskId!==taskId||lease.activationId!==card.activationId||lease.owner?.type!=='worker'||lease.owner.token!==runId||lease.owner.pid!==checkpoint.runnerPid||Date.parse(lease.owner.createdAt)!==Date.parse(checkpoint.runnerCreatedAt))deny('phase_owner');
 return true;
}
export function finiteSettings(rows){
 if(!Array.isArray(rows)||rows.length>settingNames.length)deny('metadata_shape');const seen=new Set();
 return rows.map(r=>{if(!settingNames.includes(r.name)||seen.has(r.name)||!['ms','s','min','B','kB',null].includes(r.unit))deny('metadata_shape');seen.add(r.name);
  const enums={log_error_verbosity:['terse','default','verbose'],log_statement:['none','ddl','mod','all'],log_min_error_statement:['debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic']};
  const valid=enums[r.name]?enums[r.name].includes(r.setting):r.name==='pgaudit.log'?typeof r.setting==='string'&&r.setting.length<=100&&r.setting.split(',').every(v=>['none','all','read','write','function','role','ddl','misc','misc_set'].includes(v.trim())):typeof r.setting==='string'&&/^-?\d+(?:\.\d+)?$/.test(r.setting)&&r.setting.length<=24;
  if(!valid)deny('metadata_value');return {name:r.name,setting:r.setting,unit:r.unit};});
}
export function compareProfile(settings){
 const get=n=>settings.find(r=>r.name===n),v=n=>get(n)?.setting??null;
 const t=get('statement_timeout');
 return safeLoggingProfile({verbosity:v('log_error_verbosity'),parameters:v('log_parameter_max_length_on_error'),statements:v('log_statement'),duration:v('log_min_duration_statement'),sample:v('log_min_duration_sample'),sampling:v('log_transaction_sample_rate'),audit:v('pgaudit.log'),explain:v('auto_explain.log_min_duration'),statement_timeout:t?String(t.setting)+(t.unit??''):null});
}
// Only fixed public codes are exported. Never inspect or retain raw messages,
// stacks, query text, DSNs, addresses, certificates or arbitrary error properties.
const networkCodes=new Set(['ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','ECONNREFUSED','ECONNRESET','ECONNABORTED','ETIMEDOUT','EPIPE','ENOTCONN','EADDRNOTAVAIL']);
const tlsCodes=new Set(['ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_NOT_YET_VALID','ERR_SSL_WRONG_VERSION_NUMBER','ERR_TLS_HANDSHAKE_TIMEOUT','ERR_SSL_TLSV1_ALERT_ACCESS_DENIED','ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE']);
const sqlClasses=new Set(['00','01','02','03','08','09','0A','0B','0F','0L','0P','0Z','20','21','22','23','24','25','26','27','28','2B','2D','2F','34','38','39','3B','3D','3F','40','42','44','53','54','55','57','58','72','F0','HV','P0','XX']);
const ownCodes=new Set(['current_card','checkpoint','phase_owner','metadata_shape','metadata_value','owner_file','owner_changed','dpapi_refused','original_cwd','guard_source_changed','recovery_file','recovery_changed','credential_shape','identity_shape','restricted_role','effective_logging_mismatch','step_shape'].map(c=>'n88_profile_'+c));
const inheritedCodes=new Set(['descriptor','access','identity_changed','reparse','access_denied','security_denied','path_too_long','read_api_failed','metadata_shape','parent_scope','ancestor_reparse','ancestor_scope','ancestor_changed','child_scope'].map(c=>'n88_inherited_custody_'+c));
export function classifyProfileError(e){
 const code=typeof e?.code==='string'?e.code:null;
 if(networkCodes.has(code))return {category:'network',code};
 if(tlsCodes.has(code))return {category:'tls',code};
 if(['ENOENT','EACCES','EPERM'].includes(code))return {category:'filesystem',code};
 if(code&&/^[A-Z0-9]{5}$/.test(code)&&sqlClasses.has(code.slice(0,2)))return {category:'postgres',code};
 if(e?.message==='n88_runtime_expected_provenance'||ownCodes.has(e?.message)||inheritedCodes.has(e?.message))return {category:'guard',code:e.message};
 if(Array.isArray(e?.errors)&&e.errors.length>0&&e.errors.length<=4){const parts=e.errors.map(child=>classifyProfileError({code:child?.code}));if(parts.every(p=>p.category==='network'||p.category==='tls'))return {category:parts.every(p=>p.category===parts[0].category)?parts[0].category:'transport',code:'AGGREGATE',codes:[...new Set(parts.map(p=>p.code))].sort()};}
 return {category:'unknown',code:'UNCLASSIFIED'};
}
const stepKinds=Object.freeze({restricted_connect:'connect',transaction_begin:'transaction',transport_metadata:'metadata',identity_metadata:'metadata',settings_metadata:'metadata',transaction_rollback:'transaction',cleanup_rollback:'cleanup'});
export async function dispatchProfileStep(record,stage,action){
 const kind=stepKinds[stage];if(!kind||typeof action!=='function')deny('step_shape');record.stage=stage;
 record.attempts??={connect:0,transaction:0,metadata:0,cleanup:0};record.successes??={connect:0,transaction:0,metadata:0,cleanup:0};
 record.attempts[kind]++;if(kind==='connect')record.connections++;else record.sqlAttempts++;
 const result=await action();record.successes[kind]++;record.queries=record.successes.metadata;return result;
}
/** Consume only eligible original state; no configuration/client capability here. */
export function consumeProfileCredential(plain){
 let state;
 try{
  state=JSON.parse(plain.toString('utf8'));
  qualifyOriginalRuntimeState(state);
  const password=state.password;if(typeof password!=='string'||!password)deny('credential_shape');
  return password;
 }finally{plain.fill(0);if(state&&typeof state==='object'){for(const k of Object.keys(state))state[k]=null;}state=null;}
}
const lease=action=>execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{windowsHide:true,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();
const fileIdentity=s=>[s.dev,s.ino,s.birthtimeNs,s.size,s.mtimeNs].join(':');
async function owned(){
 const f=path.join(phase,'owner.json'),before=await lstat(f,{bigint:true});if(!before.isFile()||before.isSymbolicLink())deny('owner_file');
 assert.deepEqual(await json(f),{run:'4ddd5df2-933f-4754-8d04-0d27be47bcff',project:'xlrubcwjqktzzunrvuns',phase,purpose:'N88 restricted service custody and immutable recovery'});
 if(fileIdentity(before)!==fileIdentity(await lstat(f,{bigint:true})))deny('owner_changed');
}
function unprotect(bytes){
 // Same published original CurrentUser DPAPI mechanism; all output stays in memory.
 const script=`Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$b=$m.ToArray();$v=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Array]::Clear($b,0,$b.Length);[Console]::Write([Convert]::ToBase64String($v));[Array]::Clear($v,0,$v.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 try{if(r.status!==0)deny('dpapi_refused');return Buffer.from(r.stdout.toString().trim(),'base64');}finally{r.stdout?.fill(0);r.stderr?.fill(0);}
}
export async function observeOriginalProfile(){
 const record={taskId,runId,sessionId,savedCandidate,baseSha,startedAt:new Date().toISOString(),status:'NOT_RUN',stage:'invocation',transportRoute:'approved-session-pooler',connections:0,sqlAttempts:0,queries:0,attempts:{connect:0,transaction:0,metadata:0,cleanup:0},successes:{connect:0,transaction:0,metadata:0,cleanup:0},mutations:0,privateValuesExported:false,custodyWrites:0,hostedInstall:'NOT_RUN',serviceJourney:'NOT_RUN',enabled:false};
 let client,config,password,state,cipher,plain,leased=false,begun=false;
 try{
  if(!same(process.cwd(),original))deny('original_cwd');
  const card=await json(taskFile),checkpoint=await json(card.attempt?.checkpointPath??'');
  if(card.id!==taskId||card.attempt?.runId!==runId||card.sessionId!==sessionId)deny('current_card');
  await verifyCombined();
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  git(['merge-base','--is-ancestor',savedCandidate,'HEAD']);
  const inherited='drafts/n88-student-portal/activation/read-service-20261023/inherited-custody.mjs';
  const source=(await readFile(path.join(root,inherited),'utf8')).replaceAll('\r\n','\n');if(source!==git(['show',savedCandidate+':'+inherited]).replaceAll('\r\n','\n'))deny('guard_source_changed');record.guardSourceSha256=sha(source);
  record.leaseAcquire=lease('acquire');leased=true;
  const verifyPhase=async()=>{const current=await json(taskFile),cp=await json(current.attempt.checkpointPath);qualifyInvocation(current,cp,await json(runtime+'/leases/integration.json'));};await verifyPhase();
  record.stage='custody_guard';const verifyIsolation=await createInheritedVerifier({phase,originalRoot:original,owned});record.custody=await verifyIsolation();
  await verifyPhase();await verifyIsolation();
  record.stage='protected_read';const file=path.join(phase,'recovery.dpapi'),before=await lstat(file,{bigint:true});if(!before.isFile()||before.isSymbolicLink())deny('recovery_file');
  cipher=await readFile(file);if(fileIdentity(before)!==fileIdentity(await lstat(file,{bigint:true})))deny('recovery_changed');
  plain=unprotect(cipher);cipher.fill(0);cipher=null;
  password=consumeProfileCredential(plain);plain=null;
  await verifyIsolation();await verifyPhase();
  const ca=await readFile(new URL('../ca/supabase-prod-ca-2021.crt',import.meta.url),'utf8');
  config=databaseConfig(n=>n==='N88_DATABASE_URL'?`postgresql://n88_backend.xlrubcwjqktzzunrvuns:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`:n==='N88_DATABASE_CA_CERT'?ca:undefined);
  password=null;
  const {Client}=createRequire(import.meta.url)(canonical+'/artifacts/n77-native-pg17/client/node_modules/pg');
  client=new Client(config);client.on('error',()=>{});config.connectionString='';config=null;
  await dispatchProfileStep(record,'restricted_connect',()=>client.connect());
  await dispatchProfileStep(record,'transaction_begin',()=>client.query('begin read only'));begun=true;
  record.transport=await assertRestrictedTransport({connection:client.connection,query:(sql,args)=>dispatchProfileStep(record,'transport_metadata',()=>client.query(sql,args))});
  const rows=(await dispatchProfileStep(record,'identity_metadata',()=>client.query(identitySql))).rows;
  if(rows.length!==1||Object.values(rows[0]).some(v=>typeof v!=='boolean'))deny('identity_shape');record.identity=rows[0];
  if(!rows[0].session_exact||!rows[0].current_exact||!rows[0].login||rows[0].superuser||rows[0].bypass||rows[0].create_db||rows[0].create_role)deny('restricted_role');
  record.settings=finiteSettings((await dispatchProfileStep(record,'settings_metadata',()=>client.query(settingsSql,[settingNames]))).rows);
  record.supportsCorrectedProfile=compareProfile(record.settings);record.missingSettings=settingNames.filter(n=>!record.settings.some(r=>r.name===n));
  await dispatchProfileStep(record,'transaction_rollback',()=>client.query('rollback'));begun=false;record.status=record.supportsCorrectedProfile?'PASS':'FAIL';record.stage='complete';
  if(!record.supportsCorrectedProfile)record.refusal='n88_profile_effective_logging_mismatch';
 }catch(e){record.status='FAIL';record.failure=classifyProfileError(e);record.refusal=record.failure.category==='unknown'?'n88_profile_operation_refused':record.failure.category+'_'+record.failure.code;}
 finally{
  cipher?.fill(0);plain?.fill(0);if(state){for(const k of Object.keys(state))state[k]=null;}state=null;password=null;if(config){config.connectionString='';config.password='';}config=null;
  if(client){if(begun){const priorStage=record.stage;try{await dispatchProfileStep(record,'cleanup_rollback',()=>client.query('rollback'));}catch(e){record.cleanupFailure=classifyProfileError(e);}finally{record.stage=priorStage;}}await client.end().catch(()=>{});if(client.connectionParameters)client.connectionParameters.password='';client.password='';}client=null;record.connectionClosed=true;
  if(leased){try{record.leaseRelease=lease('release');}catch{record.status='FAIL';record.cleanupRefusal='n88_profile_lease_release';}}
  record.finishedAt=new Date().toISOString();
 }
 await writeFile(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});return record;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){if(process.argv[2]!=='--observe'||process.argv[3])throw Error('n88_profile_explicit_operation_required');const r=await observeOriginalProfile();console.log(JSON.stringify(r));if(r.status!=='PASS')process.exitCode=1;}
