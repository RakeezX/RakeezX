import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedN88MobileNativePublication,n88MobileNativeTask} from '../n88-mobile-native-publication.mjs';

const fixture=JSON.parse(readFileSync(new URL('../test-fixtures/n88-mobile-native-publication.json',import.meta.url),'utf8'));
const clone=value=>structuredClone(value);
test('only the exact N88 mobile native task and pinned Production receipt qualify',()=>{
  assert.equal(n88MobileNativeTask(fixture.task),true);
  assert.equal(verifiedN88MobileNativePublication(fixture.task,fixture.receipt),true);
});
for(const [name,change] of [
  ['different task',(t)=>{t.id='other';}],
  ['different saved run',(t)=>{t.attempt.runId='different';}],
  ['different candidate',(t)=>{t.candidateSha='0'.repeat(40);}],
  ['unreviewed upload bytes',(t)=>{t.servicePublicationEvidence.artifactHashes['tests/n88-mobile-class-source-503-20261021/native-upload.json']='0'.repeat(64);}],
  ['second upload',(t)=>{t.servicePublicationEvidence.native.uploads=2;}],
  ['missing public pin',(t)=>{t.servicePublicationEvidence.native.pinUpdates=0;}],
  ['unreleased lease',(t)=>{t.servicePublicationEvidence.native.leasesReleased=false;}],
  ['missing native receipt path',(_,r)=>{r.sourceOnlyPaths=r.sourceOnlyPaths.filter(p=>!p.endsWith('/native-complete.json'));}],
  ['changed frontend assets',(_,r)=>{r.changedAssets=['src/app.js'];}],
  ['missing Production service parity',(_,r)=>{r.evidence.production.assets=r.evidence.production.assets.filter(a=>a.repoPath!=='drafts/n88-student-portal/integrated-service.mjs');}],
  ['wrong served source',(_,r)=>{r.evidence.production.assets.find(a=>a.repoPath==='drafts/n88-student-portal/integrated-service.mjs').expectedSha256='0'.repeat(64);}],
  ['reversed operation timestamps',(t)=>{t.servicePublicationEvidence.native.completeAt='2026-10-21T11:20:00.000Z';}],
]) test('reject '+name,()=>{
  const task=clone(fixture.task),receipt=clone(fixture.receipt);
  change(task,receipt);
  assert.equal(verifiedN88MobileNativePublication(task,receipt),false);
});
