// Reuse the existing actual account/DB/ownership setup, with only synthetic names.
export { prepareAccount, owner, foreignOwner } from './n73-account-flow-fixture.mjs';
export const exportedBundle = {
  schema: 'rakeez-private-teacher-setup', version: 1,
  categories: [
    { category: 'teacher', provenance: ['pasted-visible'], rows: [{ name: 'معلم تجريبي' }] },
    { category: 'school', provenance: ['selected-visible'], rows: [{ name: 'مدرسة تجريبية' }] },
    { category: 'principal', provenance: ['teacher-readonly-run'], rows: [{ name: 'مدير تجريبي' }] },
    { category: 'classes', provenance: ['pasted-visible'], rows: [{ classroom: 'خامس ألف' }] },
    { category: 'students', provenance: ['pasted-visible'], rows: [{ name: 'طالب تجريبي', classroom: 'خامس ألف' }] },
    { category: 'timetable', provenance: ['selected-visible'], rows: [{ weekday: 'الأحد', period: '1', time: '09:00-09:45', classroom: 'خامس ألف', subject: 'علوم تجريبية' }] },
  ],
};
export async function checkpoint() {
  const db = await import('../src/lib/db.js');
  return Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
}

// N36 names writes use the real N107 provenance gate, not the old preview-only
// account descriptor. Reuse its synthetic provisioning + boot resolver sequence.
export async function prepareNamesAccount() {
  const f = await import('./n73-account-flow-fixture.mjs');
  await f.prepareAccount();
  const s = await import('../src/store.js'), d = await import('../src/lib/db.js');
  const receipt = { ownerId:f.owner, contractVersion:1, foundationHash:'n36-browser-synthetic' };
  s.state.device.accountProvisioningReceipt=receipt; await d.put('device',s.state.device);
  const registry=(await import('../src/lib/workspaces.js')).createWorkspaceRegistry();
  try { await registry.registerProvisionedAccount(f.owner,receipt); } finally { await registry.close(); }
  const routing=await(await import('../src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
  if(routing.status!=='ready') throw Error(JSON.stringify(routing));
  s.activateWorkspace(routing.workspace);
  await(await import('../src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  s.assertClassImportAccess(); (await import('../src/repaint.js')).repaint();
  return {ready:s.state.ready,lease:s.getOfflineLeaseStatus(),outbox:await d.getAll('outbox')};
}
