// AI: actual installed MV3 toolbar action and external app modules; all school requests intercepted.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import http from 'node:http';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const root=process.cwd(),out=path.resolve('test-results/n36-madrasati-complete-classes');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-madrasati-complete-class-batches-20261017.json',runId='b249261d-12d5-4295-895f-284258f16903';
const lease=action=>{for(let attempt=0;;attempt++){try{return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();}catch(e){if(attempt>=2||!String(e.stderr).includes('being used by another process'))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}}};
const baseline=process.env.N36_BASELINE==='1',evidence={runId,baseline,checks:[],externalRequests:[],errors:[]};
const origin='https://schools.madrasati.sa',A='a'.repeat(32),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
const app='https://rakeezx.com';let server,service=syntheticService(),baseURL,scenario='full303';
let context,temp,leased=false,timer,rosterPresent=false,clockInstalled=false;

const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'b'.repeat(32);
const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',word=n=>[Math.floor(n/(alphabet.length**2)),Math.floor(n/alphabet.length)%alphabet.length,n%alphabet.length].map(i=>alphabet[i]).join('');
const multiReport=i=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+String(i+1).repeat(32);
const group=i=>['خامس ألف','خامس باء','خامس جيم','خامس دال','خامس هاء'][Math.floor(i/300)];
function html(u){
 if(u.pathname.startsWith('/SchoolSchedule/'))return '<p>جدول غير ظاهر</p>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<a href="'+students+'">أسماء الطلاب</a><a href="'+students+'">قائمة الطلاب</a>';
 if(scenario==='multi303'&&u.pathname.startsWith('/SchoolManagmentReports/')){
  const i=Number(u.pathname.split('/').at(-1)[0])-1;
  return '<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr><th>اسم الطالب</th><th>الفصل</th></tr>'+Array.from({length:Math.min(50,303-i*50)},(_,j)=>'<tr><td>طالب اصطناعي '+word(i*50+j)+'</td><td>'+group(i*50+j)+'</td></tr>').join('')+'</table>';
 }
 const count=scenario==='class301'?350:Number(/\d+/.exec(scenario)?.[0]??350),total=Math.ceil(count/50),n=Number(u.searchParams.get('page')||1);
 if(u.pathname.startsWith('/SchoolManagmentReports/')){
  if(n===2&&['originChanged','sessionChanged'].includes(scenario))return '<script>location.replace('+JSON.stringify(scenario==='originChanged'?'https://unvisited.invalid/':'/Account/Login')+')</script>';
  const cur=scenario==='repeat'?1:n,shown=scenario==='drift'&&n===2?n+1:n;
  const pager='<nav class=pagination><span aria-current=page>'+shown+'</span><span role=status>الصفحة '+n+' من '+total+'</span>'+(n<total&&!((scenario==='missingMiddle'&&n===2)||(scenario==='missingLast'&&n===total-1))?'<a rel=next href="'+report+'?page='+(n+1)+'">التالي</a>':['nonterminal','missingLast','missingMiddle'].includes(scenario)?'':'<button disabled>التالي</button>')+'</nav>';
  const rows=Array.from({length:Math.min(50,count-(n-1)*50)},(_,j)=>{const i=(cur-1)*50+j,idx=scenario==='duplicate'&&j===1?i-1:i;return '<tr><td>طالب اصطناعي '+word(scenario==='sameNames'?idx%300:idx)+'</td><td>'+(scenario==='class301'?(idx<301?'خامس ألف':'خامس باء'):group(idx))+'</td></tr>';}).join('');
  return (scenario==='schoolChanged'&&n===2?'<p class=school-name>مدرسة أخرى</p>':'')+(scenario==='roleChanged'&&n===2?'<span data-role>مدير المدرسة</span>':'')+pager+'<table><tr><th>اسم الطالب</th><th>الفصل</th></tr>'+rows+'</table>';
 }
 return '<nav>'+(scenario==='missingReport'?'':scenario==='multi303'?Array.from({length:7},(_,i)=>'<a href="'+multiReport(i)+'">قائمة الطلاب</a>').join(''):'<a href="'+report+'">قائمة الطلاب</a>')+'<a href="'+students+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><div><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></div></main>';
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
async function setup(page){
 await openReadyServedDemo(page,app);
 await page.evaluate(async()=>{const {accountWorkspaceDatabaseName}=await import('/src/lib/workspaces.js');const name=await accountWorkspaceDatabaseName('a7300000-0000-4000-8000-000000000001');await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=j;});});
 const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
 assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);
}
async function mapReview(page){
 await page.locator('[data-act="n36-extension-review"]').waitFor();await page.waitForURL(url=>!url.hash.includes('handoff='));
 await page.locator('[data-existing-class]').selectOption('n73-source');
 await page.locator('[data-act="n36-extension-review"]').click();await page.locator('.n36-receiver').waitFor();
 const maps=page.locator('[data-import-map="classes"]');
 const count=await maps.count();assert.equal(count,1);
 for(let n=0;n<count;n++) await maps.nth(n).selectOption(['n73-source-section','n73-target-section'][n]);
 await page.locator('[data-names-target]').selectOption('n73-source');
 await page.locator('[data-names-review]').click();await page.locator('[data-names-preview]').waitFor();
 assert.equal(await page.locator('[data-import-plan]').isVisible(),false);assert.equal(await page.locator('[data-import-export]').isVisible(),false);
}
try{
 await fs.mkdir(out,{recursive:true});evidence.lease=lease('acquire');leased=true;
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));return;}const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));baseURL='http://127.0.0.1:'+server.address().port;
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-n36-052-'));const extension=path.join(temp,'extension');await fs.mkdir(extension);
 const files=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+'0.5.4'+'.zip'));
 const {createHash}=await import('node:crypto');const runtimeHashes=Object.fromEntries(Object.entries(files).filter(([n])=>!n.startsWith('vendor/')).map(([n,v])=>[n,createHash('sha256').update(v).digest('hex')]));
 for(const [name,data] of Object.entries(files)){const file=path.join(extension,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--enable-unsafe-extension-debugging','--enable-extension-targets']});
 timer=setTimeout(()=>context.close().catch(()=>{}),600000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:baseURL+u.pathname+u.search})});if(u.origin==='https://unvisited.invalid'){(evidence.blockedExternal??=[]).push(u.origin);return route.abort();}if(u.origin===origin){assert.equal(route.request().method(),'GET');evidence.sourceGets=(evidence.sourceGets??0)+1;return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});}evidence.externalRequests.push(u.origin);return route.abort();});
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}window.countHistory=[];new MutationObserver(()=>{const n=document.getElementById('run-counts');if(n&&window.countHistory.at(-1)!==n.textContent)window.countHistory.push(n.textContent);}).observe(document,{subtree:true,childList:true,characterData:true});});

 evidence.sourceHashes=runtimeHashes;evidence.scenarios=[];const previous=JSON.parse(await fs.readFile('tests/n36-madrasati-complete-classes-browser.json','utf8').catch(()=>'{}'));evidence.priorFailures=[...(previous.priorFailures??[]),...(previous.failure?[previous.failure]:[])];
 const cases=['full301','full303','full350','full600','full601','full1200','full1201','class301','sameNames','nonterminal','missingLast','missingMiddle','repeat','duplicate','drift','missingReport','schoolChanged','roleChanged','sourceClosed','windowClosed','cancelled','alarmExpired','corrupt','originChanged','sessionChanged','multi303'];
 if(process.env.N36_ONLY){assert.ok(['PASS','FAIL'].includes(previous.status)&&previous.scenarios?.length);const m=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.4.manifest.json','utf8'));for(const [file,sha] of Object.entries(previous.sourceHashes))assert.equal(m.files.find(f=>f.file===file).sha256,sha);evidence.scenarios=previous.scenarios;evidence.ownerPreview=previous.ownerPreview;evidence.secondClass=previous.secondClass;evidence.expiry=previous.expiry;evidence.reusedSourceProof=true;}
 evidence.archiveSha256=createHash('sha256').update(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.4.zip')).digest('hex');
 for(scenario of cases.filter(s=>!process.env.N36_ONLY||process.env.N36_ONLY.split(',').includes(s))){
  const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
  const waiting=context.waitForEvent('page');await startFrom(cdp,id,source);const runner=await waiting;
  await runner.locator('#run-status').filter({hasText:/(?:اكتمل الجمع|توقف|غير مكتمل|لم يثبت)/}).waitFor({timeout:22000});
  const allowed=['full301','full303','full350','full600','full601','full1200','multi303','class301','sameNames','sourceClosed','windowClosed','cancelled','alarmExpired','corrupt'].includes(scenario);
  const counts=await runner.locator('#run-counts').innerText(),status=await runner.locator('#run-status').innerText();
  const diagnostic=await runner.locator('#route-diagnostic').inputValue();
  assert.doesNotMatch(diagnostic,/طالب|خامس|SchoolId|https:/);
  if(allowed){
   const n=Number(/\d+/.exec(scenario)?.[0]??350);
   const expected=scenario==='class301'?350:n;
   assert.match(counts,new RegExp(expected+' اسمًا مجمّعًا؛ '+expected+' مكتملًا'),status+' | '+diagnostic);
   assert.doesNotMatch(diagnostic,/ROSTER_LINKS_UNAVAILABLE/);
   assert.equal(await runner.locator('#source-class-select option').count(),Math.ceil(expected/300)+1);
   assert.equal(await runner.locator('#staged-categories input').count(),0);
   assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
   if(scenario==='class301'){
    assert.equal(await runner.locator('#source-class-select option[value="خامس ألف"]').evaluate(n=>n.disabled),true);
    await runner.locator('#source-class-select').evaluate(n=>{n.value='خامس ألف';n.dispatchEvent(new Event('change'));});assert.equal(await runner.locator('#bundle-review').isDisabled(),true);assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
    await runner.locator('#source-class-select').selectOption('خامس باء');assert.equal(await runner.locator('#source-class-names li').count(),49);
   }else{
    await runner.locator('#source-class-select').selectOption('خامس ألف');assert.equal(await runner.locator('#source-class-names li').count(),300);
   }
   await runner.locator('#bundle-review').check();assert.equal(await runner.locator('#handoff-transfer').isEnabled(),true);

   if(scenario==='sourceClosed'){
    await source.close();await runner.locator('#run-status').filter({hasText:'SOURCE_CLOSED'}).waitFor();assert.equal(await runner.locator('#source-class-review').count(),0);assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
   }
   if(scenario==='windowClosed'){
    assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});await runner.close();
   }
   if(['cancelled','alarmExpired','corrupt'].includes(scenario)){
    const wait=context.waitForEvent('page');await runner.locator('#handoff-transfer').click();const page=await wait;await page.waitForURL(app+'/**');
    const nonce=new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('handoff');assert.equal(Object.keys(await worker.evaluate(()=>chrome.storage.session.get(null))).length,1);
    if(scenario==='cancelled'){
     await runner.locator('#run-cancel').click();await runner.locator('#run-status').filter({hasText:'CANCELLED'}).waitFor();assert.equal(await runner.locator('#source-class-review').count(),0);
    }else if(scenario==='alarmExpired'){
     await worker.evaluate(nonce=>chrome.alarms.create('handoff:'+nonce,{when:Date.now()+100}),nonce);await page.waitForTimeout(1200);
    }else{
     await worker.evaluate(async nonce=>{const k='handoff:'+nonce,r=(await chrome.storage.session.get(k))[k];r.ciphertext[0]^=1;await chrome.storage.session.set({[k]:r});},nonce);
     const response=await page.evaluate(({id,nonce})=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)),{id,nonce});assert.equal(response.ok,false);
    }
    await page.waitForTimeout(150);assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});await page.close();
   }
   if(scenario==='full350'){
    for(const width of [320,390,768,1280]){await runner.setViewportSize({width,height:1000});assert.equal(await runner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await runner.screenshot({path:path.join(out,'classes-'+width+'.png')});}
    // Keep transfer unclaimed until owner fixture is prepared; inspect encryption and URL.
    const waiting=context.waitForEvent('page');await runner.locator('#handoff-transfer').click();const receiver=await waiting;await receiver.waitForURL(app+'/**');
    const hash=new URL(receiver.url()).hash;assert.doesNotMatch(hash,/طالب|خامس|name/);
    const record=Object.values(await worker.evaluate(()=>chrome.storage.session.get(null)))[0];assert.ok(record.ciphertext.length>0);assert.equal(record.envelope,undefined);assert.doesNotMatch(JSON.stringify(record),/طالب|خامس/);
    await setup(receiver);await receiver.evaluate(hash=>location.hash=hash,hash);await receiver.locator('[data-existing-class]').waitFor();await mapReview(receiver);
    assert.equal(await receiver.locator('[data-names-confirm]').isDisabled(),true);
    const before=await checkpoint(receiver);assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});
    await receiver.evaluate(async()=>{const s=await import('/src/store.js');s.assertClassImportAccess();await(await import('/src/lib/cloud.js')).setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-other'});});
    await receiver.locator('.n36-receiver').waitFor({state:'detached'});assert.deepEqual(await checkpoint(receiver),before);await receiver.close();
    evidence.ownerPreview={rows:300,committed:0,ownerSwitchInvalidates:true,databaseUnchanged:true};
    // Same original lease, new explicit class and confirmation. No automatic second transfer.
    assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
    await runner.locator('#source-class-select').selectOption('خامس باء');assert.equal(await runner.locator('#source-class-names li').count(),50);await runner.locator('#bundle-review').check();
    const second=context.waitForEvent('page');await runner.locator('#handoff-transfer').click();const secondPage=await second;await secondPage.waitForURL(app+'/**');
    const nonce=new URLSearchParams(new URL(secondPage.url()).hash.split('?')[1]).get('handoff');
    const claims=await secondPage.evaluate(({id,nonce})=>Promise.all([1,2].map(()=>new Promise(r=>chrome.runtime.sendMessage(id,{type:'n36-claim',nonce},r)))),{id,nonce});
    assert.deepEqual(claims.map(r=>r.ok),[true,false]);assert.equal(claims[0].envelope.rows.length,50);await secondPage.close();evidence.secondClass='50 exact rows; concurrent replay rejected';
    await runner.clock.install();await runner.clock.fastForward(300000);await runner.locator('#run-status').filter({hasText:'انتهت مهلة'}).waitFor();assert.equal(await runner.locator('#source-class-review').count(),0);assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);evidence.expiry='300000ms clears full roster, selected names and transfer';
   }
  }else{
   assert.equal(await runner.locator('#source-class-review').count(),0,status);assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
   if(scenario==='missingReport')assert.match(diagnostic,/ROSTER_LINKS_UNAVAILABLE/);
  }
  assert.deepEqual(await worker.evaluate(()=>chrome.storage.local.get(null)),{});assert.deepEqual(await worker.evaluate(()=>chrome.storage.sync.get(null)),{});
  evidence.scenarios=evidence.scenarios.filter(s=>s.scenario!==scenario);evidence.scenarios.push({scenario,allowed,counts,status,diagnostic});console.log('PASS '+scenario);await runner.close();await source.close();
 }
 assert.deepEqual(await worker.evaluate(()=>chrome.storage.session.get(null)),{});assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(server)await new Promise(r=>server.close(r));if(temp)await fs.rm(temp,{recursive:true,force:true});if(leased)evidence.release=lease('release');evidence.cleanup='Owned disposable Chrome/profile and server closed; browser lease released';await fs.mkdir(out,{recursive:true});await fs.writeFile('tests/n36-madrasati-complete-classes-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,failure:evidence.failure,scenarios:evidence.scenarios?.length}));}
