// AI: classify an already completed N88 storage installation and its source delivery.
// This module performs no database, provider, credential or worker operation.
import {createHash} from 'node:crypto';
const HASH=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/;
const ID='continuous-n88-owner-admin-storage-install-20261031';
const ROOT='drafts/n88-student-portal/activation/v2-owner-admin-install-20261031/';
const MANIFEST=ROOT+'manifest.json',DOCUMENT='docs/automation-evidence/20261031/N88_OWNER_ADMIN_STORAGE_INSTALL.md';
export const N88_STORAGE_ARTIFACTS=[MANIFEST,DOCUMENT,ROOT+'install-bound.sql',ROOT+'install-authority.json',ROOT+'installer.inactive.sql',ROOT+'admission.mjs',ROOT+'install-original-custodian.mjs','tests/n88-v2-owner-admin-install-20261031.test.mjs'];
const digest=b=>createHash('sha256').update(b).digest('hex');
// Preserve the exact native qualification encoding observed in the original worker files.
// Git stores these three files as LF; bound SQL remains byte-exact and is never normalized.
const QUALIFIED_CRLF={
 [ROOT+'admission.mjs']:[101],
 [ROOT+'install-original-custodian.mjs']:[96],
 ['tests/n88-v2-owner-admin-install-20261031.test.mjs']:[352,386]
};
function nativeQualificationHash(file,bytes){
 const text=bytes.toString('utf8');
 if(text.includes('\r'))throw Error('Expected immutable Git LF source');
 let line=0;
 return digest(text.replace(/\n/g,()=>QUALIFIED_CRLF[file].includes(++line)?'\r\n':'\n'));
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const exactAssessment={relations:4,fixedOperations:14,helpers:6,helperExecuteDelta:3,oldMembershipRestored:true,runtimeRawPrivileges:false,serviceEnabled:false};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const exact=(a,b)=>same(canonical(a),canonical(b));
const within=(file,paths)=>typeof file==='string'&&paths.some(p=>file===p||p.endsWith('/**')&&file.startsWith(p.slice(0,-2)));
export function n88InstalledStorageTask(task){
 const a=task?.preparationAuthority;
 return task?.id===ID&&task.productId==='N88'&&task.activationId==='po-20261012-continuous'&&task.scopeKey==='n88-existing-admin-atomic-storage-install'
  &&task.executionMode==='live'&&task.liveMutation===true
  &&task.liveAuthorizationRef==='PO-20261031-N88-BOUNDED-TOOL-WINDOW-CONTINUATION'
  &&a?.kind==='scoped_preview_and_fixture_ops'&&a.liveAuthorizationRef===task.liveAuthorizationRef&&a.projectId==='xlrubcwjqktzzunrvuns'
  &&a.publication===true&&a.sourceOnlyPublication===true&&a.serviceEnabled===false
  &&a.realDataMutations===0&&a.notificationSends===0&&a.newCredentials===0
  &&a.originalSupportedCustodianOnly===true&&a.maxAtomicInstallations===1&&a.maxNewQualifiedDispatches===1
  &&Array.isArray(task.allowedPaths)&&Array.isArray(task.verificationPaths)
  &&exact([...task.verificationPaths].sort(),[MANIFEST,DOCUMENT].sort());
}
export function buildN88InstalledStorageEvidence(task,receipt,readCandidateFile){
 if(!n88InstalledStorageTask(task))throw Error('n88_storage_publication_scope');
 const raw=Object.fromEntries(N88_STORAGE_ARTIFACTS.map(p=>[p,Buffer.from(readCandidateFile(p))]));
 const manifest=JSON.parse(raw[MANIFEST].toString('utf8')),record=JSON.parse(raw[ROOT+'install-authority.json'].toString('utf8'));
 return {version:1,kind:'n88-installed-storage-source',candidateSha:task.candidateSha,baseSha:task.baseSha,publishedSha:receipt.publishedSha,
  artifactHashes:Object.fromEntries(N88_STORAGE_ARTIFACTS.map(p=>[p,digest(raw[p])])),
  qualificationSourceHashes:Object.fromEntries(Object.keys(QUALIFIED_CRLF).map(p=>[p,nativeQualificationHash(p,raw[p])])),
  manifest:{taskId:manifest.taskId,runId:manifest.runId,baseSha:manifest.baseSha,projectRef:manifest.projectRef,serviceEnabled:manifest.serviceEnabled,authorityRef:manifest.authorityRef,authoritySha256:manifest.authoritySha256,installerSha256:manifest.installerSha256,admissionSha256:manifest.admissionSha256,relaySha256:manifest.relaySha256,testSha256:manifest.testSha256,deltaSha256:manifest.deltaSha256,originalReconciliation:manifest.originalReconciliation,currentAttempt:manifest.currentAttempt,actualInstallation:manifest.actualInstallation},
  binding:{serviceEnabled:record.serviceEnabled,authorityEvidenceSha256:record.authorityEvidenceSha256,installerSha256:record.installerSha256,taskId:record.taskId,runId:record.runId,projectRef:record.projectRef,deadline:record.deadline,boundInstallerSha256:record.boundInstallerSha256,authority:record.authority,target:record.target},
  noRuntimeActivation:true,noProviderOperations:true};
}
export function verifiedN88InstalledStoragePublication(task,receipt){
 try{
  const p=task?.servicePublicationEvidence,m=p?.manifest,b=p?.binding,a=m?.actualInstallation,c=m?.currentAttempt,h=p?.artifactHashes,qh=p?.qualificationSourceHashes;
  if(!n88InstalledStorageTask(task)||p?.version!==1||p.kind!=='n88-installed-storage-source'||p.noRuntimeActivation!==true||p.noProviderOperations!==true)return false;
  if(!GIT.test(p.candidateSha??'')||p.candidateSha!==task.candidateSha||p.candidateSha!==receipt?.candidateSha||p.baseSha!==task.baseSha||p.baseSha!==receipt.baseSha||p.publishedSha!==receipt.publishedSha||!GIT.test(p.publishedSha??''))return false;
  if(receipt.status!=='deployed'||receipt.state!=='DEPLOYED_AWAITING_PO'||receipt.productionDeployed!==true||receipt.closed!==false||receipt.poPersonallyTested!==false||receipt.build?.status!=='passed'||receipt.productSourceChangeObserved!==false||!Array.isArray(receipt.changedAssets)||receipt.changedAssets.length!==0)return false;
  if(!Array.isArray(receipt.changedPaths)||!receipt.changedPaths.length||!receipt.changedPaths.every(f=>within(f,task.allowedPaths))||!Array.isArray(receipt.sourceOnlyPaths)||!receipt.sourceOnlyPaths.length||!receipt.sourceOnlyPaths.every(f=>receipt.changedPaths.includes(f)&&within(f,task.allowedPaths)))return false;
  if(!h||!exact(Object.keys(h).sort(),[...N88_STORAGE_ARTIFACTS].sort())||!Object.values(h).every(v=>HASH.test(v)))return false;
  if(!qh||!exact(Object.keys(qh).sort(),Object.keys(QUALIFIED_CRLF).sort())||!Object.values(qh).every(v=>HASH.test(v)))return false;
  const served=(part,file)=>part?.passed===true&&Array.isArray(part.assets)&&part.assets.some(x=>x.repoPath===file&&x.urlPath===file&&x.statusCode===200&&x.verified===true&&x.deleted===false&&x.expectedSha256===h[file]&&x.observedSha256===h[file]);
  if(![receipt.evidence?.immutable,receipt.evidence?.production].every(part=>served(part,MANIFEST)&&served(part,DOCUMENT)))return false;
  if(m.taskId!==task.id||m.runId!==task.attempt?.runId||m.baseSha!==task.baseSha||m.projectRef!=='xlrubcwjqktzzunrvuns'||m.serviceEnabled!==false||m.authorityRef!==task.liveAuthorizationRef||m.authoritySha256!==task.preparationAuthority.authorityEvidence?.sha256)return false;
  if(m.installerSha256!==h[ROOT+'installer.inactive.sql']||m.admissionSha256!==qh[ROOT+'admission.mjs']||m.relaySha256!==qh[ROOT+'install-original-custodian.mjs']||m.testSha256!==qh['tests/n88-v2-owner-admin-install-20261031.test.mjs']||m.deltaSha256!=='6f0c21236d3a465f399b4b865a562247519c928d6d2a42575a81f6ac3f754026')return false;
  if(b.serviceEnabled!==false||b.authorityEvidenceSha256!==m.authoritySha256||b.installerSha256!==m.installerSha256||h[ROOT+'install-bound.sql']!=='161bc8f7db21ffff7ba4532df78f5e654bef43fce7cee0924f7b6a7fc96e3b2d'||b.runId!==m.runId||b.taskId!==task.id||b.projectRef!==m.projectRef||b.boundInstallerSha256!==h[ROOT+'install-bound.sql']||b.authority?.runId!==m.runId||b.authority.taskId!==task.id||b.authority.productId!=='N88'||b.authority.action!=='install-owner-admin-storage-20261031'||b.authority.ref!==m.authorityRef||b.authority.deltaSha256!==m.deltaSha256||b.authority.expiresAt!==b.deadline||b.target?.projectRef!==m.projectRef||!HASH.test(b.authority.targetSha256??''))return false;
  if(m.originalReconciliation?.state!=='VERIFIED_NO_CHANGE'||!HASH.test(m.originalReconciliation.sha256??'')||c?.state!=='INSTALLED_STORAGE_ONLY'||c.serviceEnabled!==false||c.installationReplay!==false||c.boundInstallerSha256!==b.boundInstallerSha256||c.deadline!==b.deadline||!['requestSha256','claimSha256','migrationResponseSha256','readbackResponseSha256','relayReportSha256'].every(k=>HASH.test(c[k]??''))||c.cleanup?.relayClosed!==true||!['integration','live-mutation'].every(n=>c.cleanup.leases?.some(x=>x.name===n&&x.result==='RELEASED '+n)))return false;
  if(a?.state!=='INSTALLED_STORAGE_ONLY'||a.projectRef!==m.projectRef||a.runId!==m.runId||a.boundInstallerSha256!==b.boundInstallerSha256||a.provider!=='official-connected-supabase-apply_migration'||a.providerSuccess!==true||a.migrationName!=='n88_owner_admin_storage_window_20261031'||a.readbackProvider!=='official-connected-supabase-execute_sql'||a.readbackSqlSha256!=='b01fc0fb56e2eca96931e95b4a7b56d044990e1adda627dc249153fc91a67c0c'||a.readbackResponseSha256!==c.readbackResponseSha256||!exact(a.assessment,exactAssessment)||a.serviceEnabled!==false||a.runtimeTransportEnabled!==false||a.transactionalSyncDeleteWriterAttached!==false)return false;
  if(![a.submittedAt,a.providerSuccessObservedAt,a.readbackObservedAt,b.deadline,receipt.verifiedAt].every(stamp)||Date.parse(a.submittedAt)>=Date.parse(b.deadline)||Date.parse(a.submittedAt)>Date.parse(a.providerSuccessObservedAt)||Date.parse(a.providerSuccessObservedAt)>Date.parse(a.readbackObservedAt)||Date.parse(a.readbackObservedAt)>Date.parse(receipt.verifiedAt))return false;
  return true;
 }catch{return false;}
}