// AI: real nonsending backend proof, separate from visible frontend asset changes.
import { createHash } from 'node:crypto';
const SHA=/^[a-f0-9]{64}$/, GIT=/^[a-f0-9]{40}$/, UUID=/^[a-f0-9-]{36}$/;
const ROOT='drafts/n44-push/activation/';
export const SERVICE_ARTIFACTS=[ROOT+'manifest.json','tests/n44-finish-activation-final.json',ROOT+'edge-source-readback.json',ROOT+'cloudflare-off-readback.json',ROOT+'cloudflare-final-readback.json',ROOT+'cloudflare-final-versions.json'];
const digest=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names=['n44-notifications-ingress','n44-notifications-scheduler'];
const route=r=>r?.pattern==='rakeezx.com/api/n44/*'&&r.script===names[0]&&r.request_limit_fail_open===false&&/^[a-f0-9]{32}$/.test(r.id??'');
const correction=t=>t?.id==='continuous-n44-cloudflare-redirect-transport-fix-20261019'&&t.scopeKey==='n44-existing-ingress-transport-compatibility'&&t.liveAuthorizationRef==='PO-20261019-N44-CF-TRANSPORT-REPAIR';
const fixedScope=t=>(correction(t)||t?.id==='continuous-n44-finish-bounded-service-activation-20261018'&&t.scopeKey==='n44-exact-nonsending-service-activation'&&t.liveAuthorizationRef==='PO-20261018-1628-FINISH-N44-EXACT-NONSENDING-ACTIVATION')&&t.productId==='N44'&&t.executionMode==='local'&&t.liveMutation===true
 &&t.preparationAuthority?.publication===true&&t.preparationAuthority.supabase?.projectId==='xlrubcwjqktzzunrvuns'
 &&t.preparationAuthority.supabase.function?.name==='n44-notifications'&&t.preparationAuthority.supabase.function.enableDelivery===false
 &&t.preparationAuthority.providers?.ingress===names[0]&&t.preparationAuthority.providers.scheduler===names[1]
 &&t.preparationAuthority.providers.deliveryEnabled===false;

// Only the guarded maintainer calls this with immutable git-show bytes at the saved candidate.
// Runtime/credentials/provider writes are deliberately absent from this module.
export function buildLiveServiceEvidence(task,receipt,readCandidateFile){
 const raw=Object.fromEntries(SERVICE_ARTIFACTS.map(p=>[p,Buffer.from(readCandidateFile(p))]));
 const [m,f,e,o,c,v]=SERVICE_ARTIFACTS.map(p=>JSON.parse(raw[p].toString('utf8')));
 const bundleHashes=Object.fromEntries(['edge/index.mjs','cloudflare/worker.mjs','scheduler/worker.mjs'].map(p=>[p,digest(Buffer.from(readCandidateFile(ROOT+'bundle/'+p)))]));
 return {version:1,kind:'n44-nonsending-live-service',candidateSha:task.candidateSha,baseSha:task.baseSha,publishedSha:receipt.publishedSha,
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
   if(x?.version!==1||x.platform!=='cloudflare-workers'||x.redirectMode!=='manual'||x.probeMethod!=='POST'||x.beforeHttpStatus!==503||x.afterHttpStatus!==401
    ||!['rejectsRedirects','localForwardAttempted','upstreamSourceUnchanged','originalCustodyUntouched','bindingsPreserved','nativeSourceExact'].every(k=>x[k]===true)
    ||p.bundleHashes['cloudflare/worker.mjs']==='438bc5721e43c3c179e44f5a18e9a748291b913f28ecd1bc1240d2c164188a40'
    ||p.bundleHashes['edge/index.mjs']!=='75d2fd6715a31a0b24ca6bc276ebea7da6ff1e6e9a2c5c79f9c5b62df4056181'||p.bundleHashes['scheduler/worker.mjs']!=='85c596cd37570867fff406f01fab790f4a1c36531e406dfee17b8c50ab27f433'||a.source!=='236f68e0131ca4d2b27fc3014cb33421f90b40c1'
    ||task.preparationAuthority.providers.keepBindingsRequired!==true||task.preparationAuthority.providers.secretReadOrWrite!==false||task.preparationAuthority.supabase.function.write!==false)return fail('transport-compatibility');
  }
  return true;
 }catch{return false;}
}
