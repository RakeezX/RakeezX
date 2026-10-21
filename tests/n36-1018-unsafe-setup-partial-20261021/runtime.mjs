// AI: actual popup/CSS, source readers, worker/collector and receiver/store over owned HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService,owner,foreignOwner} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
const taskId='continuous-n36-1018-unsafe-setup-partial-20261021',runId='a12841fa-8aaf-4ea6-a297-bed06b462096';
const baseSha='0bca7554e60adca6b19ad804e4370874d9f5676b',base='http://127.0.0.1:'+(process.env.N36_PORT??'49918'),root=resolve('.'),folder='tests/n36-1018-unsafe-setup-partial-20261021/';
const candidate=process.argv.includes('--candidate');
const version=candidate?'0.5.35':'0.5.34',runtimeDir='extensions/rakeez-teacher-import-helper/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const publicURL='https://rakeezx.com/assets/extensions/rakeez-teacher-import-helper-0.5.34.zip';
let runtimeFiles,archiveIdentity;
{
 const response=candidate?null:await fetch(publicURL,{redirect:'error',signal:AbortSignal.timeout(20000)});if(response)assert.equal(response.status,200);
 const bytes=candidate?await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.34.zip'):Buffer.from(await response.arrayBuffer()),manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.34.manifest.json','utf8'));
 assert.equal(hash(bytes),'70ed0905ed3a04ccdbb7872daf4d0fd5f56071d56ebe85af9e9db68f77f23ffd');assert.equal(hash(bytes),manifest.archive.sha256);assert.deepEqual(bytes,await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.34.zip'));
 runtimeFiles=unzipSync(bytes);assert.equal(Object.keys(runtimeFiles).length,29);
 archiveIdentity={url:publicURL,observedAt:new Date().toISOString(),sha256:hash(bytes),bytes:bytes.length,files:29};
 if(!candidate)await fs.writeFile(folder+'public-0534.json',JSON.stringify(archiveIdentity,null,2)+'\n');

}
if(candidate){for(const name of Object.keys(runtimeFiles))runtimeFiles[name]=await fs.readFile(runtimeDir+name);}
const runtimeHash=createHash('sha256');for(const file of Object.keys(runtimeFiles).sort()){runtimeHash.update(file);runtimeHash.update(runtimeFiles[file]);}
const tiles=Number(process.env.N36_TILES??20),styleCostMs=Number(process.env.N36_STYLE_COST_MS??0),holdMs=Number(process.env.N36_HOLD_MS??0),scriptDelayMs=Number(process.env.N36_SCRIPT_DELAY_MS??0),observe=process.argv.includes('--observe');
assert.ok(Number.isInteger(tiles)&&tiles>=0&&tiles<=640);
assert.ok(Number.isFinite(styleCostMs)&&styleCostMs>=0&&styleCostMs<=0.02);
assert.ok(Number.isInteger(scriptDelayMs)&&scriptDelayMs>=0&&scriptDelayMs<=1000);
assert.ok(Number.isInteger(holdMs)&&holdMs>=0&&holdMs<=8000);
let service,worker,mode='',requests=[],unexpected=[],fetchTrace=[],releaseMenu=null,mutatePending=null,mutateSetup=null;let menuEntered=false;
const A='a'.repeat(32),B='b'.repeat(32),dash='/SchoolManagment/Actions/Teacher/'+B,home='/Dashboards/Schools';
const roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A,report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const meta='/TeachersReports/Statistics/MyInfo/observed',classes='/TeachersReports/Statistics/Teacher/observed',timetable='/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A;
const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const word=i=>{let s='';do{s=String.fromCharCode(97+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
const rows=Array.from({length:303},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:'خامس1'}));
const pendingNegative=()=>mode.startsWith('pending-')||mode==='timeout'||mode==='abort';
const rejectKind=process.env.N36_SETUP_KIND??'classes';
const rejectedPath=()=>rejectKind==='metadata'?meta:rejectKind==='classes'?classes:timetable;
const gate=()=>mode.split('-')[0];
const negative=()=>/drift|missing|conflict|unsafe-student|auth-loss|batch-loss|unknown-receipt|response-login|response-role/.test(mode);
const rejectionReason=()=>gate()==='route'?'route-shape':gate()==='absent'||gate()==='lateabsent'?'live-link-absent':gate()==='base'?'response-base':'live-link-unsafe';
const isCard=()=>mode.startsWith('card-'),hasInfo=()=>rejectKind==='metadata'||/empty-info|conflicting-info/.test(mode),isNegative=negative;
function html(u){
 const baseTag=gate()==='base'&&u.pathname===new URL(rejectedPath(),base).pathname?'<base href="https://untrusted.invalid/">':'';
 if(baseTag)return '<meta charset=utf-8>'+baseTag+(mode.includes('response-login')?'<input type=password>':mode.includes('response-role')?'<p data-role>الطالب</p>':'')+'<script>window.unexpectedScript=true</script><p>اسم المدرسة: مدرسة اصطناعية</p>';

 if(isCard()&&u.pathname===home)return '<meta charset=utf-8><section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><p>اسم المدير: مدير اصطناعي</p><a href="'+role+'">الصفحة الرئيسية</a></section>';
 if(u.pathname===meta)return '<meta charset=utf-8><dl><dt>اسم المدرسة</dt><dd>'+(mode.includes('conflicting-info')?'مدرسة أخرى':'')+'</dd></dl><p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p><script>window.unexpectedScript=true</script><img src=/unexpected-resource><iframe src=/unexpected-resource></iframe>';
 if(u.pathname===classes)return '<meta charset=utf-8><table><tr><th>الفصل</th><th>المادة</th></tr><tr><td>خامس1</td><td>الرياضيات</td></tr></table><img src=/unexpected-resource>';
 if(u.pathname==='/SchoolSchedule/Schedule/TeacherSchedule')return '<meta charset=utf-8><table><tr><th>اليوم</th><th>الحصة</th><th>الفصل</th><th>المادة</th></tr><tr><td>الأحد</td><td>1</td><td>خامس1</td><td>الرياضيات</td></tr></table><script>window.unexpectedScript=true</script>';
 if(u.pathname===report)return '<meta charset=utf-8>'+(mode.includes('unknown-pages')?'':'<nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav>')+'<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+rows.map((r,i)=>'<tr><td>'+r.name+'</td><td>مستمر</td><td>'+(mode.includes('missing')?'':mode.includes('conflict')&&i>=300?'مدرسة أخرى':'مدرسة اصطناعية')+'</td><td>'+r.classroom+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<meta charset=utf-8><a '+(mode.includes('unsafe-student')?'onclick="window.unexpectedClick=true" ':'')+'href="'+report+'">كشف الطلاب</a>';
 const setup='<a href="'+classes+'">فصولي</a><a href="'+timetable+'">الجدول الدراسي</a>',student='<a href="'+roster+'">قائمة الطلاب</a><a href="'+report+'">كشف الطلاب</a>';
 let documentHTML='<meta charset=utf-8>'+(rejectKind==='timetable'?'<p data-role>معلم</p><p class=school-name>مدرسة اصطناعية</p>':'')+'<main>'+Array.from({length:tiles},()=>'<section><div><div><div><p><span>إعلان مدرسي اصطناعي</span></p><small>تفاصيل النشاط المدرسي</small></div></div></div></section>').join('')+'</main><p>اسم المعلم: معلم اصطناعي</p>'+(isCard()?'':'<p>اسم المدير: مدير اصطناعي</p>')+'<nav>'+(hasInfo()?'<a href="'+meta+'">بياناتي</a>':'')+(mode.endsWith('after')?student+setup:setup+student)+'<button>سجلات المتابعة اليومية</button><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></nav>';
 if(rejectKind==='timetable')documentHTML=documentHTML.replace('>الجدول الدراسي</a>','>جدولي</a>');
 if(gate()==='route')documentHTML=documentHTML.replaceAll(rejectedPath(),rejectedPath().replace('/observed','/observed.invalid'));
 if(gate()==='onclick')documentHTML=documentHTML.replace('href="'+rejectedPath()+'"','onclick="window.unexpectedClick=true" href="'+rejectedPath()+'"');
 return documentHTML;
}
const sourcePaths=[dash,home,report,meta,classes,'/SchoolSchedule/Schedule/TeacherSchedule','/SchoolManagment/Actions/MyStudents'];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.includes('ChangeUserTypeToTeacherFromParent')){requests.push(u.pathname+u.search);res.writeHead(302,{location:dash});return res.end();}
 if(u.pathname.startsWith('/__n73/')){let body='';for await(const b of req)body+=b;res.setHeader('content-type','application/json');return res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));}
 if(sourcePaths.includes(u.pathname)){if(req.method==='GET'&&u.pathname===new URL(rejectedPath(),base).pathname&&['lateunsafe','lateabsent'].includes(gate()))await mutateSetup?.();if(req.method==='GET'&&u.pathname==='/SchoolManagment/Actions/MyStudents'){
  menuEntered=true;
  if(pendingNegative())await new Promise(resolve=>{releaseMenu=resolve;if(!mode.includes('-late'))setTimeout(()=>mutatePending?.().catch(e=>console.error(e)),150);});
  else await new Promise(r=>setTimeout(r,holdMs));
 }requests.push(u.pathname+u.search);res.setHeader('content-type','text/html;charset=utf-8');return res.end(html(u));}
 if(u.pathname.startsWith('/'+runtimeDir)){const name=u.pathname.slice(runtimeDir.length+1);assert.ok(runtimeFiles[name],name);res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html;charset=utf-8':'text/javascript');return res.end(Buffer.from(runtimeFiles[name]));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside root');
 let bytes=await fs.readFile(f);if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip'})[extname(f)]||'application/octet-stream');res.end(bytes);
}catch(e){if(req.url!='/api/n44/push/config')unexpected.push(req.url);res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,baseSha,version,archiveIdentity,runtimeFingerprint:runtimeHash.digest('hex'),model:{tiles,styleCostMs,scriptDelayMs,holdMs,inlineCounters:true,clock:'anchored wall elapsed plus cumulative actual computed-style calls times fixed cost; no phase-directed jumps; browser GET abort timer remains native 8s'},harnessCorrection:'Chrome storage/session get no longer awaits source.evaluate; style counters returned with the same reader result, with no extra source evaluation. Descriptors/app checks never schedule a counter probe. Prior harness artifacts preserved.',boundary:'Public immutable 0.5.34 ZIP; actual popup/CSS, serialized source readers, ESM background/collector, actual receiver ownership guards and IndexedDB. Synthetic Chrome/account service; loopback protocol substitution only.',cases:[]};

try{
 await new Promise(r=>server.listen(Number(new URL(base).port),'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const current of (process.env.N36_CASES?process.env.N36_CASES.split(','):['onclick-before','onclick-after','route-before','absent-before','base-before'])){
  mode=current;requests=[];unexpected=[];fetchTrace=[];menuEntered=false;releaseMenu=null;service=syntheticService();
  const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});let row;
  try{
   await c.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const app=await c.newPage();await openReadyServedDemo(app,base);
   await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
   await app.evaluate(()=>location.hash='#/settings');await app.locator('input[name=teacherName]').waitFor();await app.evaluate(()=>document.activeElement.blur());
   const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()),before=await disk();
   const source=await c.newPage();await source.goto(base+(isCard()?home:dash));
   await source.evaluate(()=>{const original=getComputedStyle;globalThis.fixtureStyleCalls=0;const nativeFetch=globalThis.fetch;globalThis.fixtureFetchStats=[];globalThis.fetch=async(...a)=>{const start=performance.now(),calls=globalThis.fixtureStyleCalls;try{return await nativeFetch(...a);}finally{globalThis.fixtureFetchStats.push({wallMs:Math.round(performance.now()-start),styleCalls:Math.min(100000000,globalThis.fixtureStyleCalls-calls)});}};globalThis.getComputedStyle=(...a)=>{globalThis.fixtureStyleCalls++;return original(...a);};});
   const sourceRequests=[];source.on('request',r=>{sourceRequests.push(r.url());if(new URL(r.url()).origin!==base)unexpected.push(r.url());});
   let hiddenSavedReceipt=null;
   await c.exposeBinding('fixtureExternal',(_,m)=>{if(mode.includes('unknown-receipt')&&m.type==='n36-outcome'){hiddenSavedReceipt=structuredClone(m.outcome);m={...m,outcome:{status:'unknown',added:0,existing:0,remaining:m.outcome.total,total:m.outcome.total}};}return worker.external(m,{frameId:0});});
   await app.evaluate(()=>{window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}};});
   let drifted=false,documentChecked=false,periodicProof=false,periodicGuard=false,lateMutation=false,rejectionReturned=false,mutatedAfterRejection=false;
   const mutate=async()=>{
    if(drifted)return;drifted=true;
    if(mode.includes('auth-loss'))await app.evaluate(async()=>{(await import('/src/lib/cloud.js')).setMockAuth(null,null);});
    if(mode.includes('batch-loss'))await app.evaluate(id=>window.rakeezCancelNamesBatch(id),worker.data['n36:background-job'].batchId);
    if(mode.includes('title'))await source.locator('button').filter({hasText:'سجلات المتابعة اليومية'}).evaluate(n=>n.textContent='عنوان آخر');
    if(mode.includes('role'))await source.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<p data-role>الطالب</p>'));
    if(mode.includes('admin'))await source.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<p>الدور: مديرة المدرسة</p>'));
    if(mode.includes('teacher'))await source.locator('p').filter({hasText:'اسم المعلم:'}).evaluate(n=>n.textContent='اسم المعلم: معلم آخر');
    if(mode.includes('schoolid'))await source.locator('a').filter({hasText:'قائمة الطلاب'}).evaluate(n=>n.href=n.href.replace('a'.repeat(32),'d'.repeat(32)));
    else if(mode.includes('school'))await source.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<p class=school-name>مدرسة أخرى</p>'));
    if(mode.includes('source-url'))await source.evaluate(()=>history.replaceState(null,'','/Dashboards/Schools'));
    if(mode.includes('document'))worker.changeSourceDocument();
    if(mode.includes('owner'))await app.evaluate(async id=>{(await import('/src/lib/cloud.js')).setMockAuth({id},{user:{id},access_token:'foreign-synthetic'});},foreignOwner);
    if(mode.includes('session'))await app.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js'),id=cloud.user.id;cloud.setMockAuth({id},{user:{id},access_token:'different-synthetic-session'});});
    if(mode==='abort')await source.evaluate(()=>{for(const c of globalThis.rakeezReportRequests?.values()??[])c.abort();});
    if(mode!=='timeout')releaseMenu?.();
   };
   mutatePending=mutate;
   mutateSetup=async()=>{await source.locator('a[href]').evaluateAll((nodes,{path,kind})=>{const n=nodes.find(n=>new URL(n.href).pathname+new URL(n.href).search===path);if(kind==='lateabsent')n.remove();else n.setAttribute('onclick','window.unexpectedClick=true');},{path:rejectedPath(),kind:gate()});};
   worker=await backgroundFixture({app,source,base,runtimeFiles,styleCostMs,scriptDelayMs,onAfterRead:async(input,value,data,evidence,pending)=>{
    if(input.func?.name==='readSourceReportPage'&&input.args?.[0]==='fetch'&&input.args?.[1]?.setupKind===rejectKind&&value?.code==='UNSAFE_SETUP_LINK'){rejectionReturned=true;if(mode.includes('drift-after')||mode.includes('auth-loss-after')||mode.includes('batch-loss-after')){mutatedAfterRejection=true;await mutate();}}
    if(rejectionReturned&&mode.includes('between')&&!mutatedAfterRejection&&input.func?.name==='readAutomaticTeacherPage'&&input.args?.[0]==='read-proof'){mutatedAfterRejection=true;await mutate();}
    if(!mode.includes('-late')||lateMutation||!menuEntered||!pending.pendingFetches||input.target.tabId!==7)return;
    if(input.func?.name==='readAutomaticTeacherPage'&&input.args?.[0]==='read-proof')periodicProof=true;
    if(periodicProof&&input.func?.name==='readSourceReportPage'&&input.args?.[0]==='guard')periodicGuard=true;
    if(periodicGuard&&input.func?.toString()==='()=>location.href'){lateMutation=true;await mutate();}
   },onRead:async(input,data,evidence)=>{
    if(input.target.tabId===99&&input.args?.[0]?.nonce){
     const j=data['n36:background-job'];assert.equal(j.context.schoolBinding,'bound');assert.equal(j.context.schoolName,'مدرسة اصطناعية');assert.equal(j.context.schoolId,A);assert.ok(j.context.readProof);
     evidence.boundDeliveries??=[];evidence.boundDeliveries.push({schoolBinding:j.context.schoolBinding,schoolName:j.context.schoolName,setup:j.pending.envelope.setup});
    }
    if(input.target.tabId!==7||input.func.name!=='readSourceReportPage'||input.args?.[0]!=='fetch')return;
    const q=input.args[1];
    if(!documentChecked){
     documentChecked=true;
     const observed=await source.evaluate(()=>({links:Array.from(document.querySelectorAll('a[href]')).filter(a=>a.getClientRects().length&&getComputedStyle(a).visibility==='visible').map(a=>new URL(a.href).pathname+new URL(a.href).search),badges:document.querySelectorAll('.school-name').length}));
     assert.equal(observed.badges,rejectKind==='timetable'?1:0);assert.equal(observed.links.includes(meta),hasInfo()&&(gate()!=='route'||rejectKind!=='metadata'));
     assert.equal(observed.links.includes(classes),gate()!=='route'||rejectKind!=='classes');assert.equal(observed.links.includes(timetable),true);
     if(gate()!=='route')assert.equal(observed.links.indexOf(classes)<observed.links.indexOf(roster),!mode.endsWith('after'));
     const schoolIds=[...new Set(observed.links.flatMap(p=>new URL(p,base).searchParams.getAll('SchoolId')))];assert.deepEqual(schoolIds,[A]);
     evidence.observedDocument=observed;
    }
    if(q.setupKind===rejectKind&&['nonget','download','disabled','form'].includes(gate()))await source.locator('a[href]').evaluateAll((nodes,{path,gate})=>{const n=nodes.find(n=>new URL(n.href).pathname+new URL(n.href).search===path);if(gate==='nonget')n.setAttribute('data-method','post');if(gate==='download')n.setAttribute('download','');if(gate==='disabled')n.setAttribute('aria-disabled','true');if(gate==='form'){const f=document.createElement('form');n.replaceWith(f);f.append(n);}},{path:rejectedPath(),gate:gate()});
    if(q.setupKind===rejectKind&&mode.includes('drift-before'))await mutate();
    if(q.setupKind===rejectKind&&gate()==='absent')await source.locator('a').filter({hasText:rejectKind==='metadata'?'بياناتي':rejectKind==='classes'?'فصولي':'جدولي'}).evaluate(n=>n.remove());
    fetchTrace.push({path:q.path,kind:q.setupKind??'students',schoolBinding:q.schoolBinding,schoolName:q.schoolName??null,schoolId:q.schoolId,readProof:!!q.readProof,rowOffset:q.rowOffset});
    if(['classes','timetable'].includes(q.setupKind)){assert.equal(q.schoolBinding,'bound');assert.equal(q.schoolName,'مدرسة اصطناعية');assert.equal(q.schoolId,A);assert.ok(q.readProof);}

   }});
   await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
   await c.addInitScript(v=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copiedReport=text}});window.chrome={runtime:{getManifest:()=>({version:v}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};},version);
   let popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();await popup.close();
   // Once rows exist this cannot be the requested zero-row failure. Do not wait
   // for unrelated continuation/receipt phases merely to rediscover that fact.
   await worker.wait(d=>(['complete','stopped'].includes(d['n36:background-view']?.phase)||mode.includes('unknown-receipt')&&d['n36:background-view']?.code==='RECEIPT_UNKNOWN')||!observe&&(d['n36:background-view']?.staged??0)>0||worker.evidence.claims.includes('n36-claim-failed'),Number(process.env.N36_WAIT_MS??100000));
   const v=worker.data['n36:background-view'],trace=worker.evidence,after=await disk();
   row={mode,view:v,mutatedAfterRejection,fetchTrace:[...fetchTrace],requests:[...requests],metrics:worker.metrics(),lateMutation,drifted,networkPending:await source.evaluate(()=>globalThis.fixtureFetchStats),sourceRequests,unexpected:[...unexpected],observedDocument:trace.observedDocument,navigation:trace.navigation,receipts:[...trace.outcomes],boundDeliveries:trace.boundDeliveries,deliveries:trace.deliveries.length};
   assert.equal(trace.navigation.length,0);assert.deepEqual(unexpected,[]);assert.equal(await source.evaluate(()=>!!window.unexpectedScript||!!window.unexpectedClick),false);
   assert.deepEqual(after.years,before.years);assert.deepEqual(after.scores,before.scores);for(const store of Object.keys(before))assert.deepEqual(after[store].filter(r=>r.ownerId===foreignOwner),before[store].filter(r=>r.ownerId===foreignOwner),'Foreign owner unchanged: '+store);
   if(!candidate){
    assert.equal(v.phase,'stopped',JSON.stringify(v));assert.equal(v.code,'UNSAFE_SETUP_LINK');assert.equal(v.staged,303);assert.equal(v.observed,303);assert.equal(v.schoolBindingState,'bound');assert.equal(v.readProofPresent,true);assert.equal(trace.deliveries.length,0);assert.deepEqual(trace.outcomes,[]);assert.deepEqual(after.students,before.students);assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.outbox,before.outbox);
   }else if(!isNegative()){
    assert.equal(v.phase,'complete',JSON.stringify(v));assert.equal(v.added,303);assert.equal(v.staged,303);assert.equal(v.observed,303);assert.equal(v.coverage,mode.includes('unknown-pages')?'partial':'complete');assert.equal(v.setupPartial,gate()!=='safe');assert.equal(v.setupKind,gate()==='safe'?'none':rejectKind);assert.equal(v.setupRejectReason,gate()==='safe'?'none':rejectionReason());
    assert.deepEqual(trace.outcomes.map(o=>o.total),[300,3]);assert.equal(trace.deliveries.length,2);assert.equal(new Set(trace.deliveries).size,2);assert.equal(after.students.filter(s=>rows.some(r=>r.name===s.name)).length,303);assert.ok(after.outbox.every(o=>o.ownerId===owner));
    for(const receipt of trace.outcomes){assert.ok(['saved','existing'].includes(receipt.status));if(gate()!=='safe'&&rejectKind!=='metadata')assert.ok(receipt.setup.details.some(d=>d.field===rejectKind&&d.reason==='missing'),'Rejected setup field must not be claimed saved');}
    popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.waitForFunction(()=>document.querySelector('#run-cancel').disabled);await popup.setViewportSize({width:430,height:600});assert.equal(await popup.locator('#run-missing').isVisible(),gate()!=='safe');const warning=await popup.locator('#run-missing').innerText();if(gate()!=='safe'){assert.ok(warning.includes('حقول الإعداد جزئية'));assert.ok(warning.includes('صفحات كشف الطلاب'));row.warningVisible=true;}
    await popup.locator('#copy-safe-report').click();await popup.waitForFunction(()=>!!window.copiedReport);const diagnostic=await popup.evaluate(()=>window.copiedReport);const safe=JSON.parse(diagnostic);assert.equal(safe.collection.setupKind,gate()==='safe'?'none':rejectKind);assert.equal(safe.collection.setupRejectReason,gate()==='safe'?'none':rejectionReason());assert.equal(safe.collection.coverage,v.coverage);assert.ok(!diagnostic.includes(A)&&!diagnostic.includes('مدرسة اصطناعية')&&!diagnostic.includes('طالب اصطناعي')&&!diagnostic.includes('/observed'));row.safeDiagnostic=safe.collection;
    if(mode==='onclick-before'){await popup.screenshot({path:folder+'0535-'+rejectKind+'-popup.png',fullPage:true});await app.screenshot({path:folder+'0535-'+rejectKind+'-receiver.png',fullPage:true});}
   }else if(mode.includes('unknown-receipt')){
    assert.equal(v.phase,'receipt');assert.equal(v.code,'RECEIPT_UNKNOWN');assert.equal(v.added,0);assert.equal(trace.deliveries.length,1);assert.equal(hiddenSavedReceipt.total,300);assert.equal(hiddenSavedReceipt.status,'saved');assert.equal(after.students.filter(s=>rows.some(r=>r.name===s.name)).length,300);row.honestReceipt={confirmedByWorker:0,actuallySaved:300,noSecondTransfer:true};
   }else{
    assert.equal(v.phase,'stopped',JSON.stringify(v));const expected=mode.includes('unsafe-student')?'UNSAFE_ROSTER_LINK':mode.includes('missing')?'SCHOOL_CONTEXT_UNCONFIRMED':mode.includes('conflict')||mode.includes('schoolid')||mode.includes('school-drift')?'SCHOOL_CONTEXT_CHANGED':mode.includes('document')?'SOURCE_BINDING_CHANGED':mode.includes('source-url')?'SOURCE_CONTEXT_CHANGED':mode.includes('response-login')?'LOGIN_OR_LOGOUT':mode.includes('role')||mode.includes('admin')?'NON_TEACHER_ROLE':mode.includes('title')?'UNCONFIRMED_TEACHER_ROLE':mode.includes('teacher')||mode.includes('school')?'TEACHER_CONTEXT_CHANGED':'APP_CHANGED';assert.equal(v.code,expected);assert.equal(trace.deliveries.length,0);assert.deepEqual(trace.outcomes,[]);assert.deepEqual(after.students,before.students);assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.outbox,before.outbox);
   }
   const blockedRequests=requests.filter(p=>p===rejectedPath()||p===rejectedPath().replace('/observed','/observed.invalid'));
   assert.equal(blockedRequests.length,['base','lateunsafe','lateabsent'].includes(gate())?(negative()?Math.min(1,blockedRequests.length):1):gate()==='safe'?1:0,'Unsafe/absent/unsupported setup never receives a GET; base rejected after one inert GET');
   row.unsafeGETs=blockedRequests.length;row.rosterCheckpoint={staged:v.staged,observed:v.observed,bound:v.schoolBindingState==='bound'};
   if(mode.includes('reimport')){
    await popup.locator('#one-start').click();await worker.wait(d=>d['n36:background-view']?.phase==='complete'&&d['n36:background-view'].existing===303&&d['n36:background-view'].added===0,30000);const again=await disk();assert.deepEqual(again.students,after.students);assert.deepEqual(again.scores,before.scores);assert.deepEqual(again.years,before.years);assert.deepEqual(trace.outcomes.slice(2).map(r=>r.total),[300,3]);assert.ok(trace.outcomes.slice(2).every(r=>r.status==='existing'&&r.added===0));assert.equal(new Set(trace.deliveries).size,4);row.reimport={added:0,existing:303,totals:[300,3],statuses:trace.outcomes.slice(2).map(r=>r.status),studentRecordsUnchanged:true};
   }
   if(mode.includes('unknown-receipt'))await worker.internal({type:'n36-job-cancel',jobId:worker.data['n36:background-job'].id});
   assert.equal(worker.data['n36:background-job'],undefined);row.status='PASS';console.log('PASS '+version+' '+mode);
  }catch(e){row??={mode,view:worker?.data['n36:background-view'],metrics:worker?.metrics(),fetchTrace:[...fetchTrace],requests:[...requests]};row.status='FAIL';row.failure=e.stack;console.error(e.stack);console.log('FAIL '+version+' '+mode+' (fixture assertion; compact record follows)');}
  finally{releaseMenu?.();if(row)result.cases.push(row);worker?.release();worker?.kill();await c.close();}
 }
 });result.status=result.cases.every(c=>['PASS','REPRODUCED','OBSERVED_STOP'].includes(c.status))?'PASS':'FAIL';if(result.status==='FAIL')process.exitCode=1;
}catch(e){console.error(e.stack);result.status='FAIL';result.failure='Harness failed outside completed case';process.exitCode=1;}
finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={origin:base,serverClosed:!server.listening,isolatedBrowserFinally:true,sharedLease:'not required: active synthetic loopback-only helper'};result.cases=result.cases.map(safeCase);await fs.writeFile(folder+(process.env.N36_LABEL??'native-storage-reproduction')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,cases:result.cases.length,failure:result.failure}));}

function safeCase(c){
 const v=c.view??{},keys=['phase','code','startPhase','failureStep','failureJobPhase','added','existing','staged','observed','coverage','setupPartial','setupKind','setupRejectReason','schoolBindingState','readProofPresent','schoolIdPresent','schoolBadgePresent','entryKind','roleProofKind','timings'];
 return {mode:c.mode,status:c.status,...(c.failure?{assertionFailure:c.failure.includes('ROWS_ADMITTED_BEFORE_PRE_ROW_EXPIRY')?'Rows admitted; exact zero-row expiry not reproduced':c.failure.includes('source-post-read')?'Exact source-post-read expiry not reproduced':c.failure.startsWith('Error: Worker fixture deadline')?'Harness terminal wait expired':'Fixture assertion failed'}:{}),view:Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]])),metrics:c.metrics,lateMutation:c.lateMutation,drifted:c.drifted,networkPending:c.networkPending??[],fetches:c.fetchTrace?.map(f=>({kind:f.kind,schoolBinding:f.schoolBinding,readProof:f.readProof,rowOffset:f.rowOffset})),requests:c.requests?.length,navigation:c.navigation?.length??0,deliveries:c.deliveries??0,unsafeGETs:c.unsafeGETs,rosterCheckpoint:c.rosterCheckpoint,reimport:c.reimport,honestReceipt:c.honestReceipt,warningVisible:c.warningVisible,safeDiagnostic:c.safeDiagnostic,mutatedAfterRejection:c.mutatedAfterRejection,setupAssertions:c.setupAssertions,setupReadCounts:c.setupReadCounts?Object.values(c.setupReadCounts):[],receipts:c.receipts?.map(r=>({total:r.total,status:r.status,fields:(r.setup?.details??[]).map(d=>({field:d.field,reason:d.reason}))}))??[]};
}
