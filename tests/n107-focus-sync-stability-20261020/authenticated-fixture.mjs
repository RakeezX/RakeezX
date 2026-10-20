// AI-authored N107 local fixture: authenticate the fabricated owner and establish
// lease evidence through the existing API. No guard, receipt or Product code override.
import * as store from '../../src/store.js';
import * as cloud from '../../src/lib/cloud.js';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
export function authenticate(ownerId, token = 'synthetic-local-only') {
  const session = { user: { id: ownerId }, access_token: token, expires_at: Math.floor(Date.now()/1000)+3600 };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  return session;
}
export async function renew(ownerId) {
  store.getOfflineLeaseStatus(); // refresh owner context after the test-only setMockAuth hook
  return runtimeOfflineLease().renew(async () => ({ id: ownerId, source: 'supabase-auth-user', verifiedAt: Date.now() }));
}
