// AI: focused real popup/readers/CSS over HTTP; Chrome APIs and receiver authority synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {createServer} from 'node:http';
import {resolve,dirname,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0526-role-dashboard-redirect-20261021',runId='8c023762-485c-47fc-a4da-55014f38ac5c';
const baseSha='e04c0fdb72f3d618628f70ebf292052fa513076c',base='http://127.0.0.1:49727',root=resolve('.'),dir='extensions/rakeez-teacher-import-helper/',folder='tests/n36-0526-role-dashboard-redirect-20261021/';
const archive=await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.26.zip'),baselineZip=unzipSync(archive);
const baselineManifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.26.manifest.json','utf8'));
assert.equal(createHash('sha256').update(archive).digest('hex'),baselineManifest.archive.sha256);
assert.equal(JSON.parse(Buffer.from(baselineZip['manifest.json']).toString()).version,'0.5.26');
const home='/Dashboards/Schools',meta='/TeachersReports/MyInfo/fixture',A='a'.repeat(32),role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+A+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const B='b'.repeat(32),C='c'.repeat(32),dash='/SchoolManagment/Actions/Teacher/'+B;
let portal='teacher',delayLoad=false,releaseLoad=()=>{};
const names='<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p><dl><dt>اسم المعلم</dt><dd>معلم اصطناعي</dd></dl>';
function sourceHtml(){return '<meta charset=utf-8>'+(portal==='gateway'?'<section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><a href="'+role+'">الصفحة الرئيسية</a></section>':names+'<a href="'+meta+'">بياناتي</a><a href="/SchoolManagment/Actions/MyStudents?SchoolId='+C+'">قائمة الطلاب</a>');}
const originalSourceHtml=sourceHtml;
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);if(u.pathname==='/load-gate'){releaseLoad=()=>res.end('synthetic');return;}if(u.pathname===home||u.pathname===meta||u.pathname.startsWith(dash)){res.setHeader('content-type','text/html;charset=utf-8');return res.end(sourceHtml()+(delayLoad?'<img src="/load-gate" alt="">':''));}const f=resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside task root');res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'})[extname(f)]??'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
const previous=JSON.parse(await fs.readFile(folder+'browser.json','utf8').catch(()=>'{}'));
const result={previousFailures:[...(previous.previousFailures??[]),...(previous.failure?[previous.failure]:[])],taskId,runId,baseSha,immutableBaseline:baselineManifest.archive,boundary:'Actual popup handlers, diagnostics, CSS and injected source readers on owned HTTP pages; actual background runner ESM in a fresh VM. Synthetic Chrome API/receiver boundary. No real account or native MV3/browser acceptance.',scenarios:[]};
const wait=async p=>{const end=Date.now()+10000;while(Date.now()<end){if(p())return;await new Promise(r=>setTimeout(r,15));}throw Error('Focused fixture timed out');};
async function fixture({source,baseline=false,scenario}){
 let clockOffset=0;
 let active=true,documentId='source-document-1',owner=true,afterBegin=false,readCount=0,metadata=null,releaseUpdate,loadingChecked=false,readsAtLoading=0,pauseOriginal=false,paused=false;
 const data={},trace={navigation:[],reads:0,deliveries:0,checks:0},listeners=[];
 const never=()=>new Promise(()=>{}),live=f=>async(...a)=>active?f(...a):never();
 const updateGate=new Promise(r=>releaseUpdate=r);
 const chrome={storage:{session:{get:live(async k=>{if(pauseOriginal){pauseOriginal=false;paused=true;return never();}if(!Object.hasOwn(data,k))return {};const v=structuredClone(data[k]);if(k==='n36:background-job'&&scenario==='role-repeat')v.roleSwitchUsed=true;return {[k]:v};}),remove:live(async k=>{delete data[k];}),set:live(async v=>{
  Object.assign(data,structuredClone(v));const j=data['n36:background-job'];if(j?.phase==='navigation'&&j.navigationDiagnostic?.navigationStatus==='loading'){loadingChecked=true;readsAtLoading=trace.reads;}
  if(j?.phase==='collect'&&j.next?.kind==='home'&&scenario==='pre-read-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  if(j?.phase==='collect'&&j.next?.page&&j.next.kind!=='home') {active=false;return never();}
 })}},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener(){}}},
 tabs:{query:live(async()=>[{id:7,windowId:1,url:source.url()}]),get:live(async()=>({id:7,windowId:1,url:metadata??source.url(),status:await source.evaluate(()=>document.readyState==='complete'?'complete':'loading')})),update:live(async(id,{url})=>{
  assert.equal(id,7);assert.equal(new URL(url).origin,base);trace.readsBeforeNavigation=trace.reads;trace.navigation.push(url);await updateGate;
  portal='teacher';delayLoad=scenario.includes('loading');await source.goto(base+(scenario.startsWith('role')&&!scenario.includes('return')?dash+(scenario==='role-slash'?'/':''):scenario.startsWith('role')?home:meta),{waitUntil:'domcontentloaded'});documentId=scenario.includes('old-document')?'source-document-1':'source-document-2';
  if(scenario==='unknown-path')await source.evaluate(()=>history.replaceState(null,'','/private-person-secret/account-token'));
  if(scenario==='unknown-key')await source.evaluate(()=>history.replaceState(null,'','?private-school-token=private-secret'));
  if(scenario==='login')await source.evaluate(()=>history.replaceState(null,'','/Account/Login?returnUrl=private-secret'));
  if(scenario==='navigation-owner'||scenario==='role-owner')owner=false;
  if(scenario==='other-origin')metadata='foreign';
  if(scenario==='settle-hash')await source.evaluate(()=>location.hash='panel');
  if(scenario==='stale-metadata')metadata=base+home;
  if(scenario==='navigation-wrong-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  if(scenario==='role-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  if(scenario==='role-bare-query')await source.evaluate(()=>history.replaceState(null,'','?'));
  if(scenario==='role-unknown')await source.evaluate(()=>history.replaceState(null,'','/SchoolManagment/Actions/Teacher/not-hex'));
  if(scenario==='role-login')await source.evaluate(()=>history.replaceState(null,'','/Account/Login'));
  if(scenario==='role-foreign')metadata='foreign';
  if(scenario==='role-nonteacher')await source.locator('[data-role]').evaluate(n=>n.textContent='مدير المدرسة');
  if(scenario==='role-ambiguous-school')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<p class=school-name>مدرسة أخرى</p>'));
  if(scenario==='role-ambiguous-schoolid')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+ 'd'.repeat(32)+'">الجدول الدراسي</a>'));
  if(scenario==='role-wrong-school')await source.locator('.school-name').evaluate(n=>n.textContent='مدرسة أخرى');
  if(['role-unissued','role-expired','role-unused','role-unselected','role-schoolid-mismatch'].includes(scenario)){const j=data['n36:background-job'];if(scenario==='role-unissued')j.navigation.issued=false;if(scenario==='role-expired')j.navigation.deadline=Date.now()-1;if(scenario==='role-unused')j.roleSwitchUsed=false;if(scenario==='role-unselected')j.context.kind='other';if(scenario==='role-schoolid-mismatch')j.context.schoolId='d'.repeat(32);pauseOriginal=true;}
  return {id,url:source.url()};
 }),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
 scripting:{executeScript:live(async input=>{
  if(input.target.documentIds&&!input.target.documentIds.includes(documentId))throw Error('SOURCE_BINDING_CHANGED');
  if(input.files){for(const f of input.files)await source.addScriptTag({url:base+'/'+dir+f});return [];}
  const isReader=['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name);
  if(isReader){trace.reads++;readCount++;if(trace.navigation.length)assert.equal(await source.evaluate(()=>document.readyState),'complete','Destination readers wait for actual load completion');}
  const value=await source.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  if(isReader&&trace.navigation.length&&scenario==='role-post-navigation')await source.evaluate(()=>history.replaceState(null,'','/TeachersReports/MyInfo/changed'));
  if(isReader&&trace.navigation.length&&scenario==='role-post-document')documentId='source-document-3';
  if(isReader&&trace.navigation.length&&scenario==='role-post-owner')owner=false;
  if(isReader&&readCount===1&&scenario==='post-hash')await source.evaluate(()=>location.hash='panel');
  if(isReader&&readCount===1&&scenario==='post-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  return [{frameId:0,documentId,result:metadata==='foreign'&&!isReader?'https://foreign.invalid/private-secret?token=private-secret':value}];
 })}};
 const transport=async m=>{
  if(m.type==='n36-begin'){
   afterBegin=true;
   if(scenario==='pre-hash')await source.evaluate(()=>location.hash='panel');
   if(scenario==='wrong-document')documentId='foreign-document';
   if(scenario==='wrong-path')await source.evaluate(()=>history.replaceState(null,'','/TeachersReports/MyInfo/other'));
   if(scenario==='owner')owner=false;
   if(scenario==='deadline')clockOffset=1800001;
   return {ok:true,batchId:'b'.repeat(64),appTabId:99};
  }
  if(m.type==='n36-check'){trace.checks++;return {ok:owner,ready:true};}
  if(m.type==='n36-cancel')return {ok:true};
  trace.deliveries++;throw Error('OUT_OF_FOCUSED_SCOPE');
 };
 const Clock=class extends Date {static now(){return Date.now()+clockOffset;}};
 const realm=vm.createContext({Date:Clock,URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console,setTimeout,clearTimeout,queueMicrotask}),modules=new Map();
 function module(file){
  if(!modules.has(file))modules.set(file,(async()=>{
   const code=baseline?Buffer.from(baselineZip[file.slice(resolve(dir).length+1).replaceAll('\\','/')]).toString('utf8'):await fs.readFile(file,'utf8');
   return new vm.SourceTextModule(code,{context:realm,identifier:file});
  })());
  return modules.get(file);
 }
 const m=await module(resolve(dir,'background-runner.js'));
 await m.link((specifier,parent)=>module(resolve(dirname(parent.identifier),specifier)));
 await m.evaluate();let runner=m.namespace.createBackgroundRunner({transport});
 return {data,trace,releaseUpdate,paused:()=>paused,restore(){runner=m.namespace.createBackgroundRunner({transport});runner.wake().catch(()=>{});},loading:()=>loadingChecked,readsAtLoading:()=>readsAtLoading,wake:()=>runner.wake(),kill(){active=false;releaseUpdate();},async send(msg){if(msg.type==='n36-health')return {ok:true,health:'ready'};try{return await runner.message(msg,{});}catch(e){return {ok:false,code:e.message};}}};
}
try{
 await new Promise(r=>server.listen(49727,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const [baseline,scenario,expected] of [
   [true,'role-loading','SOURCE_CONTEXT_CHANGED'],[false,'role-loading','checkpoint'],
   [false,'role-slash','checkpoint'],[false,'role-return','checkpoint'],[false,'exact','checkpoint'],
   [false,'role-query','SOURCE_CONTEXT_CHANGED'],[false,'role-bare-query','SOURCE_CONTEXT_CHANGED'],
   [false,'role-unknown','SOURCE_CONTEXT_CHANGED'],[false,'role-login','UNSAFE_ROUTE'],[false,'role-foreign','SOURCE_CONTEXT_CHANGED'],
   [false,'role-old-document','SOURCE_BINDING_CHANGED'],[false,'role-return-old-document','NAVIGATION_UNCONFIRMED'],
   [false,'role-repeat','ROLE_SWITCH_REPEATED'],[false,'role-unissued','TEACHER_TRANSITION_UNRESOLVED'],[false,'role-expired','TEACHER_TRANSITION_UNRESOLVED'],[false,'role-unused','SOURCE_CONTEXT_CHANGED'],[false,'role-unselected','UNSAFE_ROUTE'],
   [false,'role-wrong-school','SCHOOL_CONTEXT_CHANGED'],[false,'role-ambiguous-school','AMBIGUOUS_SCHOOL_CONTEXT'],
   [false,'role-ambiguous-schoolid','AMBIGUOUS_SCHOOL_CONTEXT'],[false,'role-schoolid-mismatch','SCHOOL_CONTEXT_CHANGED'],
   [false,'role-nonteacher','NON_TEACHER_ROLE'],[false,'role-owner','APP_CHANGED'],[false,'role-post-owner','APP_CHANGED'],
   [false,'role-post-navigation','SOURCE_CONTEXT_CHANGED'],[false,'role-post-document','SOURCE_BINDING_CHANGED'],
   [false,'wrong-document','SOURCE_BINDING_CHANGED']
  ]){
   const c=await createContext({viewport:{width:445,height:324},locale:'ar-SA'});let w;
   try{
    delayLoad=false;portal=scenario.startsWith('role')?'gateway':'teacher';const source=await c.newPage();await source.goto(base+home);w=await fixture({source,baseline,scenario});
    await c.exposeBinding('fixtureMessage',(_,m)=>w.send(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
    await c.addInitScript(({version})=>{window.chrome={runtime:{getManifest:()=>({version}),sendMessage:m=>window.fixtureMessage(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.copiedReport=t;}}});},{version:baseline?'0.5.26':'0.5.27'});
    const popup=await c.newPage();await popup.goto(base+'/'+dir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();
    await wait(()=>w.trace.navigation.length||w.data['n36:background-view']?.phase==='stopped');
    if(w.trace.navigation.length){await popup.close();w.releaseUpdate();}
    if(scenario==='role-loading'&&!baseline){await wait(()=>w.loading());assert.equal(w.data['n36:background-job'].sourceDocument,'source-document-1');assert.equal(w.trace.reads,w.trace.readsBeforeNavigation);await w.wake();assert.equal(w.trace.reads,w.trace.readsBeforeNavigation);assert.equal(w.data['n36:background-job'].navigationDiagnostic.navigationStatus,'loading');releaseLoad();await source.waitForLoadState('load');w.wake().catch(()=>{});}
    if(['role-unissued','role-expired','role-unused','role-unselected','role-schoolid-mismatch'].includes(scenario)){await wait(()=>w.paused());w.restore();}
    await wait(()=>w.data['n36:background-view']?.phase==='stopped'||w.data['n36:background-job']?.phase==='collect'&&w.data['n36:background-job']?.next?.kind!=='home');
    const view=w.data['n36:background-view'],j=w.data['n36:background-job'];
    if(expected==='checkpoint'){
     assert.equal(j.phase,'collect');assert.equal(j.sourceDocument,scenario==='old-document'?'source-document-1':'source-document-2');assert.equal(j.next.page.ok,true);if(scenario.startsWith('role')&&!scenario.includes('return')){assert.equal(j.next.page.runContext.schoolId,C);assert.notEqual(C,B);assert.notEqual(A,B);}assert.equal(w.trace.navigation.length,1);assert.equal(j.sourceRows.length,0);assert.equal(view.observed,0);
    }else{assert.equal(view.phase,'stopped');assert.equal(view.code,expected);assert.equal(j,undefined);}
    assert.equal(w.trace.deliveries,0);
    if(scenario==='role-repeat')assert.equal(w.trace.navigation.length,0);
    if(['role-query','role-bare-query','role-unknown','role-login','role-foreign','role-old-document'].includes(scenario)&&expected!=='checkpoint'){assert.equal(view.staged,0);assert.equal(view.observed,0);assert.equal(w.trace.reads,w.trace.readsBeforeNavigation,'No destination collector runs after mismatch');assert.equal(w.trace.navigation.length,1,'No uncertain navigation replay');}
    if(expected!=='checkpoint'){
     const reopened=await c.newPage();await reopened.goto(base+'/'+dir+'popup.html');await reopened.waitForFunction(()=>document.querySelector('#run-cancel').disabled);await reopened.locator('#copy-safe-report').click();
     const report=await reopened.evaluate(()=>JSON.parse(window.copiedReport));
     assert.equal(report.collection.failure,expected==='AMBIGUOUS_SCHOOL_CONTEXT'?'unknown':expected);assert.equal(report.collection.jobPhase,'stopped');
     if(scenario==='wrong-document')assert.equal(report.collection.failureStep,'source-start');
     if(scenario==='navigation-wrong-query'){assert.equal(report.collection.navigationPlannedKind,'metadata');assert.equal(report.collection.navigationPlannedRoute,'teacher-report');assert.equal(report.collection.navigationObservedRoute,'teacher-report');assert.equal(report.collection.navigationRelation,'different-query');assert.equal(report.collection.navigationDocument,'new');}
     if(scenario==='unknown-path')assert.equal(report.collection.navigationObservedRoute,'other-path');
     if(scenario==='unknown-key')assert.equal(report.collection.navigationQuery,'present');
     if(scenario==='login')assert.equal(report.collection.navigationObservedRoute,'login-or-auth');
     if(scenario==='other-origin')assert.equal(report.collection.navigationObservedRoute,'other-origin');
     if(scenario==='pre-read-query')assert.equal(report.collection.failureStep,'source-pre-read');
     if(scenario==='post-query')assert.equal(report.collection.failureStep,'source-post-read');
     if(scenario==='navigation-wrong-query')assert.equal(report.collection.failureStep,'source-navigation-settle');
     assert.ok(!JSON.stringify(report).includes('private-secret'));assert.ok(!JSON.stringify(report).includes('private-person'));assert.ok(!JSON.stringify(report).includes(A));assert.ok(!JSON.stringify(report).includes(base));assert.ok(!JSON.stringify(report).includes('مدرسة اصطناعية'));assert.ok(!JSON.stringify(report).includes('source-document'));
     await reopened.evaluate(()=>n36Diagnostics.publish({failureStep:'https://private.invalid/?token=secret',failureJobPhase:'owner-private',navigationPlannedKind:'private-secret',navigationObservedRoute:'https://private.invalid/?token=private-secret',navigationRelation:'private-secret',navigationDocument:'private-secret',navigationQuery:'private-secret',navigationStatus:'private-secret'}));await reopened.locator('#copy-safe-report').click();assert.ok(!(await reopened.evaluate(()=>window.copiedReport)).includes('secret'));
     if(baseline&&scenario==='role-loading'){assert.equal(report.collection.navigationPlannedKind,'gateway');assert.equal(report.collection.navigationPlannedRoute,'teacher-role-command');assert.equal(report.collection.navigationObservedRoute,'teacher-dashboard');assert.equal(report.collection.navigationRelation,'different-path');assert.equal(report.collection.navigationQuery,'none');assert.equal(report.collection.navigationDocument,'new');assert.equal(report.collection.navigationStatus,'loading');assert.equal(report.collection.failureStep,'source-navigation-settle');}
     assert.ok(!JSON.stringify(report).includes(B));assert.ok(!JSON.stringify(report).includes(C));
     if(baseline&&scenario==='role-loading')await reopened.screenshot({path:folder+'source-denial.png'});
    }
    result.scenarios.push({baseline,scenario,expected,actual:view.code??'checkpoint',navigationObservedRoute:view.navigationObservedRoute??null,navigationRelation:view.navigationRelation??null,failureStep:view.failureStep??null,failureJobPhase:view.failureJobPhase??null,startPhase:view.startPhase??null,reads:w.trace.reads,navigationCount:w.trace.navigation.length,deliveries:w.trace.deliveries});console.log('PASS '+(baseline?'.26 ':'.27 ')+scenario);
   }finally{releaseLoad();delayLoad=false;w?.kill();await c.close();}
  }
 });result.status='PASS';
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+'browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
