/** AI: affected phase-binding tests; disposable public Git fixture, no ACL/provider. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {qualifyPhaseEnvelope,committedPublicBytes} from '../../drafts/n88-student-portal/activation/denied-read-20261023/committed-phase.mjs';
import {integrateVerifiedSuccessor} from '../../drafts/n88-student-portal/activation/denied-read-20261023/integrate.mjs';
import {runOriginalCustodian} from '../../drafts/n88-student-portal/activation/denied-read-20261023/original-custodian.mjs';
import {hash,n44Task,n44Session,baselineKeysetDigest} from '../../drafts/n88-student-portal/activation/denied-read-20261023/transition-guards.mjs';
const binding={runId:'fabricated',sourceCandidateSha:'1'.repeat(40),revision:'2'.repeat(40),sha256:'3'.repeat(64)};
const c={version:1,taskId:n44Task,originalCustodianSession:n44Session,runId:binding.runId,sourceCandidateSha:binding.sourceCandidateSha,status:'PASS',configurationPhaseCompleted:true,sharedMutationLeaseReleased:true,ownedStagingCleaned:true,privateValuesReturned:false,metadataKeysetDigest:baselineKeysetDigest,beforeAggregate:'4'.repeat(64),afterAggregate:'5'.repeat(64),changedKeys:[{name:'N44_SESSION_POLICY_JSON',previousDigest:'6'.repeat(64),currentDigest:'7'.repeat(64)}],operationProofs:[{path:'tests/n44-device-20261023/example-readback.json',sha256:'8'.repeat(64),kind:'configuration-write-readback'}]};
assert.equal(qualifyPhaseEnvelope(c,binding,true).configurationPhaseCompleted,true);
// No whole-worker-finished bit is required: the independently completed phase is the boundary.
for(const mutate of [x=>x.configurationPhaseCompleted=false,x=>x.sharedMutationLeaseReleased=false,x=>x.ownedStagingCleaned=false,x=>x.originalCustodianSession='foreign',x=>x.runId='foreign',x=>x.status='EXPECTED_CURRENT_MAP_PASS',x=>x.sourceCandidateSha='foreign',x=>x.metadataKeysetDigest='0'.repeat(64),x=>x.operationProofs=[],x=>x.operationProofs[0].path='../private.json',x=>x.operationProofs[0].path='drafts/n44-push/activation/owned-custody.tmp/state.json']){const changed=structuredClone(c);mutate(changed);assert.throws(()=>qualifyPhaseEnvelope(changed,binding,true));}
assert.throws(()=>qualifyPhaseEnvelope(c,binding,false));
assert.throws(()=>qualifyPhaseEnvelope({...c,expectedCurrentMapStatus:'PASS',historicalChainStatus:'NOT_PROVEN'},binding,true),/historical_predecessors_missing/);
await assert.rejects(()=>runOriginalCustodian('activate','1'.repeat(40)),/original_context/);
const beforeBundle=await readFile('drafts/n88-student-portal/activation/bundle/edge/index.mjs');
await assert.rejects(()=>integrateVerifiedSuccessor(randomUUID()),e=>e.code==='ENOENT');
assert.deepEqual(await readFile('drafts/n88-student-portal/activation/bundle/edge/index.mjs'),beforeBundle);
const owner=randomUUID(),base=path.resolve('tests/n88-denied-read-activation-20261023'),temp=path.join(base,'phase-fixture-'+owner+'.tmp');
await mkdir(temp,{recursive:false});await writeFile(path.join(temp,'owner.json'),owner);
const git=args=>execFileSync('git',args,{cwd:temp,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const file='tests/n44-device-20261023/phase-proof.json',bytes=Buffer.from('{"fabricated":true}\n');
try{
 git(['init','--quiet']);await mkdir(path.dirname(path.join(temp,file)),{recursive:true});await writeFile(path.join(temp,file),bytes);git(['add','--',file]);git(['-c','user.name=AI Fixture','-c','user.email=ai-fixture@example.invalid','commit','--quiet','-m','AI: synthetic phase']);const revision=git(['rev-parse','HEAD']).trim();
 await writeFile(path.join(temp,'independent.txt'),'independent worker progress\n');git(['add','--','independent.txt']);git(['-c','user.name=AI Fixture','-c','user.email=ai-fixture@example.invalid','commit','--quiet','-m','AI: unrelated public progress']);
 assert.deepEqual(committedPublicBytes(temp,revision,file,hash(bytes)),bytes);
 assert.throws(()=>committedPublicBytes(temp,revision,file,'0'.repeat(64)));
 await writeFile(path.join(temp,file),'uncommitted tamper');assert.throws(()=>committedPublicBytes(temp,revision,file,hash(bytes)));
 git(['add','--',file]);git(['-c','user.name=AI Fixture','-c','user.email=ai-fixture@example.invalid','commit','--quiet','-m','AI: changed phase proof']);assert.throws(()=>committedPublicBytes(temp,revision,file,hash(bytes)));
 assert.throws(()=>committedPublicBytes(temp,revision,'tests/n44-device-20261023/missing.json',hash(bytes)));
}finally{
 if(path.dirname(path.resolve(temp))!==base||await readFile(path.join(temp,'owner.json'),'utf8')!==owner)throw Error('fixture cleanup identity');await rm(temp,{recursive:true});
}
await writeFile(path.join(base,'committed-phase.json'),JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,providerOperations:0,aclWrites:0,checks:['completed/released configuration phase accepted without whole-worker completion','foreign/incomplete/unreleased/expected-current-only proof denied','committed unchanged ancestor artifact accepted during independent commits','uncommitted/tampered/stale/missing bytes denied','non-original execution context blocked before custody/provider access','active integration blocked before writes without actual service receipt'],ownedFixtureRemoved:true,actualProducerCertificateVerified:false},null,2)+'\n');
console.log('PASS: completed configuration phase, immutable Git binding and original-context negatives.');
