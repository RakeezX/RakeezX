// Local synthetic Auth/lease evidence, never usable by a browser/live account.
import * as cloud from '../../src/lib/cloud.js';
import * as store from '../../src/store.js';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';
export class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key,value) { this.values.set(key,String(value)); }
  removeItem(key) { this.values.delete(key); }
}
globalThis.localStorage ??= new MemoryStorage();
export async function renewSyntheticLease(owner) {
  globalThis.localStorage ??= new MemoryStorage();
  const session = { access_token: 'synthetic', expires_at: 4102444800, user: { id: owner } };
  cloud.setMockAuth({ id: owner }, session);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
}
