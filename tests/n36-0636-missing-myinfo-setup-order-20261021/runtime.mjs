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
import {backgroundFixture} from './worker-fixture.mjs';
const taskId='continuous-n36-0636-missing-myinfo-setup-order-20261021',runId='33864882-7d7d-4a20-a301-78ec47c3fbe1';
const baseSha='baa8fe5eb4577362d81ab9643aef219331fa2f06',base='http://127.0.0.1:49866',root=resolve('.'),folder='tests/n36-0636-missing-myinfo-setup-order-20261021/';
const candidate=process.argv.includes('--candidate'),version=candidate?'0.5.33':'0.5.32',runtimeDir='extensions/rakeez-teacher-import-helper/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const publicURL='https://rakeezx.com/assets/extensions/rakeez-teacher-import-helper-0.5.32.zip';
let runtimeFiles,archiveIdentity;
if(!candidate){
 const response=await fetch(publicURL,{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer()),manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.32.manifest.json','utf8'));
 assert.equal(hash(bytes),manifest.archive.sha256);assert.deepEqual(bytes,await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.32.zip'));
 runtimeFiles=unzipSync(bytes);assert.equal(Object.keys(runtimeFiles).length,29);
 archiveIdentity={url:publicURL,observedAt:new Date().toISOString(),sha256:hash(bytes),bytes:bytes.length,files:29};
 await fs.writeFile(folder+'public-0532.json',JSON.stringify(archiveIdentity,null,2)+'\n');
}else{
 const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.33.manifest.json','utf8'));
 runtimeFiles=unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.33.zip'));
 for(const f of manifest.files)assert.deepEqual(Buffer.from(runtimeFiles[f.file]),await fs.readFile(runtimeDir+f.file));
 archiveIdentity=manifest.archive;
}
const runtimeHash=createHash('sha256');for(const file of Object.keys(runtimeFiles).sort()){runtimeHash.update(file);runtimeHash.update(runtimeFiles[file]);}
let service,worker,mode='',requests=[],unexpected=[],fetchTrace=[];
const A='a'.repeat(32),B='b'.repeat(32),dash='/SchoolManagment/Actions/Teacher/'+B,home='/Dashboards/Schools';
const roster='/SchoolManagment/Actions/MyStudents?SchoolId='+A,report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const meta='/TeachersReports/Statistics/MyInfo/observed',classes='/TeachersReports/Statistics/Teacher/observed',timetable='/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A;
const role='/Dashboards/Schools/ChangeUserTypeToTeacherFromParent/'+B+'?Name='+encodeURIComponent('مدرسة اصطناعية');
const word=i=>{let s='';do{s=String.fromCharCode(97+i%26)+s;i=Math.floor(i/26)-1;}while(i>=0);return s;};
const rows=Array.from({length:303},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:'خامس1'}));
const isCard=()=>mode.startsWith('card-'),hasInfo=()=>/empty-info|conflicting-info/.test(mode),isNegative=()=>/missing|conflict|drift/.test(mode);
function html(u){
 if(isCard()&&u.pathname===home)return '<meta charset=utf-8><section><h3>مدرسة اصطناعية</h3><p>الدور: معلم</p><p>اسم المدير: مدير اصطناعي</p><a href="'+role+'">الصفحة الرئيسية</a></section>';
 if(u.pathname===meta)return '<meta charset=utf-8><dl><dt>اسم المدرسة</dt><dd>'+(mode.includes('conflicting-info')?'مدرسة أخرى':'')+'</dd></dl><p>اسم المعلم: معلم اصطناعي</p><p>اسم المدير: مدير اصطناعي</p><script>window.unexpectedScript=true</script><img src=/unexpected-resource><iframe src=/unexpected-resource></iframe>';
 if(u.pathname===classes)return '<meta charset=utf-8><table><tr><th>الفصل</th><th>المادة</th></tr><tr><td>خامس1</td><td>الرياضيات</td></tr></table><img src=/unexpected-resource>';
 if(u.pathname==='/SchoolSchedule/Schedule/TeacherSchedule')return '<meta charset=utf-8><table><tr><th>اليوم</th><th>الحصة</th><th>الفصل</th><th>المادة</th></tr><tr><td>الأحد</td><td>1</td><td>خامس1</td><td>الرياضيات</td></tr></table><script>window.unexpectedScript=true</script>';
 if(u.pathname===report)return '<meta charset=utf-8><nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(v=>'<th>'+v+'</th>').join('')+'</tr>'+rows.map((r,i)=>'<tr><td>'+r.name+'</td><td>مستمر</td><td>'+(mode.includes('missing')?'':mode.includes('conflict')&&i>=300?'مدرسة أخرى':'مدرسة اصطناعية')+'</td><td>'+r.classroom+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('')+'</table>';
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<meta charset=utf-8><a href="'+report+'">كشف الطلاب</a>';
 const setup='<a href="'+classes+'">فصولي</a><a href="'+timetable+'">الجدول الدراسي</a>',student='<a href="'+roster+'">قائمة الطلاب</a><a href="'+report+'">كشف الطلاب</a>';
 return '<meta charset=utf-8><p>اسم المعلم: معلم اصطناعي</p>'+(isCard()?'':'<p>اسم المدير: مدير اصطناعي</p>')+'<nav>'+(hasInfo()?'<a href="'+meta+'">بياناتي</a>':'')+(mode.endsWith('after')?student+setup:setup+student)+'<button>سجلات المتابعة اليومية</button><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></nav>';
}
const sourcePaths=[dash,home,report,meta,classes,'/SchoolSchedule/Schedule/TeacherSchedule','/SchoolManagment/Actions/MyStudents'];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.includes('ChangeUserTypeToTeacherFromParent')){requests.push(u.pathname+u.search);res.writeHead(302,{location:dash});return res.end();}
 if(u.pathname.startsWith('/__n73/')){let body='';for await(const b of req)body+=b;res.setHeader('content-type','application/json');return res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));}
 if(sourcePaths.includes(u.pathname)){requests.push(u.pathname+u.search);res.setHeader('content-type','text/html;charset=utf-8');return res.end(html(u));}
 if(u.pathname.startsWith('/'+runtimeDir)){const name=u.pathname.slice(runtimeDir.length+1);assert.ok(runtimeFiles[name],name);res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html;charset=utf-8':'text/javascript');return res.end(Buffer.from(runtimeFiles[name]));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+sep))throw Error('Outside root');
 let bytes=await fs.readFile(f);if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip'})[extname(f)]||'application/octet-stream');res.end(bytes);
}catch(e){if(req.url!='/api/n44/push/config')unexpected.push(req.url);res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,baseSha,version,archiveIdentity,runtimeFingerprint:runtimeHash.digest('hex'),boundary:'Public immutable ZIP or exact candidate package; actual popup/CSS, serialized source readers, ESM background/collector, actual receiver ownership guards and IndexedDB. Synthetic Chrome/account service; loopback protocol substitution only.',cases:[]};
const positives=['no-info-before','no-info-after','empty-info-before','empty-info-after','card-no-info-before','card-no-info-after','card-empty-info-before','card-empty-info-after'];
const negatives=['missing-school-before','conflicting-school-before','owner-drift-before','document-drift-before','session-drift-before','conflicting-info-before','card-conflicting-info-before','empty-info-missing-school-before','card-empty-info-missing-school-before'];
if(process.argv.includes('--remaining')){
 const prior=JSON.parse(await fs.readFile(folder+'candidate.json','utf8'));assert.equal(prior.runtimeFingerprint,result.runtimeFingerprint);
 result.previousFailures=[...(prior.previousFailures??[]),...prior.cases.filter(c=>c.status==='FAIL')];result.cases=prior.cases.filter(c=>c.status==='PASS');result.reusedCases=result.cases.map(c=>c.mode);
}
try{
 await new Promise(r=>server.listen(49866,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const current of (candidate?[...positives,...negatives]:positives).filter(m=>!result.reusedCases?.includes(m))){
  mode=current;requests=[];unexpected=[];fetchTrace=[];service=syntheticService();
  const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});let row;
  try{
   await c.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const app=await c.newPage();await openReadyServedDemo(app,base);
   await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
   await app.evaluate(()=>location.hash='#/settings');await app.locator('input[name=teacherName]').waitFor();await app.evaluate(()=>document.activeElement.blur());
   const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()),before=await disk();
   const source=await c.newPage();await source.goto(base+(isCard()?home:dash));
   const sourceRequests=[];source.on('request',r=>{sourceRequests.push(r.url());if(new URL(r.url()).origin!==base)unexpected.push(r.url());});
   await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));
   await app.evaluate(()=>{window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}};});
   let drifted=false,documentChecked=false;
   worker=await backgroundFixture({app,source,base,runtimeFiles,onRead:async(input,data,evidence)=>{
    if(input.target.tabId===99&&input.args?.[0]?.nonce){
     const j=data['n36:background-job'];assert.equal(j.context.schoolBinding,'bound');assert.equal(j.context.schoolName,'مدرسة اصطناعية');assert.equal(j.context.schoolId,A);assert.ok(j.context.readProof);
     evidence.boundDeliveries??=[];evidence.boundDeliveries.push({schoolBinding:j.context.schoolBinding,schoolName:j.context.schoolName,setup:j.pending.envelope.setup});
    }
    if(input.target.tabId!==7||input.func.name!=='readSourceReportPage'||input.args?.[0]!=='fetch')return;
    const q=input.args[1];
    if(!documentChecked){
     documentChecked=true;
     const observed=await source.evaluate(()=>({links:Array.from(document.querySelectorAll('a[href]')).filter(a=>a.getClientRects().length&&getComputedStyle(a).visibility==='visible').map(a=>new URL(a.href).pathname+new URL(a.href).search),badges:document.querySelectorAll('.school-name').length}));
     assert.equal(observed.badges,0);assert.equal(observed.links.includes(meta),hasInfo());
     assert.equal(observed.links.includes(classes),true);assert.equal(observed.links.includes(timetable),true);
     assert.equal(observed.links.indexOf(classes)<observed.links.indexOf(roster),!mode.endsWith('after'));
     const schoolIds=[...new Set(observed.links.flatMap(p=>new URL(p,base).searchParams.getAll('SchoolId')))];assert.deepEqual(schoolIds,[A]);
     evidence.observedDocument=observed;
    }
    fetchTrace.push({path:q.path,kind:q.setupKind??'students',schoolBinding:q.schoolBinding,schoolName:q.schoolName??null,schoolId:q.schoolId,readProof:!!q.readProof,rowOffset:q.rowOffset});
    if(['classes','timetable'].includes(q.setupKind)){assert.equal(q.schoolBinding,'bound');assert.equal(q.schoolName,'مدرسة اصطناعية');assert.equal(q.schoolId,A);assert.ok(q.readProof);}
    if(mode.includes('drift')&&!drifted&&q.path===report){drifted=true;
     if(mode.startsWith('owner'))await app.evaluate(async id=>{(await import('/src/lib/cloud.js')).setMockAuth({id},{user:{id},access_token:'foreign-synthetic'});},foreignOwner);
     if(mode.startsWith('session'))await app.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js'),id=cloud.user.id;cloud.setMockAuth({id},{user:{id},access_token:'different-synthetic-session'});});
     if(mode.startsWith('document'))worker.changeSourceDocument();
    }
   }});
   await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
   await c.addInitScript(v=>{window.chrome={runtime:{getManifest:()=>({version:v}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};},version);
   let popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();await popup.close();
   await worker.wait(d=>['complete','stopped'].includes(d['n36:background-view']?.phase)||worker.evidence.claims.includes('n36-claim-failed'),20000);
   const v=worker.data['n36:background-view'],trace=worker.evidence,after=await disk();
   row={mode,view:v,fetchTrace:[...fetchTrace],requests:[...requests],sourceRequests,unexpected:[...unexpected],observedDocument:trace.observedDocument,navigation:trace.navigation,receipts:trace.outcomes,boundDeliveries:trace.boundDeliveries,deliveries:trace.deliveries.length};
   assert.equal(v.phase,isNegative()?'stopped':'complete',JSON.stringify(v));
   assert.equal(trace.navigation.length,isCard()?1:0,'No visual setup/roster navigation; selected card has its one explicit teacher-role switch');
   assert.deepEqual(unexpected,[]);assert.equal(await source.evaluate(()=>!!window.unexpectedScript),false);
   const permitted=new Set([...sourcePaths.map(p=>base+p),base+roster,base+timetable,base+role,...Object.keys(runtimeFiles).map(f=>base+'/'+runtimeDir+f)]);
   assert.deepEqual(sourceRequests.filter(u=>!permitted.has(u)),[],'Only exact observed source routes and installed helper scripts');
   if(!isNegative()){
    assert.equal(v.added,303);assert.equal(v.observed,303);assert.equal(v.staged,303);assert.equal(v.coverage,'complete');
    assert.equal(trace.boundDeliveries.length,2);assert.equal(trace.deliveries.length,2);assert.equal(new Set(trace.deliveries).size,2);assert.deepEqual(trace.outcomes.map(o=>o.total),[300,3]);
    assert.equal(after.students.filter(s=>rows.some(r=>r.name===s.name)).length,303);assert.deepEqual(after.years,before.years);assert.deepEqual(after.scores,before.scores);assert.ok(after.outbox.every(o=>o.ownerId===owner));
    row.setupReadCounts=Object.fromEntries([classes,timetable].map(p=>[p,fetchTrace.filter(f=>f.path===p).length]));row.setupAssertions=[];
    for(const p of [classes,timetable])if(row.setupReadCounts[p]!==1)row.setupAssertions.push('Expected exactly one bound GET: '+p+'; actual '+row.setupReadCounts[p]);
    for(const receipt of trace.outcomes){assert.equal(receipt.status,'saved');for(const field of ['teacher','principal','school','classes','timetable'])if(!receipt.setup.details.some(d=>d.field===field&&['saved','current'].includes(d.reason)))row.setupAssertions.push('Missing '+field+' in saved '+receipt.total+' receipt');}
    if(row.setupAssertions.length)throw Error(row.setupAssertions.join('\n'));
    assert.equal(after.profile[0].schoolName,'مدرسة اصطناعية');assert.equal(after.profile[0].teacherName,'معلم اصطناعي');assert.equal(after.profile[0].principalName,'مدير اصطناعي');
    assert.equal(after.slots.length,before.slots.length+1);const slot=after.slots.find(s=>!before.slots.some(b=>b.id===s.id)),teaching=after.teachings.find(t=>t.id===slot.teachingId);assert.equal(slot.weekday,0);assert.equal(slot.period,1);assert.equal(after.subjects.find(s=>s.id===teaching.subjectId).name,'الرياضيات');
    popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.waitForFunction(()=>document.querySelector('#run-cancel').disabled);assert.equal(await popup.locator('#one-start').isDisabled(),false);
    if(mode==='no-info-before'){await popup.screenshot({path:folder+version+'-popup.png'});await app.screenshot({path:folder+version+'-receiver.png',fullPage:true});}
   }else{
    assert.equal(trace.deliveries.length,0);assert.deepEqual(trace.outcomes,[]);assert.deepEqual(after.students,before.students);assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.outbox,before.outbox);
    assert.equal(v.code,mode.includes('missing')?'SCHOOL_CONTEXT_UNCONFIRMED':mode.includes('conflicting')?'SCHOOL_CONTEXT_CHANGED':mode.startsWith('document')?'SOURCE_BINDING_CHANGED':'APP_CHANGED');
   }
   assert.equal(worker.data['n36:background-job'],undefined);row.status='PASS';console.log('PASS '+version+' '+mode);
  }catch(e){row??={mode,fetchTrace:[...fetchTrace],requests:[...requests]};row.status='FAIL';row.failure=e.stack;console.log('FAIL '+version+' '+mode+' '+e.message);}
  finally{if(row)result.cases.push(row);worker?.release();worker?.kill();await c.close();}
 }
 });result.status=result.cases.every(c=>c.status==='PASS')?'PASS':'FAIL';if(result.status==='FAIL')process.exitCode=1;
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}
finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={origin:base,serverClosed:!server.listening,isolatedBrowserFinally:true,sharedLease:'not required: active synthetic loopback-only helper'};await fs.writeFile(folder+(candidate?'candidate':'immutable')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,cases:result.cases.length,failure:result.failure}));}
