/** AI: fabricated boot only. Actual app shell, router, store, owner and lease gates stay intact. */
import * as store from '/src/store.js';
import * as cloud from '/src/lib/cloud.js';
import {runtimeOfflineLease} from '/src/lib/offline-lease.js';
import {accountWorkspaceDatabaseName} from '/src/lib/workspaces.js';
import {makeProfile,makeDevice} from '/src/models.js';
export async function bootstrap() {
  const c=await (await fetch('/review/context',{cache:'no-store'})).json();
  const user={id:c.ownerId,email:'synthetic@example.invalid'},session={user,access_token:c.token};
  cloud.setMockAuth(user,session);localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));
  cloud.setMockBackend({});
  const restore={protocol:'CORE_V2',restoreId:'synthetic-restore',manifestHash:'synthetic-manifest',completedAt:1};
  const workspace={id:'n88-synthetic',type:'account',authUserId:c.ownerId,ownershipState:'claimed',syncEligible:true,databaseName:await accountWorkspaceDatabaseName(c.ownerId),broadcastChannelName:'n88-integrated-synthetic',leaseGeneration:JSON.stringify([1,null,restore,null])};
  store.activateWorkspace(workspace);
  Object.assign(store.state,c.canonical,{ready:true,profile:{...makeProfile(),name:'معلم التجربة المصطنع',profileStatus:'READY'},
    device:{...makeDevice(),activeYearId:'year',activeTermId:'term',initialRestoreReceipt:{...restore,ownerId:c.ownerId}}});
  store.state.subjects=[{id:'subject',ownerId:c.ownerId,name:'المادة المصطنعة',slug:'synthetic',deleted:false}];
  store.state.years[0].label='السنة المصطنعة';store.state.terms[0].name='الفصل الدراسي المصطنع';store.state.terms[0].index=1;
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async()=>({id:c.ownerId,source:'supabase-auth-user',verifiedAt:Date.now()}));
  const fixture={store,cloud,expire:()=>runtimeOfflineLease().invalidate('synthetic-expiry'),switchOwner:()=>{cloud.setMockAuth({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},session);store.deactivateWorkspace('synthetic-owner-change');}};
  window.n88Fixture=fixture;
  return {status:'ready',authState:'authenticated',workspace};
}
