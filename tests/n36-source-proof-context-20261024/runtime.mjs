// AI-authored: actual popup, serialized source handlers, automatic worker and account receiver.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
import {syntheticService,owner,foreignOwner} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {html,dash,home,report,classes,timetable,roster,meta} from '../n36-fresh-account-start-20261023/source-fixture.mjs';
const taskId='continuous-n36-source-proof-context-20261024',runId='ace0c1d5-3605-4e94-a7bb-09ff8206ba23';
const baseSha='aa761cc6583385d0a5215c49324f68d20b0f8ba0',folder='tests/n36-source-proof-context-20261024/',base='http://127.0.0.1:49964',root=resolve('.');
const baseline=process.argv.includes('--baseline'),runtimeDir='extensions/rakeez-teacher-import-helper/';
const runtimeFiles=baseline||process.argv.includes('--package')?unzipSync(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-'+(baseline?'0.5.41':'0.5.42')+'.zip')):null;
const runtimeVersion=JSON.parse(Buffer.from(runtimeFiles?runtimeFiles['manifest.json']:await fs.readFile(runtimeDir+'manifest.json')).toString()).version;
let service,worker,source,mode,entry,changed=false,requests=[];
const result={taskId,runId,baseSha,baseline,boundary:'Fresh isolated loopback; actual popup/CSS, .41 baseline or candidate worker/source readers, actual receiver/store/IndexedDB with fake account service; source DOM is synthetic, not official captured DOM.',cases:[]};
result.runtimeVersion=runtimeVersion;
result.sourceHashes=Object.fromEntries(await Promise.all(['selection.js','background-runner.js','source-adapter.js','diagnostics-bootstrap.js','run-controller.js'].map(async name=>[name,createHash('sha256').update(runtimeFiles?runtimeFiles[name]:await fs.readFile(runtimeDir+name)).digest('hex')])));
function sourceHTML(u){
 if(u.pathname===report){
 const names=Array.from({length:50},(_,i)=>'<tr><td>طالب اصطناعي '+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26)+'</td><td>مستمر</td><td>مدرسة اصطناعية</td><td>خامس'+(1+i%10)+'</td>'+Array(5).fill('<td>unused</td>').join('')+'</tr>').join('');
 return '<meta charset=utf-8><nav class=pagination><span aria-current=page>1</span><span role=status>الصفحة 1 من 1</span><button disabled>التالي</button></nav><table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(s=>'<th>'+s+'</th>').join('')+'</tr>'+names+'</table>';
 }
 return html(u).replace('<p data-role>معلم</p>','').replace('>جدولي</a>','>الجدول الدراسي</a>');
}
const sourcePaths=[home,dash,report,classes,meta,new URL(timetable,base).pathname,new URL(roster,base).pathname];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.startsWith('/__n73/')){let body='';for await(const b of req)body+=b;res.setHeader('content-type','application/json');return res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));}
 if(sourcePaths.includes(u.pathname)){requests.push(u.pathname);res.setHeader('content-type','text/html;charset=utf-8');return res.end(sourceHTML(u));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));
 let bytes=runtimeFiles&&u.pathname.startsWith('/'+runtimeDir)?Buffer.from(runtimeFiles[u.pathname.slice(runtimeDir.length+1)]):await fs.readFile(f);if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
async function mutation(){
 changed=true;
 await source.evaluate(async mode=>{await new Promise(r=>setTimeout(r,10));
 if(mode.startsWith('pending-')&&mode!=='pending-hash')mode=mode.slice(8);
 const byText=s=>Array.from(document.querySelectorAll('p,a,button')).find(n=>n.textContent===s);
 if(mode==='hash'||mode==='pending-hash')history.replaceState(null,'',location.pathname+location.search+'#panel');
 if(mode==='enrich')byText('تقارير المعلم').remove(); // 3 -> 2 still coherent semantic actions.
 if(mode==='duplicate')document.querySelector('nav').append(byText('تقارير المعلم').cloneNode(true));
 if(mode==='redraw'){const nav=document.querySelector('nav');nav.replaceWith(nav.cloneNode(true));}
 if(mode.startsWith('busy')){const n=document.createElement('span');n.setAttribute('role','progressbar');n.textContent='تحميل';document.body.append(n);if(mode!=='busy-stuck')setTimeout(()=>n.remove(),500);
 if(mode==='busy-teacher')setTimeout(()=>byText('اسم المعلم: معلم اصطناعي').textContent='اسم المعلم: معلم آخر',150);
 if(mode==='busy-role')setTimeout(()=>document.body.insertAdjacentHTML('beforeend','<p data-role>الطالب</p>'),150);
 }
 if(mode==='teacher')byText('اسم المعلم: معلم اصطناعي').textContent='اسم المعلم: معلم آخر';
 if(mode==='teacher-absent')byText('اسم المعلم: معلم اصطناعي').remove();
 if(mode==='school')document.querySelector('.school-name').textContent='مدرسة أخرى';
 if(mode==='school-absent')document.querySelector('.school-name').remove();
 if(mode==='schoolid')byText('قائمة الطلاب').href=byText('قائمة الطلاب').href.replace('a'.repeat(32),'d'.repeat(32));
 if(mode==='role')document.body.insertAdjacentHTML('beforeend','<p data-role>الطالب</p>');
 if(mode==='login')document.body.insertAdjacentHTML('beforeend','<input type=password>');
 if(mode==='primary-duplicate')document.querySelector('nav').append(byText('قائمة الطلاب').cloneNode(true));
 if(mode==='primary-unsafe')byText('قائمة الطلاب').setAttribute('onclick','void(0)');
 if(mode==='semantic-lost')byText('سجلات المتابعة اليومية').remove();
 if(mode==='query')history.replaceState(null,'',location.pathname+'?changed=1');
 if(mode==='allowed-query')history.replaceState(null,'',location.pathname+'?id=changed');
 if(mode==='path')history.replaceState(null,'','/SchoolManagment/Actions/Teacher/other');
 if(mode==='job')globalThis.rakeezTeacherReadGuard.jobId='foreign-synthetic-job';
 },mode);
 if(mode==='document')worker.changeSourceDocument();
 if(mode==='owner')await workerApp.evaluate(async id=>{(await import('/src/lib/cloud.js')).setMockAuth({id},{user:{id},access_token:'foreign-synthetic'});},foreignOwner);
 if(mode==='session')await workerApp.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,{...c.session,access_token:'changed-synthetic'});});
}
let workerApp;
try{
 await new Promise(r=>server.listen(49964,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(entry of (process.env.N36_ENTRIES??'dashboard,teacher').split(','))for(mode of (process.env.N36_CASES??'none,hash,enrich,duplicate,redraw,busy').split(',')){
 const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});let row={entry,mode};service=syntheticService();changed=false;requests=[];
 try{
 await c.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const app=workerApp=await c.newPage();await openReadyServedDemo(app,base);await app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
 await app.evaluate(()=>location.hash='#/settings');await app.locator('input[name=teacherName]').waitFor();
 const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()),before=await disk();
 source=await c.newPage();await source.goto(base+(entry==='dashboard'?home:dash));
 await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});
 worker=await backgroundFixture({app,source,base,runtimeFiles,onRead:async(input,data)=>{
 if(!changed&&mode!=='none'&&data['n36:background-job']?.sourceRows?.length===50&&(!mode.startsWith('pending-')||input.func?.name==='readSourceReportPage'&&input.args?.[0]==='fetch')){row.atMutation={staged:50,phase:data['n36:background-job'].phase,receipts:worker.evidence.outcomes.length};row.requestsAtMutation=requests.length;await mutation();}
 }});
 await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
 await c.addInitScript(version=>window.chrome={runtime:{getManifest:()=>({version}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}},runtimeVersion);
 const popup=await c.newPage();await popup.goto(base+'/'+runtimeDir+'popup.html');await popup.locator('#one-start:not([disabled])').waitFor();await popup.locator('#one-start').click();
 await worker.wait(d=>['complete','stopped'].includes(d['n36:background-view']?.phase),18000);
 const v=worker.data['n36:background-view'],after=await disk();row.view=Object.fromEntries(['phase','code','staged','observed','classes','processedPages','confirmedRows','confirmedReceipts','pendingRows','failureStep','failureJobPhase','schoolBindingState','roleProofKind','proofMismatch'].map(k=>[k,v[k]]));row.receipts=worker.evidence.outcomes.map(o=>({status:o.status,total:o.total}));row.navigation=worker.evidence.navigation.length;row.changed=changed;
 assert.equal(row.navigation,0);assert.equal(v.staged,50);assert.equal(v.classes,10);
 const negative=['teacher','teacher-absent','school','school-absent','schoolid','role','login','query','allowed-query','path','document','owner','session','busy-stuck','busy-teacher','busy-role','primary-duplicate','primary-unsafe','semantic-lost','pending-job','pending-allowed-query','pending-path','pending-school','pending-role','pending-login'].includes(mode);
 const expectedStop=negative||baseline&&['hash','pending-hash','enrich','duplicate','busy'].includes(mode);
 assert.equal(v.phase,expectedStop?'stopped':'complete',JSON.stringify(row.view));
 if(expectedStop){assert.equal(row.receipts.length,0);assert.deepEqual(after.students,before.students);assert.deepEqual(after.outbox,before.outbox);assert.equal(v.confirmedRows,0);assert.equal(v.processedPages,0);assert.equal(requests.length,row.requestsAtMutation,'No further source GET after drift');
 const codes={teacher:'TEACHER_CONTEXT_CHANGED','teacher-absent':'TEACHER_CONTEXT_CHANGED',school:'SCHOOL_CONTEXT_CHANGED','school-absent':'TEACHER_CONTEXT_CHANGED',schoolid:'SCHOOL_CONTEXT_CHANGED',role:'NON_TEACHER_ROLE',login:'LOGIN_OR_LOGOUT',query:'UNSAFE_ROUTE',path:'SOURCE_CONTEXT_CHANGED',document:'SOURCE_BINDING_CHANGED',owner:'APP_CHANGED',session:'APP_CHANGED','busy-stuck':'SOURCE_PENDING','busy-teacher':'UNCONFIRMED_TEACHER_ROLE','busy-role':'NON_TEACHER_ROLE','primary-duplicate':'UNCONFIRMED_TEACHER_ROLE','primary-unsafe':'UNCONFIRMED_TEACHER_ROLE','semantic-lost':'UNCONFIRMED_TEACHER_ROLE'};
 if(negative)assert.equal(v.code,mode==='allowed-query'||mode==='pending-allowed-query'?'SOURCE_CONTEXT_CHANGED':mode==='pending-job'?'TEACHER_CONTEXT_CHANGED':codes[mode.replace(/^pending-/,'')]);
 if(mode==='teacher'){
 // Existing fixture has no Chrome storage change events: reopen the actual
 // popup so its normal startup reads the final background view.
 await popup.reload();
 await popup.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.fixtureSafeReport=t},configurable:true}));
 await popup.waitForFunction(()=>n36Diagnostics&&document.querySelector('#one-start').disabled===false);await popup.waitForTimeout(600);await popup.locator('#copy-safe-report').click();
 const safe=await popup.evaluate(()=>JSON.parse(fixtureSafeReport));assert.equal(safe.collection.proofMismatch,'teacher');assert.equal(JSON.stringify(safe).includes('معلم آخر'),false);assert.equal(JSON.stringify(safe).includes(base),false);
 await popup.evaluate(()=>n36Diagnostics.publish({proofMismatch:'https://private.invalid/name'}));await popup.locator('#copy-safe-report').click();assert.equal(await popup.evaluate(()=>JSON.parse(fixtureSafeReport).collection.proofMismatch),'unknown');row.safeMismatchAllowlist=true;
 }
 }
 else{assert.equal(v.confirmedRows,50);assert.equal(row.receipts.length,10);assert.ok(row.receipts.every(o=>o.status==='saved'&&o.total===5));assert.equal(after.students.length-before.students.length,50);assert.ok(after.outbox.every(o=>o.ownerId===owner));assert.deepEqual(after.scores,before.scores);assert.deepEqual(after.years,before.years);
 const receipt=after.device[0].n36NamesBatch;assert.equal(Object.keys(receipt.receipts).length,10);
 // Reopen the exact owner database read-only in the new document. This is
 // physical receipt durability, not a claim of authenticated boot/restore.
 await app.reload();const reloaded=await app.evaluate(async owner=>{
 const name=await(await import('/src/lib/workspaces.js')).accountWorkspaceDatabaseName(owner);
 const db=await new Promise((r,j)=>{const q=indexedDB.open(name);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
 try{return await new Promise((r,j)=>{const t=db.transaction(['device','students'],'readonly'),d=t.objectStore('device').get('device'),s=t.objectStore('students').getAll();t.oncomplete=()=>r({owner:d.result.accountProvisioningReceipt.ownerId,students:s.result,receipt:d.result.n36NamesBatch});t.onerror=()=>j(t.error);});}finally{db.close();}
 },owner);assert.equal(reloaded.owner,owner);assert.deepEqual(reloaded.students,after.students);assert.deepEqual(reloaded.receipt,receipt);row.durableReceiptReadback=true;
 }
 row.status='PASS';console.log('PASS '+entry+' '+mode+' '+v.phase+' '+(v.code??''));
 }catch(e){row.status='FAIL';row.failure=e.message;console.error(entry,mode,e.stack);process.exitCode=1;}
 finally{worker?.release();worker?.kill();await c.close();result.cases.push(row);}
 }
 });
}finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true,sharedLease:'exempt: canonical local synthetic helper'};result.status=result.cases.length&&result.cases.every(c=>c.status==='PASS')?'PASS':'FAIL';await fs.writeFile(folder+(baseline?'baseline':'candidate')+(process.env.N36_LABEL??'')+'.json',JSON.stringify(result,null,2)+'\n');}
