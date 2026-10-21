// AI: real nonsending backend proof, separate from visible frontend asset changes.
import { createHash } from 'node:crypto';
import {n44QualifiedTask,buildN44QualifiedEvidence,verifiedN44QualifiedPublication} from './n44-qualified-source-evidence.mjs';
import {n88AssetTask,buildN88AssetEvidence,verifiedN88AssetPublication} from './n88-live-asset-evidence.mjs';
import {n88MobileNativeTask,buildN88MobileNativeEvidence,verifiedN88MobileNativePublication} from './n88-mobile-native-publication.mjs';
const SHA=/^[a-f0-9]{64}$/, GIT=/^[a-f0-9]{40}$/, UUID=/^[a-f0-9-]{36}$/;
const ROOT='drafts/n44-push/activation/';
export const SERVICE_ARTIFACTS=[ROOT+'manifest.json','tests/n44-finish-activation-final.json',ROOT+'edge-source-readback.json',ROOT+'cloudflare-off-readback.json',ROOT+'cloudflare-final-readback.json',ROOT+'cloudflare-final-versions.json'];
const digest=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names=['n44-notifications-ingress','n44-notifications-scheduler'];
const route=r=>r?.pattern==='rakeezx.com/api/n44/*'&&r.script===names[0]&&r.request_limit_fail_open===false&&/^[a-f0-9]{32}$/.test(r.id??'');
const correction=t=>t?.id==='continuous-n44-cloudflare-redirect-transport-fix-20261019'&&t.scopeKey==='n44-existing-ingress-transport-compatibility'&&t.liveAuthorizationRef==='PO-20261019-N44-CF-TRANSPORT-REPAIR';
const runtimeRepair=t=>correction(t)&&t.preparationAuthority?.supabase?.function?.write===true&&t.preparationAuthority.supabase.function.operation==='redeploy-existing-request-wrapper-only'
 &&t.preparationAuthority.supabase.runtimeRepair?.version===1&&t.preparationAuthority.supabase.runtimeRepair.kind==='existing-service-request-runtime-only'
 &&t.preparationAuthority.supabase.runtimeRepair.function==='n44-notifications'&&t.preparationAuthority.supabase.runtimeRepair.expectedTypedUnauthorizedStatus===400
 &&['noSqlSchemaAuthRoleOrCredentialOperation','noSecretReadOrWrite','noNewRoutes','noRealAccountOrStudentData','strictTlsRoleAndPrivateBoundaryUnchanged'].every(k=>t.preparationAuthority.supabase.runtimeRepair[k]===true);
const RUNTIME_CODE_HASHES={"drafts/n44-push/database-transport.mjs":"9b4e38cd806b87061f5b739a37ed18d6888e1a80050443de700c6e5bdc892a33","drafts/n44-push/request-session.mjs":"d7b27021a55cea209a88fe8c117afd919d8cf0746f777ee99bfb2af7e046f513","drafts/n44-push/runtime-failure.mjs":"90dee199e4b179828f13ff96bbde5a5218f2763463ccb952d5236d0e10a47e99","drafts/n44-push/existing-host.mjs":"453b5a5146807b4aca802c0cfde3f5df5a4fe46af08c84bdf3be7724191568f4","drafts/n44-push/web-entry.mjs":"7fc2ee383c8318c09838081ba58d757fc3ed84d9d1c4b72d1c790d858f0afd5c","drafts/n44-push/readiness-entry.mjs":"51534b2f4d2ceb6a95376f5a37fb4fd0cf47d2a56f48de72f99c772b97d29516","drafts/n44-push/backend.mjs":"eb63b4cb6461f960ac99c13c7c747d3f4a1cd1df64bb6c05a798bbac32711ad2","drafts/n44-push/auth-verifier.mjs":"929daab85fdb140afcb52e65e3b443e91341b8ef477f807f6278b807b63d364b","drafts/n44-push/activation/private-error-boundary.mjs":"1611f96425963ffde1f8b3d645c3e88303510bd2ecbc0ccf4685b96fd68021c3","drafts/n44-push/activation/error-boundary-contract.json":"8eeea87b7a77de0759a6d4c1a106c012073556b0d5ee35b7ab31dc81c7064356","drafts/n44-push/activation/error-boundary-identities.json":"44f315fe1b150f787b7d1d01d98282d53e24f1290023a6f7c405253cc28d671c"};
const fixedScope=t=>(correction(t)||t?.id==='continuous-n44-finish-bounded-service-activation-20261018'&&t.scopeKey==='n44-exact-nonsending-service-activation'&&t.liveAuthorizationRef==='PO-20261018-1628-FINISH-N44-EXACT-NONSENDING-ACTIVATION')&&t.productId==='N44'&&t.executionMode==='local'&&t.liveMutation===true
 &&t.preparationAuthority?.publication===true&&t.preparationAuthority.supabase?.projectId==='xlrubcwjqktzzunrvuns'
 &&t.preparationAuthority.supabase.function?.name==='n44-notifications'&&t.preparationAuthority.supabase.function.enableDelivery===false
 &&t.preparationAuthority.providers?.ingress===names[0]&&t.preparationAuthority.providers.scheduler===names[1]
 &&t.preparationAuthority.providers.deliveryEnabled===false;

// Only the guarded maintainer calls this with immutable git-show bytes at the saved candidate.
// Runtime/credentials/provider writes are deliberately absent from this module.
export function buildLiveServiceEvidence(task,receipt,readCandidateFile){
 if(n44QualifiedTask(task))return buildN44QualifiedEvidence(task,receipt,readCandidateFile);
 if(n88AssetTask(task))return buildN88AssetEvidence(task,receipt,readCandidateFile);
 if(n88MobileNativeTask(task))return buildN88MobileNativeEvidence(task,receipt,readCandidateFile);
 const raw=Object.fromEntries(SERVICE_ARTIFACTS.map(p=>[p,Buffer.from(readCandidateFile(p))]));
 const [m,f,e,o,c,v]=SERVICE_ARTIFACTS.map(p=>JSON.parse(raw[p].toString('utf8')));
 const bundleHashes=Object.fromEntries(['edge/index.mjs','cloudflare/worker.mjs','scheduler/worker.mjs'].map(p=>[p,digest(Buffer.from(readCandidateFile(ROOT+'bundle/'+p)))]));
 const runtime=runtimeRepair(task)?{codeHashes:Object.fromEntries(Object.keys(RUNTIME_CODE_HASHES).map(p=>[p,digest(Buffer.from(readCandidateFile(p)))])),probe:JSON.parse(Buffer.from(readCandidateFile('tests/n44-finish-runtime.fix1.json')).toString('utf8')),probeSha256:digest(Buffer.from(readCandidateFile('tests/n44-finish-runtime.fix1.json'))),poolRole:JSON.parse(Buffer.from(readCandidateFile('tests/n44-finish-runtime.pool-role.json')).toString('utf8')),poolRoleSha256:digest(Buffer.from(readCandidateFile('tests/n44-finish-runtime.pool-role.json'))),ingressSource:o.sources?.find(s=>s.name==='n44-notifications-ingress')}:null;
 return {...(runtime?{runtime}:{}),version:1,kind:'n44-nonsending-live-service',candidateSha:task.candidateSha,baseSha:task.baseSha,publishedSha:receipt.publishedSha,
  artifactHashes:Object.fromEntries(SERVICE_ARTIFACTS.map(p=>[p,digest(raw[p])])),bundleHashes,
  manifest:{projectId:m.projectId,outputs:m.outputs,actualServiceReadback:m.actualServiceReadback},
  final:f,edgeSource:e,
  workerSources:o.sources?.map(s=>({name:s.name,exact:s.downloadedSourceExact,version:s.version,cron:s.schedules?.schedules})),
  workerSourceReadback:o.sourceAndPrivacyReadback,
  cloudflare:{activation:c.activation,configuration:c.configuration?.map(s=>({name:s.name,readback:s.readback,logpush:s.logpush,tailConsumers:s.tailConsumers,enabled:s.enabled,schedulerEnabled:s.schedulerEnabled,cron:s.cron})),
   privacy:c.privacy?.map(s=>({name:s.name,status:s.status,success:s.success,logpush:s.logpush,tailConsumers:s.tailConsumers,configurationResponse:s.configurationResponse}))},
  versions:v.workers?.map(s=>({name:s.name,status:s.status,deploymentId:s.deploymentId,versions:s.versions}))};
}

export function verifiedLiveServicePublication(task,receipt,report=()=>{}){
 if(n44QualifiedTask(task))return verifiedN44QualifiedPublication(task,receipt);
 if(n88AssetTask(task))return verifiedN88AssetPublication(task,receipt);
 if(n88MobileNativeTask(task))return verifiedN88MobileNativePublication(task,receipt);
 const fail=reason=>{report(reason);return false;};
 try{
  const p=task?.servicePublicationEvidence,f=p?.final,m=p?.manifest,a=m?.actualServiceReadback,e=p?.edgeSource,r=f?.restrictedIdentityAndFullTls;
  if(!fixedScope(task)||p?.version!==1||p.kind!=='n44-nonsending-live-service'
   ||!GIT.test(p.candidateSha??'')||p.candidateSha!==task.candidateSha||p.candidateSha!==receipt?.candidateSha
   ||p.baseSha!==task.baseSha||p.baseSha!==receipt.baseSha||p.publishedSha!==receipt.publishedSha
   ||receipt.productSourceChangeObserved!==false||!Array.isArray(receipt.changedAssets)||receipt.changedAssets.length!==0
   ||!Array.isArray(receipt.sourceOnlyPaths)||!(correction(task)?SERVICE_ARTIFACTS.filter((_,i)=>[1,3,5].includes(i)):SERVICE_ARTIFACTS.slice(1)).every(x=>receipt.sourceOnlyPaths.includes(x))
   ||!same(Object.keys(p.artifactHashes).sort(),[...SERVICE_ARTIFACTS].sort())||!Object.values(p.artifactHashes).every(x=>SHA.test(x)))return fail('binding');
  const manifestHash=p.artifactHashes[SERVICE_ARTIFACTS[0]];
  if(![receipt.evidence?.immutable,receipt.evidence?.production].every(part=>part?.passed===true&&part.assets?.some(x=>x.repoPath===SERVICE_ARTIFACTS[0]&&x.verified===true&&x.deleted!==true&&x.expectedSha256===manifestHash&&x.observedSha256===manifestHash)))return fail('served-manifest');
  if(m.projectId!=='xlrubcwjqktzzunrvuns'||a?.receipt!==SERVICE_ARTIFACTS[1]||!GIT.test(a.source??'')||a.source!==f.serviceSourceSha
   ||a.serviceEnabled!==true||a.ingressEnabled!==true||a.deliveryEnabled!==false||a.schedulerEnabled!==false||a.cron?.length!==0||a.browserEnabled!==false||a.serviceWorkerEnabled!==false
   ||!Object.entries(p.bundleHashes).every(([path,hash])=>SHA.test(hash)&&m.outputs?.[path]===hash)||Object.keys(p.bundleHashes).length!==3)return fail('manifest-source');
  if(f.taskId!==task.id||f.projectId!==m.projectId||f.state!=='LOCAL_READY'||f.edgeFunction?.projectId!==m.projectId||f.edgeFunction.name!=='n44-notifications'
   ||!UUID.test(f.edgeFunction.id??'')||!Number.isInteger(f.edgeFunction.version)||f.edgeFunction.version<1||f.edgeFunction.status!=='ACTIVE'
   ||f.edgeSourceSha256!==p.bundleHashes['edge/index.mjs']||e.source!==a.source||e.projectId!==m.projectId||e.function!=='n44-notifications'
   ||e.sourceSha256!==f.edgeSourceSha256||e.downloadedSha256!==f.edgeSourceSha256||e.exactBytes!==true||e.importMapExact!==true||e.finalSourceBytesUnchanged!==true||e.finalProviderVersion!==f.edgeFunction.version)return fail('edge-source');
  if(r?.projectId!==m.projectId||r.source!==a.source||r.httpStatus!==200||r.status!=='ready'
   ||!['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','enabled'].every(x=>r[x]===true)||r.deliveryEnabled!==false
   ||![r.recordedAt,f.recordedAt,receipt.verifiedAt].every(x=>Number.isFinite(Date.parse(x)))
   ||!(Date.parse(r.recordedAt)<=Date.parse(f.recordedAt)&&Date.parse(f.recordedAt)<=Date.parse(receipt.verifiedAt))||Date.parse(receipt.verifiedAt)-Date.parse(r.recordedAt)>86400000)return fail('runtime-identity');
  if(f.ingressEnabled!==true||!route(f.route)||f.schedulerEnabled!==false||f.cron?.length!==0||f.deliveryEnabled!==false||f.browserEnabled!==false||f.serviceWorkerEnabled!==false
   ||f.realSend!==false||f.devicePermissionOrRegistration!==false||f.authFixtureCreated!==false||f.personalRowsRead!==0||f.immutableMigrationsReplayed!==false
   ||f.originalFailuresPreserved!==true||f.cleanup?.liveMutationLeaseReleased!==true||f.cleanup.plaintextTransientInputsAbsent!==true||f.cleanup.encryptedRecoveryRetained!==true)return fail('nonsending-scope');
  const expectedNames=['N44_AUTH_API_KEY','N44_AUTH_URL','N44_CRYPTO_JSON','N44_DATABASE_CA_CERT','N44_DATABASE_URL','N44_DELIVERY_ENABLED','N44_ENABLED','N44_INGRESS_KEY','N44_PROVIDER_ORIGINS_JSON','N44_PUBLIC_ORIGIN','N44_RATE_KEY','N44_READINESS_ENABLED','N44_SCHEDULER_KEY','N44_SERVICE_REVISION','N44_SERVICE_SOURCE_SHA','N44_SESSION_POLICY_JSON'];
  if(!same(f.providerSecretNamesAndDigestsMatched,expectedNames)||f.actualUnauthorizedHttp?.length!==3||!f.actualUnauthorizedHttp.every(x=>x.httpStatus===401&&x.denied===true&&x.privateValuesReturned===false&&x.cacheControl==='no-store, private')
   ||!f.actualUnauthorizedHttp.some(x=>x.url==='https://rakeezx.com/api/n44/status')
   ||!f.actualUnauthorizedHttp.some(x=>x.url==='https://xlrubcwjqktzzunrvuns.supabase.co/functions/v1/n44-notifications/readiness'))return fail('secret-and-denial-proof');
  const c=p.cloudflare;
  if(p.workerSourceReadback!=='PASS'||p.workerSources?.length!==2||!names.every(n=>p.workerSources.some(s=>s.name===n&&s.exact===true&&UUID.test(s.version??'')&&s.cron?.length===0))
   ||c?.activation?.status!=='PASS'||c.activation.ingressEnabled!==true||!route(c.activation.route)||c.activation.schedulerEnabled!==false||c.activation.cron?.length!==0
   ||c.configuration?.length!==2||!names.every((n,i)=>c.configuration.some(s=>s.name===n&&s.readback===true&&s.logpush===false&&s.tailConsumers?.length===0&&s.enabled===(i===0?'true':'false')&&s.schedulerEnabled==='false'&&s.cron?.length===0))
   ||c.privacy?.length!==2||!names.every(n=>c.privacy.some(s=>s.name===n&&s.status===200&&s.success===true&&s.logpush===false&&s.tailConsumers?.length===0&&s.configurationResponse?.enabled===false&&s.configurationResponse.logs?.enabled===false&&s.configurationResponse.logs.invocation_logs===false&&s.configurationResponse.traces?.enabled===false))
   ||p.versions?.length!==2||!names.every(n=>p.versions.some(s=>s.name===n&&s.status===200&&UUID.test(s.deploymentId??'')&&s.versions?.length===1&&s.versions[0].percentage===100&&UUID.test(s.versions[0].version_id??''))))return fail('workers');
  if(correction(task)){
   const x=f.transportCompatibility;
   if(x?.version!==1||x.platform!=='cloudflare-workers'||x.redirectMode!=='manual'||x.probeMethod!=='POST'||x.beforeHttpStatus!==503
    ||!['rejectsRedirects','localForwardAttempted','originalCustodyUntouched','bindingsPreserved','nativeSourceExact'].every(k=>x[k]===true)
    ||p.bundleHashes['cloudflare/worker.mjs']==='438bc5721e43c3c179e44f5a18e9a748291b913f28ecd1bc1240d2c164188a40'
    ||p.bundleHashes['scheduler/worker.mjs']!=='85c596cd37570867fff406f01fab790f4a1c36531e406dfee17b8c50ab27f433'||a.source!=='236f68e0131ca4d2b27fc3014cb33421f90b40c1'
    ||task.preparationAuthority.providers.keepBindingsRequired!==true||task.preparationAuthority.providers.secretReadOrWrite!==false)return fail('transport-compatibility');
   if(runtimeRepair(task)){
    const z=p.runtime,h=f.currentRequestRuntime,b=z?.probe;
    if(p.candidateSha!=='6f68b6e8cd148773e51007d990fd9e2c7b54f213'||p.bundleHashes['edge/index.mjs']!=='705a2df980bc411a8a64f5f25b5b72e1f1f58abfdb8671d10125a48cf93a052f'
     ||p.bundleHashes['cloudflare/worker.mjs']!=='cd68b9a8e6d552e08aaf5801fabe272a8113a3135014ce6d9d0a5c8d835f9df7'
     ||f.edgeFunction.version!==32||f.edgeFunction.verifyJwt!==false||x.afterHttpStatus!==400||x.expectedAfterHttpStatus!==400||x.upstreamSourceUnchanged!==false
     ||x.probePath!=='/api/n44/context/read'||!['typedRejectedSession','completeSyntheticShapeValidatedOffline','runtimeGuardExecuted','correctedIngressUploaded','unauthorizedAcceptancePassed'].every(k=>x[k]===true)
     ||x.observedRuntimePhase!=='complete'||x.normalFinalProof!=='PASS'||!same(z?.codeHashes,RUNTIME_CODE_HASHES)
     ||z?.probeSha256!=='fc8f37ba0ca5f3121b985ba104c48dd18a875c8a6fea5cdaa3ee644ed334389a'||z.poolRoleSha256!=='e8515b58b6dad88fa813f39b723691c84d93a61c28eed5643db982a1545fb0f8'
     ||!receipt.sourceOnlyPaths.includes('tests/n44-finish-runtime.fix1.json')||!receipt.sourceOnlyPaths.includes('tests/n44-finish-runtime.pool-role.json')
     ||b?.taskId!==task.id||b.runId!==task.attempt?.runId||b.runId!==f.runId||b.phase!=='fix1'||b.method!=='POST'||b.url!=='https://rakeezx.com/api/n44/context/read'
     ||b.httpStatus!==400||b.expectedContractStatus!==400||b.typedRejectedSession!==true||b.completeSyntheticShapeValidatedOffline!==true||b.noRealCredentialOrAccount!==true||b.bodyOrBearerRecorded!==false
     ||b.cacheControl!=='no-store, private'||!same(b.bodyKeys,['status'])||!same(b.identity,{})||b.failurePhase!==null||b.recordedAt!==x.afterRecordedAt
     ||!Number.isFinite(Date.parse(b.recordedAt))||Date.parse(b.recordedAt)>Date.parse(f.recordedAt)||Date.parse(b.recordedAt)<Date.parse(f.edgeFunction.nativeReadbackAt)
     ||z.poolRole.status!=='PASS'||z.poolRole.networkCalls!==0||z.poolRole.runId!==b.runId
     ||z.ingressSource?.sourceSha256!==p.bundleHashes['cloudflare/worker.mjs']||z.ingressSource.downloadedSha256!==p.bundleHashes['cloudflare/worker.mjs']||z.ingressSource.downloadedSourceExact!==true
     ||h?.version!==1||h.phase!=='complete'||h.fix!=='restore-original-role-before-pooled-identity-check'||h.finalNormalProof!=='PASS'||h.identityBooleanValues!==null
     ||!['diagnosisObserved','configurationCompleted','connectionAcquired','identityGuardCompleted','rolePrivateSourceReached','fixApplied','sanitizerRetryMetadataCorrected','identityQueryCompleted'].every(k=>h[k]===true)
     ||h.privateBindingsChanged!==false||h.nonsecretConfigurationChanged!==false||h.conditionalSessionTargetRemedyApplied!==false||h.currentSourceSha256!==p.bundleHashes['edge/index.mjs']||h.providerVersion!==32||h.probe!=='tests/n44-finish-runtime.fix1.json'
     ||!f.actualTransportUnauthorizedHttp?.some(v=>v.httpStatus===503&&v.failurePhase==='identity')||!f.actualTransportUnauthorizedHttp.some(v=>same(v,b))
     ||!same(h.guardPathsUnchanged,['drafts/n44-push/readiness-entry.mjs','drafts/n44-push/backend.mjs','drafts/n44-push/auth-verifier.mjs','drafts/n44-push/activation/private-error-boundary.mjs','drafts/n44-push/activation/error-boundary-contract.json','drafts/n44-push/activation/error-boundary-identities.json']))return fail('reviewed-runtime-repair');
   }else if(x.afterHttpStatus!==401||x.upstreamSourceUnchanged!==true||p.bundleHashes['edge/index.mjs']!=='75d2fd6715a31a0b24ca6bc276ebea7da6ff1e6e9a2c5c79f9c5b62df4056181'||task.preparationAuthority.supabase.function.write!==false)return fail('transport-compatibility');
  }
  return true;
 }catch{return false;}
}
