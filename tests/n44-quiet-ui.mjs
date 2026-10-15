/** Actual unbundled app DOM/handlers/CSS + SW on disposable local accounts. */
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixedNow, owner, otherOwner } from './n44-fixture.mjs';
const root=path.resolve('.'), output=path.join(root,'tests');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n44-configurable-reminder-intervals-20261015.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const runId=process.env.N44_RUN_ID;
if(!runId)throw new Error('N44_RUN_ID must match the current activated card');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname==='/'?'/index.html':new URL(req.url,'http://127.0.0.1').pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const evidence={taskId:'continuous-n44-configurable-reminder-intervals-20261015',runId,checks:[],layoutInspections:[]};
let browser,leased=false,started=false;
async function checkpoint(page,expectedOwner=owner){
  // Return a snapshot from the successful checkpoint itself; a readiness
  // predicate from a prior document never authorizes reads after a reload.
  await page.evaluate(async()=>{window.__n44CheckpointStore=await import('/src/store.js');});
  const handle=await page.waitForFunction(expected=>{
    const s=window.__n44CheckpointStore;
    if(!s.state.ready || s.getActiveWorkspace()?.authUserId!==expected || !document.querySelector('.layout') ||
      s.state.device?.accountProvisioningReceipt?.ownerId!==expected)return false;
    return {owner:s.getActiveWorkspace()?.authUserId,database:s.getActiveWorkspace()?.databaseName,
      receipt:s.state.device?.accountProvisioningReceipt,targets:s.state.sessions.filter(r=>!r.deleted).map(r=>r.id)};
  },expectedOwner);
  const value=await handle.jsonValue();await handle.dispose();
  assert.equal(value.owner,expectedOwner);assert.equal(value.receipt.ownerId,expectedOwner);assert.ok(value.database.startsWith('rakeezx-user-'));return value;
}
async function bell(page){await page.locator('.n44-bell').waitFor();await page.locator('.n44-bell').click();await page.locator('.n44-center').waitFor();}
async function close(page){await page.getByRole('dialog').locator('[data-sheet-close]').first().click();await page.locator('.n44-center').waitFor({state:'detached'});}
async function shot(page,name){
  const style=await page.locator('.n44-center').evaluate(el=>({width:el.clientWidth,overflow:el.scrollWidth>el.clientWidth+1}));
  assert.equal(style.overflow,false);evidence.layoutInspections.push({name,layout:style});
}

try{
  evidence.lease=lease('acquire');leased=true;
  await mkdir(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));started=true;
  const base=`http://127.0.0.1:${server.address().port}`;evidence.origin=base;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Riyadh',locale:'ar-SA',serviceWorkers:'allow'});
  const blocked=[];await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    blocked.push(new URL(route.request().url()).origin);return route.abort('blockedbyclient');
  });
  await context.addInitScript(()=>{if(!localStorage.getItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:fixedNow});
  await openReadyServedDemo(page,base);
  assert.equal(await page.locator('.n44-bell').count(),0,'Demo cannot feed account events');
  await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();(await import('/src/app.js')).repaint();});
  await page.reload();evidence.checkpoint=await checkpoint(page);
  const outboxBefore=await page.evaluate(async()=>await(await import('/src/lib/db.js')).getAll('outbox'));
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});await bell(page);
    assert.equal(await page.locator('.n44-item').count(),4);
    assert.equal(await page.locator('.n44-item--unread').count(),4);
    assert.equal(await page.locator('.n44-center img,.n44-center script').count(),0,'source text escaped');
    assert.ok((await page.locator('.n44-center').innerText()).includes('<script>alert(2)</script>'));
    const geometry=await page.evaluate(()=>{
      const center=document.querySelector('.n44-center'),bell=document.querySelector('.n44-bell'),dialog=document.querySelector('[role=dialog]');
      return {centerOverflow:center.scrollWidth>center.clientWidth+1,dialogOverflow:dialog.scrollWidth>dialog.clientWidth+1,
        pageOverflow:document.documentElement.scrollWidth>innerWidth+1,bellWidth:bell.getBoundingClientRect().width,
        display:getComputedStyle(document.querySelector('.n44-actions')).display};
    });
    assert.equal(geometry.centerOverflow,false);assert.equal(geometry.dialogOverflow,false);assert.equal(geometry.pageOverflow,false);
    assert.equal(geometry.display,'flex');assert.ok(geometry.bellWidth>=44);
    await shot(page,'center-'+width);await page.keyboard.press('Escape');await page.locator('.n44-center').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('n44-bell')),true);
  }
  evidence.checks.push({name:'n44_actual_account_event_generation',status:'PASS',evidence:'Actual registered synthetic account boot + runtime ownership guard; 4 real store-derived events at 320/390/1280; past/cancelled/foreign/historical sources absent, stale selected holiday ignored, escaped names, applied source CSS and keyboard focus return.'});
  await page.goto(base+'/#/settings');await page.getByRole('switch',{name:'تذكيرات الحصص'}).waitFor();
  for (const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    // Viewport changes schedule a repaint: inspect a connected current DOM in
    // the same successful checkpoint, never a locator's detached prior node.
    const layout=await page.waitForFunction(()=>{
      const el=document.querySelector('.n44-settings'),options=el?.querySelector('.n44-timing-options');
      if(!el?.isConnected || !options || getComputedStyle(options).display!=='flex')return false;
      return {overflow:el.scrollWidth>el.clientWidth+1,page:document.documentElement.scrollWidth>innerWidth+1,display:getComputedStyle(options).display};
    });
    const geometry=await layout.jsonValue();await layout.dispose();
    assert.deepEqual(geometry,{overflow:false,page:false,display:'flex'});
    await page.locator('[data-act="notification-minutes"][data-minutes="5"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-minutes="5"]').getAttribute('aria-pressed')==='true');
    await bell(page);assert.equal(await page.locator('.n44-item').count(),3);await close(page);
    await page.locator('[data-act="notification-minutes"][data-minutes="30"]').click();
    await bell(page);assert.equal(await page.locator('.n44-item').count(),4);await close(page);
    for (const day of [3,2,1,0]) {
      const button=page.locator('[data-act="notification-day"][data-day="'+day+'"]');
      await button.click();await page.waitForFunction(d=>document.querySelector('[data-day="'+d+'"]').getAttribute('aria-checked')==='false',day);
    }
    await bell(page);assert.equal(await page.locator('.n44-item').count(),1);await close(page);
    await page.reload();await checkpoint(page);
    assert.equal(await page.locator('[data-minutes="30"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-act="notification-day"][aria-checked="false"]').count(),4);
    for (const day of [3,2,1,0]) await page.locator('[data-act="notification-day"][data-day="'+day+'"]').click();
    await page.locator('[data-act="notification-minutes"][data-minutes="15"]').click();
  }
  evidence.checks.push({name:'n44_user_timing_actual_settings_mobile',status:'PASS',evidence:'Actual authenticated settings handlers, applied flex CSS at 320/390, 5/30 minute immediate event replacement, all four independent stage switches and reload persistence; defaults restored for retained regression.'});
  await page.evaluate(async()=>{
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),e=await import('/src/lib/notification-events.js'),p=await import('/src/lib/notification-state.js');
    const context=e.currentNotificationContext(s,c),key=p.NOTIFICATION_CATEGORY_PREFIX+(await import('/src/lib/notification-center.js')).notificationScope(context);
    const oldValue=localStorage.getItem(key);p.writeNotificationTiming(context,{lessonMinutes:10,dueDays:[1]});
    dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:localStorage.getItem(key)}));
  });
  await page.waitForFunction(()=>document.querySelector('[data-minutes="10"]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-day="1"]').getAttribute('aria-checked'),'true');
  assert.equal(await page.locator('[data-act="notification-day"][aria-checked="false"]').count(),3);
  await page.locator('[data-minutes="15"]').click();
  for(const day of [3,2,0]) await page.locator('[data-act="notification-day"][data-day="'+day+'"]').click();
  const lessonSwitch=()=>page.getByRole('switch',{name:'تذكيرات الحصص'});
  assert.equal(await lessonSwitch().getAttribute('aria-checked'),'true');
  await lessonSwitch().click();await page.waitForFunction(()=>document.querySelector('[data-kind="lesson"]').getAttribute('aria-checked')==='false');
  await bell(page);assert.equal(await page.locator('.n44-item').count(),3);await close(page);
  await page.getByRole('switch',{name:'تذكيرات تسليم البنود'}).click();
  await page.reload();await checkpoint(page);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),0);
  assert.equal(await page.locator('.n44-count,.n44-note').count(),0);
  assert.equal(await page.locator('.n44-empty h2').innerText(),'لا توجد إشعارات حاليًا');
  assert.equal(await page.locator('.n44-empty p').innerText(),'كل شيء تمام حتى الآن');
  await page.setViewportSize({width:320,height:844});await shot(page,'quiet-empty-320');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('n44-bell')),true);
  await lessonSwitch().click();await page.getByRole('switch',{name:'تذكيرات تسليم البنود'}).click();
  await page.goto(base+'/#/');await checkpoint(page);
  evidence.checks.push({name:'n44_preferences_real_settings_and_quiet_empty',status:'PASS',evidence:'Actual settings switches default on; independent lesson/due suppression; both flags survive reload; exact calm empty copy without count/notes, 320px layout, Escape focus restored.'});
  // Exercise the real account entry with the existing negative owner guard.
  await bell(page);
  await page.evaluate(async other=>{
    const s=await import('/src/store.js'),g=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;
    g.setWorkspace({...s.getActiveWorkspace(),authUserId:other});(await import('/src/app.js')).repaint();
  },otherOwner);
  await page.locator('.n44-center').waitFor({state:'detached'});assert.equal(await page.locator('.n44-bell').count(),0);
  await page.evaluate(async()=>{
    const s=await import('/src/store.js');(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard.setWorkspace(s.getActiveWorkspace());
    (await import('/src/app.js')).repaint();
  });
  await page.setViewportSize({width:390,height:844});await bell(page);
  await page.locator('[data-act="n44-read"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.n44-item--unread').length===3);
  await page.locator('[data-act="n44-dismiss"]').nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('.n44-item').length===3);
  await close(page);
  await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});
  await bell(page);assert.equal(await page.locator('.n44-item--unread').count(),2);
  await close(page);await page.reload();await checkpoint(page);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),3);assert.equal(await page.locator('.n44-item--unread').count(),2);
  const saved=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('rakeezx-notification-preferences-v1:')).map(k=>[k,JSON.parse(localStorage.getItem(k))])));
  assert.equal(Object.keys(saved).length,1);
  for(const rows of Object.values(saved))for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['dismissedAt','id','readAt']);
  assert.ok(!JSON.stringify(saved).includes('synthetic-local-only')&&!JSON.stringify(saved).includes('script'));
  // Stale DOM child deleted synchronously without repaint before the handler.
  const dueButton=page.locator('[data-act="n44-open"][data-id="due:n44-soon:2026-10-16:2026-10-14"]');
  await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.scoreSubitems.find(r=>r.id==='n44-soon').deleted=true;});
  const hash=await page.evaluate(()=>location.hash);await dueButton.click();assert.equal(await page.evaluate(()=>location.hash),hash);
  await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.scoreSubitems.find(r=>r.id==='n44-soon').deleted=false;(await import('/src/app.js')).repaint();});
  await page.locator('[data-act="n44-open"]').first().click();await page.waitForURL('**/attendance?session=n44-session');
  assert.equal(await page.locator('.n44-center').count(),0);
  assert.equal(await page.locator('[data-offline-lease="LIMITED"]').count(),1,'read-only banner remains visible');
  // No durable Product write from notification actions/navigation.
  assert.deepEqual(await page.evaluate(async()=>await(await import('/src/lib/db.js')).getAll('outbox')),outboxBefore);
  await bell(page);
  const cleared=await page.evaluate(async()=>{
    (await import('/src/store.js')).deactivateWorkspace('n44-owner-switch');
    return {items:document.querySelectorAll('.n44-item').length,bells:document.querySelectorAll('.n44-bell').length};
  });assert.deepEqual(cleared,{items:0,bells:0});
  // Dispose the old document before async fixture preparation. Production's
  // account switch also reloads; never mount B beside A's pending DB reads.
  await page.goto(base+'/manifest.webmanifest');
  await page.evaluate(async other=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount(other);},otherOwner);
  await page.goto(base+'/#/');await checkpoint(page,otherOwner);await bell(page);
  assert.ok(await page.locator('.n44-item--unread').count()>=3,'B does not inherit A read/dismiss state');await close(page);
  // Logout state removed synchronously by the auth/storage listener.
  await bell(page);
  const logout=await page.evaluate(async()=>{
    const c=await import('/src/lib/cloud.js');c.setMockAuth(null,null);localStorage.removeItem(c.AUTH_STORAGE_KEY);
    dispatchEvent(new StorageEvent('storage',{key:c.AUTH_STORAGE_KEY,newValue:null}));
    return document.querySelectorAll('.n44-item').length;
  });assert.equal(logout,0);
  await page.goto(base+'/manifest.webmanifest');
  await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
  await page.goto(base+'/#/');await checkpoint(page);
  evidence.checks.push({name:'n44_safe_navigation_no_sensitive_leak',status:'PASS',evidence:'Actual handler rechecks deleted child before navigation; allowlisted lesson opens exact session; storage contains IDs/timestamps only; unchanged outbox; read-only banner intact; deactivation/logout clear private DOM synchronously; B receives independent unread state.'});
  await page.clock.fastForward(60*60000);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),2,'lesson expires at actual end');await close(page);
  await page.clock.fastForward(14*60*60000+15*60000);await bell(page);
  assert.equal(await page.locator('[data-act="n44-open"][data-id="due:n44-due:2026-10-14:2026-10-14"]').count(),0,'dismissed due day does not resurrect on resume');await close(page);
  await page.clock.fastForward(72*60*60000);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),0);await shot(page,'quiet-empty');await close(page);
  evidence.checks.push({name:'n44_owner_read_dismiss_expiry',status:'PASS',evidence:'Actual read/dismiss handlers persist over reload and resume without duplicates; exact lesson end and local due-day expiry recalculated, quiet empty state; A/B independent, synchronous clearing; pure bounded/clock/storage checks recorded separately.'});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const assets=['src/lib/notification-center.js','src/lib/notification-events.js','src/lib/notification-state.js','src/views/notifications.js','src/styles/notifications.css'];
  await page.waitForFunction(async list=>(await Promise.all(list.map(p=>caches.match(new URL(p,location.origin))))).every(Boolean),assets);
  evidence.cached=await page.evaluate(async list=>Object.fromEntries(await Promise.all(list.map(async p=>[p,!!await caches.match(new URL(p,location.origin))]))),assets);
  await context.setOffline(true);await page.reload();evidence.offlineCheckpoint=await checkpoint(page);await page.goto(base+'/#/settings');await checkpoint(page);
  await page.locator('[data-act="notification-minutes"][data-minutes="60"]').click();
  await page.reload();await checkpoint(page);
  assert.equal(await page.locator('[data-minutes="60"]').getAttribute('aria-pressed'),'true');
  await bell(page);
  assert.equal(await page.locator('.n44-item').count(),0);
  assert.equal(await page.locator('[data-offline-lease="LIMITED"]').count(),1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.n44-actions')??document.querySelector('.n44-empty')).lineHeight!=='normal');
  await shot(page,'offline-reload');
  evidence.checks.push({name:'n44_real_ui_offline_boot',status:'PASS',evidence:'Real SW precached all 5 new dependencies before offline reload; actual account/DB/provisioning receipt verified together in reloaded document; center and source stylesheet load with network offline.'});
  evidence.blockedExternalOrigins=[...new Set(blocked)];evidence.pageErrors=errors;assert.deepEqual(errors,[]);
  evidence.status='PASS';console.log(JSON.stringify(evidence));
}catch(error){evidence.status='FAIL';evidence.error=error.stack;throw error;}
finally{
  await browser?.close();if(started)await new Promise(resolve=>server.close(resolve));
  if(leased)evidence.release=lease('release');
  if(started)await writeFile(path.join(output,'n44-quiet-ui.json'),JSON.stringify(evidence,null,2)+'\n');
}
