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
import {serverFirst} from './activation/server-first.mjs';
import {createRolloutGuard} from './rollout-guard.mjs';
import {randomUUID,createPublicKey} from 'node:crypto';
const project='xlrubcwjqktzzunrvuns',run='4ddd5df2-933f-4754-8d04-0d27be47bcff';
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
 if(action==='--prepare-pilot-binding'){
  if(!state.directVerified||!state.installed||!state.preparationPaused||state.pilotBinding)fail('n88_pilot_binding_preimage');
  for(const name of ['service','ui'])if(JSON.parse(await readFile('tests/n88-official-activation-pilot-'+name+'.json','utf8')).status!=='PASS')fail('n88_pilot_local_gate');
  const file=path.join(phase,'owned-pilot-source.json');
  try{
   const input=JSON.parse(await readFile(file,'utf8'));
   if(Object.keys(input).sort().join(',')!=='classId,studentIds,teachingId'||!/^sec:[a-f0-9-]{36}$/.test(input.classId)||input.teachingId!=='tch:'+input.classId+'|sub:digital-skills|tm:y:1448-1449:1'||input.classId!=='sec:8d78704e-fd86-4b95-aa92-83957740daf6'||!Array.isArray(input.studentIds)||input.studentIds.length!==2||new Set(input.studentIds).size!==2||input.studentIds.some(s=>!/^[a-f0-9-]{36}$/.test(s)))fail('n88_pilot_source_shape');
   // Only owner UUID of this exact normal-UI observed source and these two
   // existing fabricated pupils. No Auth/profile/token/canonical payload projection.
   const out=await sqlFile(`select t.owner_id::text as owner_id from rakeezx.teachings t join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id join rakeezx.terms tm on tm.owner_id=t.owner_id and tm.id=t.term_id join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id where t.id='${input.teachingId}' and t.section_id='${input.classId}' and t.deleted_at is null and c.deleted_at is null and c.status='active' and tm.deleted_at is null and tm.status='active' and tm.year_id=c.year_id and y.deleted_at is null and y.status='active' and (select count(*) from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id where e.owner_id=t.owner_id and e.section_id=c.id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.deleted_at is null and e.status='active' and e.end_date is null and s.deleted_at is null and s.status='active')=2 and not exists(select 1 from rakeezx.enrollments e where e.owner_id=t.owner_id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.section_id<>c.id and e.deleted_at is null and e.status='active' and e.end_date is null);`);
   if(out?.rows?.length!==1||!/^[a-f0-9-]{36}$/.test(out.rows[0].owner_id))fail('n88_pilot_exact_single_owner_missing');
   state.pilotBinding={...input,ownerId:out.rows[0].owner_id};
   if(!createRolloutGuard(n=>({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(state.pilotBinding)})[n]).configured)fail('n88_pilot_binding_invalid');
   await save(state);return {bindingProtected:true,exactSourceOwnerMatches:1,students:2,newAuthUsers:0,canonicalWrites:0,identifiersReturned:false};
  }finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 if(action==='--install-pilot-config'){
  if(!state.pilotBinding||!state.directVerified||!state.installed||state.pilotConfigured)fail('n88_pilot_configuration_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(state.pilotBinding),N88_SERVICE_SOURCE_SHA:source};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.directSource=source;state.pilotConfigured=true;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,rolloutMode:'pilot',source,protectedOwnerBinding:true,names:Object.keys(env),identifiersReturned:false};
 }
 if(action==='--enable-pilot'){
  const r=JSON.parse(await readFile(path.join(base,'hosted-pilot-readiness.json'),'utf8'));
  if(!state.pilotConfigured||!state.directVerified||state.loginDisarmed||r.source!==state.directSource||r.rolloutMode!=='pilot'||!r.rolloutConfigured||!r.configurationReady||!r.sourceMatches)fail('n88_pilot_enable_gate');
  const file=path.join(phase,'owned-env.tmp');try{await writeFile(file,'N88_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.pilotEnabled=true;await save(state);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {enabled:true,rolloutMode:'pilot',publicMode:false,credentialChanged:false};
 }
 if(action==='--installed-names'){
  const result=await official(['secrets','list','--project-ref',project,'--output','json']);
  const rows=Array.isArray(result)?result:result?.rows;
  if(!Array.isArray(rows))fail('n88_secret_names_shape');
  return {names:rows.map(r=>r.name).filter(n=>n.startsWith('N88_')).sort(),valuesReturned:false};
 }
 if(action==='--pause-preparation'){
  if(!state.directVerified||!state.installed)fail('n88_preparation_pause_gate');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_ENABLED=false\nN88_READINESS_ENABLED=false\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)) then raise exception 'n88_pause_role_mismatch'; end if; alter role n88_backend nologin; end $$;");
  state.loginDisarmed=true;state.preparationPaused=true;await save(state);
  await unlink(path.join(base,'public-provider-config.json'));
  return {productEnabled:false,signedReadinessEnabled:false,loginDisarmed:true,originalRecoveryRetained:true,temporaryProviderConfigRemoved:true};
 }
 if(action==='--recipient-public'){
  if(!state.directVerified||state.ingress||!state.recipient)fail('n88_ingress_recipient_gate');
  const der=Buffer.from(state.recipient,'base64');
  try{return {publicJwk:createPublicKey(createPrivateKey({key:der,format:'der',type:'pkcs8'})).export({format:'jwk'}),project,worker:'rakeez-n88-private-ingress'};}finally{der.fill(0);}
 }
 if(action==='--refresh-direct-source'){
  if(!state.directReadinessInstalled||(!state.loginDisarmed&&!state.directVerified)||state.directAuthRefused)fail('n88_direct_refresh_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  if(source===state.directSource)fail('n88_direct_source_unchanged');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_SERVICE_SOURCE_SHA='+source+'\nN88_ENABLED=false\nN88_READINESS_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.lastDirectSourceAttempt=state.directSource;state.directSource=source;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {source,enabled:false,credentialChanged:false};
 }
 if(action==='--install-direct-readiness'){
  const d=state.restoredPublicDiagnostic;
  if(d?.status!=='PASS'||d.announcedIterations!==4096||d.expectedStoredIterations!==16384||!d.saltMatchesOwnStoredPublicChallenge||!d.strictTls||!d.hostnameVerified||d.proofSent||state.directReadinessInstalled)fail('n88_direct_readiness_gate');
  const m=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')),source=m.outputs['edge/index.mjs'];
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_AUTH_URL:'https://'+project+'.supabase.co',N88_SERVICE_SOURCE_SHA:source,N88_HMAC_KEY:state.hmac,N88_DATABASE_URL:`postgresql://n88_backend:${state.password}@db.${project}.supabase.co:5432/postgres`,N88_DATABASE_CA_CERT:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.directReadinessInstalled=true;state.directSource=source;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,readinessSigned:true,database:'official direct strictTLS',originalIterations:16384,credentialUnchanged:true,names:Object.keys(env),source};
 }
 if(action==='--arm-direct-login'){
  if(!state.directReadinessInstalled||state.directAuthRefused||(state.directLoginArmed&&(!state.loginDisarmed||(!state.directVerified&&state.lastDirectSourceAttempt===state.directSource))))fail('n88_direct_login_gate');
  await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid) and has_database_privilege('n88_backend','postgres','CONNECT')) then raise exception 'n88_direct_login_preimage'; end if; alter role n88_backend login; end $$;");
  state.directLoginArmed=true;state.loginDisarmed=false;await save(state);return {directLoginArmed:true,verifierOrPasswordChanged:false,membershipChanged:false};
 }
 if(action==='--call-direct-readiness'){
  if(!state.directLoginArmed||state.directAuthRefused||state.lastDirectSourceAttempt===state.directSource)fail('n88_direct_readiness_consumed');
  state.directReadinessCalled=true;state.lastDirectSourceAttempt=state.directSource;await save(state);
  const origin='https://'+project+'.supabase.co',route='/functions/v1/n88-student-portal/readiness',time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),body='{}';
  const signed=JSON.stringify(['n88-readiness-v1',origin,route,time,nonce,createHash('sha256').update(body).digest('hex')]);
  const signature=createHmac('sha256',Buffer.from(state.hmac,'hex')).update(signed).digest('hex');
  let receipt;
  try{
   const response=await fetch(origin+route,{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-signature':signature},body,signal:AbortSignal.timeout(15000)});
   let data=await response.json();
   const names=['status','stage','loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','configurationReady','rolloutMode','rolloutConfigured','source','enabled','code'];
   if(Object.keys(data).some(k=>!names.includes(k)))data={status:'unavailable',stage:'entry',code:'n88_generic_entry_unavailable',enabled:false};
   receipt={runId:state.pilotConfigured?'3576957c-1cf3-455d-8d62-150b1934b728':'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',projectId:project,httpStatus:response.status,...data,expectedSource:state.directSource,sourceMatches:data.source===state.directSource,transport:'original Supabase Edge IPv6 -> official direct strictTLS',privateMutations:0};
   state.directVerified=response.status===200&&data.status==='ready'&&data.loginExact===true&&data.roleExact===true&&data.upstreamSsl===true&&data.clientTlsAuthorized===true&&data.sourceBoundary===true&&data.source===state.directSource&&data.enabled===false;
   if(data.code==='28P01')state.directAuthRefused=true;
   if(!state.directVerified){await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;receipt.loginDisarmed=true;}
   await save(state);await writeFile(path.join(base,state.pilotConfigured?'hosted-pilot-readiness.json':'hosted-direct-readiness.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
  }catch{
   await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;await save(state);fail('n88_direct_readiness_failed_disarmed');
  }
 }
 if(action==='--server-first-restored'){
  if(state.restoredPublicChallengeConsumed||state.publicChallengeDiagnostic?.status!=='UNAVAILABLE'||state.publicChallengeDiagnostic?.code!=='XX000')fail('n88_restored_public_challenge_gate');
  const before=await sqlFile("select not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid) as disabled_exact from pg_roles where rolname='n88_backend';");
  if(before?.rows?.length!==1||before.rows[0].disabled_exact!==true)fail('n88_restored_public_challenge_preimage');
  const result=await sqlFile("select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where rolname='n88_backend' and not rolcanlogin and split_part(rolpassword,'$',1)='SCRAM-SHA-256';");
  const challenge=result?.rows?.[0];if(result?.rows?.length!==1||challenge.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))fail('n88_restored_public_challenge_shape');
  state.restoredPublicChallengeConsumed=true;await save(state);
  try{
   await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)) then raise exception 'n88_restore_preimage'; end if; alter role n88_backend login; end $$;");
   const diagnostic=await serverFirst({...challenge,ca:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')});
   state.restoredPublicDiagnostic={runId:'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',projectId:project,...diagnostic,verifierWritten:false,temporaryLoginOnly:true};await save(state);
   await writeFile(path.join(base,'hosted-scram-restored-challenge.json'),JSON.stringify(state.restoredPublicDiagnostic,null,2)+'\n');
   return state.restoredPublicDiagnostic;
  }finally{await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;await save(state);}
 }
 if(action==='--server-first'){
  if(state.publicChallengeConsumed)fail('n88_public_challenge_already_consumed');
  const q="select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_authid.oid) and split_part(rolpassword,'$',1)='SCRAM-SHA-256';";
  const result=await sqlFile(q),challenge=result?.rows?.[0];
  if(result?.rows?.length!==1||challenge.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))fail('n88_own_public_challenge_state_mismatch');
  state.publicChallengeConsumed=true;await save(state);
  const diagnostic=await serverFirst({...challenge,ca:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')});
  const receipt={runId:'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',projectId:project,...diagnostic,verifierWritten:false,loginRestored:false};
  state.publicChallengeDiagnostic=receipt;await save(state);
  await writeFile(path.join(base,'hosted-scram-public-challenge.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
 }
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
  await sqlFile(`alter role n88_backend nologin password '${deriveScram(state.password)}';`);
  state.passwordAcknowledged=true;await save(state);return {passwordAcknowledged:true,loginEnabled:false,verifierValuesReturned:false};
 }
 if(action==='--verify-credential'){
  if(!state.passwordAcknowledged||state.authenticationAttempted)fail('n88_credential_verification_gate');
  const ownedRole="rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_authid.oid)";
  const challenge=await sqlFile("select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where "+ownedRole+" and split_part(rolpassword,'$',1)='SCRAM-SHA-256';");
  const c=challenge?.rows?.[0];
  if(challenge?.rows?.length!==1||c.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(c.salt))fail('n88_public_challenge_shape');
  const salted=pbkdf2Sync(state.password,Buffer.from(c.salt,'base64'),16384,32,'sha256');
  const client=createHmac('sha256',salted).update('Client Key').digest();
  const stored=createHash('sha256').update(client).digest(),server=createHmac('sha256',salted).update('Server Key').digest();
  try{
   const comparison=await sqlFile(`select split_part(split_part(rolpassword,'$',2),':',2)='${c.salt}' as challenge_matches,split_part(split_part(rolpassword,'$',3),':',1)='${stored.toString('base64')}' as stored_matches,split_part(split_part(rolpassword,'$',3),':',2)='${server.toString('base64')}' as server_matches from pg_authid where ${ownedRole};`);
   if(comparison?.rows?.length!==1||Object.values(comparison.rows[0]).some(v=>v!==true))fail('n88_credential_equality_failed');
   state.credentialVerified=true;await save(state);
   return {storedKeyMatchesOriginalCredential:true,serverKeyMatchesOriginalCredential:true,loginEnabled:false,authenticationAttempts:0,secretValuesReturned:false};
  }finally{salted.fill(0);client.fill(0);stored.fill(0);server.fill(0);}
 }
 if(action==='--arm-login'){
  if(!state.credentialVerified||state.authenticationAttempted||state.loginAcknowledged)fail('n88_login_arm_gate');
  const result=await sqlFile("select rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolconnlimit,rolvaliduntil,rolconfig,has_database_privilege('n88_backend','postgres','CONNECT') as database_connect,(select count(*)::int from pg_auth_members where member=pg_roles.oid) as memberships from pg_roles where rolname='n88_backend';");
  const r=result?.rows?.[0];
  if(result?.rows?.length!==1||!r||['rolcanlogin','rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].some(k=>r[k]!==false)||r.rolconnlimit!==-1||r.rolvaliduntil!==null||r.rolconfig!==null||r.memberships!==0||r.database_connect!==true)fail('n88_login_preconditions_failed');
  await sqlFile('alter role n88_backend login;');
  state.loginAcknowledged=true;await save(state);return {loginAcknowledged:true,connectPermission:true,noMemberships:true,authenticationAttempts:0};
 }
 if(action==='--check-session'){
  if(!state.loginAcknowledged||!state.credentialVerified||state.authenticationAttempted)fail('n88_initial_authentication_gate');
  const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
  const ca=await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8');
  const client=new Client({host:'aws-0-ap-south-1.pooler.supabase.com',port:5432,user:'n88_backend.'+project,password:state.password,database:'postgres',ssl:{ca,rejectUnauthorized:true,servername:'aws-0-ap-south-1.pooler.supabase.com',minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,statement_timeout:3000,query_timeout:4000,application_name:'n88-private-server'});
  state.authenticationAttempted=true;await save(state);
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
  }catch(e){
   state.initialConnectionFailure=/^[0-9A-Z]{5}$/.test(e.code??'')?e.code:'SOURCE_OR_TRANSPORT';
   await save(state);
   await sqlFile('alter role n88_backend nologin;');
   state.loginDisarmed=true;await save(state);
   await writeFile(path.join(base,'hosted-initial-session.json'),JSON.stringify({status:'FAIL',runId:run,projectId:project,sqlstate:state.initialConnectionFailure,authenticationAttempts:1,credentialEqualityPassed:true,loginDisarmed:true,retryForbidden:true,privateQueriesExecuted:false})+'\n');
   fail('n88_initial_session_'+state.initialConnectionFailure);
  }finally{await client.end().catch(()=>{});}
 }
 if(action==='--install-env'){
  if(!state.directVerified||!state.ingress||state.installed)fail('n88_install_gate_missing');
  const publicConfig=JSON.parse(await readFile(path.join(base,'public-provider-config.json'),'utf8'));
  if(publicConfig.project!==project||typeof publicConfig.authPublicKey!=='string')fail('n88_public_configuration_missing');
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_SERVICE_SOURCE_SHA:state.directSource,N88_PUBLIC_ORIGIN:'https://rakeezx.com',N88_AUTH_URL:'https://'+project+'.supabase.co',N88_AUTH_API_KEY:publicConfig.authPublicKey,N88_SERVICE_REVISION:'n88-integrated-class-v1',N88_DATABASE_URL:`postgresql://n88_backend:${state.password}@db.${project}.supabase.co:5432/postgres`,N88_DATABASE_CA_CERT:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8'),N88_HMAC_KEY:state.hmac,N88_NUMERIC_KEY:state.numeric,N88_RESERVATION_KEY:state.reservation,N88_INGRESS_KEY:state.ingress,N88_RECOVERY_ACTIVE_VERSION:state.recoveryVersion,N88_RECOVERY_VERSIONS:state.recoveryVersion,['N88_RECOVERY_KEY_'+state.recoveryVersion]:state.recovery};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.installed=true;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,names:Object.keys(env),recoveryVersion:state.recoveryVersion,backup:'CurrentUser DPAPI immutable version material retained in owned protected custody; no plaintext temporary input retained'};
 }
 fail('n88_unknown_custodian_action');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log(JSON.stringify(await execute(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_custodian_failed_private_diagnostics_suppressed'}));process.exitCode=1;}}
