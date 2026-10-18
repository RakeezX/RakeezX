import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyInactiveIdentity, revisedTask, validatePayload } from '../apply-reviewed-maintenance.mjs';
import { HISTORICAL_RUNTIME_MODE } from '../historical-runtime-supersession.mjs';
const source = JSON.parse(fs.readFileSync(new URL('./historical-runtime-supersession.fixture.json', import.meta.url), 'utf8'));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const git = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonHash = value => digest(Buffer.from(JSON.stringify(value, null, 2) + '\n'));
function fixture() {
  const f = structuredClone(source);
  f.context = { ...f.hashes, result: f.result, replacement: f.replacement, integration: f.integration, coverage: f.coverage,
    assertAncestor: (older, newer) => execFileSync(git, ['merge-base', '--is-ancestor', older, newer], { cwd: repo, stdio: 'pipe' }),
    readPublishedBlob: (publishedSha, repoPath) => execFileSync(git, ['rev-parse', publishedSha + ':' + repoPath], { cwd: repo, encoding: 'utf8' }).trim() };
  return f;
}
function verify(f) { return verifyInactiveIdentity(f.task, f.result, f.update, f.task.activationId, f.context); }
test('the exact LOCAL_READY inactive attempt qualifies only against actual E/F Git ancestry and verified receipts', () => {
  const f = fixture(); assert.equal(verify(f), true);
  assert.equal(f.update.card.completionMode, HISTORICAL_RUNTIME_MODE);
});
test('classification preserves original failure/result/candidate/session history and never marks Product success', () => {
  const f = fixture(), oldTask = structuredClone(f.task), oldResult = structuredClone(f.result);
  const revised = revisedTask(f.task, f.update, 'a'.repeat(40), '2026-10-18T12:00:00Z', f.context);
  assert.deepEqual(f.task, oldTask); assert.deepEqual(f.result, oldResult);
  assert.equal(revised.status, 'blocked'); assert.match(revised.lastFailure, /^SUPERSEDED_BY_VERIFIED_DELIVERY:/);
  for (const key of ['candidateSha', 'baseSha', 'sessionId', 'attempt', 'deliveryReceipt', 'implementationFailures', 'infrastructureRetries']) assert.deepEqual(revised[key], oldTask[key]);
  assert.deepEqual(revised.recoveryHistory.slice(0, -1), oldTask.recoveryHistory);
  assert.equal(revised.recoveryHistory.at(-1).previousFailure, oldTask.lastFailure);
  assert.equal(revised.recoveryHistory.at(-1).originalResultSha256, f.hashes.resultSha256);
  assert.equal(revised.supersessionEvidence.classificationOnly, true); assert.equal(revised.productionVerifiedAt, undefined);
  assert.equal(revised.deliveryReceipt.status, 'blocked'); assert.equal(revised.nextDeliveryAt, null);
});
for (const [name, change] of [
  ['different original task', f => { f.task.id = f.update.expected.id = f.update.card.id = 'another-n88-task'; }],
  ['wrong original product', f => { f.task.productId = f.update.card.productId = 'N64'; }],
  ['wrong replacement product', f => { f.replacement.productId = 'N64'; }],
  ['wrong replacement activation', f => { f.replacement.activationId = 'other'; }],
  ['replacement pending', f => { f.replacement.status = 'pending'; }],
  ['replacement running', f => { f.replacement.status = 'running'; }],
  ['replacement current identity drift', f => { f.context.replacementSha256 = 'f'.repeat(64); }],
  ['wrong original session', f => { f.task.sessionId = f.update.expected.sessionId = 'other'; }],
  ['wrong original run', f => { f.task.attempt.runId = f.update.expected.lastRunId = 'other'; }],
  ['wrong original result task', f => { f.result.taskId = 'other'; }],
  ['wrong original result run', f => { f.result.runId = 'other'; }],
  ['changed original result preimage', f => { f.context.resultSha256 = 'e'.repeat(64); }],
  ['original PID absence unproved', f => { f.task.lastWorkerReap.exactAbsence = false; }],
  ['original runner alive', f => { f.task.runnerPid = 42; }],
  ['original broker alive', f => { f.task.brokerPid = 43; }],
  ['original still running', f => { f.task.status = f.update.expected.status = 'running'; }],
  ['original check failed', f => { f.result.checks[0].status = 'FAIL'; }],
  ['hosted activation recast as PASS', f => { f.result.checks.find(c => c.status === 'NOT_RUN').status = 'PASS'; }],
  ['different optional NOT_RUN', f => { f.result.checks.find(c => c.status === 'NOT_RUN').name = 'other'; }],
  ['policy refusal', f => { f.task.lastFailure = 'blocked by policy'; }],
  ['cybersecurity refusal', f => { f.task.lastModelError = 'This content was flagged for possible cybersecurity risk.'; }],
  ['historical policy refusal', f => { f.task.recoveryHistory.push({previousFailure:'blocked by policy'}); }],
  ['live original authority', f => { f.task.liveAuthorizationRef = 'actual-live'; }],
  ['live replacement authority', f => { f.replacement.liveAuthorizationRef = 'actual-live'; }],
  ['schema authority', f => { f.replacement.preparationAuthority.hostedSchemaChange = true; }],
  ['Auth/RLS authority', f => { f.integration.preparationAuthority.AuthRLSChange = true; }],
  ['original scope expanded', f => { f.update.card.allowedPaths.push('src/store.js'); }],
  ['original verification paths changed', f => { f.update.card.verificationPaths = ['another.js']; }],
  ['replacement provider failed', f => { f.replacement.deliveryReceipt.provider.conclusion = 'failure'; }],
  ['replacement immutable proof missing', f => { f.replacement.deliveryReceipt.evidence.immutable.passed = false; }],
  ['replacement candidate binding changed', f => { f.replacement.deliveryReceipt.binding.candidateSha = '1'.repeat(40); }],
  ['replacement served asset changed', f => { f.replacement.deliveryReceipt.evidence.production.assets[0].verified = false; }],
  ['integration receipt changed', f => { f.context.integrationReceiptSha256 = 'e'.repeat(64); }],
  ['missing coverage pointer', f => { f.update.card.historicalSupersession.coverageEvidencePath = '../other.json'; }],
  ['changed coverage bytes', f => { f.context.coverageSha256 = 'b'.repeat(64); }],
  ['coverage claims original success', f => { f.coverage.originalPublicationClaimed = true; }],
  ['wrong inherited source blob', f => { f.coverage.inheritedPaths[0].blobSha = '9'.repeat(40); }],
  ['missing actual ancestry check', f => { delete f.context.assertAncestor; }]
]) test('historical guard rejects ' + name, () => { const f = fixture(); change(f); assert.throws(() => verify(f)); });
test('valid-looking metadata still fails for a nonancestor in actual Git', () => {
  const f = fixture(), d = f.replacement.deliveryReceipt, published = f.task.baseSha;
  d.publishedSha = published; d.binding.publishedSha = published; d.provider.headSha = published;
  f.update.card.supersedingPublishedSha = published; f.coverage.replacement.publishedSha = published;
  const receiptSha = jsonHash(d); f.context.replacementReceiptSha256 = f.update.card.historicalSupersession.replacementReceiptSha256 = f.coverage.replacement.receiptSha256 = receiptSha;
  f.context.coverageSha256 = f.update.card.historicalSupersession.coverageEvidenceSha256 = jsonHash(f.coverage);
  assert.throws(() => verify(f), error => error.status === 1);
});
test('the existing generic supersession mode still rejects this LOCAL_READY attempt', () => {
  const f = fixture(); f.update.card.completionMode = 'superseded_by_verified_delivery'; assert.throws(() => verify(f), /Worker result identity changed/);
});
test('historical maintenance cannot acquire an active-worker exception', () => {
  const f = fixture(), sourceFile = 'scripts/ops-supervisor-v4/n88-complete-runtime-binding-20261018.json';
  const content = JSON.stringify({ activationId: f.task.activationId, tasks: [f.update.card] });
  const payload = { version:1, taskId:'historical-n88-fixture', activationId:f.task.activationId, repoRoot:'C:\\repo', opsWorktree:'C:\\repo\\.worktrees\\ops', runtimeRoot:'C:\\repo\\artifacts\\ops-supervisor-v4', commitMessage:'[AI] Fixture historical guard', files:[{repoPath:sourceFile,content,sha256:digest(Buffer.from(content)),expectedCanonicalSha256:'a'.repeat(64)}], sourceCardFile:sourceFile, cardUpdates:[f.update], requireNoActiveWorkers:true,allowActiveTaskIds:[] };
  validatePayload(payload);
  for(const alter of [p=>{delete p.requireNoActiveWorkers;},p=>{p.requireNoActiveWorkers=false;},p=>{p.requireNoActiveWorkers=false;p.allowActiveTaskIds=['other-task'];}]){const next=structuredClone(payload);alter(next);assert.throws(()=>validatePayload(next),/no-active-worker/);}
});
