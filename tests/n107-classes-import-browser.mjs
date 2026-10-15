// AI: actual app HTTP, source CSS/handlers and disposable synthetic accounts.
// Invoke only while owning the canonical shared browser phase lease.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
const service=syntheticService(),root=resolve('.'),base='http://127.0.0.1:49107';
// New account: no pre-existing class/student/score; preserve real store guards.
for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
const evidence={taskId:'continuous-n107-central-classes-local-file-import-20261015',runId:'d3c03b8f-0bdd-4dba-b907-f1643fb52721',checks:[],errors:[]};
const pass=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,base).pathname;
    if(pathname.startsWith('/__n73/')) {
      let body='';for await(const chunk of req)body+=chunk;
      const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch(error){res.writeHead(404);res.end(error.message);}
});
let browser,timer;
async function prepare(page) {
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
    const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-browser'};
    s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
    const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
    try {await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
    const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
    if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
    await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
    s.assertClassImportAccess();(await import('/src/repaint.js')).repaint();
  });
}
const checkpoint=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
async function visit(page,hash,selector){await page.evaluate(h=>location.hash=h,hash);await page.locator(selector).first().waitFor();}
async function noOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);}
async function upload(page,buffer,name='classes.csv') {
  await page.locator('[data-class-file]').setInputFiles({name,mimeType:name.endsWith('.csv')?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
  await page.locator('[data-class-mapping]').waitFor();
}
const csv=Buffer.from('الصف,الفصل,المادة,اسم الطالب\n4,أ,الرياضيات,أحمد اصطناعي\n4,ب,العلوم,أحمد اصطناعي');
try {
  const lease=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8'));
  assert.equal(lease.taskId,evidence.taskId);assert.equal(lease.owner.token,evidence.runId);
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(49107,'127.0.0.1',done);});
  browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),240000);timer.unref();
  await mkdir('test-results/n107',{recursive:true});
  for(const width of [320,390,768,1280]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
    try {
      await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>evidence.errors.push(error.message));
      await prepare(page);let before=await checkpoint(page);
      for(const theme of ['light','dark']) {
        await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
        await visit(page,'#/','a[href="#/classes/import"]');
        assert.equal(await page.getByRole('link',{name:'إنشاء أول فصل',exact:true}).count(),1);
        assert.equal(await page.locator('.home-onboarding a[href="#/classes/import"]').count(),1);await noOverflow(page,'Home '+width);
        await page.screenshot({path:`test-results/n107/${width}-${theme}-home-empty.png`,fullPage:true});
        await visit(page,'#/classes','.classes-toolbar');
        assert.equal(await page.locator('.classes-toolbar a[href="#/classes/import"]').count(),1);
        assert.equal(await page.locator('.classes-toolbar [data-act="add"]').count(),1);
        assert.equal(await page.locator('.classes-demo-footer [data-act="add-demo"]').count(),1);
        assert.equal(await page.locator('[aria-label="حذف الفصل"]').isDisabled(),true);await noOverflow(page,'Classes empty '+width);
        await page.screenshot({path:`test-results/n107/${width}-${theme}-classes-empty.png`,fullPage:true});
      }
      await page.locator('.classes-toolbar a[href="#/classes/import"]').click();await page.locator('[data-class-file]').waitFor();
      assert.equal(await page.locator('h2:focus').count(),1);
      await upload(page,csv);await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
      assert.equal(await page.locator('.class-import-groups article').count(),2);
      await noOverflow(page,'File preview '+width);
      await page.locator('[data-act="class-import-select"]').first().click();await page.locator('.class-import-review').waitFor();
      assert.equal(await checkpoint(page),before);
      await page.getByRole('button',{name:'تأكيد حفظ هذا الفصل',exact:true}).click();await page.locator('[data-confirm]').waitFor();
      await page.keyboard.press('Escape');await page.locator('[data-confirm]').waitFor({state:'detached'});assert.equal(await checkpoint(page),before);
      await page.getByRole('button',{name:'تأكيد حفظ هذا الفصل',exact:true}).click();await page.locator('[data-confirm]').click();
      await page.getByText('اكتمل حفظ الفصل المحدد. بقية الفصول للمراجعة لاحقًا.',{exact:true}).waitFor();
      const saved=await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const t=s.teachings()[0];return {classes:s.teachings().length,students:s.students(t.id).map(row=>row.name),items:s.state.items.filter(row=>row.teachingId===t.id).length,scores:(await d.getAll('scores')).length,id:t.id};});
      assert.equal(saved.classes,1);assert.deepEqual(saved.students,['أحمد اصطناعي']);assert.ok(saved.items>0);assert.equal(saved.scores,0);before=await checkpoint(page);
      await page.screenshot({path:`test-results/n107/${width}-saved-review.png`,fullPage:true});
      for(const theme of ['light','dark']) {
        await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
        await visit(page,'#/classes','.class-card__main');assert.equal(await page.locator('.class-card__koshoof').count(),0);
        await noOverflow(page,'Classes populated '+width);await page.screenshot({path:`test-results/n107/${width}-${theme}-classes-populated.png`,fullPage:true});
        await visit(page,'#/','h2');assert.equal(await page.locator('.home-onboarding a[href="#/classes/import"]').count(),0);await noOverflow(page,'Home populated '+width);
      }
      await visit(page,'#/classes/koshoof','.class-import-groups article');
      assert.equal(await page.getByRole('link',{name:'استيراد لهذا الفصل',exact:true}).count(),1);
      await page.getByRole('link',{name:'استيراد لهذا الفصل',exact:true}).click();await page.locator('[data-grade-import-panel]').waitFor();
      await visit(page,'#/classes/koshoof','.class-import-groups article');await page.getByRole('link',{name:'تصدير لهذا الفصل',exact:true}).click();await page.locator('[data-grade-export-panel]').waitFor();
      await visit(page,'#/classes','.classes-toolbar');await page.getByRole('button',{name:'حذف الفصل',exact:true}).click();await page.locator('#class-delete-next-btn').click();await page.locator('#class-delete-confirm-btn').waitFor();
      await page.keyboard.press('Escape');assert.equal(await checkpoint(page),before);
      await visit(page,'#/classes/import','[data-class-file]');await page.getByRole('button',{name:'إنهاء هذه المراجعة'}).click();
      await upload(page,await readFile('tests/n12-students.xlsx'),'classes.xlsx');
      await page.locator('[name="manualGrade"]').selectOption('5');await page.locator('[name="manualLabel"]').fill('ج');await page.locator('[name="manualSubject"]').selectOption({label:'العلوم'});
      await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();assert.equal(await page.locator('.class-import-groups article').count(),1);await noOverflow(page,'XLSX '+width);
      assert.equal(await checkpoint(page),before);
      if(width===390) {
        const guards=await page.evaluate(async()=>{
          const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),f=await import('/tests/n73-account-flow-fixture.mjs');
          const workspace=s.getActiveWorkspace(),session=c.session,user=c.user,teaching=s.teachings()[0],section=s.getSection(teaching.sectionId),results=[];
          const check=async name=>{location.hash='#/classes/koshoof';(await import('/src/repaint.js')).repaint();await new Promise(done=>setTimeout(done,50));results.push({name,links:document.querySelectorAll('a[href$="/koshoof?import=1"]').length});};
          section.status='archived';await check('archived');delete section.status;
          teaching.ownerId=f.foreignOwner;await check('foreign-teaching');delete teaching.ownerId;
          c.setMockAuth({id:f.foreignOwner},session);await check('wrong-user');c.setMockAuth(user,session);
          s.state.device.activeTermId=s.state.terms[1].id;await check('other-term');s.state.device.activeTermId=teaching.termId;
          c.setMockAuth(user,{...session,user:{id:f.foreignOwner}});await check('wrong-session');c.setMockAuth(user,session);
          return results;
        });
        guards.forEach(row=>assert.equal(row.links,0,JSON.stringify(row)));assert.equal(await checkpoint(page),before);
        await visit(page,'#/classes/import','[data-class-file]');await context.setOffline(true);
        await page.clock.setFixedTime(new Date(Date.now()+15*86400000));
        await page.evaluate(async()=>(await import('/src/repaint.js')).repaint());await page.getByText('الاستيراد غير متاح الآن',{exact:true}).waitFor();assert.equal(await checkpoint(page),before);
        pass('actual_account_owner_term_archive_expired_offline',JSON.stringify(guards)+'; expired offline lease hides import, no writes.');
      }
      pass('actual_UI_'+width,'RTL light/dark empty/populated Home and Classes; toolbar, card navigation, central import/export, deletion step 2 cancel, real CSV one-group confirmation/cancel and actual XLSX manual mapping. No overflow; no scores; one class only. Screenshots test-results/n107/.');
    }finally{await context.close();}
  }
  // Independent disposable Demo installation: actual offline shell and route.
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'allow'});
  try {
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();await openReadyServedDemo(page,base);
    await page.waitForFunction(async()=>{await navigator.serviceWorker.ready;return !!await caches.match('/src/views/class-import-center.js')&&!!await caches.match('/src/lib/class-import-file.js');},null,{timeout:30000});
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','active'));
    await context.setOffline(true);
    await visit(page,'#/classes/import','[data-class-file]');await page.reload();await page.locator('[data-class-file]').waitFor({timeout:30000});
    await visit(page,'#/classes/koshoof','.class-import-groups article');
    pass('actual_installed_offline_routes','sw.js v65 cached both new modules; controlled fresh synthetic Demo reload opens import and central selector while offline.');
  }finally{await context.close();}
  assert.deepEqual(evidence.errors,[]);
}catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally {
  clearTimeout(timer);if(browser)await browser.close();await new Promise(done=>server.close(done));
  evidence.cleanup='Owned browser contexts, browser and loopback server closed in finally.';
  await writeFile('tests/n107-classes-import-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
