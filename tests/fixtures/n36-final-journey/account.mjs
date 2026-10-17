// AI: reuse account provisioning/ownership fixture; fabricate only network responses.
import {prepareNamesAccount, checkpoint} from '../../n36-receiver-fixture.mjs';
export {checkpoint};
export async function prepare(){
 const ready=await prepareNamesAccount();
 const cloud=await import('../../../src/lib/cloud.js'),db=await import('../../../src/lib/db.js'),store=await import('../../../src/store.js');
 cloud.setMockBackend({
  getScoreFoundationCapability:()=>window.journeyNetwork('capability',{}),
  getScoreDistributionCapability:()=>window.journeyNetwork('capability',{}),
  getUnifiedRestoreCapability:async()=>null,
  fetchOwnerSyncMarker:async()=>null,
  fetchRecords:entity=>window.journeyNetwork('records',{entity}),
  async applySyncV2Mutation(envelope){
   const w=store.getActiveWorkspace(),command=(await db.getAll('outbox')).find(r=>r.mutationId===envelope.mutationId);
   if(!command||command.ownerId!==cloud.user?.id||w.authUserId!==command.ownerId||command.databaseName&&command.databaseName!==w.databaseName)throw Error('Missing actual durable owner-bound mutation');
   return window.journeyNetwork('mutation',envelope);
  },
 });
 return ready;
}
export async function syncCheckpoint(){
 const store=await import('../../../src/store.js'),db=await import('../../../src/lib/db.js'),cloud=await import('../../../src/lib/cloud.js');
 const {createSyncV2Engine}=await import('../../../src/lib/sync-v2.js');
 const {runtimeSyncOwnershipGuard}=await import('../../../src/lib/sync-ownership.js');
 // Default Product transport and database; no mock engine or synthetic acknowledgement.
 const engine=createSyncV2Engine({ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cloud.user?.id??null});
 const dispatch=await engine.dispatchPending();await store.refreshSyncedState();
 return {dispatch,outbox:await db.getAll('outbox'),workspace:store.getActiveWorkspace(),lease:store.getOfflineLeaseStatus(),students:await db.getAll('students'),enrollments:await db.getAll('enrollments')};
}
