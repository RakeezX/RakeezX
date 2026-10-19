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
  for (const key of Object.keys(localStorage)) if (key.startsWith('rakeezx-offline-lease-v1:')) localStorage.removeItem(key);
  const initial = JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY));
  initial.user = {id: owner, email: 'synthetic@example.invalid', new_email: 'pending@example.invalid'};
  initial.expires_at = Math.floor(Date.now()/1000)+3600; initial.refresh_token = 'synthetic-refresh';
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(initial));
  window.seedReady = true;
}

window.probe = { reads: 0, markers: 0, authReads: 0, revision: '1', mode: 'normal', calls: [], started: performance.now() };
const http = async (name, input = {}) => {
  const response = await fetch('/__n123/' + name, { method: 'POST', body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(Error(result.message), result);
  return result;
};
const realFetch = window.fetch.bind(window);
window.fetch = (url, options) => String(url).includes('/auth/v1/token')
  ? realFetch('/__n123/refresh').then(() => new Response(JSON.stringify({access_token:'synthetic-refreshed',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner}})))
  : String(url).includes('/auth/v1/user')
  ? (window.probe.authReads++, fetch('/__n123/auth').then(() => window.probe.mode === 'auth-fail' ? new Response(JSON.stringify({message:'synthetic private auth detail'}),{status:503}) : new Response(JSON.stringify({ id: owner, email: 'synthetic@example.invalid', new_email: 'pending@example.invalid' })))) : realFetch(url, options);
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
    if (window.probe.mode === 'hold-read' && entity === 'students') await new Promise(done => window.probe.releaseRead = done);
    if (window.probe.mode === 'replace-session' && entity === 'students') {
      window.probe.mode = 'normal';
      cloud.setMockAuth(cloud.user, {...cloud.session, access_token: 'synthetic-actually-changed'});
      localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(cloud.session));
    }
    if (window.probe.mode === 'new-revision') window.probe.revision = '2';
    if (window.probe.mode === 'read-fail' && entity === 'students') throw Object.assign(Error('Synthetic read failure pupil-secret token-secret'),{status:503,code:'untrusted-pupil-secret',detail:'token-secret'});
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
