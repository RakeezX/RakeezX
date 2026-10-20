// AI: focused real popup/readers/CSS over HTTP; Chrome APIs and receiver authority synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve,dirname,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0524-source-context-before-collection-20261020',runId='211464d6-8a2b-4961-b030-a572f09d0685';
const baseSha='a6b3998bd5fad914082dd2269685d20d813be950',base='http://127.0.0.1:49628',root=resolve('.'),dir='extensions/rakeez-teacher-import-helper/',folder='tests/n36-0524-source-context-20261020/';
const home='/Dashboards/Schools',meta='/TeachersReports/MyInfo/fixture',A='a'.repeat(32),role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+A+'?Name='+encodeURIComponent('مدرسة اصطناعية');
let portal='teacher';
const names='<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p><dl><dt>اسم المعلم</dt><dd>معلم اصطناعي</dd></dl>';
function sourceHtml(){return '<meta charset=utf-8>'+(portal==='gateway'?'<section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><a href="'+role+'">الصفحة الرئيسية</a></section>':names+'<a href="'+meta+'">بياناتي</a>');}
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);if(u.pathname===home||u.pathname===meta){res.setHeader('content-type','text/html;charset=utf-8');return res.end(sourceHtml());}const f=resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside task root');res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'})[extname(f)]??'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
const previous=JSON.parse(await fs.readFile(folder+'browser.json','utf8').catch(()=>'{}'));
const result={previousFailures:[...(previous.previousFailures??[]),...(previous.failure?[previous.failure]:[])],taskId,runId,baseSha,boundary:'Actual popup handlers, diagnostics, CSS and injected source readers on owned HTTP pages; actual background runner ESM in a fresh VM. Synthetic Chrome API/receiver boundary. No real account or native MV3/browser acceptance.',scenarios:[]};
const wait=async p=>{const end=Date.now()+10000;while(Date.now()<end){if(p())return;await new Promise(r=>setTimeout(r,15));}throw Error('Focused fixture timed out');};
async function fixture({source,baseline=false,scenario}){
 let clockOffset=0;
 let active=true,documentId='source-document-1',owner=true,afterBegin=false,readCount=0,metadata=null,releaseUpdate;
 const data={},trace={navigation:[],reads:0,deliveries:0,checks:0},listeners=[];
 const never=()=>new Promise(()=>{}),live=f=>async(...a)=>active?f(...a):never();
 const updateGate=new Promise(r=>releaseUpdate=r);
 const chrome={storage:{session:{get:live(async k=>Object.hasOwn(data,k)?{[k]:structuredClone(data[k])}:{}),remove:live(async k=>{delete data[k];}),set:live(async v=>{
  Object.assign(data,structuredClone(v));const j=data['n36:background-job'];
  if(j?.phase==='collect'&&j.next?.kind==='home'&&scenario==='pre-read-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  if(j?.phase==='collect'&&j.next?.page&&j.next.kind!=='home') {active=false;return never();}
 })}},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener(){}}},
 tabs:{query:live(async()=>[{id:7,windowId:1,url:source.url()}]),get:live(async()=>({id:7,windowId:1,url:metadata??source.url(),status:'complete'})),update:live(async(id,{url})=>{
  assert.equal(id,7);assert.equal(new URL(url).origin,base);trace.navigation.push(url);await updateGate;
  portal='teacher';await source.goto(base+(scenario.startsWith('role')?home:meta));documentId='source-document-2';
  if(scenario==='settle-hash')await source.evaluate(()=>location.hash='panel');
  if(scenario==='stale-metadata')metadata=base+home;
  if(scenario==='navigation-wrong-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  if(scenario==='role-wrong-school')await source.locator('.school-name').evaluate(n=>n.textContent='مدرسة أخرى');
  return {id,url:source.url()};
 }),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
 scripting:{executeScript:live(async input=>{
  if(input.target.documentIds&&!input.target.documentIds.includes(documentId))throw Error('SOURCE_BINDING_CHANGED');
  if(input.files){for(const f of input.files)await source.addScriptTag({url:base+'/'+dir+f});return [];}
  const isReader=['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name);
  if(isReader){trace.reads++;readCount++;}
  const value=await source.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  if(isReader&&readCount===1&&scenario==='post-hash')await source.evaluate(()=>location.hash='panel');
  if(isReader&&readCount===1&&scenario==='post-query')await source.evaluate(()=>history.replaceState(null,'','?page=2'));
  return [{frameId:0,documentId,result:value}];
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
   const code=baseline&&file.endsWith('background-runner.js')?execFileSync('git',['show',baseSha+':'+dir+'background-runner.js'],{encoding:'utf8'}):await fs.readFile(file,'utf8');
   return new vm.SourceTextModule(code,{context:realm,identifier:file});
  })());
  return modules.get(file);
 }
 const m=await module(resolve(dir,'background-runner.js'));
 await m.link((specifier,parent)=>module(resolve(dirname(parent.identifier),specifier)));
 await m.evaluate();const runner=m.namespace.createBackgroundRunner({transport});
 return {data,trace,releaseUpdate,kill(){active=false;releaseUpdate();},async send(msg){if(msg.type==='n36-health')return {ok:true,health:'ready'};try{return await runner.message(msg,{});}catch(e){return {ok:false,code:e.message};}}};
}
try{
 await new Promise(r=>server.listen(49628,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const [baseline,scenario,expected] of [
   [true,'pre-hash','SOURCE_CONTEXT_CHANGED'],[false,'pre-hash','checkpoint'],
   [true,'post-hash','SOURCE_CONTEXT_CHANGED'],[false,'post-hash','checkpoint'],
   [true,'settle-hash','SOURCE_CONTEXT_CHANGED'],[false,'settle-hash','checkpoint'],
   [false,'stale-metadata','checkpoint'],[true,'role','NAVIGATION_UNCONFIRMED'],[false,'role','checkpoint'],
   [false,'wrong-document','SOURCE_BINDING_CHANGED'],[false,'wrong-path','SOURCE_CONTEXT_CHANGED'],
   [false,'pre-read-query','SOURCE_CONTEXT_CHANGED'],[false,'post-query','SOURCE_CONTEXT_CHANGED'],[false,'navigation-wrong-query','SOURCE_CONTEXT_CHANGED'],
   [false,'role-wrong-school','SCHOOL_CONTEXT_CHANGED'],[false,'owner','APP_CHANGED'],[false,'deadline','REVIEW_EXPIRED']
  ]){
   const c=await createContext({viewport:{width:445,height:324},locale:'ar-SA'});let w;
   try{
    portal=scenario.startsWith('role')?'gateway':'teacher';const source=await c.newPage();await source.goto(base+home);w=await fixture({source,baseline,scenario});
    await c.exposeBinding('fixtureMessage',(_,m)=>w.send(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
    await c.addInitScript(()=>{window.chrome={runtime:{getManifest:()=>({version:'0.5.25'}),sendMessage:m=>window.fixtureMessage(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.copiedReport=t;}}});});
    const popup=await c.newPage();await popup.goto(base+'/'+dir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();
    await wait(()=>w.trace.navigation.length||w.data['n36:background-view']?.phase==='stopped');
    if(w.trace.navigation.length){await popup.close();w.releaseUpdate();}
    await wait(()=>w.data['n36:background-view']?.phase==='stopped'||w.data['n36:background-job']?.phase==='collect'&&w.data['n36:background-job']?.next?.kind!=='home');
    const view=w.data['n36:background-view'],j=w.data['n36:background-job'];
    if(expected==='checkpoint'){
     assert.equal(j.phase,'collect');assert.equal(j.sourceDocument,'source-document-2');assert.equal(j.next.page.ok,true);assert.equal(w.trace.navigation.length,1);assert.equal(j.sourceRows.length,0);assert.equal(view.observed,0);
    }else{assert.equal(view.phase,'stopped');assert.equal(view.code,expected);assert.equal(j,undefined);}
    assert.equal(w.trace.deliveries,0);
    if(!baseline&&expected!=='checkpoint'){
     const reopened=await c.newPage();await reopened.goto(base+'/'+dir+'popup.html');await reopened.waitForFunction(()=>document.querySelector('#run-cancel').disabled);await reopened.locator('#copy-safe-report').click();
     const report=await reopened.evaluate(()=>JSON.parse(window.copiedReport));
     assert.equal(report.collection.failure,expected);assert.equal(report.collection.jobPhase,'stopped');
     if(scenario==='wrong-document')assert.equal(report.collection.failureStep,'source-start');
     if(scenario==='pre-read-query')assert.equal(report.collection.failureStep,'source-pre-read');
     if(scenario==='post-query')assert.equal(report.collection.failureStep,'source-post-read');
     if(scenario==='navigation-wrong-query')assert.equal(report.collection.failureStep,'source-navigation-settle');
     assert.ok(!JSON.stringify(report).includes(base));assert.ok(!JSON.stringify(report).includes('مدرسة اصطناعية'));assert.ok(!JSON.stringify(report).includes('source-document'));
     await reopened.evaluate(()=>n36Diagnostics.publish({failureStep:'https://private.invalid/?token=secret',failureJobPhase:'owner-private'}));await reopened.locator('#copy-safe-report').click();assert.ok(!(await reopened.evaluate(()=>window.copiedReport)).includes('secret'));
     if(scenario==='navigation-wrong-query')await reopened.screenshot({path:folder+'source-denial.png'});
    }
    result.scenarios.push({baseline,scenario,expected,actual:view.code??'checkpoint',failureStep:view.failureStep??null,failureJobPhase:view.failureJobPhase??null,startPhase:view.startPhase??null,reads:w.trace.reads,navigationCount:w.trace.navigation.length,deliveries:w.trace.deliveries});console.log('PASS '+(baseline?'.24 ':'.25 ')+scenario);
   }finally{w?.kill();await c.close();}
  }
 });result.status='PASS';
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+'browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
