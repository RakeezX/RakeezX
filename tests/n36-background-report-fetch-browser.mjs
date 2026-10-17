// AI: actual installed MV3 toolbar action and external app modules; all school requests intercepted.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import http from 'node:http';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const root=process.cwd(),out=path.resolve('test-results/n36-background-report-fetch');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-background-report-fetch-and-save-journey-20261017.json',runId='435d507d-d423-48ff-bd40-c5ab56358a91';
const lease=action=>{for(let attempt=0;;attempt++){try{return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();}catch(e){if(attempt>=2||!String(e.stderr).includes('being used by another process'))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}}};
const baseline=process.env.N36_BASELINE==='1',evidence={runId,baseline,checks:[],externalRequests:[],errors:[]};
const origin='https://schools.madrasati.sa',A='a'.repeat(32),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
const app='https://rakeezx.com';let server,service=syntheticService(),baseURL,scenario='full303';
let context,temp,leased=false,timer,rosterPresent=false,clockInstalled=false,activeRequests=0,maxRequests=0;const reportNavigations=[];

const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',word=n=>[Math.floor(n/(alphabet.length**2)),Math.floor(n/alphabet.length)%alphabet.length,n%alphabet.length].map(i=>alphabet[i]).join('');
const multiReport=i=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+String(i+1).repeat(32);
const group=i=>'فصل '+i%10;
function html(u){
 if(u.pathname.startsWith('/SchoolSchedule/'))return '<p>جدول غير ظاهر</p>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<a href="'+students+'">قائمة الطلاب</a>';
 const n=Number(u.searchParams.get('page')||1),total=7;
 if(u.pathname.startsWith('/SchoolManagmentReports/')){
  const next=n<total?'<a rel=next href="'+report+'?page='+(n+1)+'">التالي</a>':'<button disabled>التالي</button>';
  const all=Array.from({length:total},(_,i)=>i+1).filter(i=>i!==n).map(i=>'<a href="'+report+'?page='+i+'">'+i+'</a>').join('');
  const rows=Array.from({length:50},(_,j)=>{const i=(n-1)*50+j;return '<tr><td>طالب اصطناعي '+word(i)+'</td><td>مستمر</td><td>'+(scenario==='schoolChanged'&&n===2?'مدرسة أخرى':'مدرسة اصطناعية')+'</td><td>'+group(i)+'</td><td>ignored@example.invalid</td><td>private-account</td><td>private-phone</td><td>private-guardian</td><td>private-contact</td></tr>';}).join('');
  const headers=['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'];
  const negative=n===2?({roleChanged:'<span data-role>مدير المدرسة</span>',auth:'<form><input type=password></form>',schema:'<table><tr><th>بنية أخرى</th></tr></table>'}[scenario]??''):'';
  if(negative&&scenario!=='roleChanged')return negative;
  const links=n===1&&['unsafe','foreignSchool','unsafeQuery'].includes(scenario)?'<a rel=next href="'+({unsafe:'https://unvisited.invalid/report?page=2',foreignSchool:report.replace(A,'b'.repeat(32))+'?page=2',unsafeQuery:report+'?page=2&token=forbidden'}[scenario])+'">التالي</a>':all+next;
  return negative+'<nav class=pagination><span aria-current=page>'+(scenario==='repeatedPage'&&n===2?1:n)+'</span><span role=status>الصفحة '+(scenario==='repeatedPage'&&n===2?1:n)+' من '+(scenario==='conflictingTotal'&&n===2?8:total)+'</span>'+links+'</nav><table><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+rows+'</table>';
 }
 return '<nav><a href="'+report+'">قائمة الطلاب</a><a href="'+students+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>';
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



const checkpoint=page=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
async function setup(page,fresh=true){
 await openReadyServedDemo(page,app);
 if(fresh)await page.evaluate(async()=>{const {accountWorkspaceDatabaseName}=await import('/src/lib/workspaces.js');const name=await accountWorkspaceDatabaseName('a7300000-0000-4000-8000-000000000001');await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=j;});});
 const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
 assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
}
async function mapReview(page,section='n73-source-section'){
 await page.locator('[data-act="n36-extension-review"]').waitFor();await page.waitForURL(url=>!url.hash.includes('handoff='));
 await page.locator('[data-existing-class]').selectOption('n73-source');
 await page.locator('[data-act="n36-extension-review"]').click();await page.locator('.n36-receiver').waitFor();
 const maps=page.locator('[data-import-map="classes"]');
 const count=await maps.count();assert.equal(count,1);
 for(let n=0;n<count;n++) await maps.nth(n).selectOption(section);
 await page.locator('[data-names-target]').selectOption(section.replace('-section',''));
 await page.locator('[data-names-review]').click();await page.locator('[data-names-preview]').waitFor();
 assert.equal(await page.locator('[data-import-plan]').isVisible(),false);assert.equal(await page.locator('[data-import-export]').isVisible(),false);
}
try{
 await fs.mkdir(out,{recursive:true});evidence.lease=lease('acquire');leased=true;
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));baseURL='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-052-'));const extension=path.join(temp,'extension');await fs.mkdir(extension);
 const files=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+'0.5.6'+'.zip'));
 const {createHash}=await import('node:crypto');const runtimeHashes=Object.fromEntries(Object.entries(files).filter(([n])=>!n.startsWith('vendor/')).map(([n,v])=>[n,createHash('sha256').update(v).digest('hex')]));
 for(const [name,data] of Object.entries(files)){const file=path.join(extension,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--enable-unsafe-extension-debugging','--enable-extension-targets']});
 timer=setTimeout(()=>context.close().catch(()=>{}),600000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:baseURL+u.pathname+u.search})});if(u.origin==='https://unvisited.invalid'){(evidence.blockedExternal??=[]).push(u.origin);return route.abort();}if(u.origin===origin){assert.equal(route.request().method(),'GET');evidence.sourceGets=(evidence.sourceGets??0)+1;
   if(u.pathname.startsWith('/SchoolManagmentReports/')){
    if(route.request().isNavigationRequest())reportNavigations.push(u.pathname);
    activeRequests++;
    const n=Number(u.searchParams.get('page')||1);
    try{
     if(scenario==='network'&&n===2)return await route.abort('failed');
     if(scenario==='redirect'&&n===2)return await route.fulfill({status:302,headers:{location:origin+'/Account/Login'}});
     if(scenario==='contentType'&&n===2)return await route.fulfill({contentType:'application/json',body:'{}'});
     await new Promise(r=>setTimeout(r,scenario==='timeout'&&n===2?8500:scenario==='cancel'||scenario==='context'?900:120+(8-n)*30));
     return await route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});
    }catch{}finally{activeRequests--;}
    return;
   }
   return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});}evidence.externalRequests.push(u.origin);return route.abort();});
 const liveRequests=new Set();context.on('request',r=>{if(r.url().startsWith(origin+report)){liveRequests.add(r);maxRequests=Math.max(maxRequests,liveRequests.size);}});for(const event of ['requestfinished','requestfailed'])context.on(event,r=>liveRequests.delete(r));
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}window.countHistory=[];new MutationObserver(()=>{const n=document.getElementById('run-counts');if(n&&window.countHistory.at(-1)!==n.textContent)window.countHistory.push(n.textContent);}).observe(document,{subtree:true,childList:true,characterData:true});});

 evidence.sourceHashes=runtimeHashes;evidence.scenarios=[];evidence.priorFailures=[];
 const previous=JSON.parse(await fs.readFile('tests/n36-background-report-fetch-browser.json','utf8').catch(()=>'{}'));evidence.priorFailures=[...(previous.priorFailures??[]),...(previous.failure?[previous.failure]:[])];evidence.preservedFailures=[...(previous.preservedFailures??[]),...(previous.receiptFailure?[{stage:previous.stage,failure:previous.failure,receiptFailure:previous.receiptFailure,archiveSha256:previous.archiveSha256}]:[])];
 evidence.appHashes=Object.fromEntries(await Promise.all(['src/views/teacher-setup-import.js','src/views/class-import-center.js','src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js'].map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
 const sameLogic=previous.sourceHashes&&Object.entries(runtimeHashes).filter(([name])=>name.endsWith('.js')).every(([name,sha])=>previous.sourceHashes[name]===sha)&&JSON.stringify(previous.appHashes)===JSON.stringify(evidence.appHashes);
 if(process.env.N36_ONLY&&sameLogic){evidence.scenarios=previous.scenarios.filter(s=>!process.env.N36_ONLY.split(',').includes(s.scenario));evidence.reusedEvidence={archiveSha256:previous.archiveSha256,sourceHashes:previous.sourceHashes,reason:'Identical JavaScript transport, parser, continuation, receipt and app sources. Only diagnostic HTML placement and redundant-copy CSS changed; current actual DOM inspected in owner scenario.'};}
 evidence.archiveSha256=createHash('sha256').update(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.6.zip')).digest('hex');
 const cases=['full350','auth','redirect','contentType','schema','roleChanged','unsafe','foreignSchool','unsafeQuery','schoolChanged','repeatedPage','conflictingTotal','network','timeout','cancel','context','expiry','owner','lease','retry','lostReceipt'];
 for(scenario of cases.filter(s=>!process.env.N36_ONLY||process.env.N36_ONLY.split(',').includes(s))){
  evidence.stage=scenario;const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
  const waiting=context.waitForEvent('page');await startFrom(cdp,id,source);const runner=await waiting;
  if(['cancel','context'].includes(scenario)){
   const deadline=Date.now()+5000;while(!activeRequests&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert.ok(activeRequests>0,'cancel/context occurs with an outstanding report GET');
   await runner.locator('#run-status').filter({hasText:'أسماء الطلاب'}).waitFor();
   if(scenario==='cancel')await runner.locator('#run-cancel').click();else await source.goto(origin+'/Account/Login');
  }
  await runner.locator('#run-status').filter({hasText:/(?:اكتمل الجمع|توقف|غير مكتمل|لم يثبت|انتهى جمع)/}).waitFor({timeout:22000});
  evidence.lastSource={status:await runner.locator('#run-status').innerText(),counts:await runner.locator('#run-counts').innerText(),diagnostic:await runner.locator('#route-diagnostic').inputValue()};console.log(evidence.lastSource);if(!['cancel','context'].includes(scenario))assert.ok(!evidence.lastSource.status.startsWith('توقف'),evidence.lastSource.status);
  const blocked=['cancel','context'].includes(scenario);
  if(blocked){
   assert.equal(await runner.locator('#source-class-review').count(),0);assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
  }else if(['auth','redirect','contentType','schema','roleChanged','unsafe','foreignSchool','unsafeQuery','schoolChanged','repeatedPage','conflictingTotal','network','timeout'].includes(scenario)){
   assert.match(await runner.locator('#source-coverage').innerText(),/تعذر/);
   const observed=await runner.evaluate(()=>window.n36HandoffSource?.());
   const options=await runner.locator('#source-class-select option').count();assert.equal(options,11);
   const count=await runner.locator('#run-counts').innerText();assert.match(count,new RegExp(['unsafe','foreignSchool','unsafeQuery'].includes(scenario)?'50':'300'));
   assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
   evidence.scenarios.push({scenario,partial:true,counts:count});
  }else{
   let transferred=0,added=0,batches=0,fresh=true,dbBefore=null,dbAfter=null,stopEarly=false;
   for(let window=0;window<50;window++){
    await runner.locator('#source-class-select').waitFor();
    const options=await runner.locator('#source-class-select option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
    for(const label of options){
     await runner.locator('#source-class-select').selectOption(label);console.log('REVIEW '+scenario+' '+label);
     while(await runner.locator('#source-class-names li').count()){
      const count=await runner.locator('#source-class-names li').count();assert.ok(count>0&&count<=300);
      if(['full350','owner'].includes(scenario)&&batches===0){await runner.setViewportSize({width:445,height:900});const layout=await runner.evaluate(()=>({rtl:getComputedStyle(document.body).direction,overflow:document.documentElement.scrollWidth>innerWidth+1}));assert.equal(layout.rtl,'rtl');assert.equal(layout.overflow,false);await runner.screenshot({path:path.join(out,'extension-445.png')});evidence.extensionLayout=layout;}
      assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
      const partial=await runner.locator('#partial-approval').isVisible();
      if(partial){
       await runner.locator('#partial-approval').uncheck();
       await runner.locator('#bundle-review').click();assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);await runner.locator('#partial-approval').check();
      }
      await runner.locator('#bundle-review').check();assert.equal(await runner.locator('#handoff-transfer').isEnabled(),true,await runner.locator('#category-status').innerText()+' | '+JSON.stringify(await runner.evaluate(()=>window.n36HandoffSource())));
      if(scenario==='sourceClosed'){await source.close();await runner.locator('#run-status').filter({hasText:'SOURCE_CLOSED'}).waitFor();assert.equal(await runner.locator('#source-class-review').count(),0);stopEarly=true;break;}
      if(scenario==='expiry'){
       await runner.clock.install();await runner.clock.fastForward(300000);await runner.locator('#run-status').filter({hasText:'انتهت مهلة'}).waitFor();assert.equal(await runner.locator('#source-class-review').count(),0);assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);await runner.clock.setSystemTime(new Date());await runner.clock.resume();stopEarly=true;break;
      }
      if(scenario==='full350'&&batches===0){for(const width of [320,390,768,1280]){await runner.setViewportSize({width,height:1000});assert.equal(await runner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await runner.screenshot({path:path.join(out,'source-'+width+'.png')});}}
      const wait=context.waitForEvent('page');await runner.locator('#handoff-transfer').click();const receiver=await wait;await receiver.waitForURL(app+'/**');
      const hash=new URL(receiver.url()).hash,nonce=new URLSearchParams(hash.split('?')[1]).get('handoff');assert.doesNotMatch(hash,/طالب|فصل|name/);
      assert.doesNotMatch(JSON.stringify(await worker.evaluate(()=>chrome.storage.session.get(null))),/طالب|فصل/);
      assert.equal(await runner.locator('#source-class-select').isDisabled(),true);assert.equal(await runner.locator('#source-continue').isDisabled(),true);
      const foreign=await context.newPage();await foreign.goto(app+'/#/classes');const denied=await foreign.evaluate(({id,nonce,count})=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-outcome',nonce,outcome:{status:'saved',added:count,existing:0,remaining:0,total:count}},r)),{id,nonce,count});assert.equal(denied.ok,false);await foreign.close();
      await setup(receiver,fresh);fresh=false;await receiver.evaluate(hash=>location.hash=hash,hash);
      await receiver.locator('[data-act="n36-extension-review"]').waitFor();
      const before=await checkpoint(receiver);dbBefore??=before;
      const classNumber=label==='فصل واحد'?0:Number(label.split(' ').at(-1));const section=['n73-source-section','n73-target-section','n73-second-section'][classNumber%3];
      await mapReview(receiver,section);if(scenario==='full350'&&batches===0){await receiver.setViewportSize({width:390,height:900});const layout=await receiver.locator('.sheet__body').evaluate(el=>({rtl:getComputedStyle(el).direction,overflow:el.scrollWidth>el.clientWidth+1}));assert.equal(layout.rtl,'rtl');assert.equal(layout.overflow,false);await receiver.screenshot({path:path.join(out,'receiver-390.png')});}
      assert.deepEqual(await checkpoint(receiver),before,'preview must never write');assert.equal(await receiver.locator('[data-names-confirm]').isDisabled(),true);
      const repeat=await receiver.evaluate(({id,nonce})=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)),{id,nonce});assert.equal(repeat.ok,false);
      if(['owner','lease'].includes(scenario)){
       if(scenario==='owner')await receiver.evaluate(async()=>{await(await import('/src/lib/cloud.js')).setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-other'});});
       else await receiver.evaluate(async()=>(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('expired'));
       await receiver.locator('.n36-receiver').waitFor({state:'detached'});assert.deepEqual(await checkpoint(receiver),before);assert.equal(await runner.locator('#source-continue').isDisabled(),true);await receiver.close();stopEarly=true;break;
      }
      if(scenario==='lostReceipt'&&batches===0)await receiver.evaluate(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(...args)=>{if(args[1]?.type==='n36-outcome'){args[2]?.({ok:false});return;}return send(...args);};});
      if(scenario==='retry'&&batches===0){
       // The real DB boundary fails the actual UI transaction, not an engine-only imitation.
       await receiver.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite'&&(Array.isArray(names)?names:[names]).includes('students'))throw Error('Synthetic names storage failure');return original.call(this,names,mode,...rest);};window.restoreTransaction=()=>{IDBDatabase.prototype.transaction=original;};});
      }
      await receiver.locator('[data-names-approved]').check();await receiver.locator('[data-names-confirm]').click();await receiver.locator('[data-names-receipt]').waitFor();
      const after=await checkpoint(receiver);dbAfter=after;
      for(const key of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k)))assert.deepEqual(after[key],before[key],key);
      if(['retry','lostReceipt'].includes(scenario)&&batches===0){
       if(scenario==='retry')assert.deepEqual(after,before);else{assert.equal(after.students.length-before.students.length,count);added+=count;}if(scenario==='retry')await runner.locator('#handoff-status').filter({hasText:'لم يصل إيصال حفظ مؤكد'}).waitFor();assert.equal(await runner.locator('#source-continue').isDisabled(),true);
       await receiver.close();await runner.locator('#source-retry').click();assert.equal(await runner.locator('#source-class-names li').count(),count);batches++;continue;
      }
      try{await runner.locator('#handoff-status').filter({hasText:'وصل إيصال ركيز'}).waitFor({timeout:15000});}catch(error){evidence.receiptFailure={scenario,batches,count,receiver:await receiver.locator('[data-names-receipt]').innerText(),source:await runner.locator('#handoff-status').innerText(),records:await worker.evaluate(()=>chrome.storage.session.get(null))};throw error;}
      assert.equal(after.students.length-before.students.length,scenario==='lostReceipt'&&batches===1?0:count);
      transferred+=count;added+=after.students.length-before.students.length;batches++;
      await receiver.close();
     }
     if(['retry','lostReceipt'].includes(scenario)&&batches>=2){stopEarly=true;break;}
     if(stopEarly)break;
    }
    if(stopEarly)break;
    if(await runner.locator('#source-continue').isVisible()){
     assert.equal(await runner.locator('#source-continue').isEnabled(),true);await runner.locator('#source-continue').click();
     await runner.waitForFunction(()=>!document.querySelector('#source-class-review')||!document.querySelector('#source-continue')?.disabled||document.querySelector('#source-class-select')?.value==='');
     await runner.locator('#run-status').filter({hasText:/(?:اكتمل الجمع|غير مكتمل|انتهى جمع)/}).waitFor({timeout:22000});
     if(!await runner.locator('#source-class-select').count())break;
    }else break;
   }
   if(!stopEarly){
    const expected=['full50','full299','full300','full301','full303','full350','full1000','full1251','single350','single1251'].includes(scenario)?Number(/\d+/.exec(scenario)[0]):null;
    if(expected!==null)assert.equal(transferred,expected,'no silent tail loss');
    const partialExpected={nonterminal:350,missingLast:300,missingMiddle:100,duplicate:343,invalid:343,hidden:343,unsafe:50,retry:350,lostReceipt:350}[scenario];if(partialExpected!==undefined)assert.equal(transferred,partialExpected,'safe available subset retained with exact known exclusions');
    assert.equal(dbAfter.students.length-dbBefore.students.length,added);
   }
   evidence.scenarios.push({scenario,transferred,added,batches,stoppedByGuard:stopEarly});
  }
  const diagnostic=await runner.locator('#route-diagnostic').inputValue();assert.doesNotMatch(diagnostic,/طالب|فصل|SchoolId|https:/);
  assert.deepEqual(await worker.evaluate(()=>chrome.storage.local.get(null)),{});assert.deepEqual(await worker.evaluate(()=>chrome.storage.sync.get(null)),{});
  if(blocked)evidence.scenarios.push({scenario,blocked:true});console.log('PASS '+scenario);await runner.close();await source.close();const drained=Date.now()+10000;while(activeRequests&&Date.now()<drained)await new Promise(r=>setTimeout(r,30));assert.equal(activeRequests,0,'all owned fixture requests drained');
 }
 evidence.maxParallel=maxRequests;assert.deepEqual(reportNavigations,[]);assert.ok(maxRequests>=2&&maxRequests<=3,'bounded parallel source reads');evidence.maxParallel=maxRequests;evidence.reportNavigations=reportNavigations;assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.requiredScenarios=cases;evidence.coverageComplete=cases.every(name=>evidence.scenarios.some(s=>s.scenario===name));evidence.status=evidence.coverageComplete?'PASS':'PARTIAL';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(server)await new Promise(r=>server.close(r));if(temp){const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(resolved,{recursive:true,force:true});}if(leased)evidence.release=lease('release');evidence.cleanup='Owned disposable Chrome/profile and server closed; browser lease released';await fs.mkdir(out,{recursive:true});await fs.writeFile('tests/n36-background-report-fetch-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,failure:evidence.failure,scenarios:evidence.scenarios?.length}));}
