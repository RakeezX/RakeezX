// AI: actual installed MV3 toolbar action and external app modules; all school requests intercepted.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import http from 'node:http';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const root=process.cwd(),out=path.resolve('test-results/n36-300-then-zero');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-300-students-final-zero-20261017.json',runId='caf47a23-74be-4246-9c28-be2a91d8a2b4';
const lease=action=>{for(let attempt=0;;attempt++){try{return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();}catch(e){if(attempt>=2||!String(e.stderr).includes('being used by another process'))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}}};
const baseline=process.env.N36_BASELINE==='1',evidence={runId,baseline,checks:[],externalRequests:[],errors:[]};
const origin='https://schools.madrasati.sa',A='a'.repeat(32),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
const app='https://rakeezx.com';let server,service=syntheticService(),baseURL,scenario='partial';
let context,temp,leased=false,timer,rosterPresent=false,clockInstalled=false;
function timetable(){const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],periods=['الأولى','الثانية','الثالثة','الرابعة'];return '<table><tr><th></th>'+periods.map(p=>'<th>الحصة '+p+'</th>').join('')+'</tr>'+days.map(day=>'<tr><td>'+day+'</td>'+periods.map(()=>'<td><a href="/Lesson/Prepare/NEVER"><div class="schedule-card done"><div class=title><i>زخرفة</i><h2>الرياضيات</h2></div><small>أول أ</small></div></a></td>').join('')+'</tr>').join('')+'</table>';}

const report=i=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+String.fromCharCode(98+i).repeat(32);
const word=n=>String.fromCharCode(0x620+Math.floor(n/25))+String.fromCharCode(0x620+n%25);
function paged(u){
 if(u.pathname.startsWith('/SchoolSchedule/'))return timetable();
 if(scenario==='selfKnown'&&u.pathname==='/SchoolManagment/Actions/MyStudents')return '<a href="'+students+'">قائمة الطلاب</a><a href="'+report(0)+'">أسماء الطلاب</a>';
 const n=Number(u.searchParams.get('page')||1),count=scenario==='full299'?299:scenario==='overflow301'?301:scenario==='overflow350'?350:300,total=Math.ceil(count/50);
 if(u.pathname.startsWith('/SchoolManagmentReports/')){
  const current=scenario==='repeat'?1:n,number=scenario==='ambiguous'?n+1:n;
  const pager='<nav class=pagination><span aria-current=page>'+number+'</span><span role=status>الصفحة '+n+' من '+total+'</span>'+(n<total&&!(scenario==='missingPage'&&n===5)?'<a rel=next href="'+report(0)+'?page='+(n+1)+'">التالي</a>':['missingLast','missingPage'].includes(scenario)?'':'<button disabled>التالي</button>')+'</nav>';
  const rows=scenario==='empty'?'':Array.from({length:Math.min(50,count-(n-1)*50)},(_,j)=>'<tr><td>طالب اصطناعي '+word((current-1)*50+(scenario==='duplicate'&&j===1?0:j))+'</td><td>خامس '+word(scenario==='duplicate'&&j===1?0:j%2)+'</td></tr>').join('');
  return (scenario==='schoolChanged'&&n===2?'<p class=school-name>مدرسة أخرى</p>':'')+(scenario==='roleChanged'&&n===2?'<span data-role>مدير المدرسة</span>':'')+pager+'<table><tr><th>اسم الطالب</th><th>الفصل</th></tr>'+rows+'</table>';
 }
 return '<nav><a href="'+report(0)+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>'+(scenario==='selfKnown'?'<span data-role>معلم</span><a href="'+students+'">أسماء الطلاب</a>':'');
}
function html(u){
 if(scenario!=='partial'){if(u.pathname.startsWith('/SchoolManagmentReports/')&&u.searchParams.get('page')==='2'&&['originChanged','sessionChanged'].includes(scenario))return '<script>location.replace('+JSON.stringify(scenario==='originChanged'?'https://unvisited.invalid/':'/Account/Login')+')</script>';return paged(u);}
 if(u.pathname.startsWith('/SchoolSchedule/'))return timetable();
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<a href="'+students+'">أسماء الطلاب</a><a href="'+students+'">قائمة الطلاب</a>'+'<iframe></iframe>'.repeat(3);
 if(u.pathname.startsWith('/SchoolManagmentReports/')){const i=u.pathname.charCodeAt(u.pathname.lastIndexOf('/')+1)-98;return '<section><h2>قائمة الطلاب</h2><nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr><th>اسم الطالب</th><th>الفصل</th></tr>'+Array.from({length:50},(_,j)=>'<tr><td>طالب اصطناعي '+word(i*50+j)+'</td><td>خامس '+word(i)+'</td></tr>').join('')+'</table></section>';}
 if(u.pathname.startsWith('/TeachersReports/'))return '<table><tr><th>الفصل</th></tr><tr hidden><td>PRIVATE_HIDDEN</td></tr></table>';
 return '<nav><a href="'+report(0)+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><p>قادة المدرسة: قائد اصطناعي</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>'+Array.from({length:2},(_,i)=>'<a href="/TeachersReports/MyInfo/synthetic'+i+'">بياناتي</a>').join('')+Array.from({length:6},(_,i)=>'<a href="'+report(i)+'">أسماء الطلاب</a>').join('')+'<a href="'+students+'">قائمة الطلاب</a>';
}
async function startFrom(cdp,id,source,mode="madrasati",role=true){
 await source.bringToFront();const targets=await cdp.send('Target.getTargets',{filter:[{type:'tab'},{exclude:true}]});const target=targets.targetInfos.find(t=>t.url===source.url());const before=new Set((await cdp.send('Target.getTargets')).targetInfos.map(t=>t.targetId));
 await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});let popup;const until=Date.now()+5000;while(!popup&&Date.now()<until){popup=(await cdp.send('Target.getTargets')).targetInfos.find(t=>!before.has(t.targetId)&&t.url==='chrome-extension://'+id+'/popup.html');if(!popup)await new Promise(r=>setTimeout(r,40));}assert.ok(popup);
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:popup.targetId,flatten:false});let seq=0;const pending=new Map();const receive=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(pending.has(m.id)){const [resolve,reject]=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}};cdp.on('Target.receivedMessageFromTarget',receive);
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,[resolve,reject]);cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:n,method,params})}).catch(reject);});
 try{
  let ready=false;const until=Date.now()+5000;while(!ready&&Date.now()<until){const r=await send('Runtime.evaluate',{expression:"!!document.querySelector('#one-start')&&!document.querySelector('#one-start').disabled",returnByValue:true});ready=r.result.value;if(!ready)await new Promise(r=>setTimeout(r,40));}assert.ok(ready);
  evidence.sourceEntry=(await send('Runtime.evaluate',{expression:`(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},files:['route-diagnostics.js']});const {readAutomaticTeacherPage}=await import(chrome.runtime.getURL('selection.js'));return (await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:readAutomaticTeacherPage,args:['home']}))[0].result.entry;})()`,awaitPromise:true,returnByValue:true})).result.value;
  evidence.popup=(await send('Runtime.evaluate',{expression:"JSON.stringify({width:innerWidth,body:document.body.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,height:innerHeight})",returnByValue:true})).result.value;
  if(mode==="noor") await send("Runtime.evaluate",{expression:"document.querySelector('#noor-class').value='خامس ألف';document.querySelector('#noor-role').checked="+role});
  await send("Runtime.evaluate",{expression:"document.querySelector('"+(mode==="noor"?"#noor-start":"#one-start")+"').scrollIntoView({block:'center'})"});
  const {result}=await send('Runtime.evaluate',{expression:"(()=>{const r=document.querySelector('"+(mode==="noor"?"#noor-start":"#one-start")+"').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",returnByValue:true});await send('Input.dispatchMouseEvent',{type:'mousePressed',...result.value,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...result.value,button:'left',clickCount:1});
  if(mode==='noor'&&!role){await new Promise(r=>setTimeout(r,100));return (await send('Runtime.evaluate',{expression:"document.querySelector('#run-status').textContent",returnByValue:true})).result.value;}
 }finally{cdp.off('Target.receivedMessageFromTarget',receive);}
}



async function instrumentDeadline(page){await page.evaluate(()=>{const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>{if(delay>299000&&delay<=300000)window.__reviewDeadline=Date.now()+delay;return original(fn,delay,...args);};});}
async function expire(page){
 if(!clockInstalled){await page.clock.install();clockInstalled=true;}const remaining=await page.evaluate(()=>window.__reviewDeadline-Date.now());assert.ok(remaining>0&&remaining<=300000,`remaining=${remaining}; captured=${await page.evaluate(()=>window.__reviewDeadline)}`);evidence.deadlineMilliseconds=300000;
 await page.clock.fastForward(remaining-1);assert.ok(await page.locator('#staged-categories input[type=text]').count()>0);
 await page.clock.fastForward(1);await page.locator('#run-status').filter({hasText:baseline?'REVIEW_EXPIRED':'انتهت مهلة معاينة البيانات ومسحت لحمايتك؛ لا توجد أسماء محفوظة'}).waitFor();
 assert.equal(await page.locator('#staged-categories input').count(),0);assert.equal(await page.locator('.flatpickr-calendar').count(),0);assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);assert.equal(await page.evaluate(()=>window.n36HandoffSource()),null);
 evidence.expiry='Values present at deadline - 1ms; scrubbed at deadline, including picker DOM; transfer rejected';
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
 await runner.locator('#run-status').filter({hasText:mode==='noor'?(scenario==='noSelection'?'CANCELLED':'كشف جزئي'):!baseline&&['full','alternate','inline'].includes(scenario)?'اكتمل الجمع':scenario==='cancelWait'?'انتظار':/(?:توقف|جمع جزئي غير مكتمل)/}).waitFor({timeout:18000});
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
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));baseURL='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-052-'));const extension=path.join(temp,'extension');await fs.mkdir(extension);
 const files=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+(baseline?'0.5.1':'0.5.3')+'.zip'));
 const {createHash}=await import('node:crypto');const runtimeHashes=Object.fromEntries(Object.entries(files).filter(([n])=>['run-controller.js','source-adapter.js','categories.js','navigation.js'].includes(n)).map(([n,v])=>[n,createHash('sha256').update(v).digest('hex')]));
 for(const [name,data] of Object.entries(files)){const file=path.join(extension,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--enable-unsafe-extension-debugging','--enable-extension-targets']});
 timer=setTimeout(()=>context.close().catch(()=>{}),300000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:baseURL+u.pathname+u.search})});if(u.origin==='https://unvisited.invalid'){(evidence.blockedExternal??=[]).push(u.origin);return route.abort();}if(u.origin===origin)return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});evidence.externalRequests.push(u.origin);return route.abort();});
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}window.countHistory=[];new MutationObserver(()=>{const n=document.getElementById('run-counts');if(n&&window.countHistory.at(-1)!==n.textContent)window.countHistory.push(n.textContent);}).observe(document,{subtree:true,childList:true,characterData:true});});
 if(!process.env.N36_SCENARIOS_ONLY){
 const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
 assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
 const wait=context.waitForEvent('page');await startFrom(cdp,id,source);const runner=await wait;await instrumentDeadline(runner);
 // Capture initial observed counters in the live document before the metadata chain overwrites the status.
 evidence.initialEntry=await runner.locator('#entry-state').innerText();
 await runner.locator('#run-status').filter({hasText:/(?:جمع جزئي غير مكتمل|توقف)/}).waitFor({timeout:20000});evidence.actualStatus=await runner.locator('#run-status').innerText();
 evidence.counts=await runner.locator('#run-counts').innerText();evidence.warning=await runner.locator('#run-skipped').innerText();evidence.history=await runner.evaluate(()=>window.countHistory);
 assert.ok(evidence.history.some(s=>/10 صفحات؛ 300 طلاب؛ 323 صف/.test(s)),JSON.stringify(evidence.history));
 if(baseline){assert.match(evidence.counts,/11 صفحات.*0 طلاب.*23 صف/);assert.match(evidence.warning,/EMPTY_OR_LIMIT/);}
 else {assert.match(evidence.counts,/300.*مجمّع/);assert.match(evidence.counts,/0.*مكتمل/);}
 assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
 const diagnostic=await runner.locator('#route-diagnostic').inputValue();assert.match(diagnostic,/ROSTER_LINKS_UNAVAILABLE/);assert.match(diagnostic,/MAIN_FRAME_READ_LINK_ABSENT/);assert.match(diagnostic,/iframeCount=3/);
 evidence.diagnostic=diagnostic;
 const {createHash}=await import('node:crypto');evidence.sourceHashes=Object.fromEntries(Object.entries(files).filter(([n])=>['run-controller.js','source-adapter.js','categories.js','navigation.js'].includes(n)).map(([n,v])=>[n,createHash('sha256').update(v).digest('hex')]));
 for(const width of [320,390,768,1280]){await runner.setViewportSize({width,height:1000});if(!baseline)assert.equal(await runner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await runner.screenshot({path:path.join(out,(baseline?'baseline':'candidate')+'-'+width+'.png'),fullPage:true});}
 await expire(runner);await runner.close();await source.close();
 }else{const prior=JSON.parse(await fs.readFile(path.join(out,'candidate.json'),'utf8'));evidence.reusedPartial=prior.reusedPartial??{counts:prior.counts,diagnostic:prior.diagnostic,history:prior.history,expiry:prior.expiry,sourceHashes:prior.sourceHashes};evidence.priorHarnessFailure=prior.failure;assert.deepEqual(evidence.reusedPartial.sourceHashes,runtimeHashes);}
 if(!baseline){
  const prior=JSON.parse(await fs.readFile(path.join(out,'candidate.json'),'utf8').catch(()=>'{}'));evidence.scenarios=[...(prior.scenarios??[])];evidence.ownerPreview=prior.ownerPreview;evidence.exportRoleChangeBlocked=prior.exportRoleChangeBlocked;evidence.priorBlockedExternal=[...new Set([...(prior.priorBlockedExternal??[]),...(prior.externalRequests??[])])];evidence.priorHarnessFailure=prior.failure;evidence.priorFailures=[...(prior.priorFailures??[]),...(prior.failure?[prior.failure]:[])];
  for(scenario of ['full299','full300','overflow301','overflow350','missingLast','missingPage','repeat','duplicate','ambiguous','empty','schoolChanged','roleChanged','originChanged','sessionChanged','selfKnown'].filter(s=>!process.env.N36_ONLY||process.env.N36_ONLY.split(',').includes(s))){
   const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');const next=context.waitForEvent('page');await startFrom(cdp,id,source);const view=await next;
   await view.locator('#run-status').filter({hasText:/(?:اكتمل الجمع|توقف|غير مكتمل|لم يثبت)/}).waitFor({timeout:20000});
   const status=await view.locator('#run-status').innerText(),counts=await view.locator('#run-counts').innerText(),diagnostic=await view.locator('#route-diagnostic').inputValue();
   const full=['full299','full300','selfKnown'].includes(scenario);const n=scenario==='full299'?299:300;
   if(full){assert.equal(await view.locator('[data-category=students] fieldset').count(),n,status);await view.locator('#bundle-review').check();assert.equal(await view.locator('#handoff-transfer').isEnabled(),true);
    if(scenario==='full300'){
     for(const width of [320,390,768,1280]){await view.setViewportSize({width,height:1000});assert.equal(await view.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await view.screenshot({path:path.join(out,'full300-'+width+'.png')});}
     await view.evaluate(async()=>{const {validateHandoff}=await import(chrome.runtime.getURL('handoff-protocol.js'));const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=async m=>{try{validateHandoff(m.envelope);window.envelopeValidation='ok';}catch(e){window.envelopeValidation=e.message;}const r=await send(m);window.sendResult=r;return r;};const before=window.n36BeforeExport;window.n36BeforeExport=async()=>{try{return await before();}catch(e){window.exportError=e.message;throw e;}};});const wait=context.waitForEvent('page',{timeout:10000}).catch(async e=>{throw Error(e.message+' | '+await view.locator('#handoff-status').innerText()+' | '+JSON.stringify(await view.evaluate(()=>({exportError:window.exportError,validation:window.envelopeValidation,result:window.sendResult}))));});await view.locator('#handoff-transfer').click();const receiver=await wait;await receiver.waitForURL(app+'/**');const transportHash=new URL(receiver.url()).hash;await setup(receiver);await receiver.evaluate(hash=>{location.hash=hash;},transportHash);await receiver.locator('[data-existing-class]').waitFor();await mapReview(receiver);
     for(const width of [320,390,768,1280]){await receiver.setViewportSize({width,height:1000});assert.equal(await receiver.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await receiver.screenshot({path:path.join(out,'owner-preview-'+width+'.png'),fullPage:true});}const cp=await checkpoint(receiver);assert.equal(cp.students[0].ownerId,'a7300000-0000-4000-8000-000000000001');assert.equal(await receiver.locator('[data-names-preview]').isVisible(),true);assert.equal(await receiver.locator('[data-names-confirm]').isDisabled(),true);const before=await checkpoint(receiver);await receiver.evaluate(async()=>{const s=await import('/src/store.js');s.assertClassImportAccess();await(await import('/src/lib/cloud.js')).setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-other'});});await receiver.locator('.n36-receiver').waitFor({state:'detached'});assert.deepEqual(await checkpoint(receiver),before);evidence.ownerPreview={rows:300,committed:0,ownerSwitchInvalidates:true,databaseUnchanged:true};await receiver.close();
    }
    if(scenario==='selfKnown'){await source.evaluate(()=>{const role=document.createElement('span');role.dataset.role='';role.textContent='مدير المدرسة';document.body.append(role);});const code=await view.evaluate(async()=>{try{await window.n36BeforeExport();return 'UNEXPECTED_ALLOWED';}catch(e){return e.message;}});assert.equal(code,'NON_TEACHER_ROLE');assert.equal(await view.locator('[data-category=students] fieldset').count(),0);evidence.exportRoleChangeBlocked=true;}
   }else {assert.equal(await view.locator('[data-category=students] fieldset').count(),0,status);assert.equal(await view.locator('#handoff-transfer').isDisabled(),true);if(scenario.startsWith('overflow')){assert.match(diagnostic,/CATEGORY_ROW_LIMIT/);assert.match(counts,/300.*مجمّع/);assert.match(await view.locator('#run-skipped').innerText(),/أكبر من الحد/);}}
   assert.doesNotMatch(diagnostic,/طالب اصطناعي|https:|SchoolId=/);assert.deepEqual(await worker.evaluate(()=>chrome.storage.sync.get(null)),{});evidence.scenarios=evidence.scenarios.filter(r=>r.scenario!==scenario);console.log('PASS scenario '+scenario);evidence.scenarios.push({scenario,status,counts,diagnostic,transferAllowed:full});await view.close();await source.close();
  }
 }
 assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});assert.deepEqual(await worker.evaluate(()=>chrome.storage.local.get(null)),{});assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.checks=['actual toolbar action 10-page staged300 to page11 missing links','11-page/23-other-rows missing roster','RTL 320/390/768/1280 actual DOM/CSS','300000ms expiry at -1ms/0ms','no persistent envelope; new navigation fixture has no external network',...(baseline?[]:['complete 300 owner-bound Preview; no writes; owner-switch invalidation'])];evidence.status='PASS';evidence.runtimeHashes=runtimeHashes;evidence.networkPolicy='All school/app documents synthetic or loopback. No HTTP redirects. Every other request aborted. Prior redirect fixture failure retained separately.';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(server)await new Promise(r=>server.close(r));if(temp)await fs.rm(temp,{recursive:true,force:true});await fs.writeFile(path.join(out,baseline?'baseline.json':'candidate.json'),JSON.stringify(evidence,null,2));if(leased)evidence.release=lease('release');if(!baseline)evidence.baselineEvidence=JSON.parse(await fs.readFile(path.join(out,'baseline.json'),'utf8'));evidence.cleanup='Owned disposable Chrome/profile closed; shared browser lease released';await fs.writeFile(path.join(out,baseline?'baseline.json':'candidate.json'),JSON.stringify(evidence,null,2));if(!baseline)await fs.writeFile('tests/n36-300-then-zero-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
