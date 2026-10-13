import * as models from '../src/models.js';
export async function prepareAccount() {
  const store=await import('../src/store.js'),db=await import('../src/lib/db.js'),cloud=await import('../src/lib/cloud.js');
  const {runtimeOfflineLease}=await import('../src/lib/offline-lease.js');
  const {accountWorkspaceDatabaseName}=await import('../src/lib/workspaces.js');
  const http=async(name,input={})=>{const r=await fetch('/__n90/'+name,{method:'POST',body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),data);return data;};
  const owner=(await http('auth')).id;
  store.deactivateWorkspace();
  const session={access_token:'synthetic-local-only',user:{id:owner},expires_at:Math.floor(Date.now()/1000)+3600};
  localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);
  cloud.setMockBackend({getScoreFoundationCapability:()=>http('capability'),getGradeImportCapability:()=>http('grade-capability'),
    async applyReviewedGradeImport(input) {
      const durable=(await db.getAll('outbox')).find(r=>r.mutationId===input.mutationId);
      if(durable?.ownerId!==owner||durable.command!=='score:grade_import'||durable.databaseName&&durable.databaseName!==store.getActiveWorkspace().databaseName)throw Error('Missing owner-bound durable grade command');
      return http('apply',input);
    }});
  store.activateWorkspace({id:'account:n90-synthetic',type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true,
    databaseName:await accountWorkspaceDatabaseName(owner),broadcastChannelName:'n90-synthetic',leaseGeneration:JSON.stringify([owner,null,null,null])});
  await runtimeOfflineLease().renew(()=>http('auth'));
  const rows=await http('fixture');
  rows.profile=[{...models.makeProfile(),ownerId:owner,serverRevision:1}];
  rows.device=[models.makeDevice({schemaVersion:8,deviceId:'n90-synthetic-device',activeYearId:'y',activeTermId:'term'})];
  rows.timeProfiles=models.DEFAULT_TIME_PROFILES.map(r=>models.makeTimeProfile(r));
  for(const [name,records] of Object.entries(rows))if(records.length)await db.putMany(name,records);
  await store.init();return {workspace:store.getActiveWorkspace(),lease:store.getOfflineLeaseStatus(),outbox:await db.getAll('outbox'),ready:store.state.ready};
}
