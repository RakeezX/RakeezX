// AI: actual installed MV3 toolbar action and external app modules; all school requests intercepted.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const root=process.cwd(),out=path.resolve('test-results/n36-popup-052');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-chrome-popup-052-usability-20261017.json',runId='76096272-1655-4c14-8650-af6b87e19381';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const baseline=process.env.N36_BASELINE==='1',evidence={runId,baseline,checks:[],externalRequests:[],errors:[]};
const origin='https://schools.madrasati.sa',A='a'.repeat(32),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
let context,temp,leased=false,timer,rosterPresent=false,clockInstalled=false;
function timetable(){const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],periods=['الأولى','الثانية','الثالثة','الرابعة'];return '<table><tr><th></th>'+periods.map(p=>'<th>الحصة '+p+'</th>').join('')+'</tr>'+days.map(day=>'<tr><td>'+day+'</td>'+periods.map(()=>'<td><a href="/Lesson/Prepare/NEVER"><div class="schedule-card done"><div class=title><i>زخرفة</i><h2>الرياضيات</h2></div><small>أول أ</small></div></a></td>').join('')+'</tr>').join('')+'</table>';}

function html(u){
 if(u.pathname.startsWith('/SchoolSchedule/'))return timetable();
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return rosterPresent?'<section><h2>قائمة الطلاب</h2><nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr><th>اسم الطالب</th><th>الفصل</th></tr><tr><td>طالب اصطناعي</td><td>خامس ألف</td></tr></table></section>':'<iframe></iframe>';
 if(u.pathname.startsWith('/TeachersReports/'))return '<p>تقرير بلا حقول مدعومة</p>';
 return '<nav><a href="'+students+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><p>قادة المدرسة: قائد اصطناعي</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main><iframe></iframe><table><tr><th>اسم الطالب</th><th>الفصل</th></tr><tr hidden><td>PRIVATE_HIDDEN</td><td>PRIVATE_CLASS</td></tr></table>'+Array.from({length:8},(_,i)=>'<a href="/TeachersReports/MyInfo/synthetic'+i+'">بياناتي</a>').join('');
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

try{
 await fs.mkdir(out,{recursive:true});evidence.lease=lease('acquire');leased=true;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-052-'));const extension=path.join(temp,'extension');await fs.mkdir(extension);
 const files=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+(baseline?'0.5.1':'0.5.2')+'.zip'));
 for(const [name,data] of Object.entries(files)){const file=path.join(extension,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--enable-unsafe-extension-debugging','--enable-extension-targets']});
 timer=setTimeout(()=>context.close().catch(()=>{}),120000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===origin)return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});evidence.externalRequests.push(u.origin);return route.abort();});
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
 assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
 const wait=context.waitForEvent('page');await startFrom(cdp,id,source);const runner=await wait;await instrumentDeadline(runner);
 // Capture initial observed counters in the live document before the metadata chain overwrites the status.
 evidence.initialEntry=await runner.locator('#entry-state').innerText();
 await runner.locator('#run-status').filter({hasText:/جمع جزئي غير مكتمل/}).waitFor({timeout:20000});
 evidence.counts=await runner.locator('#run-counts').innerText();evidence.warning=await runner.locator('#run-skipped').innerText();evidence.entry=await runner.locator('#entry-state').innerText();
 assert.match(evidence.counts,/11 صفحات.*0 طلاب.*23 صف/);assert.equal(evidence.sourceEntry.pageKind,'teacher-dashboard');assert.equal(evidence.sourceEntry.iframeCount,1);
 assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
 const popup=JSON.parse(evidence.popup);if(baseline){assert.ok(popup.width<380);assert.equal(await runner.locator('#legacy-tools').getAttribute('open'),'');}else{assert.ok(popup.width>=400&&popup.width<=450);assert.ok(popup.height<=600);assert.equal(await runner.locator('#legacy-tools').getAttribute('open'),null);assert.match(await runner.locator('#legacy-tools summary').first().innerText(),/تفاصيل البيانات الأخرى/);assert.doesNotMatch(evidence.warning,/EMPTY_OR_LIMIT/);}
 evidence.layouts=[];
 for(const width of [320,390,768,1280]){await runner.setViewportSize({width,height:1000});const m=await runner.evaluate(()=>({viewport:innerWidth,body:document.body.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,rtl:document.dir}));evidence.layouts.push(m);if(!baseline){assert.equal(m.rtl,'rtl');assert.ok(m.scroll<=width+1);assert.equal(m.body,Math.min(width,840));}else if(width===1280)assert.equal(m.body,380);await runner.screenshot({path:path.join(out,(baseline?'051':'052')+'-'+width+'.png'),fullPage:true});}
 const diagnostic=await runner.locator('#route-diagnostic').inputValue();assert.match(diagnostic,/MAIN_FRAME_READ_LINK_ABSENT/);assert.match(diagnostic,/iframeCount=1/);assert.doesNotMatch(diagnostic,/PRIVATE|مدرسة اصطناعية|https:|SchoolId=/);
 if(!baseline){
  assert.match(await runner.locator('#review-remaining').innerText(),/\b(?:29[0-9]|300) ثانية/);
  await expire(runner);
  await runner.locator('#run-reopen').click();assert.match(await runner.locator('#run-status').innerText(),/لا قراءة قبل اختيارك/);
 }
 if(baseline)await expire(runner);
 if(!baseline){
  await runner.close();await source.close();rosterPresent=true;
  const source2=await context.newPage();await source2.goto(origin+'/Dashboards/Schools');const next=context.waitForEvent('page');await startFrom(cdp,id,source2);const reviewed=await next;await instrumentDeadline(reviewed);
  await reviewed.locator('#run-status').filter({hasText:/اكتمل الجمع/}).waitFor({timeout:20000});assert.equal(await reviewed.locator('#legacy-tools').getAttribute('open'),'');
  assert.equal(await reviewed.locator('[data-category=students] input[data-field=name][type=text]').inputValue(),'طالب اصطناعي');
  for(const width of [320,390,768,1280]){await reviewed.setViewportSize({width,height:1000});assert.equal(await reviewed.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await reviewed.screenshot({path:path.join(out,'052-students-'+width+'.png')});}
  assert.equal(await reviewed.locator('#handoff-transfer').isDisabled(),true);await reviewed.locator('#bundle-review').check();assert.equal(await reviewed.locator('#handoff-transfer').isEnabled(),true);
  await reviewed.locator('[data-category=students] input[data-field=name][type=text]').fill('طالب معدل');assert.equal(await reviewed.locator('#bundle-review').isChecked(),false);assert.equal(await reviewed.locator('#handoff-transfer').isDisabled(),true);
  assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});await expire(reviewed);evidence.studentReview='Actual inline complete one-page roster visible; explicit confirmation gates transfer; editing invalidates; expiry scrubs student names';
 }
 assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});assert.deepEqual(await worker.evaluate(()=>chrome.storage.local.get(null)),{});assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.checks=['actual toolbar action sizing','11-page/23-other-rows missing roster','RTL 320/390/768/1280 actual DOM/CSS','300000ms expiry at -1ms/0ms','no persistent envelope/external requests',...(baseline?[]:['explicit student review/edit invalidation'])];evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(temp)await fs.rm(temp,{recursive:true,force:true});if(leased)evidence.release=lease('release');if(!baseline)evidence.baseline=JSON.parse(await fs.readFile(path.join(out,'baseline.json'),'utf8'));evidence.cleanup='Owned disposable Chrome/profile closed; shared browser lease released';await fs.writeFile(path.join(out,baseline?'baseline.json':'candidate.json'),JSON.stringify(evidence,null,2));if(!baseline)await fs.writeFile('tests/n36-popup-052-real-feedback-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
