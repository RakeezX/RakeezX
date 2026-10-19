// AI: bounded synthetic installed extension → actual guarded receiver/store. No school extraction.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const baseline=process.env.N36_BASELINE==='1';
const root=process.cwd(),out=path.resolve('tests/n36-feedback-1532'),app='https://rakeezx.com',school='https://schools.madrasati.sa',schoolId='a'.repeat(32);
const sourceURL=school+'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+schoolId+'?page=1';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-source-change-class-upsert-20261019.json',runId='538f9cb0-3d79-40a8-8c5c-37748229abd3';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const result={checks:[],synthetic:true,officialAccount:'NOT_RUN',production:'NOT_RUN',externalRequests:[]};
const record=(name,evidence)=>{result.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
let context,temp,timer,server,leased=false;
const service=syntheticService();service.current.sections=[];service.current.teachings=[];service.current.students=[];service.current.enrollments=[];service.current.scores=[];
const checkpoint=p=>p.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
try{
 result.lease=lease('acquire');leased=true;
 server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');
  res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-1532-'));let extension=path.join(root,'extensions/rakeez-teacher-import-helper');
 if(baseline){
  const original=execFileSync('git',['show','98885befd4f13c02210661309a4add21e04c72ca:extensions/rakeez-teacher-import-helper/run-controller.js'],{encoding:'utf8'});
  extension=path.join(temp,'baseline-extension');await fs.cp(path.join(root,'extensions/rakeez-teacher-import-helper'),extension,{recursive:true});
  // Instrument only the completed-snapshot checkpoint, leaving original handlers/guards untouched.
  await fs.writeFile(extension+'/run-controller.js',original+`
export function presentCollectedSource(active,coverage){review={tabId:active.tabId,origin:active.origin,context:active.context,expires:active.expires};window.dispatchEvent(new CustomEvent('n36:source-roster',{detail:{rows:active.sourceRows,...coverage,excluded:0,hasNext:false}}));}
`);
 }

 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:900},locale:'ar-SA',args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 timer=setTimeout(()=>context.close().catch(()=>{}),150000);timer.unref();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})});if(u.origin===school)return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><p class=school-name>مدرسة اصطناعية</p><p>الدور: معلم</p>'});result.externalRequests.push(u.href);return route.abort();});
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).hostname;
 const page=await context.newPage();await openReadyServedDemo(page,app);
 await page.evaluate(async()=>{const {accountWorkspaceDatabaseName}=await import('/src/lib/workspaces.js');const name=await accountWorkspaceDatabaseName('a7300000-0000-4000-8000-000000000001');await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=j;});});
 const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
 const before=await checkpoint(page);assert.equal(before.sections.length,0);
 const source=await context.newPage();await source.goto(sourceURL);
 // Explicit synthetic action grants activeTab on this fabricated source only; no Start/extraction.
 const cdp=await context.browser().newBrowserCDPSession();const targets=await cdp.send('Target.getTargets',{filter:[{type:'tab'},{exclude:true}]});
 const target=targets.targetInfos.find(t=>t.url===source.url());await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
 const runner=await context.newPage();await runner.goto('chrome-extension://'+id+'/popup.html?run=synthetic');await runner.waitForFunction(()=>!!window.n36BeforeExport);
 const rows=['ألف','باء','جيم','دال'].map((n,i)=>({name:'طالب '+n,classroom:'خامس '+(i+1)}));
 async function stage(rows,{automatic=true,url=sourceURL}={}){
  return runner.evaluate(async({rows,url,automatic,schoolId})=>{
   const begun=await chrome.runtime.sendMessage({type:'n36-begin'});if(!begun.ok)throw Error(begun.code);
   window.n36AutomaticBatch=automatic?begun.batchId:null;
   const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/*'});if(tabs.length!==1)throw Error('SOURCE_FIXTURE');
   const {presentCollectedSource}=await import('./run-controller.js');
   presentCollectedSource({tabId:tabs[0].id,origin:'https://schools.madrasati.sa',context:{schoolId,schoolName:'مدرسة اصطناعية'},sourceURL:url,sourceRows:rows,expires:Date.now()+300000,excluded:0},{complete:false,coverage:'partial',hasNextReport:false,processedReportPages:7});
   return begun.batchId;
  },{rows,url,automatic,schoolId});
 }
 // Trigger actual same-source pagination in the async handoff preflight window.
 await runner.evaluate(()=>{const before=window.n36BeforeExport;let once=true;window.n36BeforeExport=async()=>{await before();if(once){once=false;const [tab]=await chrome.tabs.query({url:'https://schools.madrasati.sa/*'});await chrome.tabs.update(tab.id,{url:tab.url.replace('page=1','page=2')});await new Promise(r=>setTimeout(r,150));}};});
 if(baseline){
  await stage(rows);
  await runner.waitForTimeout(1500);
  await runner.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__safeReport=JSON.parse(text);}},configurable:true}));
  await runner.locator('#copy-safe-report').click();const safe=await runner.evaluate(()=>__safeReport);
  assert.equal(safe.collection.failure,'SOURCE_CHANGED');
  const denied=await checkpoint(page);assert.deepEqual(denied.students,before.students);assert.deepEqual(denied.sections,before.sections);
  result.originalDiagnostic=safe;record('baseline_source_changed_reproduced','Original base run-controller guards and actual categories handler: normal same-source page1→page2 during preflight invalidates completed review, raises SOURCE_CHANGED before any save. Only completed-checkpoint setup is instrumented; no extractor executed.');
  result.status='PASS';
 }else{
 await stage(rows);
 await runner.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:30000});
 const first=await checkpoint(page);assert.equal(first.sections.length,4);assert.equal(first.students.length,4);assert.equal(first.enrollments.length,4);assert.equal(first.device[0].n36NamesBatch.pending,null);
 for(let n=1;n<=4;n++){const section=first.sections.find(s=>s.grade===5&&s.label===String(n));assert.ok(section);assert.equal(section.name,'خامس '+n);}
 for(const k of ['teachings','scores','items','years','terms'])assert.deepEqual(first[k],before[k],k);
 record('fifth_labels_empty_targets','Actual installed runner completed snapshot (four fabricated pupils / خامس 1–4), original source page1 → page2 while active tab is runner; real worker encrypted claim + current app owner guard + four canonical section/roster writes + durable ACK. No extractor/pagination suite replay.');
 await page.screenshot({path:out+'/receiver.png',fullPage:true});await runner.screenshot({path:out+'/runner.png',fullPage:true});
 // Retry has same targets and names plus exactly one genuinely new pupil.
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);
 await stage([...rows,{name:'طالب هاء',classroom:'خامس 1'}]);
 await runner.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:30000});
 const second=await checkpoint(page);assert.deepEqual(second.sections,first.sections);assert.equal(second.students.length,5);assert.equal(second.enrollments.length,5);
 for(const s of first.students)assert.deepEqual(second.students.find(t=>t.id===s.id),s);
 for(const e of first.enrollments)assert.deepEqual(second.enrollments.find(t=>t.id===e.id),e);
 assert.deepEqual(second.scores,first.scores);assert.equal(second.device[0].n36NamesBatch.pending,null);
 record('retry_same_ids_one_new','Second real extension→receiver/store journey: SAME four section IDs, SAME existing pupil/enrollment IDs and rows; exactly one new pupil/enrollment, zero duplicate classes, grades unchanged.');
 // One consumed ACK is lost to the runner, while the actual store keeps its durable receipt.
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);
 await runner.evaluate(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);let lose=true;chrome.runtime.sendMessage=async(...args)=>{const r=await send(...args);if(lose&&args[0]?.type==='n36-result'&&['saved','existing'].includes(r?.status)){lose=false;return {ok:true,status:'unknown'};}return r;};});
 await stage([rows[0]]);await runner.locator('#run-status').filter({hasText:'فصول لم يتأكد'}).waitFor({timeout:10000});
 const lost=await checkpoint(page);assert.deepEqual(lost.sections,second.sections);assert.deepEqual(lost.students,second.students);
 await runner.locator('#source-retry').click();await runner.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:10000});
 const resumed=await checkpoint(page);for(const k of Object.keys(lost).filter(k=>k!=='device'))assert.deepEqual(resumed[k],lost[k],k);
 record('lost_ack_resume','Drop one actual consumed worker receipt at the runner boundary: UI stays unresolved; explicit retry uses the same completed source and durable canonical receipt, with no roster/outbox changes.');
 // Unparseable/ambiguous bare ordinals never select a guessed class.
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);await stage([{name:'طالب غير محسوم',classroom:'ثاني 1'}]);
 await runner.locator('#run-status').filter({hasText:'فصول لم يتأكد'}).waitFor({timeout:10000});
 await page.locator('[data-n36-handoff-status]').filter({hasText:'CLASS_MAPPING_REQUIRED'}).waitFor();
 assert.match(await page.locator('[data-n36-handoff-status]').innerText(),/المرحلة الدراسية/);
 const unresolved=await checkpoint(page);assert.deepEqual(unresolved.sections,resumed.sections);assert.deepEqual(unresolved.students,resumed.students);
 assert.ok(unresolved.device[0].n36NamesBatch.pending);
 record('ambiguous_label_no_guess','Bare ثاني 1 lacks academic stage: actual receiver keeps pending owner-bound rows and explains CLASS_MAPPING_REQUIRED, zero class/student writes.');
 // Resolve only this fabricated pending name via the existing real mapping/resume handler.
 await page.locator('[data-n36-batch-map]').selectOption(resumed.sections[0].id);await page.locator('[data-n36-handoff-status]').filter({hasText:'حُفظت مطابقة الفصل'}).waitFor();
 await page.locator('[data-act="n36-batch-resume"]').click();await page.waitForFunction(async()=>!(await(await import('/src/lib/db.js')).get('device','device')).n36NamesBatch.pending);
 // Observe actual source-update handler independently of transport; no source DOM collection.
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);await stage(rows,{automatic:false});
 await source.goto(sourceURL.replace('page=1','page=3'));await runner.waitForTimeout(300);
 assert.equal(await runner.evaluate(()=>!!window.n36HandoffSource()),true);
 await runner.evaluate(()=>window.n36BeforeExport());
 await source.goto(school+'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'b'.repeat(32)+'?page=3');await runner.waitForTimeout(300);
 assert.equal(await runner.evaluate(()=>!!window.n36HandoffSource()),false);
 record('normal_page_movement_wrong_source_denial','Actual onUpdated and pre-export guard allow same authorized source pagination, reject replaced report/school. Source remains bound to captured tab rather than active runner; expiry/role/school policies retained.');
 // Current owner guard is exercised at the real UI/store entry.
 const saved=await checkpoint(page);
 await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');cloud.session.user.id='a7300000-0000-4000-8000-000000000002';});
 const denied=await page.evaluate(()=>{try{window.rakeezBeginNamesBatch();return false;}catch{return true;}});assert.equal(denied,true);
 const afterDenied=await checkpoint(page);assert.deepEqual(afterDenied,saved);
 record('wrong_owner_denial','Actual window.rakeezBeginNamesBatch / ownership guard denies mismatched session owner; complete DB checkpoint unchanged.');
 assert.deepEqual(result.externalRequests,[]);record('n36_reported_source_changed_and_fifth_class_upsert_retry_no_duplicate','All six bounded installed-extension/actual-app checks pass; baseline SOURCE_CHANGED reproduction retained separately. Synthetic only.');result.status='PASS';
 }
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;console.error(e);if(context)for(const p of context.pages())console.error(p.url(),await p.locator('body').innerText().catch(()=>''));}
finally{clearTimeout(timer);await context?.close();if(server?.listening)await new Promise(r=>server.close(r));if(temp){assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}if(leased)result.release=lease('release');result.cleanup='Owned disposable extension context/profile and loopback server closed; owned lease released if acquired';await fs.writeFile(out+(baseline?'/baseline-source-change.json':'/journeys.json'),JSON.stringify(result,null,2)+'\n');}
