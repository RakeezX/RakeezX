/** AI: consume only original producer's committed deidentified public certificate. */
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hash} from './prepare.mjs';
import {committedCertificateBytes} from './committed-certificate.mjs';
import {verifyExactDelta,producerTask,producerSession,historicalAggregate} from './exact-delta.mjs';
import {canonicalMetadata} from './config-provenance.mjs';
const runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
export const producerRevision='638931c283df8566bfefa7523b44444675c608da';
const producerRun='09e92a39-ee54-4c2b-a7ee-dc1f96229125',producerSource='0e851e950db66f8bf9c3425d2ccf8340c55f33e6';
const producerRoot='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n44-one-approved-closed-page-push-20261019';
const certificateSha256='61a2fdc3540ce40a26d18e1c49974022b3d82d949251bf7d4480a1a7aced5c25';
const disarmPath='drafts/n44-push/activation/device-closed-page/39c4090a-e653-4914-9fa0-855c3eed1b13/disabled.json';
const deny=code=>{throw Error('n88_typed_shared_certificate_'+code);};
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
export async function loadSharedCertificate(card){
 const authority=card.preparationAuthority.exactSharedConfigurationCertificate;
 if(authority?.allowedProducerTask!==producerTask||authority.originalProducerSession!==producerSession||authority.privateCrossCustodyAccess!==false||authority.wholeHistoricalAggregateMustMatch!==true||authority.unknownDriftAccepted!==false)deny('authority');
 const producer=await json(runtime+'queue/'+producerTask+'.json');
 if(producer.id!==producerTask||producer.sessionId!==producerSession||producer.attempt?.runId!==producerRun||path.resolve(producer.worktreePath)!==path.resolve(producerRoot))deny('producer');
 const expectedResult=path.join(runtime,'attempts',producerTask,producerRun,'result.json');
 if(path.resolve(producer.attempt.outputPath)!==path.resolve(expectedResult))deny('result_path');
 const result=await json(expectedResult);
 if(result.taskId!==producerTask||result.runId!==producerRun||result.candidateSha!==producerRevision||path.resolve(result.worktreePath)!==path.resolve(producerRoot)||!result.checks.some(c=>c.name==='n44_exact_shared_configuration_delta_certificate'&&c.status==='PASS'))deny('result');
 const bytes=committedCertificateBytes(producerRoot,producerRevision);
 if(hash(bytes)!==certificateSha256)deny('bytes');
 const cert=JSON.parse(bytes.toString());
 const keys=['version','taskId','runId','sourceCandidateSha','originalCustodianSession','recordedAt','status','currentAggregate','reconstructedOriginalAggregate','excludedKey','changedKeys','verifiedUnchangedAuthorizedKeys','metadataKeysetDigest','metadataShapeDigest','publicDisarmProofSha256','originalImmutableJournalSha256','historicalApprovalBindingVerified','providerMetadataReads','providerWrites','privateStateWrites','uploads','sends','privateValuesReturned'];
 if(Object.keys(cert).sort().join(',')!==keys.sort().join(',')||cert.version!==1||cert.taskId!==producerTask||cert.runId!==producerRun||cert.sourceCandidateSha!==producerSource||cert.originalCustodianSession!==producerSession||cert.status!=='PASS'||cert.excludedKey!=='N88_SERVICE_SOURCE_SHA'||cert.historicalApprovalBindingVerified!==true||cert.providerMetadataReads!==1||cert.providerWrites!==0||cert.privateStateWrites!==0||cert.uploads!==0||cert.sends!==0||cert.privateValuesReturned!==false||cert.reconstructedOriginalAggregate!==historicalAggregate)deny('shape_binding');
 const git=args=>execFileSync('git',args,{cwd:producerRoot,maxBuffer:1048576,stdio:['ignore','pipe','pipe']});
 git(['merge-base','--is-ancestor',producerSource,producerRevision]);
 const disarmBytes=git(['show',producerRevision+':'+disarmPath,'--']),disarm=JSON.parse(disarmBytes.toString());
 if(hash(disarmBytes)!==cert.publicDisarmProofSha256||cert.publicDisarmProofSha256!=='b1074637106619ceabf7e51b818932c8c3eda2988bddc0c90b4cbce99bcd3b8a'||cert.originalImmutableJournalSha256!=='54a6a7ff97bb7b023c399c57daf4d32241299a8b2e002c09c6d031f561bbc5c3'||disarm.taskId!==producerTask||disarm.runId!=='39c4090a-e653-4914-9fa0-855c3eed1b13'||disarm.testApprovalDisabled!==true||disarm.deliveryEnabled!==false||disarm.capabilityInvocations!==0)deny('disarm');
 return {cert,certificateSha256,producerRevision,producerRun,publicProofsVerified:true};
}
export function verifySharedCertificate(current,loaded){
 const {cert}=loaded,entries=canonicalMetadata(current);
 if(hash(JSON.stringify(entries.map(r=>({nameType:typeof r.name,digestType:typeof r.digest,digestLength:r.digest.length}))))!==cert.metadataShapeDigest)deny('metadata_shape');
 if(JSON.stringify(cert.verifiedUnchangedAuthorizedKeys)!==JSON.stringify([{name:'N44_DELIVERY_ENABLED',digest:hash('false')}])||entries.find(r=>r.name==='N44_DELIVERY_ENABLED')?.digest!==hash('false'))deny('delivery_off');
 const proof={taskId:cert.taskId,sessionId:cert.originalCustodianSession,runId:cert.runId,candidateSha:loaded.producerRevision,currentAggregate:cert.currentAggregate,keysetDigest:cert.metadataKeysetDigest,reconstructedAggregate:cert.reconstructedOriginalAggregate,changes:cert.changedKeys.map(c=>{
  if(Object.keys(c).sort().join(',')!=='currentDigest,name,previousDigest')deny('changed_shape');
  return {name:c.name,priorDigest:c.previousDigest,currentDigest:c.currentDigest};
 })};
 const result=verifyExactDelta({current:entries,proof,binding:{taskId:producerTask,sessionId:producerSession,runId:loaded.producerRun,candidateSha:loaded.producerRevision,committed:true,publicProofsVerified:loaded.publicProofsVerified}});
 return {...result,producerRevision:loaded.producerRevision,producerRun:loaded.producerRun,certificateSha256:loaded.certificateSha256,privateJournalIndependentlyOpened:false};
}
