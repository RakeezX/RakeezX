/** AI: actual app DOM/handlers/CSS with fresh fabricated account and native ports. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createECDH} from 'node:crypto';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {owner,otherOwner} from './n44-fixture.mjs';
const taskId='continuous-n44-single-device-optin-ready-20261019',runId='a4b73532-2bc6-4327-98e7-89c5edb7bcee';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true}).trim();
const root=process.cwd(),curve=createECDH('prime256v1');curve.generateKeys();const publicKey=curve.getPublicKey().toString('base64url');
let mode='disabled',registrations=0,started=false,leased=false,browser;const requests=[];
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname.startsWith('/api/n44/')) {
  requests.push(u.pathname);
  for await(const _ of req){} // Fabricated session only; retain no headers/body.
  let body={status:'disabled'};
  if(u.pathname==='/api/n44/push/config'&&mode!=='disabled')body={status:'ready',protocol:'n44-browser-v2',capability:'n44-single-device-20261019-v1',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'a'.repeat(40),publicKey,expiresAt:Date.now()+3600000,deliveryEnabled:false,schedulerEnabled:false};
  if(mode==='wrong-source')body.serviceSourceSha='unknown';
  if(u.pathname==='/api/n44/context/read')body={status:'absent',protocol:'n44-browser-v2',expectedRevision:null};
  if(u.pathname==='/api/n44/push/register')registrations++;
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(body));
 }
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const report={taskId,runId,checks:[],actualDeviceRegistrations:0,actualPermissionPrompts:0,actualProviderSendAttempts:0,cleanup:{}};
try {
 report.browserLease=lease('acquire');leased=true;
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));started=true;
 const base='http://127.0.0.1:'+server.address().port;report.origin=base;
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(12000);
 await openReadyServedDemo(page,base);
 await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
 await page.goto(base+'/#/settings/notifications');
 // Same-document owner/database/receipt checkpoint after navigation.
 await page.waitForFunction(async owner=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId===owner&&s.state.device?.accountProvisioningReceipt?.ownerId===owner&&!!document.querySelector('.n44-settings-page');},owner);
 await page.evaluate(async()=>{
  const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),m=await import('/src/lib/notification-push-runtime.js');
  s.getOfflineLeaseStatus();await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id=>({id,verifiedAt:Date.now(),source:'supabase-auth-user'}));
  const n=window.n44Device={prompts:0,subscriptions:0};
  const active={scriptURL:location.origin+'/sw.js',postMessage(data,ports){ports[0].postMessage(data.type==='n44-consent-status'?{ok:true,enabled:true,binding:null,expiresAt:0}:{ok:true});}};
  const win={isSecureContext:true,location,MessageChannel,atob:value=>atob(value),localStorage,Notification:{permission:'default',requestPermission(){n.prompts++;assertGesture();return Promise.resolve('denied');}},PushManager:{},navigator:{userActivation:{get isActive(){return n.allowGesture===true&&navigator.userActivation.isActive;}},serviceWorker:{getRegistration:async()=>({active,getNotifications:async()=>[],pushManager:{getSubscription:async()=>null,subscribe:async()=>{n.subscriptions++;throw Error('must not subscribe');}}}),addEventListener(){},removeEventListener(){}}}};
  function assertGesture(){if(!navigator.userActivation.isActive)throw Error('missing actual click');}
  n.runtime=m.createPushRuntime({store:s,cloud:c,window:win,navigate(){},changed:()=>import('/src/app.js').then(a=>a.repaint())});m.setPushRuntime(n.runtime);
  await n.runtime.refresh();
 });
 assert.equal(await page.locator('[data-act="notification-push"]').count(),0);
 assert.equal(await page.evaluate(()=>n44Device.prompts),0);
 mode='ready';await page.evaluate(()=>n44Device.runtime.refresh());
 report.prepared=await page.evaluate(async()=>({snapshot:n44Device.runtime.snapshot(),editable:(await import('/src/store.js')).getOfflineLeaseStatus().editable,contextPresent:!!(await import('/src/lib/notification-events.js')).currentNotificationContext(await import('/src/store.js'),await import('/src/lib/cloud.js'))}));report.requests=requests.slice();
 await page.locator('[data-act="notification-push"]').waitFor();
 assert.equal(await page.locator('[data-act="notification-push"]').innerText(),'تفعيل تذكيرات الجهاز');
 const geometry=await page.locator('.n44-settings-page').evaluate(el=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,style:getComputedStyle(el.querySelector('.n44-preference')).display}));
 assert.equal(geometry.pageOverflow,false);assert.notEqual(geometry.style,'none');
 assert.equal((await page.evaluate(()=>n44Device.runtime.optIn())).status,'gesture_required');
 assert.equal(await page.evaluate(()=>n44Device.prompts),0);
 await page.evaluate(()=>{n44Device.allowGesture=true;});
 await page.locator('[data-act="notification-push"]').click();
 await page.waitForFunction(()=>n44Device.prompts===1);
 assert.equal(await page.evaluate(()=>n44Device.subscriptions),0);assert.equal(registrations,0);
 report.checks.push({name:'actual_ui_explicit_gesture_and_denied_consent',status:'PASS',evidence:'Actual authenticated synthetic store/ownership guard, mounted notification-settings DOM, delegated click and source CSS over loopback HTTP. Missing service hides button; matching synthetic readiness shows ordinary opt-in; programmatic call cannot prompt; actual click invokes only fake denied permission, zero subscriptions/registrations.'});
 mode='wrong-source';await page.evaluate(async()=>{n44Device.runtime.invalidate();await n44Device.runtime.refresh();});
 await page.waitForFunction(()=>!document.querySelector('[data-act="notification-push"]'));
 mode='ready';await page.evaluate(()=>n44Device.runtime.refresh());await page.locator('[data-act="notification-push"]').waitFor();
 await page.evaluate(async other=>{const s=await import('/src/store.js');(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard.setWorkspace({...s.getActiveWorkspace(),authUserId:other});await n44Device.runtime.refresh();(await import('/src/app.js')).repaint();},otherOwner);
 assert.equal(await page.locator('[data-act="notification-push"]').count(),0);
 report.checks.push({name:'actual_entry_wrong_source_and_owner_failclosed',status:'PASS',evidence:'Malformed service source hides the actual mounted control; changing the real runtime ownership guard invalidates readiness and hides opt-in without any permission or subscription. Native browser facilities are injected synthetic ports, not live permission/OS proof.'});
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally {
 if(browser){await browser.close();report.cleanup.ownedBrowserClosed=true;}
 if(started){server.closeAllConnections();await new Promise(ok=>server.close(ok));report.cleanup.ownedServerClosed=true;}
 if(leased)report.cleanup.browserLease=lease('release');
 await writeFile('tests/n44-device-1019-browser.json',JSON.stringify(report,null,2)+'\n');
}
console.log('PASS: actual app synthetic opt-in entry; no real prompt, registration or send.');
