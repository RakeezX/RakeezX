import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,source,target,second,capability} from './n100-account-fixture.mjs';

// Caller owns the shared browser lease: actual SW, owned synthetic accounts only.
const root=resolve('.'),output='test-results/n100-invalid-mode',checks=[],rpc=[];
const oldSha='cd8a5e0',oldSW=execFileSync('git',['show',oldSha+':sw.js'],{encoding:'utf8'});
const oldEngine=execFileSync('git',['show',oldSha+':src/lib/score-distribution-copy.js'],{encoding:'utf8'});
const store=await readFile('src/store.js','utf8');
const unboundStore=store.replace('./lib/score-distribution-copy.js?n100=automatic-safe-v1','./lib/score-distribution-copy.js');
let stage='old',service=syntheticService(),browser,timer;
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1'),pathname=url.pathname;
    if(pathname.startsWith('/__n73/')) {
      let body='';for await(const part of req)body+=part;
      const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
    }
    // A selective module transport outage makes the prior SW serve its old
    // cached engine alongside the current online UI/store. No invented engine.
    if(stage==='mixed'&&pathname==='/src/lib/score-distribution-copy.js'&&!url.search){req.socket.destroy();return;}
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside owned root');
    let data=await readFile(file);
    if(stage==='old'&&!pathname.startsWith('/tests/')){
      try{data=execFileSync('git',['show',oldSha+':'+(pathname==='/'?'index.html':pathname.slice(1))],{stdio:['ignore','pipe','ignore']});}catch{}
    }
    if(pathname==='/sw.js'&&stage!=='repaired')data=oldSW;
    if(stage==='old'&&pathname==='/src/lib/score-distribution-copy.js')data=oldEngine;
    if(stage==='mixed'&&pathname==='/src/store.js')data=unboundStore;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
    res.end(data);
  }catch(error){res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
await mkdir(output,{recursive:true});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
async function copy(page){
  await page.goto(base+'/#/teaching/'+source+'/items');
  await page.waitForFunction(()=>{const button=document.querySelector('[data-act="copy"]');return button&&!button.disabled;});
  await page.locator('[data-act="copy"]').click();
  assert.equal(await page.locator('[data-copy-mode]').count(),0);
  for(const id of [target,second])await page.locator('[data-copy-target][value="'+id+'"]').check();
}
async function inspect(page){return page.evaluate(async()=>{
  const db=await import('/src/lib/db.js');return {items:await db.getAll('items'),subs:await db.getAll('scoreSubitems'),scores:await db.getAll('scores'),completions:await db.getAll('scoreSubitemCompletions'),outbox:await db.getAll('outbox')};
});}
try{
  browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),180000);timer.unref();
  const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
  try{
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    const page=await context.newPage();
    // Install the actual prior worker and actual prior copy module before boot.
    await page.goto(base+'/manifest.webmanifest');
    const prior=await page.evaluate(async()=>{
      await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;
      const cache=await caches.open('rakeezx-v56');return await (await cache.match('/src/lib/score-distribution-copy.js')).text();
    });assert.equal(prior,oldEngine);
    await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    await openReadyServedDemo(page,base);
    assert.equal(await page.evaluate(async()=> (await import('/src/lib/score-distribution-copy.js')).DISTRIBUTION_MODES.includes('automatic-safe')),false);
    stage='mixed';await page.reload({waitUntil:'domcontentloaded'});
    await openReadyServedDemo(page,base);
    await page.evaluate(async()=> (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
    const before=await inspect(page);await copy(page);
    await page.getByText('Invalid distribution mode',{exact:true}).waitFor();
    const failing=await page.evaluate(async({source,target})=>{
      const s=await import('/src/store.js'),m=await import('/src/lib/score-distribution-copy.js');
      try{await s.reviewScoreDistributionCopy(source,[target],{mode:'automatic-safe'});}catch(e){return {input:'automatic-safe',modes:m.DISTRIBUTION_MODES,error:e.message,stack:e.stack};}
    },{source,target});assert.equal(failing.error,'Invalid distribution mode');assert.ok(failing.stack.includes('reviewScoreDistributionCopy'));
    assert.deepEqual(await inspect(page),before);assert.equal(service.evidence.plans.length,0);
    await page.screenshot({path:output+'/original-boundary.png',fullPage:true,animations:'disabled'});
    record('n100_invalid_mode_reproduced_at_actual_boundary',JSON.stringify(failing)+'; actual v56 worker falls back to byte-identical prior engine, current app copy handler throws in store before capability/plan/Sync; no writes. Synthetic reproduction of mixed release, not access to PO browser.');

    // Clear only synthetic in-memory auth for a Demo boot; retain account IDB.
    await page.evaluate(async()=>{
      const cloud=await import('/src/lib/cloud.js');localStorage.removeItem(cloud.AUTH_STORAGE_KEY);
      sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
    });
    stage='repaired';
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    await page.waitForFunction(async()=>{
      const c=await caches.open('rakeezx-v60');return !!await c.match('/src/lib/score-distribution-copy.js?n100=automatic-safe-v1')&&!((await caches.keys()).includes('rakeezx-v56'));
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await openReadyServedDemo(page,base);
    assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(row=>row.name.endsWith('/src/lib/score-distribution-copy.js?n100=automatic-safe-v1'))),true);
    const ready=await page.evaluate(async()=> (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
    assert.equal(ready.ready,true);assert.deepEqual(await inspect(page),before);
    // Exercise actual cloud JSON serialization (not mockBackend passthrough).
    await context.route('https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/rpc/**',async route=>{
      const name=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();rpc.push({name,body});
      let data;
      if(name==='score_distribution_capability'||name==='score_foundation_capability')data=capability;
      else if(name==='plan_score_distribution')data=await service.request('plan',{planId:body.p_plan_id,sourceTeachingId:body.p_source,targetTeachingIds:body.p_targets,removeItemIds:body.p_remove,mode:body.p_mode??'definitions'});
      else if(name==='apply_score_distribution_plan')data=await service.request('apply',{mutationId:body.p_mutation_id,deviceId:body.p_device_id,planId:body.p_plan_id,token:body.p_token,confirmed:body.p_confirmed});
      else return route.abort('blockedbyclient');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.evaluate(async()=> (await import('/src/lib/cloud.js')).setMockBackend(null));
    for(const mode of ['definitions','preserve-target']){
      await page.evaluate(async({mode,source,target})=> (await import('/src/store.js')).reviewScoreDistributionCopy(source,[target],{mode}),{mode,source,target});
      assert.equal(rpc.filter(r=>r.name==='plan_score_distribution').at(-1).body.p_mode,mode==='definitions'?undefined:mode);
    }
    const calls=rpc.length;
    const invalid=await page.evaluate(async({source,target})=>{
      const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),errors=[];
      for(const mode of ['unknown',null])for(const call of [()=>s.reviewScoreDistributionCopy(source,[target],{mode}),()=>c.planScoreDistribution({mode})]){try{await call();errors.push(null);}catch(e){errors.push(e.message);}}
      return errors;
    },{source,target});assert.deepEqual(invalid,Array(4).fill('Invalid distribution mode'));assert.equal(rpc.length,calls);
    await copy(page);await page.waitForFunction(()=>!document.querySelector('[data-copy-apply]')?.disabled);
    assert.equal(rpc.filter(r=>r.name==='plan_score_distribution').at(-1).body.p_mode,'automatic-safe');
    await page.screenshot({path:output+'/upgraded-review.png',fullPage:true,animations:'disabled'});
    await page.locator('[data-copy-apply]').click();await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).click();
    await page.getByText(/طُبّقت التحديثات والإضافات/).waitFor();
    const after=await inspect(page);
    const product=rows=>rows.map(({serverCanonical,canonicalId,deleted,...row})=>({...row,deleted:deleted===true}));
    assert.deepEqual(product(after.scores),product(before.scores));assert.deepEqual(product(after.completions),product(before.completions));
    assert.deepEqual(after.outbox,[]);assert.equal(service.evidence.commits,1);
    assert.ok(after.items.some(row=>row.teachingId===second));
    for(const sub of before.subs.filter(row=>row.itemId==='n100-target')){
      const next=after.subs.find(row=>row.id===sub.id);assert.equal(next.createdAt,sub.createdAt);assert.equal(next.name,'اسم جديد '+sub.order);
    }
    assert.ok(rpc.some(row=>row.name==='apply_score_distribution_plan'));
    record('n100_upgraded_account_real_transport','Actual prior v56 cache → v60 activation → app reload → real account UI/store/owner guard/durable Sync/cloud JSON through locally fulfilled RPC. Automatic-safe preserved; legacy definitions omits p_mode, preservation sends p_mode; unknown rejects before transport. Recorded and empty targets apply once; target IDs/marks/late/NULL/manual/createdAt retained and source marks never copied.');
    const workspace=await page.evaluate(async()=> (await import('/src/store.js')).getActiveWorkspace());
    // Save a pending owner-bound record; a shell upgrade/offline boot must not
    // reset user data or outbox. No dispatch is attempted for this sentinel.
    await page.evaluate(async()=> (await import('/src/lib/db.js')).put('outbox',{id:'n100-pending-sentinel',ownerId:'a7300000-0000-4000-8000-000000000001',protocol:'v2',state:'pending',mutationId:'n100-pending-sentinel'}));
    const persisted=await inspect(page);
    await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');localStorage.removeItem(cloud.AUTH_STORAGE_KEY);sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await openReadyServedDemo(page,base);
    const offline=await page.evaluate(async(workspace)=>{
      const s=await import('/src/store.js'),db=await import('/src/lib/db.js');s.deactivateWorkspace();s.activateWorkspace(workspace);await db.openDB();
      return {workspace:s.getActiveWorkspace(),items:await db.getAll('items'),subs:await db.getAll('scoreSubitems'),scores:await db.getAll('scores'),completions:await db.getAll('scoreSubitemCompletions'),outbox:await db.getAll('outbox')};
    },workspace);
    assert.equal(offline.workspace.databaseName,workspace.databaseName);delete offline.workspace;assert.deepEqual(offline,persisted);
    record('n100_offline_shell_and_pending_data','Actual upgraded source app boots offline with qualified engine precached; fresh document explicitly reopens expected synthetic owner database and reads same checkpoint: definitions, marks, completions and pending outbox byte-identical. No IndexedDB deletion or outbox reset.');
  }finally{await context.close();}
}finally{
  clearTimeout(timer);await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));
  const hashes={};for(const file of ['src/store.js','src/lib/cloud.js','sw.js','tests/n100-invalid-mode-browser.mjs'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  await writeFile(output+'/result.json',JSON.stringify({checks,rpc,hashes,ownedBrowserClosed:true,ownedServerClosed:true},null,2));
}
