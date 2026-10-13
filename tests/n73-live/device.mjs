import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { createSyncV2Engine } from '../../src/lib/sync-v2.js';
import { createSyncOwnershipGuard } from '../../src/lib/sync-ownership.js';
export async function device(owner, label, transport, { primary = false } = {}) {
  const database = primary ? await import('../../src/lib/db.js') : await import(`../../src/lib/db.js?device=${label}`);
  const databaseName = 'rakeezx-user-' + createHash('sha256').update(owner+':'+label).digest('hex').slice(0,32);
  database.selectDatabase(databaseName);
  await database.openDB();
  const ownershipGuard = createSyncOwnershipGuard({ workspace: {
    id: 'account:'+owner+':'+label, type:'account', authUserId:owner, databaseName, ownershipState:'claimed', syncEligible:true,
  } });
  const engine = createSyncV2Engine({ database, transport, ownershipGuard, currentAuthenticatedUserId: () => owner });
  return { database, engine, async close() { database.closeDB(); } };
}
