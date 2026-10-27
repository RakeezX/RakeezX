// AI-authored: actual app over loopback; canonical disposable browser helper.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
const baseline=process.argv.includes('--baseline'),root=resolve('.'),out='tests/n130-sync-context-supersession-20261027/';
const taskId='continuous-n130-sync-context-after-qualified-sw-20261027',runId='5b8f5719-114b-4dc1-8b1f-f571e3797f51';
const base='http://127.0.0.1:49830',service=syntheticService(),result={taskId,runId,baseline,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path.startsWith('/__n73/')){let input='';for await(const part of req)input+=part;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(input||'{}'))));return;}
 const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside task root');
 let body=await readFile(f);
 if(path==='/'&&new URL(req.url,base).searchParams.has('account'))body=Buffer.from(body.toString().replace("import('./src/lib/app-update.js');","await import('/tests/n107-focus-sync-stability-20261020/sync-bootstrap.mjs'); import('./src/lib/app-update.js');"));
 if(baseline&&path==='/src/lib/sync.js')body=execFileSync('git',['show','c589904f955c2841794025dedda2606edfd2d2f8:src/lib/sync.js']);
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(body);
}catch(e){res.writeHead(500);res.end(e.message);}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49830,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:110000},async({createContext})=>{
  const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),page=await context.newPage();page.setDefaultTimeout(12000);
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
   const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n130-synthetic'};s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
   const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
  });
  await page.goto(base+'/?account#/settings',{waitUntil:'domcontentloaded'});
  await page.locator('.boot').waitFor({state:'detached'});
  await page.waitForTimeout(600);
  await page.evaluate(async()=>{const f=await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs');await f.install();await(await import('/src/lib/sync.js')).syncAll();});
  const before=await page.evaluate(async()=>(await import('/src/lib/sync.js')).state.lastSyncedAt);
  await page.evaluate(async()=>{(await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs')).start('renew',14003);});
  const completed=await page.evaluate(async()=>{const success=await n130Run;return {success,...(await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs')).snapshot()};});
  result.reproduction=completed;
  assert.equal(completed.success,false);assert.equal(completed.renewed,true);assert.ok(completed.elapsedMs>=14000);assert.equal(completed.sends,0);assert.equal(completed.summary.lastSuccessfulSyncAt,before);
  if(baseline){assert.equal(completed.summary.state,'error');assert.equal(completed.summary.lastSafeFailure.code,'CONTEXT_CHANGED');assert.equal(completed.summary.lastSafeFailure.phase,'revision_validation');result.checks.push('Baseline reproduced actual revision_validation CONTEXT_CHANGED after >=14s');await page.waitForTimeout(250);await page.screenshot({path:out+'baseline-desktop.png'});return;}
  assert.equal(completed.summary.state,'pending');assert.equal(completed.summary.presentationSeverity.hardFailure,false);
  // Park only the synthetic read transport of the automatically requested fresh pass.
  await page.evaluate(async()=>{const f=await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs');f.control.mode=null;f.control.gate=new Promise(r=>globalThis.releaseFresh=r);});
  await page.waitForTimeout(400);
  for(const [label,width] of [['desktop',1100],['mobile',390]]){
   await page.setViewportSize({width,height:900});
   await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();
   await page.locator('.mini-hub-sync').waitFor();
   assert.equal(await page.locator('.mini-hub-sync .badge--danger').count(),0);
   assert.equal(await page.locator('.mini-hub-sync [data-sync-safe-failure]').count(),0);
   await page.waitForTimeout(250);await page.screenshot({path:out+label+'-pending.png'});
   await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>{releaseFresh();});
  result.observedFresh=await (await page.waitForFunction(before=>{const s=n130Snapshot().summary;return s.state==='synced'&&s.lastSuccessfulSyncAt>before&&!s.automaticSyncActive?s:false;},before)).jsonValue();
  const success=await page.evaluate(async()=>(await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs')).snapshot());
  result.before=before;result.freshSuccess=success;
  assert.equal(success.summary.lastSafeFailure,null);assert.ok(success.summary.lastSuccessfulSyncAt>before);assert.equal(success.sends,0);
  for(const [label,width] of [['desktop',1100],['mobile',390]]){
   await page.setViewportSize({width,height:900});await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();
   assert.match(await page.locator('.mini-hub-sync').innerText(),/آخر مزامنة:/);assert.equal(await page.locator('.mini-hub-sync .sync-dot--synced').count(),1);
   await page.waitForTimeout(250);await page.screenshot({path:out+label+'-success.png'});await page.keyboard.press('Escape');
  }
  // Actual coordinator failure -> actual app red and support -> fresh success removes stale details.
  await page.evaluate(async()=>{const f=await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs');f.control.gate=null;f.start('403');await n130Run;});
  await page.waitForFunction(()=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--error'));
  await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();await page.locator('.mini-hub-sync details summary').click();
  assert.match(await page.locator('[data-sync-safe-failure]').innerText(),/HTTP_403/);await page.waitForTimeout(250);await page.screenshot({path:out+'mobile-real-failure.png'});await page.keyboard.press('Escape');
  await page.evaluate(async()=>{const f=await import('/tests/n130-sync-context-supersession-20261027/browser-fixture.mjs');f.start(null);await n130Run;});
  await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();assert.equal(await page.locator('[data-sync-safe-failure]').count(),0);assert.equal(await page.locator('.mini-hub-sync .sync-dot--synced').count(),1);
  result.checks.push('Actual authenticated app/store entry: obsolete run false, no ACK/sends/timestamp, guarded fresh full convergence; desktop/mobile pending and successful timestamp; real 403 red and stale detail clears on fresh full success');
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile(out+(baseline?'baseline-result.json':'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
