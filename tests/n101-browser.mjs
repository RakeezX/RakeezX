import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../src/lib/cloud.js';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session=owner=>({access_token:'synthetic-'+owner,refresh_token:'synthetic-refresh',expires_at:4102444800,user:{id:owner,email:owner[0]+'@example.test'}});
const root=resolve('.'),baseline=process.env.N101_BASELINE==='1';
const oldRouting=baseline?execFileSync('git',['show','24dbfed57644dbed13ecd1b77064dff98ed7b0fe:src/lib/workspace-routing.js'],{encoding:'utf8'}):null;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.end(baseline&&pathname==='/src/lib/workspace-routing.js'?oldRouting:await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const report=(name,detail)=>console.log('PASS '+name+' '+detail);
async function setup(createContext,{seedA=false,offline=false,denied=false,profile=false,delay=false,foreign=false,serverProvisioned=false}={}){
 const context=await createContext({viewport:{width:1280,height:844},locale:'ar-SA'});
 let loginOwner=B,deny=denied,release;const waiting=new Promise(r=>release=r);let manifests=0;
 const requests=[];
 await context.route(SUPABASE_URL+'/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  const token=route.request().headers().authorization??'';
  const owner=token.includes(A)?A:B;
  requests.push({p,owner,query:url.search});
  if(p.endsWith('/otp'))return route.fulfill({status:204});
  if(p.endsWith('/verify'))return route.fulfill({json:session(loginOwner)});
  if(p.endsWith('/logout'))return route.fulfill({status:204});
  if(deny)return route.fulfill({status:typeof deny==='number'?deny:401,json:{message:'synthetic unavailable/expired session'}});
  if(p.endsWith('/user'))return route.fulfill({json:session(owner).user});
  if(p.endsWith('/account_contract')||p.endsWith('/provision_account_profile'))return route.fulfill({json:{ownerId:owner,profileStatus:profile?'PENDING_PROFILE':'READY',profile:{teacherName:profile?'':'Teacher '+owner[0],phone:profile?'':'0500000001',teacherForm:'masculine'},access:{grantType:'beta_full',status:'active'},provisioning:profile?{state:'PROFILE_REQUIRED',version:1}:serverProvisioned?{state:'READY',version:1,foundationHash:'server:foundation:B'}:null}});
  if(p.endsWith('/score_foundation_capability'))return route.fulfill({json:{scoreDomainVersion:1,restoreProtocol:'CORE_V2'}});
  if(p.endsWith('/n71_restore_capability'))return route.fulfill({status:404,json:{code:'PGRST202'}});
  if(p.includes('restore_manifest')){
   manifests++;if(delay)await waiting;
   return route.fulfill({json:[{entity:'profile',id:'profile',revision:7,deleted:false},{entity:'students',id:'student:B',revision:1,deleted:false}]});
  }
  if(p.endsWith('/profile'))return route.fulfill({json:[{owner_id:foreign?A:owner,revision:7,field_revisions:{},deleted_at:null,teacher_name:'Teacher '+owner[0],school_name:'School '+owner[0],phone:'0500000001'}]});
  if(p.endsWith('/students'))return route.fulfill({json:[{id:'student:B',owner_id:owner,revision:1,field_revisions:{},deleted_at:null,name:'Student B'}]});
  return route.fulfill({json:[]});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/');
 await page.evaluate(async({seedA,A,key,s})=>{
  if(seedA){
   const db=await import('/src/lib/db.js');const {createWorkspaceRegistry}=await import('/src/lib/workspaces.js');
   db.selectDatabase('rakeezx');await db.put('device',{id:'device',deviceId:'device:A',schemaVersion:db.DB_VERSION,theme:'dark',workspaceClaim:{version:1,state:'claimed',ownerId:A,claimId:'claim:A',databaseName:'rakeezx'},history:['original:A']});
   await db.put('profile',{id:'profile',teacherName:'Teacher a',schoolName:'Original A',serverRevision:1});
   await db.put('students',{id:'student:A',name:'Student A',serverRevision:1});
   await db.put('logs',{id:'log:A',kind:'synthetic-history',createdAt:100});
   await db.put('outbox',{id:'outbox:A',ownerId:A,entity:'notes',recordId:'pending:A',payload:{text:'keep'},state:'pending',createdAt:100});
   db.closeDB();const registry=createWorkspaceRegistry();await registry.registerLegacyClaim(A,{claimId:'claim:A',evidenceHash:'synthetic:A'});await registry.close();
  }
  localStorage.setItem(key,JSON.stringify(s));
 },{seedA,A,key:AUTH_STORAGE_KEY,s:session(seedA?A:B)});
 await context.addInitScript(()=>{
  window.__n101opens=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{window.__n101opens.push(String(args[0]));return open(...args);};
 });
 if(offline)await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
 return {page,context,errors,requests,setOwner:o=>loginOwner=o,setDenied:v=>deny=v,release,getManifests:()=>manifests};
}
async function ready(page,owner){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
 let checkpoint;try {checkpoint=await page.evaluate(async owner=>{
  const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
  const workspace=s.getActiveWorkspace();
  if(!s.state.ready||workspace?.authUserId!==owner||!document.querySelector('.layout')||db.getActiveDatabaseName()!==workspace.databaseName)return false;
  const device=await db.get('device','device');
  if(!(device.initialRestoreReceipt?.ownerId===owner||device.workspaceClaim?.ownerId===owner)||s.state.profile.teacherName!=='Teacher '+owner[0])return false;
  if(!s.state.ready||s.getActiveWorkspace()?.authUserId!==owner)return false;
  return {workspace,device,students:s.state.students,opens:window.__n101opens,layout:true,overflow:document.documentElement.scrollWidth>innerWidth+2};
 },owner);}catch(error){if(!/context|navigation/i.test(error.message))throw error;}
 if(checkpoint)return checkpoint;await page.waitForTimeout(100);
 }
 throw Error('Owner-bound app checkpoint did not become ready: '+await page.locator('body').innerText()+' / '+await page.locator('[data-workspace-gate]').getAttribute('data-workspace-reason'));
}
async function inventory(page,name){return page.evaluate(async name=>{
 const d=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
 const result={};for(const n of d.objectStoreNames){result[n]=await new Promise((r,j)=>{const q=d.transaction(n).objectStore(n).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});}d.close();return result;
},name);}
async function logout(page){await page.locator('.teacher-mini-hub-trigger').click();await page.locator('[data-act="mini-hub-logout"]').click();await page.locator('[data-workspace-login]').waitFor();}
async function login(page,owner){await page.locator('[data-workspace-login]').click();const sheet=page.locator('#first-run-inline-form');await sheet.locator('input[name="email"]').fill(owner[0]+'@example.test');await sheet.locator('[type=submit]').click();await sheet.locator('input[name="token"]').fill('123456');await sheet.locator('[type=submit]').click();}
try{await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n101-account-switch-bootstrap-20261014.json',runId:'8ed6a66e-4769-4cfc-8846-e214b28cdba9',url:origin,timeoutMs:120000},async({createContext})=>{
 const f=await setup(createContext,{seedA:true});await f.page.goto(origin+'/');await ready(f.page,A);const originalA=await inventory(f.page,'rakeezx');await logout(f.page);f.setOwner(B);await login(f.page,B);
 if(baseline){await f.page.locator('[data-workspace-reason="authenticated-account-workspace-mismatch"]').waitFor();assert.equal(await f.page.evaluate(()=>window.__n101opens.includes('rakeezx')),false);report('n101_original_failure','actual A logout/B OTP login: mismatch before A Product open');await f.context.close();return;}
 const b=await ready(f.page,B);assert.equal(b.opens.includes('rakeezx'),false);assert.equal(b.students[0].id,'student:B');assert.equal(b.overflow,false);
 const before=await inventory(f.page,'rakeezx');assert.deepEqual(before,originalA,'B never changes any A store, including device');
 await logout(f.page);f.setOwner(A);await login(f.page,A);await ready(f.page,A);
 const after=await inventory(f.page,'rakeezx');
 for(const store of Object.keys(before).filter(n=>n!=='device'))assert.deepEqual(after[store],before[store],store+' A preserved');
 assert.deepEqual(after.device[0].workspaceClaim,before.device[0].workspaceClaim);assert.deepEqual(after.device[0].history,before.device[0].history);
 assert.deepEqual(f.errors,[]);report('n101_actual_switch_A_to_B_to_A','real logout/OTP handlers, native IndexedDB, B receipt/data, all A Product stores/outbox/history preserved');report('n101_old_owner_untouched_during_boot','B indexedDB.open trace excludes rakeezx');await f.context.close();
 const fresh=await setup(createContext,{serverProvisioned:true});await fresh.page.goto(origin+'/');const restored=await ready(fresh.page,B);assert.equal(restored.device.initialRestoreReceipt.protocol,'CORE_V2');assert.equal(restored.students[0].id,'student:B');
 // Missing registry recovers the local immutable receipt, without reimporting.
 await fresh.page.evaluate(async()=>{const s=await import('/src/store.js');s.deactivateWorkspace('synthetic-reset');const q=indexedDB.deleteDatabase('rakeezx-workspace-registry');await new Promise((r,j)=>{q.onsuccess=r;q.onerror=()=>j(q.error);});});
 await fresh.page.reload();const recovered=await ready(fresh.page,B);assert.deepEqual(recovered.device.initialRestoreReceipt,restored.device.initialRestoreReceipt);
 // A disposable test removes ONLY its own B fixture DB to model storage eviction.
 const dbName=recovered.workspace.databaseName;
 await fresh.page.close();fresh.page=await fresh.context.newPage();await fresh.page.goto(origin+'/assets/micro-mark.svg');
 await fresh.page.evaluate(async name=>{const q=indexedDB.deleteDatabase(name);await new Promise((r,j)=>{q.onsuccess=r;q.onerror=()=>j(q.error);});},dbName);
 await fresh.page.goto(origin+'/');const rerecovered=await ready(fresh.page,B);assert.notEqual(rerecovered.device.initialRestoreReceipt.restoreId,restored.device.initialRestoreReceipt.restoreId);
 const record=await fresh.page.evaluate(async()=>{const r=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();try{return (await r.list())[0];}finally{await r.close();}});assert.deepEqual(record.recoveryEvidence.restoreReceipt,{protocol:restored.device.initialRestoreReceipt.protocol,restoreId:restored.device.initialRestoreReceipt.restoreId,manifestHash:restored.device.initialRestoreReceipt.manifestHash,completedAt:restored.device.initialRestoreReceipt.completedAt});
 const provisioned=await setup(createContext,{serverProvisioned:true});await provisioned.page.evaluate(async owner=>{const r=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();try{await r.beginAccountProvisioning(owner);await r.registerProvisionedAccount(owner,{ownerId:owner,contractVersion:1,foundationHash:'server:foundation:B'});}finally{await r.close();}},B);await provisioned.page.goto(origin+'/');await ready(provisioned.page,B);await provisioned.context.close();
 await fresh.page.evaluate(async()=>await (await import('/src/store.js')).renewOfflineLease());await fresh.context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));await fresh.page.reload();await ready(fresh.page,B);assert.equal(await fresh.page.evaluate(async()=>(await import('/src/store.js')).getOfflineLeaseStatus().editable),true);
 report('n101_new_device_existing_account_restore','fresh profile CORE_V2 receipt before UI; missing registry preserves receipt; missing DB fully restores with original evidence retained');await fresh.context.close();
 const outage=await setup(createContext,{denied:503});await outage.page.goto(origin+'/');await outage.page.locator('[data-initial-restore-state="RESTORE_FAILED"]').waitFor();assert.equal(await outage.page.locator('.layout').count(),0);outage.setDenied(false);await outage.page.locator('[data-restore-retry]').click();await ready(outage.page,B);await outage.context.close();
 const off=await setup(createContext,{offline:true});await off.page.goto(origin+'/');await off.page.locator('[data-initial-restore-state="RESTORE_REQUIRES_ONLINE"] [data-restore-retry]').waitFor();assert.equal(await off.page.locator('.layout').count(),0);assert.equal((await off.page.evaluate(()=>indexedDB.databases())).some(x=>x.name.startsWith('rakeezx-user-')),false);await off.context.close();
 const deny=await setup(createContext,{denied:true});await deny.page.goto(origin+'/');await deny.page.locator('[data-initial-restore-state="RESTORE_FAILED"]').waitFor();assert.equal(await deny.page.locator('.layout').count(),0);deny.setDenied(false);await deny.page.locator('[data-restore-retry]').click();await deny.page.locator('[data-workspace-login]').waitFor();await login(deny.page,B);await ready(deny.page,B);await deny.context.close();
 const wrong=await setup(createContext,{foreign:true});await wrong.page.goto(origin+'/');await wrong.page.locator('[data-initial-restore-state="RESTORE_FAILED"]').waitFor();assert.equal(await wrong.page.locator('.layout').count(),0);await wrong.context.close();
 const profile=await setup(createContext,{profile:true});await profile.page.goto(origin+'/');await profile.page.locator('[data-account-profile-required]').waitFor();assert.equal(await profile.page.locator('.layout').count(),0);await profile.page.evaluate(async({key,value})=>{localStorage.setItem(key,JSON.stringify(value));await (await import('/src/lib/cloud.js')).init({waitForRefresh:false});},{key:AUTH_STORAGE_KEY,value:session(A)});await profile.page.locator('[name=teacherName]').fill('Synthetic B');await profile.page.locator('[name=phone]').fill('0500000001');await profile.page.locator('[data-account-profile-form] [type=submit]').click();await profile.page.locator('[data-profile-error]').waitFor({state:'visible'});assert.equal(profile.requests.some(r=>r.p.endsWith('/complete_account_profile')),false);assert.equal(await profile.page.locator('.layout').count(),0);await profile.context.close();
 const cancel=await setup(createContext,{delay:true});await cancel.page.goto(origin+'/');await cancel.page.locator('[data-initial-restore-state="RESTORE_PREFLIGHT"]').waitFor();await cancel.page.locator('[data-restore-logout]').click();cancel.release();await cancel.page.locator('[data-workspace-login]').waitFor();assert.equal(await cancel.page.evaluate(async()=>(await import('/src/lib/cloud.js')).user),null);assert.equal(await cancel.page.locator('.layout').count(),0);assert.equal((await cancel.page.evaluate(()=>indexedDB.databases())).some(x=>x.name.startsWith('rakeezx-user-')),false);await cancel.context.close();
 const switchMid=await setup(createContext,{delay:true});await switchMid.page.goto(origin+'/');await switchMid.page.locator('[data-initial-restore-state="RESTORE_PREFLIGHT"]').waitFor();await switchMid.page.evaluate(async({key,value})=>{localStorage.setItem(key,JSON.stringify(value));await (await import('/src/lib/cloud.js')).init({waitForRefresh:false});},{key:AUTH_STORAGE_KEY,value:session(A)});switchMid.release();await switchMid.page.locator('[data-initial-restore-state="RESTORE_FAILED"]').waitFor();assert.equal(await switchMid.page.locator('.layout').count(),0);assert.equal((await switchMid.page.evaluate(()=>indexedDB.databases())).some(x=>x.name.startsWith('rakeezx-user-')),false);await switchMid.context.close();
 const corrupt=await setup(createContext);await corrupt.page.goto(origin+'/');await ready(corrupt.page,B);await corrupt.page.close();corrupt.page=await corrupt.context.newPage();await corrupt.page.goto(origin+'/assets/micro-mark.svg');
 await corrupt.page.evaluate(async()=>{const d=await new Promise((r,j)=>{const q=indexedDB.open('rakeezx-workspace-registry');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const tx=d.transaction('workspaces','readwrite');const done=new Promise(r=>tx.oncomplete=r);const q=tx.objectStore('workspaces').getAll();q.onsuccess=()=>{const row=q.result[0];tx.objectStore('workspaces').put({...row,restoreReceipt:{...row.restoreReceipt,manifestHash:'corrupt'}});};await done;d.close();});
 await corrupt.page.goto(origin+'/');await corrupt.page.locator('[data-workspace-reason="initial-restore-receipt-mismatch"]').waitFor();assert.equal(await corrupt.page.locator('.layout').count(),0);await corrupt.context.close();
 report('n101_interrupted_offline_invalid_owner' ,'offline action, expired-session/retry, foreign canonical owner, new profile contract, delayed logout/cancel and midway owner switch all gate teacher UI');
 });}finally{await new Promise((r,j)=>server.close(e=>e?j(e):r()));}
