import { SYNC_V2_SCHEMAS } from './sync-v2.js';

/** Follow Product parents in the backup and current cloud, never device preferences.
 * Missing descendants of a deleted scope or a closed term cannot be recreated.
 * Current canonical rows remain authoritative and are reconciled unchanged. */
export function restoreSuppressionReason(storeName, record, backup, server, seen = new Set()) {
  const key = `${storeName}:${record.id}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const canonical = (server[storeName] ?? []).find(row => row.id === record.id);
  if (canonical?.deleted) return 'server-tombstone';
  if (storeName === 'terms' && canonical?.status === 'closed') return 'closed-term-scope';
  for (const [field, parentStore] of Object.entries(SYNC_V2_SCHEMAS[storeName]?.references ?? {})) {
    if (!record[field]) continue;
    const parent = (server[parentStore] ?? []).find(row => row.id === record[field]) ??
      (backup[parentStore] ?? []).find(row => row.id === record[field]);
    if (!parent) continue;
    const reason = restoreSuppressionReason(parentStore, parent, backup, server, seen);
    if (reason) return reason;
  }
  return null;
}
