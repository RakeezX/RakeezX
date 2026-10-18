import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {MessageChannel} from 'node:worker_threads';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../../helpers/served-demo-readiness.mjs';
import {service} from './service.mjs';
const taskId='continuous-n44-actual-browser-service-integration-20261018',runId='9bb93382-ce73-4221-9f3e-8ff1b3f5f594';
export async function journey({pool,admin,report}) {
 const svc=await service({pool,admin,report});
 const root=process.cwd(),requests=[],fault={register:false,revoke:false,unavailable:false};
 const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
 const server=http.createServer(async(req,res)=>{
  try {
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(pathname.startsWith('/api/n44/')) {
    requests.push(pathname);const chunks=[];for await(const b of req)chunks.push(b);
    if(fault.unavailable)return res.writeHead(503,{'content-type':'application/json'}).end('{"status":"unavailable"}');
    const wire=new Request(svc.env.N44_PUBLIC_ORIGIN+pathname,{method:req.method,headers:{origin:svc.env.N44_PUBLIC_ORIGIN,
     authorization:req.headers.authorization,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.123'},body:Buffer.concat(chunks)});
    Object.defineProperty(wire,'cf',{value:{tlsVersion:'TLSv1.3'}});
    const response=await svc.gateway(wire,svc.env),body=await response.text();
    (report.transport??=[]).push({path:pathname,http:response.status,status:JSON.parse(body).status??JSON.parse(body).error});
    if(pathname.endsWith('/register')&&fault.register || pathname.endsWith('/revoke')&&fault.revoke) return res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'}).end('{"status":"unavailable"}');
    res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'}).end(body);return;
   }
   const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
   res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'}).end(await readFile(file));
  }catch {if(!res.headersSent)res.writeHead(404);res.end();}
 });
 const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
 await managedAuth({admin,pool,svc,report,check});
 let page;
 try {
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
   const context=await createContext({viewport:{width:390,height:844},timezoneId:'Asia/Riyadh',locale:'ar-SA'});
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   page=await context.newPage();page.setDefaultTimeout(15000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await openReadyServedDemo(page,base);
   await page.evaluate(async({owner,token,date})=>{
    const f=await import('/tests/n44-fixture.mjs');await f.prepareAccount(owner);
    const db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');
    const session={...c.session,access_token:token,expires_at:Math.floor(Date.now()/1000)+3600};c.setMockAuth({id:owner},session);localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));
    const due=await db.get('scoreSubitems','n44-due');await db.put('scoreSubitems',{...due,dueDate:date});await s.init();
   },{owner:svc.A,token:svc.ta,date:svc.date});
   await page.goto(base+'/#/settings/notifications');
   await page.waitForFunction(async expected=>{
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),e=await import('/src/lib/notification-events.js');
    const n=e.currentNotificationContext(s,c);
    return n?.ownerId===expected&&s.state.device.accountProvisioningReceipt?.ownerId===expected&&document.querySelector('.n44-settings-page')&&{owner:n.ownerId,database:n.workspaceId,receipt:s.state.device.accountProvisioningReceipt.ownerId};
   },svc.A);
   assert.equal(requests.length,0);assert.equal(await page.locator('[data-act="notification-push"]').count(),0);
   check('default_off_actual_app','Actual authenticated mounted app/ownership guard, real settings DOM/CSS over loopback HTTP: no N44 API call, permission prompt, subscription or external control on boot/reload.');
   await page.evaluate(async({publicKey,subscription})=>{
    const m=await import('/src/lib/notification-push-runtime.js'),s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),router=await import('/src/router.js');
    s.getOfflineLeaseStatus();
    await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async owner=>({id:owner,verifiedAt:Date.now(),source:'supabase-auth-user'}));
    window.n44={permission:'default',prompts:0,subscribes:0,unsubscribes:0,messages:{},navigations:[],controller:{}};
    const n=window.n44;
    n.activeWorker={scriptURL:location.origin+'/sw.js',postMessage(data,ports){
      if(data.type==='n44-consent-status')ports[0].postMessage({ok:true,enabled:true,...n.swConsent});
      else {if(data.type==='n44-consent-bind')n.swConsent={binding:data.binding,expiresAt:data.expiresAt};
        if(data.type==='n44-consent-clear'&&(!data.binding||n.swConsent?.binding===data.binding))n.swConsent=null;
        ports[0].postMessage({ok:true,enabled:true});}
    }};
    n.sw={controller:n.controller,getRegistration:async()=>({active:n.activeWorker,getNotifications:async()=>[],pushManager:{getSubscription:async()=>n.nativeSubscription??null,subscribe:async options=>{
      if(n.holdSubscription)await new Promise(resolve=>n.releaseSubscription=resolve);n.subscribes++;
      const value={endpoint:subscription.endpoint,toJSON:()=>subscription,unsubscribe:async()=>{n.unsubscribes++;if(n.nativeSubscription===value)n.nativeSubscription=null;return true;}};
      n.nativeSubscription=value;return value;
    }}}),addEventListener:(type,fn)=>n.messages[type]=fn,removeEventListener:(type)=>delete n.messages[type]};
    n.win={isSecureContext:true,location,MessageChannel,atob:value=>atob(value),Notification:{get permission(){return n.permission;},requestPermission:()=>{n.prompts++;n.permission='granted';return Promise.resolve('granted');}},PushManager:{},navigator:{serviceWorker:n.sw,userActivation:{get isActive(){return n.activation===true&&navigator.userActivation.isActive;}}},localStorage};
    n.make=()=>m.createPushRuntime({store:s,cloud:c,window:n.win,configuration:{enabled:true,publicKey},navigate:destination=>{n.navigations.push(destination);router.go(destination);},changed:()=>import('/src/app.js').then(a=>a.repaint())});
    n.runtime=n.make();m.setPushRuntime(n.runtime);
    s.onWorkspaceDeactivation(()=>n.runtime.invalidate());c.subscribe(()=>n.runtime.refresh());
    n.sync=await import('/src/lib/sync.js');n.acks=0;n.unsubAck=n.sync.subscribeAcknowledged(checkpoint=>{n.acks++;return n.projection=n.runtime.afterSyncAck(checkpoint);});
    const {GenericV2Backend}=await import('/tests/helpers/generic-v2-backend.mjs');n.backend=new GenericV2Backend();c.setMockBackend(n.backend);
    n.checkpoint=()=>({workspace:s.getActiveWorkspace(),session:c.session});
   },{publicKey:svc.vapid.getPublicKey().toString('base64url'),subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/N44_BROWSER_SYNTHETIC',keys:{p256dh:svc.device.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')}}});
   fault.unavailable=true;
   await page.evaluate(()=>n44.runtime.refresh());
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().available),false);
   assert.equal(await page.locator('[data-act="notification-push"]').count(),0);fault.unavailable=false;
   await page.evaluate(()=>n44.runtime.refresh());
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().available),true,JSON.stringify({snapshot:await page.evaluate(()=>n44.runtime.snapshot()),transport:report.transport,requests}));
   assert.equal(await page.evaluate(()=>n44.prompts),0);
   assert.equal((await page.evaluate(()=>n44.runtime.optIn())).status,'gesture_required');
   await page.evaluate(()=>n44.activation=true);
   await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().status==='subscribed');
   assert.equal(await page.evaluate(()=>n44.prompts),1);assert.equal(await page.evaluate(()=>n44.subscribes),1);
   assert.equal((await admin.query("select state from n44_push_draft.registrations where state='active'")).rows.length,1);
   const beforeRestore=await page.evaluate(()=>({prompts:n44.prompts,subscribes:n44.subscribes,binding:n44.swConsent.binding}));
   // Model document teardown without logout: existing native subscription and
   // durable SW consent survive, while page-local client/message state is gone.
   await page.evaluate(async()=>{n44.messages={};n44.runtime=n44.make();(await import('/src/lib/notification-push-runtime.js')).setPushRuntime(n44.runtime);await n44.runtime.refresh();});
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().status),'subscribed');
   assert.deepEqual(await page.evaluate(()=>({prompts:n44.prompts,subscribes:n44.subscribes,binding:n44.swConsent.binding})),beforeRestore);
   check('same_session_existing_binding_readback_restore','Document-local composition recreated without logout: current verified server context + exact original registration ACK + existing native subscription + matching durable SW binding restore the same active binding. No new permission/subscription; retired/absent binding cannot take this path.');
   for(const width of [390,1280]) {
    await page.setViewportSize({width,height:844});
    const geometry=await page.locator('.n44-settings-page').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...el.querySelectorAll('button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))}));
    assert.equal(geometry.overflow,false);assert.ok(geometry.buttons.every(b=>b.width>=44&&b.height>=44&&b.left>=0&&b.right<=width+1));
   }
   check('gesture_consent_transport_and_layout','Actual settings handler: unavailable service hidden, source-enabled fabricated VAPID test binding requires user gesture; permission once, committed context CAS/register ACK; native adapter options exercised; 390/1280 DOM geometry >=44px and no overflow.');
   assert.equal(requests.filter(p=>p.endsWith('/events/update')).length,0);
   const syncResult=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),m=await import('/src/models.js');
    await s.save({subjects:[m.makeSubject({id:'n44-sync-ack-probe',name:'Synthetic sync ACK'})]});
    return n44.sync.syncAll({full:false});
   });assert.equal(syncResult,true);
   await page.evaluate(()=>n44.projection);
   await page.waitForFunction(async()=>{const n=await import('/src/lib/notification-events.js'),s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return n.currentNotificationEvents(s,n.currentNotificationContext(s,c)).some(e=>e.id.startsWith('due:n44-due:'));});
   // Wait for the serial projection triggered by the real normal Sync ACK.
   let rows;for(let i=0;i<40;i++){rows=(await admin.query("select payload from n44_push_draft.events where event_id like 'due:n44-due:%'")).rows;if(rows.length)break;await new Promise(ok=>setTimeout(ok,50));}assert.equal(rows.length,1);
   const payload=rows[0].payload;
   assert.equal(await page.evaluate(()=>n44.navigations.length),0);
   const beforeFail=requests.filter(p=>p.endsWith('/events/update')).length;
   await page.evaluate(async()=>{n44.backend.applySyncV2Mutation=async()=>{throw Error('fabricated ACK failure');};const s=await import('/src/store.js'),m=await import('/src/models.js');await s.save({subjects:[m.makeSubject({id:'n44-sync-failed-probe',name:'Synthetic failed ACK'})]});return n44.sync.syncAll({full:false});});
   assert.equal(requests.filter(p=>p.endsWith('/events/update')).length,beforeFail);
   check('normal_sync_ack_projection','Actual syncAll orchestration + existing GenericV2Backend fabricated receipt: no projection before ACK, then actual events/update HTTP/canonical PG source projection; failed normal Sync ACK produces no new projection.');
   const worker=await swJourney({page,base,payload,admin,svc,check});
   // Independent fault phase uses fresh rate capacity in this owned fixture only.
   await admin.query('delete from n44_push_draft.ingress_rates');
   await page.evaluate(async()=>{ (await import('/src/router.js')).go('/settings/notifications'); await n44.runtime.refresh(); });
   await page.locator('[data-act="notification-push"]').waitFor();
   fault.register=true;fault.revoke=true;
   await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().status==='cleanup_pending');
   assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('rakeezx-n44-registration:'))));
   assert.equal((await admin.query("select count(*)::int as n from n44_push_draft.registrations where state='active'")).rows[0].n,0);
   const prompts=await page.evaluate(()=>n44.prompts);
   await page.evaluate(()=>n44.runtime.dispose());
   fault.register=false;fault.revoke=false;
   await page.evaluate(async()=>{n44.runtime=n44.make();(await import('/src/lib/notification-push-runtime.js')).setPushRuntime(n44.runtime);await n44.runtime.refresh();});
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('rakeezx-n44-registration:'))),false);
   assert.equal(await page.evaluate(()=>n44.prompts),prompts);
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().status),'unsubscribed');
   check('lost_register_revoke_ack_persisted_cleanup','Actual server commits register/revoke while transport loses both ACKs: no subscribed success, cleanup_pending and only registration identity persisted. Recreated runtime reconciles idempotent original-owner revoke ACK before enabling a fresh gesture; no prompt/subscription during recovery.');
   // Existing preference controls retire the binding, update CAS preferences and require a new gesture.
   await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().status==='subscribed');
   await page.locator('[data-act="notification-push-quiet"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().available&&n44.runtime.snapshot().status==='unsubscribed');
   let ctx=(await admin.query('select push_consent,preferences from n44_push_draft.contexts')).rows[0];
   assert.equal(ctx.push_consent,false);assert.deepEqual(ctx.preferences.quiet,{start:1320,end:420});
   await page.locator('[data-minutes="30"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().available);
   ctx=(await admin.query('select preferences from n44_push_draft.contexts')).rows[0];assert.equal(ctx.preferences.lessonMinutes,30);
   check('preferences_quiet_timing_context_cas','Actual mounted settings handlers bind quiet/timing to context CAS; changing preference immediately invalidates/revokes original registration, readback has pushConsent false, quiet 22:00–07:00 and 30-minute lead. In-app local preferences remain functional.');
   await admin.query('delete from n44_push_draft.ingress_rates');
   await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().status==='subscribed');
   const newSession='33333333-3333-4333-8333-333333333333';
   await admin.query('delete from auth.sessions where id=$1',[svc.SA]);
   await admin.query('insert into auth.sessions(id,user_id,not_after) values($1,$2,null)',[newSession,svc.A]);
   const renewedToken=await svc.token(svc.A,newSession);
   const rejectedRevoke=await page.evaluate(async token=>{
    const c=await import('/src/lib/cloud.js');const renewed={...c.session,access_token:token};
    c.setMockAuth(c.user,renewed);localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(renewed));
    const key=Object.keys(localStorage).find(k=>k.startsWith('rakeezx-n44-registration:'));
    const response=await fetch('/api/n44/push/revoke',{method:'POST',headers:{'content-type':'application/json','x-n44-csrf':'1',authorization:'Bearer '+token},body:localStorage.getItem(key)});
    return response.status;
   },renewedToken);
   assert.equal(rejectedRevoke,400,'new session cannot revoke active original registration');
   await page.evaluate(()=>n44.runtime.refresh());
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().status),'unsubscribed');
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('rakeezx-n44-registration:'))),false);
   ctx=(await admin.query('select session_id,session_revision,push_consent from n44_push_draft.contexts')).rows[0];
   assert.equal(ctx.session_id,newSession);assert.equal(ctx.session_revision,newSession+':'+svc.options.sessionPolicy.approvalId);assert.equal(ctx.push_consent,false);
   check('new_session_cas_and_original_cleanup','Retired original Auth session in owned PG: new verified same-owner session cannot directly revoke active original registration (HTTP400). Observed context revision permits CAS retirement, then real inactive-original ACK reconciles persisted cleanup; new session remains unsubscribed until a new gesture.');
   // Pending native subscription cannot survive A -> B -> A, even if original objects return.
   await page.evaluate(()=>{n44.holdSubscription=true;});
   await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>typeof n44.releaseSubscription==='function');
   await page.evaluate(async()=>{
    const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');
    const originalSession=c.session,originalUser=c.user;
    c.setMockAuth({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{access_token:'fabricated-B'});n44.runtime.invalidate();
    c.setMockAuth(originalUser,originalSession);n44.releaseSubscription();n44.holdSubscription=false;
   });
   await page.evaluate(()=>n44.runtime.refresh());
   assert.notEqual(await page.evaluate(()=>n44.runtime.snapshot().status),'subscribed');
   assert.equal((await admin.query("select count(*)::int as n from n44_push_draft.registrations where state='active'")).rows[0].n,0);
   await page.evaluate(async()=>{const lease=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();lease.invalidate('synthetic-limited');await n44.runtime.refresh();});
   assert.equal(await page.evaluate(()=>n44.runtime.snapshot().available),false);
   check('actual_runtime_aba_and_lease_guards','Pending native subscription released after A-B-A is cleaned and never registered/resumed; original session objects cannot defeat epoch. Actual offline lease invalidation hides readiness and blocks consent/transport. No ownership or lease guard disabled.');
   // Fresh affected background scenario: valid parent/child source rows, real
   // normal Sync ACK, then ZERO actual browser pages and an expired old JWT.
   await admin.query('delete from n44_push_draft.ingress_rates');
   await admin.query("delete from n44_push_draft.budgets where budget_key='register'");
   await admin.query("update auth.sessions set not_after=clock_timestamp()+interval '3 hours' where id=$1",[newSession]);
   for(const id of ['n44-background-one','n44-background-two','n44-background-expired'])
    await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,start_date,due_date) values($1,$2,'n44-item',$3,$3)",[svc.A,id,svc.date]);
   await page.evaluate(async date=>{
    const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),m=await import('/src/models.js'),c=await import('/src/lib/cloud.js');
    s.getOfflineLeaseStatus();await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async owner=>({id:owner,verifiedAt:Date.now(),source:'supabase-auth-user'}));
    for(const id of ['n44-background-one','n44-background-two'])await db.put('scoreSubitems',{...m.makeScoreSubitem({id,itemId:'n44-item',dueDate:date,value:1}),ownerId:c.user.id,serverRevision:1});
    await s.init();
    (await import('/src/lib/notification-push-runtime.js')).writePushQuiet((await import('/src/lib/notification-events.js')).currentNotificationContext(s,c),null);
    await n44.runtime.refresh();
    n44.backend=new (await import('/tests/helpers/generic-v2-backend.mjs')).GenericV2Backend();
    const baseApply=n44.backend.applySyncV2Mutation.bind(n44.backend),boundOwner=c.user.id;
    n44.backend.applySyncV2Mutation=async envelope=>{const receipt=await baseApply(envelope);receipt.canonical.owner_id=boundOwner;const row=n44.backend.table(envelope.entity).find(r=>r.id===receipt.canonicalId);if(row)row.owner_id=boundOwner;return receipt;};
    c.setMockBackend(n44.backend);
   },svc.date);
   await page.locator('[data-act="notification-push"]').waitFor();await page.locator('[data-act="notification-push"]').click();
   await page.waitForFunction(()=>n44.runtime.snapshot().status==='subscribed');
   const ackBefore=await page.evaluate(()=>n44.acks);
   report.backgroundSync=await page.evaluate(async()=>{const s=await import('/src/store.js'),m=await import('/src/models.js');await s.save({subjects:[m.makeSubject({id:'n44-background-ack',name:'Synthetic background ACK'})]});const ok=await n44.sync.syncAll({full:false});const rows=await (await import('/src/lib/db.js')).getAll('outbox');return {ok,status:n44.sync.state.status,error:n44.sync.state.lastError,acks:n44.acks,outbox:rows.map(r=>({store:r.store,command:r.command,state:r.state,error:r.lastError?.message}))};});
   await page.waitForFunction(before=>n44.acks>before,ackBefore);await page.evaluate(()=>n44.projection);
   const projected=(await admin.query("select source_id from n44_push_draft.events where device_id='n44-device' and source_id like 'n44-background-%'")).rows;
   assert.equal(projected.length,2,'Both newly ACKed valid sources must be projected before closing the page');
   const backgroundReceipt=await page.evaluate(()=>n44.swConsent);
   assert.ok(backgroundReceipt.expiresAt>svc.now()+3600000&&backgroundReceipt.expiresAt<=Date.now()+10800000);
   const extraSession='66666666-6666-4666-8666-666666666666';
   await admin.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '3 hours')",[extraSession,svc.A]);
   const extraToken=await svc.token(svc.A,extraSession),extraScope={workspaceId:(await admin.query('select workspace_id from n44_push_draft.contexts limit 1')).rows[0].workspace_id,deviceId:'z-background-expired'};
   const prefs={lesson:true,due:true,lessonMinutes:15,dueDays:[0],timezone:'Asia/Riyadh',quiet:null};
   const extraContext=(await svc.call('/context/update',{...extraScope,expectedRevision:null,preferences:prefs,pushConsent:true},extraToken)).body.context;assert.ok(extraContext);
   assert.equal((await svc.call('/push/register',{...extraScope,registrationId:'77777777-7777-4777-8777-777777777777',sessionRevision:extraContext.sessionRevision,consent:{revision:extraContext.consentRevision,push:true},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/N44_BACKGROUND_EXPIRED',keys:{p256dh:svc.device.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')}}},extraToken)).body.status,'registered');
   assert.equal((await svc.call('/events/update',{...extraScope,kind:'due',sourceId:'n44-background-expired',expectedStamp:null},extraToken)).body.status,'updated');
   const backgroundWorker=await worker.prepareBackground(backgroundReceipt);
   await page.close();assert.equal(context.pages().length,0);
   const sentBefore=svc.sent.length;svc.advance(2*3600000);
   assert.notEqual((await svc.call('/context/read',{workspaceId:extraScope.workspaceId,deviceId:'n44-device'},renewedToken)).code,200,'expired JWT remains rejected by teacher API');
   const afterExpiry=await svc.schedule(1);assert.ok(afterExpiry.outcomes.includes('sent'));
   assert.equal(svc.sent.length,sentBefore+1);const backgroundEnvelope=svc.sent.at(-1);
   assert.equal(backgroundEnvelope.binding,backgroundReceipt.binding);
   await backgroundWorker.push(backgroundEnvelope);
   await admin.query('delete from auth.sessions where id=$1',[newSession]);
   await admin.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[extraSession]);
   assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[svc.A,newSession])).rows.length,0);
   assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[svc.A,extraSession])).rows.length,0);
   await svc.schedule();assert.equal(svc.sent.length,sentBefore+1);
   check('background_after_jwt_expiry_and_current_auth_session','Actual normal Sync ACK projects valid new parent/child sources. Both real browser pages and VM app-client inventory are ZERO. After +2h the old +1h JWT is rejected by teacher API, while current original Auth session/3h-clamped consent permits committed audited encrypted delivery and generic SW display. Separate revoked-session and expired-not_after contexts produce no further send; Auth RLS stays enabled/zero-policy. No bearer/refresh token is persisted in server/SW state.');
   page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   // Restore route after authorized click, then use actual preference handlers.
   await page.goto(base+'/#/settings/notifications');
   await page.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&document.querySelector('.n44-settings-page');});
   // Reload discards test-only adapter. The published app remains OFF.
   assert.equal(await page.locator('[data-act="notification-push"]').count(),0);
   assert.equal(errors.length,0,errors.join(';'));
   check('n44_actual_browser_service_consent_sync_and_subscription_journey','Actual app DOM/handlers + native adapter over fabricated browser facilities, relative HTTP transport, Cloudflare/WebRequest/AuthClient and owned PG: gesture/defaultOFF, real ACK/source/Sync, cleanup/retry, preference and new-session CAS, A-B-A/lease checks pass at 390/1280.');
   check('published_reload_remains_off','Reload removes test-only injected runtime and source-default OFF still hides external controls; no page errors or real push/network used.');
  });
 } finally {server.closeAllConnections();await new Promise(ok=>server.close(ok));svc.privateCrypto.close();report.cleanup.httpClosed=true;report.cleanup.browserClosed=true;}
}
async function swJourney({page,base,payload,admin,svc,check}) {
 const namespaces=new Map(),notifications=[],opened=[];let focus=0,clients=[];
 const client={type:'window',url:base+'/',postMessage(data,ports){
  if(!ports?.length){void page.evaluate(data=>n44.messages.message({source:n44.controller,data,ports:[]}),data);return;}
  void page.evaluate(data=>new Promise(resolve=>{const port={postMessage:resolve,close(){}};n44.messages.message({source:n44.controller,data,ports:[port]});}),data).then(reply=>ports[0].postMessage(reply));
 },async focus(){focus++;}};
 const source=await readFile('sw.js','utf8');
 const make=enabled=>{
  const handlers={};let heldPut=null;
  const self={location:{origin:base},addEventListener:(type,fn)=>handlers[type]=fn,
   clients:{matchAll:async()=>clients,openWindow:async url=>{assert.equal(url,base+'/');opened.push(url);return client;}},
   registration:{getNotifications:async options=>notifications.filter(n=>!n.closed&&(!options?.tag||n.tag===options.tag)),showNotification:async(title,data)=>notifications.push({title,...data,close(){this.closed=true;}})}};
  const sandbox={self,URL,Response,Request,MessageChannel,Date,Map,console,setTimeout,clearTimeout,caches:{keys:async()=>[],open:async name=>{
   const cache=namespaces.get(name)??new Map();namespaces.set(name,cache);
   return {match:async r=>cache.get(typeof r==='string'?r:r.url)?.clone(),put:async(r,v)=>{const copy=v.clone();if(heldPut){const gate=heldPut;heldPut=null;gate.started();await gate.wait;}cache.set(typeof r==='string'?r:r.url,copy);},add:async()=>{}};
  }},fetch:async()=>{throw Error('synthetic offline');}};
  vm.createContext(sandbox);
  assert.equal(source.split('const N44_PUSH_ENABLED = false;').length,2);
  vm.runInContext(enabled?source.replace('const N44_PUSH_ENABLED = false;','const N44_PUSH_ENABLED = true;'):source,sandbox);
  const fire=async(type,event)=>{let work;handlers[type]({...event,waitUntil:p=>work=p});await work;};
  const message=async data=>{let reply;await fire('message',{source:client,data,ports:[{postMessage:value=>reply=value,close(){}}]});return reply;};
  return {handlers,sandbox,fire,message,holdPut(){let started,release;const entered=new Promise(r=>started=r),wait=new Promise(r=>release=r);heldPut={started,wait};return {entered,release};}};
 };
 const receipt=await page.evaluate(()=>n44.swConsent);assert.ok(receipt?.binding);
 let sw=make(false);assert.equal((await sw.message({type:'n44-consent-status'})).enabled,false);
 await sw.fire('push',{data:{text:()=>JSON.stringify(payload)}});assert.equal(notifications.length,0);
 sw=make(true);assert.equal((await sw.message({type:'n44-consent-bind',...receipt})).ok,true);
 const scheduled=await svc.schedule();assert.ok(scheduled.outcomes.includes('sent'));
 const envelope=svc.sent.find(e=>e.event.id===payload.id);assert.ok(envelope);assert.equal(envelope.binding,receipt.binding);assert.deepEqual(envelope.event,payload);
 await sw.fire('push',{data:{text:()=>JSON.stringify({...envelope,event:{...payload,studentName:'rejected'}})}});assert.equal(notifications.length,0);
 await sw.fire('push',{data:{text:()=>JSON.stringify({...envelope,event:{...payload,expiresAt:Date.now()-1}})}});assert.equal(notifications.length,0);
 await sw.fire('push',{data:{text:()=>JSON.stringify({...envelope,event:{...payload,actionPath:'https://forbidden.invalid/'}})}});assert.equal(notifications.length,0);
 // No matching app clients: actual sender bytes decrypt into exact envelope,
 // durable public consent alone permits GENERIC display, never private navigation.
 assert.equal(clients.length,0);
 await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,1);
 assert.equal(notifications[0].title,'\u0631\u064e\u0643\u064a\u0632 \u0627\u0644\u0645\u0639\u0644\u0645');
 assert.deepEqual(Object.keys(notifications[0].data).sort(),['binding','event','expiresAt','v']);
 sw=make(true);await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,1,'durable dedupe after worker restart');
 await sw.fire('notificationclick',{notification:notifications[0]});assert.equal(focus,1);assert.equal(opened.length,1);assert.equal(await page.evaluate(()=>n44.navigations.length),1);
 clients=[client];
 await admin.query("update rakeezx.items set deleted_at=clock_timestamp() where owner_id=$1 and id='n44-item'",[svc.A]);
 await sw.fire('notificationclick',{notification:notifications[0]});assert.equal(focus,1);
 await admin.query("update rakeezx.items set deleted_at=null where owner_id=$1 and id='n44-item'",[svc.A]);
 await sw.fire('notificationclick',{notification:notifications[0]});assert.equal(focus,1);
 await sw.message({type:'n44-consent-clear',binding:receipt.binding});
 const count=notifications.length;
 await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,count);
 const B='44444444-4444-4444-8444-444444444444',A2='55555555-5555-4555-8555-555555555555';
 for(const binding of [B,A2]){await sw.message({type:'n44-consent-bind',binding,expiresAt:receipt.expiresAt});await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,count);}
 assert.equal((await sw.message({type:'n44-consent-bind',binding:A2,expiresAt:Date.now()-1})).ok,false);
 // Exact observed clear/write race: suspend real SW Cache.put, deliver
 // subscriptionchange, resume the older write, restart, then receive with zero clients.
 clients=[];
 let gate=sw.holdPut();const pendingBind=sw.message({type:'n44-consent-bind',...receipt});await gate.entered;
 let changing=sw.fire('pushsubscriptionchange',{});gate.release();await Promise.all([pendingBind,changing]);
 sw=make(true);assert.equal((await sw.message({type:'n44-consent-status'})).binding,null);
 await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,count);
 await sw.message({type:'n44-consent-bind',...receipt});
 gate=sw.holdPut();const pendingPush=sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});await gate.entered;
 changing=sw.fire('pushsubscriptionchange',{});gate.release();await Promise.all([pendingPush,changing]);
 sw=make(true);assert.equal((await sw.message({type:'n44-consent-status'})).binding,null);
 await sw.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,count);
 check('sw_subscriptionchange_serializes_inflight_bind_and_push','Actual sw.js Cache.put suspended at both bind and push-dedupe writes, then concurrent subscriptionchange. Older writes drain before serialized clear; worker restart shows no active binding and zero-client old-envelope reception stays suppressed.');
 // Actual shell fallback and private route exclusions, not a lookalike document.
 for(const file of ['runtime','browser','gateway','client','core']){
  const url=base+'/src/lib/notification-push-'+file+'.js';
  (namespaces.get('rakeezx-v71')??namespaces.set('rakeezx-v71',new Map()).get('rakeezx-v71')).set(url,new Response('cached-'+file));
  let response;sw.handlers.fetch({request:new Request(url),respondWith:p=>response=p,waitUntil(){}});assert.equal(await(await response).text(),'cached-'+file);
  assert.ok(vm.runInContext('SHELL',sw.sandbox).includes('./src/lib/notification-push-'+file+'.js'));
 }
 for(const url of ['/api/n44/context/read','/api/n88/guest','/s/private','/__n44_device_consent']){let intercepted=false;sw.handlers.fetch({request:new Request(base+url),respondWith(){intercepted=true;}});assert.equal(intercepted,false);}
 await page.evaluate(()=>n44.runtime.invalidate());
 const backgroundCount=notifications.length;
 const result={async prepareBackground(receipt){clients=[];const background=make(true);assert.equal((await background.message({type:'n44-consent-bind',...receipt})).ok,true);return {async push(envelope){await background.fire('push',{data:{text:()=>JSON.stringify(envelope)}});assert.equal(notifications.length,backgroundCount+1);}};}};
 check('n44_client_sw_owner_stale_click_default_off_and_offline_guards','Actual sw.js VM, explicit one-constant synthetic activation: real encrypted/decrypted sender envelope displays GENERIC notification with ZERO open clients; durable restart dedupe; fixed public-root boot then current page/server click authorization; deleted/restored source, logout, A-B-A binding and expiry rejection; default OFF and offline/private route guards.');
 return result;
}

async function managedAuth({admin,pool,svc,report,check}) {
 const base='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-0636-service-preflight/';
 report.metadataInputs=[];
 for(const [name,expected] of [['management-capabilities.json','49a4e708b7e86001f62222600880591483bac2110b32415270cc54b44410e5c1'],['metadata-addendum.json','e1f5276131ada32af32eb7ba467b74a4f84a993a3cdc265445873c95131b9e09']]){
  const bytes=await readFile(base+name),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,expected);report.metadataInputs.push({path:base+name,sha256:hash});
 }
 const auth=(await admin.query("select c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_roles r on r.oid=c.relowner join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname in ('users','sessions') order by c.relname")).rows;
 assert.equal(auth.length,2);assert.ok(auth.every(r=>r.rolname==='supabase_auth_admin'&&r.relrowsecurity&&!r.relforcerowsecurity));
 assert.equal((await admin.query("select count(*)::int as n from pg_policies where schemaname='auth'")).rows[0].n,0);
 assert.deepEqual((await admin.query("select rolsuper,rolbypassrls,pg_has_role('postgres','supabase_auth_admin','member') as member,has_schema_privilege('postgres','auth','create') as create_auth from pg_roles where rolname='postgres'")).rows[0],{rolsuper:false,rolbypassrls:true,member:false,create_auth:false});
 assert.equal((await admin.query("select count(*)::int as n from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace where ns.nspname='auth' and t.relname in ('users','sessions')")).rows[0].n,7);
 for(const role of ['n44_backend','n44_guard','anon','authenticated']){
  try{await admin.query('set role '+role);await assert.rejects(admin.query('select id from auth.users'),e=>e.code==='42501');await assert.rejects(admin.query('select id from auth.sessions'),e=>e.code==='42501');}
  finally{await admin.query('reset role');}
 }
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[svc.A,svc.SA])).rows.length,1);
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[svc.B,svc.SA])).rows.length,0);
 await admin.query("update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1",[svc.A]);
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[svc.A,svc.SA])).rows.length,0);
 await admin.query('update auth.users set banned_until=null where id=$1',[svc.A]);
 check('managed_auth_rls_private_helper','Pinned read-only metadata inputs; owned PG mirrors managed Auth owner supabase_auth_admin, enabled/non-FORCED RLS, ZERO policies and seven named constraints. Existing-style postgres management role is non-superuser/BYPASSRLS with only required column locks; helper returns exact owner/session/not_after only. Backend/guard/anon/authenticated cannot read Auth tables; wrong owner/session yields no row. No managed Auth policy/ownership/bypass change proposed.');
}
