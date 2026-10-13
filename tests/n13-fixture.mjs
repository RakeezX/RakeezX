import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from './helpers/synthetic-workspace.mjs';

// Same isolated account resolver as existing tests; synthetic Auth evidence only.
export async function n13Account(ownerId = SYNTHETIC_WORKSPACE_OWNER) {
  if (!globalThis.localStorage) {
    const values = new Map();
    globalThis.localStorage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  }
  const session = { access_token: 'n13-synthetic-only', user: { id: ownerId } };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  await activateSyntheticAccountWorkspace({ ownerId });
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async () => ({ id: ownerId, source: 'supabase-auth-user', verifiedAt: Date.now() }));
}
