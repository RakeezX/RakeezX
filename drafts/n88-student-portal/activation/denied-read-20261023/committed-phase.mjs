/** AI: exact committed public phase artifact binding; no worker-lifetime gate. */
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {hash,n44Task,n44Session,baselineKeysetDigest} from './transition-guards.mjs';
const producerRoot='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n44-one-approved-closed-page-push-20261019';
const deny=c=>{throw Error('n88_denied_phase_'+c);};
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
const permitted=p=>typeof p==='string'&&!p.includes('..')&&!p.includes('\\')&&/^(tests\/n44-device-20261023\/|drafts\/n44-push\/activation\/)/.test(p)&&!/(custody|\.tmp|private|recovery)/i.test(p)&&p.endsWith('.json');
export function qualifyPhaseEnvelope(c,binding,receiptChecks){
 if(c?.version!==1||c.taskId!==n44Task||c.originalCustodianSession!==n44Session||c.runId!==binding.runId||c.sourceCandidateSha!==binding.sourceCandidateSha||c.status!=='PASS'||c.configurationPhaseCompleted!==true||c.sharedMutationLeaseReleased!==true||c.ownedStagingCleaned!==true||c.privateValuesReturned!==false||c.metadataKeysetDigest!==baselineKeysetDigest||!hex(c.beforeAggregate,64)||!hex(c.afterAggregate,64)||!Array.isArray(c.changedKeys)||!c.changedKeys.length||!Array.isArray(c.operationProofs)||!c.operationProofs.length||receiptChecks!==true)deny('completion_binding');
 for(const r of c.operationProofs)if(!permitted(r.path)||!hex(r.sha256,64)||!['configuration-write-readback','native-pin-readback','configuration-phase-release'].includes(r.kind))deny('operation_proof');
 return {taskId:c.taskId,sessionId:c.originalCustodianSession,runId:c.runId,candidateSha:binding.revision,certificateSha256:binding.sha256,committed:true,configurationPhaseCompleted:true,publicOperationProofsVerified:true,beforeAggregate:c.beforeAggregate,afterAggregate:c.afterAggregate,keysetDigest:c.metadataKeysetDigest,changes:c.changedKeys};
}
export function committedPublicBytes(worktree,revision,file,expectedDigest){
 if(!hex(revision,40)||!permitted(file)||!hex(expectedDigest,64))deny('public_path');
 const git=args=>execFileSync('git',args,{cwd:worktree,maxBuffer:2097152,stdio:['ignore','pipe','pipe']});
 git(['merge-base','--is-ancestor',revision,'HEAD']);
 if(git(['status','--porcelain','--untracked-files=all','--',file]).toString().trim())deny('uncommitted');
 const bytes=git(['show',revision+':'+file,'--']);
 if(hash(bytes)!==expectedDigest||!bytes.equals(git(['show','HEAD:'+file,'--'])))deny('stale_or_changed_bytes');
 return bytes;
}
export async function loadCommittedPhaseChain(bindings){
 if(!Array.isArray(bindings)||!bindings.length||bindings.length>12)deny('missing_phase_binding');
 const card=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+n44Task+'.json','utf8')).replace(/^\uFEFF/,''));
 if(card.id!==n44Task||card.sessionId!==n44Session||path.resolve(card.worktreePath)!==path.resolve(producerRoot))deny('producer_identity');
 const git=args=>execFileSync('git',args,{cwd:producerRoot,stdio:['ignore','pipe','pipe']});
 return bindings.map(binding=>{
  if(!hex(binding?.sourceCandidateSha,40)||!binding.runId)deny('source_binding');
  git(['merge-base','--is-ancestor',binding.sourceCandidateSha,binding.revision]);
  const cert=JSON.parse(committedPublicBytes(producerRoot,binding.revision,binding.path,binding.sha256).toString());
  let operations=0,release=0;
  for(const ref of cert.operationProofs??[]){
   const receipt=JSON.parse(committedPublicBytes(producerRoot,binding.revision,ref.path,ref.sha256).toString());
   if(receipt.taskId!==n44Task||receipt.runId!==binding.runId||receipt.originalCustodianSession!==n44Session||receipt.sourceCandidateSha!==binding.sourceCandidateSha||receipt.status!=='PASS'||receipt.privateValuesReturned!==false)deny('operation_identity');
   if(ref.kind==='configuration-phase-release'){
    if(receipt.sharedMutationLeaseReleased!==true||receipt.ownedStagingCleaned!==true)deny('phase_release');release++;
   }else{
    if(receipt.operationAcknowledged!==true||receipt.exactReadbackVerified!==true||receipt.beforeAggregate!==cert.beforeAggregate||receipt.afterAggregate!==cert.afterAggregate||receipt.metadataKeysetDigest!==cert.metadataKeysetDigest||JSON.stringify(receipt.changedKeys)!==JSON.stringify(cert.changedKeys))deny('operation_readback');operations++;
   }
  }
  if(!operations||release!==1)deny('proof_chain');
  return qualifyPhaseEnvelope(cert,binding,true);
 });
}
