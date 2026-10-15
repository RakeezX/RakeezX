import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { openReadyServedDemo, makeIsolatedDemoContext } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
const root=resolve('.'), canonical='C:/Users/Abody/Projects/RakeezX';
const taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/continuous-n103-account-demo-class-delete-20261015.json';
const runId=process.env.N103_RUN_ID ?? 'c2eb3f13-aee7-4181-b634-12cdf1ef88f2';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const checks=[]; let browser,server,leased=false;
let service=syntheticService();
const snapshot=page=>page.evaluate(async()=>{const db=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(db.STORES.map(async name=>[name,await db.getAll(name)])));});
async function openDelete(page,id) {
  await page.locator('[data-act="delete-class-flow"]').click();
  await page.locator(`.class-delete-row[data-teaching-id="${id}"]`).click();
  await page.locator('#class-delete-next-btn').click();
  await page.locator('#class-delete-confirm-btn').waitFor();
}
try {
  checks.push({name:'browser_phase_lease',status:'PASS',evidence:lease('acquire')}); leased=true;
  server=createServer(async(req,res)=>{try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')) {let body='';for await(const part of req)body+=part;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));
  }catch(error){res.writeHead(404);res.end(error.message);}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+server.address().port;
  const {chromium}=createRequire(canonical+'/package.json')('playwright');
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,1280]) {
    service=syntheticService();
    const context=await makeIsolatedDemoContext(browser,{width,height:900});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    const page=await context.newPage();
    try {
      await openReadyServedDemo(page,base);
      await page.evaluate(async()=>{await(await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount();(await import('/src/repaint.js')).repaint();});
      await page.locator('[data-act="add-demo"]').click();
      await page.waitForFunction(async()=> (await(await import('/src/lib/demo.js')).demoPackages()).length===1);
      await page.locator('[data-act="add-demo"]').click();
      await page.waitForFunction(async()=> (await(await import('/src/lib/demo.js')).demoPackages()).length===2);
      const ids=await page.evaluate(async()=> (await(await import('/src/lib/demo.js')).demoPackages()).map(p=>p.owned.teachings[0]));
      const before=await snapshot(page);
      // Browsing and both cancel steps cannot delete or queue writes.
      await openDelete(page,ids[0]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      const rect=await page.locator('#class-delete-confirm-btn').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);
      await page.getByRole('button',{name:'رجوع',exact:true}).click();
      await page.getByRole('button',{name:'إلغاء',exact:true}).click();
      assert.deepEqual(await snapshot(page),before);
      checks.push({name:`${width}_actual_dom_cancel_layout`,status:'PASS',evidence:'Real Classes Add demo button created two account-local packages; two-step dialog and back/cancel preserve every IndexedDB store; confirmation fits viewport.'});
      // Stale manifest after confirmation was shown must leave all records untouched.
      await openDelete(page,ids[0]);
      await page.evaluate(async()=>{const db=await import('/src/lib/db.js');const m=await db.get('meta','demo:packages');await db.put('meta',{...m,updatedAt:m.updatedAt+1});});
      const stale=await snapshot(page);await page.locator('#class-delete-confirm-btn').click();
      await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('تعذّر التحقق'));
      assert.deepEqual(await snapshot(page),stale);
      assert.ok(await page.locator('#class-delete-confirm-btn').isVisible());
      await page.getByRole('button',{name:'إغلاق',exact:true}).click();
      // Valid deletion after fresh review, only one package; inspect disk and current view.
      await openDelete(page,ids[0]); await page.locator('#class-delete-confirm-btn').click();
      await page.waitForFunction(id=>!document.querySelector(`.class-card[data-id="${id}"]`)&&document.querySelector('#toast').textContent==='تم حذف الفصل',ids[0]);
      const after=await snapshot(page), packageId=ids[0].split(':')[1];
      for(const [name,rows] of Object.entries(stale))for(const row of rows) {
        const actual=after[name].find(r=>r.id===row.id);
        if(row.id.startsWith('demo:'+packageId+':'))assert.equal(actual.deleted,true,row.id);
        else if(name!=='meta')assert.deepEqual(actual,row,name+':'+row.id);
      }
      assert.equal(await page.locator('[role="dialog"]').count(),0);
      const checkpoint=await page.evaluate(async()=>{const store=await import('/src/store.js');return {workspace:store.getActiveWorkspace(),remaining:store.getTeaching((await(await import('/src/lib/demo.js')).demoPackages())[0].owned.teachings[0])?.id};});
      assert.equal(checkpoint.remaining,ids[1]);
      await page.evaluate(async()=>localStorage.removeItem((await import('/src/lib/cloud.js')).AUTH_STORAGE_KEY));
      await page.reload({waitUntil:'domcontentloaded'});
      await openReadyServedDemo(page,base);
      const reloaded=await page.evaluate(async({workspace,ids})=>{
        const store=await import('/src/store.js'),db=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js');
        store.deactivateWorkspace();const session={access_token:'synthetic-local-only',user:{id:workspace.authUserId}};
        localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session));cloud.setMockAuth(session.user,session);store.activateWorkspace(workspace);
        await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:workspace.authUserId,source:'supabase-auth-user',verifiedAt:Date.now()}));
        await store.init();(await import('/src/repaint.js')).repaint();
        return {owner:store.getActiveWorkspace().authUserId,db:db.getActiveDatabaseName(),deleted:await db.get('teachings',ids[0]),other:await db.get('teachings',ids[1]),visible:store.getTeaching(ids[0]),outbox:await db.getAll('outbox')};
      },{workspace:checkpoint.workspace,ids});
      assert.equal(reloaded.owner,checkpoint.workspace.authUserId);assert.equal(reloaded.db,checkpoint.workspace.databaseName);assert.equal(reloaded.deleted.deleted,true);assert.equal(reloaded.other.deleted,false);assert.equal(reloaded.visible,null);assert.deepEqual(reloaded.outbox,before.outbox);
      checks.push({name:`${width}_stale_confirm_exact_delete_reload`,status:'PASS',evidence:'Stale manifest rejected with warning and zero changes; fresh confirmation tombstones only exact package, ordinary rows/grades/other package/outbox byte-identical. New-document owner/DB/durable rows checkpoint proves no resurrection.'});
      // Archived and closed-term records cannot be removed by the actual dialog.
      for(const mode of ['archived','closed']) {
        await page.evaluate(async({id,mode})=>{const s=await import('/src/store.js'),db=await import('/src/lib/db.js');const t=s.getTeaching(id);if(mode==='archived') {const sec=s.getSection(t.sectionId);await db.put('sections',{...sec,status:'archived'});}else{const sec=s.state.sections.find(r=>r.id===t.sectionId);await db.put('sections',{...sec,status:'active'});const term=s.getTerm(t.termId);await db.put('terms',{...term,status:'closed'});}await s.refreshSyncedState();(await import('/src/repaint.js')).repaint();},{id:ids[1],mode});
        const protectedBefore=await snapshot(page);
        await page.evaluate(async id=>{const view=(await import('/src/views/teachings.js')).default;void view.actions['delete-class-flow'](null,null,{id});},ids[1]);
        const row=page.locator(`.class-delete-row[data-teaching-id="${ids[1]}"]`);
        if(await row.count()) {await row.click();await page.locator('#class-delete-next-btn').click();await page.waitForFunction(()=>!document.querySelector('#class-delete-next-btn'));}
        else await page.getByRole('button',{name:'إلغاء',exact:true}).click();
        assert.equal(await page.locator('#class-delete-confirm-btn').count(),0);assert.deepEqual(await snapshot(page),protectedBefore);
        checks.push({name:`${width}_${mode}_readonly`,status:'PASS',evidence:'Actual delete entry provides no actionable confirmation for protected package and writes no IndexedDB records.'});
      }
    }finally{await context.close();}
  }
} catch(error) {
  checks.push({name:'browser_scenario_failure',status:'FAIL',evidence:error.stack});
  throw error;
} finally {
  if(browser)await browser.close();
  if(server)await new Promise(done=>server.close(done));
  if(leased) {
    try { checks.push({name:'owned_phase_cleanup',status:'PASS',evidence:lease('release')+'; owned browser/contexts/server closed'}); }
    catch(error) { checks.push({name:'owned_phase_cleanup',status:'FAIL',evidence:error.message}); }
  }
  await writeFile('tests/n103-demo-delete-browser.json',JSON.stringify({taskId:'continuous-n103-account-demo-class-delete-20261015',runId,checks},null,2)+'\n');
}
console.log(JSON.stringify(checks,null,2));
