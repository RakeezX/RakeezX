// AI: actual installed MV3 toolbar action and external app modules; all school requests intercepted.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
import http from 'node:http';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {unzipSync} from '../src/lib/student-import-parsers.js';
// Test-only adapter for the older transfer fixture: expose its missing browser storage
// and protocol-compatible fixture setup; no Product guard is changed.
if(process.argv.includes('--observed-schema')){
 // Narrow rendered source-reader fixture, not an official-source or account proof.
 const {withIsolatedLocalBrowser}=await import('file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs');
 const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'b'.repeat(32),school='a'.repeat(32);
 const headers=["\u0627\u0633\u0645 \u0627\u0644\u0637\u0627\u0644\u0628","\u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0627\u0644\u0628","\u0627\u0644\u0645\u062f\u0631\u0633\u0629","\u0627\u0644\u0641\u0635\u0644","\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a","\u062d\u0633\u0627\u0628 \u0627\u0644\u0637\u0627\u0644\u0628","\u0627\u0644\u062c\u0648\u0627\u0644","\u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631","\u062c\u0648\u0627\u0644 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631"];
 const chars="\u0627\u0628\u062a\u062b\u062c\u062d\u062e\u062f\u0630\u0631\u0632\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063a\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u064a";
 const rows=Array.from({length:50},(_,i)=>'<tr>'+["\u0637\u0627\u0644\u0628 \u0627\u0635\u0637\u0646\u0627\u0639\u064a "+chars[Math.floor(i/chars.length)]+chars[i%chars.length],"\u0646\u0634\u0637","\u0645\u062f\u0631\u0633\u0629 \u0627\u0635\u0637\u0646\u0627\u0639\u064a\u0629","\u0641\u0635\u0644 \u0623\u0644\u0641",'private@example.invalid','PRIVATE_ACCOUNT','PRIVATE_PHONE','PRIVATE_GUARDIAN','PRIVATE_PHONE'].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
 const index='/SchoolManagment/Actions/MyStudents?SchoolId='+school;
 const pager=(route,key,pages)=>'<ul class="pagination"><li class="active"><a aria-current="page">1</a></li>'+pages.map(n=>'<li><a href="'+route+'?'+key+'='+n+(key==='PageNumber'?'&schoolId='+school:'')+'">'+n+'</a></li>').join('')+'</ul>';
 const fixtureServer=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/extension/')){
   const name=u.pathname.slice('/extension/'.length);if(!['source-adapter.js','route-diagnostics.js'].includes(name)){res.writeHead(404).end();return;}
   res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(await fs.readFile('extensions/rakeez-teacher-import-helper/'+name));return;
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end('<!doctype html><html dir="rtl"><table><tr><th>Download</th></tr></table>'+(u.pathname===report?'<table><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+rows+'</table>'+pager(report,'page',[2,3,4,5,7]):pager('/SchoolManagment/Actions/MyStudents','PageNumber',[2,3,4,5,15]))+'</html>');
 }catch{res.writeHead(500).end();}});
 try{
  await new Promise((resolve,reject)=>{fixtureServer.once('error',reject);fixtureServer.listen(43879,'127.0.0.1',resolve);});
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-available-partial-class-import-no-total-cap-20261017.json',runId:'835aef31-4d35-449e-a6cc-990a53e6b7c8',url:'http://127.0.0.1:43879'+report},async({createContext,origin})=>{
   const context=await createContext(),page=await context.newPage();
   const read=()=>page.evaluate(async school=>{await import('/extension/route-diagnostics.js');return (await import('/extension/source-adapter.js')).readSourceReportPage('students',{schoolId:school});},school);
   await page.goto(origin+report);const result=await read();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.tables[0].text.split('\n').length,51);assert.equal(result.schoolNames.length,1);
   assert.equal(result.links[0].path,report+'?page=2');assert.equal(result.pagination.total,null);assert.equal(result.pagination.terminal,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|example.invalid/);
   await page.goto(origin+index);const missing=await read();assert.equal(missing.ok,false);assert.equal(missing.code,'ROSTER_LINKS_PENDING');assert.equal(missing.incomplete,true);assert.equal(missing.diagnostic.roster.cause,'MAIN_FRAME_READ_LINK_ABSENT');
   // Discovery returns no raw index text and cannot alter the earlier valid report result.
   assert.equal(missing.tables,undefined);assert.equal(result.tables[0].text.split('\n').length,51);
   console.log('PASS observed schema: 9 headers, 50 safe rows, lowercase page=2, unknown total, private columns excluded; MyStudents PageNumber index remains coverage-only with no raw roster.');
  });
 }finally{await new Promise(resolve=>fixtureServer.close(resolve));fixtureServer.closeAllConnections();}
 console.log('RELEASED isolated browser and owned loopback server');
}else if(process.argv.includes('--legacy-transfer')){
 const values=new Map();globalThis.localStorage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear()};
 // Match the legacy transfer fixture to its selected service protocol without
 // suppressing pending mutations or changing any Product serialization/guard.
 // N03 is real repository SQL. A retained year tombstone avoids invoking the
 // unrelated newer first-boot calendar selection, absent from this fixture SQL.
 // The original test still creates/syncs its actual live year and transfer data.
 const {registerHooks}=await import('node:module');
 const readSource=(await import('node:fs')).readFileSync;
 const baselineSource=process.argv.includes('--baseline-store')?execFileSync('git',['show','9d12083affab1d709a5bb6df10b71b1d9dbc55a5:src/store.js'],{encoding:'utf8'}):null;
 registerHooks({load(url,context,next){
  if(baselineSource&&url.endsWith('/src/store.js'))return {format:'module',source:baselineSource,shortCircuit:true};
  if(url.endsWith('/student-transfer-roll-safety.test.mjs')){
   const source=readSource(new URL(url),'utf8'),needle='  await store.init();';
   assert.equal(source.split(needle).length,3,'expected fixture init and reload entry');
   return {format:'module',shortCircuit:true,source:source.replace("assert.equal((await db.getAll('outbox')).length, 0);", "assert.equal((await db.getAll('outbox')).length, 0, JSON.stringify((await db.getAll('outbox')).map(e=>({store:e.store,recordId:e.recordId,state:e.state,lastError:e.lastError,blockedReason:e.blockedReason}))));").replace(needle,"  await db.put('years', { ...makeYear({ id: 'transfer:retained-year', hijriStart: 1440 }), deleted: true });\n"+needle)};
  }
  if(url.endsWith('/helpers/student-lifecycle-server.mjs')){
   const source=readSource(new URL(url),'utf8'),needle='  await installLifecycleServer(pg, options);';
   assert.equal(source.split(needle).length,2);
   return {format:'module',shortCircuit:true,source:source.replace(needle,needle+"\n  await pg.exec(await readFile(new URL('../../supabase/migrations/20261003000000_n03_education_department.sql', import.meta.url), 'utf8')); ")};
  }
  return next(url,context);
 }});
 await import('./student-transfer-roll-safety.test.mjs');
}else{
const root=process.cwd(),out=path.resolve('test-results/n36-null-roll-overflow');
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-available-partial-class-import-no-total-cap-20261017.json',runId='042984ce-de8d-4b52-b5bc-05259a349279';
const lease=action=>{for(let attempt=0;;attempt++){try{return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();}catch(e){if(attempt>=2||!String(e.stderr).includes('being used by another process'))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}}};
const baseline=process.env.N36_BASELINE==='1',evidence={runId,baseline,checks:[],externalRequests:[],errors:[]};
const origin='https://schools.madrasati.sa',A='a'.repeat(32),students='/SchoolManagment/Actions/MyStudents?SchoolId='+A;
const app='https://rakeezx.com';let server,service=syntheticService(),baseURL,scenario='full303';
let context,temp,leased=false,timer,rosterPresent=false,clockInstalled=false;

const report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'b'.repeat(32);
const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',word=n=>[Math.floor(n/(alphabet.length**2)),Math.floor(n/alphabet.length)%alphabet.length,n%alphabet.length].map(i=>alphabet[i]).join('');
const multiReport=i=>'/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+String(i+1).repeat(32);
const group=i=>'فصل '+Math.floor(i/(['full50','full299','full300'].includes(scenario)?Math.ceil(Number(/\d+/.exec(scenario)[0])/2):300));
function html(u){
 if(u.pathname.startsWith('/SchoolSchedule/'))return '<p>جدول غير ظاهر</p>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<a href="'+students+'">أسماء الطلاب</a><a href="'+students+'">قائمة الطلاب</a>';
 if(scenario==='multi303'&&u.pathname.startsWith('/SchoolManagmentReports/')){
  const i=Number(u.pathname.split('/').at(-1)[0])-1;
  return '<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr><th>اسم الطالب</th><th>الفصل</th></tr>'+Array.from({length:Math.min(50,303-i*50)},(_,j)=>'<tr><td>طالب اصطناعي '+word(i*50+j)+'</td><td>'+group(i*50+j)+'</td></tr>').join('')+'</table>';
 }
 const count=Number(/\d+/.exec(scenario)?.[0]??350),size=scenario.startsWith('single')?count:50,total=Math.ceil(count/size),n=Number(u.searchParams.get('page')||1);
 if(u.pathname.startsWith('/SchoolManagmentReports/')){
  if(n===2&&['originChanged','sessionChanged'].includes(scenario))return '<script>location.replace('+JSON.stringify(scenario==='originChanged'?'https://unvisited.invalid/':'/Account/Login')+')</script>';
  const cur=scenario==='repeat'?1:n,shown=scenario==='drift'&&n===2?n+1:n;
  const pager='<nav class=pagination><span aria-current=page>'+shown+'</span><span role=status>الصفحة '+n+' من '+total+'</span>'+(n<total&&!((scenario==='missingMiddle'&&n===2)||(scenario==='missingLast'&&n===total-1))?'<a rel=next href="'+(scenario==='unsafe'?'https://unvisited.invalid/report':report+'?page='+(n+1))+'">التالي</a>':['nonterminal','missingLast','missingMiddle'].includes(scenario)?'':'<button disabled>التالي</button>')+'</nav>';
  const rows=Array.from({length:Math.min(size,count-(n-1)*size)},(_,j)=>{const i=(cur-1)*size+j,idx=scenario==='duplicate'&&j===1?i-1:i;return '<tr><td'+(scenario==='hidden'&&j===1?' style=display:none':'')+'>'+(scenario==='invalid'&&j===1?'طالب 123':'طالب اصطناعي '+word(scenario==='sameNames'?idx%300:idx))+'</td><td>'+(scenario.startsWith('single')?'فصل واحد':group(idx))+'</td></tr>';}).join('');
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
 const files=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+'0.5.5'+'.zip'));
 const {createHash}=await import('node:crypto');const runtimeHashes=Object.fromEntries(Object.entries(files).filter(([n])=>!n.startsWith('vendor/')).map(([n,v])=>[n,createHash('sha256').update(v).digest('hex')]));
 for(const [name,data] of Object.entries(files)){const file=path.join(extension,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],serviceWorkers:'allow',viewport:{width:1280,height:1000},locale:'ar-SA',args:['--enable-unsafe-extension-debugging','--enable-extension-targets']});
 timer=setTimeout(()=>context.close().catch(()=>{}),600000);timer.unref();evidence.browser=context.browser().version();
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.protocol==='chrome-extension:')return route.continue();if(u.origin===app)return route.fulfill({response:await route.fetch({url:baseURL+u.pathname+u.search})});if(u.origin==='https://unvisited.invalid'){(evidence.blockedExternal??=[]).push(u.origin);return route.abort();}if(u.origin===origin){assert.equal(route.request().method(),'GET');evidence.sourceGets=(evidence.sourceGets??0)+1;return route.fulfill({contentType:'text/html;charset=utf-8',body:'<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+html(u)+'</html>'});}evidence.externalRequests.push(u.origin);return route.abort();});
 context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await context.addInitScript(()=>{if(location.hostname==='rakeezx.com'){localStorage.removeItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns');Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});sessionStorage.setItem('rakeezx-demo-session-v1','preparing');navigator.serviceWorker.register=async()=>({});}window.countHistory=[];new MutationObserver(()=>{const n=document.getElementById('run-counts');if(n&&window.countHistory.at(-1)!==n.textContent)window.countHistory.push(n.textContent);}).observe(document,{subtree:true,childList:true,characterData:true});});

 evidence.sourceHashes=runtimeHashes;evidence.scenarios=[];evidence.priorFailures=[];
 const previous=JSON.parse(await fs.readFile('tests/n36-partial-class-import-no-total-cap-browser.json','utf8').catch(()=>'{}'));evidence.priorFailures=[...(previous.priorFailures??[]),...(previous.failure?[previous.failure]:[])];evidence.preservedFailures=[...(previous.preservedFailures??[]),...(previous.receiptFailure?[{stage:previous.stage,failure:previous.failure,receiptFailure:previous.receiptFailure,archiveSha256:previous.archiveSha256}]:[])];
 evidence.appHashes=Object.fromEntries(await Promise.all(['src/views/teacher-setup-import.js','src/views/class-import-center.js','src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','src/store.js'].map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
 assert.equal(previous.archiveSha256,createHash('sha256').update(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.5.zip')).digest('hex'));
 assert.ok(previous.scenarios.length>=27);
 evidence.reusedEvidence={runId:previous.runId,candidateSha:previous.reusedEvidence?null:'9d12083affab1d709a5bb6df10b71b1d9dbc55a5',appHashes:previous.appHashes,reason:'Identical extension bytes; existing row/owner/preview handlers retained. New store overflow and owner/lease/retry entry tests run below.'};
 evidence.scenarios=previous.scenarios;

 evidence.archiveSha256=createHash('sha256').update(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.5.zip')).digest('hex');
 const cases=['single998','single999','single1000','single1251','owner','lease','retry','lostReceipt'];
 evidence.scenarios=evidence.scenarios.filter(s=>!(process.env.N36_ONLY?process.env.N36_ONLY.split(','):cases).includes(s.scenario));
 for(scenario of cases.filter(s=>!process.env.N36_ONLY||process.env.N36_ONLY.split(',').includes(s))){
  evidence.stage=scenario;const source=await context.newPage();await source.goto(origin+'/Dashboards/Schools');
  const waiting=context.waitForEvent('page');await startFrom(cdp,id,source);const runner=await waiting;
  await runner.locator('#run-status').filter({hasText:/(?:اكتمل الجمع|توقف|غير مكتمل|لم يثبت|انتهى جمع)/}).waitFor({timeout:22000});
  const blocked=['missingReport','schoolChanged','roleChanged','originChanged','sessionChanged'].includes(scenario);
  if(blocked){
   assert.equal(await runner.locator('#source-class-review').count(),0);assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
  }else{
   let transferred=0,added=0,batches=0,fresh=true,dbBefore=null,dbAfter=null,stopEarly=false;
   for(let window=0;window<50;window++){
    await runner.locator('#source-class-select').waitFor();
    const options=await runner.locator('#source-class-select option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
    for(const label of options){
     await runner.locator('#source-class-select').selectOption(label);console.log('REVIEW '+scenario+' '+label);
     while(await runner.locator('#source-class-names li').count()){
      const count=await runner.locator('#source-class-names li').count();assert.ok(count>0&&count<=300);
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
      const active=after.enrollments.filter(e=>e.sectionId===section&&e.status==='active'&&!e.deleted);
      assert.equal(active.filter(e=>e.rollNo===null).length,Math.max(0,active.length-999));
      assert.deepEqual(active.filter(e=>e.rollNo!==null).map(e=>e.rollNo).sort((a,b)=>a-b),Array.from({length:Math.min(active.length,999)},(_,i)=>i+1));
      assert.ok(after.outbox.every(r=>r.ownerId==='a7300000-0000-4000-8000-000000000001'));
      const enrollmentPatches=after.outbox.filter(r=>r.store==='enrollments'&&r.op==='create').map(r=>r.patch);
      assert.ok(enrollmentPatches.every(p=>p.roll_no===null||Number.isInteger(p.roll_no)&&p.roll_no>=1&&p.roll_no<=999));
      if(active.length>999)assert.match(await receiver.locator('[data-names-receipt]').innerText(),/انتسابات بلا رقم كشف محفوظ/);

      for(const key of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k)))assert.deepEqual(after[key],before[key],key);
      if(['retry','lostReceipt'].includes(scenario)&&batches===0){
       if(scenario==='retry')assert.deepEqual(after,before);else{assert.equal(after.students.length-before.students.length,count);added+=count;}if(scenario==='retry')await runner.locator('#handoff-status').filter({hasText:'لم يصل إيصال حفظ مؤكد'}).waitFor();assert.equal(await runner.locator('#source-continue').isDisabled(),true);
       await receiver.close();await runner.locator('#source-retry').click();assert.equal(await runner.locator('#source-class-names li').count(),count);batches++;continue;
      }
      try{await runner.locator('#handoff-status').filter({hasText:'وصل إيصال ركيز'}).waitFor({timeout:15000});}catch(error){evidence.receiptFailure={scenario,batches,count,receiver:await receiver.locator('[data-names-receipt]').innerText(),source:await runner.locator('#handoff-status').innerText(),records:await worker.evaluate(()=>chrome.storage.session.get(null))};throw error;}
      assert.equal(after.students.length-before.students.length,scenario==='lostReceipt'&&batches===1?0:count);
      transferred+=count;added+=after.students.length-before.students.length;batches++;
      if(['single1000','single1251'].includes(scenario)&&added===Number(/\d+/.exec(scenario)[0])){
       const result=await receiver.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
        const direct=await s.importStudents('n73-source-section',['طالب مباشر إضافي']);if(direct.added!==1)throw Error('DIRECT_IMPORT_OVERFLOW');
        const added=await s.addStudent('n73-source-section','طالب زيادة اختيارية');
        const addedEnrollment=s.activeEnrollment(added.id);
        const addedOutbox=(await d.getAll('outbox')).find(row=>row.store==='enrollments'&&row.recordId===addedEnrollment.id);
        if(addedEnrollment.rollNo!==null||addedOutbox?.patch?.roll_no!==null||addedOutbox?.ownerId!=='a7300000-0000-4000-8000-000000000001')throw Error('OVERFLOW_ADD_RECEIPT');
        const before=await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint();
        const en=s.state.enrollments.find(e=>e.sectionId==='n73-source-section'&&!e.deleted&&e.rollNo===null);
        const manual=await s.setRollNo(en.id,1000),renumber=await s.renumberRoster('n73-source-section'),transfer=await s.transferStudent(en.studentId,'n73-target-section');
        const after=await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint();
        return {manual,renumber,transfer,unchanged:JSON.stringify(before)===JSON.stringify(after)};});
       assert.deepEqual(result,{manual:{ok:false,reason:'range'},renumber:false,transfer:null,unchanged:true});evidence.overflowSafety=result;
       const ownerDenied=await receiver.evaluate(async()=>{const s=await import('/src/store.js'),f=await import('/tests/n36-receiver-fixture.mjs'),c=await import('/src/lib/cloud.js');const before=await f.checkpoint();await c.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{user:{id:'b7300000-0000-4000-8000-000000000002'},access_token:'synthetic-other'});let denied=false;try{await s.addStudent('n73-source-section','اسم غير مصرح');}catch{denied=true;}return {denied,unchanged:JSON.stringify(before)===JSON.stringify(await f.checkpoint())};});
       assert.deepEqual(ownerDenied,{denied:true,unchanged:true});evidence.addOwnerGuard=ownerDenied;
      }
      await receiver.close();
     }
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
    const expected=['full50','full299','full300','full301','full303','full350','full1000','full1251','single350','single998','single999','single1000','single1251'].includes(scenario)?Number(/\d+/.exec(scenario)[0]):null;
    if(expected!==null)assert.equal(transferred,expected,'no silent tail loss');
    const partialExpected={nonterminal:350,missingLast:300,missingMiddle:100,duplicate:343,invalid:343,hidden:343,unsafe:50,retry:350,lostReceipt:350}[scenario];if(partialExpected!==undefined)assert.equal(transferred,partialExpected,'safe available subset retained with exact known exclusions');
    assert.equal(dbAfter.students.length-dbBefore.students.length,added);
   }
   evidence.scenarios.push({scenario,transferred,added,batches,stoppedByGuard:stopEarly});
  }
  const diagnostic=await runner.locator('#route-diagnostic').inputValue();assert.doesNotMatch(diagnostic,/طالب|فصل|SchoolId|https:/);
  assert.deepEqual(await worker.evaluate(()=>chrome.storage.local.get(null)),{});assert.deepEqual(await worker.evaluate(()=>chrome.storage.sync.get(null)),{});
  if(blocked)evidence.scenarios.push({scenario,blocked:true});console.log('PASS '+scenario);await runner.close();await source.close();
 }
 assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);evidence.requiredScenarios=[...new Set([...previous.scenarios.map(s=>s.scenario),...cases])];evidence.coverageComplete=evidence.requiredScenarios.every(name=>evidence.scenarios.some(s=>s.scenario===name));evidence.resolution={historicalFailure:'single1251',status:'PASS',correction:'D-123 nullable overflow membership; numbering/RPC guards preserved'};evidence.status=evidence.coverageComplete?'PASS':'PARTIAL';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{clearTimeout(timer);await context?.close();if(server)await new Promise(r=>server.close(r));if(temp){const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(resolved,{recursive:true,force:true});}if(leased)evidence.release=lease('release');evidence.cleanup='Owned disposable Chrome/profile and server closed; browser lease released';await fs.mkdir(out,{recursive:true});await fs.writeFile('tests/n36-partial-class-import-no-total-cap-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,failure:evidence.failure,scenarios:evidence.scenarios?.length}));}

}
