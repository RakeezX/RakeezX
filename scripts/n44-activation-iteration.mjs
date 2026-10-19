/** AI: exact owned Supavisor iteration diagnosis, conditional same-password/salt repair, ONE corrected auth. */
import {readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {serverFirst} from './n44-activation-server-first.mjs';
import {challengeSql} from './n44-activation-equality.mjs';
import {deriveScram,execute} from './n44-activation-custody.mjs';
const runId='3edbd211-f3f1-4698-b39c-eaf346722eb5',custodyRun='8288de34-7362-4946-b319-79a28e864be8',project='xlrubcwjqktzzunrvuns',taskId='continuous-n44-finish-bounded-service-activation-20261018';
const phase='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-live/owned-'+custodyRun+'.tmp',input=phase+'/iteration-'+runId+'.sql';
const reportFile='tests/n44-finish-iteration.hosted.json';
const report={aiAuthored:true,taskId,runId,projectId:project,recordedAt:new Date().toISOString(),authenticationAttempts:0,diagnosticProofSent:false,verifierWrites:0,secretValuesReturned:false};
const fail=code=>{throw Error(code);};
let state,plain,challenge,leaseOwned=false,restored=false,successful=false;
async function receipt(){await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
function dpapi(bytes,protect){
 const ps=`Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$c=$m.ToArray();$b=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($c,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($b));[Array]::Clear($b,0,$b.Length);[Array]::Clear($c,0,$c.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 try{if(r.status!==0)fail('n44_iteration_dpapi_failed');return Buffer.from(r.stdout.toString().trim(),'base64');}finally{r.stdout?.fill(0);r.stderr?.fill(0);}
}
async function save(){const b=Buffer.from(JSON.stringify(state));try{await writeFile(phase+'/recovery.dpapi',dpapi(b,true));}finally{b.fill(0);}}
function lease(action){
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','live-mutation','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{windowsHide:true,timeout:20000,maxBuffer:1048576});
 if(r.status!==0)fail('n44_iteration_lease_failed');return r.stdout.toString().trim();
}
async function sql(text){
 try{await writeFile(input,text,{flag:'wx'});
  const r=spawnSync(process.execPath,['C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js','db','query','--linked','--project-ref',project,'--file',input,'--output','json'],{windowsHide:true,timeout:30000,maxBuffer:1048576});
  try{if(r.status!==0)fail('n44_iteration_protected_cli_failed');const raw=r.stdout.toString();return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
  finally{r.stdout?.fill(0);r.stderr?.fill(0);}
 }finally{await unlink(input).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
const disabled=`rolname='n44_service_login' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)`;
async function restore(){
 restored=true; // Unknown mutation outcome must still enter the owned fail-closed disarm.
 await sql(`begin;do $n44$ begin if (select count(*) from pg_roles where ${disabled})<>1 then raise exception 'n44_owned_state_changed';end if;alter role n44_service_login login;grant n44_backend to n44_service_login with inherit false,set true,admin false;end $n44$;commit;select true as restored;`);
 state.disarmed=false;await save();
}
async function disarm(){
 await sql('begin;alter role n44_service_login nologin;revoke n44_backend from n44_service_login;commit;select true as disarmed;');
 const rows=await sql(`select count(*)=1 as disabled from pg_roles where ${disabled};`);
 if(rows?.[0]?.disabled!==true)fail('n44_iteration_disarm_readback_failed');restored=false;state.disarmed=true;state.loginVerified=false;await save();report.safeDisarmReadback=true;
}
try{
 const marker=JSON.parse(await readFile(phase+'/owner.json','utf8'));
 if(marker.run!==custodyRun||marker.project!==project||marker.phase!==phase||marker.purpose!=='N44 exact restricted service custody')fail('n44_iteration_owner_mismatch');
 if(JSON.stringify((await readdir(phase)).sort())!==JSON.stringify(['owner.json','recovery.dpapi']))fail('n44_iteration_unexpected_input');
 plain=dpapi(await readFile(phase+'/recovery.dpapi'),false);state=JSON.parse(plain.toString());
 if(state.project!==project||state.run!==custodyRun||!state.disarmed||state.installed||state.loginVerified||!state.loginAcknowledged||state.iterationCorrectedAttempt)fail('n44_iteration_saved_state');
 const rows=await sql('begin read only;'+challengeSql+'rollback;');
 if(rows?.length!==1||rows[0].iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(rows[0].salt))fail('n44_iteration_stored_challenge_unexpected');challenge=rows[0];
 const ca=await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/supabase-prod-ca-2021.crt','utf8');
 if(createHash('sha256').update(ca).digest('hex')!=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7')fail('n44_iteration_ca_mismatch');
 const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
 const host='aws-0-ap-south-1.pooler.supabase.com',config={host,port:5432,database:'postgres',user:'n44_service_login.'+project,ssl:{ca,rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'},connectionTimeoutMillis:5000};
 let observed;
 try{observed=await serverFirst(Client,config);report.disabledHandshake='SERVER_FIRST_RECEIVED';}
 catch(e){
  report.disabledHandshake={code:/^[A-Z0-9_]{3,60}$/.test(e.code??'')?e.code:'PRIVATE_DETAILS_SUPPRESSED',proofSent:false};await receipt();
  if(!['28000','28P01'].includes(e.code))throw e;
  if(!/^(ACQUIRED|ALREADY OWNED) live-mutation$/.test(lease('acquire')))fail('n44_iteration_lease_missing');leaseOwned=true;
  await restore();observed=await serverFirst(Client,config);await disarm();
 }
 report.challenge={announcedIterationCount:Number(observed.iterations),expectedStoredIterationCount:16384,saltMatchesOwnStoredPublicChallenge:observed.salt===challenge.salt,strictTLS:observed.strictTLS,hostnameVerified:observed.hostnameVerified,proofSent:observed.proofSent};await receipt();
 if(observed.iterations!=='4096'||observed.salt!==challenge.salt||!observed.strictTLS||!observed.hostnameVerified||observed.proofSent)fail('n44_iteration_no_matching_compatibility_defect');
 report.compatibilityDefectConfirmed=true;
 const local=spawnSync(process.execPath,['tests/n44-finish-iteration-protocol.mjs'],{windowsHide:true,timeout:15000,maxBuffer:262144});
 try{if(local.status!==0)fail('n44_iteration_local_regression_failed');}finally{local.stdout?.fill(0);local.stderr?.fill(0);}
 const proof=JSON.parse(await readFile('tests/n44-finish-iteration-protocol.json','utf8'));if(proof.status!=='PASS')fail('n44_iteration_local_proof_missing');report.localProtocolRegression='PASS';
 if(!leaseOwned){if(!/^(ACQUIRED|ALREADY OWNED) live-mutation$/.test(lease('acquire')))fail('n44_iteration_lease_missing');leaseOwned=true;}
 const salt=Buffer.from(challenge.salt,'base64'),oldVerifier=deriveScram(state.password,salt,16384),newVerifier=deriveScram(state.password,salt,4096);salt.fill(0);
 await sql(`begin;do $n44$ begin
 if (select count(*) from pg_roles where ${disabled})<>1 or not exists(select 1 from pg_authid where rolname='n44_service_login' and rolpassword='${oldVerifier}') then raise exception 'n44_owned_preimage_changed';end if;
 alter role n44_service_login password '${newVerifier}';end $n44$;commit;select true as repaired;`);
 report.verifierWrites=1;state.iterationCompatibilityRepaired=true;state.scramIterations=4096;await save();
 const equality=await sql(`begin read only;select count(*)=1 as exact_disabled_credential from pg_authid where ${disabled.replace('pg_roles.oid','pg_authid.oid')} and rolpassword='${newVerifier}';rollback;`);
 if(equality?.[0]?.exact_disabled_credential!==true)fail('n44_iteration_repair_equality_failed');report.samePasswordSalt4096Equality=true;
 await restore();state.iterationCorrectedAttempt=true;await save();report.authenticationAttempts=1;await receipt();
 report.session=await execute('--check-session');state.loginVerified=true;successful=true;report.status='CORRECTED_SESSION_PASS';
}catch(e){report.status='BLOCKED';report.failure=/^n44_[a-zA-Z0-9_]+$/.test(e.message)?e.message:('n44_iteration_'+(/^[A-Z0-9_]{3,60}$/.test(e.code??'')?e.code:'private_details_suppressed'));process.exitCode=1;}
finally{
 try{if(restored&&!successful)await disarm();}catch{report.safeDisarmReadback=false;report.status='BLOCKED';report.cleanupFailure='n44_iteration_disarm_failed';process.exitCode=1;}
 if(leaseOwned){try{report.leaseReleased=lease('release')==='RELEASED live-mutation';}catch{report.leaseReleased=false;process.exitCode=1;}}
 plain?.fill(0);state=null;challenge=null;report.ownedTransientInputAbsent=!(await readdir(phase)).some(n=>n.startsWith('iteration-'));
 await receipt();console.log(JSON.stringify(report));
}
