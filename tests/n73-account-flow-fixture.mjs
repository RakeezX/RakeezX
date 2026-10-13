import * as models from '../src/models.js';
import { planAcceptedDistribution, distributionToken } from '../src/lib/score-foundation.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';

export const owner = 'a7300000-0000-4000-8000-000000000001';
export const foreignOwner = 'b7300000-0000-4000-8000-000000000002';
export const source = 'n73-source', target = 'n73-target', second = 'n73-second';
export const capability = { distributionApplyVersion: 2, protocol: 'N73_D119_V2',
  scoreDomainVersion: 1, restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1, n94SubitemVersion: 1 };

export function fixture() {
  const owned = row => ({ ...row, ownerId: owner, serverRevision: 1 });
  return {
    profile: [owned(models.makeProfile())],
    device: [models.makeDevice({ schemaVersion: 8, deviceId: 'n73-synthetic-device', activeYearId: 'n73-year', activeTermId: 'n73-term' })],
    years: [owned(models.makeYear({ id: 'n73-year' }))],
    terms: [owned(models.makeTerm({ id: 'n73-term', yearId: 'n73-year' })), owned(models.makeTerm({ yearId:'n73-year', index:2, status:'upcoming' }))],
    timeProfiles: models.DEFAULT_TIME_PROFILES.map(row => owned(models.makeTimeProfile(row))),
    subjects: [owned(models.makeSubject({ id: 'n73-subject', name: 'N73 synthetic' }))],
    sections: [source, target, second].map((id, index) => owned(models.makeSection({ id: id+'-section', yearId: 'n73-year', grade: 5, label: String(index+1) }))),
    teachings: [source, target, second].map(id => owned(models.makeTeaching({ id, sectionId: id+'-section', termId: 'n73-term', subjectId: 'n73-subject', name: 'N73 synthetic' }))),
    students: [1,2].map(n => owned(models.makeStudent({ id: 'n73-student'+n, name: 'Synthetic '+n }))),
    items: [models.makeItem({ id: 'n73-source-exam', teachingId: source, name: 'Exam', max: 20, order: 0 }),
      models.makeItem({ id: 'n73-target-exam', teachingId: target, name: 'Exam', max: 25, order: 0 }),
      models.makeItem({ id: 'n73-extra', teachingId: target, name: 'Extra', max: 5, order: 1 })].map(owned),
    scores: [{ id: 'n73-source-score', itemId: 'n73-source-exam', studentId: 'n73-student1', value: 19 },
      { id: 'n73-cap', itemId: 'n73-target-exam', studentId: 'n73-student1', value: 23 },
      { id: 'n73-valid', itemId: 'n73-target-exam', studentId: 'n73-student2', value: 18 },
      { id: 'n73-extra-score', itemId: 'n73-extra', studentId: 'n73-student1', value: 4 }].map(owned),
    scoreSubitems: [], scoreSubitemCompletions: [], units: [], lessons: [], logs: [],
  };
}

// Bounded HTTP service fixture; the real store and Sync engine remain unmodified.
export function syntheticService() {
  let current = fixture(), sequence = 0, mode = null;
  const plans = new Map(), receipts = new Map();
  const evidence = { plans: [], envelopes: [], commits: 0 };
  return { evidence, get current() { return current; }, setMode(value) { mode = value; },
    async request(name, input) {
      if (name === 'fixture') return current;
      if (name === 'auth') return { id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() };
      if (name === 'capability') return capability;
      if (name === 'plan') {
        evidence.plans.push(structuredClone(input));
        if (mode === 'plan-failed') throw Object.assign(new Error('Synthetic plan unavailable'), { status: 503 });
        const plan = planAcceptedDistribution(current, input.sourceTeachingId, input.targetTeachingIds,
          { ownerId: owner, removeItemIds: input.removeItemIds, id: () => 'n73-created-'+(++sequence) });
        const publicPlan = { ...plan, protocol: 'N73_D119_V2', planId: input.planId };
        delete publicPlan.writes;
        plans.set(input.planId, { plan, input });
        if (mode === 'stale-review') publicPlan.token += ':stale:'+sequence++;
        return publicPlan;
      }
      if (name === 'apply') {
        evidence.envelopes.push(structuredClone(input));
        if (receipts.has(input.mutationId)) return receipts.get(input.mutationId);
        const saved = plans.get(input.planId);
        if (!saved || saved.plan.token !== input.token || saved.plan.token !== distributionToken(current, saved.input.sourceTeachingId, saved.input.targetTeachingIds) || mode === 'stale-apply') {
          throw Object.assign(new Error('Synthetic stale distribution plan'), { status: 409, code: 'PT409' });
        }
        if (saved.plan.requiresConfirmation && !input.confirmed) throw Object.assign(new Error('Confirmation required'), { status: 409 });
        const receipt = { mutationId: input.mutationId, planId: input.planId, protocol: 'N73_D119_V2' };
        for (const [store, entity] of [['items','items'],['scores','scores'],['scoreSubitems','score_subitems'],['scoreSubitemCompletions','score_subitem_completions']]) {
          const rows = saved.plan.writes[store].put.map(row => ({ ...row, ownerId: owner, serverRevision: (row.serverRevision ?? 0)+1 }));
          for (const row of rows) {
            const index = current[store].findIndex(r => r.id === row.id);
            if (index < 0) current[store].push(row); else current[store][index] = row;
          }
          receipt[entity] = rows.map(row => ({ ...encodeSyncV2Patch(store, row), id: row.id, owner_id: owner,
            revision: row.serverRevision, deleted_at: row.deleted ? '2026-10-13T00:00:00Z' : null }));
        }
        evidence.commits++;
        receipts.set(input.mutationId, receipt);
        if (mode === 'lost-receipt') { mode = null; throw Object.assign(new Error('Synthetic lost receipt'), { status: 503 }); }
        return receipt;
      }
      throw new Error('Unknown synthetic endpoint');
    },
  };
}

export async function prepareAccount() {
  const store = await import('../src/store.js'), db = await import('../src/lib/db.js');
  const cloud = await import('../src/lib/cloud.js');
  const { runtimeOfflineLease } = await import('../src/lib/offline-lease.js');
  const { accountWorkspaceDatabaseName } = await import('../src/lib/workspaces.js');
  const http = async (name, input = {}) => {
    const response = await fetch('/__n73/'+name, { method: 'POST', body: JSON.stringify(input) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message), data);
    return data;
  };
  store.deactivateWorkspace();
  const session = { access_token: 'synthetic-local-only', user: { id: owner }, expires_at: Math.floor(Date.now()/1000)+3600 };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  cloud.setMockBackend({ getScoreFoundationCapability: () => http('capability'), getScoreDistributionCapability: () => http('capability'),
    planScoreDistribution: input => http('plan', input),
    async applyScoreDistributionPlan(input) {
      const durable = (await db.getAll('outbox')).find(row => row.mutationId === input.mutationId);
      if (durable?.ownerId !== owner || durable.command !== 'score:distribution_apply') throw new Error('Missing exact owner-bound durable command');
      return http('apply', input);
    },
  });
  const workspace = { id: 'account:n73-synthetic', type: 'account', authUserId: owner, ownershipState: 'claimed', syncEligible: true,
    databaseName: await accountWorkspaceDatabaseName(owner), broadcastChannelName: 'n73-synthetic', leaseGeneration: JSON.stringify([owner,null,null,null]) };
  store.activateWorkspace(workspace);
  await runtimeOfflineLease().renew(() => http('auth'));
  const rows = await http('fixture');
  for (const [name, records] of Object.entries(rows)) if (records.length) await db.putMany(name, records);
  await store.init();
  return { workspace: store.getActiveWorkspace(), lease: store.getOfflineLeaseStatus(), outbox: await db.getAll('outbox'), ready: store.state.ready };
}
