// AI: actual popup handlers/CSS + actual source readers/report fetches over owned HTTP.
// VM Chrome API and receiver transport are fabricated; no portal/credentials/native MV3 claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import vm from 'node:vm';import {webcrypto,createHash} from 'node:crypto';
import {createServer} from 'node:http';import {resolve,dirname,extname,sep} from 'node:path';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0528-my-students-teacher-proof-readonly-get-20261021',runId='c99d549c-a227-4366-b5c8-d70ab928514f';
const baseSha='a1f22707de4f56a7067c6ce7df6c16e6ff84e8ee',base='http://127.0.0.1:49748',root=resolve('.'),dir='extensions/rakeez-teacher-import-helper/',folder='tests/n36-0528-my-students-teacher-proof-20261021/';
const archive=await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.28.zip'),baselineZip=unzipSync(archive),baselineManifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.28.manifest.json','utf8'));
assert.equal(createHash('sha256').update(archive).digest('hex'),baselineManifest.archive.sha256);
const A='a'.repeat(32),B='b'.repeat(32),home='/Dashboards/Schools',dash='/SchoolManagment/Actions/Teacher/'+B,roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A,report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const names='<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p>';
let scenario='complete',entry='dashboard',unexpectedResources=0;
const word=i=>{let s='';do{s=String.fromCharCode(0x61+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
function html(u){
 if(u.pathname===report){const pager=scenario==='partial'?'': '<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav>';
 return '<meta charset=utf-8>'+pager+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+Array.from({length:303},(_,i)=>'<tr><td>طالب اصطناعي '+word(i)+'</td><td>مستمر</td><td>مدرسة اصطناعية</td><td>خامس1</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';}
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<meta charset=utf-8>'+(scenario==='inert-resources'?'<script>window.fetchedScriptRan=true</script><img src=/unexpected-resource><iframe src=/unexpected-resource></iframe><link rel=stylesheet href=/unexpected-resource>':'')+'<a href="'+roster+'">قائمة الطلاب</a>'+(scenario==='menu-report'?'<a href="'+report+'">كشف الطلاب</a>':'');
 if(u.pathname===home&&entry==='role')return '<meta charset=utf-8><section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><a href="'+role+'">الصفحة الرئيسية</a></section>';
 return '<meta charset=utf-8>'+(scenario==='greeting-only'?names.replace('<p data-role>معلم</p>','<p>مرحبا بك معلم اصطناعي معلم</p>'):names)+'<nav>'+(scenario==='menu-report'?'':'<a href="'+report+'">كشف الطلاب</a>')+'<a href="'+roster+'">قائمة الطلاب</a>'+(scenario==='optional-source-bound'?'<a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a>':'')+(scenario==='unsupported-student-route'?'<a href="/TeachersReports/ClassStudentInfo/fixture">طلاب الفصل</a>':'')+'<button>سجلات المتابعة اليومية</button><button>الجدول الدراسي</button><button>تقارير المعلم</button></nav>';
}
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);if(u.pathname==='/unexpected-resource'){unexpectedResources++;return res.end('unexpected');}if([home,dash,report,'/SchoolManagment/Actions/MyStudents'].includes(u.pathname)){if(u.pathname.includes('MyStudents')){
 if(scenario==='redirect'){res.writeHead(302,{location:'/Account/Login'});return res.end();}
 if(scenario==='content-type'){res.setHeader('content-type','application/json');return res.end('{}');}
 if(scenario==='oversize'){res.setHeader('content-type','text/html');return res.end('x'.repeat(2000001));}
 if(scenario==='login-response'){res.setHeader('content-type','text/html');return res.end('<input type=password>');}
 if(scenario==='foreign-link'){res.setHeader('content-type','text/html');return res.end('<a href="https://example.com/private">كشف الطلاب</a>');}
 if(scenario==='unsafe-link'){res.setHeader('content-type','text/html');return res.end('<a onclick="x()" href="'+report+'">كشف الطلاب</a>');}
 if(scenario==='chunked-size'){res.setHeader('content-type','text/html');res.write('x'.repeat(1000000));return res.end('x'.repeat(1000001));}
 if(scenario==='login-heading'){res.setHeader('content-type','text/html');return res.end('<h1>انتهت الجلسة</h1>');}
 if(scenario==='role-response'){res.setHeader('content-type','text/html');return res.end('<p data-role>مدير المدرسة</p>');}
 if(scenario==='school-labelled'){res.setHeader('content-type','text/html');return res.end('<p>اسم المدرسة: مدرسة أخرى</p>');}
 if(scenario==='report-foreign-school'){res.setHeader('content-type','text/html');return res.end('<a href="'+report.replace(A,B)+'">كشف الطلاب</a>');}
 if(scenario==='report-extra-query'){res.setHeader('content-type','text/html');return res.end('<a href="'+report+'?page=1&amp;returnUrl=private">كشف الطلاب</a>');}
 if(scenario==='supported-unsupported'){res.setHeader('content-type','text/html');return res.end('<a href="'+report+'">كشف الطلاب</a><a href="/private-route">كشف الطلاب</a>');}
 if(scenario==='school-response'){res.setHeader('content-type','text/html');return res.end('<p class=school-name>مدرسة أخرى</p>');}
 }
 res.setHeader('content-type','text/html;charset=utf-8');return res.end(html(u));}const f=resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside root');res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[extname(f)]??'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
const previous=JSON.parse(await fs.readFile(folder+'browser.json','utf8').catch(()=>'{}'));
const runtimeHash=createHash('sha256');for(const f of JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.29.manifest.json')).files){runtimeHash.update(f.file);runtimeHash.update(await fs.readFile(dir+f.file));}const runtimeFingerprint=runtimeHash.digest('hex');
const reuse=process.argv.includes('--remaining');if(reuse){assert.equal(previous.status,'PASS');assert.equal(previous.runtimeFingerprint??JSON.parse(await fs.readFile(folder+'receiver.json')).runtimeFingerprint,runtimeFingerprint,'Prior receiver/browser phase used these unchanged runtime bytes');}
const result={taskId,runtimeFingerprint,reusedScenarios:reuse?previous.scenarios.map(c=>[c.baseline,c.entry,c.scenario]):[],runId,baseSha,boundary:'Real HTTP popup/readers/inert template report fetch/CSS; synthetic VM Chrome authority + receiver receipts. No actual school/native extension acceptance.',baseline:baselineManifest.archive,previousFailures:[...(previous.previousFailures??[]),...(previous.failure?[previous.failure]:[])],scenarios:reuse?[...previous.scenarios]:[]};
const wait=async p=>{const end=Date.now()+12000;while(Date.now()<end){if(p())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture wait timed out');};
async function fixture(source,baseline){
 let realm;const clone=value=>{realm.boundaryJSON=JSON.stringify(value);return vm.runInContext('JSON.parse(boundaryJSON)',realm);};
 let active=true,doc='document-1',owner=true;
 const data={},trace={navigation:[],deliveries:[],envelopes:[],reads:0,retries:0},never=()=>new Promise(()=>{}),live=f=>async(...args)=>active?f(...args):never();
 const chrome={storage:{session:{get:live(async k=>clone(Object.hasOwn(data,k)?{[k]:data[k]}:{})),remove:live(async k=>{delete data[k];}),set:live(async o=>{Object.assign(data,structuredClone(o));if(data['n36:background-job']?.navigation?.readDocument)trace.retries++;})}},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener(){}}},
 tabs:{query:live(async()=>[{id:7,windowId:1,url:source.url()}]),get:live(async()=>({id:7,windowId:1,url:source.url(),status:'complete'})),update:live(async(id,{url})=>{assert.equal(id,7);assert.equal(new URL(url).origin,base);trace.navigation.push(url);await source.goto(url.includes('ChangeUserType')?base+dash:url);doc='document-'+(trace.navigation.length+1);return {id,url:source.url()};}),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
 scripting:{executeScript:live(async input=>{
  if(input.target.documentIds&&!input.target.documentIds.includes(doc))throw Error('SOURCE_BINDING_CHANGED');
  if(input.files){for(const f of input.files)await source.addScriptTag({url:base+'/'+dir+f});return [];}
  if(!baseline&&input.func.name==='readAutomaticTeacherPage'&&input.args[0]==='read-proof'&&!trace.proofSeen){trace.proofSeen=true;
   if(scenario==='pre-greeting')await source.locator('[data-role]').evaluate(n=>n.textContent='معلمة');
   if(scenario==='pre-role')await source.locator('[data-role]').evaluate(n=>n.remove());
   if(scenario==='pre-school')await source.locator('.school-name').evaluate(n=>n.remove());
   if(scenario==='pre-school-id')await source.locator('a').filter({hasText:'قائمة الطلاب'}).evaluate(n=>n.href=n.href.replace('a'.repeat(32),'d'.repeat(32)));
  }
  const reader=['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name);if(reader)trace.reads++;
  const beforeDoc=doc;
  const value=await source.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  if(!baseline&&input.func.name==='readSourceReportPage'&&input.args[0]==='fetch'&&input.args[1].path.includes('MyStudents')){
   if(scenario==='post-query')await source.evaluate(()=>history.replaceState(null,'','?SchoolId='+ 'd'.repeat(32)));
   if(scenario==='post-document')doc='document-foreign';if(scenario==='post-owner')owner=false;
   if(scenario==='post-role')await source.locator('[data-role]').evaluate(n=>n.textContent='مدير المدرسة');
   if(scenario==='post-female-admin')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<p data-role>مديرة المدرسة</p>'));
   if(scenario==='post-school')await source.locator('.school-name').evaluate(n=>n.textContent='مدرسة أخرى');
   if(scenario==='post-greeting')await source.locator('[data-role]').evaluate(n=>n.textContent='معلمة');
  }
  return clone([{frameId:0,documentId:beforeDoc,result:value}]);
 })}};
 const transport=async m=>{
  if(m.type==='n36-begin')return {ok:true,batchId:'b'.repeat(64),appTabId:99};
  if(m.type==='n36-check')return {ok:owner,ready:true};if(m.type==='n36-cancel')return {ok:true};
  if(m.type==='n36-create'){trace.envelopes.push(structuredClone(m.envelope));assert.ok(m.envelope.rows.length<=300);return {ok:true};}
  if(m.type==='n36-deliver'){trace.deliveries.push(m.actionId);return {ok:true};}
  if(m.type==='n36-result'){const n=trace.envelopes.at(-1).rows.length;return {ok:true,status:'saved',total:scenario==='receipt-mismatch'?n-1:n,added:n,existing:0,setup:{unresolved:0,details:[{field:'school',reason:'current'}]}};}
  throw Error('UNKNOWN_TRANSPORT');
 };
 const Clock=Date;
 realm=vm.createContext({Date:Clock,URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console,setTimeout,clearTimeout,queueMicrotask});const modules=new Map();
 function module(file){if(!modules.has(file))modules.set(file,(async()=>{const code=baseline?Buffer.from(baselineZip[file.slice(resolve(dir).length+1).replaceAll('\\','/')]).toString('utf8'):await fs.readFile(file,'utf8');return new vm.SourceTextModule(code,{context:realm,identifier:file});})());return modules.get(file);}
 const m=await module(resolve(dir,'background-runner.js'));await m.link((s,p)=>module(resolve(dirname(p.identifier),s)));await m.evaluate();let runner=m.namespace.createBackgroundRunner({transport});
 return {data,trace,kill(){active=false;},wake:()=>runner.wake(),async send(msg){if(msg.type==='n36-health')return {ok:true,health:'ready'};try{return await runner.message(msg,{});}catch(e){return {ok:false,code:e.message};}},
 };
}
const cases=[
 [true,'dashboard','complete','UNCONFIRMED_TEACHER_ROLE'],
 [false,'dashboard','complete','complete'],[false,'role','complete','complete'],[false,'dashboard','partial','complete'],[false,'dashboard','menu-report','complete'],[false,'dashboard','inert-resources','complete'],[false,'dashboard','greeting-only','complete'],[false,'dashboard','optional-source-bound','complete'],
 ...[['pre-role','UNCONFIRMED_TEACHER_ROLE'],['pre-greeting','TEACHER_CONTEXT_CHANGED'],['pre-school','SCHOOL_CONTEXT_CHANGED'],['pre-school-id','SCHOOL_CONTEXT_CHANGED'],['during-role','NON_TEACHER_ROLE'],['during-school','SCHOOL_CONTEXT_CHANGED'],['during-greeting','TEACHER_CONTEXT_CHANGED'],['during-query','UNSAFE_ROUTE']].map(([s,e])=>[false,'dashboard',s,e]),
 ...[['post-query','UNSAFE_ROUTE'],['post-document','SOURCE_BINDING_CHANGED'],['post-owner','APP_CHANGED'],['post-role','NON_TEACHER_ROLE'],['post-female-admin','NON_TEACHER_ROLE'],['post-school','SCHOOL_CONTEXT_CHANGED'],['post-greeting','TEACHER_CONTEXT_CHANGED'],['redirect','REPORT_FETCH_FAILED'],['content-type','REPORT_CONTENT_TYPE'],['oversize','REPORT_SIZE'],['chunked-size','REPORT_SIZE'],['login-heading','LOGIN_OR_LOGOUT'],['role-response','NON_TEACHER_ROLE'],['school-labelled','SCHOOL_CONTEXT_CHANGED'],['report-foreign-school','UNSAFE_ROUTE'],['report-extra-query','UNSAFE_ROUTE'],['supported-unsupported','UNSAFE_ROSTER_LINK'],['login-response','LOGIN_OR_LOGOUT'],['foreign-link','ORIGIN_CHANGED'],['unsafe-link','UNSAFE_ROSTER_LINK'],['unsupported-student-route','UNSAFE_ROSTER_LINK'],['school-response','SCHOOL_CONTEXT_CHANGED'],['receipt-mismatch','RECEIPT_UNKNOWN']].map(([s,e])=>[false,'dashboard',s,e])
];
try{await new Promise(r=>server.listen(49748,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const [baseline,start,s,expected] of cases.filter(([b,e,s])=>!result.reusedScenarios.some(c=>c[0]===b&&c[1]===e&&c[2]===s))){scenario=s;entry=start;unexpectedResources=0;const c=await createContext({viewport:{width:445,height:420},locale:'ar-SA'});let w;
 try{const source=await c.newPage();await source.goto(base+(start==='dashboard'?dash:home));w=await fixture(source,baseline);
  await source.evaluate(({scenario})=>{const native=window.fetch;window.fetch=async(...args)=>{const r=await native(...args);if(String(args[0]).includes('MyStudents')){
   if(scenario==='during-role')document.querySelector('[data-role]').textContent='مدير المدرسة';
   if(scenario==='during-school')document.querySelector('.school-name').textContent='مدرسة أخرى';
   if(scenario==='during-greeting')document.querySelector('[data-role]').textContent='معلمة';
   if(scenario==='during-query')history.replaceState(null,'','?SchoolId='+ 'd'.repeat(32));
  }return r;};},{scenario});
  await c.exposeBinding('fixtureMessage',(_,m)=>w.send(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
  await c.addInitScript(({version})=>{window.chrome={runtime:{getManifest:()=>({version}),sendMessage:m=>window.fixtureMessage(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.copiedReport=t}});},{version:baseline?'0.5.28':'0.5.29'});
  const popup=await c.newPage();await popup.goto(base+'/'+dir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();await popup.close();
  await wait(()=>['complete','stopped'].includes(w.data['n36:background-view']?.phase));
  assert.equal(await source.evaluate(()=>window.fetchedScriptRan),undefined);if(!baseline){assert.equal(unexpectedResources,0);if(s!=='post-document')assert.equal(await source.evaluate(()=>typeof globalThis.rakeezTeacherReadGuard),'undefined');assert.equal(await source.evaluate(()=>globalThis.rakeezReportRequests?.size??0),0);}
  const v=w.data['n36:background-view'];assert.equal(v.phase==='complete'?'complete':v.code,expected,JSON.stringify(v));assert.equal(v.staged,s.startsWith('pre-')?0:303);assert.equal(v.observed,s.startsWith('pre-')?0:303);assert.equal(w.data['n36:background-job'],undefined);
  assert.equal(w.trace.navigation.filter(u=>u.includes('MyStudents')).length,baseline?1:0,'Ordinary menu/report GET stays stationary');
  assert.equal(w.trace.navigation.length,baseline?1:start==='role'?1:0,'Only selected teacher role transition may navigate');
  if(expected==='complete'){assert.equal(v.added,303);assert.deepEqual(w.trace.envelopes.map(e=>e.rows.length),[300,3]);assert.equal(new Set(w.trace.envelopes.flatMap(e=>e.rows.map(r=>r.name))).size,303);assert.ok(w.trace.envelopes.every(e=>e.complete===(s!=='partial')));assert.equal(v.coverage,s==='partial'?'partial':'complete');}
  else if(s!=='receipt-mismatch')assert.equal(w.trace.deliveries.length,0);
  const reopened=await c.newPage();await reopened.goto(base+'/'+dir+'popup.html');await reopened.waitForFunction(()=>document.querySelector('#run-cancel').disabled);assert.equal(await reopened.locator('#one-start').isDisabled(),false);const text=await reopened.locator('#run-status').innerText();assert.ok(text.length>10);if(s==='partial')assert.ok(text.includes('التغطية جزئية'));
  await reopened.locator('#copy-safe-report').click();const diagnostic=await reopened.evaluate(()=>JSON.parse(window.copiedReport));assert.equal(diagnostic.extensionVersion,baseline?'0.5.28':'0.5.29');assert.equal(diagnostic.collection.failure,v.code??'none');assert.equal(diagnostic.collection.staged,v.staged);assert.equal(diagnostic.collection.observed,v.observed);assert.equal(diagnostic.collection.jobPhase,v.phase);assert.equal(diagnostic.collection.coverage,v.coverage);
  const safe=JSON.stringify(diagnostic);for(const secret of [base,A,B,'مدرسة اصطناعية','طالب اصطناعي','document-','unsupported-private'])assert.ok(!safe.includes(secret),secret);
  if(baseline){assert.equal(diagnostic.collection.failureStep,'source-pre-read');assert.equal(diagnostic.collection.navigationRelation,'exact-route');await reopened.screenshot({path:folder+'baseline-role-failure.png'});}
  if(s==='partial')await reopened.screenshot({path:folder+'partial-result.png'});if(!baseline&&start==='role')await reopened.screenshot({path:folder+'role-result.png'});
  result.scenarios.push({baseline,entry:start,scenario:s,expected,actual:v.code??v.phase,staged:v.staged,observed:v.observed,added:v.added,coverage:v.coverage,deliveries:w.trace.deliveries.length,batches:w.trace.envelopes.map(e=>({rows:e.rows.length,complete:e.complete})),navigationCount:w.trace.navigation.length,finitePopup:true,safeDiagnostic:true});console.log('PASS '+(baseline?'.28 ':'.29 ')+start+' '+s);
 }finally{w?.kill();await c.close();}}
 });result.status='PASS';}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+'browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
