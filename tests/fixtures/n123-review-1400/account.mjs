import * as cloud from '../../../src/lib/cloud.js';
import * as sync from '../../../src/lib/sync.js';
import * as db from '../../../src/lib/db.js';
import * as store from '../../../src/store.js';
import { prepareAccount, owner } from '../../n73-account-flow-fixture.mjs';

export async function prepare() {
  await sync.suspendForWorkspaceDeactivation();
  await prepareAccount();
  const http = async (name, input = {}) => {
    const response = await fetch('/__n123/'+name, {method:'POST',body:JSON.stringify(input)});
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.message), result);
    return result;
  };
  window.n123 = { calls: [], mode: 'normal', reads: 0 };
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, options) => String(url).includes('/auth/v1/user')
    ? Promise.resolve(new Response(JSON.stringify({id:owner}))) : realFetch(url, options);
  cloud.setMockBackend({
    getScoreFoundationCapability: () => null,
    getUnifiedRestoreCapability: () => null,
    fetchRecords: async entity => { window.n123.reads++; return http('read',{entity}); },
    applySyncV2Mutation: async envelope => {
      window.n123.calls.push(envelope);
      if (window.n123.mode === 'hold') await new Promise(done => window.n123.release = done);
      const receipt = await http('apply',envelope);
      return window.n123.mode === 'wrong' ? {...receipt,mutationId:'wrong-receipt'} : receipt;
    },
    n77DeleteTeaching: async input => {
      const plan = {ownerId:owner,selectedTeachingId:input.teachingId,sectionId:input.sectionId,
        scope:'section',teachingIds:[input.teachingId],fingerprint:'n123-synthetic-plan'};
      if (!input.commit) return plan;
      window.n123.deleteStarted = performance.now();
      await new Promise(done => window.n123.releaseDelete = done);
      return {...plan,outcome:'deleted',mutationId:input.mutationId,
        cascadeTeachingIds:[input.teachingId],orphanStudentIds:[]};
    },
  });
  // Keep scheduling suspended until the measured actual coordinator entry.
  // Demo startup does not initialize account Sync event subscriptions.
  sync.init();
  (await import('../../../src/repaint.js')).repaint();
  return {owner,workspace:store.getActiveWorkspace(),outbox:await db.getAll('outbox')};
}
