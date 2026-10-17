// AI: focused actual application DOM/CSS and existing synthetic restored-owner fixture.
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from '../src/lib/student-import-parsers.js';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
const taskId='continuous-n104-responsive-toolbar-compact-export-20261017',runId='fb2b433b-da40-4f0a-9493-99221d33d6c4';
const taskFile=`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const base='http://127.0.0.1:49144',root=resolve('.'),service=syntheticService();
service.current.teachings=service.current.teachings.filter(row=>row.id!=='n73-second');
service.current.enrollments=[{id:'n104-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',status:'active',ownerId:owner,deleted:false}];
for(const n of [4,5]) {
 service.current.sections.push({...service.current.sections[0],id:'n104-section-'+n,grade:4,label:String(n)});
 service.current.teachings.push({...service.current.teachings[0],id:'n104-class-'+n,sectionId:'n104-section-'+n});
}
service.current.subjects[0].name='المهارات الرقمية';
const evidence={taskId,runId,baseSha:'7fb1bd31eab8f1838db71f16e37fc9a57aceae1b',checks:[],screenshots:[],errors:[]};
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,base).pathname;
  if(pathname.startsWith('/__n73/')) {let body='';for await(const chunk of req)body+=chunk;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside app root');
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}
});
async function prepare(page) {
 return page.evaluate(async()=>{
  const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
  const w=await import('/src/lib/workspaces.js');
  const receipt={ownerId:f.owner,protocol:'CORE_V2',restoreId:'n104-real-restore',manifestHash:'n104-real-manifest',completedAt:Date.now()};
  s.state.device.initialRestoreReceipt=receipt;await d.put('device',s.state.device);
  const registry=w.createWorkspaceRegistry();let record,routing;
  try {
   await registry.beginAccountRestore(f.owner,receipt);
   await registry.updateAccountRestore(f.owner,receipt.restoreId,{phase:'RESTORE_COMPLETE'});
   record=await registry.finalizeAccountRestore(f.owner,receipt);
   if(Object.hasOwn(record.restoreReceipt,'ownerId'))throw Error('Real finalizer unexpectedly contains ownerId');
   routing=await (await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner},registry});
  }finally{await registry.close();}
  if(routing.status!=='ready'||routing.mode!=='restored-account')throw Error(JSON.stringify(routing));
  s.activateWorkspace(routing.workspace);
  await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  // The regression must use the actual local create entry, with no fabricated owner.
  const section=s.getSection('n73-second-section');
  const teaching=await s.createTeaching({sectionId:section.id,termId:'n73-term',subjectId:'n73-subject'});
  if(teaching.ownerId!=null)throw Error('Fixture lost the pending ownerless create regression');
  const legacy=s.getTeaching('n73-source');delete legacy.ownerId;await d.put('teachings',legacy);
  (await import('/src/repaint.js')).repaint();
  return {id:teaching.id,owner:teaching.ownerId??null,workspace:s.getActiveWorkspace(),lease:s.getOfflineLeaseStatus()};
 });
}
const checkpoint=page=>page.evaluate(async()=>{
 const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(d.STORES.filter(n=>!['device','profile','meta'].includes(n)).map(n=>d.getAll(n))));
});
async function visit(page,hash,selector){await page.evaluate(async h=>{if(location.hash===h)(await import('/src/repaint.js')).repaint();else location.hash=h;},hash);await page.locator(selector).first().waitFor();}

const out='test-results/n104-responsive';
async function inspect(page,name,selectors) {
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');
 const boxes=await page.locator(selectors).evaluateAll(bs=>bs.filter(b=>b.getBoundingClientRect().height).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
 for(const b of boxes){assert.ok(b.h>=43,name+' target');assert.ok(b.x>=0&&b.x+b.w<=page.viewportSize().width+1,name+' bounds');}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,name+' overlap');}
 const path=`${out}/${page.viewportSize().width}-${name}.png`;await page.screenshot({path,fullPage:true});evidence.screenshots.push(path);
}
try {
 await mkdir(out,{recursive:true});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49144,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,1280]) {
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
   try {
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>evidence.errors.push(e.message));
    await openReadyServedDemo(page,base);const ready=await prepare(page),id=ready.id;
    assert.equal(ready.lease.editable,true);const before=await checkpoint(page);
    await page.evaluate(async()=>{const db=await(await import('/src/lib/db.js')).openDB(),original=db.transaction.bind(db);window.n104writes=0;db.transaction=function(names,mode,...args){if(mode==='readwrite')window.n104writes++;return original(names,mode,...args);};});
    for(const suffix of ['', '/students']) {
     await visit(page,'#/teaching/'+id+suffix,'.roster-entry-empty');
     assert.deepEqual((await page.locator('.roster-entry-empty .btn').allTextContents()).map(t=>t.trim()),['لصق الأسماء','إضافة طالب','استيراد الطلاب']);
     await inspect(page,suffix?'students-empty':'hub-empty','.roster-entry-empty .btn');
     for(const [act,field]of [[suffix?'import':'paste-names','#names-box'],[suffix?'add':'add-student','#new-student']]){
      await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();await page.locator('[data-sheet-close]').filter({hasText:'إلغاء'}).click();
     }
    }
    await visit(page,'#/teaching/n73-source/students','.roster-populated-actions');
    assert.match(await page.locator('.roster-populated-actions').innerText(),/إضافة طالب/);
    assert.doesNotMatch(await page.locator('.roster-populated-actions').innerText(),/يدويًا/);
    await inspect(page,'students-populated','.roster-populated-actions .btn');
    for(const [act,field]of [['import','#names-box'],['add','#new-student']]){await page.locator(`[data-act="${act}"]`).click();await page.locator(field).waitFor();await page.locator('[data-sheet-close]').filter({hasText:'إلغاء'}).click();}
    await page.locator('[data-act="file-import"]').click();await page.locator('[data-existing-class]').waitFor();assert.equal(await page.locator('[data-existing-class]').inputValue(),'n73-source');
    const card=page.locator('[data-n36-direct]');assert.equal(await card.locator('h3').innerText(),'استيراد الطلاب والفصول بشكل مباشر من مدرستي بإضافة مساعد ركيز المعلم');assert.match(await card.innerText(),/راجع البيانات وأكّد حفظها في ركيز/);assert.equal(await card.locator('a').count(),1);assert.equal(await card.locator('details').evaluate(e=>e.open),false);
    await inspect(page,'import','[data-n36-direct] a');await card.locator('summary').click();assert.equal(await card.locator('li').first().isVisible(),true);await card.locator('summary').click();
    assert.match(await page.locator('.class-import-page').first().innerText(),/لا ينشئ فصلًا جديدًا/);await page.locator('[data-import-kind]').selectOption('new');await page.locator('[data-n36-new-advanced]').waitFor();assert.match(await page.locator('.class-import-page').first().innerText(),/يُرفض الفصل المكرر/);
    await visit(page,'#/teaching/n73-source/grades','.grade-transfer__toolbar');
    const gradeLink=page.getByRole('link',{name:'استيراد وتصدير الدرجات',exact:true});assert.equal(await gradeLink.getAttribute('href'),'#/teaching/n73-source/koshoof');await inspect(page,'grades','.grade-transfer__toolbar .btn');await gradeLink.click();await page.locator('[data-existing-class]').waitFor();assert.equal(await page.locator('[data-existing-class]').inputValue(),'n73-source');
    await visit(page,'#/classes','.classes-toolbar');assert.equal(await page.locator('.classes-trash').isEnabled(),true);await inspect(page,'classes-populated','.classes-toolbar .btn,.classes-toolbar .iconbtn');
    await page.evaluate(async()=>{const s=await import('/src/store.js');window.n104teachings=s.state.teachings;s.state.teachings=[];(await import('/src/repaint.js')).repaint();});
    await page.locator('.classes-trash:disabled').waitFor();await inspect(page,'classes-empty','.classes-toolbar .btn,.classes-toolbar .iconbtn');
    await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.teachings=window.n104teachings;(await import('/src/repaint.js')).repaint();});
    await visit(page,'#/classes/koshoof?tab=export','.koshoof-selection');
    assert.equal(await page.locator('[data-koshoof-class]').count(),5);await page.locator('[data-koshoof-all]').check();await page.locator('[data-koshoof-content]').selectOption('grades');
    const labels=await page.locator('.koshoof-selection label').allTextContents();assert.ok(labels.every(s=>s.includes('المهارات الرقمية')&&!s.includes('144')&&!s.includes('الفصل الدراسي')));
    await inspect(page,'export','.koshoof-selection label');
    const downloads=[];page.on('download',d=>downloads.push(d));
    await page.locator('[data-act="koshoof-export"]').click();await page.waitForFunction(()=>document.body.innerText.includes('طُلب تنزيل 5 من 5'));
    await page.waitForTimeout(200);assert.equal(downloads.length,5);assert.equal(new Set(downloads.map(d=>d.suggestedFilename())).size,5);assert.ok(downloads.every(d=>d.suggestedFilename().endsWith('.xlsx')&&!d.suggestedFilename().includes('فصل')));
    for(const d of downloads){const stream=await d.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const bytes=Buffer.concat(chunks);assert.equal(bytes.subarray(0,2).toString(),'PK');
     const xml=strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
     if(d.suggestedFilename().includes('الخامس الابتدائي 1 ·')) {assert.match(xml,/Synthetic 1/);assert.match(xml,/<v>19<\/v>/);assert.match(xml,/Exam/);}else assert.doesNotMatch(xml,/Synthetic 1/);
    }
    evidence.checks.push({name:`five_workbooks_${width}`,status:'PASS',evidence:downloads.map(d=>d.suggestedFilename()).join(' | ')});
    // One synchronous request failure still requests the other four; no saved receipt.
    await page.evaluate(()=>{const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=original;throw Error('Synthetic one-request failure');};});
    await page.locator('[data-act="koshoof-export"]').click();await page.waitForFunction(()=>document.body.innerText.includes('طُلب تنزيل 4 من 5')&&document.body.innerText.includes('تعذّر طلب 1'));await page.waitForTimeout(200);assert.equal(downloads.length,9);
    assert.equal(await page.locator('[data-act="koshoof-file"],.koshoof-downloads').count(),0);assert.equal(await page.locator('[data-act="koshoof-export"]').count(),1);
    await page.locator('[data-koshoof-all]').uncheck();await page.locator('[data-act="koshoof-export"]:disabled').waitFor();assert.equal(await page.locator('[data-act="koshoof-export"]').isDisabled(),true);await page.locator('[data-koshoof-class][value="n73-source"]').check();await page.locator('[data-noor-grouping]').waitFor();
    const noor=page.locator('[data-noor-grouping]');assert.equal(await noor.evaluate(e=>e.open),false);assert.equal(await noor.locator('bdi').innerText(),'40 / 60');await noor.locator('summary').click();assert.equal(await noor.getByRole('button',{name:'تصدير كشف نور',exact:true}).count(),1);await inspect(page,'noor','[data-act="grade-noor-export"]');
    // A now-ineligible selected class must never export its former snapshot.
    await page.evaluate(async()=>{const s=await import('/src/store.js');s.getTeaching('n73-source').termId='missing-term';});
    await page.locator('[data-act="koshoof-export"]').click();await page.waitForFunction(()=>document.body.innerText.includes('تغيّر الفصل المتاح'));assert.equal(downloads.length,9);assert.match(await page.locator('.class-import-page').first().innerText(),/تغيّر الفصل المتاح/);
    await page.evaluate(async()=>{(await import('/src/store.js')).getTeaching('n73-source').termId='n73-term';});
    assert.equal(await checkpoint(page),before);assert.equal(await page.evaluate(()=>window.n104writes),0);
    evidence.checks.push({name:`actual_UI_${width}`,status:'PASS',evidence:'Empty/populated Students/Classes, actual paste/add cancel, Grades same context, N36 details/destination help, compact five-class selection; five unique XLSX download events with source student/score binding, one request error requests remaining four; clear selection and stale-term negative; Noor disclosure, zero DB writes and no overflow/overlap.'});
   }finally{await context.close();}
  }
 });
 assert.deepEqual(evidence.errors,[]);assert.equal(service.evidence.commits,0);
}catch(error){evidence.failure=error.stack;throw error;}
finally {
 server.closeAllConnections();if(server.listening)await new Promise(done=>server.close(done));
 evidence.sourceHashes=Object.fromEntries(await Promise.all(['src/views/grades.js','src/views/students.js','src/views/teaching-hub.js','src/views/class-import-center.js','src/lib/class-koshoof-bundle.js','src/lib/grade-transfer-export.js','src/styles/components.css','src/store.js'].map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
 evidence.resources='Canonical isolated browser closed owned fresh contexts/browser; task HTTP server closed in finally. No shared/live browser.';
 await writeFile('tests/n104-responsive-export-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
