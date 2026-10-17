// AI: real HTTP-served app and extension DOM/CSS/handlers; only synthetic source/service adapters.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
import * as models from '../src/models.js';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const taskId='continuous-n36-ascending-class-order-and-coverage-status-20261017',runId='f8b69a07-fc03-4447-8dd9-dbb3e06a0b1b';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const base='http://127.0.0.1:49437',root=resolve('.');
const expected=['خامس1','خامس2','خامس3','خامس4','خامس5','خامس6','خامس7','خامس8','سادس6','سادس7'];
const shuffled=['سادس7','خامس8','خامس3','خامس1','سادس6','خامس7','خامس4','خامس2','خامس6','خامس5'],counts=[28,28,29,28,30,28,29,31,34,35];
const rows=shuffled.flatMap(classroom=>Array.from({length:counts[expected.indexOf(classroom)]},(_,i)=>({classroom,name:'طالب اصطناعي '+String.fromCharCode(0x621+Math.floor(i/20))+String.fromCharCode(0x621+i%20)})));
const service=syntheticService();
service.current.sections=shuffled.map((name,i)=>({...models.makeSection({id:'n36-section-'+i,yearId:'n73-year',grade:name.startsWith('خامس')?5:6,label:name.match(/\d+/)[0]}),name,ownerId:owner,order:i}));
service.current.teachings=service.current.sections.map((s,i)=>({...models.makeTeaching({id:'n36-teaching-'+i,sectionId:s.id,termId:'n73-term',subjectId:'n73-subject'}),ownerId:owner,order:i}));
service.current.sections.unshift({...models.makeSection({id:'demo:n36-section',yearId:'n73-year',grade:1,label:'1'}),name:'أول1',ownerId:owner,order:-1});
service.current.teachings.unshift({...models.makeTeaching({id:'demo:n36-teaching',sectionId:'demo:n36-section',termId:'n73-term',subjectId:'n73-subject'}),ownerId:owner,order:-1});
service.current.enrollments=[{id:'n36-enrollment',studentId:'n73-student1',sectionId:'n36-section-7',status:'active',ownerId:owner,deleted:false}];
let calls=0;
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.startsWith('/__n73/')){calls++;let body='';for await(const c of req)body+=c;const result=await service.request(u.pathname.slice(7),JSON.parse(body||'{}'));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
 const file=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch(e){res.writeHead(404);res.end(e.message);}});
const evidence={taskId,runId,baseSha:'1e265c9ac4552f9503ad2871c39c1ad19cd5d244',checks:[],errors:[],externalRequests:[],preservedFailures:[]};
let prior;
try { prior=JSON.parse(await fs.readFile('tests/n36-academic-class-order-browser.json','utf8')); evidence.preservedFailures.push(...(prior.preservedFailures??[])); if(prior.failure)evidence.preservedFailures.push({failure:prior.failure,reason:'Harness expected a new class preview after the previous window was fully receipted and the immediate next page failed with zero new rows. Corrected fixture retains a valid page before a failed page; optional MyStudents fixtures also require the existing school-bound context. Guards remain unchanged.'}); } catch {}
if(process.argv.includes('--app-only')){
 for(const f of ['extensions/rakeez-teacher-import-helper/run-controller.js','extensions/rakeez-teacher-import-helper/categories-popup.js','extensions/rakeez-teacher-import-helper/source-roster.js','src/lib/class-order.js'])assert.equal(createHash('sha256').update(await fs.readFile(f)).digest('hex'),prior.sourceHashes[f],f+' unchanged for reused extension proof');
 evidence.checks.push(...prior.checks.filter(c=>c.name.startsWith('controller-')||c.name.startsWith('proved-')||c.name.startsWith('unproved-')));assert.equal(evidence.checks.length,6);
 evidence.reusedExtensionProof='Six successful scenarios from the same source hashes; only the account harness advances from its corrected advanced-details UI navigation';
}
if(process.argv.includes('--extension-only')){
 for(const [f,sha] of Object.entries(prior.sourceHashes).filter(([f])=>f.startsWith('src/')||f==='sw.js'))assert.equal(createHash('sha256').update(await fs.readFile(f)).digest('hex'),sha,f+' unchanged account/offline proof');
 evidence.checks.push(...prior.checks.filter(c=>c.name.startsWith('actual-')||c.name.endsWith('ui-entry-rejected')));assert.equal(evidence.checks.length,4);
 evidence.offlineLease=prior.offlineLease;evidence.offlineRelease=prior.offlineRelease;
 evidence.reusedAppProof='Unchanged app modules and SW hashes: actual owner-bound account list/mapping, negative owner/lease entries and leased offline shell proof reused';
}
const record=(name,data)=>{evidence.checks.push({name,status:'PASS',evidence:data});console.log('PASS '+name);};
const checkpoint=p=>p.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49437,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  // Real extension page, controller and category handlers; browser APIs are synthetic.
  for(const scenario of process.argv.includes('--app-only')?[]:['paused','network','schema','terminal300','unknown','gap']){
   const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
   try{
    await context.addInitScript(({scenario,rows,base})=>{
     const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'a'.repeat(32),optional='/SchoolManagment/Actions/MyStudents?SchoolId='+'a'.repeat(32);
     const source={id:7,url:base+'/Dashboards/Schools',status:'complete'};
     window.receipts=false;window.sent=[];window.pending=new Map();window.continues=0;
     window.addEventListener('n36:continue',()=>window.continues++);
     const chromeMock={runtime:{getManifest:()=>({version:'0.5.7'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:async m=>{
      if(m.type==='n36-create'){const actionId='batch-'+window.sent.length;window.sent.push(m.envelope);window.pending.set(actionId,m.envelope.rows.length);return {ok:true,actionId};}
      if(m.type==='n36-result'){const n=window.pending.get(m.actionId);return window.receipts?{ok:true,status:'saved',total:n,remaining:0,added:n,existing:0}:{ok:true,status:'pending'};}
      return {ok:true};
     }},tabs:{get:async()=>source,update:async(id,change)=>{if(change.url)source.url=change.url;return source;},onRemoved:{addListener(){}},onUpdated:{addListener(){}}},scripting:{executeScript:async input=>{
      if(input.files)return [];
      const mode=input.args?.[0];let value={ok:true};
      if(mode==='home')value={ok:true,runContext:{schoolId:'a'.repeat(32)},tables:[],warnings:[],links:[{kind:'students',path:report},...(scenario==='terminal300'?[{kind:'students',path:optional}]:[])]};
      if(mode==='fetch'){
       const n=Number(new URL(input.args[1].path,base).searchParams.get('page')??1);
       if(n===3&&['network','schema'].includes(scenario))value={ok:false,code:scenario==='network'?'REPORT_FETCH_FAILED':'SOURCE_SCHEMA_UNVERIFIED'};
       else {
        const selected=n===1?rows:scenario==='paused'?['ثانية متوسط2','اولى ثانوي1','سادس1','اولى متوسط1','خامس10','خامس2'].map(classroom=>({classroom,name:'طالب تابع'})):[{name:'طالب تابع',classroom:'خامس1'}];
        const terminal=scenario==='terminal300'||n===2&&!['network','schema'].includes(scenario);
        value={ok:true,tables:[{category:'students',text:'اسم الطالب\tالفصل\n'+selected.map(r=>r.name+'\t'+r.classroom).join('\n')}],warnings:[],links:terminal||['unknown','gap'].includes(scenario)?[]:[{kind:'students',path:report+'?page='+(n+1),pagination:true}],pagination:{series:'synthetic',current:scenario==='gap'?2:n,total:scenario==='unknown'?null:scenario==='terminal300'?1:['network','schema'].includes(scenario)?3:2,terminal:scenario==='gap'?true:scenario==='unknown'?false:terminal}};
       }
      }
      if(mode==='students')value={ok:false,incomplete:true,code:'ROSTER_LINKS_UNAVAILABLE',diagnostic:{stage:'source-schema',reason:'ROSTER_LINKS_UNAVAILABLE',category:'students',roster:{cause:'MAIN_FRAME_READ_LINK_ABSENT',relevant:0,unsupported:0,iframes:0}}};
      return [{frameId:0,result:value}];
     }}};
     window.chrome=chromeMock;
    },{scenario,rows,base});
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
    await page.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html?run='+scenario);
    await page.waitForFunction(()=>typeof window.n36CanContinue==='function'&&typeof window.n36BeforeExport==='function');
    await page.evaluate(s=>{const c=new BroadcastChannel('rakeez-private-one-start');c.postMessage({type:'launch',token:s,tabId:7});c.close();},scenario);
    await page.locator('#source-class-select').waitFor();
    const options=await page.locator('#source-class-select option').evaluateAll(options=>options.slice(1).map(o=>o.value));assert.deepEqual(options,expected);
    await page.locator('#source-class-select').selectOption('خامس2');
    assert.deepEqual(await page.locator('#source-class-names li').allTextContents(),rows.filter(r=>r.classroom==='خامس2').map(r=>r.name));
    const summary=await page.locator('#source-coverage').innerText();
    assert.equal(await page.evaluate(()=>document.dir),'rtl');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.notEqual(await page.locator('#source-class-select').evaluate(el=>getComputedStyle(el).fontFamily),'');
    if(['paused','network','schema'].includes(scenario)){
     assert.match(summary,/توقف الجمع مؤقتًا/);assert.equal(await page.locator('#source-continue').isDisabled(),true);
     await page.locator('#partial-approval').check();await page.locator('#bundle-review').check();await page.locator('#handoff-transfer').click();
     assert.equal(await page.evaluate(()=>window.sent[0].rows[0].classroom),'خامس2');
     assert.equal(await page.evaluate(()=>window.n36CanContinue()),false);assert.equal(await page.locator('#source-class-select').isDisabled(),true);
     // An actual pending transport response must not advance the cursor.
     await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.n36CanContinue()),false);
     await page.evaluate(()=>window.receipts=true);await page.waitForFunction(()=>!document.querySelector('#source-class-select').disabled);
     for(const classroom of expected.filter(c=>c!=='خامس2')){
      await page.locator('#source-class-select').selectOption(classroom);await page.locator('#partial-approval').check();await page.locator('#bundle-review').check();await page.locator('#handoff-transfer').click();await page.waitForFunction(()=>!document.querySelector('#source-class-select').disabled);
     }
     assert.equal(await page.locator('#source-continue').isEnabled(),true);await page.locator('#source-continue').click();
     await page.waitForFunction(()=>document.querySelector('#source-coverage')&&!document.querySelector('#source-continue')?.hidden===false&&document.querySelector('#source-coverage').textContent.indexOf('توقف الجمع مؤقتًا')<0);
     const final=await page.locator('#source-coverage').innerText();
     if(scenario==='paused'){assert.match(final,/ثبت اكتمال/);assert.deepEqual(await page.locator('#source-class-select option').evaluateAll(os=>os.slice(1).map(o=>o.value)),['خامس2','خامس10','سادس1','اولى متوسط1','ثانية متوسط2','اولى ثانوي1']);await page.locator('#source-class-select').selectOption('اولى متوسط1');assert.deepEqual(await page.locator('#source-class-names li').allTextContents(),['طالب تابع']);}
     else assert.match(final,/تغطية الكشف جزئية/);
     record('controller-'+scenario,{initial:summary,final,receiptGate:true,sentClasses:await page.evaluate(()=>window.sent.map(e=>e.rows[0].classroom)),continuations:await page.evaluate(()=>window.continues)});
    }else if(scenario==='terminal300'){
     assert.match(summary,/ثبت اكتمال/);assert.equal(await page.locator('#partial-approval').isVisible(),false);assert.match(await page.locator('#source-continue').innerText(),/الاختيارية/);record('proved-terminal-300-with-optional-task',summary);
    }else {assert.match(summary,scenario==='gap'?/تغطية الكشف جزئية/:/غير معلوم/);assert.equal(await page.locator('#partial-approval').isVisible(),true);record('unproved-'+scenario,summary);}
    const diagnostic=await page.locator('#route-diagnostic').inputValue();assert.doesNotMatch(diagnostic,/https?:|SchoolId|طالب اصطناعي|خامس/);assert.match(diagnostic,/complete=(?:0|300|6) \|/);assert.doesNotMatch(diagnostic,/complete=(?:true|false)/);
    await page.locator('#run-cancel').click();
   }finally{await context.close();}
  }
  if(!process.argv.includes('--extension-only')){
  const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
  try{
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
   await openReadyServedDemo(page,base);
   const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
   await page.evaluate(()=>{location.hash='#/classes';return import('/src/repaint.js').then(m=>m.repaint());});
   await page.waitForFunction(()=>document.querySelectorAll('.class-card').length===11);
   const classOrder=await page.locator('.class-card').evaluateAll(cards=>cards.map(c=>c.querySelector('a[href^="#/teaching/"]')?.getAttribute('href')));
   // Card IDs after grade/section sort must match the unchanged class records.
   assert.deepEqual(classOrder.map(h=>h?.split('/')[2]),[...expected.map(n=>'n36-teaching-'+shuffled.indexOf(n)),'demo:n36-teaching']);
   const before=await checkpoint(page),beforeCalls=calls;
   await page.evaluate(()=>location.hash='#/classes/koshoof?import=1');await page.locator('[data-existing-class]').waitFor();
   const ids=await page.locator('[data-existing-class] option').evaluateAll(os=>os.slice(1).map(o=>o.value));assert.deepEqual(ids,[...expected.map(n=>'n36-teaching-'+shuffled.indexOf(n)),'demo:n36-teaching']);
   await page.locator('[data-existing-class]').selectOption('n36-teaching-7');
   await page.waitForFunction(()=>document.querySelector('[data-existing-class]')?.value==='n36-teaching-7');
   const target=await page.evaluate(async()=>{const s=await import('/src/store.js');const id=document.querySelector('[data-existing-class]').value;s.assertClassOperationsAccess(id);const t=s.getTeaching(id);return {id,sectionId:t.sectionId,owner:s.getActiveWorkspace().authUserId,students:s.students(id).map(s=>s.id)};});
   assert.deepEqual(target,{id:'n36-teaching-7',sectionId:'n36-section-7',owner,students:['n73-student1']});
   await page.locator('[data-n36-advanced] > summary').click();await page.locator('.grade-transfer__school > summary').click();
   await page.locator('[data-act="teacher-setup-import"]').click();await page.locator('[data-import-paste]').waitFor();
   const bundle={schema:'rakeez-private-teacher-setup',version:1,categories:[{category:'students',provenance:['pasted-visible'],rows:[{name:'طالب سادس',classroom:'سادس7'},{name:'طالب خامس',classroom:'خامس2'}]}]};
   await page.locator('[data-import-paste]').fill(JSON.stringify(bundle));await page.locator('[data-import-parse]').click();
   await page.locator('[data-import-year]').selectOption('n73-year');await page.locator('[data-import-term]').selectOption('n73-term');
   const mappingLabels=await page.locator('[data-import-map="classes"]').evaluateAll(es=>es.map(e=>e.closest('label').textContent));assert.match(mappingLabels[0],/خامس2/);assert.match(mappingLabels[1],/سادس7/);
   const mappingIds=await page.locator('[data-import-map="classes"]').first().locator('option').evaluateAll(es=>es.slice(1).map(e=>e.value));assert.deepEqual(mappingIds,[...expected.map(n=>'n36-section-'+shuffled.indexOf(n)),'demo:n36-section']);
   await page.locator('[data-import-map="classes"]').first().selectOption('n36-section-7');
   assert.equal(await page.locator('[data-import-map="classes"]').first().inputValue(),'n36-section-7');
   await page.locator('[data-sheet-close]').last().click();assert.deepEqual(await checkpoint(page),before);assert.equal(calls,beforeCalls);
   record('actual-account-class-list-import-options-and-mapping',{classOrder,ids,target,sourceOrder:['خامس2','سادس7'],databaseUnchanged:true,serviceCallsUnchanged:true});
   // Existing owner and lease negative guards remain active through the actual UI entry.
   await page.evaluate(async()=>{(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('synthetic-expired');});
   await page.locator('[data-act="teacher-setup-import"]').click();assert.equal(await page.locator('[data-import-paste]').count(),0);record('expired-lease-ui-entry-rejected','Actual receiver entry rejected an invalidated synthetic lease');
   await page.evaluate(async()=>{const f=await import('/tests/n36-receiver-fixture.mjs');await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));const c=await import('/src/lib/cloud.js');c.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'});});
   await page.waitForFunction(()=>!document.querySelector('[data-act="teacher-setup-import"]'));assert.equal(await page.locator('[data-import-paste]').count(),0);record('foreign-owner-ui-entry-rejected','Ownership change removed the actual guarded import entry and no receiver opened');
  }finally{await context.close();}
  }
 });
 if(!process.argv.includes('--extension-only')){
 // Service Worker/offline phase owns the shared browser lease; never use the isolated helper for it.
 const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
 let browser,offlineContext,leased=false;
 try{
  evidence.offlineLease=lease('acquire');leased=true;
  browser=await chromium.launch({headless:true});offlineContext=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:950},locale:'ar-SA'});
  await offlineContext.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await offlineContext.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await offlineContext.newPage();page.setDefaultTimeout(20000);
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cached=await page.evaluate(async()=>{const r=await caches.match('/src/lib/class-order.js');return r?await r.text():null;});
  assert.equal(cached,await fs.readFile('src/lib/class-order.js','utf8'));
  await offlineContext.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.boot').waitFor({state:'detached'});await page.waitForFunction(()=>!!document.querySelector('.class-card'));
  const sorted=await page.evaluate(async()=>{const {compareAcademicClasses}=await import('/src/lib/class-order.js');return ['سادس1','خامس10','خامس2'].sort(compareAcademicClasses);});
  assert.deepEqual(sorted,['خامس2','خامس10','سادس1']);
  record('actual-service-worker-offline-shell','New module cached with exact source bytes; real app reloaded offline and rendered class cards; comparator imported offline');
 }finally{await offlineContext?.close();await browser?.close();if(leased)evidence.offlineRelease=lease('release');}
 }
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;evidence.preservedFailures.push(e.stack);process.exitCode=1;console.error(e);}
finally{
 await new Promise(done=>server.close(done));evidence.cleanup='Owned loopback server and disposable contexts/browser closed in finally; isolated helper for local UI; separate offline SW browser phase lease released';
 evidence.sourceHashes={};for(const f of ['extensions/rakeez-teacher-import-helper/run-controller.js','extensions/rakeez-teacher-import-helper/categories-popup.js','extensions/rakeez-teacher-import-helper/source-roster.js','src/lib/class-order.js','src/lib/teacher-setup-import.js','src/lib/class-import-file.js','src/views/teachings.js','src/views/class-import-center.js','src/views/teacher-setup-import.js','sw.js'])evidence.sourceHashes[f]=createHash('sha256').update(await fs.readFile(f)).digest('hex');
 evidence.archiveSha256=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.7.manifest.json','utf8')).archive.sha256;
 await fs.writeFile('tests/n36-academic-class-order-browser.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:evidence.status,checks:evidence.checks.length,failure:evidence.failure}));
}
