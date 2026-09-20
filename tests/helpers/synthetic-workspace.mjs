import { webcrypto } from 'node:crypto';

import * as store from '../../src/store.js';
import { createWorkspaceRegistry, resolveWorkspace } from '../../src/lib/workspaces.js';

export const SYNTHETIC_WORKSPACE_OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export async function activateSyntheticAccountWorkspace({ ownerId = SYNTHETIC_WORKSPACE_OWNER } = {}) {
  const registry = createWorkspaceRegistry();
  try {
    await registry.registerAccount(ownerId, { cryptoProvider: webcrypto });
    const resolution = await resolveWorkspace({ type: 'account', authUserId: ownerId }, {
      registry,
      cryptoProvider: webcrypto,
    });
    if (resolution.status !== 'resolved') {
      throw new Error(`Synthetic account workspace did not resolve: ${resolution.reason}`);
    }
    return store.activateWorkspace(resolution.workspace);
  } finally {
    await registry.close();
  }
}
