// AI: restore only the existing synthetic account, never re-provision its data.
export async function restore(){
 const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');
 const {owner,capability}=await import('/tests/n73-account-flow-fixture.mjs');
 s.deactivateWorkspace();
 const session={access_token:'synthetic-local-only',user:{id:owner},expires_at:Math.floor(Date.now()/1000)+3600};
 c.setMockAuth(session.user,session);c.setMockBackend({getScoreFoundationCapability:async()=>capability});
 const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:owner}});
 if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
 await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
 await s.init();s.assertClassImportAccess();(await import('/src/repaint.js')).repaint();
}
