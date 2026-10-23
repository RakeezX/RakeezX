// AI-authored. Adapt the existing n90-account-fixture to local-only grade entry.
// No service endpoints, real identities or ownership/lease guard substitutions.
export async function account({ seed = false } = {}) {
  const store = await import('/src/store.js');
  const db = await import('/src/lib/db.js');
  const cloud = await import('/src/lib/cloud.js');
  const { accountWorkspaceDatabaseName } = await import('/src/lib/workspaces.js');
  const { runtimeOfflineLease } = await import('/src/lib/offline-lease.js');
  const owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const names = ['years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'scoreSubitems', 'scoreSubitemCompletions'];
  // Preserve the existing fabricated dataset, but give account rows ordinary IDs:
  // demo:-prefixed records intentionally bypass account outbox commands.
  const accountIds = value => JSON.parse(JSON.stringify(value).replaceAll('demo:', 'n09-fabricated:'));
  const rows = seed ? accountIds(Object.fromEntries(names.map(name => [name, store.state[name] ?? []]))) : null;
  const device = seed ? accountIds(store.state.device) : null;
  store.deactivateWorkspace();
  const session = { access_token: 'synthetic-local-only', user: { id: owner }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  cloud.setMockBackend({});
  store.activateWorkspace({ id: 'account:n09-synthetic', type: 'account', authUserId: owner,
    ownershipState: 'claimed', syncEligible: true, databaseName: await accountWorkspaceDatabaseName(owner),
    broadcastChannelName: 'n09-synthetic', leaseGeneration: JSON.stringify([owner, null, null, null]) });
  await runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
  if (seed) {
    await db.clearAll();
    for (const [name, records] of Object.entries(rows)) {
      if (records.length) await db.putMany(name, records.map(row => ({ ...row, ownerId: owner, canonicalId: row.id, serverRevision: 1 })));
    }
    await db.put('device', { ...device, schemaVersion: 8 });
    await db.put('profile', { id: 'profile', teacherName: 'معلم مصطنع', ownerId: owner, serverRevision: 1 });
  }
  await store.init();
  const teaching = store.teachings().find(t => store.items(t.id).filter(i => !i.auto && i.scoreMode !== 'subitems').length >= 2);
  if (!teaching) throw Error('Existing fabricated fixture needs two direct assessments');
  return { owner, database: store.getActiveWorkspace().databaseName, teaching: teaching.id,
    items: store.items(teaching.id).filter(i => !i.auto && i.scoreMode !== 'subitems').map(i => i.id),
    lease: store.getOfflineLeaseStatus(), ready: store.state.ready };
}
