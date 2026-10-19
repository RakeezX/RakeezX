// AI: bounded synthetic installed extension → actual guarded receiver/store. No school extraction.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const root=process.cwd(),out=path.resolve('tests/n36-actual-1719'),app='https://rakeezx.com',school='https://schools.madrasati.sa',schoolId='a'.repeat(32);
const sourceURL=school+'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+schoolId+'?page=1';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-saved-roster-visible-clean-helper-20261019.json',runId='efd53688-e0dd-4cd4-9621-d2f0570487c7';
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
 const rows=['ألف','باء'].map(n=>({name:'طالب '+n,classroom:'خامس 1'}));
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

 await stage(rows);
 await runner.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:30000});
 const saved=await checkpoint(page);
 assert.equal(saved.sections.length,1);assert.equal(saved.students.length,2);assert.equal(saved.enrollments.length,2);
 assert.equal(saved.teachings.length,0);assert.equal(saved.device[0].n36NamesBatch.pending,null);
 assert.equal(saved.outbox.length,5);assert.ok(saved.outbox.every(r=>r.ownerId===readyOwner));
 record('actual_extension_local_save','Two fabricated names / one class: actual encrypted extension transport, receiver ownership guard and store transaction; five pending commands, zero remote ACKs, local receipt arithmetic 2 new + 0 existing.');
 await page.goto(app+'/#/classes');await page.waitForTimeout(300);
 assert.equal(await page.locator('.class-card').count(),0);
 await page.screenshot({path:out+'/saved-but-hidden.png',fullPage:true});
 result.checks.push({name:'saved_roster_immediately_visible',status:'FAIL',evidence:'Actual #/classes DOM has zero class cards despite same-owner/year persisted section + two students + two enrollments. No teaching exists: list projects teachings only.'});
 // A fresh document must establish its own owner, DB, receipt and readback.
 await page.reload();await page.waitForLoadState('domcontentloaded');
 await page.evaluate(async()=>{await(await import('/tests/n36-actual-1719/restore.mjs')).restore();});
 const restored=await page.evaluate(async()=>{const s=await import('/src/store.js');s.assertClassImportAccess();return {workspace:s.getActiveWorkspace(),year:s.activeYear().id,term:s.activeTerm().id,receipt:s.state.device.accountProvisioningReceipt,data:await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()};});
 assert.equal(restored.workspace.authUserId,readyOwner);assert.equal(restored.receipt.ownerId,readyOwner);
 assert.equal(restored.year,saved.sections[0].yearId);assert.equal(restored.term,saved.device[0].activeTermId);
 for(const k of ['sections','students','enrollments','outbox','teachings'])assert.deepEqual(restored.data[k],saved[k],k);
 assert.equal(await page.locator('.class-card').count(),0);
 record('reload_same_owner_durable_roster_pending_ack','Fresh document re-established actual ownership/provisioning/lease guards; same IDs and five unchanged outbox commands survive reload, still no server ACK.');
 result.checks.push({name:'saved_roster_visible_after_reload',status:'FAIL',evidence:'Actual classes DOM still has zero class cards after fresh same-owner/year readback; saved identities remain intact.'});
 await page.goto(app+'/#/classes/koshoof?import=1');await page.waitForFunction(()=>typeof window.rakeezBeginNamesBatch==='function');
 await runner.reload();await runner.waitForFunction(()=>!!window.n36BeforeExport);await stage(rows);
 await runner.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:30000});
 const retry=await checkpoint(page);for(const k of ['sections','students','enrollments','outbox','teachings'])assert.deepEqual(retry[k],saved[k],k);
 record('retry_preserves_ids','Retry completed source uses existing same-owner/year names: zero duplicate records/commands, unchanged IDs.');
 await runner.screenshot({path:out+'/compact-runner.png',fullPage:true});
 assert.equal(await runner.locator('#legacy-tools').getAttribute('open'),null);assert.equal(await runner.locator('#safe-diagnostics').getAttribute('open'),null);
 assert.equal(await runner.locator('#noor-controls').isVisible(),false);
 assert.equal(await runner.locator('#copy-safe-report').isVisible(),false);
 assert.match(await runner.locator('#run-status').innerText(),/المزامنة لم تتأكد/);
 assert.doesNotMatch(await runner.locator('body').innerText(),/استُبعد 0/);
 record('compact_actual_runner','Actual extension run DOM/CSS: diagnostics/manual tools collapsed, Noor contextual, no zero-excluded failure, local-save status distinct from remote Sync.');
 const beforeDenial=await checkpoint(page);await page.evaluate(async()=>{(await import('/src/lib/cloud.js')).session.user.id='b7300000-0000-4000-8000-000000000002';});
 assert.equal(await page.evaluate(()=>{try{window.rakeezBeginNamesBatch();return false;}catch{return true;}}),true);
 assert.deepEqual(await checkpoint(page),beforeDenial);record('wrong_owner_failclosed','Real receiver entry rejects wrong session owner, complete DB unchanged.');
 result.status='BLOCKED';result.blocker='Missing allowedPaths src/views/teachings.js and src/views/class-import-center.js: section-only roster visibility and versioned website link live there.';
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(server?.listening)await new Promise(r=>server.close(r));if(temp){assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}if(leased)result.release=lease('release');result.cleanup='Owned synthetic browser/profile/server closed; owned shared browser lease released';await fs.writeFile(out+'/journey.json',JSON.stringify(result,null,2)+'\n');}
