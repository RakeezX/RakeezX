/** AI: sealed challenge/derive/boolean comparison for the SAME disabled owned role. */
import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {expectedKeys,challengeSql,comparisonSql,validateComparison} from './n44-activation-equality.mjs';
const runId='4c096417-b07a-4bc5-b8c1-538c9d9b1260',custodyRun='8288de34-7362-4946-b319-79a28e864be8';
const project='xlrubcwjqktzzunrvuns';
const phase='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-live/owned-'+custodyRun+'.tmp';
const file=phase+'/equality-'+runId+'.sql';
const report={aiAuthored:true,taskId:'continuous-n44-finish-bounded-service-activation-20261018',runId,projectId:project,recordedAt:new Date().toISOString(),authenticationAttempts:0,providerWrites:0,credentialChanges:0,rawPrivateValuesReturned:false};
const fail=code=>{throw Error(code);};
const digest=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
let plain,keys,challenge,state;
async function query(sql){
 try{
  await writeFile(file,'begin read only;\n'+sql+'\nrollback;\n',{flag:'wx'});
  const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
  const r=spawnSync(process.execPath,[cli,'db','query','--linked','--project-ref',project,'--file',file,'--output','json'],{windowsHide:true,timeout:30000,maxBuffer:1048576});
  try{if(r.status!==0)fail('n44_equality_protected_cli_failed');const text=r.stdout.toString();return JSON.parse(text.slice(text.indexOf('{'))).rows;}
  finally{r.stdout?.fill(0);r.stderr?.fill(0);}
 }finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
try{
 const marker=JSON.parse(await readFile(phase+'/owner.json','utf8'));
 if(marker.run!==custodyRun||marker.project!==project||marker.phase!==phase||marker.purpose!=='N44 exact restricted service custody')fail('n44_equality_owner_mismatch');
 if(JSON.stringify((await readdir(phase)).sort())!==JSON.stringify(['owner.json','recovery.dpapi']))fail('n44_equality_unexpected_file');
 const proof=JSON.parse(await readFile('tests/n44-finish-scram-equality.local.json','utf8'));
 const sourceSha256=await digest('scripts/n44-activation-equality.mjs');
 if(proof.status!=='PASS'||proof.sourceSha256!==sourceSha256||!proof.cleanup.postgresStopped||!proof.cleanup.leaseReleased)fail('n44_equality_local_proof_missing');
 report.provenance={sourceSha256,localProofSha256:await digest('tests/n44-finish-scram-equality.local.json'),protocol:['https://www.rfc-editor.org/rfc/rfc5802#section-3','https://www.rfc-editor.org/rfc/rfc7677#section-3'],priorDiagnosis:'tests/n44-finish-login-diagnosis.result.json'};
 const capability=JSON.parse(await readFile('drafts/n44-push/activation/login-diagnosis-capability.json','utf8'));
 if(capability.managementRole!=='postgres'||!capability.ownVerifierNameRead||!capability.ownVerifierRead)fail('n44_equality_capability_missing');
 const ps="Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$c=$m.ToArray();$b=[System.Security.Cryptography.ProtectedData]::Unprotect($c,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($b));[Array]::Clear($b,0,$b.Length);[Array]::Clear($c,0,$c.Length)";
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:await readFile(phase+'/recovery.dpapi'),windowsHide:true,timeout:15000,maxBuffer:262144});
 try{if(r.status!==0)fail('n44_equality_dpapi_failed');plain=Buffer.from(r.stdout.toString().trim(),'base64');}finally{r.stdout?.fill(0);r.stderr?.fill(0);}
 state=JSON.parse(plain.toString());
 if(state.project!==project||state.run!==custodyRun||!state.disarmed||state.loginVerified||state.installed||!state.loginAcknowledged)fail('n44_equality_recovery_state');
 const rows=await query(challengeSql);
 if(rows?.length!==1||Object.keys(rows[0]).sort().join(',')!=='iterations,salt')fail('n44_equality_challenge_shape');
 challenge=rows[0];keys=expectedKeys(state.password,challenge);
 report.comparison=validateComparison(await query(comparisonSql(keys,challenge)));
 report.status=report.comparison.storedKeyMatchesRecoveredCredential&&report.comparison.serverKeyMatchesRecoveredCredential?'MATCH_EXTERNAL_AUTH_BLOCKER':'PROVISIONING_MISMATCH_PROVEN';
 report.disposition='Owned role remains NOLOGIN with no membership. No authentication, password update, role restore, migration or deployment performed.';
}catch(e){report.status='FAIL';report.failure=/^n44_[a-z0-9_]+$/.test(e.message)?e.message:'n44_equality_private_details_suppressed';process.exitCode=1;}
finally{
 plain?.fill(0);keys?.stored.fill(0);keys?.server.fill(0);state=null;challenge=null;keys=null;
 report.ownedTransientInputAbsent=!(await readdir(phase)).some(n=>n.startsWith('equality-'));
 await writeFile('tests/n44-finish-scram-equality.hosted.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
