/** AI: affected real UI/store entry against an11s fabricated consent ACK. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createECDH} from 'node:crypto';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {owner} from './n44-fixture.mjs';
import {createPushGateway,N44_RESPONSE_DEADLINE_MS} from '../src/lib/notification-push-gateway.js';
const taskId='continuous-n44-one-approved-closed-page-push-20261019',runId='a5bafe17-2400-4454-8f07-c0076fd18e0a';
const lease=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8'));
assert.equal(lease.taskId,taskId);assert.equal(lease.owner.token,runId);
const root=process.cwd(),key=createECDH('prime256v1');key.generateKeys();const publicKey=key.getPublicKey().toString('base64url');
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png'};
let consentUpdates=0,registrations=0,browser,started=false;
const report={aiAuthored:true,taskId,runId,checks:[],actualProviderSendAttempts:0,actualDeviceRegistrations:0,cleanup:{}};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname.startsWith('/api/n44/')) {
  const chunks=[];for await(const b of req)chunks.push(b);const body=JSON.parse(Buffer.concat(chunks).toString());let result={status:'disabled'};
  if(u.pathname==='/api/n44/push/config')result={status:'ready',protocol:'n44-browser-v2',capability:'n44-single-device-20261019-v1',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'a'.repeat(40),publicKey,expiresAt:Date.now()+3600000,deliveryEnabled:false,schedulerEnabled:false};
  if(u.pathname==='/api/n44/context/read')result={status:'absent',protocol:'n44-browser-v2',expectedRevision:null};
  if(u.pathname==='/api/n44/context/update') {
   consentUpdates++;assert.equal(body.expectedRevision,null);assert.equal(body.pushConsent,true);
   await new Promise(ok=>setTimeout(ok,11000));result={status:'updated',context:{workspaceId:body.workspaceId,deviceId:body.deviceId,active:true,sessionRevision:'FABRICATED_SESSION_REVISION',sessionExpiresAt:Date.now()+3600000,consentRevision:'FABRICATED_CONSENT_REVISION',pushConsent:true,preferences:body.preferences}};
  }
  if(u.pathname==='/api/n44/push/register'){registrations++;result={status:'registered',registrationId:body.registrationId,expiresAt:Date.now()+3600000};}
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(result));
 }
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
try {
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));started=true;const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(20000);await openReadyServedDemo(page,base);
 await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});await page.goto(base+'/#/settings/notifications');
 await page.waitForFunction(async owner=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId===owner&&s.state.device?.accountProvisioningReceipt?.ownerId===owner&&!!document.querySelector('.n44-settings-page');},owner);
 await page.evaluate(async()=>{
  const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),m=await import('/src/lib/notification-push-runtime.js');
  s.getOfflineLeaseStatus();await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id=>({id,verifiedAt:Date.now(),source:'supabase-auth-user'}));
  const state=window.n44DelayedAck={prompts:0,subscriptions:0,binds:0};
  const active={scriptURL:location.origin+'/sw.js',postMessage(data,ports){if(data.type==='n44-consent-bind')state.binds++;ports[0].postMessage(data.type==='n44-consent-status'?{ok:true,enabled:true,binding:null,expiresAt:0}:{ok:true});}};
  const win={isSecureContext:true,location,MessageChannel,atob:v=>atob(v),localStorage,Notification:{permission:'granted',requestPermission(){state.prompts++;assertGesture();return Promise.resolve('granted');}},PushManager:{},navigator:{userActivation:{get isActive(){return navigator.userActivation.isActive;}},serviceWorker:{getRegistration:async()=>({active,getNotifications:async()=>[],pushManager:{getSubscription:async()=>null,subscribe:async()=>{state.subscriptions++;return {toJSON:()=>({endpoint:'https://FABRICATED.invalid/push',keys:{p256dh:'FABRICATED',auth:'FABRICATED'}}),unsubscribe:async()=>true};}}}),addEventListener(){},removeEventListener(){}}}};
  function assertGesture(){if(!navigator.userActivation.isActive)throw Error('missing actual click');}
  state.runtime=m.createPushRuntime({store:s,cloud:c,window:win,navigate(){},changed:()=>import('/src/app.js').then(a=>a.repaint())});m.setPushRuntime(state.runtime);await state.runtime.refresh();
 });
 await page.locator('[data-act="notification-push"]').waitFor();const before=Date.now();await page.locator('[data-act="notification-push"]').click();
 await page.getByRole('button',{name:'إيقاف تذكيرات الجهاز',exact:true}).waitFor();
 const outcome=await page.evaluate(()=>({status:n44DelayedAck.runtime.snapshot().status,prompts:n44DelayedAck.prompts,subscriptions:n44DelayedAck.subscriptions,binds:n44DelayedAck.binds}));
 assert.equal(outcome.status,'subscribed');assert.equal(outcome.subscriptions,1);assert.equal(outcome.binds,1);assert.equal(consentUpdates,1);assert.equal(registrations,1);assert.ok(Date.now()-before>=11000);assert.equal(N44_RESPONSE_DEADLINE_MS,15000);
 report.checks.push({name:'actual_ui_delayed_consent_ack',status:'PASS',evidence:'Actual authenticated synthetic store/ownership guard, settings DOM and delegated click.11s consent ACK survives the former10s cutoff and completes exactly one synthetic registration/SW bind. Fresh browser/loopback only; no real permission, account, device or send.'});
 let valid=true;const pending=[];const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const g=createPushGateway({context:{ownerId:owner,workspaceId:'synthetic',deviceId:'synthetic'},authorization:'Bearer FABRICATED',storage,preferences:()=>({}),valid:()=>valid,fetch:()=>new Promise(resolve=>pending.push(resolve))});
 const late=g.configuration();valid=false;pending[0](Response.json({status:'ready'}));await assert.rejects(late,/unavailable/);
 report.checks.push({name:'late_response_keeps_owner_fence',status:'PASS',evidence:'A response after ownership validity changes remains rejected; the deadline correction does not relax the request/response ownership fence or retry an operation.'});report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally {if(browser){await browser.close();report.cleanup.ownedBrowserClosed=true;}if(started){server.closeAllConnections();await new Promise(ok=>server.close(ok));report.cleanup.ownedServerClosed=true;}await writeFile('tests/n44-device-1019-delayed-ack.json',JSON.stringify(report,null,2)+'\n');}
console.log('PASS: actual UI delayed ACK and unchanged late-owner rejection; no live operations');
