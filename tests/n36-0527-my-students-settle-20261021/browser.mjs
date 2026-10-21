// AI: actual popup handlers/CSS + actual source readers/report fetches over owned HTTP.
// VM Chrome API and receiver transport are fabricated; no portal/credentials/native MV3 claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import vm from 'node:vm';import {webcrypto,createHash} from 'node:crypto';
import {createServer} from 'node:http';import {resolve,dirname,extname,sep} from 'node:path';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0527-my-students-settle-20261021',runId='a54b83f0-4082-4c46-b00e-5c4bb84faf40';
const baseSha='ebb8aa4daf5c71f255941c9ffb71fae91c18a155',base='http://127.0.0.1:49738',root=resolve('.'),dir='extensions/rakeez-teacher-import-helper/',folder='tests/n36-0527-my-students-settle-20261021/';
const archive=await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.27.zip'),baselineZip=unzipSync(archive),baselineManifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.27.manifest.json','utf8'));
assert.equal(createHash('sha256').update(archive).digest('hex'),baselineManifest.archive.sha256);
const A='a'.repeat(32),B='b'.repeat(32),home='/Dashboards/Schools',dash='/SchoolManagment/Actions/Teacher/'+B,roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A,report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const names='<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p>';
let scenario='complete',entry='dashboard',linksReady=false;
const word=i=>{let s='';do{s=String.fromCharCode(0x61+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
function html(u){
 if(u.pathname===report){const pager=scenario==='partial'?'': '<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav>';
 return '<meta charset=utf-8>'+pager+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+Array.from({length:303},(_,i)=>'<tr><td>طالب اصطناعي '+word(i)+'</td><td>مستمر</td><td>مدرسة اصطناعية</td><td>خامس1</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';}
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<meta charset=utf-8>'+names+'<a href="'+roster+'">قائمة الطلاب</a>'+(linksReady?'<a href="'+report+'">كشف الطلاب</a>':'');
 if(u.pathname===home&&entry==='role')return '<meta charset=utf-8><section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><a href="'+role+'">الصفحة الرئيسية</a></section>';
 return '<meta charset=utf-8>'+names+'<nav><a href="'+report+'">كشف الطلاب</a><a href="'+roster+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button><button>الجدول الدراسي</button><button>تقارير المعلم</button></nav>';
}
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);if([home,dash,report,'/SchoolManagment/Actions/MyStudents'].includes(u.pathname)){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html(u));}const f=resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside root');res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[extname(f)]??'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
const previous=JSON.parse(await fs.readFile(folder+'browser.json','utf8').catch(()=>'{}'));
const result={taskId,runId,baseSha,boundary:'Real HTTP popup/readers/report fetch/CSS; synthetic VM Chrome authority + receiver receipts. No actual school/native extension acceptance.',baseline:baselineManifest.archive,previousFailures:[...(previous.previousFailures??[]),...(previous.failure?[previous.failure]:[])],scenarios:[]};
const wait=async p=>{const end=Date.now()+12000;while(Date.now()<end){if(p())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture wait timed out');};
async function fixture(source,baseline){
 let realm;const clone=value=>{realm.boundaryJSON=JSON.stringify(value);return vm.runInContext('JSON.parse(boundaryJSON)',realm);};
 let active=true,clockOffset=0,doc='document-1',owner=true,postDrift=false;
 const data={},trace={navigation:[],deliveries:[],envelopes:[],reads:0,retries:0},never=()=>new Promise(()=>{}),live=f=>async(...args)=>active?f(...args):never();
 const chrome={storage:{session:{get:live(async k=>clone(Object.hasOwn(data,k)?{[k]:data[k]}:{})),remove:live(async k=>{delete data[k];}),set:live(async o=>{Object.assign(data,structuredClone(o));if(data['n36:background-job']?.navigation?.readDocument)trace.retries++;})}},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener(){}}},
 tabs:{query:live(async()=>[{id:7,windowId:1,url:source.url()}]),get:live(async()=>({id:7,windowId:1,url:source.url(),status:'complete'})),update:live(async(id,{url})=>{assert.equal(id,7);assert.equal(new URL(url).origin,base);trace.navigation.push(url);await source.goto(url.includes('ChangeUserType')?base+dash:url);doc='document-'+(trace.navigation.length+1);return {id,url:source.url()};}),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
 scripting:{executeScript:live(async input=>{
  if(input.target.documentIds&&!input.target.documentIds.includes(doc))throw Error('SOURCE_BINDING_CHANGED');
  if(input.files){for(const f of input.files)await source.addScriptTag({url:base+'/'+dir+f});return [];}
  const reader=['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name);if(reader)trace.reads++;
  const beforeDoc=doc;
  const value=await source.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  if(input.func.name==='readSourceReportPage'&&input.args[0]==='students'&&new URL(source.url()).pathname.includes('MyStudents')&&postDrift){
   postDrift=false;if(scenario==='post-query')await source.evaluate(()=>history.replaceState(null,'','?SchoolId='+ 'd'.repeat(32)));
   if(scenario==='post-document')doc='document-foreign';if(scenario==='post-owner')owner=false;
   if(scenario==='post-role')await source.locator('[data-role]').evaluate(n=>n.textContent='مدير المدرسة');
   if(scenario==='post-school')await source.locator('.school-name').evaluate(n=>n.textContent='مدرسة أخرى');
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
 const Clock=class extends Date {static now(){return Date.now()+clockOffset;}};
 realm=vm.createContext({Date:Clock,URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console,setTimeout,clearTimeout,queueMicrotask});const modules=new Map();
 function module(file){if(!modules.has(file))modules.set(file,(async()=>{const code=baseline?Buffer.from(baselineZip[file.slice(resolve(dir).length+1).replaceAll('\\','/')]).toString('utf8'):await fs.readFile(file,'utf8');return new vm.SourceTextModule(code,{context:realm,identifier:file});})());return modules.get(file);}
 const m=await module(resolve(dir,'background-runner.js'));await m.link((s,p)=>module(resolve(dirname(p.identifier),s)));await m.evaluate();let runner=m.namespace.createBackgroundRunner({transport});
 return {data,trace,kill(){active=false;},wake:()=>runner.wake(),async send(msg){if(msg.type==='n36-health')return {ok:true,health:'ready'};try{return await runner.message(msg,{});}catch(e){return {ok:false,code:e.message};}},async advance(){
  // First pending read was real; now cross the old 30s navigation deadline as an alarm does.
  clockOffset=31000;postDrift=scenario.startsWith('post-');const j=data['n36:background-job'];
  if(scenario==='document')doc='document-foreign';if(scenario==='old-document')doc=j.navigation.documentId;
  if(scenario==='owner'||scenario==='session'||scenario==='receiver'||scenario==='batch')owner=false;
  if(scenario==='unissued')j.navigation.issued=false;
  if(scenario==='unverified-deadline'){delete j.navigation.readDocument;delete j.navigation.readDeadline;}
  if(scenario==='role')await source.locator('[data-role]').evaluate(n=>n.textContent='مدير المدرسة');
  if(scenario==='missing-role')await source.locator('[data-role]').evaluate(n=>n.remove());
  if(scenario==='school')await source.locator('.school-name').evaluate(n=>n.textContent='مدرسة أخرى');
  if(scenario==='missing-school')await source.locator('.school-name').evaluate(n=>n.remove());
  if(scenario==='ambiguous-school')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<p class=school-name>مدرسة أخرى</p>'));
  if(scenario==='ambiguous-schoolid')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+ 'd'.repeat(32)+'">الجدول الدراسي</a>'));
  if(scenario.startsWith('unsupported'))await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<a href="/unsupported-private-path">كشف الطلاب</a>'));
  if(scenario==='unsupported-with-supported')await source.locator('body').evaluate((n,r)=>n.insertAdjacentHTML('beforeend','<a href="'+r+'">كشف الطلاب</a>'),report);
  if(scenario==='unsupported-visible-roster')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<section><h3>قائمة الطلاب</h3><table><tr><th>اسم الطالب</th><th>الفصل</th></tr><tr><td>طالب إضافي</td><td>خامس1</td></tr></table></section>'));
  if(scenario==='unsafe-link')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<a href="javascript:void(0)">كشف الطلاب</a>'));
  if(scenario==='wrong-query')await source.evaluate(()=>history.replaceState(null,'','?SchoolId='+ 'd'.repeat(32)));
  if(scenario==='query-extra')await source.evaluate(()=>history.replaceState(null,'',location.href+'&page=2'));
  if(scenario==='route')await source.evaluate(()=>history.replaceState(null,'','/TeachersReports/MyInfo/other'));
  if(scenario==='login')await source.evaluate(()=>history.replaceState(null,'','/Account/Login'));
  if(scenario==='login-form')await source.locator('body').evaluate(n=>n.insertAdjacentHTML('beforeend','<input type=password>'));
  if(scenario==='other-origin')await source.goto('about:blank');
  if(scenario==='links-ready'){linksReady=true;await source.locator('body').evaluate((n,r)=>n.insertAdjacentHTML('beforeend','<a href="'+r+'">كشف الطلاب</a>'),report);}
  await runner.wake();
 }};
}
const cases=[
 [true,'dashboard','complete','TEACHER_TRANSITION_UNRESOLVED'],
 [false,'dashboard','complete','complete'],[false,'role','complete','complete'],[false,'dashboard','partial','complete'],[false,'dashboard','links-ready','complete'],
 ...[['document','SOURCE_BINDING_CHANGED'],['old-document','SOURCE_BINDING_CHANGED'],['owner','APP_CHANGED'],['session','APP_CHANGED'],['receiver','APP_CHANGED'],['batch','APP_CHANGED'],['unissued','TEACHER_TRANSITION_UNRESOLVED'],['role','NON_TEACHER_ROLE'],['missing-role','UNCONFIRMED_TEACHER_ROLE'],['school','SCHOOL_CONTEXT_CHANGED'],['missing-school','SCHOOL_CONTEXT_CHANGED'],['ambiguous-school','AMBIGUOUS_SCHOOL_CONTEXT'],['ambiguous-schoolid','SCHOOL_CONTEXT_CHANGED'],['unsupported','UNSAFE_ROSTER_LINK'],['unsupported-with-supported','UNSAFE_ROSTER_LINK'],['unsupported-visible-roster','UNSAFE_ROSTER_LINK'],['unverified-deadline','TEACHER_TRANSITION_UNRESOLVED'],['unsafe-link','ORIGIN_CHANGED'],['wrong-query','UNSAFE_ROUTE'],['query-extra','UNSAFE_ROUTE'],['route','SOURCE_CONTEXT_CHANGED'],['login','UNSAFE_ROUTE'],['login-form','LOGIN_OR_LOGOUT'],['other-origin','SOURCE_CONTEXT_CHANGED'],['post-query','UNSAFE_ROUTE'],['post-document','SOURCE_BINDING_CHANGED'],['post-owner','APP_CHANGED'],['post-role','NON_TEACHER_ROLE'],['post-school','SCHOOL_CONTEXT_CHANGED'],['receipt-mismatch','RECEIPT_UNKNOWN']].map(([s,e])=>[false,'dashboard',s,e])
];
try{await new Promise(r=>server.listen(49738,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const [baseline,start,s,expected] of cases){scenario=s;entry=start;linksReady=false;const c=await createContext({viewport:{width:445,height:420},locale:'ar-SA'});let w;
 try{const source=await c.newPage();await source.goto(base+(start==='dashboard'?dash:home));w=await fixture(source,baseline);
  await c.exposeBinding('fixtureMessage',(_,m)=>w.send(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
  await c.addInitScript(({version})=>{window.chrome={runtime:{getManifest:()=>({version}),sendMessage:m=>window.fixtureMessage(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.copiedReport=t}});},{version:baseline?'0.5.27':'0.5.28'});
  const popup=await c.newPage();await popup.goto(base+'/'+dir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();await popup.close();
  await wait(()=>w.data['n36:background-job']?.navigationDiagnostic?.navigationStatus==='complete'||w.data['n36:background-view']?.phase==='stopped');
  const before=w.data['n36:background-job'];assert.ok(before,JSON.stringify(w.data['n36:background-view']));assert.equal(before.sourceRows.length,303);assert.equal(before.studentRowsSeen,303);assert.equal(before.phase,'navigation');assert.equal(before.navigationDiagnostic.navigationObservedRoute,'my-students');assert.equal(before.navigationDiagnostic.navigationRelation,'exact-route');assert.equal(before.navigationDiagnostic.navigationDocument,'new');assert.equal(before.navigationDiagnostic.navigationQuery,'present');assert.equal(w.trace.deliveries.length,0);
  await w.advance();await wait(()=>['complete','stopped'].includes(w.data['n36:background-view']?.phase));
  const v=w.data['n36:background-view'];assert.equal(v.phase==='complete'?'complete':v.code,expected,JSON.stringify(v));assert.equal(v.staged,303);assert.equal(v.observed,303);assert.equal(w.data['n36:background-job'],undefined);assert.equal(w.trace.navigation.filter(u=>u.includes('MyStudents')).length,1,'No replay');
  if(expected==='complete'){assert.equal(v.added,303);assert.deepEqual(w.trace.envelopes.map(e=>e.rows.length),[300,3]);assert.equal(new Set(w.trace.envelopes.flatMap(e=>e.rows.map(r=>r.name))).size,303);assert.ok(w.trace.envelopes.every(e=>e.complete===(s!=='partial')));assert.equal(v.coverage,s==='partial'?'partial':'complete');}
  else if(s!=='receipt-mismatch')assert.equal(w.trace.deliveries.length,0);
  const reopened=await c.newPage();await reopened.goto(base+'/'+dir+'popup.html');await reopened.waitForFunction(()=>document.querySelector('#run-cancel').disabled);assert.equal(await reopened.locator('#one-start').isDisabled(),false);const text=await reopened.locator('#run-status').innerText();assert.ok(text.length>10);if(s==='partial')assert.ok(text.includes('التغطية جزئية'));
  await reopened.locator('#copy-safe-report').click();const diagnostic=await reopened.evaluate(()=>JSON.parse(window.copiedReport));assert.equal(diagnostic.collection.staged,303);assert.equal(diagnostic.collection.observed,303);assert.equal(diagnostic.collection.jobPhase,v.phase);assert.equal(diagnostic.collection.coverage,v.coverage);
  const safe=JSON.stringify(diagnostic);for(const secret of [base,A,B,'مدرسة اصطناعية','طالب اصطناعي','document-','unsupported-private'])assert.ok(!safe.includes(secret),secret);
  if(baseline){assert.equal(diagnostic.collection.failureStep,'source-navigation-settle');assert.equal(diagnostic.collection.navigationRelation,'exact-route');await reopened.screenshot({path:folder+'baseline-timeout.png'});}
  if(s==='partial')await reopened.screenshot({path:folder+'partial-result.png'});if(!baseline&&start==='role')await reopened.screenshot({path:folder+'role-result.png'});
  result.scenarios.push({baseline,entry:start,scenario:s,expected,actual:v.code??v.phase,staged:v.staged,observed:v.observed,added:v.added,coverage:v.coverage,deliveries:w.trace.deliveries.length,batches:w.trace.envelopes.map(e=>({rows:e.rows.length,complete:e.complete})),navigationCount:w.trace.navigation.length,finitePopup:true,safeDiagnostic:true});console.log('PASS '+(baseline?'.27 ':'.28 ')+start+' '+s);
 }finally{w?.kill();await c.close();}}
 });result.status='PASS';}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+'browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
