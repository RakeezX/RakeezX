import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, permittedRepoPath, validatePayload, validateRuntimeConfigUpdate, prepareRuntimeConfigUpdate, verifyRuntimeConfigConsumer } from '../apply-reviewed-maintenance.mjs';
import { validateControllerReload } from '../reviewed-controller-reload.mjs';

function fixture() {
  const config = { version: 5, maxWorkers: 3, maxActiveFamilies: 2, paidPlanner: false, defaultModel: 'existing-model',
    models: { STANDARD: { model: 'existing-standard-model', effort: 'medium' } },
    controller: { activationId: 'active', repoRoot: 'C:\\repo', codexPath: 'C:\\existing\\codex.exe', productionUrl: 'https://rakeezx.com' } };
  const raw = Buffer.from('\uFEFF' + JSON.stringify(config, null, 2).replaceAll('\n', '\r\n') + '\r\n');
  const update = { expectedSha256: sha256(raw), expectedMaxWorkers: 3, maxWorkers: 5, authorityRef: 'po-20261018-five-workers', reason: 'Latest PO authorizes up to five independent useful Product workers.' };
  const reload = { expectedIdentity: { pid: 101, createdAt: '2026-10-18T09:00:00.1234567Z', instanceId: 'old-controller' }, expectedControllerSha256: 'a'.repeat(64), expectedStartOpsSha256: 'b'.repeat(64), expectedScheduledLauncherSha256: 'c'.repeat(64), expectedScheduledActionSha256: 'd'.repeat(64), authorityRef: update.authorityRef, reason: 'Load the reviewed controller support through its existing Scheduled Task.' };
  const payload = { version: 1, taskId: 'capacity-maintenance', activationId: 'active', repoRoot: 'C:\\repo', opsWorktree: 'C:\\repo\\.worktrees\\ops', runtimeRoot: 'C:\\repo\\artifacts\\ops-supervisor-v4', commitMessage: '[AI] Reviewed capacity configuration', files: [], cardUpdates: [], requireNoActiveWorkers: true, runtimeConfigUpdate: update };
  return { config, raw, update, reload, payload };
}
test('capacity patch changes only maxWorkers and preserves the reviewed preimage', () => {
  const { config, raw, update } = fixture(), before = Buffer.from(raw);
  const prepared = prepareRuntimeConfigUpdate(raw, update, 'active');
  assert.deepEqual(raw, before);
  assert.deepEqual(JSON.parse(prepared.content), { ...config, maxWorkers: 5 });
  assert.equal(prepared.beforeSha256, sha256(before));
  assert.equal(prepared.afterSha256, sha256(prepared.content));
});
for (const [name, change] of [
  ['source drift', f => { f.raw = Buffer.concat([f.raw, Buffer.from(' ')]); }],
  ['capacity drift', f => { f.update.expectedMaxWorkers = 2; }],
  ['invalid activation', f => { f.config.controller.activationId = 'other'; f.raw = Buffer.from(JSON.stringify(f.config)); f.update.expectedSha256 = sha256(f.raw); }],
  ['invalid workflow version', f => { f.config.version = 6; f.raw = Buffer.from(JSON.stringify(f.config)); f.update.expectedSha256 = sha256(f.raw); }],
  ['arbitrary field', f => { f.update.controller = { codexPath: 'C:\\other.exe' }; }],
  ['arbitrary path', f => { f.update.path = 'queue/card.json'; }],
  ['out of range', f => { f.update.maxWorkers = 6; }],
  ['noninteger', f => { f.update.maxWorkers = 3.5; }],
  ['coerced capacity', f => { f.update.maxWorkers = '5'; }],
  ['unchanged capacity', f => { f.update.maxWorkers = 3; }],
  ['missing authority', f => { delete f.update.authorityRef; }]
]) test('capacity patch rejects ' + name, () => { const f = fixture(); change(f); assert.throws(() => prepareRuntimeConfigUpdate(f.raw, f.update, 'active')); });

test('config-only and reload-only payloads need explicit no-active-worker guards', () => {
  const { payload, reload } = fixture();
  assert.equal(validatePayload(payload).runtimeConfigUpdate.maxWorkers, 5);
  const reloadOnly = { ...payload, controllerReload: reload }; delete reloadOnly.runtimeConfigUpdate;
  assert.equal(validatePayload(reloadOnly).controllerReload.expectedIdentity.pid, 101);
  for (const change of [p => { delete p.requireNoActiveWorkers; }, p => { p.requireNoActiveWorkers = false; }, p => { p.requireNoActiveWorkers = false; p.allowActiveTaskIds = ['active-task']; }]) {
    for (const original of [payload, reloadOnly]) { const copy = structuredClone(original); change(copy); assert.throws(() => validatePayload(copy)); }
  }
  assert.equal(permittedRepoPath('artifacts/ops-supervisor-v4/workflow-v5.json'), false);
  const expanded = structuredClone(payload); expanded.files = [{ repoPath: 'artifacts/ops-supervisor-v4/workflow-v5.json', content: '{}', sha256: sha256(Buffer.from('{}')), expectedCanonicalSha256: 'a'.repeat(64) }];
  assert.throws(() => validatePayload(expanded), /Outside permitted/);
});
test('a config-only update refuses an old loaded controller', () => {
  const { update } = fixture();
  assert.throws(() => verifyRuntimeConfigConsumer({ maxWorkers: 3 }, update), /not loaded/);
  verifyRuntimeConfigConsumer({ maxWorkers: 3, supportedMaxWorkers: 5 }, update);
});
test('reload contract binds exact identity and reviewed sources without alternate actions', () => {
  const { reload } = fixture(); assert.deepEqual(validateControllerReload(reload), reload);
  for (const change of [r => { r.expectedIdentity.pid = -1; }, r => { r.expectedIdentity.createdAt = 'yesterday'; }, r => { delete r.expectedScheduledActionSha256; }, r => { r.taskName = 'another-task'; }, r => { r.expectedIdentity.command = 'arbitrary'; }]) {
    const copy = structuredClone(reload); change(copy); assert.throws(() => validateControllerReload(copy));
  }
  assert.throws(() => validateRuntimeConfigUpdate(null));
});
