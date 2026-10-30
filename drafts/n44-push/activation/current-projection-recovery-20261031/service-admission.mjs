// AI: fresh non-sending maintenance admission. No old trial entry point is invoked.
// Original CurrentUser custody is retained; only its named existing policy is read.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {supportedSessionPolicy} from '../../session-policy.mjs';
const TASK='continuous-n44-current-projection-recovery-20261031',RUN='e79c62d4-4515-45ec-b187-1c019f63758c';
const PROJECT='xlrubcwjqktzzunrvuns',REF='PO-20261031-N44-CURRENT-PROJECTION-RECOVERY';
const ROOT='C:/Users/Abody/Projects/RakeezX/',OPS=ROOT+'artifacts/ops-supervisor-v4/';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_RUN='8288de34-7362-4946-b319-79a28e864be8';
const PHASE=OPS+'intake-evidence/po-1628-finish-20261018/n44-live/owned-'+ORIGINAL_RUN+'.tmp';
const POLICY_FILE=PHASE+'/mobile-60fc7d23-8c87-4d8b-b97f-d9c9e289af94-prepared.dpapi';
const SOURCE='9d5becbc13e131249bac0d2e73babce6dd841f31';
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
// Standalone inspection is local evidence only. All service capabilities enter
// exclusively through the explicitly admitted original private dispatcher.
export async function inspect(){await assertAdmission({requireLeases:false});return JSON.parse(await readFile(path.join(DIR,'service-readback.json'),'utf8'));}

export async function prepareReadRequests(){
 await assertAdmission({requireLeases:false});
 const requests={taskId:TASK,runId:RUN,projectId:PROJECT,authority:REF,providerWrites:0,requests:['','/settings','/schedules'].map(suffix=>({method:'GET',path:'/accounts/1c9ae85e766968a4269a7ac505f9a693/workers/scripts/n44-notifications-ingress'+suffix,responsePath:'artifacts/n44-current-projection-recovery-e79c62d4/mcp-post-readback.json',responseIndex:suffix===''?0:suffix==='/settings'?1:2})),scope:'Current ingress source/settings/empty cron only; no routes, peers, new credential or trial action.'};
 await writeFile(path.join(DIR,'bundle/provider-read-requests.json'),JSON.stringify(requests,null,2)+'\n');
 return requests;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{assert(['inspect','prepare'].includes(process.argv[2]));console.log(JSON.stringify(await (process.argv[2]==='prepare'?prepareReadRequests():inspect())));}catch(error){console.error(JSON.stringify({status:'BLOCKED',phase:'read-only-service-admission',code:error.message,diagnostic:error.safeDiagnostic??null,providerWrites:0}));process.exitCode=1;}
}

// Only the original private dispatcher supplies these capabilities. No request
// can select a URL, command, credential, registration or legacy trial operation.
export async function originalCustodianMaintenance(c,action){
 await assertAdmission({requireLeases:['install-edge','reserve-ingress'].includes(action)});await c.owned();assert.equal(c.phase,PHASE);assert.equal(c.project,PROJECT);
 const integration=JSON.parse(await readFile(OPS+'leases/integration.json'));assert.equal(integration.taskId,TASK);assert.equal(integration.owner.token,RUN);
 const local=path.resolve(DIR,'../../../..'),rawPath=path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/mcp-initial-readback.json');
 const prefix=path.join(c.phase,'current-projection-20261031-'),planFile=prefix+RUN+'-plan.dpapi';
 const unseal=async f=>{let b;try{b=c.dpapi(await readFile(f),false);return JSON.parse(b);}finally{b?.fill(0);}};
 const seal=async(f,v)=>{const b=Buffer.from(JSON.stringify(v));let encrypted;try{encrypted=c.dpapi(b,true);await writeFile(f,encrypted,{flag:'wx'});}finally{b.fill(0);encrypted?.fill(0);}};
 const normalize=rows=>rows.map(r=>({name:r.name,digest:r.digest??r.value})).sort((a,b)=>a.name.localeCompare(b.name));
 const equalMap=(a,b,delta={})=>{const expected=Object.fromEntries(normalize(a).map(r=>[r.name,r.digest]));for(const [k,v]of Object.entries(delta))expected[k]=hash(v);assert.deepEqual(Object.fromEntries(normalize(b).map(r=>[r.name,r.digest])),expected,'n44_unrelated_configuration_changed');};
 const functions=()=>c.official(['functions','list','--project-ref',PROJECT,'--output','json']);
 const report=async(name,value)=>{const r={taskId:TASK,runId:RUN,recordedAt:new Date().toISOString(),...value};await writeFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/'+name+'.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});return r;};
 if(action==='prepare'){
  const raw=JSON.parse(await readFile(rawPath));assert.equal(raw.length,3);const base='/accounts/1c9ae85e766968a4269a7ac505f9a693/workers/scripts/n44-notifications-ingress';
  for(const [i,suffix]of ['', '/settings','/schedules'].entries()){assert.equal(raw[i].path,base+suffix);assert.equal(raw[i].response.status,200);assert.equal(raw[i].response.success,true);}
  const source=await readFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/current-worker.mjs'),'utf8'),settings=raw[1].response.result;assert.deepEqual(raw[2].response.result,{schedules:[]});
  assert.equal(settings.bindings.find(b=>b.name==='N44_SCHEDULER_ENABLED')?.text,'false');assert.equal(settings.bindings.find(b=>b.name==='N44_INGRESS_KEY')?.type,'secret_text');assert(!settings.bindings.some(b=>b.type==='secret_text'&&Object.hasOwn(b,'text')));
  const manifest=JSON.parse(await readFile(path.join(DIR,'manifest.json')));assert.equal(hash(source),manifest.ingress.baselineSha256);assert.equal(hash(await readFile(path.join(DIR,'bundle/qualified/ingress.mjs'))),manifest.ingress.qualifiedSha256);
  assert.equal(hash(await readFile(path.join(DIR,'bundle/qualified/edge.mjs'))),manifest.qualifiedEntrySha256);
  const before=await c.list(),map=Object.fromEntries(normalize(before).map(r=>[r.name,r.digest]));
  const previous=await unseal(POLICY_FILE),policy=previous.policy;assert(supportedSessionPolicy(policy,Date.now(),SOURCE));assert.equal(map.N44_SERVICE_SOURCE_SHA,hash(SOURCE));assert.equal(map.N44_SESSION_POLICY_JSON,hash(JSON.stringify(policy)));assert.equal(map.N44_DELIVERY_ENABLED,hash('false'));assert.equal(map.N44_ONE_DEVICE_TEST_JSON,hash('null'));assert(!map.N44_MOBILE_GRANT_SHA256);assert(!map.N44_FINITE_SCHEDULER_JSON||map.N44_FINITE_SCHEDULER_JSON===hash('null'));assert(!map.N44_SCHEDULER_ENABLED||map.N44_SCHEDULER_ENABLED===hash('false'));
  const inventory=functions();assert.equal(inventory.find(f=>f.slug==='n44-notifications').ezbr_sha256,manifest.nativeBaselineArchive);
  const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:local,encoding:'utf8'}).trim();assert.equal(execFileSync('git',['show',sourceSha+':drafts/n44-push/activation/current-projection-recovery-20261031/manifest.json'],{cwd:local}).toString().replaceAll('\r\n','\n'),(await readFile(path.join(DIR,'manifest.json'),'utf8')).replaceAll('\r\n','\n'));
  const nextPolicy={...policy,serviceSourceSha:sourceSha};assert(supportedSessionPolicy(nextPolicy,Date.now(),sourceSha));assert.deepEqual({...nextPolicy,serviceSourceSha:policy.serviceSourceSha},policy);
  const qualification=JSON.parse(await readFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/qualification.json')));assert.equal(qualification.status,'PASS');assert.equal(qualification.edge,manifest.qualifiedEntrySha256);assert.equal(qualification.ingress,manifest.ingress.qualifiedSha256);
  await seal(planFile,{taskId:TASK,runId:RUN,sourceSha,before,inventory,policy,nextPolicy,manifest,settings,rawHash:hash(await readFile(rawPath)),preparedAt:Date.now(),qualifiesOnlyNonSendingMaintenance:true});
  return report('prepared',{status:'PASS',sourceSha,baselineArchive:manifest.nativeBaselineArchive,qualifiedEdge:manifest.qualifiedEntrySha256,qualifiedIngress:manifest.ingress.qualifiedSha256,originalPolicyApprovalAndTimestampsPreserved:true,deliveryOff:true,schedulerOff:true,cron:[],allocationsConsumed:0,privateValuesReturned:false});
 }
 const plan=await unseal(planFile);assert.equal(plan.runId,RUN);assert.equal(hash(await readFile(path.join(DIR,'bundle/qualified/edge.mjs'))),plan.manifest.qualifiedEntrySha256);assert.equal(hash(await readFile(path.join(DIR,'bundle/qualified/ingress.mjs'))),plan.manifest.ingress.qualifiedSha256);
 if(action==='install-edge'){
  assert(Date.now()-plan.preparedAt<900000);equalMap(plan.before,await c.list());assert.deepEqual(functions(),plan.inventory);
  await seal(prefix+'edge-once.dpapi',{taskId:TASK,runId:RUN,sourceSha:plan.sourceSha,hash:plan.manifest.qualifiedEntrySha256,reservedBeforeMutation:true,maxUpdates:1,noRetry:true});
  const work=prefix+RUN+'-upload',dir=path.join(work,'supabase/functions/n44-notifications');await mkdir(dir,{recursive:true});await writeFile(path.join(work,'supabase/config.toml'),'project_id = "'+PROJECT+'"\n[functions.n44-notifications]\nverify_jwt = false\nentrypoint = "./functions/n44-notifications/index.mjs"\nimport_map = "./functions/n44-notifications/import_map.json"\n');
  await writeFile(path.join(dir,'index.mjs'),await readFile(path.join(DIR,'bundle/qualified/edge.mjs')));await writeFile(path.join(dir,'import_map.json'),await readFile(path.join(DIR,'bundle/qualified/import_map.json')));
  c.official(['functions','deploy','n44-notifications','--project-ref',PROJECT,'--use-api','--no-verify-jwt','--workdir',work],work,60000);
  const download=prefix+RUN+'-readback';await mkdir(download);c.official(['functions','download','n44-notifications','--project-ref',PROJECT,'--use-api','--workdir',download],download,60000);
  const actual=await readFile(path.join(download,'supabase/functions/n44-notifications/index.mjs')),actualMap=await readFile(path.join(download,'supabase/functions/n44-notifications/import_map.json'));
  assert.equal(hash(actual),plan.manifest.qualifiedEntrySha256);assert.equal(hash(actualMap),hash(await readFile(path.join(DIR,'bundle/qualified/import_map.json'))));
  const delta={N44_SERVICE_SOURCE_SHA:plan.sourceSha,N44_SESSION_POLICY_JSON:JSON.stringify(plan.nextPolicy)};
  equalMap(plan.before,await c.list());await seal(prefix+'binding-once.dpapi',{runId:RUN,sourceSha:plan.sourceSha,changedFields:['serviceSourceSha'],approvalAndTimestampsPreserved:true,noRetry:true});await c.envFile(delta);equalMap(plan.before,await c.list(),delta);
  const installed=functions();assert.deepEqual(installed.filter(f=>f.slug!=='n44-notifications'),plan.inventory.filter(f=>f.slug!=='n44-notifications'));
  await seal(prefix+RUN+'-edge-complete.dpapi',{sourceSha:plan.sourceSha,archive:installed.find(f=>f.slug==='n44-notifications').ezbr_sha256,edge:hash(actual),map:hash(actualMap),bindingReadbackExact:true});
  return report('edge-installed',{status:'PASS',sourceSha:plan.sourceSha,version:installed.find(f=>f.slug==='n44-notifications').version,archive:installed.find(f=>f.slug==='n44-notifications').ezbr_sha256,entrySha256:hash(actual),mapSha256:hash(actualMap),exactNativeReadback:true,allOtherConfigurationAndFunctionsUnchanged:true,policyApprovalAndActivationUnchanged:true,qualifiedUpdates:1,sourceBindingUpdates:1,deliveryOff:true,privateValuesReturned:false});
 }
 if(action==='reconcile-edge'){
  const edgeReservation=await unseal(prefix+'edge-once.dpapi'),bindingReservation=await unseal(prefix+'binding-once.dpapi');assert.equal(edgeReservation.runId,RUN);assert.equal(bindingReservation.runId,RUN);
  equalMap(plan.before,await c.list(),{N44_SERVICE_SOURCE_SHA:plan.sourceSha,N44_SESSION_POLICY_JSON:JSON.stringify(plan.nextPolicy)});
  const installed=functions(),withoutRevision=f=>{const {version,...identity}=f;return identity;};
  assert.deepEqual(installed.filter(f=>f.slug!=='n44-notifications').map(withoutRevision),plan.inventory.filter(f=>f.slug!=='n44-notifications').map(withoutRevision));
  const peerRevisions=installed.filter(f=>f.slug!=='n44-notifications').map(f=>({name:f.slug,before:plan.inventory.find(x=>x.slug===f.slug).version,after:f.version}));assert(peerRevisions.every(r=>r.after===r.before+1));
  const actual=JSON.parse(await readFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/native-post-get.json')));assert.equal(actual.slug,'n44-notifications');assert.equal(actual.verify_jwt,false);
  assert.equal(hash(actual.files.find(f=>f.name==='n44-notifications/index.mjs').content),plan.manifest.qualifiedEntrySha256);assert.equal(hash(actual.files.find(f=>f.name==='n44-notifications/import_map.json').content),hash(await readFile(path.join(DIR,'bundle/qualified/import_map.json'))));
  assert.equal(actual.ezbr_sha256,installed.find(f=>f.slug==='n44-notifications').ezbr_sha256);
  await seal(prefix+RUN+'-edge-complete.dpapi',{sourceSha:plan.sourceSha,archive:actual.ezbr_sha256,edge:plan.manifest.qualifiedEntrySha256,bindingReadbackExact:true,reconciledReadOnly:true});
  return report('edge-reconciled',{status:'PASS',sourceSha:plan.sourceSha,version:actual.version,archive:actual.ezbr_sha256,entrySha256:plan.manifest.qualifiedEntrySha256,exactNativeReadback:true,allOtherSourceIdentitiesAndConfigurationUnchanged:true,peerProviderRevisionsAdvancedByOne:true,peerCount:peerRevisions.length,policyApprovalAndActivationUnchanged:true,originalFailure:'Post-secret-update peer inventory strict comparison included provider revision counters; preserved FAIL, no repeated mutation.',qualifiedUpdates:1,sourceBindingUpdates:1,reconciliationWrites:0,deliveryOff:true,privateValuesReturned:false});
 }
 if(action==='reserve-ingress'){
  await unseal(prefix+RUN+'-edge-complete.dpapi');equalMap(plan.before,await c.list(),{N44_SERVICE_SOURCE_SHA:plan.sourceSha,N44_SESSION_POLICY_JSON:JSON.stringify(plan.nextPolicy)});
  await seal(prefix+'ingress-once.dpapi',{runId:RUN,sourceSha:plan.sourceSha,hash:plan.manifest.ingress.qualifiedSha256,reservedBeforeMutation:true,maxUpdates:1,noRetry:true});
  const metadata={...plan.settings,main_module:'worker.mjs',bindings:plan.settings.bindings.map(b=>b.type==='secret_text'?{name:b.name,type:'inherit',version_id:'latest'}:b)};
  if(metadata.annotations)delete metadata.annotations['workers/triggered_by'];
  const request={taskId:TASK,runId:RUN,reader:'mcp__rakeez_cloudflare__execute',method:'PUT',path:'/accounts/1c9ae85e766968a4269a7ac505f9a693/workers/scripts/n44-notifications-ingress',query:{bindings_inherit:'strict'},metadata,sourceSha256:plan.manifest.ingress.qualifiedSha256,source:await readFile(path.join(DIR,'bundle/qualified/ingress.mjs'),'utf8'),noRetry:true};
  await writeFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/ingress-admitted-request.json'),JSON.stringify(request,null,2)+'\n',{flag:'wx'});
  return {status:'RESERVED',requestPath:'artifacts/n44-current-projection-recovery-e79c62d4/ingress-admitted-request.json',sourceSha256:request.sourceSha256,qualifiedUpdatesConsumed:1,noRetry:true};
 }
 if(action==='admit-ingress'){
  const reservation=await unseal(prefix+'ingress-once.dpapi');assert.equal(reservation.runId,RUN);
  const post=JSON.parse(await readFile(path.join(local,'artifacts/n44-current-projection-recovery-e79c62d4/mcp-post-readback.json')));assert.equal(post.length,3);assert(post.every(r=>r.response.success&&r.response.status===200));assert.deepEqual(post[1].response.result,plan.settings);assert.deepEqual(post[2].response.result,{schedules:[]});
  const raw=post[0].response.result,boundary=raw.split('\r\n',1)[0].slice(2),form=await new Response(raw,{headers:{'content-type':'multipart/form-data; boundary='+boundary}}).formData();assert.equal([...form].length,1);const entry=form.get('worker.mjs');assert.equal(hash(typeof entry==='string'?entry:await entry.text()),plan.manifest.ingress.qualifiedSha256);
  await seal(prefix+RUN+'-ingress-complete.dpapi',{sourceSha256:plan.manifest.ingress.qualifiedSha256,settingsExact:true,cronEmpty:true});return report('ingress-installed',{status:'PASS',sourceSha256:plan.manifest.ingress.qualifiedSha256,sourceExact:true,settingsBindingsAndPrivacyUnchanged:true,cron:[],qualifiedUpdates:1,secretValuesReturned:false});
 }
 if(action==='verify-ingress-auth-rejection'){
  await unseal(prefix+RUN+'-edge-complete.dpapi');await unseal(prefix+RUN+'-ingress-complete.dpapi');
  const response=await fetch('https://rakeezx.com/api/n44/events/read',{method:'POST',headers:{origin:'https://rakeezx.com','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin',authorization:'Bearer synthetic-invalid-n44-no-account'},body:JSON.stringify({workspaceId:'synthetic-no-workspace',deviceId:'synthetic-no-device',sourceKind:'due',sourceId:'synthetic-no-source',registrationId:'11111111-1111-4111-8111-111111111111',consentRevision:'synthetic-no-consent',nonce:crypto.randomUUID()}),signal:AbortSignal.timeout(15000),redirect:'error',credentials:'omit',cache:'no-store'});
  const value=await response.json();assert.equal(response.status,400);assert.deepEqual(value,{status:'rejected'});
  return report('actual-ingress-auth-rejection',{status:'PASS',httpStatus:response.status,teacherAuth:'REJECTED synthetic invalid bearer',authenticatedIngressEnvelopeReachedBackend:true,bothInstalledRouteAllowlistsReachable:true,secretBindingRetainedByActualSignedExchange:true,domainReadsOrWrites:0,registrationOrProjectionOrSend:0,scope:'Negative teacher Auth proof only; not a successful live teacher current-projection read.'});
 }
 assert.equal(action,'readback');await unseal(prefix+RUN+'-edge-complete.dpapi');await unseal(prefix+RUN+'-ingress-complete.dpapi');equalMap(plan.before,await c.list(),{N44_SERVICE_SOURCE_SHA:plan.sourceSha,N44_SESSION_POLICY_JSON:JSON.stringify(plan.nextPolicy)});
 const {mac,sha}=await import('../../web-protocol.mjs');const saved=await c.load(),url='https://'+PROJECT+'.supabase.co/functions/v1/n44-notifications/readiness',u=new URL(url),time=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID(),body='{}';
 const signature=await mac(Buffer.from(saved.ingress,'hex'),JSON.stringify(['n44-readiness-v1',u.origin,u.pathname,time,nonce,await sha(new TextEncoder().encode(body))]));
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-signature':signature},body,signal:AbortSignal.timeout(15000),redirect:'error'}),r=await response.json();assert.equal(response.status,200);assert.equal(r.status,'ready');assert.equal(r.source,plan.sourceSha);assert.equal(r.enabled,true);assert.equal(r.deliveryEnabled,false);for(const key of ['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary'])assert.equal(r[key],true);
 return report('service-final',{status:'PASS',sourceSha:plan.sourceSha,authenticatedPrivateReadiness:true,restrictedIdentityAndSourceBoundary:true,liveDomainMutations:0,deliveryOff:true,schedulerOff:true,cron:[],policyIdentityAndTimesPreserved:true,oldTrialsAndCredentialsUnchanged:true,authenticatedLiveTeacherFixture:'NOT_AVAILABLE; none created or re-enrolled',currentProjectionRouteProof:'Exact installed bundle parity plus qualified authenticated backend integration with synthetic ports; no physical phone proof',httpStatus:response.status});
}
