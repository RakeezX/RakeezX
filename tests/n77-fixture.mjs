import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { n13Account } from './n13-fixture.mjs';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';

// Reuse the current owner/lease fixture rather than bypassing N49 for old tests.
export async function n77Account(ownerId) {
  if (store.getActiveWorkspace()) store.deactivateWorkspace();
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  await n13Account(ownerId);
  await store.init();
}

export async function n77Foundation() {
  const defaults = buildAccountFoundationDefaults();
  await db.putAcross(defaults);
  await db.patchMany('device', [{ id: 'device', patch: {
    activeYearId: defaults.years[0].id, activeTermId: defaults.terms[0].id,
  } }]);
  await store.refreshSyncedState();
}

/** Historical backup fixture writes are confined to disposable IndexedDB. */
export async function seedBackupRows(payload) {
  const data = Object.fromEntries(Object.entries(payload.data ?? {})
    .filter(([name, rows]) => db.STORES.includes(name) && !['device', 'meta', 'outbox'].includes(name) && Array.isArray(rows)));
  return db.writeAll(data, 'replace', { keep: ['device', 'meta', 'outbox'] });
}
