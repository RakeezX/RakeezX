/** Real WNS->Rakeez ServiceWorker localhost test, isolated disposable profile. No Rakeez Auth. */
import { chromium, firefox } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import { createSubscriptionProtector } from '../drafts/n44-push/subscription-protector.mjs';
import { createAuditedSender } from '../drafts/n44-push/audited-sender.mjs';
import { issueCommittedPermit } from '../drafts/n44-push/committed-permit.mjs';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, extname } from 'node:path';
import { createServer } from 'node:http';
import { trustedSubscription } from '../drafts/n44-push/provider-policy.mjs';
import { WNS_WEBPUSH_ORIGIN, isWnsWebPushEndpoint } from '../drafts/n44-push/shared.mjs';
// Explicit opt-in prevents accidental outbound Push during builds or automated test discovery.
if (process.env.N44_RUN_EXTERNAL_PUSH !== 'YES') {
 console.log(JSON.stringify({status:'SKIPPED_EXPLICIT_OUTBOUND_PUSH_OPT_IN_REQUIRED'}));
 process.exit(0);
}
const require=createRequire(new URL('../drafts/n44-push/package.json',import.meta.url));
const webpush=require('web-push'),vapid=webpush.generateVAPIDKeys();
const appRoot=resolve(process.cwd());
const index='<!doctype html><html><head><meta charset="utf-8"></head><body><button id="sub">Test Push</button></body></html>';
const mime={'.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.ttf':'font/ttf'};
const server=createServer(async (req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/'||pathname==='/index.html'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(index);return;}
 const path=resolve(appRoot,'.'+decodeURIComponent(pathname));
 if(!path.startsWith(appRoot+sep)){res.statusCode=403;res.end();return;}
 try {const bytes=await readFile(path);res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes);}
 catch {res.statusCode=404;res.end('missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'n44-own-sw-push-'));
const binding=randomUUID(),tagPrefix='n44:'+binding+':';
const bindingExpiry=Date.now()+5*60_000;
const browserName=['edge','chrome','firefox'].includes(process.env.N44_TEST_BROWSER)?process.env.N44_TEST_BROWSER:'edge';
const engine=browserName==='firefox'?firefox:chromium;
const channel=browserName==='edge'?'msedge':browserName==='chrome'?'chrome':null;
let context,result={kind:'N44_ORIGINAL_SW_REAL_PUSH',platform:'Windows '+browserName,accountWrites:0,studentWrites:0,providerSendAttempts:0};
let subscription;
async function ownerMessage(page,type,data={}) {
 return page.evaluate(async ({type,data})=>{
    const worker=(await navigator.serviceWorker.getRegistration('/'))?.active;
    if(!worker)return {ok:false,reason:'missing-worker'};
    return await new Promise(resolve=>{
      const ports=new MessageChannel();
      const timer=setTimeout(()=>{ports.port1.close();resolve({ok:false,reason:'worker-timeout'});},4000);
      ports.port1.onmessage=e=>{clearTimeout(timer);ports.port1.close();resolve(e.data);};
      worker.postMessage({type,...data},[ports.port2]);
    });
 },{type,data});
}
try{
 context=await engine.launchPersistentContext(profile,{...(channel?{channel}:{}),headless:false,serviceWorkers:'allow',timeout:16000});
 await context.grantPermissions(['notifications'],{origin});
 let page=await context.newPage();
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:10000});
 const initial=await page.evaluate(async()=>{
   const r=await navigator.serviceWorker.register('/sw.js');
   const ready=await Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise(res=>setTimeout(()=>res(false),8500))]);
   return {ready,script:r.active?.scriptURL,permission:Notification.permission};
 });
 if(!initial.ready || initial.permission!=='granted'||!initial.script?.endsWith('/sw.js'))throw Error('Rakeez worker readiness or permission refused');
 result.worker='rakeez-sw.js activated';
 const vapidArray=[...Buffer.from(vapid.publicKey,'base64url')];
 await page.evaluate(array=>{window.vapidArray=new Uint8Array(array);},vapidArray);
 // The browser's actual user activation is needed synchronously; SW was ready above.
 // Resolve the registration first, before arming the click.
 await page.evaluate(async()=>{window.__n44_ready_reg=await navigator.serviceWorker.getRegistration('/');});
 await page.evaluate(()=>{document.getElementById('sub').addEventListener('click',()=>{
   window.pushRequest=window.__n44_ready_reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:window.vapidArray});
 },{once:true,capture:true});});
 await page.locator('#sub').click();
 const outcome=await page.evaluate(async()=>{
   if(!window.pushRequest)return {status:'no-subscribe'};
   return await Promise.race([window.pushRequest.then(s=>({status:'subscribed',raw:s.toJSON()}),e=>({status:'error',name:e.name})),
     new Promise(res=>setTimeout(()=>res({status:'timeout'}),12000))]);
 });
 if(outcome.status!=='subscribed')throw Error('Push subscription '+outcome.status+(outcome.name?':'+outcome.name:''));
 subscription={endpoint:outcome.raw.endpoint,keys:outcome.raw.keys};
 const u=new URL(subscription.endpoint),wns=isWnsWebPushEndpoint(u);
 result.provider=wns?'WNS':u.origin==='https://fcm.googleapis.com'?'FCM':u.origin==='https://updates.push.services.mozilla.com'?'Mozilla':u.origin==='https://web.push.apple.com'?'Apple':'unreviewed';
 if(result.provider==='unreviewed')throw Error('Unexpected push provider');
 trustedSubscription(subscription,wns?[WNS_WEBPUSH_ORIGIN]:[u.origin]);
 // Never emit opaque push-subscription tokens or full endpoint paths into logs.
 result.endpointShape={hostname:u.hostname,pathClass:wns?'WNS_w':u.pathname.startsWith('/fcm/send/')?'FCM_legacy':u.pathname.startsWith('/wp/')?'FCM_wp':u.pathname.startsWith('/wpush/')?'Mozilla_push':'other',opaqueTokenRedacted:true,queryPresent:!!u.search};
 const bind=await ownerMessage(page,'n44-consent-bind',{binding,expiresAt:bindingExpiry});
 result.consentBinding=bind?.ok===true?'bound':'failed';
 if(bind?.ok!==true)throw Error('Exact original SW consent binding failed');
 await page.close();
 // Source-shaped, nonprivate payload: the worker accepts only this exact schema.
 const event={id:'local-e2e-'+Date.now(),kind:'due',expiresAt:Date.now()+120000,actionPath:'/teaching/n44ephemeral/items'};
 const message={v:1,binding,expiresAt:bindingExpiry,event};
 if(process.env.N44_AUDITED_SENDER==='YES'){
   const origins=wns?[WNS_WEBPUSH_ORIGIN]:[u.origin];
   const protector=createSubscriptionProtector({providerOrigins:origins,activeKeyId:'tempseal',activeVapidKeyId:'tempvapid',fingerprintKeyId:'tempfp',
     sealingKeys:new Map([['tempseal',randomBytes(32)]]),endpointHmacKeys:new Map([['tempfp',randomBytes(32)]]),bindingHmacKeys:new Map([['tempfp',randomBytes(32)]])});
   let sender;
   try{
     sender=createAuditedSender({enabled:true,providerOrigins:origins,protector,vapidKeys:new Map([['tempvapid',{subject:'https://rakeezx.com',publicKey:vapid.publicKey,privateKey:vapid.privateKey}]])});
     const permit=issueCommittedPermit({...protector.protect(subscription),payload:event,binding:{id:binding,expiresAt:bindingExpiry}});
     result.providerSendAttempts=1;
     result.auditedSenderStatus=await sender.send(permit,{deadlineMs:10000});
   }finally{sender?.close();protector.close();}
 }else{
   const details=webpush.generateRequestDetails(subscription,JSON.stringify(message),{
     vapidDetails:{subject:'https://rakeezx.com',publicKey:vapid.publicKey,privateKey:vapid.privateKey},
     TTL:60,contentEncoding:'aes128gcm',urgency:'normal'});
   if(wns){delete details.headers.Urgency;delete details.headers.urgency;details.headers['X-WNS-Type']='wns/raw';details.headers['Content-Type']='application/octet-stream';}
   result.providerSendAttempts=1;
   let response;
   try{response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,signal:AbortSignal.timeout(12000),redirect:'error'});}
   catch(e){result.providerError=e.name;}
   if(response){result.providerStatus=response.status;result.providerAck=response.headers.get('X-WNS-NotificationStatus');}
 }
 result.originatingPageClosed=true;
 page=await context.newPage();
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 const note=await page.evaluate(async prefix=>{
   const r=await navigator.serviceWorker.getRegistration('/');
   for(let i=0;i<50;i++){
     const list=(await r.getNotifications()).filter(n=>n.tag.startsWith(prefix));
     if(list.length)return {count:list.length,tagFormatValid:true};
     await new Promise(res=>setTimeout(res,400));
   }
   return {count:0,tagFormatValid:false};
 },tagPrefix);
 result.notificationCountAfterClose=note.count;
 result.observationWindowMs=20000;
 const device=await ownerMessage(page,'n44-device-outcome',{binding});
 result.deviceOutcome=device?.ok===true?{stage:device.stage,present:device.present}:null;
 result.status=(note.count===1&&['received','display-requested','display-accepted'].includes(device?.stage) &&
   (process.env.N44_AUDITED_SENDER!=='YES'||result.auditedSenderStatus==='accepted')) ?
   (process.env.N44_AUDITED_SENDER==='YES'?'PASS_RAKEEZ_SW_AUDITED_SENDER':'PASS_RAKEEZ_SW_REAL_PUSH'):'UNCONFIRMED';
} catch(e) {
 result.status='FAILED';
 result.phase=e.message?.slice(0,160)||e.name;
} finally{
 if(context)try{
   let page=context.pages().find(x=>!x.isClosed());
   if(!page)page=await context.newPage();
   if(!page.url().startsWith(origin))await page.goto(origin,{waitUntil:'domcontentloaded',timeout:5000});
   {
     const cleanup=await page.evaluate(async()=>{
        const reg=await navigator.serviceWorker.getRegistration('/');
        const sub=await reg?.pushManager.getSubscription();
        const revoked=sub?await sub.unsubscribe():true;
        for(const n of await reg?.getNotifications()??[])n.close();
        return revoked;
     });
     result.unsubscribed=cleanup===true;
   }
   if(result.consentBinding==='bound'){
     const cleared=await ownerMessage(page,'n44-consent-clear',{binding});
     result.consentCleared=cleared?.ok===true;
   } else result.consentCleared='not_bound';
 }catch {result.cleanup='unconfirmed';}
 console.log(JSON.stringify(result));
 if(!['PASS_RAKEEZ_SW_REAL_PUSH','PASS_RAKEEZ_SW_AUDITED_SENDER'].includes(result.status))process.exitCode=1;
 await context?.close().catch(()=>{});
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
 await new Promise(r=>server.close(r));
}
