// AI: fresh non-sending maintenance admission. No old trial entry point is invoked.
// Original CurrentUser custody is retained; only its named existing policy is read.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {supportedSessionPolicy} from '../../session-policy.mjs';
const TASK='continuous-n44-current-projection-recovery-20261031',RUN='a28ecd62-83bf-4c8f-8aa7-b511048e76ec';
const PROJECT='xlrubcwjqktzzunrvuns',REF='PO-20261031-N44-CURRENT-PROJECTION-RECOVERY';
const ROOT='C:/Users/Abody/Projects/RakeezX/',OPS=ROOT+'artifacts/ops-supervisor-v4/';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_RUN='8288de34-7362-4946-b319-79a28e864be8';
const PHASE=OPS+'intake-evidence/po-1628-finish-20261018/n44-live/owned-'+ORIGINAL_RUN+'.tmp';
const POLICY_FILE=PHASE+'/mobile-60fc7d23-8c87-4d8b-b97f-d9c9e289af94-prepared.dpapi';
const SOURCE='9d5becbc13e131249bac0d2e73babce6dd841f31';
const CLI='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function assertAdmission({requireLeases=true}={}){
 const card=JSON.parse(await readFile(OPS+'queue/'+TASK+'.json'));assert.equal(card.id,TASK);assert.equal(card.productId,'N44');assert.equal(card.status,'running');assert.equal(card.attempt.runId,RUN);assert.equal(card.liveAuthorizationRef,REF);
 const p=card.preparationAuthority;assert.equal(p.productId,'N44');assert.equal(p.liveAuthorizationRef,REF);assert.equal(p.projectId,PROJECT);assert.equal(p.serviceMaintenance.function,'n44-notifications');assert.equal(p.serviceMaintenance.ingress,'n44-notifications-ingress');assert.equal(p.serviceMaintenance.maxQualifiedFunctionUpdates,1);assert.equal(p.serviceMaintenance.maxQualifiedIngressUpdates,1);assert(p.serviceMaintenance.originalPrivateCustodianOnly);assert.equal(p.serviceMaintenance.deliveryEnabled,false);assert.equal(p.serviceMaintenance.schedulerEnabled,false);assert.deepEqual(p.serviceMaintenance.cron,[]);
 for(const k of ['phoneTrialActions','spentGrantResets','registrations','projectionWrites','sends','sqlAuthSchemaRoleChanges','newCredentials'])assert.equal(p[k],0);
 assert.equal(p.authorityEvidence.path,'artifacts/ops-supervisor-v4/intake-evidence/po-20261031-n44-projection-recovery/authority.json');assert.equal(p.authorityEvidence.sha256,'9c61890ae28617d7155c411bb61a0d70e8e40d5e4ccffdd429e88a1deaacd77a');
 assert.equal(hash(await readFile(ROOT+p.authorityEvidence.path)),p.authorityEvidence.sha256);
 assert.deepEqual(JSON.parse(await readFile(PHASE+'/owner.json')),{run:ORIGINAL_RUN,project:PROJECT,phase:PHASE,purpose:'N44 exact restricted service custody'});
 if(requireLeases)for(const resource of ['integration','live-mutation']){const l=JSON.parse(await readFile(OPS+'leases/'+resource+'.json'));assert.equal(l.taskId,TASK);assert.equal(l.owner.token,RUN);}
 return card;
}
function official(binary,args,{cwd=DIR,timeout=30000}={}){
 const result=spawnSync(process.execPath,[binary,...args],{cwd,windowsHide:true,timeout,maxBuffer:4194304,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},input:'n\nn\n'});
 try{if(result.status!==0)throw Object.assign(Error('n44_official_operation_failed'),{safeDiagnostic:{status:result.status,error:result.error?.code??null,signal:result.signal}});return result.stdout.toString();}finally{result.stdout?.fill(0);result.stderr?.fill(0);}
}
function originalPolicy(){
 // Existing original custodian's supported CurrentUser DPAPI convention. No
 // password/key/transport/phone record is exported, refreshed or rewritten.
 const ps="Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$b=$m.ToArray();$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Array]::Clear($b,0,$b.Length);[Console]::Write([Convert]::ToBase64String($p));[Array]::Clear($p,0,$p.Length)";
 return async()=>{const encrypted=await readFile(POLICY_FILE),r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:encrypted,windowsHide:true,timeout:15000,maxBuffer:262144});let plain;try{assert.equal(r.status,0,'n44_original_currentuser_unavailable');plain=Buffer.from(r.stdout.toString().trim(),'base64');const saved=JSON.parse(plain);const policy=saved.policy;assert(supportedSessionPolicy(policy,Date.now(),SOURCE));return policy;}finally{encrypted.fill(0);plain?.fill(0);r.stdout?.fill(0);r.stderr?.fill(0);}};
}
export async function inspect(){
 await assertAdmission();
 const functions=JSON.parse(official(CLI,['functions','list','--project-ref',PROJECT,'--output','json']));
 const native=functions.find(f=>f.slug==='n44-notifications');assert.equal(native.ezbr_sha256,'41c540288561db1e1d0ce32e2cd26660da128251270ee9f686d8846fec2254fc');
 const rows=JSON.parse(official(CLI,['secrets','list','--project-ref',PROJECT,'--output','json']));const map=Object.fromEntries(rows.map(r=>[r.name,r.digest??r.value]));
 const policy=await originalPolicy()();assert.equal(map.N44_SERVICE_SOURCE_SHA,hash(SOURCE));assert.equal(map.N44_SESSION_POLICY_JSON,hash(JSON.stringify(policy)));assert.equal(map.N44_DELIVERY_ENABLED,hash('false'));assert.equal(map.N44_ONE_DEVICE_TEST_JSON,hash('null'));assert(!map.N44_MOBILE_GRANT_SHA256);assert(!map.N44_FINITE_SCHEDULER_JSON||map.N44_FINITE_SCHEDULER_JSON===hash('null'));assert(!map.N44_SCHEDULER_ENABLED||map.N44_SCHEDULER_ENABLED===hash('false'));
 // The attempted supported init/from-dash route spawned C3/login and timed
 // out. It must not be retried or used for installation. A connected official
 // operator must supply these exact existing-script reads before qualification.
 await prepareReadRequests();
 return {status:'BLOCKED',code:'n44_authenticated_ingress_operator_required',providerWrites:0};
}

export async function prepareReadRequests(){
 await assertAdmission({requireLeases:false});
 const requests={taskId:TASK,runId:RUN,projectId:PROJECT,authority:REF,providerWrites:0,requests:['','/settings','/schedules'].map(suffix=>({method:'GET',path:'/accounts/1c9ae85e766968a4269a7ac505f9a693/workers/scripts/n44-notifications-ingress'+suffix,responsePath:'bundle/provider-responses/'+(suffix===''?'ingress-source.multipart':suffix==='/settings'?'ingress-settings.json':'ingress-schedules.json')})),scope:'Current ingress source/settings/empty cron only; no routes, peers, new credential or trial action.'};
 await writeFile(path.join(DIR,'bundle/provider-read-requests.json'),JSON.stringify(requests,null,2)+'\n');
 return requests;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{assert(['inspect','prepare'].includes(process.argv[2]));console.log(JSON.stringify(await (process.argv[2]==='prepare'?prepareReadRequests():inspect())));}catch(error){console.error(JSON.stringify({status:'BLOCKED',phase:'read-only-service-admission',code:error.message,diagnostic:error.safeDiagnostic??null,providerWrites:0}));process.exitCode=1;}
}
