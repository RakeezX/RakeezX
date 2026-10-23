// AI-authored: normal provisioning with fabricated server responses and native IndexedDB.
import * as cloud from '../../src/lib/cloud.js';
import * as db from '../../src/lib/db.js';
import {runAccountProvisioning} from '../../src/lib/account-provisioning.js';
import {encodeSyncV2Patch} from '../../src/lib/sync-v2.js';
import {createWorkspaceRegistry,accountWorkspaceDatabaseName} from '../../src/lib/workspaces.js';
export const owner='a7300000-0000-4000-8000-000000000001';
const session={access_token:'synthetic-local-only',user:{id:owner},expires_at:Math.floor(Date.now()/1000)+3600};
localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);
window.fixtureCloud=cloud;window.fixtureLease=(await import('../../src/lib/offline-lease.js')).runtimeOfflineLease();window.trace=[];window.releaseAuth=null;
const fetchOriginal=window.fetch.bind(window);
window.fetch=async(input,options)=>{
 const url=String(input?.url??input);
 if(url.includes('/auth/v1/user')){window.trace.push('auth-start');if(!window.authReleased)await new Promise(r=>window.releaseAuth=r);window.trace.push('auth-end');return new Response(JSON.stringify({id:owner}),{status:window.refuseAuth?403:200,headers:{'content-type':'application/json'}});}
 if(url.startsWith('http')&&!url.startsWith(location.origin))throw Error('External fixture request forbidden');
 return fetchOriginal(input,options);
};
const contract=state=>({ownerId:owner,profileStatus:'READY',profile:{teacherName:'معلم اصطناعي',phone:'0500000001',teacherForm:'masculine',educationDepartment:'الإدارة العامة للتعليم بمنطقة الرياض'},access:{grantType:'beta_full',status:'active'},provisioning:{state,version:1,foundationHash:state==='READY'?'fresh-foundation':null}});
cloud.setMockBackend({getAccountContract:async()=>contract('READY')});
const registry=createWorkspaceRegistry();
try{
 if(!(await registry.findByAuthUserId(owner)).length){
  let phase='PROVISIONING_REQUIRED';
  const api={user:session.user,verifyCurrentAuthIdentity:async()=>({id:owner}),getAccountContract:async()=>contract(phase),beginAccountProvisioning:async()=>contract(phase='PROVISIONING'),provisionAccountWorkspace:async defaults=>{
   const snapshot={profile:[{owner_id:owner,revision:1,deleted_at:null,teacher_name:'معلم اصطناعي',phone:'0500000001',teacher_form:'masculine'}]};
   for(const [store,entity] of Object.entries({years:'years',terms:'terms',calendars:'calendars',calendarDays:'calendar_days',subjects:'subjects',timeProfiles:'time_profiles'}))snapshot[entity]=defaults[store].map(r=>({id:r.id,owner_id:owner,revision:1,deleted_at:null,...encodeSyncV2Patch(store,r)}));
   return {contract:contract(phase='READY'),snapshot};
  }};
  await runAccountProvisioning({expectedOwnerId:owner,api,registry});
  window.provisionedDevice=await db.get('device','device');window.trace.push('provisioned');
 }else db.selectDatabase(await accountWorkspaceDatabaseName(owner));
}finally{await registry.close();}
const scenario=new URL(location.href).searchParams.get('case');
if(scenario==='already-ready'){
 window.authReleased=true;const s=await import('../../src/store.js');const routing=await(await import('../../src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:cloud.user});s.activateWorkspace(routing.workspace);await s.renewOfflineLease();
}
if(scenario==='nondefault'){
 const device=await db.get('device','device'),year=(await db.getAll('years'))[0],term=(await db.getAll('terms')).find(t=>t.index===2);await db.put('device',{...device,activeYearId:year.id,activeTermId:term.id});
}
window.fixtureReady=true;
await import('../../src/app.js');
