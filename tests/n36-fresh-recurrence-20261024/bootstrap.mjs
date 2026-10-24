// AI-authored: actual first-account UI and provisioner; RPCs run only in disposable local PG.
import * as cloud from '../../src/lib/cloud.js';
const owner=new URL(location.href).searchParams.get('owner')||sessionStorage.getItem('fixtureOwner');sessionStorage.setItem('fixtureOwner',owner);
const session={access_token:'synthetic-local-only',user:{id:owner},expires_at:Math.floor(Date.now()/1000)+3600};
localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);
window.fixtureCloud=cloud;window.fixtureLease=(await import('../../src/lib/offline-lease.js')).runtimeOfflineLease();window.trace=[];
const fetchOriginal=window.fetch.bind(window);
window.fetch=async(input,options)=>{
 const url=String(input?.url??input);
 if(url.includes('/auth/v1/user')){window.trace.push('auth-start');if(sessionStorage.getItem('fixtureProvisioned')&&!window.autoAuth)await new Promise(r=>window.releaseAuth=r);window.trace.push('auth-end');return new Response(JSON.stringify({id:owner}),{status:window.refuseAuth?403:200,headers:{'content-type':'application/json'}});}
 if(url.startsWith('http')&&!url.startsWith(location.origin))throw Error('External fixture request forbidden');
 return fetchOriginal(input,options);
};
const rpc=(name,args=[])=>window.fixtureRPC(name,args);
cloud.setMockBackend({
 getAccountContract:()=>rpc('account_contract'),
 provisionAccountProfile:()=>rpc('provision_account_profile'),
 completeAccountProfile:p=>rpc('complete_account_profile',[p.teacherName,p.phone,p.teacherForm,p.schoolName||null,p.educationDepartment]),
 beginAccountProvisioning:()=>rpc('begin_account_provisioning'),
 provisionAccountWorkspace:async defaults=>{const result=await rpc('provision_account_workspace',[defaults]);sessionStorage.setItem('fixtureProvisioned','1');return result;},
 fetchRecords:async table=>{if(new URL(location.href).searchParams.get('case')!=='profile-sync')throw Error('Unrelated synthetic Sync unavailable');window.syncReads=(window.syncReads??0)+1;return (await rpc('account_provisioning_snapshot'))[table]??[];},
 // No cloud mutation adapter: the import/receipt proof remains device-local.
});
window.fixtureReady=true;
await import('../../src/app.js');
