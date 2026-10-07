import * as db from '../../src/lib/db.js';

/** Seed disposable IndexedDB fixtures; this is never a Product restore path. */
export async function seedBackupRows(payload) {
  const data = Object.fromEntries(Object.entries(payload.data ?? {})
    .filter(([name, rows]) => db.STORES.includes(name) && !['device', 'meta', 'outbox'].includes(name) && Array.isArray(rows)));
  return db.writeAll(data, 'replace', { keep: ['device', 'meta', 'outbox'] });
}
