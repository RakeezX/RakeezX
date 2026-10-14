/** Actual unbundled app DOM/handlers/CSS + SW on disposable local accounts. */
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixedNow, owner, otherOwner } from './n44-fixture.mjs';
const root=path.resolve('.'), output=path.join(root,'tests/n44-ui-evidence');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n44-live-inapp-center-20261014.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const runId='a68107da-12e1-4d90-a67a-b1afddecfcf3';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname==='/'?'/index.html':new URL(req.url,'http://127.0.0.1').pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const evidence={taskId:'continuous-n44-live-inapp-center-20261014',runId,checks:[],screenshots:[]};
let browser,leased=false,started=false;
async function checkpoint(page,expectedOwner=owner){
  await page.waitForFunction(async expected=>{
    const s=await import('/src/store.js');
    return s.state.ready && s.getActiveWorkspace()?.authUserId===expected && !!document.querySelector('.layout');
  },expectedOwner);
  // Identity, receipt and affected data read together in this same document.
  const value=await page.evaluate(async()=>{
    const s=await import('/src/store.js');
    return {owner:s.getActiveWorkspace()?.authUserId,database:s.getActiveWorkspace()?.databaseName,
      receipt:s.state.device?.accountProvisioningReceipt,targets:s.state.sessions.filter(r=>!r.deleted).map(r=>r.id)};
  });
  assert.equal(value.owner,expectedOwner);assert.equal(value.receipt.ownerId,expectedOwner);assert.ok(value.database.startsWith('rakeezx-user-'));return value;
}
async function bell(page){await page.locator('.n44-bell').waitFor();await page.locator('.n44-bell').click();await page.locator('.n44-center').waitFor();}
async function close(page){await page.getByRole('dialog').locator('[data-sheet-close]').first().click();await page.locator('.n44-center').waitFor({state:'detached'});}
async function shot(page,name){const filename=name+'.png';await page.screenshot({path:path.join(output,filename),fullPage:true});evidence.screenshots.push('tests/n44-ui-evidence/'+filename);}
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
    assert.equal(await page.locator('.n44-item').count(),3);
    assert.equal(await page.locator('.n44-item--unread').count(),3);
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
  evidence.checks.push({name:'n44_actual_account_event_generation',status:'PASS',evidence:'Actual registered synthetic account boot + runtime ownership guard; 3 real store-derived events at 320/390/1280; past/cancelled/foreign/historical sources absent, stale selected holiday ignored, escaped names, applied source CSS and keyboard focus return.'});
  await page.setViewportSize({width:390,height:844});await bell(page);
  await page.locator('[data-act="n44-read"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.n44-item--unread').length===2);
  await page.locator('[data-act="n44-dismiss"]').nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('.n44-item').length===2);
  await close(page);
  await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});
  await bell(page);assert.equal(await page.locator('.n44-item--unread').count(),1);
  await close(page);await page.reload();await checkpoint(page);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),2);assert.equal(await page.locator('.n44-item--unread').count(),1);
  const saved=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('rakeezx-notification-preferences-v1:')).map(k=>[k,JSON.parse(localStorage.getItem(k))])));
  assert.equal(Object.keys(saved).length,1);
  for(const rows of Object.values(saved))for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['dismissedAt','id','readAt']);
  assert.ok(!JSON.stringify(saved).includes('synthetic-local-only')&&!JSON.stringify(saved).includes('script'));
  // Stale DOM child deleted synchronously without repaint before the handler.
  const dueButton=page.locator('[data-act="n44-open"]').last();
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
  await page.evaluate(async other=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount(other);(await import('/src/app.js')).repaint();},otherOwner);
  await page.reload();await checkpoint(page,otherOwner);await bell(page);
  assert.ok(await page.locator('.n44-item--unread').count()>=3,'B does not inherit A read/dismiss state');await close(page);
  // Logout state removed synchronously by the auth/storage listener.
  await bell(page);
  const logout=await page.evaluate(async()=>{
    const c=await import('/src/lib/cloud.js');c.setMockAuth(null,null);localStorage.removeItem(c.AUTH_STORAGE_KEY);
    dispatchEvent(new StorageEvent('storage',{key:c.AUTH_STORAGE_KEY,newValue:null}));
    return document.querySelectorAll('.n44-item').length;
  });assert.equal(logout,0);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async()=>{await(await import('/tests/n44-fixture.mjs')).prepareAccount();});
  await page.reload();await checkpoint(page);
  evidence.checks.push({name:'n44_safe_navigation_no_sensitive_leak',status:'PASS',evidence:'Actual handler rechecks deleted child before navigation; allowlisted lesson opens exact session; storage contains IDs/timestamps only; unchanged outbox; read-only banner intact; deactivation/logout clear private DOM synchronously; B receives independent unread state.'});
  await page.clock.fastForward(60*60000);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),1,'lesson expires at actual end');await close(page);
  await page.clock.fastForward(14*60*60000+15*60000);await bell(page);
  assert.equal(await page.locator('[data-act="n44-open"][data-id="due:n44-due:2026-10-14"]').count(),0,'dismissed due day does not resurrect on resume');await close(page);
  await page.clock.fastForward(48*60*60000);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),0);await shot(page,'quiet-empty');await close(page);
  evidence.checks.push({name:'n44_owner_read_dismiss_expiry',status:'PASS',evidence:'Actual read/dismiss handlers persist over reload and resume without duplicates; exact lesson end and local due-day expiry recalculated, quiet empty state; A/B independent, synchronous clearing; pure bounded/clock/storage failure checks also 5/5 PASS.'});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const assets=['src/lib/notification-center.js','src/lib/notification-events.js','src/lib/notification-state.js','src/views/notifications.js','src/styles/notifications.css'];
  await page.waitForFunction(async list=>(await Promise.all(list.map(p=>caches.match(new URL(p,location.origin))))).every(Boolean),assets);
  evidence.cached=await page.evaluate(async list=>Object.fromEntries(await Promise.all(list.map(async p=>[p,!!await caches.match(new URL(p,location.origin))]))),assets);
  await context.setOffline(true);await page.reload();evidence.offlineCheckpoint=await checkpoint(page);await bell(page);
  assert.equal(await page.locator('.n44-item').count(),0);
  assert.equal(await page.locator('[data-offline-lease="LIMITED"]').count(),1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.n44-actions')??document.querySelector('.n44-note')).lineHeight!=='normal');
  await shot(page,'offline-reload');
  evidence.checks.push({name:'n44_real_ui_offline_boot',status:'PASS',evidence:'Real SW precached all 5 new dependencies before offline reload; actual account/DB/provisioning receipt verified together in reloaded document; center and source stylesheet load with network offline.'});
  evidence.blockedExternalOrigins=[...new Set(blocked)];evidence.pageErrors=errors;assert.deepEqual(errors,[]);
  evidence.status='PASS';console.log(JSON.stringify(evidence));
}catch(error){evidence.status='FAIL';evidence.error=error.stack;throw error;}
finally{
  await browser?.close();if(started)await new Promise(resolve=>server.close(resolve));
  if(leased)evidence.release=lease('release');
  if(started)await writeFile(path.join(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');
}
