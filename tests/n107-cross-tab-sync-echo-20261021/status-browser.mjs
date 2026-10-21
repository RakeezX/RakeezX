// AI-authored correction for the previous demo-to-account DOM fixture failure.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from '../n73-account-flow-fixture.mjs';
const taskId='continuous-n107-cross-tab-sync-echo-20261021',runId='5932cb85-e839-47b6-8b31-ffec129d95c2';
const base='http://127.0.0.1:49862',root=resolve('.'),out='tests/n107-cross-tab-sync-echo-20261021/';
const service=syntheticService(),result={taskId,runId,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,base),path=url.pathname;
 if(path.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(body||'{}'))));return;}
 const file=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');
 let body=await readFile(file);
 if(path==='/'&&url.searchParams.has('account'))body=Buffer.from(body.toString().replace("import('./src/lib/app-update.js');","await import('/tests/n107-cross-tab-sync-echo-20261021/status-bootstrap.mjs'); import('./src/lib/app-update.js');"));
 res.end(body);
}catch(e){res.writeHead(500);res.end(e.message);}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49862,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'}),page=await context.newPage();
  page.setDefaultTimeout(10000);
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
   const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-status-local'};
   await d.put('device',{...s.state.device,accountProvisioningReceipt:receipt});
   const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
   try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
  });
  // Real reload/boot: app chooses the account and mounts the account header.
  await page.goto(base+'/?account#/classes/koshoof',{waitUntil:'domcontentloaded'});
  await page.locator('[data-roster-file-flow]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--synced'));
  // Ownership, DB, receipt and data are observed together in THIS document.
  result.checkpoint=await page.evaluate(async()=>{
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
   s.assertClassImportAccess();
   return {owner:c.user.id,workspace:s.getActiveWorkspace(),database:d.getActiveDatabaseName(),receipt:s.state.device.accountProvisioningReceipt,students:s.state.students.length,outbox:await d.getAll('outbox')};
  });
  assert.equal(result.checkpoint.owner,owner);assert.equal(result.checkpoint.workspace.authUserId,owner);
  assert.equal(result.checkpoint.database,result.checkpoint.workspace.databaseName);
  assert.equal(result.checkpoint.receipt.foundationHash,'n107-status-local');
  assert.equal(result.checkpoint.receipt.ownerId,owner);assert.ok(result.checkpoint.students>0);assert.equal(result.checkpoint.outbox.length,0);
  result.green=await page.locator('.topbar [data-sync-status]').evaluate(el=>({className:el.className,color:getComputedStyle(el).backgroundColor}));
  // Real owner-guarded Product entry, durable outbox and automatic dispatch.
  await page.evaluate(async()=>{
   const s=await import('/src/store.js');if(!await s.patchProfile({teacherName:'Synthetic rendered failure'}))throw Error('Save failed');
  });
  await page.waitForFunction(()=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--error'));
  result.failure=await page.evaluate(async()=>{
   const d=await import('/src/lib/db.js'),y=await import('/src/lib/sync.js');const dot=document.querySelector('.topbar [data-sync-status]');
   return {summary:await y.getSyncOperationalSummary(),outbox:await d.getAll('outbox'),dot:{className:dot.className,color:getComputedStyle(dot).backgroundColor}};
  });
  assert.equal(result.failure.summary.state,'error');assert.equal(result.failure.summary.cloudSyncHealthy,false);
  assert.ok(result.failure.outbox.some(r=>r.ownerId===owner&&r.state==='failed'));
  assert.notEqual(result.failure.dot.color,result.green.color);
  await page.screenshot({path:out+'account-dispatch-error.png',fullPage:true});
  result.checks.push({name:'additional_rendered_indicator_probe',status:'PASS',evidence:'Corrected account reload/boot fixture: actual owner-guarded app and source CSS render green with empty outbox, then red after real patchProfile auto-dispatch failure; durable owner-bound failed command retained.'});
  assert.equal(service.evidence.commits,0);
  await page.evaluate(async()=>{await(await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();(await import('/src/store.js')).closeChannel();(await import('/src/lib/db.js')).closeDB();});
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile(out+'status-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
