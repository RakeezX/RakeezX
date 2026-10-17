// AI: actual HTTP extension/controller/parser and owned synthetic application entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const taskId='continuous-n36-collect-all-report-pages-before-review-20261017',runId='77757f26-80d2-4392-9609-0dd419355bbc';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const base='http://127.0.0.1:49438',root=resolve('.'),A='a'.repeat(32),report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const service=syntheticService(),evidence={taskId,runId,checks:[],errors:[],preservedFailures:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
const word=n=>[Math.floor(n/784),Math.floor(n/28)%28,n%28].map(i=>'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'[i]).join('');
let scenario='',size=350,classes=10,requests=0,parallel=0,maxParallel=0;
function sourceHTML(u){
 if(!u.pathname.startsWith('/SchoolManagmentReports/'))return `<nav><a href="${report}">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId=${A}">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></main>`;
 const n=Number(u.searchParams.get('page')??1),total=Math.ceil(size/50);
 const headers=['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'];
 const rows=Array.from({length:Math.min(50,size-(n-1)*50)},(_,j)=>{const i=(n-1)*50+j;return `<tr><td>طالب اصطناعي ${word(i)}</td><td>مستمر</td><td>مدرسة اصطناعية</td><td>${i%classes<10?'خامس':i%classes<20?'سادس':'اولى متوسط'}${i%classes%10+1}</td><td>ignored@example.invalid</td><td>private-account</td><td>phone</td><td>guardian</td><td>contact</td></tr>`;}).join('');
 const unknown=scenario==='unknown',gap=scenario==='gap';
 const nums=n===1&&!unknown?Array.from({length:total},(_,i)=>i+1).filter(i=>i!==n&&!(gap&&i===2)).map(i=>`<a href="${report}?page=${i}">${i}</a>`).join(''):'';
 const next=n<total&&!unknown?`<a rel=next href="${report}?page=${gap&&n===1?3:n+1}">التالي</a>`:unknown?'':'<a aria-disabled=true rel=next>التالي</a>';
 return `<nav class=pagination><span aria-current=page>${n}</span>${unknown?'':`<span role=status>الصفحة ${n} من ${total}</span>`}${nums}${next}</nav><table><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr>${rows}</table>`;
}
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');return res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));}
 if(u.pathname==='/Dashboards/Schools'||u.pathname.startsWith('/SchoolManagmentReports/')){
  res.setHeader('content-type','text/html;charset=utf-8');
  if(u.pathname.startsWith('/SchoolManagmentReports/')){requests++;parallel++;maxParallel=Math.max(maxParallel,parallel);await new Promise(r=>setTimeout(r,scenario==='inflightcancel'&&Number(u.searchParams.get('page'))>=3?600:15));parallel--;const n=Number(u.searchParams.get('page')??1);if(scenario==='network'&&n===3){res.writeHead(503);return res.end('unavailable');}if(scenario==='oversized'&&n===3)return res.end(' '.repeat(2000001));if(scenario==='unsafe'&&n===3)return res.end('<input type=password>');}
  return res.end('<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+sourceHTML(u)+'</html>');
 }
 const file=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+sep))throw Error('outside');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');const data=await fs.readFile(file);res.end(u.pathname.endsWith('/navigation.js')&&['request-resume','memory'].includes(scenario)?data.toString().replace(scenario==='memory'?'sourceBytes:8*1024*1024':'pages:24',scenario==='memory'?'sourceBytes:30000':'pages:3'):data);
}catch(e){res.writeHead(404);res.end(e.message);}});
const record=(name,data)=>{evidence.checks.push({name,status:'PASS',evidence:data});console.log('PASS '+name);};
try{const old=JSON.parse(await fs.readFile('tests/n36-collect-before-review-browser.json','utf8'));evidence.preservedFailures=[...(old.preservedFailures??[]),...(old.failure?[old.failure]:[])];}catch{}
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(49438,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(scenario of ['350','1000','resume','request-resume','network','oversized','memory','unknown','gap','terminal300','optional','inflightcancel','cancel','expiry','context','unsafe']){
  size=scenario==='1000'?1000:['terminal300','optional'].includes(scenario)?300:350;classes=scenario==='1000'?30:10;requests=0;maxParallel=0;
  const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
  let runner;try{
   const source=await context.newPage();await source.goto(base+'/Dashboards/Schools');
   runner=await context.newPage();runner.setDefaultTimeout(10000);runner.on('pageerror',e=>evidence.errors.push(e.message));
   let sent=[],outcome=null,advanced=false,sourceURL=source.url(),reviewAtRequest=0;
   await runner.exposeFunction('scriptCall',async input=>{
    if(input.funcText&&!input.args){await source.evaluate('('+input.funcText+')()');return [];}
    if(input.files){await source.evaluate(()=>import('/extensions/rakeez-teacher-import-helper/route-diagnostics.js'));return [];}
    let value=await source.evaluate(async input=>{const dir='/extensions/rakeez-teacher-import-helper/';const f=input.args?.[0];const fn=['fetch','students','timetable'].includes(f)||input.reader?'readSourceReportPage':'readAutomaticTeacherPage';const m=await import(dir+(fn==='readSourceReportPage'?'source-adapter.js':'selection.js'));return m[fn](...input.args);},input);
    if(input.args?.[0]==='home'&&value.ok&&scenario!=='optional')value.links=value.links.filter(l=>l.kind==='students');
    if(input.args?.[0]==='fetch'&&!advanced&&Number(new URL(input.args[1].path,base).searchParams.get('page'))===2&&['resume','cancel','expiry','context'].includes(scenario)){
     advanced=true;await runner.clock.setSystemTime(Date.now()+90001);
    }
    return [{frameId:0,result:value}];
   });
   await runner.exposeFunction('tabGet',()=>({id:7,url:sourceURL,status:'complete'}));
   await runner.exposeFunction('message',m=>{if(m.type==='n36-create'){sent.push(m.envelope);return {ok:true,actionId:'a'.repeat(64)};}if(m.type==='n36-result')return {ok:true,...(outcome??{status:'pending'})};return {ok:true};});
   await runner.addInitScript(({base})=>{
    window.chrome={runtime:{getManifest:()=>({version:'0.5.8'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:m=>window.message(m)},tabs:{get:()=>window.tabGet(),update:async()=>{throw Error('UNEXPECTED_VISIBLE_NAVIGATION');},onRemoved:{addListener(fn){window.removed=fn;}},onUpdated:{addListener(fn){window.updated=fn;}}},scripting:{executeScript:input=>window.scriptCall({args:input.args,files:input.files,reader:input.func?.name==='readSourceReportPage',funcText:input.func?.toString()})}};
    window.addEventListener('n36:source-roster',({detail})=>{window.gathered=detail.rows;window.coverage=detail;});
   },{base});
   await runner.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html?run='+scenario);
   await runner.clock.install();
   await runner.waitForFunction(()=>typeof window.n36BeforeExport==='function');
   await runner.evaluate(s=>{const c=new BroadcastChannel('rakeez-private-one-start');c.postMessage({type:'launch',token:s,tabId:7});c.close();},scenario);
   if(scenario==='inflightcancel'){
    await source.waitForFunction(()=>globalThis.rakeezReportRequests?.size>0);await runner.locator('#run-cancel').click();await source.waitForFunction(()=>globalThis.rakeezReportRequests?.size===0);assert.equal(await runner.locator('#source-class-select').count(),0);assert.equal(sent.length,0);record('inflightcancel-scrub',{requests,registryEmpty:true});continue;
   }
   if(['resume','cancel','expiry','context'].includes(scenario)){
    await runner.locator('#collection-continue').waitFor({state:'visible'});
    assert.equal(sent.length,0);assert.equal(await runner.locator('#source-class-select').count(),0);assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);
    const remaining=await runner.locator('#review-remaining').innerText();assert.match(remaining,/2[01][0-9]/);
    if(scenario==='cancel')await runner.locator('#run-cancel').click();
    if(scenario==='context'){sourceURL=base+'/Account/Login';await runner.evaluate(url=>window.updated(7,{url}),sourceURL);}
    if(scenario==='expiry')await runner.clock.fastForward(300001);
    if(scenario!=='resume'){
     await runner.waitForFunction(()=>document.querySelector('#collection-continue').hidden);
     assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);assert.equal(await runner.locator('#source-class-select').count(),0);record(scenario+'-scrub',{sent:sent.length,status:await runner.locator('#run-status').innerText()});continue;
    }
    await runner.locator('#collection-continue').click();
   }
   if(scenario==='request-resume'){
    for(let i=0;i<2;i++){await runner.locator('#collection-continue').waitFor({state:'visible'});assert.equal(sent.length,0);assert.equal(await runner.locator('#source-class-select').count(),0);await runner.locator('#collection-continue').click();}
   }
   if(scenario==='unsafe'){
    await runner.locator('#run-status').filter({hasText:'LOGIN_OR_LOGOUT'}).waitFor();assert.equal(await runner.locator('#source-class-select').count(),0);assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);record('unsafe-scrub',{sent:sent.length});continue;
   }
   await runner.locator('#source-class-select').waitFor();reviewAtRequest=requests;
   const actual=await runner.evaluate(()=>({rows:window.gathered,coverage:window.coverage.coverage,complete:window.coverage.complete,pages:window.coverage.processedReportPages}));
   const expected=['network','oversized'].includes(scenario)?300:scenario==='unknown'?50:scenario==='gap'?50:size;
   // A non-adjacent next href is rejected by the real parser, leaving only page one's safe rows.
   if(scenario==='memory'){assert.ok(actual.rows.length>0&&actual.rows.length<350);assert.ok(actual.rows.reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(r))+256,0)<=30000);}else assert.equal(actual.rows.length,expected,scenario);assert.equal(sent.length,0);assert.equal(new Set(actual.rows.map(r=>r.classroom+'|'+r.name)).size,scenario==='memory'?actual.rows.length:expected);
   assert.equal(actual.complete,['350','1000','resume','request-resume','terminal300','optional'].includes(scenario));
   if(scenario==='resume'){const remaining=await runner.locator('#review-remaining').innerText();assert.match(remaining,/2[01][0-9]/);}
   const options=await runner.locator('#source-class-select option').evaluateAll(os=>os.slice(1).map(o=>o.value));
   const {compareAcademicClasses}=await import('../extensions/rakeez-teacher-import-helper/class-order.js');assert.deepEqual(options,[...options].sort(compareAcademicClasses));
   assert.equal(await runner.locator('#source-class-names').isVisible(),false);
   assert.equal(await runner.evaluate(()=>getComputedStyle(document.body).direction),'rtl');assert.equal(await runner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.ok(maxParallel<=3);assert.equal(await source.url(),base+'/Dashboards/Schools');
   if(scenario==='350'){
    await runner.locator('#source-class-select').selectOption('خامس1');assert.equal(await runner.locator('#source-class-names li').count(),35);
    await runner.locator('#bundle-review').check();await runner.locator('#handoff-transfer').click();await runner.waitForFunction(()=>document.querySelector('#source-class-select').disabled);assert.equal(sent.length,1);assert.equal(sent[0].rows.length,35);
    // The unchanged browser-runtime transport is separately hash-bound to prior encrypted/one-time proof.
    // This local adapter delivers the exact selected envelope into the actual guarded N12 UI/store.
    const app=await context.newPage();await app.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    await openReadyServedDemo(app,base);const ready=await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());assert.equal(ready.lease.editable,true);
    const before=await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
    await app.evaluate(async envelope=>{const {handoffBundle}=await import('/src/lib/n36-extension-protocol.js');const {openTeacherSetupImport}=await import('/src/views/teacher-setup-import.js');openTeacherSetupImport({isContextCurrent:()=>true,initialBundle:handoffBundle(envelope),onOutcome:o=>window.receivedOutcome=o});},sent[0]);
    await app.locator('[data-import-map="classes"]').selectOption('n73-source-section');await app.locator('[data-names-target]').selectOption('n73-source');await app.locator('[data-names-review]').click();await app.locator('[data-names-preview]').waitFor();
    assert.deepEqual(await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()),before);
    assert.equal(await runner.locator('#source-class-select').isDisabled(),true);await runner.waitForTimeout(800);assert.equal(await runner.locator('#source-class-select').isDisabled(),true);
    await app.locator('[data-names-approved]').check();await app.locator('[data-names-confirm]').click();await app.locator('[data-names-receipt]').waitFor();
    outcome=await app.evaluate(()=>window.receivedOutcome);assert.equal(outcome.status,'saved');assert.equal(outcome.added,35);assert.equal(outcome.remaining,0);
    const after=await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());assert.equal(after.students.length-before.students.length,35);
    for(const key of Object.keys(before).filter(k=>!['students','enrollments','outbox'].includes(k)))assert.deepEqual(after[key],before[key],key);
    await runner.waitForFunction(()=>!document.querySelector('#source-class-select').disabled);
    await fs.mkdir('test-results/n36-collect-before-review',{recursive:true});await runner.screenshot({path:'test-results/n36-collect-before-review/extension-390.png'});await app.screenshot({path:'test-results/n36-collect-before-review/receiver-390.png'});
    record('owned-explicit-selected-class-receipt',{selected:35,added:outcome.added,previewWrites:0,pendingAdvancement:false});
   }
   record('collect-'+scenario,{total:actual.rows.length,classes:options.length,coverage:actual.coverage,pages:actual.pages,requestsBeforeReview:reviewAtRequest,maxParallel,importsBeforeReview:0,retainedLease:['resume','request-resume'].includes(scenario),requestBudget:scenario==='request-resume'?'Fixture substitutes pages:3 in the actual navigation module; controller/parser/DOM/CSS unchanged':'production24'});
  }catch(e){e.message+=' | '+await runner.locator('#run-status').innerText()+' | '+await runner.locator('#route-diagnostic').inputValue();e.stack+='\nDETAIL '+e.message;throw e;}finally{await context.close();}
 }
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;console.error(e);process.exitCode=1;}
finally{
 server.closeAllConnections();await new Promise(r=>server.close(r));evidence.cleanup='Owned loopback server closed; isolated helper closed fresh contexts and owned browser in finally; no shared lease required for local synthetic phase.';
 evidence.sourceHashes={};for(const f of ['run-controller.js','source-adapter.js','source-roster.js','categories-popup.js','class-order.js','navigation.js','popup.html','popup.css']){const file='extensions/rakeez-teacher-import-helper/'+f;evidence.sourceHashes[file]=hash(await fs.readFile(file));}
 for(const file of ['src/views/class-import-center.js','src/views/teacher-setup-import.js','src/lib/n36-extension-protocol.js','src/store.js'])evidence.sourceHashes[file]=hash(await fs.readFile(file));
 await fs.writeFile('tests/n36-collect-before-review-browser.json',JSON.stringify(evidence,null,2)+'\n');
}
