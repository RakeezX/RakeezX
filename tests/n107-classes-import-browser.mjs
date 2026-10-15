// AI: actual app HTTP, source CSS/handlers and disposable synthetic accounts.
// Invoke only while owning the canonical shared browser phase lease.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
const focused=process.argv.includes('--recovery-only');
const service=syntheticService(),root=resolve('.'),base='http://127.0.0.1:49107';
// New account: no pre-existing class/student/score; preserve real store guards.
for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
const evidence={taskId:'continuous-n107-central-classes-local-file-import-20261015',runId:'c61563e2-10f5-4440-887d-4142bce81803',checks:[],errors:[]};
try {const prior=JSON.parse(await readFile('tests/n107-classes-import-browser.json','utf8'));if(focused)evidence.checks=prior.checks??[];evidence.previousFailures=[...(prior.previousFailures??[]),...(prior.failure?[prior.failure]:[])];}catch{}
evidence.testedProductCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
evidence.testedProductFilesSha256=Object.fromEntries(await Promise.all(['src/views/home.js','src/views/teachings.js','src/views/class-import-center.js','src/lib/class-import-file.js','src/store.js','src/router.js','src/styles/components.css','sw.js'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const pass=(name,detail)=>{evidence.checks=evidence.checks.filter(check=>check.name!==name);evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
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
async function visit(page,hash,selector){
  await page.evaluate(h=>location.hash=h,hash);
  await page.waitForFunction(hash=>{
    const page=document.querySelector('#main .page');if(!page)return false;
    if(hash==='#/')return page.classList.contains('page--home');
    if(hash==='#/classes')return !!page.querySelector('.classes-page');
    if(hash==='#/classes/import')return page.querySelector('h2')?.textContent==='استيراد الفصول من ملف';
    if(hash==='#/classes/koshoof')return page.querySelector('h2')?.textContent==='اختر الفصل للكشوف';
    return true;
  },hash);
  await page.locator(selector).first().waitFor();
}
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
  if(focused) {
    const context=await browser.newContext({viewport:{width:390,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
    try {
      await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>evidence.errors.push(error.message));
      await prepare(page);
      const startReview=async label=>{
        await visit(page,'#/classes/import','[data-class-file]');
        if(await page.getByRole('button',{name:'إنهاء هذه المراجعة'}).count())await page.getByRole('button',{name:'إنهاء هذه المراجعة'}).click();
        else if(await page.getByRole('button',{name:'إلغاء المراجعة'}).count())await page.getByRole('button',{name:'إلغاء المراجعة'}).click();
        await upload(page,Buffer.from('الصف,الفصل,المادة,اسم الطالب\n4,'+label+',الرياضيات,طالب الاستعادة'));
        await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
        await page.locator('.class-import-groups article').waitFor();
        await page.locator('[data-act="class-import-select"]').click();await page.locator('.class-import-review').waitFor();
      };
      const approve=async()=>{await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').click();};
      await startReview('ج');
      await page.evaluate(async()=>{
        const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),database=await d.openDB(),original=database.transaction.bind(database);
        database.transaction=function(names,...args){
          if(args[0]==='readwrite'&&s.teachings().length===1&&!Array.from(names).includes('items')) {
            database.transaction=original;throw Error('N107 synthetic student transaction failure');
          }
          return original(names,...args);
        };
      });
      await approve();await page.getByText(/لم تكتمل العملية:/).waitFor();
      const partial=await page.evaluate(async()=>{const s=await import('/src/store.js');const t=s.teachings()[0];return {sectionId:t.sectionId,teachingId:t.id,students:s.students(t.id).length,items:s.items(t.id).length,scores:s.state.scores.length,sections:s.sections().length};});
      assert.equal(partial.students,0);assert.equal(partial.scores,0);assert.ok(partial.items>0);
      const reviewText=await page.locator('.class-import-review').innerText();
      assert.ok(reviewText.includes(partial.sectionId));assert.ok(reviewText.includes(partial.teachingId));assert.ok(reviewText.includes('طالب الاستعادة'));assert.ok(reviewText.includes('الأسماء المعلقة (1)'));
      await noOverflow(page,'partial receipt');await page.screenshot({path:'test-results/n107/390-partial-student-receipt.png',fullPage:true});
      await approve();await page.getByText('اكتمل حفظ الفصل المحدد. بقية الفصول للمراجعة لاحقًا.',{exact:true}).waitFor();
      const complete=await page.evaluate(async id=>{const s=await import('/src/store.js');return {students:s.students(id).length,items:s.items(id).length,scores:s.state.scores.length,sections:s.sections().length};},partial.teachingId);
      assert.equal(complete.students,1);assert.equal(complete.sections,partial.sections);assert.equal(complete.items,partial.items);assert.equal(complete.scores,0);
      await visit(page,'#/classes','.class-card__main');await page.locator('.class-card__main').first().click();await page.locator('.class-hub').waitFor();
      pass('actual_partial_receipt_explicit_retry','Actual final-confirm handler: synthetic student transaction failure retains section/teaching IDs, defaults and pending name in rendered receipt; second explicit review imports once with same section/items and no scores. Main card opens real hub.');
      await startReview('د');let before=await checkpoint(page);
      await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').waitFor();
      await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,{...c.session});});
      await page.locator('[data-confirm]').click();await page.getByText(/لم تكتمل العملية:/).waitFor();assert.equal(await checkpoint(page),before);
      assert.ok((await page.locator('.class-import-review').innerText()).includes('طالب الاستعادة'));
      await approve();await page.getByText('اكتمل حفظ الفصل المحدد. بقية الفصول للمراجعة لاحقًا.',{exact:true}).waitFor();
      pass('actual_confirmation_session_callback','Session changes while final confirmation is visible: actual UI handler rejects with zero writes, retains pending name, then accepts only a fresh explicit same-owner review.');
      await startReview('هـ');before=await checkpoint(page);
      const termId=await page.evaluate(async()=>{const s=await import('/src/store.js');const id=s.state.device.activeTermId;s.state.device.activeTermId=s.state.terms[1].id;return id;});
      await page.locator('[data-act="class-import-confirm"]').click();await page.getByText(/لم تكتمل العملية:/).waitFor();assert.equal(await page.locator('[data-confirm]').count(),0);assert.equal(await checkpoint(page),before);
      await page.evaluate(async id=>{const s=await import('/src/store.js');s.state.device.activeTermId=id;},termId);
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);
      const predecessor=await page.evaluate(async()=>(await import('/src/router.js')).syncNavigationContext().previous);
      await page.locator('[data-act="app-back"]').click();await page.waitForURL('**/#'+predecessor);await page.locator(predecessor.startsWith('/teaching/')?'.class-hub':'.classes-page').waitFor();assert.equal(new URL(page.url()).hash,'#'+predecessor);
      assert.equal(await checkpoint(page),before);
      pass('actual_term_drift_keyboard_back','Changing active term after preview blocks confirmation before any modal/write. Restored term; keyboard Tab reaches controls and app Back returns to the recorded in-app predecessor; draft navigation makes no Product writes.');
    }finally{await context.close();}
  }
  for(const width of focused?[]:[320,390,768,1280]) {
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
      await page.locator('.class-import-groups article').first().waitFor();assert.equal(await page.locator('.class-import-groups article').count(),2);
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
      await visit(page,'#/classes','.classes-toolbar');await page.getByRole('button',{name:'حذف الفصل',exact:true}).click();await page.locator('#class-delete-next-btn').click();
      await page.getByText('أكمل مزامنة التغييرات المعلّقة قبل حذف الفصل، ثم أعد المحاولة.',{exact:true}).waitFor();
      assert.equal(await checkpoint(page),before); // Real-class pending outbox must not bypass N77.
      await page.locator('.classes-demo-footer [data-act="add-demo"]').click();
      await page.waitForFunction(async()=>{const s=await import('/src/store.js');return s.teachings().length===2;});
      const demoId=await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/demo.js');return s.teachings().find(d.isDemo).id;});
      const demoBefore=await checkpoint(page);
      const openDemoDelete=async()=>{
        await page.getByRole('button',{name:'حذف الفصل',exact:true}).click();
        await page.locator('input[name="delete_teaching_id"][value="'+demoId+'"]').check();
        await page.locator('#class-delete-next-btn').click();await page.locator('#class-delete-confirm-btn').waitFor();
      };
      await openDemoDelete();await page.keyboard.press('Escape');assert.equal(await checkpoint(page),demoBefore);
      await openDemoDelete();await page.locator('#class-delete-confirm-btn').click();
      await page.waitForFunction(async id=>!(await import('/src/store.js')).getTeaching(id),demoId);
      assert.deepEqual(await page.evaluate(async id=>(await import('/src/store.js')).students(id).map(row=>row.name),saved.id),['أحمد اصطناعي']);before=await checkpoint(page);
      await visit(page,'#/classes/import','[data-class-file]');await page.getByRole('button',{name:'إنهاء هذه المراجعة'}).click();
      await upload(page,await readFile('tests/n12-students.xlsx'),'classes.xlsx');
      await page.locator('[name="manualGrade"]').selectOption('5');await page.locator('[name="manualLabel"]').fill('ج');await page.locator('[name="manualSubject"]').selectOption({label:'العلوم'});
      await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();await page.locator('.class-import-groups article').first().waitFor();assert.equal(await page.locator('.class-import-groups article').count(),1);await noOverflow(page,'XLSX '+width);
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
  if(!focused) {
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
  }
  assert.deepEqual(evidence.errors,[]);
}catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally {
  clearTimeout(timer);if(browser)await browser.close();await new Promise(done=>server.close(done));
  evidence.cleanup='Owned browser contexts, browser and loopback server closed in finally.';
  await writeFile('tests/n107-classes-import-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
