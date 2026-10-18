/** AI: bounded READ-ONLY diagnosis of this task's saved restricted login.
 * No connect(), DDL, credential rotation, other-role read, or raw verifier result.
 * Own recovery is decrypted only in process memory; output is fixed metadata.
 */
import {readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const runId='302c7ad5-8592-4800-b8d3-d724837eb913';
const custodyRun='8288de34-7362-4946-b319-79a28e864be8';
const project='xlrubcwjqktzzunrvuns',role='n44_service_login';
const phase='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-live/owned-'+custodyRun+'.tmp';
const base='drafts/n44-push/activation/';
const input=phase+'/diagnosis-'+runId+'.sql';
const report={aiAuthored:true,taskId:'continuous-n44-finish-bounded-service-activation-20261018',runId,recordedAt:new Date().toISOString(),authenticationAttempts:0,providerWrites:0,credentialChanges:0,rawPrivateValuesReturned:false};
const fail=code=>{throw Error(code);};
let plaintext;
try {
 const marker=JSON.parse(await readFile(phase+'/owner.json','utf8'));
 if(marker.run!==custodyRun||marker.project!==project||marker.phase!==phase||marker.purpose!=='N44 exact restricted service custody')fail('n44_diagnosis_owner_mismatch');
 const names=(await readdir(phase)).sort();if(JSON.stringify(names)!==JSON.stringify(['owner.json','recovery.dpapi']))fail('n44_diagnosis_unexpected_input');
 const ps="Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$c=$m.ToArray();$b=[System.Security.Cryptography.ProtectedData]::Unprotect($c,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($b));[Array]::Clear($b,0,$b.Length)";
 const decoded=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:await readFile(phase+'/recovery.dpapi'),windowsHide:true,timeout:15000,maxBuffer:262144});
 if(decoded.status!==0)fail('n44_diagnosis_dpapi_unavailable');
 plaintext=Buffer.from(decoded.stdout.toString().trim(),'base64');decoded.stdout.fill(0);decoded.stderr.fill(0);
 const state=JSON.parse(plaintext.toString());
 const host='aws-0-ap-south-1.pooler.supabase.com',user=role+'.'+project;
 const url=new URL(`postgresql://${user}:${state.password}@${host}:5432/postgres`);
 const serialized=JSON.stringify({N44_DATABASE_URL:url.href});
 const recoveredUrl=new URL(JSON.parse(serialized).N44_DATABASE_URL);
 const env=parseEnv('N44_DATABASE_URL='+JSON.stringify(url.href)+'\n');
 const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
 // Constructor only: no socket, DNS, TLS or authentication is performed.
 const native=new Client({host,port:5432,user,password:state.password,database:'postgres',ssl:{rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'}});
 const ca=await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/supabase-prod-ca-2021.crt');
 const local={
  exactSavedProjectAndRun:state.project===project&&state.run===custodyRun,
  passwordIsNonemptyAscii256BitHex:typeof state.password==='string'&&/^[a-f0-9]{64}$/.test(state.password),
  passwordHasNoWhitespaceOrNull:typeof state.password==='string'&&!/[\s\0]/.test(state.password),
  nativeUserExact:native.connectionParameters.user===user,
  nativeHostPortDatabaseExact:native.connectionParameters.host===host&&native.connectionParameters.port===5432&&native.connectionParameters.database==='postgres',
  nativePasswordUnchanged:native.connectionParameters.password===state.password,
  urlUserAndPasswordUnchanged:decodeURIComponent(url.username)===user&&decodeURIComponent(url.password)===state.password,
  jsonRoundtripUnchanged:decodeURIComponent(recoveredUrl.password)===state.password,
  standardEnvRoundtripUnchanged:decodeURIComponent(new URL(env.N44_DATABASE_URL).password)===state.password,
  strictTlsConfigured:native.ssl.rejectUnauthorized===true&&native.ssl.servername===host&&native.ssl.minVersion==='TLSv1.2',
  officialCaHashMatches:createHash('sha256').update(ca).digest('hex')==='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7',
  savedDisarmAndNoInstallation:state.loginAcknowledged===true&&state.disarmed===true&&state.loginVerified===false&&state.installed===false,
  noProviderSharedKeyHandoff:!state.ingress&&!state.scheduler
 };
 report.local=local;
 if(Object.values(local).some(v=>v!==true))fail('n44_diagnosis_local_mismatch');
 report.localScope='Own saved credential/native Client constructor/URL/JSON/Node standard env parser only. Original failed connection used native option fields directly, so URL/env serialization was not in that connect path. No actual provider env-parser or password-equality proof inferred.';
 report.scram='Original deriveScram source and actual local native-role authentication proof unchanged and reused; no generic SCRAM or42-routine suite rerun.';
 const capability=JSON.parse(await readFile(base+'login-diagnosis-capability.json','utf8'));
 if(capability.managementRole!=='postgres'||capability.ownVerifierNameRead!==true||capability.ownVerifierRead!==true)fail('n44_diagnosis_capability_unavailable');
 // This input contains NO original password, expected key or verifier literal.
 // The existing manager inspects only this exact own auth-store row internally;
 // the SELECT can return boolean format metadata only, never a row/value/salt.
 const sql=`begin read only;
with own as (select rolpassword from pg_catalog.pg_authid where rolname='n44_service_login')
select current_user='postgres' as expected_manager,
 (select count(*)=1 from own) as exact_own_role,
 (select rolpassword is not null from own) as verifier_present,
 (select split_part(rolpassword,'$',1)='SCRAM-SHA-256' from own) as scram_sha256,
 (select array_length(string_to_array(rolpassword,'$'),1)=3 from own) as three_sections,
 (select split_part(split_part(rolpassword,'$',2),':',1)='16384' from own) as expected_iterations,
 (select split_part(split_part(rolpassword,'$',2),':',2) ~ '^[A-Za-z0-9+/]{22}==$' from own) as salt16_base64_format,
 (select split_part(split_part(rolpassword,'$',3),':',1) ~ '^[A-Za-z0-9+/]{43}=$' from own) as stored_key32_base64_format,
 (select split_part(split_part(rolpassword,'$',3),':',2) ~ '^[A-Za-z0-9+/]{43}=$' from own) as server_key32_base64_format,
 (select rolpassword !~ '[[:space:]]' from own) as no_whitespace;
rollback;
`;
 try {
  await writeFile(input,sql,{flag:'wx'});
  const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
  const r=spawnSync(process.execPath,[cli,'db','query','--linked','--project-ref',project,'--file',input,'--output','json'],{windowsHide:true,timeout:30000,maxBuffer:1048576});
  const status=r.status,raw=r.stdout?.toString()??'';r.stdout?.fill(0);r.stderr?.fill(0);
  report.protectedCliExitCode=status;
  if(status!==0)fail('n44_diagnosis_protected_cli_failed');
  const parsed=JSON.parse(raw.slice(raw.indexOf('{'))),row=parsed.rows?.[0];
  const allowed=['expected_manager','exact_own_role','verifier_present','scram_sha256','three_sections','expected_iterations','salt16_base64_format','stored_key32_base64_format','server_key32_base64_format','no_whitespace'];
  if(parsed.rows?.length!==1||!row||Object.keys(row).sort().join(',')!==allowed.sort().join(',')||Object.values(row).some(v=>typeof v!=='boolean'))fail('n44_diagnosis_metadata_shape');
  report.ownStoredVerifierFormat=row;
 } finally {await unlink(input).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 report.verifierEquality='NOT_RUN: the original randomly salted verifier was not retained in recovery. Stored verifier/salt/keys were not exported; a valid stored format does not prove equality to the recovered credential.';
 report.identifiedOrdinaryCorrection=false;
 report.result='No matching source/serialization/configuration correction established. Keep owned LOGIN disabled and backend membership revoked; no corrected authentication attempt authorized on this evidence.';
 report.status='DIAGNOSIS_COMPLETE_READINESS_BLOCKED';
} catch(e) {
 report.status='FAIL';report.failure=/^n44_[a-z0-9_]+$/.test(e.message)?e.message:'n44_diagnosis_private_details_suppressed';process.exitCode=1;
} finally {
 plaintext?.fill(0);
 report.ownedDiagnosticInputAbsent=!(await readdir(phase)).some(n=>n.startsWith('diagnosis-'));
 await writeFile('tests/n44-finish-login-diagnosis.result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
