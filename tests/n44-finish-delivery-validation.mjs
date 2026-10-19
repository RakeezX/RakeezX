// AI-authored: validate the resumed delivery receipt without repeating live operations.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const priorPath = 'tests/n44-finish-activation-final.json';
const priorDigest = digest(priorPath);
const prior = read(priorPath);
const source = read('drafts/n44-push/activation/edge-source-readback.json');
assert.equal(prior.runId, 'fdaa4ff1-9221-41b9-8661-8a57a9a6e986');
assert.equal(prior.projectId, 'xlrubcwjqktzzunrvuns');
assert.equal(prior.state, 'LOCAL_READY');
assert.equal(prior.edgeFunction.version, 4);
assert.equal(source.exactBytes, true);
assert.equal(source.finalSourceBytesUnchanged, true);
assert.equal(source.source, prior.serviceSourceSha);
assert.equal(source.downloadedSha256, prior.edgeSourceSha256);
const bundle = readFileSync('drafts/n44-push/activation/bundle/edge/index.mjs', 'utf8').replace(/\r\n/g, '\n');
assert.equal(createHash('sha256').update(bundle).digest('hex'), source.downloadedSha256);
for (const key of ['loginExact', 'roleExact', 'upstreamSsl', 'clientTlsAuthorized', 'sourceBoundary', 'enabled']) {
  assert.equal(prior.restrictedIdentityAndFullTls[key], true, key);
}
assert.equal(prior.restrictedIdentityAndFullTls.source, prior.serviceSourceSha);
assert.equal(prior.restrictedIdentityAndFullTls.httpStatus, 200);
assert.equal(prior.providerSecretNamesAndDigestsMatched.length, 16);
assert.equal(prior.ingressEnabled, true);
assert.equal(prior.route.pattern, 'rakeezx.com/api/n44/*');
for (const key of ['deliveryEnabled', 'schedulerEnabled', 'browserEnabled', 'serviceWorkerEnabled', 'realSend', 'devicePermissionOrRegistration', 'authFixtureCreated', 'productClosed', 'immutableMigrationsReplayed']) {
  assert.equal(prior[key], false, key);
}
assert.equal(prior.restrictedIdentityAndFullTls.deliveryEnabled, false);
assert.deepEqual(prior.cron, []);
assert.equal(prior.personalRowsRead, 0);
assert.equal(prior.closedClientOsDelivery, 'NOT_RUN');
assert.equal(prior.actualUnauthorizedHttp.length, 3);
for (const check of prior.actualUnauthorizedHttp) {
  assert.equal(check.httpStatus, 401);
  assert.equal(check.denied, true);
  assert.equal(check.privateValuesReturned, false);
}
assert.equal(prior.cleanup.liveMutationLeaseReleased, true);
assert.equal(prior.cleanup.plaintextTransientInputsAbsent, true);
assert.equal(prior.originalFailuresPreserved, true);
// Historical refusal stays FAIL. It is not a required service acceptance gate.
assert.equal(prior.optionalDnsRead.status, 'FAIL');
assert.equal(prior.optionalDnsRead.code, 10000);
assert.equal(prior.optionalDnsRead.retried, false);
assert.equal(prior.optionalDnsRead.dnsChanged, false);
assert.equal(prior.optionalDnsRead.requiredMountIndependentlyProved, true);
assert.equal(digest(priorPath), priorDigest);

const result = {
  aiAuthored: true,
  taskId: prior.taskId,
  runId: '6524432d-95a8-4b18-83e8-62ea9fd04bfe',
  scope: 'Delivery reporting correction only; reuse unchanged bounded nonsending service evidence',
  previousValidationFailure: 'An affected check must pass and no recorded check may fail',
  correction: 'Current acceptance gates reference completed required service checks; the optional historical DNS refusal remains FAIL in the original receipt and is not relabeled as a passed gate.',
  checks: [{ name: 'unchanged_service_evidence_and_reporting_scope', status: 'PASS', evidence: 'Exact prior receipt, current Edge bundle, full TLS/identity, 16 secret acknowledgements, nonsending flags, mounted unauthorized denials and owned cleanup assertions passed locally.' }],
  reusedEvidence: { path: priorPath, sha256: priorDigest, runId: prior.runId, serviceSourceSha: prior.serviceSourceSha, edgeSourceSha256: source.downloadedSha256 },
  historicalOptionalDnsFailurePreserved: true,
  providerOperationsThisRun: 0,
  authenticationAttemptsThisRun: 0,
  liveStateOrRuntimeSourceChangedThisRun: false,
  noFrontendPublication: true,
  productClosed: false,
  closedClientOsDelivery: 'NOT_RUN'
};
writeFileSync('tests/n44-finish-delivery-validation.json', `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write('PASS: unchanged service evidence bound; historical optional DNS refusal preserved; no live operations.\n');
