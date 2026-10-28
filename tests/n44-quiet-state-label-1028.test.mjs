// AI: actual HTTP-served app, store ownership guards, handlers and CSS; synthetic account only.
import assert from 'node:assert/strict';
import http from 'node:http';import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=process.cwd(),requests=[];
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname.startsWith('/api/')){requests.push(u.pathname);res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":"disabled"}');}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/n44-quiet-state-label-1028.json',runId:process.env.RAKEEZ_TEST_RUN_ID??'c4e9e85b-c2b6-409d-92d9-35c0048960ca',url:base,timeoutMs:60000},async({createContext})=>{
  const browserContext=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});await browserContext.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await browserContext.newPage();await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   const f=await import('/tests/n44-fixture.mjs');await f.prepareAccount();
   const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');const context=(await import('/src/lib/notification-events.js')).currentNotificationContext(s,c);
   if(!context||context.ownerId!==f.owner||s.getActiveWorkspace()?.authUserId!==f.owner||s.state.device.accountProvisioningReceipt.ownerId!==f.owner)throw Error('owner checkpoint');
   window.quietFixture={context,calls:0};const runtime={snapshot:()=>({available:false,status:'unavailable',eligibility:{reason:'configuration_disabled',configuration:'disabled'}}),normalUiSnapshot:()=>null,preferencesChanged:async()=>quietFixture.calls++,optIn:async()=>quietFixture.calls++,disable:async()=>quietFixture.calls++};
   (await import('/src/lib/notification-push-runtime.js')).setPushRuntime(runtime);
   location.hash='#/settings/notifications';
  });
  await page.locator('[data-n44-quiet-saved-state]').waitFor();
  for(const quiet of [null,{start:1320,end:420},{start:1380,end:360}]){
   const before=await page.evaluate(async value=>{const p=await import('/src/lib/notification-push-runtime.js');assertFixture();function assertFixture(){if(!window.quietFixture)throw Error('fixture');}p.writePushQuiet(quietFixture.context,value);await(await import('/src/app.js')).repaint();return p.readPushQuiet(quietFixture.context);},quiet);
   const baseline=requests.length;
   const label=page.locator('[data-n44-quiet-saved-state]'),button=page.locator('[data-act="notification-push-quiet"]');
   await expect(label).toHaveText('وقت الهدوء المحفوظ: '+(quiet?'مفعّل':'غير مفعّل'));await expect(label).toBeVisible();await expect(button).toBeDisabled();await expect(button).toHaveAttribute('aria-checked',String(!!quiet));
   await expect(page.getByText('يمكن تعديل وقت الهدوء عند توفر تذكيرات الجهاز.',{exact:true})).toBeVisible();assert.equal(await page.locator('[data-act="notification-push"]').count(),0);
   // Actual handler's unavailable-service guard must also reject direct invocation.
   await button.evaluate(async el=>(await import('/src/views/notification-settings.js')).default.actions['notification-push-quiet'](el));
   const after=await page.evaluate(async()=>({quiet:(await import('/src/lib/notification-push-runtime.js')).readPushQuiet(quietFixture.context),calls:quietFixture.calls}));assert.deepEqual(after.quiet,before);assert.equal(after.calls,0);assert.equal(requests.length,baseline);
   for(const width of [320,390]){await page.setViewportSize({width,height:844});const geometry=await label.evaluate(el=>{const r=el.getBoundingClientRect();return {inside:r.left>=0&&r.right<=innerWidth,height:r.height,display:getComputedStyle(el).display};});assert(geometry.inside&&geometry.height>0&&geometry.display!=='none');}
  }
  if(process.env.RAKEEZ_QUIET_SCREENSHOT)await page.locator('[data-n44-quiet-saved-state]').locator('..').screenshot({path:process.env.RAKEEZ_QUIET_SCREENSHOT});
  console.log('PASS quiet_saved_state_visible_when_disabled: null, default and custom saved times; actual app at 320/390px');
  console.log('PASS quiet_label_no_preference_or_delivery_mutation: render and unavailable handler preserve stored value; zero runtime calls or additional API requests');
 });
}finally{await new Promise(resolve=>server.close(resolve));}
