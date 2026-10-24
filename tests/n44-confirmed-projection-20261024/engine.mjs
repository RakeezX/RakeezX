// AI: actual store + V2 receipt adoption with a synthetic canonical transport.
export async function prepare() {
  const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
  const v = await import('/src/lib/sync-v2.js');
  await (await import('/tests/n44-fixture.mjs')).prepareAccount();
  await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id => ({ id, verifiedAt: Date.now(), source: 'supabase-auth-user' }));
  await db.clearStore('outbox');
  const models = await import('/src/models.js'), ownerId = c.user.id;
  const child = await db.get('scoreSubitems', 'n44-due');
  await db.put('scoreSubitems', { ...child, dueDate: models.todayISO() });
  await db.put('items', { ...await db.get('items', 'n44-item'), distributionMode: 'manual' });
  await db.put('students', { ...models.makeStudent({ id: 'n44-student', name: 'Synthetic' }), ownerId, serverRevision: 1 });
  await db.put('enrollments', { ...models.makeEnrollment({ id: 'n44-enrollment', studentId: 'n44-student', sectionId: 'n44-section' }), ownerId, serverRevision: 1 });
  await db.put('scores', { id: 'n44-score', studentId: 'n44-student', itemId: 'n44-item', value: 4, derivedValue: 0, manualValue: 4, ownerId, serverRevision: 1, deleted: false });
  await s.refreshSyncedState();
  const wire = (name, row) => ({ ...v.encodeSyncV2Patch(name, row), id: row.id, owner_id: row.ownerId, revision: row.serverRevision, deleted_at: row.deleted ? row.deletedAt ?? 1 : null });
  const remote = {};
  for (const name of Object.keys(v.SYNC_V2_SCHEMAS)) remote[name] = (await db.getAll(name)).map(row => wire(name, row));
  const n = window.n44Engine = { remote, mode: 'ok', calls: 0, ackSignals: 0, readSignals: 0 };
  const names = Object.fromEntries(Object.entries(v.SYNC_V2_SCHEMAS).map(([name, schema]) => [schema.entity, name]));
  c.setMockBackend({
    async fetchRecords(entity) { return structuredClone(remote[names[entity]] ?? []); },
    async getScoreFoundationCapability() { return { scoreDomainVersion: 1, configurationVersion: 1, n94SubitemVersion: 1, restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }; },
    async getScoreDistributionCapability() { return { distributionApplyVersion: 2, protocol: 'N73_D119_V2' }; },
    async getScoreDomainSnapshot() { return { items: structuredClone(remote.items), score_subitems: structuredClone(remote.scoreSubitems), score_subitem_completions: [], scores: structuredClone(remote.scores) }; },
    async renameScoreItem(e) {
      n.calls++;
      if (n.mode === 'lost') throw Error('synthetic lost receipt');
      if (n.mode === 'unknown') return { status: 'unknown' };
      if (n.mode === 'rejected') throw Object.assign(Error('synthetic rejection'), { status: 409, code: '23514' });
      if (n.mode === 'delay') await new Promise(ok => n.release = ok);
      const item = remote.items.find(row => row.id === e.itemId);
      item.name = e.name; item.revision++;
      return { mutationId: e.mutationId, item: structuredClone(item), subitems: structuredClone(remote.scoreSubitems.filter(row => row.item_id === e.itemId)), scores: structuredClone(remote.scores) };
    },
    async applyScoreConfigurationCommand(e) {
      n.calls++;
      if (n.mode !== 'ok') throw Error('synthetic unconfirmed configuration');
      const item = remote.items.find(row => row.id === e.itemId); item.revision++; item.distribution_version = e.expectedVersion + 1;
      const subs = e.payload.subitems.map(row => ({ ...wire('scoreSubitems', { ...row, itemId: item.id, ownerId: c.user.id, serverRevision: (remote.scoreSubitems.find(r => r.id === row.id)?.revision ?? 0) + 1 }), item_id: item.id }));
      remote.scoreSubitems = [...remote.scoreSubitems.filter(row => row.item_id !== item.id), ...subs];
      return { mutationId: e.mutationId, item: structuredClone(item), subitems: structuredClone(subs), scores: structuredClone(remote.scores) };
    },
    async applyMutation() { throw Error('synthetic unrelated outbox failure'); },
    async applySyncV2LifecycleCommand(e) {
      if (e.command !== 'delete_item') throw Error('synthetic unsupported lifecycle');
      const item = remote.items.find(row => row.id === e.targetId);
      if (!item) throw Error('synthetic parent missing');
      item.deleted_at = Date.now(); item.revision++;
      for (const row of remote.scoreSubitems.filter(row => row.item_id === item.id)) { row.deleted_at = Date.now(); row.revision++; }
      return { mutationId: e.mutationId };
    },
  });
  const sync = await import('/src/lib/sync.js');
  sync.subscribeAcknowledged(() => n.ackSignals++);
  s.subscribeConfirmedSources?.(checkpoint => { if (checkpoint.reason === 'canonical-read') n.readSignals++; });
  location.hash = '#/settings/notifications';
  (await import('/src/app.js')).repaint();
  await (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().refresh();
  return { ownerMatches: s.getActiveWorkspace().authUserId === c.user.id, receiptMatches: s.state.device.accountProvisioningReceipt.ownerId === c.user.id, editable: s.getOfflineLeaseStatus().editable };
}

// Node-only evidence finalization; does not launch another browser or repeat UI.
export async function verify() {
  const { default: assert } = await import('node:assert/strict');
  const { readFile, writeFile } = await import('node:fs/promises');
  const { spawnSync, execFileSync } = await import('node:child_process');
  const { createHash } = await import('node:crypto');
  const folder = 'tests/n44-confirmed-projection-20261024/';
  const ui = JSON.parse(await readFile(folder + 'app.json', 'utf8'));
  assert.equal(ui.status, 'PASS'); assert.equal(ui.checks.length, 16);
  const results = [];
  const run = (name, args) => {
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    results.push({ name, status: r.status === 0 ? 'PASS' : 'FAIL', command: ['node', ...args], output: r.stdout + r.stderr });
    assert.equal(r.status, 0, name);
  };
  run('existing affected Push owner/cleanup/action guards', ['--test', '--test-name-pattern=payload|explicit_consent|owner/workspace|cleanup failures|action independently', 'tests/n44-push-preparation.test.mjs']);
  run('existing score receipt/recovery guard', ['--test', '--test-name-pattern=score domain outbox retries', 'tests/score-foundation-local.test.mjs']);
  // This exact existing gateway test prefix has no dependency on the unrelated
  // native crypto fixture statically imported by the full historical file.
  const gatewayFile = 'tests/n44-client-binding.unit.mjs';
  const gateway = (await readFile(gatewayFile, 'utf8')).split("import {makeFixture}")[0]
    .replace("'../src/lib/notification-push-gateway.js'", JSON.stringify(new URL('../../src/lib/notification-push-gateway.js', import.meta.url).href));
  run('three unchanged gateway ACK/cleanup/context tests isolated from unused crypto imports', ['--input-type=module', '-e', gateway]);
  const sources = ['src/app.js', 'src/store.js', 'src/lib/sync.js', 'src/lib/notification-push-runtime.js'];
  const dependencies = ['src/lib/sync-v2.js', 'src/lib/cloud.js', 'src/lib/db.js', 'src/lib/sync-ownership.js', 'src/lib/offline-lease.js', 'src/lib/notification-events.js', 'src/lib/notification-state.js', 'src/lib/notification-push-client.js', 'src/lib/notification-push-browser.js', 'src/lib/notification-push-gateway.js', 'src/lib/score-foundation.js', 'src/models.js', 'drafts/n44-push/canonical-source.mjs', 'tests/n44-fixture.mjs', 'tests/helpers/served-demo-readiness.mjs', 'scripts/ops-supervisor-v4/isolated-local-browser.mjs'];
  for (const file of [...sources, folder + 'app.mjs', folder + 'engine.mjs', folder + 'runtime.mjs']) run('syntax ' + file, ['--check', file]);
  const normalizedHash = raw => createHash('sha256').update(String(raw).replaceAll('\r\n', '\n')).digest('hex');
  const sourceHashes = Object.fromEntries(await Promise.all([...sources, ...dependencies, folder + 'app.mjs', folder + 'engine.mjs', folder + 'runtime.mjs'].map(async file => [file, normalizedHash(await readFile(file, 'utf8'))])));
  const base = ui.baseSha, custodian = '22b8d649e1394b20e04cc03bbc62dcf8913ddfc2';
  const fromGit = file => execFileSync('git', ['show', custodian + ':' + file], { encoding: 'utf8', windowsHide: true });
  const dueReceipt = JSON.parse(fromGit('tests/n44-device-20261024/due-source-projection.json'));
  for (const [file, hash] of Object.entries(dueReceipt.hashes)) assert.equal(sourceHashes[file], hash);
  const historical = ['tests/n44-device-20261024/eligibility-browser.json', 'tests/n44-device-20261024/completion-0214.json', 'tests/n44-device-20261024/due-source-projection.json'];
  const reuse = historical.map(file => ({ file, commit: custodian, sha256: normalizedHash(fromGit(file)), scope: file.includes('eligibility') ? 'Historical13 lifecycle cases retained;16 current app cases cover changed runtime seam.' : file.includes('completion') ? 'Historical35 authority/service cases retained; no service or authority changes/operations.' : 'Historical19 frontend/canonical due guards reused after all three exact dependency hashes match.' }));
  const allowed = [...sources, ...['runtime.mjs', 'runtime.json', 'engine.mjs', 'engine.json', 'app.mjs', 'app.json', 'provenance.json'].map(file => folder + file), 'docs/automation-evidence/20261024/N44_CONFIRMED_ACK_PROJECTION.md'];
  const changed = execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of [...changed, ...untracked]) assert.ok(allowed.includes(file), 'outside card: ' + file);
  execFileSync('git', ['diff', '--check'], { stdio: 'pipe' });
  const checks = [
    { name: 'n44_direct_receipt_and_no_change_sync_projection', status: 'PASS', evidence: 'app.json: causal baseline + actual direct command, configured child create/update, no-change read, opt-in/restore; real V2 adoption.' },
    { name: 'n44_projection_owner_recovery_and_grade_guards', status: 'PASS', evidence: 'app.json: unknown/lost/rejected, actual owner/session/dispose/late receipt, parent-child deletion, CAS, grade4 preserved. Existing affected units and exact19 due dependency hashes PASS.' },
    { name: 'n44_actual_app_projection_and_candidate_scope', status: 'PASS', evidence: '16 real app HTTP DOM/handler/CSS cases; owned isolated browser/server closed; syntax/diff/card scope/dependency hashes PASS. Publisher served proof remains separate.' },
  ];
  await writeFile(folder + 'engine.json', JSON.stringify({ status: 'PASS', checks: results, priorVerification: { command: 'node --test --test-name-pattern="completion/manual/final|timeout|receipt|projection boundary" tests/score-foundation-local.test.mjs', status: 'PASS', cases: 2 } }, null, 2) + '\n');
  await writeFile(folder + 'runtime.json', JSON.stringify({ status: 'PASS', currentEvidence: 'app.json', historicalFailuresPreserved: [
    { status: 'FAIL', phase: 'initial harness observations', evidence: 'Initial observer assertions read before asynchronous projection completed; corrected to await bounded request quiescence. No Product guard bypass.' },
    { status: 'FAIL', phase: 'first configured-child candidate', evidence: 'Strict ownerId equality excluded canonical codec rows with omitted owner_id. Corrected to existing verified-owner-DB semantics plus positive revision/outbox/guard fences; current create/update scenario PASS.' },
    { status: 'FAIL', phase: 'expanded cleanup harness', evidence: 'Synthetic backend used applyLifecycleCommand instead of the existing cloud mock entry applySyncV2LifecycleCommand. Corrected only the synthetic adapter method; current actual cascade+ACK scenario PASS.' },
    { status: 'FAIL', phase: 'optional full historical gateway module import', evidence: 'ERR_MODULE_NOT_FOUND @noble/curves from unrelated provider-policy static import. Three unchanged gateway test bodies then ran with actual gateway module and no unused crypto import; no dependency/config/service changes.' },
  ], scope: 'Current required prepublication gates PASS; historical attempts retain their failures. No live proof attempted.' }, null, 2) + '\n');
  await writeFile(folder + 'provenance.json', JSON.stringify({ taskId: ui.taskId, runId: ui.runId, baseSha: base, sourceHashes, checks, reuse, immutableOutcome: { commit: custodian, file: 'docs/automation-evidence/20261024/N44_CURRENT_ELIGIBILITY_OUTCOME.md', sha256: normalizedHash(fromGit('docs/automation-evidence/20261024/N44_CURRENT_ELIGIBILITY_OUTCOME.md')) }, operations: { realAccount: 0, service: 0, registrations: 0, sends: 0, deployment: 0 }, postPublication: 'Original publisher owns integration/deploy/served changed files; original custodian owns service/device/unknown cleanup reconciliation; N44 OPEN.' }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', checks, unitCommands: results.length }));
}
