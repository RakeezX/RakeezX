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

const variants=process.argv.includes('--file-variants');
const service=syntheticService(),root=resolve('.'),base='http://127.0.0.1:49227';
// New account: no pre-existing class/student/score; preserve real store guards.
for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
const evidence={taskId:'continuous-n107-final-single-hub-direct-excel-20261016',runId:'bcdfed8f-0c1b-426e-8e0f-4fddf30ba80c',checks:[],errors:[]};
try { const prior=JSON.parse(await readFile('tests/n107-final-single-hub-browser.json','utf8')); if(variants)evidence.checks=prior.checks??[]; evidence.previousFailures=[...(prior.previousFailures??[]),...(prior.failure?[prior.failure]:[])]; } catch {}
evidence.testedProductCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
evidence.testedProductFilesSha256=Object.fromEntries(await Promise.all(['src/views/home.js','src/views/teachings.js','src/views/class-import-center.js','src/lib/class-import-file.js','src/lib/class-koshoof-bundle.js','src/lib/grade-transfer-xlsx.js','src/lib/zip.js','src/views/grades.js','src/store.js','src/router.js','src/styles/components.css','sw.js'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
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
async function visit(page,hash,selector) {
 await page.evaluate(hash=>location.hash=hash,hash);
 await page.waitForFunction(hash=>location.hash===hash,hash);
 await page.locator(selector).first().waitFor();
}
const overflow=async(page,label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);
const upload=async(page,text)=>{await page.locator('[data-class-file]').setInputFiles({name:'names.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await page.locator('[data-class-mapping]').waitFor();};
async function fields(page,label) {
 await page.locator('[name="manualGrade"]').selectOption('4');await page.locator('[name="manualLabel"]').fill(label);await page.locator('[name="manualSubject"]').selectOption({label:'الرياضيات'});
}
async function review(page,label,name='طالب اصطناعي') {
 await visit(page,'#/classes/koshoof?new=1','[data-class-file]');
 await upload(page,'اسم الطالب\n'+name);await fields(page,label);
 await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();await page.locator('[data-act="class-import-select"]').click();await page.locator('.class-import-review').waitFor();
}
async function approve(page){await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').click();}
async function reset(page){await page.locator('[data-act="class-import-reset"]').click();await page.locator('[data-class-file]').waitFor();}
async function downloaded(page){const promise=page.waitForEvent('download');await page.locator('[data-act="koshoof-export"]').click();const download=await promise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return {name:download.suggestedFilename(),bytes:Buffer.concat(chunks)};}
try {
 const lease=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8'));assert.equal(lease.taskId,evidence.taskId);assert.equal(lease.owner.token,evidence.runId);
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49227,'127.0.0.1',done);});
 browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),240000);timer.unref();
 await mkdir('test-results/n107-final',{recursive:true});
 for(const width of variants?[]:[390,320,768,1280]) {
  for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
  const context=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  try {
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>evidence.errors.push(error.message));
   await prepare(page);let before=await checkpoint(page);
   for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await visit(page,'#/','a[href="#/classes/koshoof?new=1"]');
    assert.equal(await page.locator('.home-onboarding a[href="#/classes/koshoof?new=1"]').count(),1);await overflow(page,'home '+width);
    await visit(page,'#/classes','.classes-toolbar');
    assert.equal(await page.locator('.classes-toolbar a').count(),1);assert.equal(await page.getByRole('link',{name:'استيراد وتصدير الكشوف',exact:true}).count(),1);
    assert.equal(await page.locator('.classes-toolbar [data-act="add"]').count(),1);assert.equal(await page.locator('.classes-tools-left [data-act="add-demo"]').count(),1);
    assert.equal(await page.getByRole('button',{name:'حذف الفصل',exact:true}).isDisabled(),true);await overflow(page,'classes '+width);
    await page.screenshot({path:`test-results/n107-final/${width}-${theme}-classes.png`,fullPage:true});
   }
   await visit(page,'#/classes/import','[data-class-file]');
   assert.equal(await page.locator('h2').filter({hasText:'استيراد فصل جديد من ملف'}).count(),1);
   assert.equal(await page.getByLabel('مصدر الملف').count(),0);
   await upload(page,'اسم الطالب\nأحمد علي\nأحمد  علي\n=CMD()');await fields(page,'أ');
   assert.equal(await page.locator('select[name="grade"],select[name="label"],select[name="subject"],select[name="name"]').count(),0);
   await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
   await page.locator('.class-import-groups').waitFor();assert.match(await page.locator('.class-import-groups').innerText(),/2 اسمًا مكررًا · 1 غير صالح/);
   assert.equal(await page.locator('[data-act="class-import-select"]').isDisabled(),true);assert.equal(await checkpoint(page),before);
   await upload(page,'الصف,الفصل,المادة,اسم الطالب\n6,ب,العلوم,أحمد الأول');await fields(page,'أ');
   await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
   // Editing after preview invalidates the previous review capability.
   await page.locator('[name="manualLabel"]').fill('ج');assert.equal(await page.locator('[data-act="class-import-select"]').count(),0);
   await page.locator('[name="manualLabel"]').fill('أ');await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
   await page.locator('[data-act="class-import-select"]').click();assert.equal(await checkpoint(page),before);
   await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').waitFor();await page.keyboard.press('Escape');assert.equal(await checkpoint(page),before);
   await approve(page);await page.getByRole('heading',{name:/اكتمل استيراد الفصل بنجاح/}).waitFor();
   const receipt=await page.locator('.class-import-review').innerText();assert.doesNotMatch(receipt,/sec:|tch:|قد تنجح|لم تكتمل/);assert.match(receipt,/الأسماء المحفوظة: 1 · الأسماء المعلقة: 0/);
   const saved=await page.evaluate(async()=>{const s=await import('/src/store.js'),t=s.teachings()[0];return {id:t.id,grade:s.getSection(t.sectionId).grade,label:s.getSection(t.sectionId).label,names:s.students(t.id).map(s=>s.name),scores:s.state.scores.length};});
   assert.equal(saved.grade,4);assert.equal(saved.label,'أ');assert.deepEqual(saved.names,['أحمد الأول']);assert.equal(saved.scores,0);
   await overflow(page,'receipt '+width);await page.screenshot({path:`test-results/n107-final/${width}-success.png`,fullPage:true});
   await reset(page);await review(page,'ب','محمد الثاني');
   if(width===390) {
    // Actual student persistence failure, with valid parent/dependent records.
    await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),database=await d.openDB(),original=database.transaction.bind(database);database.transaction=function(names,...args){if(args[0]==='readwrite'&&s.teachings().length===2&&!Array.from(names).includes('items')){database.transaction=original;throw Error('N107 synthetic student transaction failure');}return original(names,...args);};});
    await approve(page);await page.getByText(/لم تكتمل العملية:/).waitFor();
    const partial=await page.locator('.class-import-review').innerText();assert.match(partial,/حُفظ الفصل/);assert.match(partial,/حُفظ إسناد المادة/);assert.match(partial,/محمد الثاني/);assert.doesNotMatch(partial,/sec:|tch:/);
    const partialIds=await page.evaluate(async()=>{const s=await import('/src/store.js');return s.teachings().map(t=>t.id);});
    await approve(page);await page.getByRole('heading',{name:/اكتمل استيراد الفصل بنجاح/}).waitFor();
    assert.deepEqual(await page.evaluate(async()=>{const s=await import('/src/store.js');return s.teachings().map(t=>t.id);}),partialIds);
    pass('actual_partial_failure_and_explicit_retry','Actual student transaction failure preserves section/teaching/defaults and human pending names; explicit retry reuses parents, no raw IDs or warning after success.');
   } else {await approve(page);await page.getByRole('heading',{name:/اكتمل استيراد الفصل بنجاح/}).waitFor();}
   before=await checkpoint(page);
   for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await visit(page,'#/classes/koshoof','[data-existing-class]');
    assert.equal(await page.locator('[data-existing-class] option').count(),3);assert.equal(await page.locator('.class-import-groups article').count(),0);
    await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
    await page.locator('[data-koshoof-class]').first().waitFor();
    assert.equal(await page.locator('[data-koshoof-class]').count(),2);await page.locator('[data-koshoof-all]').check();
    await page.getByText('الفصول المحددة: 2',{exact:true}).waitFor();await overflow(page,'hub '+width);
    await page.screenshot({path:`test-results/n107-final/${width}-${theme}-hub.png`,fullPage:true});
    await page.locator('[data-koshoof-all]').uncheck();
    await page.locator('[data-act="koshoof-tab"][data-tab="import"]').click();
   }
   if(width===390) {
    await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
    const {unzipSync,strFromU8}=await import('../src/lib/student-import-parsers.js');
    await page.locator('[data-koshoof-class]').first().check();let file=await downloaded(page);assert.match(file.name,/\.xlsx$/);
    const sheet=bytes=>strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);assert.match(sheet(file.bytes),/أحمد الأول/);assert.doesNotMatch(sheet(file.bytes),/محمد الثاني/);
    await page.locator('[data-koshoof-all]').check();
    const downloads=[]; const capture=d=>downloads.push(d);page.on('download',capture);
    await page.locator('[data-act="koshoof-export"]').click();await page.locator('.koshoof-downloads').waitFor();
    await page.waitForFunction(()=>document.querySelector('.koshoof-downloads')?.textContent.includes('إذا لم يظهر'));
    // Await observable download events without using timers to drive Product downloads.
    await page.waitForTimeout(200);page.off('download',capture);assert.equal(downloads.length,2);
    const sheets=[];
    for(const d of downloads){assert.match(d.suggestedFilename(),/\.xlsx$/);const chunks=[];for await(const chunk of await d.createReadStream())chunks.push(chunk);sheets.push(sheet(Buffer.concat(chunks)));}
    assert.equal(sheets.filter(s=>s.includes('أحمد الأول')).length,1);assert.equal(sheets.filter(s=>s.includes('محمد الثاني')).length,1);
    assert.ok(sheets.every(s=>!(s.includes('أحمد الأول')&&s.includes('محمد الثاني'))));
    // Simulate browser suppression: click dispatch returns normally but no file is delivered.
    await page.evaluate(()=>{window.__click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};});
    await page.locator('[data-act="koshoof-export"]').click();
    assert.match(await page.locator('[aria-label="تصدير الكشوف"]').innerText(),/تحقق من قائمة تنزيلات المتصفح/);
    assert.equal(await page.locator('[data-act="koshoof-file"]').count(),2);
    await page.evaluate(()=>{HTMLAnchorElement.prototype.click=window.__click;delete window.__click;});
    const fallback=page.waitForEvent('download');await page.locator('[data-act="koshoof-file"]').nth(1).click();assert.match((await fallback).suggestedFilename(),/\.xlsx$/);
    await page.locator('[data-koshoof-content]').selectOption('grades');file=await downloaded(page);assert.match(sheet(file.bytes),/B1/);
    assert.equal(await checkpoint(page),before);
    await page.locator('[data-act="koshoof-tab"][data-tab="import"]').click();
    await page.locator('[data-existing-class]').selectOption(saved.id);await page.locator('[data-grade-import-panel]:visible').waitFor();
    await page.evaluate(id=>location.hash=`#/teaching/${id}/koshoof?export=1`,saved.id);
    await page.waitForFunction(id=>location.hash===`#/classes/koshoof?teaching=${encodeURIComponent(id)}&tab=export`,saved.id);
    await page.locator('[data-koshoof-class]:checked').waitFor();assert.equal(await page.locator('[data-koshoof-class]:checked').count(),1);
    assert.equal(await page.locator('[data-act="grade-noor-export"]').count(),1);
    await page.evaluate(id=>location.hash=`#/teaching/${id}/koshoof?import=1`,saved.id);
    await page.locator('[data-grade-import-panel]:visible').waitFor();
    assert.equal(await page.locator('[data-existing-class]').inputValue(),saved.id);
    const priorNames=await checkpoint(page);
    await page.locator('[data-change="grade-file"]').setInputFiles({name:'existing.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب\nطالب إضافي')});
    await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
    assert.equal(await checkpoint(page),priorNames);
    await page.locator('[data-act="grade-confirm"]').click();assert.equal(await checkpoint(page),priorNames);
    await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();
    await page.locator('.grade-transfer__message').filter({hasText:'الأسماء المحفوظة: 1 · الأسماء المعلقة: 0'}).waitFor();
    assert.doesNotMatch(await page.locator('.grade-transfer__message').innerText(),/sec:|tch:|لم تكتمل/);
    assert.ok((await page.evaluate(async id=>(await import('/src/store.js')).students(id).map(s=>s.name),saved.id)).includes('طالب إضافي'));
    await page.locator('[data-act="grade-import-mode"][data-mode="grades"]').click();
    const gradeCsv=await page.evaluate(async id=>{const s=await import('/src/store.js'),t=await import('/src/lib/grade-transfer.js');const item=s.teachingContext(id).items.find(t.isTransferItem);return `اسم الطالب,${item.name} (العظمى ${item.max})\nأحمد الأول,0`;},saved.id);
    await page.locator('[data-change="grade-file"]').setInputFiles({name:'grades.csv',mimeType:'text/csv',buffer:Buffer.from(gradeCsv)});
    await page.getByText('grades.csv',{exact:true}).waitFor();
    await page.locator('[data-act="grade-review"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-grade-review]')||document.querySelector('.grade-transfer__message.is-error'));
    // Fresh local imports have no server revision: preserve the real N90 refusal.
    assert.match(await page.locator('.grade-transfer__message.is-error').innerText(),/GRADE_CONTEXT_INVALID/);
    // Prepare an explicitly synthetic acknowledged fixture, with valid parent/child revisions.
    const itemId=await page.evaluate(async id=>{
      const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),f=await import('/tests/n73-account-flow-fixture.mjs'),g=await import('/src/lib/grade-transfer.js');
      const t=s.getTeaching(id),section=s.getSection(t.sectionId),roster=s.students(id);
      const rows={teachings:[t],sections:[section],items:s.teachingContext(id).items,students:roster,
        enrollments:s.state.enrollments.filter(e=>e.sectionId===section.id)};
      for(const [name,list] of Object.entries(rows)){for(const row of list){row.serverRevision=1;row.ownerId=f.owner;}await d.putMany(name,list);}
      return rows.items.find(g.isTransferItem).id;
    },saved.id);
    await page.locator('[data-grade-kind]').selectOption(itemId);
    await page.locator('[data-act="grade-review"]').click();
    await page.locator('[data-grade-review]').waitFor();
    assert.match(await page.locator('[data-grade-review]').innerText(),/0/);
    const preGrade=await checkpoint(page);await page.locator('[data-act="grade-confirm"]').click();assert.equal(await checkpoint(page),preGrade);
    await page.locator('[data-act="grade-cancel"]').click();
    await visit(page,'#/classes','.classes-toolbar');
    await page.locator('[data-act="delete-class-flow"]').click();await page.locator('#class-delete-next-btn').waitFor();
    assert.equal(await page.locator('#class-delete-confirm-btn').count(),0);assert.equal(await checkpoint(page),preGrade);
    await page.keyboard.press('Escape');
    before=await checkpoint(page);
    pass('actual_native_import_and_binary_downloads','Actual native select enters guarded class import; independent direct XLSX downloads with separate per-class names and grades; suppressed automatic dispatch keeps truthful individual fallback, no store changes; ordinary format picker removed, dedicated Noor retained.');
    await visit(page,'#/classes/koshoof','[data-existing-class]');await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();await page.locator('[data-koshoof-all]').check();
    const term=await page.evaluate(async()=>{const s=await import('/src/store.js');const old=s.state.device.activeTermId;s.state.device.activeTermId=s.state.terms[1].id;(await import('/src/repaint.js')).repaint();return old;});
    await page.locator('[data-existing-class]').waitFor();
    await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
    await page.getByText('الفصول المحددة: 0',{exact:true}).waitFor();assert.equal(await page.locator('[data-koshoof-class]').count(),0);
    await page.evaluate(async term=>{const s=await import('/src/store.js');s.state.device.activeTermId=term;(await import('/src/repaint.js')).repaint();},term);
    await page.locator('[data-existing-class]').waitFor();await page.locator('[data-act="koshoof-tab"][data-tab="export"]').click();
    await page.locator('[data-koshoof-class]').first().waitFor();assert.equal(await page.locator('[data-koshoof-class]:checked').count(),0);
    const guards=await page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),f=await import('/tests/n73-account-flow-fixture.mjs');const t=s.teachings()[0],sec=s.getSection(t.sectionId),user=c.user,session=c.session,results=[];
     const check=async name=>{(await import('/src/repaint.js')).repaint();await new Promise(r=>setTimeout(r,100));results.push({name,count:document.querySelectorAll('[data-koshoof-class]').length});};
     sec.status='archived';await check('archived');delete sec.status;t.ownerId=f.foreignOwner;await check('foreign');delete t.ownerId;c.setMockAuth({id:f.foreignOwner},session);await check('wrong-owner');c.setMockAuth(user,session);await check('restored');return results;});
    assert.equal(guards[0].count,1);assert.equal(guards[1].count,1);assert.equal(guards[2].count,0);assert.equal(guards[3].count,2);assert.equal(await checkpoint(page),before);
    // Confirmation modal session drift must not create anything.
    await visit(page,'#/classes/koshoof?new=1','[data-class-file]');await review(page,'ج');
    await page.locator('[data-act="class-import-confirm"]').click();await page.locator('[data-confirm]').waitFor();
    await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,{...c.session});});await page.locator('[data-confirm]').click();await page.getByText(/لم تكتمل العملية:/).waitFor();assert.equal(await checkpoint(page),before);
    // Expired account offline lease: actual render and handlers unavailable.
    await context.setOffline(true);await page.clock.setFixedTime(new Date(Date.now()+15*86400000));await page.evaluate(async()=>(await import('/src/repaint.js')).repaint());await page.getByText('الاستيراد غير متاح الآن',{exact:true}).waitFor();assert.equal(await checkpoint(page),before);
    pass('actual_owner_term_archived_session_and_expired_lease','Selection reset on term change; archived/foreign teaching excluded; wrong owner denies hub; session drift during final modal and expired offline lease produce zero writes. '+JSON.stringify(guards));
   }
   pass('actual_UI_'+width,'Actual HTTP app DOM/CSS and account handlers: light/dark Home, toolbar, manual name-only CSV preview, dedup/invalid blocking, cancel/no write, one-class success, native select and compact checkbox export; no horizontal overflow. Screenshots test-results/n107-final/.');
  }finally{await context.close();}
 }
 if(variants) {
  for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  try {
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));await prepare(page);
   const before=await checkpoint(page);
   await visit(page,'#/classes/koshoof?new=1','[data-class-file]');
   await upload(page,'اسم الطالب,الاسم\nأحمد الأول,محمد الثاني');await fields(page,'أ');
   await page.locator('select[name="name"]').selectOption('1');await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
   assert.match(await page.locator('.class-import-groups').innerText(),/محمد الثاني/);assert.doesNotMatch(await page.locator('.class-import-groups').innerText(),/أحمد الأول/);assert.equal(await checkpoint(page),before);
   const buffer=await readFile('tests/n12-students.xlsx');
   await page.locator('[data-class-file]').setInputFiles({name:'names.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});await page.locator('[data-class-mapping]').waitFor();
   await fields(page,'أ');await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();await page.locator('[data-act="class-import-select"]').click();
   assert.equal(await checkpoint(page),before);await approve(page);await page.getByRole('heading',{name:/اكتمل استيراد الفصل بنجاح/}).waitFor();
   const saved=await page.evaluate(async()=>{const s=await import('/src/store.js');return {count:s.teachings().length,names:s.students(s.teachings()[0].id).map(r=>r.name),scores:s.state.scores.length};});
   assert.equal(saved.count,1);assert.ok(saved.names.length>0);assert.equal(saved.scores,0);
   const year=await page.evaluate(async()=>{const s=await import('/src/store.js');return s.activeYear().label;});assert.ok((await page.locator('.class-import-review').innerText()).includes(year));
   await page.setViewportSize({width:320,height:900});await overflow(page,'year receipt 320');await page.screenshot({path:'test-results/n107-final/320-success-year.png',fullPage:true});
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);
   const after=await checkpoint(page);await reset(page);await upload(page,'اسم الطالب\nطالب آخر');await fields(page,'أ');await page.getByRole('button',{name:'عرض المعاينة دون حفظ'}).click();
   assert.equal(await page.locator('[data-act="class-import-select"]').isDisabled(),true);assert.match(await page.locator('.class-import-groups').innerText(),/فصل موجود أو مؤرشف/);assert.equal(await checkpoint(page),after);
   pass('actual_XLSX_ambiguous_column_existing_duplicate','Actual ambiguous-name native select previews only the deliberately chosen column; actual XLSX upload with manual Rakeez metadata creates one class only after confirmation; reimport of existing class is blocked without writes.');
  }finally{await context.close();}
 }
 if(!variants) {
 // Service Worker/offline check uses its own fresh synthetic Demo installation.
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'allow'});
 try {
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await openReadyServedDemo(page,base);
  await page.waitForFunction(async()=>{await navigator.serviceWorker.ready;return !!await caches.match('/src/lib/class-koshoof-bundle.js')&&!!await caches.match('/src/lib/zip.js');},null,{timeout:30000});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','active'));await context.setOffline(true);
  await visit(page,'#/classes/koshoof','[data-existing-class]');await page.reload();await page.locator('[data-existing-class]').waitFor({timeout:30000});
  await visit(page,'#/classes/import','[data-class-file]');await page.reload();await page.locator('[data-class-file]').waitFor({timeout:30000});
  pass('cached_offline_actual_routes','Fresh controlled Demo cache contains both new dependencies; actual hub and legacy new-class alias reload offline via Service Worker.');
 }finally{await context.close();}
 }
 assert.deepEqual(evidence.errors,[]);
}catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally {
 clearTimeout(timer);if(browser)await browser.close();await new Promise(done=>server.close(done));
 evidence.cleanup='Owned fresh browser contexts, browser and loopback server closed in finally; shared phase lease released by runner command.';
 await writeFile('tests/n107-final-single-hub-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
