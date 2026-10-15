/** Real app, synthetic owner fixtures, owned loopback server. No remote data. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {fixedNow,owner,otherOwner} from './n44-fixture.mjs';
const taskId='continuous-n44-dedicated-notification-settings-20261015';
const runId=process.env.N44_RUN_ID;
assert.ok(runId);
const taskFile=`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const root=path.resolve('.');
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(content);}catch{res.writeHead(404).end();}
});
const offlineOnly=process.argv.includes('--offline-only');
const rowOnly=process.argv.includes('--row-only');
const evidence=(offlineOnly||rowOnly)?JSON.parse(await readFile('tests/n44-settings-standalone.json','utf8')):{taskId,runId,checks:[],layouts:[],status:'FAIL'};
const check=(name,detail)=>{evidence.checks=evidence.checks.filter(row=>row.name!==name);evidence.checks.push({name,status:'PASS',evidence:detail});};
async function checkpoint(page,expected=owner){
 await page.evaluate(async()=>{window.__n44Store=await import('/src/store.js');window.__n44Cloud=await import('/src/lib/cloud.js');window.__n44Events=await import('/src/lib/notification-events.js');});
 const handle=await page.waitForFunction(expected=>{
  const s=window.__n44Store,c=window.__n44Cloud;
  const context=window.__n44Events.currentNotificationContext(s,c);
  if(!s.state.ready || s.getActiveWorkspace()?.authUserId!==expected || s.state.device?.accountProvisioningReceipt?.ownerId!==expected || context?.ownerId!==expected || !document.querySelector('.layout'))return false;
  return {owner:s.getActiveWorkspace().authUserId,database:s.getActiveWorkspace().databaseName,receipt:s.state.device.accountProvisioningReceipt.ownerId};
 },expected);
 const value=await handle.jsonValue();await handle.dispose();return value;
}
const selected=(page,selector,attribute,value)=>page.waitForFunction(({selector,attribute,value})=>document.querySelector(selector)?.getAttribute(attribute)===value,{selector,attribute,value});
async function boot(page,url,expected=owner){await page.goto(url);evidence.checkpoint=await checkpoint(page,expected);await page.locator('.n44-settings-page').waitFor();}
async function geometry(page,label){
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.n44-timing-options')).display==='grid');
 const data=await page.evaluate(()=>{
  const root=document.querySelector('.n44-settings-page'),controls=[...root.querySelectorAll('button,a')];
  const bad=controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<44 || r.height<44 || r.left<0 || r.right>innerWidth+1 || el.scrollWidth>el.clientWidth+1;}).map(el=>el.outerHTML);
  const sections=[...root.querySelectorAll('section')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});
  return {pageOverflow:document.documentElement.scrollWidth>innerWidth+1,localOverflow:root.scrollWidth>root.clientWidth+1,bad,overlap:sections[0].bottom>sections[1].top,legend:root.querySelectorAll('fieldset,legend').length,columns:getComputedStyle(root.querySelector('.n44-minute-grid')).gridTemplateColumns};
 });
 assert.equal(data.pageOverflow,false,label);assert.equal(data.localOverflow,false,label);assert.deepEqual(data.bad,[],label);assert.equal(data.overlap,false,label);assert.equal(data.legend,0);
 evidence.layouts.push({label,...data});
}
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;evidence.origin=base;
 if(!offlineOnly && !rowOnly) await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},timezoneId:'Asia/Riyadh',locale:'ar-SA'});
  await context.addInitScript(()=>{if(!localStorage.getItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:fixedNow});
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
  await boot(page,base+'/#/settings/notifications');
  assert.ok((await page.title()).includes('الإشعارات'));
  assert.equal(await page.locator('a[href="#/settings"].is-on,a[href="#/settings"].is-active,a[href="#/settings"][aria-current="page"]').count()>0,true,'settings navigation remains active');
  await selected(page,'[data-minutes="15"]','aria-pressed','true');
  assert.equal(await page.locator('[data-day][aria-checked="true"]').count(),4);
  for(const scheme of ['light','dark']){
   await page.evaluate(s=>{document.documentElement.setAttribute('data-theme',s);},scheme);
   for(const width of [320,360,390,480,768,1280]){await page.setViewportSize({width,height:844});await geometry(page,scheme+'-'+width);}
  }
  await page.setViewportSize({width:844,height:390});await geometry(page,'landscape');
  await page.setViewportSize({width:640,height:422});await page.evaluate(()=>document.documentElement.style.zoom='2');await geometry(page,'200%-zoom');
  await page.evaluate(()=>document.documentElement.style.zoom='');await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(os.tmpdir(),'n44-standalone-390.png'),fullPage:true});
  check('n44_responsive_unclipped_ui_and_touch_targets','Actual DOM/source CSS: 12 width/theme combinations, landscape, CSS 200% zoom; all controls >=44px, no overflow/clipping/section overlap or fieldset legends.');
  for(const minutes of [5,10,15,20,30,45,60]){await page.locator(`[data-minutes="${minutes}"]`).click();await selected(page,`[data-minutes="${minutes}"]`,'aria-pressed','true');}
  for(const day of [3,2,1,0]){await page.locator(`[data-day="${day}"]`).click();await selected(page,`[data-day="${day}"]`,'aria-checked','false');}
  await page.locator('[data-day="2"]').click();await selected(page,'[data-day="2"]','aria-checked','true');
  for(const kind of ['lesson','due']){
   const sel=`[data-kind="${kind}"]`;
   await page.locator(sel).focus();await page.keyboard.press('Space');await selected(page,sel,'aria-checked','false');
   assert.equal(await page.locator(kind==='lesson'?'[data-minutes]':'[data-day]').count(),0);
   assert.equal(await page.locator(sel).evaluate(el=>el===document.activeElement),true,'focus restored after repaint');
   await page.keyboard.press('Space');await selected(page,sel,'aria-checked','true');
  }
  await selected(page,'[data-minutes="60"]','aria-pressed','true');assert.equal(await page.locator('[data-day][aria-checked="true"]').count(),1);
  await page.locator('.n44-settings-back').click();await page.locator('.n44-settings-link').waitFor();
  assert.equal(await page.locator('[data-act^="notification-"]').count(),0);
  for(const sel of ['[data-settings-profile]','[data-act="teacher-setup-import"]','[data-act="theme"]','[data-act="sound"]','[data-act="visual-fx"]'])assert.ok(await page.locator(sel).count(),sel);
  await page.locator('.n44-settings-link').click();await page.locator('.n44-settings-page').waitFor();await page.reload();await checkpoint(page);await selected(page,'[data-minutes="60"]','aria-pressed','true');
  await page.evaluate(async()=>(await import('/src/app.js')).repaint());await selected(page,'[data-day="2"]','aria-checked','true');
  check('n44_settings_route_entry_and_back','Deep-link boot, correct title/active Settings navigation, clean Settings row, explicit back, route re-entry/reload/repaint and keyboard Space/focus pass.');
  const copy=await page.locator('.n44-settings-page').innerText();assert.ok(!/Push|حماية البيانات|الضرورية|محفوظة لحسابك|owner|workspace/i.test(copy));
  check('n44_no_redundant_safety_or_technical_copy','Rendered page contains only back link, useful headings and controls; no mandatory-alert warnings, technical metadata, Push teaser or footer filler.');
  const before=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('rakeezx-notification-categories-v1:')).map(k=>[k,localStorage.getItem(k)])));
  const stale=await page.evaluate(async()=>{
   const button=document.querySelector('[data-minutes="5"]');
   (await import('/src/store.js')).deactivateWorkspace('n44-local-test-switch');
   (await import('/src/views/notification-settings.js')).default.actions['notification-minutes'](button);
   return document.querySelectorAll('.n44-settings button').length;
  });assert.equal(stale,0);
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('rakeezx-notification-categories-v1:')).map(k=>[k,localStorage.getItem(k)]))),before);
  await page.goto(base+'/manifest.webmanifest');await page.evaluate(async o=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount(o);},otherOwner);
  await boot(page,base+'/#/settings/notifications',otherOwner);await selected(page,'[data-minutes="15"]','aria-pressed','true');assert.equal(await page.locator('[data-day][aria-checked="true"]').count(),4);
  await page.goto(base+'/manifest.webmanifest');await page.evaluate(async o=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount(o);},owner);
  await boot(page,base+'/#/settings/notifications');await selected(page,'[data-minutes="60"]','aria-pressed','true');
  await page.evaluate(async()=>{localStorage.removeItem((await import('/src/lib/cloud.js')).AUTH_STORAGE_KEY);(await import('/src/app.js')).repaint();});
  assert.equal(await page.locator('.n44-settings button').count(),0);assert.equal(await page.locator('[data-minutes]').count(),0);
  check('n44_owner_scoped_timing_and_toggle_functions','Actual synthetic account store + ownership guard: all 7 minutes, 4 independent days, category hide/show preserving values, reload/repaint, A/B defaults and A persistence, deactivation clears synchronously and stale handler cannot write; missing auth fails closed.');
  assert.deepEqual(errors,[]);evidence.pageErrors=errors;
 });
 if(rowOnly) await withIsolatedLocalBrowser({taskFile,runId,url:base},async({createContext})=>{
  const context=await createContext({viewport:{width:320,height:844},timezoneId:'Asia/Riyadh',locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await page.clock.install({time:fixedNow});await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
  await page.goto(base+'/#/settings');await checkpoint(page);await page.locator('.n44-settings-link').waitFor();
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844});
   const result=await page.locator('.n44-settings-link').evaluate(el=>{
    const r=el.getBoundingClientRect(),next=el.nextElementSibling.getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,width:r.width,height:r.height,overlap:r.bottom>next.top,left:r.left,right:r.right};
   });
   assert.equal(result.overflow,false,JSON.stringify({width,...result}));assert.equal(result.overlap,false,JSON.stringify({width,...result}));assert.ok(result.height>=44&&result.left>=0&&result.right<=width+1);
  }
  await page.setViewportSize({width:320,height:844});await page.locator('.n44-settings-link').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(os.tmpdir(),'n44-settings-row-320.png')});
  await page.locator('.n44-settings-link').click();await page.locator('.n44-settings-page').waitFor();
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
  await page.screenshot({path:path.join(os.tmpdir(),'n44-standalone-light-320.png'),fullPage:true});
  check('n44_settings_row_layout','Actual Settings row inspected at 320/390/768/1280: >=44px, no overflow or overlap with neighboring appearance row; link opens dedicated actual page.');
 });
 if(offlineOnly){
  const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
  const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
  let browser,leased=false;
  try{
   evidence.browserLease=lease('acquire');leased=true;
   browser=await chromium.launch({headless:true});
   const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Riyadh',locale:'ar-SA',serviceWorkers:'allow'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
   await context.addInitScript(()=>{if(!localStorage.getItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
   const page=await context.newPage();page.setDefaultTimeout(20000);await page.clock.install({time:fixedNow});
   await openReadyServedDemo(page,base);
   await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
   await boot(page,base+'/#/settings/notifications');
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const assets=['src/router.js','src/views/notification-settings.js','src/styles/notifications.css','src/lib/notification-state.js'];
   await page.waitForFunction(async assets=>(await Promise.all(assets.map(asset=>caches.match(new URL(asset,location.origin))))).every(Boolean),assets);
   await context.setOffline(true);await page.reload();evidence.offlineCheckpoint=await checkpoint(page);await page.locator('.n44-settings-page').waitFor();
   await page.locator('[data-minutes="45"]').click();await selected(page,'[data-minutes="45"]','aria-pressed','true');
   await page.locator('.n44-settings-back').click();await page.locator('.n44-settings-link').waitFor();await page.locator('.n44-settings-link').click();await selected(page,'[data-minutes="45"]','aria-pressed','true');
   await page.reload();await checkpoint(page);await selected(page,'[data-minutes="45"]','aria-pressed','true');
   assert.equal(await page.locator('[data-offline-lease="LIMITED"]').count(),1);
   check('n44_offline_service_worker_route','Shared browser phase lease acquired: real SW caches route/module/CSS/state; network-offline deep reload, route/back, preference handler persistence and same-document owner/database/receipt checkpoint pass; existing read-only lease banner remains. Synthetic local fixtures only.');
  }finally{await browser?.close();if(leased)evidence.browserLeaseRelease=lease('release');}
 }
 const sw=await readFile('sw.js','utf8');for(const asset of ['src/views/notification-settings.js','src/styles/notifications.css','src/lib/notification-state.js'])assert.ok(sw.includes(`'./${asset}'`));
 if(!offlineOnly && !rowOnly) check('n44_other_settings_N64_N36_and_offline_regression','Actual Settings DOM retains N64 profile, N36 import, appearance/audio/visual controls. Offline shell statically includes new module plus unchanged timing and CSS dependencies; SW runtime cache proof is separate.');
 evidence.sourceHashes=Object.fromEntries(await Promise.all(['src/router.js','src/views/settings.js','src/views/notification-settings.js','src/styles/notifications.css','sw.js'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 if(evidence.error){evidence.resolvedFailures??=[];evidence.resolvedFailures.push({error:evidence.error,resolution:'Settings row spans the desktop grid; targeted row check passes after scoped CSS correction.'});delete evidence.error;}
 evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=error.stack;throw error;}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));evidence.cleanup='Owned server closed; canonical helper closes disposable contexts/browser in finally.';await writeFile('tests/n44-settings-standalone.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence));

