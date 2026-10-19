/** AI: same original N44 CurrentUser custodian; no SQL, credentials or private output. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink,readdir,open} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {protectedEnvText} from '../../../scripts/n44-activation-custody.mjs';
import {writeEncryptedAttemptJournal} from './device-attempt-journal.mjs';
const project='xlrubcwjqktzzunrvuns',taskId='continuous-n44-single-device-optin-ready-20261019',runId='05fd1236-442a-4fbf-add3-e9b9c20bb8e1';
const originalRun='8288de34-7362-4946-b319-79a28e864be8';
const phase='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-1628-finish-20261018/n44-live/owned-'+originalRun+'.tmp';
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const out='drafts/n44-push/activation/device-optin/';
const hash=s=>createHash('sha256').update(s).digest('hex'),fail=c=>{throw Error(c);};
const receipt=async(name,value)=>{const r={taskId,runId,projectId:project,recordedAt:new Date().toISOString(),...value};await writeFile(out+name+'.json',JSON.stringify(r,null,2)+'\n');return r;};
async function owned(){assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),{run:originalRun,project,phase,purpose:'N44 exact restricted service custody'});}
async function lease(){const l=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/live-mutation.json','utf8'));if(l.taskId!==taskId||l.owner?.token!==runId||l.resource!=='live-mutation')fail('n44_current_live_lease_required');}
function dpapi(bytes,protect){
 const ps=`Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$b=$m.ToArray();$p=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Array]::Clear($b,0,$b.Length);[Console]::Write([Convert]::ToBase64String($p));[Array]::Clear($p,0,$p.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 if(r.status!==0)fail('n44_currentuser_custody_unavailable');const b=Buffer.from(r.stdout.toString().trim(),'base64');r.stdout.fill(0);r.stderr.fill(0);return b;
}
async function load(){await owned();const b=dpapi(await readFile(path.join(phase,'recovery.dpapi')),false);try{return JSON.parse(b.toString());}finally{b.fill(0);}}
async function save(s){await owned();const b=Buffer.from(JSON.stringify(s));try{await writeFile(path.join(phase,'recovery.dpapi'),dpapi(b,true));}finally{b.fill(0);}}
function official(args,cwd=process.cwd(),timeout=30000){
 const r=spawnSync(process.execPath,[cli,...args],{cwd,windowsHide:true,timeout,maxBuffer:1048576});const status=r.status,raw=r.stdout.toString();r.stdout.fill(0);r.stderr.fill(0);
 if(status!==0)fail('n44_official_operation_failed_'+(status??'timeout'));
 try{return JSON.parse(raw);}catch{return {acknowledged:true};}
}
async function list(){const r=official(['secrets','list','--project-ref',project,'--output','json']);const rows=Array.isArray(r)?r:r.rows;if(!Array.isArray(rows))fail('n44_secret_metadata_shape');return rows;}
async function envFile(values){const f=path.join(phase,'owned-device-env-'+runId+'.tmp');await owned();try{await writeFile(f,protectedEnvText(values),{flag:'wx'});official(['secrets','set','--project-ref',project,'--env-file',f]);}finally{await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
export async function execute(action,value){
 await lease();const s=await load();if(!s.installed||!s.directPreparation||!s.password||!s.vapidPublic||!s.ingress)fail('n44_original_custody_not_installed');
 if(action==='--preflight'){
  const rows=await list(),comparison=Object.entries(s.envDigests).map(([name,digest])=>({name,matches:rows.find(r=>r.name===name)?.value===digest}));
  return receipt('custody-preflight',{originalOwnerVerified:true,encryptedRecoveryRetained:true,privateValuesReturned:false,comparison,profileObservedAt:s.policy.observedAt,profileFreshForNewActivation:Date.now()-s.policy.observedAt<=86400000,source:s.source,serverPublicKey:s.vapidPublic,unexpectedN44Names:rows.filter(r=>r.name.startsWith('N44_')&&!Object.hasOwn(s.envDigests,r.name)).map(r=>r.name)});
 }
 if(action==='--bind'){
  const input=JSON.parse(value),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(Object.keys(input).sort().join(',')!=='deviceId,ownerId,workspaceId'||!Object.values(input).every(v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(v)))fail('n44_scope_input');
  if(Date.now()-s.policy.observedAt>86400000)fail('n44_profile_metadata_expired');
  const before=JSON.parse(await readFile(out+'custody-preflight.json','utf8'));if(before.runId!==runId||before.comparison.some(c=>!c.matches)||before.unexpectedN44Names.length)fail('n44_preflight_drift');
  const approval={testId:'n44-one-device-20261019',runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',...input,expiresAt:Math.min(Date.now()+6*3600000,Date.parse('2026-10-20T00:00:00Z')),target:null};
  const policy={...s.policy,approvalId:hash(JSON.stringify([s.policy.approvalId,taskId,source])),serviceSourceSha:source,activatedAt:Date.now()};
  const values={N44_ONE_DEVICE_TEST_JSON:JSON.stringify(approval),N44_SERVICE_SOURCE_SHA:source,N44_SESSION_POLICY_JSON:JSON.stringify(policy),N44_DELIVERY_ENABLED:'false'};
  // Durable encrypted disposition before any provider config write; this phase
  // never arms a target or invokes the scheduler/provider sender.
  s.device1019={runId,source,scopeDigest:hash(JSON.stringify(input)),approval,pending:true,providerSendAttempts:0,actualRegistrations:0};await save(s);
  await envFile(values);const rows=await list();const matched=Object.entries(values).every(([name,value])=>rows.find(r=>r.name===name)?.value===hash(value));if(!matched)fail('n44_changed_config_readback_mismatch');
  s.source=source;s.policy=policy;for(const [k,v]of Object.entries(values))s.envDigests[k]=hash(v);s.device1019.pending=false;await save(s);
  return receipt('configuration-readback',{source,namesMatched:Object.keys(values),scopeDigest:s.device1019.scopeDigest,publicVapidKey:s.vapidPublic,expiresAt:approval.expiresAt,targetBound:false,deliveryEnabled:false,providerSendAttempts:0,registrations:0,plaintextInputRemoved:true});
 }
 if(action==='--deploy-edge'){
  if(!s.device1019||s.device1019.pending||s.device1019.runId!==runId)fail('n44_configuration_not_acknowledged');
  const manifest=JSON.parse(await readFile(out+'manifest.json','utf8'));for(const [f,h]of Object.entries(manifest.sources))if(hash((await readFile(f,'utf8')).replaceAll('\r\n','\n'))!==h)fail('n44_prepared_source_changed');
  const bytes=await readFile(out+'edge.mjs');if(hash(bytes)!==manifest.outputs['edge.mjs'])fail('n44_prepared_bundle_changed');
  const work=path.resolve('drafts/n44-push/activation/provider-deploy/device-'+runId),dir=path.join(work,'supabase/functions/n44-notifications');await mkdir(dir,{recursive:true});
  await writeFile(path.join(work,'supabase/config.toml'),'project_id = "'+project+'"\n[functions.n44-notifications]\nverify_jwt = false\nentrypoint = "./functions/n44-notifications/index.mjs"\nimport_map = "./functions/n44-notifications/import_map.json"\n');
  await writeFile(path.join(dir,'index.mjs'),bytes);await writeFile(path.join(dir,'import_map.json'),await readFile('drafts/n44-push/activation/bundle/edge/import_map.json'));
  // Exact original function name is mandatory; no prune/all-functions option.
  official(['functions','deploy','n44-notifications','--project-ref',project,'--use-api','--no-verify-jwt','--workdir',work],work,60000);
  s.device1019.edgeDeployAcknowledged=true;await save(s);return receipt('edge-deploy',{acknowledged:true,function:'n44-notifications',source:s.source,preparedSourceSha256:manifest.outputs['edge.mjs'],deliveryEnabled:false,targetBound:false});
 }
 if(action==='--readiness'){
  if(!s.device1019?.edgeDeployAcknowledged||s.device1019.pending)fail('n44_deploy_not_acknowledged');
  const {mac,sha}=await import('../web-protocol.mjs');const u=new URL('https://'+project+'.supabase.co/functions/v1/n44-notifications/readiness'),time=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID(),body='{}';
  const signature=await mac(Buffer.from(s.ingress,'hex'),JSON.stringify(['n44-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
  const response=await fetch(u,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-signature':signature},body,signal:AbortSignal.timeout(15000),redirect:'error'});const r=await response.json();
  const allowed=['status','stage','code','source','enabled','deliveryEnabled','loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','optIn'];if(Object.keys(r).some(k=>!allowed.includes(k)))fail('n44_readiness_shape');
  const o=r.optIn;const ok=response.status===200&&r.status==='ready'&&r.source===s.source&&r.enabled===true&&r.deliveryEnabled===false&&['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary'].every(k=>r[k]===true)&&o?.status==='ready'&&o.publicKey===s.vapidPublic&&o.serviceSourceSha===s.source&&o.deliveryEnabled===false&&o.schedulerEnabled===false&&o.targetBound===false;
  const result=await receipt('hosted-readiness',{httpStatus:response.status,...r,accepted:ok,privateValuesReturned:false});if(!ok)fail('n44_hosted_readiness_not_passed');return result;
 }
 if(action==='--disable-test'){
  await envFile({N44_ONE_DEVICE_TEST_JSON:'null',N44_DELIVERY_ENABLED:'false'});const rows=await list();if(rows.find(r=>r.name==='N44_ONE_DEVICE_TEST_JSON')?.value!==hash('null')||rows.find(r=>r.name==='N44_DELIVERY_ENABLED')?.value!==hash('false'))fail('n44_disable_not_acknowledged');
  s.envDigests.N44_ONE_DEVICE_TEST_JSON=hash('null');s.envDigests.N44_DELIVERY_ENABLED=hash('false');if(s.device1019)s.device1019.disabled=true;await save(s);return receipt('disabled-disposition',{testApprovalDisabled:true,deliveryEnabled:false,registrations:0,providerSendAttempts:0});
 }
 if(action==='--disabled-target-probe'){
  if(!s.device1019?.edgeDeployAcknowledged||s.device1019.approval.target!==null)fail('n44_unbound_target_probe_required');
  const {signedScheduleRequest}=await import('../scheduler-entry.mjs');
  const request=await signedScheduleRequest('https://'+project+'.supabase.co/functions/v1/n44-notifications/schedule',Buffer.from(s.scheduler,'hex'),{operation:'one-device-test',cursor:s.device1019.approval.runId,limit:1});
  const response=await fetch(request,{signal:AbortSignal.timeout(15000),redirect:'error'});const r=await response.json();
  const ok=response.status===200&&Object.keys(r).join(',')==='status'&&r.status==='disabled';
  const result=await receipt('unbound-target-readback',{httpStatus:response.status,status:r.status,accepted:ok,targetBound:false,providerSendAttempts:0,registrations:0,scope:'Signed original schedule entry rejected unbound test before owner/event/delivery work'});if(!ok)fail('n44_unbound_target_not_disabled');return result;
 }
 if(action==='--cleanup'){const files=await readdir(phase);return receipt('custody-cleanup',{plaintextTransientInputsAbsent:!files.some(f=>f.startsWith('owned-device-env-')),encryptedRecoveryRetained:files.includes('recovery.dpapi'),originalOwnerRetained:files.includes('owner.json'),noCredentialRotation:true});}
 fail('n44_unknown_scoped_action');
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))){try{console.log(JSON.stringify(await execute(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^n44_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n44_private_diagnostics_suppressed'}));process.exitCode=1;}}

// Phase2 uses the SAME owning process/channel and original approval. None of the
// completed phase1 commands is reachable from this narrowly scoped entry.
export async function executeClosedPage(action,input,currentRun) {
 const currentTask='continuous-n44-one-approved-closed-page-push-20261019';
 if(!/^[a-f0-9-]{36}$/.test(currentRun??''))fail('n44_current_run_required');
 const l=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/live-mutation.json','utf8'));
 if(l.taskId!==currentTask||l.owner?.token!==currentRun||l.resource!=='live-mutation')fail('n44_current_live_lease_required');
 const s=await load(),d=s.device1019;
 const {deviceApproval}=await import('../one-device-test.mjs');
 if(!s.installed||!s.directPreparation||!d||d.pending&&action!=='disarm'||!d.edgeDeployAcknowledged||s.source!==d.source)fail('n44_original_device_custody_required');
 const folder='drafts/n44-push/activation/device-closed-page/';await mkdir(folder,{recursive:true});
 const output=async(name,data)=>{const r={taskId:currentTask,runId:currentRun,recordedAt:new Date().toISOString(),...data};await writeFile(folder+name+'.json',JSON.stringify(r,null,2)+'\n');return r;};
 const journal=path.join(phase,'one-device-20261019-attempt.dpapi');
 const persist=async()=>{const b=Buffer.from(JSON.stringify(s));let encrypted;try{encrypted=dpapi(b,true);const f=await open(path.join(phase,'recovery.dpapi'),'r+');try{await f.writeFile(encrypted);await f.truncate(encrypted.length);await f.sync();}finally{await f.close();}}finally{b.fill(0);encrypted?.fill(0);}};
 const verifyConfig=async values=>{await envFile(values);const rows=await list();if(!Object.entries(values).every(([name,v])=>rows.find(r=>r.name===name)?.value===hash(v)))fail('n44_changed_config_readback_mismatch');for(const [name,v]of Object.entries(values))s.envDigests[name]=hash(v);};
 if(action==='state')return output('state',{originalOwnerVerified:true,source:s.source,scopeDigest:d.scopeDigest,approvalValid:!!deviceApproval(d.approval,Date.now()),targetBound:!!d.approval.target,capabilityInvocations:d.providerSendAttempts??0,disabled:d.disabled===true,immutableAttemptJournalPresent:(await readdir(phase)).includes(path.basename(journal)),privateValuesReturned:false});
 if(action==='arm') {
  if(!input||Object.keys(input).sort().join(',')!=='eventId,registrationId,scopeDigest'||input.scopeDigest!==d.scopeDigest||d.disabled||d.providerSendAttempts!==0||(await readdir(phase)).includes(path.basename(journal)))fail('n44_target_or_attempt_disposition');
  const target={registrationId:input.registrationId,eventId:input.eventId},a=deviceApproval({...d.approval,target},Date.now());
  if(!a||d.approval.target!==null)fail('n44_existing_approval_target_required');
  const rows=await list();if(!Object.entries(s.envDigests).every(([name,v])=>rows.find(r=>r.name===name)?.value===v))fail('n44_configuration_drift');
  d.approval=a;d.actualRegistrations=1;d.pending=true;await persist();
  await verifyConfig({N44_ONE_DEVICE_TEST_JSON:JSON.stringify(a),N44_DELIVERY_ENABLED:'false'});d.pending=false;await persist();
  return output('target-bound',{source:s.source,scopeDigest:d.scopeDigest,targetBound:true,targetDigest:hash(JSON.stringify(target)),approvalExpiryUnchanged:true,approvalRunUnchanged:true,deliveryEnabled:false,capabilityInvocations:0});
 }
 if(action==='attempt') {
  const a=deviceApproval(d.approval,Date.now());
  if(!a?.target||d.disabled||d.providerSendAttempts!==0||!input||Object.keys(input).sort().join(',')!=='chromeScopeClientCount,pagesClosedAt'||input.chromeScopeClientCount!==0||!Number.isSafeInteger(input.pagesClosedAt)||input.pagesClosedAt>Date.now()||Date.now()-input.pagesClosedAt>60000)fail('n44_closed_page_proof_required');
  // Fixed, exclusively-created encrypted journal is NEVER removed or reset.
  // fsync must ACK before the network invocation; crashes/timeouts consume it.
  const j=Buffer.from(JSON.stringify({testId:a.testId,approvalRun:a.runId,executionRun:currentRun,ownerId:a.ownerId,workspaceId:a.workspaceId,deviceId:a.deviceId,target:a.target,...input,consumed:true}));let encrypted;
  try{encrypted=dpapi(j,true);await writeEncryptedAttemptJournal(journal,encrypted);}finally{j.fill(0);encrypted?.fill(0);}
  d.providerSendAttempts=1;d.attemptExecutionRun=currentRun;d.attemptDisposition='unknown';await persist();
  const {signedScheduleRequest}=await import('../scheduler-entry.mjs');let httpStatus=null,status='unknown';
  try{const request=await signedScheduleRequest('https://'+project+'.supabase.co/functions/v1/n44-notifications/schedule',Buffer.from(s.scheduler,'hex'),{operation:'one-device-test',cursor:a.runId,limit:1});const r=await fetch(request,{signal:AbortSignal.timeout(20000),redirect:'error'});httpStatus=r.status;const body=await r.json();if(Object.keys(body).join(',')==='status'&&['sent','dead','uncertain','suppressed','rejected','expired','disabled','duplicate','limited','backoff','exhausted','conflict','unavailable'].includes(body.status))status=body.status;}catch{/* unknown consumes the same fixed budget; never resend */}
  d.attemptDisposition=status;await persist();return output('one-attempt',{httpStatus,status,capabilityInvocations:1,budgetConsumed:true,encryptedJournalRetained:true,pagesClosedBeforeInvocation:true,providerAcceptance:status==='sent'?'accepted':'not_proven',osReception:'NOT_RUN',deliveryEnabled:false});
 }
 if(action==='disarm') {
  await verifyConfig({N44_ONE_DEVICE_TEST_JSON:'null',N44_DELIVERY_ENABLED:'false'});d.disabled=true;await persist();
  return output('disabled',{testApprovalDisabled:true,deliveryEnabled:false,capabilityInvocations:d.providerSendAttempts??0,encryptedRecoveryRetained:true,encryptedAttemptJournalRetained:(await readdir(phase)).includes(path.basename(journal)),plaintextTransientInputsAbsent:!(await readdir(phase)).some(f=>f.startsWith('owned-device-env-')),registrationCleanup:'Separate ordinary owner-safe UI acknowledgement required'});
 }
 fail('n44_unknown_closed_page_action');
}

// AI: current repair uses the original sealed custody. No registration, SQL,
// scheduler/send capability, approval renewal or credential change is reachable.
export async function executeRegister503(action){
 const task='continuous-n44-register503-existing-service-repair-20261019',run='f6beb7aa-5700-4ef2-b759-129b88b7ac11',folder='drafts/n44-push/activation/register503/';
 const l=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/live-mutation.json','utf8'));
 if(l.taskId!==task||l.owner?.token!==run||l.resource!=='live-mutation')fail('n44_current_repair_lease_required');
 const emit=async(name,data)=>{const r={taskId:task,runId:run,projectId:project,recordedAt:new Date().toISOString(),...data};await writeFile(folder+name+'.json',JSON.stringify(r,null,2)+'\n');return r;};
 const s=await load(),d=s.device1019;
 if(!s.installed||!s.directPreparation||!s.serviceEnabled||!d||d.pending||d.disabled||d.approval?.target!==null||(d.providerSendAttempts??0)!==0||d.registrationDisposition?.status!=='failed_unacknowledged_revoked'||!d.registrationDisposition?.consentDisabled)fail('n44_original_cleaned_disposition_required');
 const rows=await list();if(Object.entries(s.envDigests).some(([n,h])=>rows.find(r=>r.name===n)?.value!==h)||rows.find(r=>r.name==='N44_DELIVERY_ENABLED')?.value!==hash('false'))fail('n44_existing_configuration_drift');
 if(action==='deploy'){
  if(s.register503?.deploymentAcknowledged||s.register503?.pending)fail('n44_repair_attempt_already_recorded');
  if(Date.now()-s.policy.observedAt>86400000)fail('n44_profile_metadata_expired');
  const m=JSON.parse(await readFile(folder+'manifest.json','utf8'));
  for(const [f,h]of Object.entries(m.sources))if(hash((await readFile(f,'utf8')).replaceAll('\r\n','\n'))!==h)fail('n44_repair_source_changed');
  const bytes=await readFile(folder+'edge.mjs');if(hash(bytes)!==m.outputs['edge.mjs'])fail('n44_repair_bundle_changed');
  const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),policy={...s.policy,serviceSourceSha:source};
  // Preserve approval/session revision and original policy metadata/activation;
  // only bind the exact changed service bytes, not a new Auth approval.
  const values={N44_SERVICE_SOURCE_SHA:source,N44_SESSION_POLICY_JSON:JSON.stringify(policy)};
  s.register503={source,priorSource:s.source,pending:true,registrations:0,sends:0};await save(s);
  await envFile(values);const after=await list();if(Object.entries(values).some(([n,v])=>after.find(r=>r.name===n)?.value!==hash(v)))fail('n44_repair_config_readback');
  for(const [n,v]of Object.entries(values))s.envDigests[n]=hash(v);s.source=source;s.policy=policy;d.source=source;await save(s);
  const work=path.resolve('drafts/n44-push/activation/provider-deploy/register503-'+run),dir=path.join(work,'supabase/functions/n44-notifications');await mkdir(dir,{recursive:true});
  await writeFile(path.join(work,'supabase/config.toml'),'project_id = "'+project+'"\n[functions.n44-notifications]\nverify_jwt = false\nentrypoint = "./functions/n44-notifications/index.mjs"\nimport_map = "./functions/n44-notifications/import_map.json"\n');
  await writeFile(path.join(dir,'index.mjs'),bytes);await writeFile(path.join(dir,'import_map.json'),await readFile('drafts/n44-push/activation/bundle/edge/import_map.json'));
  official(['functions','deploy','n44-notifications','--project-ref',project,'--use-api','--no-verify-jwt','--workdir',work],work,60000);
  s.register503.pending=false;s.register503.deploymentAcknowledged=true;await save(s);
  return emit('deployment',{acknowledged:true,source,bundleSha256:m.outputs['edge.mjs'],service:'n44-notifications',purpose:m.purpose,deliveryEnabled:false,cronEvidenceReused:'drafts/n44-push/activation/device-optin/native-source-readback.json',registrations:0,providerSendAttempts:0,approvalAndFailedRegistrationDispositionPreserved:true});
 }
 if(action==='readiness'){
  if(!s.register503?.deploymentAcknowledged||s.register503.pending)fail('n44_repair_deployment_not_acknowledged');
  const {mac,sha}=await import('../web-protocol.mjs');const u=new URL('https://'+project+'.supabase.co/functions/v1/n44-notifications/readiness'),time=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID(),body='{}';
  const signature=await mac(Buffer.from(s.ingress,'hex'),JSON.stringify(['n44-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
  const response=await fetch(u,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-signature':signature},body,signal:AbortSignal.timeout(15000),redirect:'error'}),r=await response.json();
  const accepted=response.status===200&&r.status==='ready'&&r.source===s.source&&r.enabled===true&&r.deliveryEnabled===false&&['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary'].every(k=>r[k]===true)&&r.optIn?.deliveryEnabled===false&&r.optIn?.schedulerEnabled===false&&r.optIn?.targetBound===false;
  const safe={};for(const k of ['status','stage','code','source','enabled','deliveryEnabled','loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary'])if(Object.hasOwn(r,k))safe[k]=r[k];
  const receipt=await emit('readiness',{httpStatus:response.status,...safe,accepted,registrationFailureRootCause:'NOT_PROVEN',registrations:0,providerSendAttempts:0,approvalAndPrivateDispositionPreserved:true,plaintextTransientInputsAbsent:!(await readdir(phase)).some(f=>f.startsWith('owned-device-env-'))});
  if(!accepted)fail('n44_repair_readiness_failed');return receipt;
 }
 fail('n44_unknown_repair_action');
}

// AI: latest explicit one-probe allowance. Immutable marker precedes normal UI;
// this entry has no HTTP registration, service config, SQL or sender operation.
export async function consumeRegister503Diagnostic(){
 const task='continuous-n44-register503-existing-service-repair-20261019',run='3934ca4d-4107-470d-b214-070916b3d526';
 const l=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/live-mutation.json','utf8'));
 if(l.taskId!==task||l.owner?.token!==run||l.resource!=='live-mutation')fail('n44_current_diagnostic_lease_required');
 const authorityPath='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-20261019-review-1400/n44-one-diagnostic-registration-authority.json';
 if(hash(await readFile(authorityPath))!=='438c0dba62d129ba8fab8e53f624c8a9700b99fc46406c505a6ce7501115d53c')fail('n44_diagnostic_authority_changed');
 const {DIAGNOSTIC_SOURCE,assertDiagnosticAttempt}=await import('./register503-diagnostic-guard.mjs');
 const s=await load(),d=s.device1019,m=JSON.parse(await readFile('drafts/n44-push/activation/register503/manifest.json','utf8'));
 if(!s.register503?.deploymentAcknowledged||s.register503.pending||s.source!=='fcf1126acdeee82b3458040d412294853be109f2'||d.source!==s.source||!d.approval||d.disabled||d.pending||d.approval.expiresAt<=Date.now())fail('n44_original_diagnostic_state_required');
 const journal=path.join(phase,'register503-source-'+DIAGNOSTIC_SOURCE+'-diagnostic-attempt.dpapi'),files=await readdir(phase);
 assertDiagnosticAttempt({source:m.outputs['edge.mjs'],consumed:files.includes(path.basename(journal)),cleaned:d.registrationDisposition?.status==='failed_unacknowledged_revoked'&&d.registrationDisposition?.consentDisabled===true,targetBound:d.approval.target!==null,sends:d.providerSendAttempts??0});
 const bytes=Buffer.from(JSON.stringify({task,run,source:DIAGNOSTIC_SOURCE,ownerId:d.approval.ownerId,workspaceId:d.approval.workspaceId,deviceId:d.approval.deviceId,priorRegistrationDisposition:d.registrationDisposition,consumed:true,consumedAt:Date.now(),purpose:'ONE normal UI changed-source diagnostic; no send'}));let encrypted;
 try{encrypted=dpapi(bytes,true);await writeEncryptedAttemptJournal(journal,encrypted);}finally{bytes.fill(0);encrypted?.fill(0);}
 const receipt={taskId:task,runId:run,recordedAt:new Date().toISOString(),sourceSha256:DIAGNOSTIC_SOURCE,scopeDigest:d.scopeDigest,consumed:true,immutableEncryptedMarkerAcknowledged:true,originalFailedIdentityPreserved:true,originalApprovalPreserved:true,providerSendAttempts:0,sendJournalPresent:files.includes('one-device-20261019-attempt.dpapi'),privateValuesReturned:false};
 await writeFile('drafts/n44-push/activation/register503/diagnostic-consumed.json',JSON.stringify(receipt,null,2)+'\n');return receipt;
}
