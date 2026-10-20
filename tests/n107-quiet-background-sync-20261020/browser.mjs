// AI-authored: one bounded changed-view check; real app/CSS/handlers, synthetic owner.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from '../n73-account-flow-fixture.mjs';
import {makeEnrollment} from '../../src/models.js';
const taskId='continuous-n107-quiet-background-sync-20261020',runId='8c838923-1131-4655-8a58-7c085db2ff86';
const base='http://127.0.0.1:49819',root=resolve('.'),out='tests/n107-quiet-background-sync-20261020/';
const service=syntheticService();
service.current.enrollments=service.current.students.map((s,i)=>({...makeEnrollment({id:'e'+i,studentId:s.id,sectionId:'n73-source-section'}),ownerId:owner,serverRevision:1}));
const result={taskId,runId,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(body||'{}'))));return;}
 const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(await readFile(f));
}catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message}));}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49819,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>result.failures.push(e.message));
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
   const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-roster-local'};
   s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
   const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
   try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
   const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
   if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
   await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
   s.assertClassImportAccess();location.hash='#/classes/koshoof?teaching=n73-source';(await import('/src/repaint.js')).repaint();
  });
  await page.locator('[data-roster-file-flow]').waitFor();
  // View-only fixtures belong to the synthetic account; no coordinator or service writes.
  const seedPlans=async states=>page.evaluate(async states=>{
   const s=await import('/src/store.js'),w=s.getActiveWorkspace();s.assertClassImportAccess();
   s.state.device.classFileImportPlans=Object.fromEntries(states.map((state,i)=>['private-plan-'+i,{id:'private-plan-'+i,state,ownerId:w.authUserId,databaseName:w.databaseName,created:{teachingId:'n73-source'}}]));
   (await import('/src/repaint.js')).repaint();
  },states);
  const snapshot=()=>page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return JSON.stringify({plans:s.state.device.classFileImportPlans,rows:await Promise.all(['teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n)))});});
  for(const state of ['waiting_creation','waiting_sync','syncing','local_ready','cloud_confirmed','cancelled']){
   await seedPlans([state]);const before=await snapshot();
   assert.equal(await page.locator('[data-local-import-plans]').count(),0,state);
   assert.equal(await page.locator('[data-act="local-import-cancel"]').count(),0,state);
   assert.doesNotMatch(await page.locator('main').innerText(),/المزامنة في الخلفية|إيقاف المتابعة|private-plan|waiting_creation|waiting_sync|local_ready/);
   assert.equal(await snapshot(),before);
  }
  result.checks.push({name:'n107_routine_background_progress_hidden',status:'PASS',evidence:'Actual served app: all four routine states omit background panel and safe-stop controls; terminal plans add no recovery panel. Rendering preserves synthetic plan/data/outbox snapshots.'});
  await seedPlans(['waiting_sync']);
  for(const [label,width]of [['desktop',1100],['narrow',390]]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'routine-'+label+'.png',fullPage:true});}
  for(const state of ['uncertain','needs_review']){
   await seedPlans(['waiting_sync',state,'cloud_confirmed']);const before=await snapshot();
   const panel=page.locator('[data-local-import-plans]');
   assert.equal(await panel.locator('[data-act="local-import-retry"]').count(),1);
   assert.equal(await panel.locator('[data-act="local-import-retry"]').isVisible(),true);
   assert.equal(await panel.locator('details').evaluate(e=>e.open),false);
   assert.equal(await panel.locator('[data-act="local-import-cancel"]').isVisible(),false);
   assert.doesNotMatch(await panel.innerText(),/private-plan|waiting_sync|uncertain|needs_review|الطلب غير المؤكد|المزامنة في الخلفية/);
   assert.equal(await panel.locator('[data-act="local-import-retry"]').getAttribute('data-plan'),'private-plan-1');
   for(const [label,width]of [['desktop',1100],['narrow',390]]){
    await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:out+state+'-'+label+'.png',fullPage:true});
   }
   await panel.locator('summary').click();
   assert.equal(await panel.locator('[data-act="local-import-cancel"]').isVisible(),true);
   assert.equal(await panel.locator('[data-act="local-import-cancel"]').getAttribute('data-plan'),'private-plan-1');
   assert.match(await panel.innerText(),/لا يحذف الفصل أو الطلاب أو الدرجات المحفوظة/);
   assert.equal(await snapshot(),before);
   await page.screenshot({path:out+state+'-options-narrow.png',fullPage:true});
  }
  result.checks.push({name:'n107_uncertain_recovery_and_safe_stop_reachable',status:'PASS',evidence:'Uncertain and needs_review show one actionable recovery row even beside routine/terminal plans. Retry retains exact plan binding; native options disclosure reveals safe-stop and honest receipt warning; plan/data/outbox snapshots unchanged.'});
  assert.equal(service.evidence.commits,0);assert.deepEqual(result.failures,[]);
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));result.viewSha256=createHash('sha256').update(await readFile('src/views/class-import-center.js')).digest('hex');await writeFile(out+'result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
