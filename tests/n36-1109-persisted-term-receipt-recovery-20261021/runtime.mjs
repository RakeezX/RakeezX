// AI: actual popup/CSS, source readers, worker/collector and receiver/store over owned HTTP.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService,owner,foreignOwner} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
const taskId='continuous-n36-1109-persisted-term-receipt-recovery-20261021',runId='5e50775e-0e75-4434-b2dc-900ff34a6e99';
const baseSha='f3f4fe4c074881e5eac9a4a767cb1140d023be32',base='http://127.0.0.1:'+(process.env.N36_PORT??'49929'),root=resolve('.'),folder='tests/n36-1109-persisted-term-receipt-recovery-20261021/';
const candidate=process.argv.includes('--candidate');
const version=candidate?'0.5.36':'0.5.35',runtimeDir='extensions/rakeez-teacher-import-helper/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const publicURL='https://rakeezx.com/assets/extensions/rakeez-teacher-import-helper-0.5.35.zip';
let runtimeFiles,archiveIdentity;
{
 const response=candidate?null:await fetch(publicURL,{redirect:'error',signal:AbortSignal.timeout(20000)});if(response)assert.equal(response.status,200);
 const bytes=candidate?await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.35.zip'):Buffer.from(await response.arrayBuffer()),manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.35.manifest.json','utf8'));
 assert.equal(hash(bytes),'025fb2a896fb6027789575c0cd35ff4cfd9e3740b55137b81e7880a79ea71aef');assert.equal(hash(bytes),manifest.archive.sha256);assert.deepEqual(bytes,await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.35.zip'));
 runtimeFiles=unzipSync(bytes);assert.equal(Object.keys(runtimeFiles).length,29);
 archiveIdentity={url:publicURL,observedAt:new Date().toISOString(),sha256:hash(bytes),bytes:bytes.length,files:29};
 if(!candidate)await fs.writeFile(folder+'public-0535.json',JSON.stringify(archiveIdentity,null,2)+'\n');

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
const rejectKind='timetable';
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
 let bytes=!candidate&&['/src/views/class-import-center.js','/src/lib/n36-extension-handoff.js'].includes(u.pathname)?execFileSync('git',['show',baseSha+':'+u.pathname.slice(1)]):await fs.readFile(f);if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip'})[extname(f)]||'application/octet-stream');res.end(bytes);
}catch(e){if(req.url!='/api/n44/push/config')unexpected.push(req.url);res.writeHead(404);res.end(e.message);}});
// AI: scoped full runtime proof. Real source DOM, popup handlers/CSS, receiver/store and IndexedDB.
const applicationFiles={};for(const p of ['src/views/class-import-center.js','src/lib/n36-extension-handoff.js'])applicationFiles[p]=hash(candidate?await fs.readFile(p):execFileSync('git',['show',baseSha+':'+p]));
const result={taskId,runId,baseSha,version,archiveIdentity,applicationFiles,runtimeFingerprint:runtimeHash.digest('hex'),cases:[]};
try{
 await new Promise(r=>server.listen(Number(new URL(base).port),'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const scenario of (process.env.N36_CASES??'missing-year,missing-term,optimistic,cross-tab,after-chunk,saved-before-receipt').split(',')){
  mode='onclick-before';for(let i=0;i<rows.length;i++)rows[i].classroom=scenario==='multiclass'?'خامس'+(Math.floor(i/100)+1):'خامس1';requests=[];unexpected=[];service=syntheticService();
  const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});let row={scenario};
  try{
   await c.addInitScript(()=>{if(location.protocol==='http:'&&location.hostname==='127.0.0.1')sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
   const app=await c.newPage();await openReadyServedDemo(app,base);
   await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
   await app.evaluate(async scenario=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    // Keep a single live coherent fallback except the explicit ambiguity control.
    if(!['ambiguous','ambiguous-year'].includes(scenario))for(const t of s.state.terms.filter(t=>t.id!=='n73-term')){await d.remove('terms',t.id);s.state.terms=s.state.terms.filter(r=>r.id!==t.id);}
    const other={...s.getTerm('n73-term'),id:'synthetic-other-term',index:2};
    if(['cross-tab','after-chunk','optimistic','transaction-drift','new-selection','persistent-start'].includes(scenario)){await d.put('terms',other);s.state.terms.push(other);}
    if(scenario.startsWith('deleted')){const kind=scenario==='deleted-year'?'years':'terms',original=kind==='years'?s.getYear('n73-year'):s.getTerm('n73-term'),tombstone={...original,id:'deleted-selection',deleted:true};await d.put(kind,tombstone);s.state[kind].push(tombstone);const changes=kind==='years'?{activeYearId:tombstone.id}:{activeTermId:tombstone.id};s.state.device={...s.state.device,...changes};await d.put('device',s.state.device);}
    if(scenario==='ambiguous-year'){const y={...s.getYear('n73-year'),id:'second-live-year'};await d.put('years',y);s.state.years.push(y);}
    if(scenario==='disk-ambiguous'){const t={...s.getTerm('n73-term'),id:'disk-only-term'};await d.put('terms',t);s.state.device={...s.state.device,activeTermId:'missing-term'};await d.put('device',s.state.device);}
    if(scenario==='foreign-term-disk')await d.put('terms',{...s.getTerm('n73-term'),ownerId:'b7300000-0000-4000-8000-000000000002'});
    if(scenario==='fallback-ambiguous-at-write'){s.state.device={...s.state.device,activeTermId:'missing-term'};await d.put('device',s.state.device);}
    if(scenario==='conflicting-year'){const otherYear={...s.getYear('n73-year'),id:'other-year'};await d.put('years',otherYear);s.state.years.push(otherYear);const t={...s.getTerm('n73-term'),yearId:otherYear.id};await d.put('terms',t);s.state.terms=s.state.terms.map(row=>row.id===t.id?t:row);}
    if(scenario==='foreign-term'){const t={...s.getTerm('n73-term'),ownerId:'b7300000-0000-4000-8000-000000000002'};await d.put('terms',t);s.state.terms=s.state.terms.map(row=>row.id===t.id?t:row);}
    if(scenario.startsWith('missing')||['ambiguous','ambiguous-year'].includes(scenario)){
     const changes=['missing-year','ambiguous-year'].includes(scenario)?{activeYearId:'missing-year'}:{activeTermId:'missing-term'};
     s.state.device={...s.state.device,...changes};await d.put('device',s.state.device);
    }
   },scenario);
   if(scenario==='existing')await app.evaluate(async rows=>{const s=await import('/src/store.js');await s.importStudents('n73-source-section',rows.slice(0,300).map(r=>r.name));await s.importStudents('n73-source-section',rows.slice(300).map(r=>r.name));},rows);
   await app.evaluate(()=>location.hash='#/settings');await app.locator('input[name=teacherName]').waitFor();await app.evaluate(()=>document.activeElement.blur());
   const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());const before=await disk();
   const source=await c.newPage();await source.goto(base+dash);
   await c.exposeBinding('fixtureExternal',async(_,m)=>{
    if(candidate&&m.type==='n36-outcome'&&m.outcome.status==='unknown'){
     const variants=[{confirmedRows:30001},{pendingRows:-1},{checkpoint:'private-name'},{relation:'private-token'},{studentId:'private-id'}];
     for(const fields of variants){const bad=structuredClone(m);bad.outcome.progress={...bad.outcome.progress,...fields};const denied=await worker.external(bad,{frameId:0});assert.equal(denied.ok,false);assert.equal(worker.data['receipt:'+m.nonce].outcome,undefined);}
    }
    if(scenario==='denied-saved-receipt'&&m.type==='n36-outcome'&&m.outcome.status==='unknown'){const prior=worker.evidence.outcomes.find(r=>r.status==='saved');m={...m,outcome:{status:'saved',added:3,existing:0,remaining:0,total:3,setup:prior.setup}};}
    return worker.external(m,{frameId:0});
   });
   await app.evaluate(()=>{window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}};});
   let deliveries=0,drifted=false;
   const drift=async()=>{drifted=true;await app.evaluate(async()=>{const d=await import('/src/lib/db.js');const device=await d.get('device','device');await d.put('device',{...device,activeTermId:'synthetic-other-term'});});};
   // Inject only at observable runtime boundaries; never alter a receiver guard.
   worker=await backgroundFixture({app,source,base,runtimeFiles,onRead:async (input,data)=>{
    if(input.target.tabId!==99)return;
    if(input.func?.toString().includes('rakeezBeginNamesBatch')&&['optimistic','persistent-start','new-selection'].includes(scenario)){
     await app.evaluate(async scenario=>{
      const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
      await d.put('device',{...s.state.device,activeTermId:'synthetic-other-term'});
      if(scenario==='persistent-start')return;
      if(scenario==='new-selection'){setTimeout(async()=>{const t={...s.getTerm('n73-term'),id:'third-term'};await d.put('terms',t);const device=await d.get('device','device');await d.put('device',{...device,activeTermId:t.id});},150);return;}
      // Delay only this patchDevice openDB await. Its actual optimistic store path
      // and eventual native IndexedDB transaction both run unchanged.
      const resolve=Promise.resolve;
      Promise.resolve=function(value){if(value instanceof IDBDatabase){Promise.resolve=resolve;return new Promise(r=>setTimeout(()=>r(value),3500));}return resolve.call(Promise,value);};
      window.selectionSettles=s.patchDevice({activeYearId:'n73-year',activeTermId:'n73-term'},{notify:false});
     },scenario);
    }
    if(input.args?.[0]?.nonce){const job=data['n36:background-job'];assert.equal(job.context.schoolBinding,'bound');assert.ok(job.context.readProof);assert.ok(job.pending.envelope.rows.length<=300);assert.equal(new Set(job.pending.envelope.rows.map(r=>r.classroom)).size,1);assert.ok(job.setupRejections.some(r=>r.setupKind==='timetable'&&r.setupRejectReason==='live-link-unsafe'));deliveries++;if(scenario==='fallback-ambiguous-at-write')await app.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');await d.put('terms',{...s.getTerm('n73-term'),id:'later-live-term'});});if(scenario==='cross-tab'||scenario==='after-chunk'&&deliveries===2)await drift();}
   }});
   if(['transaction-drift','owner','session','lease','document','readback-unknown','after-owner','after-session','after-lease','after-document','denied-saved-receipt'].includes(scenario))await app.evaluate(async scenario=>{
    const d=await import('/src/lib/db.js'),s=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js'),lease=await import('/src/lib/offline-lease.js');
    const original=IDBDatabase.prototype.transaction,device=await d.get('device','device');let studentTransactions=0;
    IDBDatabase.prototype.transaction=function(names,mode,...args){
     const studentWrite=mode==='readwrite'&&Array.from(names)[0]==='students'&&Array.from(names).includes('enrollments')&&Array.from(names).includes('outbox');if(studentWrite)studentTransactions++;
     if(studentWrite&&(!scenario.startsWith('after-')&&scenario!=='denied-saved-receipt'||studentTransactions===2)&&!window.transactionFault){
      window.transactionFault=true;
      if(scenario==='transaction-drift'){const t=original.call(this,['device'],'readwrite');const r=t.objectStore('device').get('device');r.onsuccess=()=>t.objectStore('device').put({...r.result,activeTermId:'synthetic-other-term'});}
      if(['session','after-session','denied-saved-receipt'].includes(scenario))cloud.setMockAuth(cloud.user,{...cloud.session,access_token:'changed-session'});
      if(['owner','after-owner'].includes(scenario)){const id='b7300000-0000-4000-8000-000000000002';cloud.setMockAuth({id},{user:{id},access_token:'foreign-session'});}
      if(['lease','after-lease'].includes(scenario))lease.runtimeOfflineLease().invalidate('synthetic-lease-expiry');
      if(['document','after-document'].includes(scenario))window.dispatchEvent(new Event('pagehide'));
      if(scenario==='readback-unknown'){
       const getAll=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args){if(this.name==='students'&&this.transaction.mode==='readonly'&&!window.readbackFault){window.readbackFault=true;throw new DOMException('Synthetic readback fault','AbortError');}return getAll.apply(this,args);};
      }
     }
     return original.call(this,names,mode,...args);
    };
   },scenario);
   if(scenario==='saved-before-receipt')await app.evaluate(async()=>{
    // Native IndexedDB fault: reject the final device receipt put after rows committed.
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='device'&&value.n36NamesBatch?.receipts&&Object.keys(value.n36NamesBatch.receipts).length&&!window.receiptFault){window.receiptFault=true;throw new DOMException('Synthetic final receipt fault','AbortError');}return put.call(this,value,...args);};
   });
   await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
   await c.addInitScript(v=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copiedReport=text}});window.chrome={runtime:{getManifest:()=>({version:v}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};},version);
   let popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();await popup.close();
   await worker.wait(d=>['complete','stopped'].includes(d['n36:background-view']?.phase)||Object.entries(d).some(([k,v])=>k.startsWith('receipt:')&&v.outcome?.status==='unknown')||scenario==='denied-saved-receipt'&&d['n36:background-view']?.code==='APP_CHANGED',30000);
   if(Object.entries(worker.data).some(([k,v])=>k.startsWith('receipt:')&&v.outcome?.status==='unknown')){await worker.wake();await worker.wait(d=>d['n36:background-view']?.phase==='receipt'&&(candidate?d['n36:background-view'].failurePhase==='batch':!!d['n36:background-view'].code),5000);}
   if(scenario==='optimistic')await app.evaluate(()=>window.selectionSettles);
   const after=await disk(),v=worker.data['n36:background-view'],trace=worker.evidence;
   if(['transaction-drift','owner','session','lease','document','readback-unknown','after-owner','after-session','after-lease','after-document'].includes(scenario))assert.equal(await app.evaluate(()=>window.transactionFault),true);
   drifted ||= scenario==='transaction-drift';
   const saved=after.students.filter(s=>rows.some(r=>r.name===s.name)).length;
   row={scenario,view:structuredClone(v),saved,deliveries:trace.deliveries.length,receipts:structuredClone(trace.outcomes.filter(r=>!r.progress||r.progress.confirmedRows<=30000&&r.progress.pendingRows>=0&&['none','unresolved','pending','rows-before-receipt','receipts'].includes(r.progress.checkpoint)&&['unresolved','same','original-term'].includes(r.progress.relation)&&!Object.hasOwn(r.progress,'studentId'))),unsafeGETs:requests.filter(p=>p===timetable).length,staged:v.staged,selectedTermUnchanged:after.device[0].activeTermId===(drifted?'synthetic-other-term':before.device[0].activeTermId),pending:!!after.device[0].n36NamesBatch?.pending};
   assert.equal(row.unsafeGETs,0);assert.deepEqual(after.scores,before.scores);assert.deepEqual(after.years,before.years);for(const name of Object.keys(before))assert.deepEqual(after[name].filter(r=>r.ownerId===foreignOwner),before[name].filter(r=>r.ownerId===foreignOwner));for(const key of Object.keys(before.device[0]).filter(k=>!['n36NamesBatch','activeTermId','updatedAt'].includes(k)))assert.deepEqual(after.device[0][key],before.device[0][key]);if(!['persistent-start','new-selection'].includes(scenario))assert.ok(row.selectedTermUnchanged);assert.deepEqual(unexpected,[]);
   if(!candidate){
    assert.equal(v.phase,'receipt');assert.equal(v.code,scenario==='saved-before-receipt'?'WRITE_FAILED':'BATCH_PERSISTED_TERM_CHANGED');assert.equal(v.staged,303);assert.equal(v.schoolBindingState,'bound');assert.equal(v.setupRejectReason,'live-link-unsafe');
    assert.equal(saved,['after-chunk','saved-before-receipt','readback-unknown','after-owner','after-session','after-lease','after-document'].includes(scenario)?300:0);assert.equal(trace.outcomes.at(-1).status,'unknown');
   }else if(['missing-year','missing-term','deleted-year','deleted-term','optimistic','normal','multiclass','existing'].includes(scenario)){
    assert.equal(v.phase,'complete',JSON.stringify(v));assert.equal(saved,303);assert.equal(v.added,scenario==='existing'?0:303);if(scenario==='existing'){assert.equal(v.existing,303);assert.deepEqual(after.students,before.students);}assert.deepEqual(trace.outcomes.map(r=>r.total),scenario==='multiclass'?[100,100,100,3]:[300,3]);assert.ok(trace.outcomes.every(r=>r.status===(scenario==='existing'?'existing':'saved')));assert.equal(new Set(trace.deliveries).size,scenario==='multiclass'?4:2);
   }else if(['ambiguous','ambiguous-year','conflicting-year','foreign-term','persistent-start','new-selection','disk-ambiguous','foreign-term-disk'].includes(scenario)){
    assert.equal(v.phase,'stopped');assert.equal(v.code,'APP_ACADEMIC_SELECTION_REQUIRED');assert.equal(v.staged,0);assert.equal(trace.deliveries.length,0);assert.equal(saved,0);assert.equal(requests.filter(p=>p!==dash).length,0);
   }else if(scenario==='denied-saved-receipt'){
    assert.equal(saved,300);assert.equal(v.phase,'receipt');assert.equal(v.code,'APP_CHANGED');assert.equal(v.added,300);assert.equal(trace.deliveries.length,2);assert.equal(Object.keys(after.device[0].n36NamesBatch.receipts).length,1);assert.equal(worker.data['n36:background-job'].pending.envelope.rows.length,3);row.syntheticTrap='A saved receipt under denied app guard was not consumed';
   }else{
    assert.equal(saved,['after-chunk','saved-before-receipt','readback-unknown','after-owner','after-session','after-lease','after-document'].includes(scenario)?300:0);assert.equal(trace.outcomes.at(-1).status,'unknown');assert.equal(trace.deliveries.length,scenario.startsWith('after-')?2:1);
   }
   popup=await c.newPage();await popup.setViewportSize({width:430,height:600});await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.locator('#copy-safe-report').waitFor();if(v.phase==='complete')await popup.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('حُفظ'));if(v.setupPartial)await popup.locator('#run-missing').waitFor({state:'visible'});assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(candidate&&v.phase==='receipt'&&v.code)await popup.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('غير محسومة'));
   if(candidate&&scenario.startsWith('after-')){assert.equal(Object.keys(after.device[0].n36NamesBatch.receipts).length,1);assert.equal(Object.values(after.device[0].n36NamesBatch.receipts)[0].total,300);assert.deepEqual(Object.values(after.device[0].n36NamesBatch.receipts)[0],row.receipts[0]);}
   await popup.locator('#copy-safe-report').click();await popup.waitForFunction(()=>!!window.copiedReport);const report=await popup.evaluate(()=>window.copiedReport);row.diagnostic=JSON.parse(report).collection;
   if(candidate&&trace.outcomes.at(-1)?.status==='unknown'){assert.equal(row.diagnostic.confirmedRows,v.confirmedRows);assert.equal(row.diagnostic.pendingSavedRows,v.pendingSavedRows);assert.equal(row.diagnostic.receiverCheckpoint,v.receiverCheckpoint);assert.equal(row.diagnostic.failurePhase,'batch');}
   assert.ok(!report.includes(owner)&&!report.includes('طالب اصطناعي')&&!report.includes('مدرسة اصطناعية')&&!report.includes(A)&&!report.includes('synthetic-other-term'));
   if(candidate&&['after-chunk','saved-before-receipt','cross-tab','transaction-drift','document','readback-unknown'].includes(scenario)){
    await app.evaluate(()=>location.hash='#/classes/koshoof?import=1');await app.locator('[data-n36-direct]').waitFor();
    await app.locator('[data-act=n36-batch-resume]').click();await app.waitForTimeout(150);const final=await disk();assert.deepEqual(final.students,after.students);assert.deepEqual(final.device,after.device);assert.equal(trace.outcomes.at(-1).status,'unknown');row.recoveryText=await app.locator('[data-n36-handoff-status]').innerText();row.localProgress=await app.evaluate(()=>window.rakeezNamesLocalProgress());const sourceReads=worker.evidence.reads,nonce=worker.data['n36:background-job']?.pending?.actionId;await worker.internal({type:'n36-job-start',sourceTabId:7});assert.match(nonce,/^[a-f0-9]{64}$/);assert.equal(worker.data['n36:background-job']?.pending?.actionId,nonce);assert.equal(worker.evidence.reads,sourceReads);assert.deepEqual((await disk()).device,after.device);row.sameBatchAndNoncePreserved=true;if(scenario==='saved-before-receipt'){const id=worker.data['n36:background-job'].batchId;assert.equal(await app.evaluate(({id,nonce})=>window.rakeezReceiveNamesBatch({extensionId:'a'.repeat(32),nonce},id),{id,nonce}),true);await app.waitForTimeout(60);assert.deepEqual((await disk()).students,after.students);row.sameNonceDuplicateIgnored=true;}if(scenario==='saved-before-receipt')await app.screenshot({path:folder+'pending-readback-receiver.png',fullPage:true});if(['saved-before-receipt','readback-unknown'].includes(scenario)){assert.equal(row.localProgress.pendingSavedRows,300);assert.equal(row.localProgress.confirmedRows,0);}if(scenario==='after-chunk'){assert.equal(row.localProgress.confirmedRows,300);assert.equal(row.localProgress.confirmedReceipts,1);assert.equal(row.localProgress.relation,'original-term');}
   }
   if(candidate&&trace.outcomes.at(-1)?.status==='unknown'){
    const k=Object.keys(worker.data).find(k=>k.startsWith('receipt:'));
    if(k){const nonce=k.slice(8),outcome={...trace.outcomes.at(-1),status:'saved',added:300,existing:0,remaining:0,total:300};delete outcome.progress;delete outcome.failure;
     const differentDocument=await worker.external({type:'n36-outcome',nonce,outcome},{frameId:0,documentId:'different-document'});assert.equal(differentDocument.ok,false);
     worker.data[k].expiresAt=Date.now()-1;const expired=await worker.external({type:'n36-outcome',nonce,outcome},{frameId:0});assert.equal(expired.ok,false);assert.equal(worker.data[k].outcome.status,'unknown');row.expiredAndDifferentDocumentDenied=true;
    }
   }
   if(candidate&&scenario==='missing-year'){await popup.screenshot({path:folder+'candidate-popup.png',fullPage:true});await app.screenshot({path:folder+'candidate-receiver.png',fullPage:true});}
   row.status='PASS';console.log('PASS '+version+' '+scenario);
  }catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}
  finally{if(row.view)delete row.view.id;result.cases.push(row);worker?.release();worker?.kill();await c.close();}
 }
 });
}catch(e){result.error=e.stack;process.exitCode=1;console.error(e.stack);}
finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true};result.status=!result.error&&result.cases.every(c=>c.status==='PASS')?'PASS':'FAIL';await fs.writeFile(folder+(process.env.N36_LABEL??(candidate?'candidate':'baseline'))+'.json',JSON.stringify(result,null,2)+'\n');}
