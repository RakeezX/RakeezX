import assert from 'node:assert/strict';
import { verifiedDeployment, verifiedSourceOnlyPublication } from './controller.mjs';

const git = 'a'.repeat(40), published = 'b'.repeat(40), digest = 'c'.repeat(64);
const task = { id:'source-only-task', productId:'N44', candidateSha:git, baseSha:'d'.repeat(40), executionMode:'synthetic', liveMutation:false,
  allowedPaths:['drafts/n44-push/**','tests/n44.test.mjs'], verificationPaths:['drafts/n44-push/README.md'],
  preparationAuthority:{ publication:true, publicationScope:'inert draft server package tests evidence only' },
  releaseAuthority:'Publication is source-only via sole publisher; live activation remains forbidden.' };
const asset = { repoPath:'drafts/n44-push/README.md', verified:true, deleted:false, expectedSha256:digest, observedSha256:digest };
const receipt = { status:'deployed', state:'DEPLOYED_AWAITING_PO', productionDeployed:true, closed:false, taskId:task.id, ticketId:task.productId,
  candidateSha:task.candidateSha, baseSha:task.baseSha, publishedSha:published, deploymentId:'deploy-1',
  binding:{ candidateSha:task.candidateSha, declaredBaseSha:task.baseSha, publishedSha:published, candidateAncestorOfPublished:true, previousMainAncestorOfPublished:true, mainContainsPublished:true },
  provider:{ headSha:published, status:'completed', conclusion:'success', deploymentId:'deploy-1', previewUrl:'https://deploy.rakeezx.pages.dev' },
  productSourceChangeObserved:false, changedAssets:[], changedPaths:['drafts/n44-push/README.md','tests/n44.test.mjs'], sourceOnlyPaths:['tests/n44.test.mjs'],
  evidence:{ immutable:{ origin:'https://deploy.rakeezx.pages.dev', passed:true, assets:[asset] }, production:{ origin:'https://rakeezx.com', passed:true, assets:[asset] } } };

assert.equal(verifiedSourceOnlyPublication(task, receipt), true);
assert.equal(verifiedDeployment(task, receipt), true);
assert.equal(verifiedDeployment({ ...task, liveMutation:true }, receipt), false);
assert.equal(verifiedDeployment({ ...task, releaseAuthority:'ordinary publication' }, receipt), false);
assert.equal(verifiedDeployment(task, { ...receipt, changedPaths:[...receipt.changedPaths,'src/app.js'] }), false);
assert.equal(verifiedDeployment(task, { ...receipt, sourceOnlyPaths:['src/app.js'] }), false);
assert.equal(verifiedDeployment(task, { ...receipt, evidence:{ ...receipt.evidence, production:{ ...receipt.evidence.production, assets:[] } } }), false);
assert.equal(verifiedDeployment(task, { ...receipt, changedAssets:['app.js'] }), false);
const product = { ...receipt, productSourceChangeObserved:true, changedAssets:['app.js'] };
assert.equal(verifiedDeployment({ ...task, preparationAuthority:undefined, releaseAuthority:undefined }, product), true);
console.log('source-only publisher verification: PASS');
