import { LEGACY_WORKSPACE_DB_NAME } from './workspaces.js';

export const SYNC_OWNERSHIP_BLOCKED = 'SYNC_OWNERSHIP_BLOCKED';

const AUTH_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LEGACY_UNCLAIMED_SYNC_WORKSPACE = Object.freeze({
  id: 'legacy',
  type: 'legacy',
  authUserId: null,
  databaseName: LEGACY_WORKSPACE_DB_NAME,
  ownershipState: 'unclaimed',
  syncEligible: false,
});

function normalizedOwnerId(value) {
  const ownerId = String(value ?? '').trim().toLowerCase();
  return AUTH_USER_ID_PATTERN.test(ownerId) ? ownerId : null;
}

function normalizeWorkspace(workspace) {
  if (workspace?.type === 'account' && workspace?.ownershipState === 'claimed' &&
      workspace?.syncEligible === true) {
    const workspaceOwnerId = normalizedOwnerId(workspace.authUserId);
    if (workspaceOwnerId) {
      return Object.freeze({ ...workspace, authUserId: workspaceOwnerId, workspaceOwnerId });
    }
    return Object.freeze({ type: 'unresolved', ownershipState: 'unresolved', reason: 'workspace-owner-missing' });
  }
  if (workspace?.type === 'legacy' && workspace?.ownershipState === 'unclaimed' &&
      workspace?.databaseName === LEGACY_WORKSPACE_DB_NAME && workspace?.authUserId == null) {
    return LEGACY_UNCLAIMED_SYNC_WORKSPACE;
  }
  if (workspace?.type === 'demo' && workspace?.ownershipState === 'demo' && workspace?.syncEligible === false) {
    return Object.freeze({ ...workspace, authUserId: null, workspaceOwnerId: null });
  }
  return Object.freeze({
    type: 'unresolved', ownershipState: 'unresolved',
    reason: workspace?.reason || 'workspace-unresolved',
  });
}

function blocked(reason, workspace, extra = {}) {
  return Object.freeze({
    allowed: false,
    code: SYNC_OWNERSHIP_BLOCKED,
    reason,
    retryable: false,
    workspaceType: workspace.type,
    workspaceOwnerId: workspace.workspaceOwnerId ?? null,
    ...extra,
  });
}

function allowed(mode, workspace) {
  return Object.freeze({
    allowed: true,
    mode,
    workspaceType: workspace.type,
    workspaceOwnerId: workspace.workspaceOwnerId ?? null,
  });
}

/**
 * Local owner binding and cloud eligibility are intentionally one policy.
 * The temporary legacy exception is exact: only the unclaimed `rakeezx` DB
 * may dispatch ownerless commands until ACCOUNT-LEGACY-WORKSPACE-CLAIM-01.
 */
export function createSyncOwnershipGuard({ workspace = LEGACY_UNCLAIMED_SYNC_WORKSPACE } = {}) {
  let activeWorkspace = normalizeWorkspace(workspace);

  function setWorkspace(nextWorkspace) {
    activeWorkspace = normalizeWorkspace(nextWorkspace);
    return activeWorkspace;
  }

  function getWorkspace() {
    return activeWorkspace;
  }

  function enqueueAccess() {
    if (activeWorkspace.type === 'account' && activeWorkspace.ownershipState === 'claimed') {
      return allowed('claimed-account', activeWorkspace);
    }
    if (activeWorkspace === LEGACY_UNCLAIMED_SYNC_WORKSPACE) {
      return allowed('legacy-unclaimed', activeWorkspace);
    }
    if (activeWorkspace.type === 'demo') return blocked('demo-sync-disabled', activeWorkspace);
    return blocked(activeWorkspace.reason || 'workspace-unresolved', activeWorkspace);
  }

  function bindNewCommand(command) {
    const access = enqueueAccess();
    if (!access.allowed) throw ownershipBlockedError(access);
    if (access.mode === 'legacy-unclaimed') {
      if (command?.ownerId != null) {
        throw ownershipBlockedError(blocked('owned-command-in-legacy-workspace', activeWorkspace));
      }
      return command;
    }
    const ownerWasSupplied = command?.ownerId != null;
    const suppliedOwnerId = ownerWasSupplied ? normalizedOwnerId(command.ownerId) : null;
    if (ownerWasSupplied && suppliedOwnerId !== access.workspaceOwnerId) {
      throw ownershipBlockedError(blocked('command-owner-mismatch', activeWorkspace, {
        commandOwnerId: suppliedOwnerId,
      }));
    }
    return { ...command, ownerId: access.workspaceOwnerId };
  }

  function cloudAccess({ operation, authenticatedUserId, command = null } = {}) {
    const cloudUserId = normalizedOwnerId(authenticatedUserId);
    if (activeWorkspace === LEGACY_UNCLAIMED_SYNC_WORKSPACE) {
      if (operation === 'dispatch' && command?.ownerId != null) {
        return blocked('owned-command-in-legacy-workspace', activeWorkspace, {
          commandOwnerId: normalizedOwnerId(command.ownerId), cloudUserId,
        });
      }
      return allowed('legacy-unclaimed', activeWorkspace);
    }
    if (activeWorkspace.type === 'demo') return blocked('demo-sync-disabled', activeWorkspace, { cloudUserId });
    if (activeWorkspace.type !== 'account' || activeWorkspace.ownershipState !== 'claimed') {
      return blocked(activeWorkspace.reason || 'workspace-unresolved', activeWorkspace, { cloudUserId });
    }
    if (!cloudUserId) return blocked('authenticated-user-missing', activeWorkspace, { cloudUserId: null });
    if (cloudUserId !== activeWorkspace.workspaceOwnerId) {
      return blocked('authenticated-user-owner-mismatch', activeWorkspace, { cloudUserId });
    }
    if (operation === 'dispatch') {
      const commandOwnerId = normalizedOwnerId(command?.ownerId);
      if (!commandOwnerId) {
        return blocked('command-owner-missing', activeWorkspace, { cloudUserId, commandOwnerId: null });
      }
      if (commandOwnerId !== activeWorkspace.workspaceOwnerId) {
        return blocked('command-owner-mismatch', activeWorkspace, { cloudUserId, commandOwnerId });
      }
    }
    return allowed('claimed-account', activeWorkspace);
  }

  return Object.freeze({ setWorkspace, getWorkspace, enqueueAccess, bindNewCommand, cloudAccess });
}

export function ownershipBlockedError(access) {
  return Object.assign(new Error(`Sync ownership blocked: ${access?.reason ?? 'workspace-unresolved'}`), {
    code: SYNC_OWNERSHIP_BLOCKED,
    reason: access?.reason ?? 'workspace-unresolved',
    retryable: false,
    ownershipAccess: access ?? null,
  });
}

// Normal Production remains on the exact, ownerless legacy compatibility path.
// A later workspace-activation ticket will replace this context only after a
// persisted registry descriptor has been verified and its DB selected.
export const runtimeSyncOwnershipGuard = createSyncOwnershipGuard();
