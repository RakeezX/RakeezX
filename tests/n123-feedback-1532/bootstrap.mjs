// AI-authored: synthetic transport only; application boot, DOM, store and guards are real.
import * as cloud from '../../src/lib/cloud.js';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import { prepareAccount, owner } from '../n73-account-flow-fixture.mjs';
import { createWorkspaceRegistry, resolveWorkspace } from '../../src/lib/workspaces.js';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';

if (new URL(location.href).searchParams.has('seed')) {
  await prepareAccount();
  await store.patchDevice({ accountProvisioningReceipt: { ownerId: owner, contractVersion: 1, foundationHash: 'synthetic-n123' } }, { notify: false, queue: false });
  const registry = createWorkspaceRegistry();
  try {
    await registry.registerProvisionedAccount(owner, { ownerId: owner, contractVersion: 1, foundationHash: 'synthetic-n123' });
    const resolution = await resolveWorkspace({ type: 'account', authUserId: owner }, { registry });
    store.activateWorkspace(resolution.workspace);
    await runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
  } finally { await registry.close(); }
  window.seedReady = true;
}

window.probe = { reads: 0, markers: 0, revision: '1', mode: 'normal', calls: [], started: performance.now() };
const http = async (name, input = {}) => {
  const response = await fetch('/__n123/' + name, { method: 'POST', body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(Error(result.message), result);
  return result;
};
const realFetch = window.fetch.bind(window);
window.fetch = (url, options) => String(url).includes('/auth/v1/user')
  ? Promise.resolve(new Response(JSON.stringify({ id: owner }))) : realFetch(url, options);
cloud.setMockBackend({
  getScoreFoundationCapability: () => null,
  getUnifiedRestoreCapability: () => null,
  fetchOwnerSyncMarker: async () => {
    window.probe.markers++;
    if (window.probe.mode === 'fail-validation' && window.probe.reads > window.probe.readThreshold) throw Error('Synthetic final marker unavailable');
    if (window.probe.mode === 'switch-validation' && window.probe.reads > window.probe.readThreshold) {
      store.activateWorkspace({ ...store.getActiveWorkspace() });
    }
    if (window.probe.mode === 'marker-fail') throw Error('Synthetic marker unavailable');
    if (window.probe.mode === 'marker-absent') return null;
    return { protocol: 'OWNER_SIGNAL_V1', ownerId: owner, revision: window.probe.revision };
  },
  openOwnerSyncChannel: () => () => {},
  fetchRecords: async entity => {
    window.probe.reads++;
    if (window.probe.mode === 'new-revision') window.probe.revision = '2';
    if (window.probe.mode === 'read-fail' && entity === 'students') throw Error('Synthetic read failure');
    return http('read', { entity });
  },
  applySyncV2Mutation: async envelope => {
    window.probe.calls.push(envelope);
    if (window.probe.mode === 'hold') await new Promise(done => window.probe.release = done);
    const result = await http('apply', envelope);
    return window.probe.mode === 'wrong' ? { ...result, mutationId: 'wrong' } : result;
  },
});
// Imported by the original index before app-update starts the unmodified app.
window.checkpoint = async () => ({
  owner: cloud.user?.id, workspace: store.getActiveWorkspace(),
  outbox: await db.getAll('outbox'), score: await db.get('scores', 'n73-valid'),
  summary: await (await import('/src/lib/sync.js')).getSyncOperationalSummary(),
});
