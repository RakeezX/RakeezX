import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService, source, target, capability} from './n100-account-fixture.mjs';

// Caller owns the shared browser phase lease. No real account or outbound request.
const root=resolve('.'), output='test-results/n100-delivery', checks=[];
const originalSW=execFileSync('git',['show','0076df007820ddac1dd54b23b2b3c97e821923bc:sw.js'],{encoding:'utf8'});
let original=false, service=syntheticService(), browser, timer;
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')) {
      let body=''; for await(const chunk of req) body+=chunk;
      const result=await service.request(pathname.slice(7),JSON.parse(body||'{}'));
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(result)); return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep)) throw Error('Outside application root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'}[extname(file)]??'application/octet-stream');
    res.end(pathname==='/sw.js'&&original?originalSW:await readFile(file));
  } catch(error) {res.writeHead(error.status??404,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message,code:error.code,status:error.status}));}
});
const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
try {
  browser=await chromium.launch({headless:true});
  timer=setTimeout(()=>browser.close(),180000);timer.unref();
  for(const baseline of [true,false]) {
    original=baseline;
    const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
    try {
      await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();
      // Install the actual shell before any application import can incidentally
      // populate the omitted module through runtime network-first caching.
      await page.goto(base+'/manifest.webmanifest');
      const cache=await page.evaluate(async()=>{
        await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
        const keys=await caches.keys(), key=keys.find(k=>k.startsWith('rakeezx-v'));
        const cached=await caches.open(key);
        return {key,dependency:!!await cached.match('/src/lib/score-distribution-copy.js')};
      });
      assert.equal(cache.dependency,!baseline);
      await context.setOffline(true);
      await page.goto(base+'/#/classes',{waitUntil:'domcontentloaded'});
      if(baseline) {
        const failed=await page.evaluate(async()=>{
          try {await import('/src/app.js');return false;}catch{return true;}
        });
        assert.equal(failed,true);
        assert.equal(await page.locator('.layout').count(),0);
        record('original_missing_dependency_detected','Fresh v55 shell installation has no new module; real offline app.js import fails and application layout never boots.');
      } else {
        await openReadyServedDemo(page,base);
        const boot=await page.evaluate(async()=>{
          const store=await import('/src/store.js');
          await import('/src/lib/score-distribution-copy.js');
          return {ready:store.state.ready,workspace:store.getActiveWorkspace()?.type,teaching:store.teachings()[0].id,students:store.state.students.length};
        });
        assert.equal(boot.ready,true);assert.equal(boot.workspace,'demo');assert.ok(boot.students>0);
        await page.goto(base+'/#/teaching/'+boot.teaching+'/items');
        await page.getByRole('heading',{name:'توزيع الدرجات',exact:true}).first().waitFor();
        assert.ok(await page.locator('.distribution-item').count()>0);
        const css=await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/src/styles/app.css')&&s.cssRules.length>0));
        assert.equal(css,true);
        await page.screenshot({path:output+'/offline-items.png',fullPage:true});
        record('n100_actual_offline_boot_dependency','Fresh v56 shell installs new module before any app import. Entire real source import graph boots offline into ready synthetic Demo; items DOM and actual app CSS render offline without external module fetch.');
      }
    } finally {await context.close();}
  }
  original=false;
  for(const scenario of ['supported','old','mismatch','missing','changed-after-selection']) {
    service=syntheticService();
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    let rpcCapability={...capability}, calls=[];
    if(scenario==='old')delete rpcCapability.targetPreservationVersion;
    if(scenario==='mismatch')rpcCapability.protocol='UNKNOWN';
    try {
      await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();await openReadyServedDemo(page,base);
      await page.evaluate(async()=> (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
      // Exercise real cloud request serialization over a synthetic transport.
      // Specific route fulfills locally; the catch-all aborts all other remote URLs.
      await context.route('https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/rpc/**',async r=>{
        const name=new URL(r.request().url()).pathname.split('/').pop(),body=r.request().postDataJSON();calls.push({name,body});
        if(name==='score_distribution_capability'&&scenario==='missing')return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST202',message:'Synthetic missing RPC'})});
        let data;
        if(name==='score_foundation_capability')data=capability;
        else if(name==='score_distribution_capability')data=rpcCapability;
        else if(name==='plan_score_distribution')data=await service.request('plan',{planId:body.p_plan_id,sourceTeachingId:body.p_source,targetTeachingIds:body.p_targets,removeItemIds:body.p_remove,mode:body.p_mode??'definitions'});
        else return r.abort('blockedbyclient');
        await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.evaluate(async()=> (await import('/src/lib/cloud.js')).setMockBackend(null));
      await page.goto(base+'/#/teaching/'+source+'/items');
      await page.waitForFunction(()=>!document.querySelector('.score-01c-capability')?.textContent.includes('جارٍ'));
      await page.locator('[data-act="copy"]').click();
      const preserve=page.locator('[data-copy-mode][value="preserve-target"]');
      if(['mismatch','missing'].includes(scenario)) {
        assert.equal(await preserve.count(),0);
        assert.ok(await page.locator('[data-copy-target]').count()>0);
      } else {
        assert.equal(await preserve.isDisabled(),scenario==='old');
        assert.equal(await page.locator('[data-copy-mode][value="definitions"]').isChecked(),true);
        if(scenario!=='old')await preserve.check();
        await page.locator('[data-copy-target][value="'+target+'"]').check();
        await page.waitForFunction(()=>!document.querySelector('[data-copy-apply]')?.disabled);
        const plans=calls.filter(c=>c.name==='plan_score_distribution');assert.ok(plans.length>0);
        assert.equal(plans.at(-1).body.p_mode,scenario==='old'?undefined:'preserve-target');
        if(scenario==='changed-after-selection') {
          rpcCapability={...capability,targetPreservationVersion:0};
          const before=calls.filter(c=>c.name==='plan_score_distribution').length;
          await page.locator('[data-copy-apply]').click();
          await page.getByText('حفظ سجلات الفصل الهدف يحتاج إلى تحديث الخادم.',{exact:true}).waitFor();
          assert.equal(calls.filter(c=>c.name==='plan_score_distribution').length,before);
          assert.equal(calls.filter(c=>c.name==='apply_score_distribution_plan').length,0);
        }
      }
      // Retain actual ownership guard at the affected store entry.
      const denied=await page.evaluate(async({source,target})=>{
        const cloud=await import('/src/lib/cloud.js'),store=await import('/src/store.js');
        cloud.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'});
        try {await store.reviewScoreDistributionCopy(source,[target],{mode:'preserve-target'});return false;}catch{return true;}
      },{source,target});assert.equal(denied,true);
      await page.screenshot({path:output+'/capability-'+scenario+'.png',fullPage:true});
      record('provider_capability_'+scenario,'Actual account UI/store/cloud with real guard: supported preservation sends p_mode; old capability disables preservation while legacy definitions omits mode; missing/mismatch uses existing legacy copy; selected preservation never downgrades after capability loss. Foreign ownership entry rejects. Scenario '+scenario+'.');
    } finally {await context.close();}
  }
} finally {
  clearTimeout(timer);if(browser)await browser.close();
  await new Promise(done=>server.close(done));
  await writeFile(output+'/result.json',JSON.stringify({checks,ownedBrowserClosed:true,ownedServerClosed:true},null,2));
}
