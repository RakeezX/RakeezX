// AI: installed MV3 + actual application DOM/store/CSS; synthetic intercepted origins only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {owner,foreignOwner} from './n36-receiver-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=process.cwd(),out=path.resolve('test-results/n36-extension-direct-handoff');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-extension-direct-handoff-20261017.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1',runId='497e1df2-e2b3-41ad-ad35-dcedcd168ae5';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const evidence={runId,synthetic:true,checks:[],externalRequests:[],errors:[],officialAccount:'NOT_RUN',production:'NOT_RUN'};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
const origin='https://schools.madrasati.sa',app='https://rakeezx.com',A='a'.repeat(32),R='c'.repeat(32),S='مدرسة اصطناعية ألف';
const baseline=false;
let context,temp,timer,server,scenario='full',service,leased=false;const hits=[];
function reset(){service=syntheticService();service.current.students[0].name='طالب ألف';service.current.subjects[0].name='علوم تجريبية';service.current.sections[0].name='خامس ألف';service.current.sections[1].name='خامس باء';service.current.sections[2].name='خامس جيم';service.current.enrollments=[{id:'synthetic-enrollment',studentId:'n73-student1',sectionId:'n73-source-section',ownerId:owner,status:'active',deleted:false}];}
const report=n=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+R+(n?'?page='+n:''),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
function dash(){return '<nav><a href="'+students+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>'+S+'</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>';}
function pager(page,bottom=false){const li=(v,c='')=>'<li class="page-item '+c+'">'+v+'</li>',svg='<svg><path></path></svg>',a=(n,v)=>'<a class="page-link rounded" href="'+report(n)+'">'+v+'</a>';let active=page;if(scenario==='currentConflict'&&bottom)active=page===1?2:1;let next=page+1;if(scenario==='nextConflict'&&bottom||scenario==='missingMiddle')next=page+2;
 const window=bottom?[...new Set([page,page+1,7])].filter(n=>n<=7):[1,2,3,4,5,6,7];
 return '<div class=duplicate-wrapper><div class=pagination><ul class=pagination '+(scenario==='totalConflict'&&bottom?'data-total-pages=6':'')+'>'+li(page===1?'<a>'+svg+'</a>':a(page-1,svg),page===1?'disabled':'')+window.filter(n=>scenario!=='missingMiddle'||n!==page+1).map(n=>n===page?li('<a class=page-link>'+active+'</a><span class=sr-only>(current)</span>','active'):li(a(n,n===6?'...':n))).join('')+li(page===7?'<a class=page-link>'+svg+'</a>':a(next,svg),page===7?'disabled':'')+'</ul></div></div>';}
function roster(page){const names=['ألف','باء','جيم','دال','هاء','واو','زاي'],name='طالب '+names[scenario==='repeatResponse'?0:page-1];let bottom=pager(page,true);if(scenario==='scopeChanged')bottom=bottom.replace('?page=2','?page=2&classId=OTHER');if(scenario==='externalPager')bottom=bottom.replace('href="/SchoolManagmentReports','href="https://unvisited.invalid/SchoolManagmentReports');return (baseline?'':'<nav><a href="/Help/2">2</a></nav>')+pager(page)+'<table><tr><th>اسم الطالب</th><th>المدرسة</th><th>الفصل</th><th>الجوال</th></tr><tr><td class=project-title>'+name+'</td><td>'+S+'</td><td>'+(page===7?'خامس باء':'خامس ألف')+'</td><td>PRIVATE_PHONE</td></tr></table>'+bottom;}
function timetable(){const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],periods=['الأولى','الثانية','الثالثة','الرابعة'];return '<table><tr><th></th>'+periods.map(p=>'<th>الحصة '+p+'</th>').join('')+'</tr>'+days.map(day=>'<tr><td>'+day+'</td>'+periods.map(()=>'<td><a href="/Lesson/Prepare/NEVER"><div class="schedule-card done"><div class=title><i>زخرفة</i><h2>الرياضيات</h2></div><small>أول أ</small></div></a></td>').join('')+'</tr>').join('')+'</table>';}
function html(u){
 if(scenario==='missingRole')return '<h1>صفحة اصطناعية بلا دور مؤكد</h1>';
 if(u.pathname.startsWith('/SchoolManagmentReports/'))return roster(Number(u.searchParams.get('page')||1));
 if(u.pathname.startsWith('/SchoolSchedule/'))return timetable();
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return (['sidebar','full','missingReport','unsafeReport'].includes(scenario)?'<nav><a href="'+students+'">قائمة الطلاب</a><a href="/Help/Students">بيانات الطلاب</a></nav>':'')+(scenario==='missingReport'?'':scenario==='unsafeReport'?'<a href="/Teacher/Delete">بيانات الطلاب</a>':'<section><a href="'+report()+'">بيانات الطلاب</a>'+(baseline?'':'<a href="'+report(1)+'">بيانات الطلاب</a>')+'</section>');
 if(u.pathname.includes('ChangeUserType'))return '<script>location.replace("/SchoolManagment/Actions/Teacher/'+A+'")</script>';
 if(u.pathname.startsWith('/SchoolManagment/Actions/Teacher/')){if(['settle','full','neverSettle','loginWait','adminWait','schoolWait','cancelWait'].includes(scenario)){const later=scenario==='loginWait'?'<h1>تسجيل الدخول</h1>':scenario==='adminWait'?'<p role=status>الدور: مدير المدرسة</p>':scenario==='schoolWait'?'<p class=school-name>مدرسة أخرى</p>':dash();return '<div id=intermediate>انتقال</div>'+(scenario==='neverSettle'?'':'<script>setTimeout(()=>document.getElementById("intermediate").outerHTML='+JSON.stringify(later)+',1200)</script>');}return dash();}
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
 await fs.mkdir(out,{recursive:true});evidence.lease=lease('acquire');leased=true;
 reset();
 server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-direct-'));let extension=path.join(root,'extensions/rakeez-teacher-import-helper');if(process.env.N36_DEVICE2){const original=extension;extension=path.join(temp,'unpacked-device-two');await fs.cp(original,extension,{recursive:true});}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{...(process.env.N36_BROWSER==='chrome155'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{channel:'chromium'}),headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',timezoneId:'Asia/Riyadh',args:process.env.N36_BROWSER==='chrome155'?['--enable-unsafe-extension-debugging','--enable-extension-targets']:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 timer=setTimeout(()=>context.close().catch(()=>{}),300000);timer.unref();
 evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.protocol==='chrome-extension:')return route.continue();
  if(u.origin===app){return route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})});}
  if([origin,'https://noor.moe.gov.sa'].includes(u.origin)){
   hits.push({origin:u.origin,path:u.pathname,method:req.method(),page:Number(u.searchParams.get('page')||1)});
   const body=u.origin===origin?html(u):'<h1>تقرير ظاهر اصطناعي</h1><table><tr><th>اسم الطالب</th><th>هوية</th><th>الهاتف</th><th>درجة</th></tr><tr><td>طالب ألف</td><td>PRIVATE_ID</td><td>PRIVATE_PHONE</td><td>99</td></tr><tr><td>طالب جديد</td><td>PRIVATE_ID</td><td>PRIVATE_PHONE</td><td>88</td></tr></table><p>صفحة واحدة ظاهرة؛ صفحات أخرى غير مجمّعة</p>';
   return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden}</style>'+body+'</html>'});
  }
  evidence.externalRequests.push(req.url());return route.abort('blockedbyclient');
 });
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}});
 context.on('page',page=>page.on('pageerror',error=>evidence.errors.push(error.message)));
 const cdp=await context.browser().newBrowserCDPSession();
 if(process.env.N36_BROWSER==='chrome155'){evidence.load=await cdp.send('Extensions.loadUnpacked',{path:extension});console.log('Fresh Chrome155 extension installed',JSON.stringify(evidence.load));evidence.targets=(await cdp.send('Target.getTargets')).targetInfos.map(t=>({type:t.type,url:t.url}));}
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).hostname;
 assert.match(id,/^[a-p]{32}$/);evidence.extensionId=id;if(process.env.N36_DEVICE2){const prior=JSON.parse(await fs.readFile(path.join(out,'evidence-155.0.8059.80.json'),'utf8'));assert.notEqual(id,prior.extensionId);record('different_unpacked_device_ID','New owned unpacked path produces a different runtime ID; full handoff below uses that actual ID without hardcoding.');}
 for(const [mode,width] of (['guards','offline'].includes(process.env.N36_PHASE)?[]:process.env.N36_NOOR1280_FINAL?[['noor',1280]]:process.env.N36_DEVICE2?[['noor',390]]:process.env.N36_MADRASATI_FINAL?[['madrasati',320],['madrasati',768]]:[['madrasati',320],['noor',390],['madrasati',768],['noor',1280]])){
  evidence.stage=mode+'-'+width;reset();scenario='full';const beforeHits=hits.length,{source,runner}=await launch(id,cdp,mode);
  assert.equal(await runner.locator('[data-category="students"] fieldset').count(),mode==='noor'?2:7);
  const page=await transfer(runner);const transportURL=page.url();assert.doesNotMatch(transportURL,/طالب|PRIVATE|%D8|token/i);
  await runner.close(); // Dismissing the extension UI after transfer cannot lose the session envelope.
  await setup(page);await page.setViewportSize({width,height:1000});
  await page.evaluate(hash=>{location.hash=hash;},new URL(transportURL).hash);
  await page.locator('[data-act="n36-extension-review"]').waitFor();
  for(const mainWidth of (process.env.N36_DEVICE2?[320,390,768,1280]:[width])){
   await page.setViewportSize({width:mainWidth,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:path.join(out,'primary-'+mainWidth+'.png'),fullPage:true});
  }
  await page.setViewportSize({width,height:1000});
  const before=await checkpoint(page);await mapReview(page);
  assert.deepEqual(await checkpoint(page),before);assert.equal(await page.locator('[data-names-confirm]').isDisabled(),true);
  const bounds=await page.locator('.sheet__body').evaluate(el=>({rtl:getComputedStyle(el).direction,overflow:el.scrollWidth>el.clientWidth+1}));
  assert.equal(bounds.rtl,'rtl');assert.equal(bounds.overflow,false);
  await page.screenshot({path:path.join(out,mode+'-'+width+'-review.png')});
  await page.locator('[data-names-approved]').check();await page.locator('[data-names-confirm]').click();await page.locator('[data-names-receipt]').waitFor();
  const after=await checkpoint(page);assert.equal(after.students.length,before.students.length+(mode==='noor'?1:5));assert.equal(after.enrollments.length,before.enrollments.length+(mode==='noor'?1:5));
  assert.ok(after.outbox.every(r=>r.ownerId===owner));
  for(const k of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k)))assert.deepEqual(after[k],before[k],k);
  assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
  const other=await context.newPage();await other.goto(transportURL);
  const replay=await other.evaluate(({id,nonce})=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)),{id,nonce:new URLSearchParams(new URL(transportURL).hash.split('?')[1]).get('handoff')});assert.equal(replay.ok,false);await other.close();
  assert.ok(hits.slice(beforeHits).every(h=>h.method==='GET'&&!/Lesson|Delete/.test(h.path)));
  record(mode+'_installed_to_actual_owner_confirm_RTL_'+width,'Real installed popup click, bounded selected names, no URL PII, popup dismissal, same-browser one-time claim, actual account guard + store explicit checkbox/commit, isolated synthetic data/outbox only; RTL no overflow.');
  await page.close();await source.close();
 }

 if(process.env.N36_PHASE==='guards'){
  if(!process.env.N36_BRIDGE_ONLY){
  for(scenario of ['currentConflict','nextConflict','totalConflict','repeatResponse','missingRole','cancelWait']){
   evidence.stage='source-'+scenario;const {source,runner}=await launch(id,cdp);
   if(scenario==='cancelWait'){await runner.locator('#run-cancel').click();await runner.locator('#run-status').filter({hasText:'CANCELLED'}).waitFor();}
   assert.equal(await runner.locator('[data-category="students"] fieldset').count(),0);
   assert.equal(await runner.locator('#handoff-transfer').isEnabled(),false);
   assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
   record('source_'+scenario,'Installed 0.4.5 route/role/settle/pagination guard retained: no unresolved students can transfer.');await runner.close();await source.close();
  }
  scenario='noSelection';{
   const {source,runner}=await launch(id,cdp,'noor');assert.equal(await runner.locator('[data-category="students"] fieldset').count(),0);record('noor_missing_selection','Explicit selected visible header is required.');await runner.close();await source.close();
  }
  scenario='full';{
   const source=await context.newPage();await source.goto('https://noor.moe.gov.sa/Noor/VisibleReport');const status=await startFrom(cdp,id,source,'noor',false);assert.match(status,/TEACHER_CONFIRMATION_REQUIRED/);record('noor_missing_role','Teacher declaration required before any selected-column read or runner creation.');await source.close();
  }
  }
  if(!process.env.N36_SKIP_SOURCE_SWITCH){
   const {source,runner}=await launch(id,cdp,'noor');await source.goto('https://noor.moe.gov.sa/Noor/OtherReport');await runner.locator('#bundle-review').check();await runner.locator('#handoff-transfer').click();await runner.locator('#handoff-status').filter({hasText:'تعذّر النقل'}).waitFor();assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});record('source_tab_route_switch','Source binding is rechecked at transfer; same-origin route switch cannot transfer stale selected report.');await runner.close();await source.close();
  }
  for(const failure of ['foreign-tab','expired','transport-cancel','concurrent','owner','lease','snapshot','teaching','app-cancel'].filter(f=>!process.env.N36_CASES||process.env.N36_CASES.split(',').includes(f))){
   evidence.stage='bridge-'+failure;reset();scenario='full';const {source,runner}=await launch(id,cdp,'noor');const page=await transfer(runner),url=page.url();
   const nonce=new URLSearchParams(new URL(url).hash.split('?')[1]).get('handoff');
   if(failure==='foreign-tab'){
    const foreign=await context.newPage();await foreign.goto(app+'/#/classes');const denied=await foreign.evaluate(({id,nonce})=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)),{id,nonce});assert.equal(denied.ok,false);assert.equal(Object.keys(await worker.evaluate(()=>chrome.storage.session.get(null))).length,1);await foreign.close();
   }
   if(failure==='concurrent'){const results=await page.evaluate(({id,nonce})=>Promise.all([1,2].map(()=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)))),{id,nonce});assert.deepEqual(results.map(r=>r.ok),[true,false]);}
   if(failure==='expired')await worker.evaluate(async nonce=>{const k='handoff:'+nonce,r=(await chrome.storage.session.get(k))[k];r.envelope.createdAt-=121000;r.envelope.expiresAt-=121000;await chrome.storage.session.set({[k]:r});},nonce);
   if(failure==='transport-cancel'){await runner.locator('#handoff-cancel').click();await runner.locator('#handoff-status').filter({hasText:'أُلغي'}).waitFor();await page.waitForTimeout(100);}
   await setup(page);await page.evaluate(hash=>{location.hash=hash;},new URL(url).hash);
   if(['expired','transport-cancel','concurrent'].includes(failure)){
    await page.locator('[data-n36-handoff-status]').filter({hasText:'تعذّر النقل'}).waitFor();assert.equal(await page.locator('[data-act="n36-extension-review"]').count(),0);
   }else{
    await page.locator('[data-act="n36-extension-review"]').waitFor();const before=await checkpoint(page);
    if(failure==='app-cancel'){await page.locator('[data-act="n36-extension-cancel"]').click();assert.equal(await page.locator('[data-act="n36-extension-review"]').count(),0);}
    else{
     await mapReview(page);
     if(failure==='owner')await page.evaluate(async id=>(await import('/src/lib/cloud.js')).setMockAuth({id},{user:{id},access_token:'other'}),foreignOwner);
     else if(failure==='lease')await page.evaluate(async()=>(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('expired'));
     else if(failure==='snapshot'){await page.evaluate(async()=>(await import('/src/store.js')).state.subjects[0].name='تغيير');await page.locator('[data-names-approved]').click();}
     else if(failure==='teaching'){await page.locator('[data-existing-class]').selectOption('n73-target',{force:true});}
     else if(failure==='foreign-tab'){await page.locator('[data-sheet-close]').last().click();}
     await page.locator('.n36-receiver').waitFor({state:'detached'});
    }
    assert.deepEqual(await checkpoint(page),before,'guard must not write');
   }
   assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
   record('bridge_'+failure,'Actual installed transport + app owner/store entry: invalid/cancelled/stale preview cannot write; session envelope removed.');await page.close();await runner.close();await source.close();
  }
  if(!process.env.N36_CASES){
  // Alarm-based deletion is independent of whether a page ever claims.
  reset();const {source,runner}=await launch(id,cdp,'noor');const page=await transfer(runner);const nonce=new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('handoff');
  await worker.evaluate(nonce=>chrome.alarms.create('handoff:'+nonce,{when:Date.now()+100}),nonce);await page.waitForTimeout(1200);assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});record('alarm_expiry_without_claim','Actual Chrome alarm removes the abandoned private session envelope.');await page.close();await runner.close();await source.close();
  }
 }

 if(process.env.N36_PHASE==='offline'){
  const offline=await context.browser().newContext({serviceWorkers:'allow',viewport:{width:390,height:900}});
  try{
   await offline.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
   await offline.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await offline.newPage();await openReadyServedDemo(page,base);
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const files=['/src/lib/n36-extension-handoff.js','/src/lib/n36-extension-protocol.js','/src/views/class-import-center.js'];
   await page.waitForFunction(async files=>(await Promise.all(files.map(p=>caches.match(location.origin+p)))).every(Boolean),files);
   await offline.setOffline(true);await page.reload();await page.locator('.boot').waitFor({state:'detached'});
   const boot=await page.evaluate(async()=>{const s=await import('/src/store.js');const h=await import('/src/lib/n36-extension-handoff.js');return {ready:s.state.ready,type:s.getActiveWorkspace()?.type,noRequest:h.handoffRequest('#/classes/koshoof'),layout:!!document.querySelector('.layout')};});
   assert.deepEqual(boot,{ready:true,type:'demo',noRequest:null,layout:true});
   record('actual_offline_shell_reload','Real SW cached new startup graph; fresh offline reload boots actual Demo document and imports handoff adapter. No live-account/offline Sync claim.');
  }finally{await offline.close();}
 }
 assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);
 evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;await fs.writeFile(path.join(out,'failure-'+Date.now()+'.json'),JSON.stringify(evidence,null,2));process.exitCode=1;console.error(error);}
finally{
 clearTimeout(timer);await context?.close();if(server?.listening)await new Promise(r=>server.close(r));
 if(temp){assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}
 if(leased)evidence.release=lease('release');evidence.hits=hits;evidence.cleanup='Owned disposable browser/profile/server closed; browser lease released';
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await fs.writeFile('tests/n36-extension-direct-handoff-browser.json',JSON.stringify(evidence,null,2));await fs.writeFile(path.join(out,'evidence-'+evidence.browser+'-'+(process.env.N36_PHASE??'positive')+'-'+(process.env.N36_NOOR1280_FINAL?'noor1280-final':process.env.N36_CASES?'cases-'+process.env.N36_CASES:process.env.N36_BRIDGE_ONLY?'bridge':process.env.N36_DEVICE2?'device2':process.env.N36_MADRASATI_FINAL?'madrasati-final':'full')+'.json'),JSON.stringify(evidence,null,2));
}
