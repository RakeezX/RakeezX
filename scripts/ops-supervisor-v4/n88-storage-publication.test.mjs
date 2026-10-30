import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import fixture from './n88-storage-publication.fixture.json' with {type:'json'};
import {n88InstalledStorageTask,buildN88InstalledStorageEvidence,verifiedN88InstalledStoragePublication} from './n88-storage-publication.mjs';
import {buildLiveServiceEvidence,verifiedLiveServicePublication} from './live-service-publication.mjs';
import {verifiedDeployment,verifiedSourceOnlyPublication} from './controller.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=file=>Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));
function sample(){const x=structuredClone(fixture);x.task.servicePublicationEvidence=buildLiveServiceEvidence(x.task,x.receipt,read);return x;}
test('actual immutable candidate and served receipt classify completed storage without runtime activation',()=>{const x=sample();assert.equal(n88InstalledStorageTask(x.task),true);assert.equal(verifiedSourceOnlyPublication(x.task,x.receipt),false);assert.equal(verifiedN88InstalledStoragePublication(x.task,x.receipt),true);assert.equal(verifiedLiveServicePublication(x.task,x.receipt),true);assert.equal(verifiedDeployment(x.task,x.receipt),true);assert.equal(x.task.servicePublicationEvidence.noProviderOperations,true);assert.equal(x.task.servicePublicationEvidence.manifest.actualInstallation.runtimeTransportEnabled,false);});
test('builder reads only fixed candidate files and rejects a foreign task',()=>{const x=sample();const files=[];const p=buildN88InstalledStorageEvidence(x.task,x.receipt,file=>{files.push(file);return read(file);});assert.equal(files.length,8);assert.equal(new Set(files).size,8);assert.deepEqual(p,x.task.servicePublicationEvidence);assert.throws(()=>buildN88InstalledStorageEvidence({...x.task,id:'foreign'},x.receipt,()=>{throw Error('must not read');}));});
const changes=[
 ['wrong native qualification hash',x=>x.task.servicePublicationEvidence.qualificationSourceHashes['drafts/n88-student-portal/activation/v2-owner-admin-install-20261031/admission.mjs']='0'.repeat(64)],
 ['foreign run',x=>x.task.attempt.runId='00000000-0000-0000-0000-000000000000'],
 ['foreign candidate',x=>x.task.candidateSha='0'.repeat(40)],
 ['failed provider deployment',x=>x.receipt.provider.conclusion='failure'],
 ['altered served manifest',x=>x.receipt.evidence.production.assets.find(a=>a.repoPath.endsWith('/manifest.json')).observedSha256='0'.repeat(64)],
 ['missing verification path',x=>x.task.verificationPaths.pop()],
 ['uninstalled storage',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.state='UNKNOWN'],
 ['wrong SQL binding',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.boundInstallerSha256='0'.repeat(64)],
 ['wrong function count',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.assessment.fixedOperations=13],
 ['raw runtime privileges',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.assessment.runtimeRawPrivileges=true],
 ['legacy membership drift',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.assessment.oldMembershipRestored=false],
 ['service activation claim',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.serviceEnabled=true],
 ['transport activation claim',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.runtimeTransportEnabled=true],
 ['unperformed writer claim',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.transactionalSyncDeleteWriterAttached=true],
 ['lost root success',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.providerSuccess=false],
 ['replayed installation',x=>x.task.servicePublicationEvidence.manifest.currentAttempt.installationReplay=true],
 ['read before mutation acknowledgement',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.readbackObservedAt='2026-10-01T00:00:00Z'],
 ['unexpected live data permission',x=>x.task.preparationAuthority.realDataMutations=1],
 ['expired submission',x=>x.task.servicePublicationEvidence.manifest.actualInstallation.submittedAt='2027-01-01T00:00:00Z'],
 ['unrelated changed path',x=>x.receipt.changedPaths.push('src/unreviewed.js')],
 ['foreign task classification',x=>x.task.id='continuous-n88-unreviewed-task']
];
for(const [name,change] of changes)test('reject '+name,()=>{const x=sample();change(x);assert.equal(verifiedDeployment(x.task,x.receipt),false);});