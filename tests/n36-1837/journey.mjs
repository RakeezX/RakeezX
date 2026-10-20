// AI: bounded synthetic installed extension → actual guarded receiver/store. No school extraction.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const root=process.cwd(),out=path.resolve('tests/n36-1837'),app='https://rakeezx.com',school='https://schools.madrasati.sa',schoolId='a'.repeat(32);
const sourceURL=school+'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+schoolId+'?page=1';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-one-start-complete-madrasati-20261019.json',runId='60011041-25fb-4273-b30b-1405ce0b324e';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const result={checks:[],synthetic:true,officialAccount:'NOT_RUN',production:'NOT_RUN',externalRequests:[]};
const record=(name,evidence)=>{result.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
let context,temp,timer,server,leased=false;
const service=syntheticService();service.current.sections=[];service.current.teachings=[];service.current.students=[];service.current.enrollments=[];service.current.scores=[];
const readyOwner='a7300000-0000-4000-8000-000000000001';
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

 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:900},locale:'ar-SA',args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 timer=setTimeout(()=>context.close().catch(()=>{}),150000);timer.unref();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})});if(u.origin===school)return route.fulfill({contentType:'text/html;charset=utf-8',body:`<!doctype html><meta charset=utf-8><p class=school-name>مدرسة اصطناعية</p><p>الدور: معلم</p>
 <table><tr><td>اسم المعلم</td><td>معلم اصطناعي</td></tr><tr><td>اسم المدير</td><td>مدير اصطناعي</td></tr><tr><td>اسم المدرسة</td><td>مدرسة اصطناعية</td></tr></table>
 <table><tr><th>الفصل</th><th>المادة</th></tr><tr><td>خامس 1</td><td>العلوم</td></tr><tr><td>خامس 2</td><td>الرياضيات</td></tr></table>
 <table><tr><th>اليوم</th><th>الحصة</th><th>الفصل</th><th>المادة</th></tr><tr><td>الأحد</td><td>1</td><td>خامس 1</td><td>العلوم</td></tr><tr><td>الاثنين</td><td>2</td><td>خامس 2</td><td>الرياضيات</td></tr></table>`});result.externalRequests.push(u.href);return route.abort();});
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
 const rows=['ألف','باء','جيم','دال'].map((n,i)=>({name:'طالب '+n,classroom:'خامس '+(i<2?'1':'2')}));
 const setup=await runner.evaluate(async()=>{
   const {readAutomaticTeacherPage}=await import('./selection.js'),{parseCategoryTable}=await import('./categories.js');
   const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/*'});
   const reply=await chrome.scripting.executeScript({target:{tabId:tabs[0].id,frameIds:[0]},world:'ISOLATED',func:readAutomaticTeacherPage,args:['metadata']});
   const p=reply[0].result;if(!p.ok)throw Error('SOURCE_FIXTURE_'+p.code);
   return p.tables.filter(t=>t.category!=='students').map(t=>({category:t.category,provenance:['teacher-readonly-run'],rows:parseCategoryTable(t.category,t.text)}));
 });
 assert.equal(setup.length,5);assert.ok(setup.find(c=>c.category==='classes').rows.every(r=>r.subject));
 record('representative_source_adapter','Existing closure-free DOM adapter extracts five categories including class subjects from small fabricated visible tables. No source route added, no real school accessed.');
 async function stage(rows,{automatic=true,url=sourceURL,categories=setup}={}){
  return runner.evaluate(async({rows,url,automatic,schoolId,categories})=>{
   const begun=await chrome.runtime.sendMessage({type:'n36-begin'});if(!begun.ok)throw Error(begun.code);
   window.n36AutomaticBatch=automatic?begun.batchId:null;
   const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/*'});if(tabs.length!==1)throw Error('SOURCE_FIXTURE');
   const {presentCollectedSource}=await import('./run-controller.js');
   presentCollectedSource({tabId:tabs[0].id,origin:'https://schools.madrasati.sa',context:{schoolId,schoolName:'مدرسة اصطناعية'},sourceURL:url,sourceRows:rows,categories,expires:Date.now()+300000,excluded:0},{complete:false,coverage:'partial',hasNextReport:false,processedReportPages:7});
   return begun.batchId;
  },{rows,url,automatic,schoolId,categories});
 }


 await stage(rows);
 await runner.locator('#run-status').filter({hasText:'وصل إيصال الأسماء المتاحة'}).waitFor({timeout:30000});
 const saved=await checkpoint(page);
 assert.equal(saved.sections.length,2);assert.equal(saved.students.length,4);assert.equal(saved.enrollments.length,4);
 assert.equal(saved.teachings.length,2);assert.equal(saved.slots.length,2);assert.equal(saved.sessions.length,0);
 assert.equal(saved.profile[0].teacherName,'معلم اصطناعي');assert.equal(saved.profile[0].schoolName,'مدرسة اصطناعية');
 assert.equal(saved.profile[0].principalName,'مدير اصطناعي');assert.equal(saved.profile[0].reportPrincipalName,'مدير اصطناعي');
 assert.equal(saved.device[0].n36NamesBatch.pending,null);
 assert.ok(saved.outbox.every(r=>r.ownerId===readyOwner));assert.equal(saved.subjects.length,3);
 record('actual_multi_entity_one_start','Installed extension → real receiver/owner/lease/store: 2 classes, 4 pupils, canonical subjects/teachings, 2 weekly slots, teacher/principal/school; zero generated sessions, real ACK NOT_RUN. Two class chunks exercise same-document receiver hash changes.');
 await page.goto(app+'/#/classes');await page.locator('.class-card__main[href^="#/teaching/"]').first().waitFor();
 assert.equal(await page.locator('.class-card__main[href^="#/teaching/"]').count(),2);
 await page.screenshot({path:out+'/classes.png',fullPage:true});
 record('rendered_actual_classes','Actual application DOM/CSS shows both saved classes with assigned subjects.');
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);await stage(rows);
 await runner.locator('#run-status').filter({hasText:'وصل إيصال الأسماء المتاحة'}).waitFor({timeout:30000});
 const retried=await checkpoint(page);
 for(const k of ['sections','subjects','students','enrollments','teachings','slots','profile','outbox','sessions'])assert.deepEqual(retried[k],saved[k],k);
 record('retry_reuses_all_identities','Deliberate Start from classes route and repeated source preserves exact entities, memberships, slots, profile and outbox; no duplicates or commands.');
 await runner.screenshot({path:out+'/summary.png',fullPage:true});
 // Conflict in existing profile and timetable: retain local values and report only counts.
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);
 const conflict=setup.map(c=>c.category==='teacher'?{...c,rows:[{name:'معلم مختلف'}]}:c.category==='timetable'?{...c,rows:[{weekday:'الأحد',period:'1',classroom:'خامس 2',subject:'الرياضيات'}]}:c);
 await stage(rows,{categories:conflict});await runner.locator('#run-status').filter({hasText:'وصل إيصال الأسماء المتاحة'}).waitFor({timeout:30000});
 const conflicted=await checkpoint(page);for(const k of ['profile','slots','teachings','subjects','outbox','sessions'])assert.deepEqual(conflicted[k],saved[k],k);
 assert.match(await runner.locator('#run-status').innerText(),/تعارضات أو حقول غير مدعومة: 2/);
 assert.match(await runner.locator('#run-status').innerText(),/المزامنة لم تتأكد/);
 record('conflicts_preserve_existing_values','Different teacher name and occupied timetable slot remain untouched; compact receipt reports two unresolved fields. No fake remote ACK.');
 // A currently running capability must fail after session replacement or wrong owner.
 await page.goto(app+'/#/classes/koshoof?import=1');await page.waitForFunction(()=>typeof window.rakeezBeginNamesBatch==='function');
 const guards=await page.evaluate(async()=>{
  const c=await import('/src/lib/cloud.js'),s=await import('/src/store.js');
  const id=window.rakeezBeginNamesBatch(),old=c.session;
  const initial=window.rakeezCheckNamesBatch(id);
  history.replaceState(null,'','#/classes');const hash=window.rakeezCheckNamesBatch(id);
  c.setMockAuth(old.user,{...old});const replaced=!window.rakeezCheckNamesBatch(id);
  const fresh=window.rakeezBeginNamesBatch(),freshValid=window.rakeezCheckNamesBatch(fresh);
  c.session.user.id='b7300000-0000-4000-8000-000000000002';
  const wrong=!window.rakeezCheckNamesBatch(fresh);let denied=false;try{window.rakeezBeginNamesBatch();}catch{denied=true;}
  c.session.user.id='a7300000-0000-4000-8000-000000000001';
  return {initial,hash,replaced,freshValid,wrong,denied};
 });assert.ok(Object.values(guards).every(Boolean),JSON.stringify(guards));
 assert.deepEqual(await checkpoint(page),conflicted);
 record('current_document_owner_session_guards','Actual app capability permits harmless same-document hash, rejects replaced session and wrong owner, fresh explicit Start binds current session; complete DB unchanged.');
 // The actual worker refuses a replaced account binding before navigation.
 const bound=await runner.evaluate(()=>chrome.runtime.sendMessage({type:'n36-begin'}));assert.equal(bound.ok,true);
 await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.session.user.id='b7300000-0000-4000-8000-000000000002';});
 const send=()=>runner.evaluate(async({batchId,rows})=>{const createdAt=Date.now();return chrome.runtime.sendMessage({type:'n36-create',envelope:{schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',batchId,complete:false,setup:[],rows,createdAt,expiresAt:createdAt+120000}});},{batchId:bound.batchId,rows:[rows[0]]});
 assert.equal((await send()).code,'APP_CHANGED');
 await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.session.user.id='a7300000-0000-4000-8000-000000000001';});
 // Same origin/new document does not inherit the original capability or documentId.
 await page.reload();await page.waitForLoadState('domcontentloaded');
 await page.evaluate(async()=>{await(await import('/tests/n36-actual-1719/restore.mjs')).restore();});
 assert.equal((await send()).code,'APP_CHANGED');
 const restored=await page.evaluate(async()=>{const s=await import('/src/store.js');s.assertClassImportAccess();return {owner:s.getActiveWorkspace().authUserId,receipt:s.state.device.accountProvisioningReceipt,db:s.getActiveWorkspace().databaseName,data:await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()};});
 assert.equal(restored.owner,readyOwner);assert.equal(restored.receipt.ownerId,readyOwner);
 for(const k of ['sections','subjects','students','enrollments','teachings','slots','profile','outbox'])assert.deepEqual(restored.data[k],saved[k],k);
 record('transport_rejects_owner_and_document_change','Installed worker rejects wrong account and reload as APP_CHANGED; fresh checkpoint binds owner/database/provisioning receipt and unchanged Product data after reload.');
 await page.goto(app+'/#/classes/koshoof?import=1');await page.waitForFunction(()=>typeof window.rakeezBeginNamesBatch==='function');
 const invalidTransfer=await runner.evaluate(async()=>{
  const begun=await chrome.runtime.sendMessage({type:'n36-begin'});if(!begun.ok)throw Error(begun.code);
  const createdAt=Date.now();return chrome.runtime.sendMessage({type:'n36-create',envelope:{schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',batchId:begun.batchId,complete:false,setup:[{category:'teacher',provenance:['teacher-readonly-run'],rows:[{name:'معلم 123'}]}],rows:[{name:'طالب زائد',classroom:'خامس 1'}],createdAt,expiresAt:createdAt+120000}});
 });assert.equal(invalidTransfer.ok,true);
 await runner.waitForFunction(async id=>{const r=await chrome.runtime.sendMessage({type:'n36-result',actionId:id});return r?.ok&&r.status==='unknown';},invalidTransfer.actionId);
 for(const k of ['profile','sections','students','enrollments','teachings','slots','outbox'])assert.deepEqual((await checkpoint(page))[k],saved[k],k);
 record('invalid_setup_before_names_write','Actual transport admits only minimal schema; full receiver validation rejects invalid teacher metadata BEFORE even the otherwise-valid new pupil is saved. Existing Product data/outbox unchanged, unknown receipt.');
 const negatives=await page.evaluate(async()=>{
  const s=await import('/src/store.js'),p=s.state.profile;
  const owner=p.ownerId;p.ownerId='foreign';let foreign=false;
  try{await s.importSetupProfile({teacherName:'معلم اصطناعي'});}catch{foreign=true;}p.ownerId=owner;
  const id=window.rakeezBeginNamesBatch(),year=s.activeYear(),status=year.status;
  year.status='archived';const yearDenied=!window.rakeezCheckNamesBatch(id);year.status=status;
  (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('synthetic-expired');
  const leaseDenied=!window.rakeezCheckNamesBatch(id);let profileDenied=false;
  try{await s.importSetupProfile({teacherName:'معلم اصطناعي'});}catch{profileDenied=true;}
  return {foreign,yearDenied,leaseDenied,profileDenied};
 });assert.ok(Object.values(negatives).every(Boolean),JSON.stringify(negatives));
 for(const k of ['profile','sections','teachings','students','enrollments','slots','outbox'])assert.deepEqual((await checkpoint(page))[k],saved[k],k);
 record('setup_owner_year_lease_denial','Actual imported-profile path rejects foreign profile owner and expired lease; current batch rejects archived year/expired lease. Durable Product data and outbox unchanged.');
 // Existing server Delete cannot name a subjectless section: preserve evidence, no fabricated deletion.
 const sql=await fs.readFile('supabase/migrations/20261007230123_n77_server_validated_delete.sql','utf8');
 assert.match(sql,/where owner_id=v_owner and id=p_teaching_id and section_id=v_section.id/);
 result.checks.push({name:'subjectless_guarded_delete',status:'NOT_RUN',evidence:'Existing server n77_delete_teaching requires an existing teaching ID (migration lines 41,69–71); legacy deleteSection is fail-closed. No permitted section-delete service exists in affected source; no real deletion or synthetic success claim.'});
 assert.ok(result.externalRequests.every(u=>u==='https://xlrubcwjqktzzunrvuns.supabase.co/auth/v1/user'));
 record('network_isolation','All requests are served from owned local fixture or aborted. Reload boot auth attempt was blocked before reaching network; no school/service access.');
 result.status='PARTIAL';
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.unrouteAll({behavior:'ignoreErrors'});await context?.close();if(server?.listening)await new Promise(r=>server.close(r));if(temp){assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}if(leased)result.release=lease('release');result.cleanup='Owned synthetic browser/profile/server closed; owned shared browser lease released';await fs.writeFile(out+'/journey.json',JSON.stringify(result,null,2)+'\n');}
