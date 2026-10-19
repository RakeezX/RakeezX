// AI-authored: reconcile saved evidence without repeating unchanged UI/service work.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const taskId = 'continuous-n125-return-focus-transient-sync-20261019';
const runId = 'b91583e5-801e-4688-96cc-e87edeca3baf';
const priorCandidate = '5c6ffc3ddd14778a17e33cf616baf6e97eeaab2f';
const directory = 'tests/n125-actual-1719/';
const git = args => execFileSync('git', args);
const hashes = {};
for (const path of [
  'src/app.js', 'src/lib/cloud.js', 'src/lib/sync.js', 'src/lib/sync-operational-ui.js',
  directory + 'returns.mjs', directory + 'bootstrap.mjs', directory + 'result.json',
  directory + 'auth-context.test.mjs', directory + 'auth-checks.txt',
  directory + 'baseline.json', directory + 'n95-base-failure.txt',
  directory + 'n95-base-source-pin-failure.txt',
]) {
  // Compare Git blobs to avoid platform line endings changing evidence identity.
  const before = git(['show', priorCandidate + ':' + path]);
  const current = git(['show', 'HEAD:' + path]);
  assert.deepEqual(current, before, 'Saved source/evidence changed: ' + path);
  hashes[path] = createHash('sha256').update(current).digest('hex');
}
const prior = JSON.parse(await readFile(directory + 'result.json', 'utf8'));
assert.equal(prior.runId, 'a4cffdb4-a229-4390-a948-7d6d37317a88');
assert.ok(prior.checks.some(check => check.name === 'n125_two_return_lifecycles_true_context_error_preserved' && check.status === 'PASS'));
assert.equal(prior.returns.length, 2);
assert.ok(prior.returns.every(cycle => !cycle.red && cycle.authReads === 1));
assert.equal(prior.realContextChange.state, 'error');
assert.match(prior.realContextChange.error, /sync-context-changed/);
assert.equal(prior.activeReturn.noFailure, true);
assert.match(prior.cleanup, /closed in finally/);
assert.match(await readFile(directory + 'n95-base-failure.txt', 'utf8'), /Score capability owner changed/);
assert.match(await readFile(directory + 'n95-base-source-pin-failure.txt', 'utf8'), /fail 1/);
const evidence = {
  taskId, runId, reusedFromRunId: prior.runId, priorCandidate, hashes,
  requiredCheck: prior.checks[0],
  currentCheck: { name: 'n125_saved_evidence_reconciliation', status: 'PASS',
    evidence: 'Affected source, UI harness and evidence blobs exactly match saved candidate; required UI PASS and original N95 failures retained unchanged. No UI or service operation repeated.' },
  historicalN95: { rerun: false, priorPassed: 3, priorFailed: 2,
    disposition: 'Unresolved historical exploratory failures; not converted to PASS. Full suite is not an activated N125 required check.' },
  resourcesCreated: [],
};
await writeFile(directory + 'resume-reconciliation.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence.currentCheck));
