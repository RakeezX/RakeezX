// AI-authored: synthetic transport only; application boot, DOM, store and guards are real.
import * as cloud from '../../src/lib/cloud.js';
import * as store from '../../src/store.js';
import * as db from '../../src/lib/db.js';
import { prepareAccount, owner } from '../n73-account-flow-fixture.mjs';
import { createWorkspaceRegistry, resolveWorkspace } from '../../src/lib/workspaces.js';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';

if (new URL(location.href).searchParams.has('seed')) {
  await prepareAccount();
  await store.patchDevice({ accountProvisioningReceipt: { ownerId: owner, contractVersion: 1, foundationHash: 'synthetic-n123' } }, { notify: false, queue: false });
  const registry = createWorkspaceRegistry();
  try {
    await registry.registerProvisionedAccount(owner, { ownerId: owner, contractVersion: 1, foundationHash: 'synthetic-n123' });
    const resolution = await resolveWorkspace({ type: 'account', authUserId: owner }, { registry });
    store.activateWorkspace(resolution.workspace);
    await runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
  } finally { await registry.close(); }
  for (const key of Object.keys(localStorage)) if (key.startsWith('rakeezx-offline-lease-v1:')) localStorage.removeItem(key);
  const initial = JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY));
  initial.user = {id: owner, email: 'synthetic@example.invalid', new_email: ''};
  initial.expires_at = Math.floor(Date.now()/1000)+3600; initial.refresh_token = 'synthetic-refresh';
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(initial));
  window.seedReady = true;
}

window.probe={reads:0,markers:0,mode:'normal',events:[],threshold:Infinity};
const http=async(name,input={})=>{
 const response=await fetch('/__n125/'+name,{method:'POST',body:JSON.stringify(input)});
 const body=await response.json();if(!response.ok)throw Object.assign(Error(body.message),body,{status:response.status});return body;
};
const realFetch=window.fetch.bind(window);
window.fetch=(url,options)=>String(url).includes('/auth/v1/user')
 ? Promise.resolve(Response.json({id:owner,email:'synthetic@example.invalid',new_email:''})) : realFetch(url,options);
cloud.setMockBackend({
 getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null,
 fetchOwnerSyncMarker:async()=>{
  window.probe.markers++;
  if(window.probe.reads>window.probe.threshold){
   if(window.probe.mode==='hold-validation'){
    window.probe.validationStarted=true;
    await new Promise(done=>window.probe.releaseValidation=done);
   }
   if(window.probe.mode==='fail-validation')throw Object.assign(Error('Synthetic private marker failure'),{status:503});
  }
  return http('marker');
 },
 openOwnerSyncChannel:()=>()=>{},
 fetchRecords:async entity=>{window.probe.reads++;return http('read',{entity});},
 applySyncV2Mutation:async envelope=>http('apply',envelope),
});
window.checkpoint=async()=>{
 const sync=await import('/src/lib/sync.js');
 return {summary:await sync.getSyncOperationalSummary(),error:sync.state.lastError,
  reads:window.probe.reads,markers:window.probe.markers,owner:cloud.user?.id,workspace:store.getActiveWorkspace(),
  score:await db.get('scores','n73-valid'),outbox:await db.getAll('outbox'),
  tombstones:await Promise.all(['n73-second','n125-empty'].map(id=>db.get('teachings',id))),
  sections:await Promise.all(['n73-second-section','n125-empty-section'].map(id=>db.get('sections',id)))};
};
window.arm=async mode=>{
 const sync=await import('/src/lib/sync.js');window.probe.mode=mode;window.probe.threshold=window.probe.reads;
 window.probe.validationStarted=false;window.probe.events=[];
 window.probe.unsubscribe?.();window.probe.unsubscribe=sync.subscribe(()=>window.probe.events.push({status:sync.state.status,error:sync.state.lastError}));
};
