// AI: installed MV3 + actual application DOM/store/CSS; synthetic intercepted origins only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {owner,foreignOwner} from './n36-receiver-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=process.cwd(),out=path.resolve('test-results/n36-review-1400-transfer');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-actual-transfer-local-update-copy-20261019.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1',runId='fe5829e6-1f04-4655-a82a-ca7cedcf3934';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const evidence={runId,synthetic:true,checks:[],externalRequests:[],errors:[],officialAccount:'NOT_RUN',production:'NOT_RUN'};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const origin='https://schools.madrasati.sa',app='https://rakeezx.com',A='a'.repeat(32),R='a'.repeat(32),S='مدرسة اصطناعية ألف';
const baseline=false;
let context,temp,timer,server,scenario='full',service,leased=false;const hits=[];
function reset(){service=syntheticService();service.current.students[0].name='طالب ألف';service.current.subjects[0].name='علوم تجريبية';service.current.sections[0].name='خامس ألف';service.current.sections[1].name='خامس باء';service.current.sections[2].name='خامس جيم';service.current.enrollments=[{id:'synthetic-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',ownerId:owner,status:'active',deleted:false}];}
const report=n=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+R+(n?'?page='+n:''),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
function dash(){return '<nav><a href="'+students+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>'+S+'</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>';}
function pager(page,bottom=false){const li=(v,c='')=>'<li class="page-item '+c+'">'+v+'</li>',svg='<svg><path></path></svg>',a=(n,v)=>'<a class="page-link rounded" href="'+report(n)+'">'+v+'</a>';let active=page;if(scenario==='currentConflict'&&bottom)active=page===1?2:1;let next=page+1;if(scenario==='nextConflict'&&bottom||scenario==='missingMiddle')next=page+2;
 const window=bottom?[...new Set([page,page+1,2])].filter(n=>n<=2):[1,2];
 return '<div class=duplicate-wrapper><div class=pagination><ul class=pagination '+(scenario==='totalConflict'&&bottom?'data-total-pages=6':'')+'>'+li(page===1?'<a>'+svg+'</a>':a(page-1,svg),page===1?'disabled':'')+window.filter(n=>scenario!=='missingMiddle'||n!==page+1).map(n=>n===page?li('<a class=page-link>'+active+'</a><span class=sr-only>(current)</span>','active'):li(a(n,n===6?'...':n))).join('')+li(page===2?'<a class=page-link>'+svg+'</a>':a(next,svg),'')+'</ul></div></div>';}
function roster(page){const names=['ألف','باء','جيم','دال','هاء','واو','زاي'],name='طالب '+names[scenario==='repeatResponse'?0:page-1];let bottom=pager(page,true);if(scenario==='scopeChanged')bottom=bottom.replace('?page=2','?page=2&classId=OTHER');if(scenario==='externalPager')bottom=bottom.replace('href="/SchoolManagmentReports','href="https://unvisited.invalid/SchoolManagmentReports');return (baseline?'':'<nav><a href="/Help/2">2</a></nav>')+pager(page)+'<table><tr><th>اسم الطالب</th><th>حالة الطالب</th><th>المدرسة</th><th>الفصل</th><th>البريد الإلكتروني</th><th>حساب الطالب</th><th>الجوال</th><th>ولي الأمر</th><th>جوال ولي الأمر</th></tr><tr><td class=project-title>'+name+'</td><td>مستمر</td><td>'+S+'</td><td>'+(page===2?'خامس باء':'خامس ألف')+'</td><td>private@example.invalid</td><td>private-account</td><td>PRIVATE_PHONE</td><td>private-guardian</td><td>private-contact</td></tr></table>'+bottom;}
function timetable(){const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],periods=['الأولى','الثانية','الثالثة','الرابعة'];return '<table><tr><th></th>'+periods.map(p=>'<th>الحصة '+p+'</th>').join('')+'</tr>'+days.map(day=>'<tr><td>'+day+'</td>'+periods.map(()=>'<td><a href="/Lesson/Prepare/NEVER"><div class="schedule-card done"><div class=title><i>زخرفة</i><h2>الرياضيات</h2></div><small>أول أ</small></div></a></td>').join('')+'</tr>').join('')+'</table>';}
function html(u){
 if(scenario==='missingRole')return '<h1>صفحة اصطناعية بلا دور مؤكد</h1>';
 if(u.pathname.startsWith('/SchoolManagmentReports/'))return roster(Number(u.searchParams.get('page')||1));
 if(u.pathname.startsWith('/SchoolSchedule/'))return timetable();
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return (['sidebar','full','missingReport','unsafeReport'].includes(scenario)?'<nav><a href="'+students+'">قائمة الطلاب</a><a href="/Help/Students">بيانات الطلاب</a></nav>':'')+(scenario==='missingReport'?'':scenario==='unsafeReport'?'<a href="/Teacher/Delete">بيانات الطلاب</a>':'<section><a href="'+report()+'">بيانات الطلاب</a>'+(baseline?'':'<a href="'+report(1)+'">بيانات الطلاب</a>')+'</section>');
 if(u.pathname.includes('ChangeUserType'))return '<script>location.replace("/SchoolManagment/Actions/Teacher/'+A+'")</script>';
 if(u.pathname.startsWith('/SchoolManagment/Actions/Teacher/')){if(['settle','full','neverSettle','loginWait','adminWait','schoolWait','cancelWait'].includes(scenario)){const later=scenario==='loginWait'?'<h1>تسجيل الدخول</h1>':scenario==='adminWait'?'<p role=status>الدور: مدير المدرسة</p>':scenario==='schoolWait'?'<p class=school-name>مدرسة أخرى</p>':dash();return '<div id=intermediate>انتقال</div>'+(scenario==='neverSettle'?'':'<script>setTimeout(()=>document.getElementById("intermediate").outerHTML='+JSON.stringify(later)+',9200)</script>');}return dash();}
 if(['sidebar','windows','currentConflict','nextConflict','totalConflict','missingMiddle','repeatResponse','scopeChanged','externalPager','missingReport','unsafeReport'].includes(scenario))return dash();
 return '<div><h5>'+S+'</h5><p>الدور: معلم</p><p>قادة المدرسة: قائد اصطناعي</p><a href="/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+A+'?Name='+encodeURIComponent(S)+'">الصفحة الرئيسية</a></div>';
}
async function startFrom(cdp,id,source,mode="madrasati",role=true){
 await source.bringToFront();const targets=await cdp.send('Target.getTargets',{filter:[{type:'tab'},{exclude:true}]});const target=targets.targetInfos.find(t=>t.url===source.url());const before=new Set((await cdp.send('Target.getTargets')).targetInfos.map(t=>t.targetId));
 await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});let popup;const until=Date.now()+5000;while(!popup&&Date.now()<until){popup=(await cdp.send('Target.getTargets')).targetInfos.find(t=>!before.has(t.targetId)&&t.url==='chrome-extension://'+id+'/popup.html');if(!popup)await new Promise(r=>setTimeout(r,40));}assert.ok(popup);
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:popup.targetId,flatten:false});let seq=0;const pending=new Map();const receive=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(pending.has(m.id)){const [resolve,reject]=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}};cdp.on('Target.receivedMessageFromTarget',receive);
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,[resolve,reject]);cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:n,method,params})}).catch(reject);});
 try{
  let ready=false;const until=Date.now()+5000;while(!ready&&Date.now()<until){const r=await send('Runtime.evaluate',{expression:"!!document.querySelector('#one-start')&&!document.querySelector('#one-start').disabled",returnByValue:true});ready=r.result.value;if(!ready)await new Promise(r=>setTimeout(r,40));}assert.ok(ready);
  if(mode==="noor") await send("Runtime.evaluate",{expression:"document.querySelector('#noor-class').value='خامس ألف';document.querySelector('#noor-role').checked="+role});
  await send("Runtime.evaluate",{expression:"document.querySelector('"+(mode==="noor"?"#noor-start":"#one-start")+"').scrollIntoView({block:'center'})"});
  const {result}=await send('Runtime.evaluate',{expression:"(()=>{const r=document.querySelector('"+(mode==="noor"?"#noor-start":"#one-start")+"').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",returnByValue:true});await send('Input.dispatchMouseEvent',{type:'mousePressed',...result.value,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...result.value,button:'left',clickCount:1});
  if(mode==='noor'&&!role){await new Promise(r=>setTimeout(r,100));return (await send('Runtime.evaluate',{expression:"document.querySelector('#run-status').textContent",returnByValue:true})).result.value;}
 }finally{cdp.off('Target.receivedMessageFromTarget',receive);}
}

const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
async function setup(page){
 await openReadyServedDemo(page,app);
 await page.evaluate(async()=>{const {accountWorkspaceDatabaseName}=await import('/src/lib/workspaces.js');const name=await accountWorkspaceDatabaseName('a7300000-0000-4000-8000-000000000001');await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=j;});});
 const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
 assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
}
async function launch(id,cdp,mode='madrasati'){
 const source=await context.newPage();await source.goto(mode==='noor'?'https://noor.moe.gov.sa/Noor/VisibleReport':origin+'/Dashboards/Schools');
 if(mode==='noor'&&scenario!=='noSelection')await source.locator('th').first().evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
 const wait=context.waitForEvent('page');
 await startFrom(cdp,id,source,mode);const runner=await wait;await runner.waitForLoadState('domcontentloaded');
 await runner.locator('#run-status').filter({hasText:mode==='noor'?(scenario==='noSelection'?'CANCELLED':'كشف جزئي'):scenario==='full'?'اكتمل الجمع':scenario==='cancelWait'?'انتظار':/(?:توقف|جمع جزئي غير مكتمل)/}).waitFor({timeout:18000});
 return {source,runner};
}
async function transfer(runner){
 await runner.locator('#bundle-review').check();assert.equal(await runner.locator('#handoff-transfer').isEnabled(),true);
 const wait=context.waitForEvent('page');
 await runner.locator('#handoff-transfer').click();const page=await wait;
 await page.waitForURL(app+'/**');await page.waitForLoadState('domcontentloaded');
 return page;
}
async function mapReview(page){
 await page.locator('[data-existing-class]').selectOption('n73-source');
 await page.locator('[data-act="n36-extension-review"]').click();await page.locator('.n36-receiver').waitFor();
 const maps=page.locator('[data-import-map="classes"]');
 const count=await maps.count();assert.ok(count>=1);
 for(let n=0;n<count;n++) await maps.nth(n).selectOption(['n73-source-section','n73-target-section'][n]);
 await page.locator('[data-names-target]').selectOption('n73-source');
 await page.locator('[data-names-review]').click();await page.locator('[data-names-preview]').waitFor();
 assert.equal(await page.locator('[data-import-plan]').isVisible(),false);assert.equal(await page.locator('[data-import-export]').isVisible(),false);
}

try{
 await fs.mkdir(out,{recursive:true});evidence.lease=lease('acquire');leased=true;reset();scenario='full';
 server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-1019-'));
 const extension=path.join(root,'extensions/rakeez-teacher-import-helper');
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 timer=setTimeout(()=>context.close().catch(()=>{}),180000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.protocol==='chrome-extension:')return route.continue();
  if(u.origin===app)return route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})});
  if(u.origin===origin){hits.push({path:u.pathname,method:route.request().method()});return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden}</style>'+html(u)+'</html>'});}
  evidence.externalRequests.push(route.request().url());return route.abort();
 });
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}});
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).hostname;
 await worker.evaluate(()=>{globalThis.__n36Boundary=[];chrome.runtime.onMessageExternal.addListener((m,s)=>{__n36Boundary.push({type:m.type,senderHasNonce:!!s.url?.includes('handoff='),origin:s.origin,document:!!s.documentId});});});
 const cdp=await context.browser().newBrowserCDPSession();
 const page=await context.newPage();await setup(page);const before=await checkpoint(page);
 await page.evaluate(()=>{window.__n36Transport=[];const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(id,m,cb)=>send(id,m,r=>{__n36Transport.push({type:m.type,ok:r?.ok,code:r?.code});cb(r);});});
 let runner,send;
 if(!process.env.N36_GUARDS_ONLY){
 const initialPages=context.pages().length,source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
 const runWait=context.waitForEvent('page');await startFrom(cdp,id,source);runner=await runWait;
 await Promise.race([runner.waitForFunction(()=>/اكتمل استيراد الأسماء المتاحة|افتح حساب ركيز|تعذّرت القراءة|فصول لم يتأكد/.test(document.querySelector('#run-status')?.textContent),null,{timeout:60000}),page.locator('[data-n36-handoff-status]').filter({hasText:'تعذّر النقل'}).waitFor({timeout:60000}).then(()=>{throw Error('ACTUAL_HANDOFF_FAILED');})]);
 assert.match(await runner.locator('#run-status').innerText(),/اكتمل استيراد الأسماء المتاحة/);
 const after=await checkpoint(page);
 assert.equal(after.students.length,before.students.length+1);assert.equal(after.enrollments.length,before.enrollments.length+1);
 for(const k of Object.keys(before).filter(k=>!['students','enrollments','outbox','device'].includes(k)))assert.deepEqual(after[k],before[k],k);
 assert.equal(Object.keys(after.device[0].n36NamesBatch.receipts).length,2);assert.equal(after.device[0].n36NamesBatch.pending,null);
 assert.equal(context.pages().filter(p=>p.url().startsWith(app)).length,1);
 assert.equal(context.pages().length,initialPages+2,'only source and owned runner added');
 assert.equal(await runner.locator('#partial-approval').isVisible(),false);
 record('n36_one_explicit_start_all_available_classes_existing_rakeez_receiver_ack','One installed popup Start → slow 9.2s gateway → two real parser report pages/classes → same already-open authenticated app → real guarded canonical names commit/readback, 2 durable receipts; one existing name/ID retained, one new; no class/review/save clicks or extra app tabs. Grades/history unchanged.');
 await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:path.join(out,'receiver.png'),fullPage:true});await runner.screenshot({path:path.join(out,'runner.png'),fullPage:true});
 }
 assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);if(context){const w=context.serviceWorkers()[0];evidence.boundary=await w?.evaluate(()=>globalThis.__n36Boundary);evidence.transport=await context.pages().find(p=>p.url().startsWith(app))?.evaluate(()=>window.__n36Transport);console.error(evidence.boundary,evidence.transport);}if(context)for(const p of context.pages())console.error(p.url(),await p.locator('body').innerText().catch(()=>''));}
finally{
 clearTimeout(timer);await context?.close();if(server?.listening)await new Promise(r=>server.close(r));
 if(temp){assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}
 if(leased)evidence.release=lease('release');evidence.hits=hits;evidence.cleanup=leased?'Owned browser/profile/server closed; shared lease released':'Browser lease not acquired; no browser/server started';
 await fs.mkdir(out,{recursive:true});const previous=JSON.parse(await fs.readFile('tests/n36-review-1400-transfer.json','utf8').catch(()=>'{}'));evidence.preservedFailures=[...(previous.preservedFailures??[]),...(previous.failure?[previous.failure]:[])];
 await fs.writeFile('tests/n36-review-1400-transfer.json',JSON.stringify(evidence,null,2)+'\n');
}
