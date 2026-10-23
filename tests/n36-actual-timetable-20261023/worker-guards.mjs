// AI-authored: real mounted app/popup + serialized current reader/worker + native IndexedDB.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';
import {withSharedLocalBrowser as withIsolatedLocalBrowser} from './shared-browser.mjs';
import {backgroundFixture} from './worker-fixture.mjs';
import {sourceHTML,dash,home,role,report,roster,timetable,classes,meta,department,displaySchool,school} from './source.mjs';
const taskId='continuous-n36-actual-timetable-dom-20261023',runId='52da0f25-3635-4831-8a38-3d1d0d09cd23';
let base='http://127.0.0.1:49971';const folder='tests/n36-actual-timetable-20261023/',root=resolve('.'),baseline=process.argv.includes('--baseline');let options={},requests=[],worker;
const baseSha='7fa9b61259df3036caf8e6eda6bf03196d7d4d2e',runtimeDir='extensions/rakeez-teacher-import-helper/';
const baselineFiles=baseline?Object.fromEntries(JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.40.manifest.json','utf8')).files.map(f=>[f.file,execFileSync('git',['show',baseSha+':'+runtimeDir+f.file])])):null;
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);
 if(u.pathname===role){res.writeHead(302,{location:dash});return res.end();}
 if([dash,home,report,new URL(roster,base).pathname,new URL(timetable,base).pathname,classes,meta].includes(u.pathname)){requests.push(u.pathname);res.setHeader('content-type','text/html;charset=utf-8');return res.end(sourceHTML(u,options));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));let bytes=await fs.readFile(f);
 if(baseline&&u.pathname.startsWith('/'+runtimeDir))bytes=baselineFiles[u.pathname.slice(runtimeDir.length+1)];
 if(baseline&&['/src/views/class-import-center.js','/src/lib/teacher-setup-import.js'].includes(u.pathname))bytes=execFileSync('git',['show',baseSha+':'+u.pathname.slice(1)]);
 if(u.pathname==='/')bytes=Buffer.from(bytes.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="/tests/n36-complete-import-outcome-20261023/bootstrap.mjs"></script>'));
 if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,baseline,cases:[]};
try{await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});base='http://127.0.0.1:'+server.address().port;await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const scenario of (process.env.N36_CASES??'teacher-return,school-return,role-return,login-return,owner,session').split(',')){
 const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),row={scenario};requests=[];
 try{
 options={count:2,schoolName:school,multi:scenario==='restart',setup:scenario!=='populated',label:scenario==='label',pager:scenario==='unknown'?'unknown':scenario==='gap'?'gap':'complete',excluded:scenario==='excluded',ambiguous:scenario==='ambiguous',subject:scenario!=='no-subject'};
 const app=await c.newPage();app.on('pageerror',e=>console.log('PAGE '+e.message));await app.goto(base+'/?case='+scenario+'#/classes/koshoof?import=1');await app.waitForFunction(()=>window.fixtureReady&&window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});
 const ready=()=>app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable&&typeof window.rakeezBeginNamesBatch==='function';});await ready();
 const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
 const before=await disk();assert.equal(before.sections.length,0);assert.equal(before.students.length,0);
 await app.evaluate(()=>history.replaceState(null,'','/'+location.hash));const source=await c.newPage();await source.goto(base+(scenario==='populated'||scenario==='label'?home:dash));
 await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});
 let checkpoint=null,restarted=false,actualSourceDocument=null;
 const makeWorker=async data=>{worker=await backgroundFixture({app,source,base,data,styleCostMs:1,sourceDocumentNumber:restarted?actualSourceDocument:null,runtimeFiles:baselineFiles,denySource:scenario==='permissions',onStorage:async()=>{const j=worker?.data['n36:background-job'];if(j?.pending?.envelope){const proof=j.pending.envelope.setup.find(c=>c.category==='school');assert.equal(proof.rows[0].name,school);assert.deepEqual(proof.provenance,['teacher-readonly-run']);row.rawSchoolProvenancePreserved=true;}if(scenario==='restart'&&!restarted&&j?.phase==='transfer'&&Object.keys(j.acknowledged??{}).length===1){checkpoint=structuredClone(worker.data);worker.kill();}},onRead:async input=>{
 if(input.args?.[0]==='rendered-timetable'&&!row.injected){row.injected=true;
 if(scenario.endsWith('-return'))options.returnVariant=scenario.replace('-return','');
 else if(scenario==='owner')await app.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');const user={id:'b7300000-0000-4000-8000-000000000002'};cloud.setMockAuth(user,{...cloud.session,user,access_token:'synthetic-foreign-account'});});
 else if(scenario==='session')await app.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');cloud.setMockAuth(cloud.user,{...cloud.session,access_token:'synthetic-changed'});});
 else if(scenario==='stale'){await source.reload();worker.changeSourceDocument();}
 else await source.evaluate(scenario=>{const a=document.querySelector('.cs-lesson-card > a'),table=a.closest('table');
  if(scenario==='timeout')window.fixtureStyleCalls=31000;
  if(scenario==='hidden'){const s=document.createElement('style');s.textContent='.cs-lesson-card{display:none}';document.head.append(s);}
  if(scenario==='nav'){const n=document.createElement('nav');table.parentElement.append(n);n.append(table);}
  if(scenario==='foreign')a.href=a.href.replace('SchoolId='+'a'.repeat(32),'SchoolId='+'b'.repeat(32));
  if(scenario==='mixed'){const n=document.createElement('a');n.href='/other?SchoolId='+'b'.repeat(32);document.body.append(n);}
  if(scenario==='duplicate')a.href+='&subjectId=2';
  if(scenario==='unsafe-path')a.href=a.href.replace('ManageLecture','EditLecture');
  if(scenario==='base'){const b=document.createElement('base');b.href='https://unvisited.invalid/';document.head.append(b);}
  if(scenario==='login'){const n=document.createElement('input');n.type='password';document.body.append(n);}
  if(scenario==='role'){const n=document.createElement('p');n.setAttribute('data-role','');n.textContent='الطالب';document.body.append(n);}
  if(scenario==='missing-day')table.rows[1].cells[0].textContent='غير معروف';
  if(scenario==='explicit-teacher'){const t=document.createElement('table');t.innerHTML='<tr><th>اسم المعلم</th><td>معلم مختلف</td></tr>';document.body.append(t);}
 },scenario);
 }
 }});const timer=setInterval(()=>worker?.release(),10);timer.unref();return ()=>clearInterval(timer);};const initialData=scenario==='legacy'?{'n36:background-view':JSON.parse(await fs.readFile(folder+'baseline.json','utf8')).cases.find(c=>c.scenario==='fresh').view}:{};let stopRelease=await makeWorker(initialData);
 if(scenario==='permissions'){
 assert.deepEqual(await worker.internal({type:'n36-job-start',sourceTabId:7},{id:'p'.repeat(32)}),{ok:false});
 const denied=await worker.internal({type:'n36-job-start',sourceTabId:7});assert.equal(denied.ok,false);assert.equal(denied.code,'SOURCE_ACCESS_REQUIRED');assert.deepEqual((await disk()).students,before.students);assert.equal(worker.evidence.reads,0);
 const late=await worker.external({type:'n36-outcome',nonce:'f'.repeat(64),outcome:{status:'saved',added:2,existing:0,remaining:0,total:2}},{frameId:0});assert.equal(late.ok,false);assert.equal(late.code,'RECEIPT_SENDER');
 row.denied=denied;row.late=late;row.status='PASS';stopRelease();console.log('PASS '+scenario);continue;
 }
 await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
 await c.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copiedReport=text}});window.chrome={runtime:{getManifest:()=>({version:'0.5.40'}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};});
 let popup=await c.newPage();const open=async()=>{await popup.setViewportSize({width:430,height:640});await popup.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html');await popup.locator('#one-start:not([disabled])').waitFor();};await open();
 if(scenario==='legacy'){
 const status=await worker.internal({type:'n36-job-status'});assert.equal(status.view.confirmedRows,302);assert.equal(status.view.confirmedReceipts,null);assert.equal(worker.data['n36:background-view'].confirmedRows,0);assert.deepEqual(await disk(),before);assert.equal(worker.evidence.reads,0);
 row.popup=await popup.locator('body').innerText();assert.ok(row.popup.includes('302'));assert.ok(row.popup.includes('عدد الإيصالات غير محفوظ'));await popup.screenshot({path:folder+'legacy-popup.png',fullPage:true});row.view=status.view;row.status='PASS';stopRelease();console.log('PASS '+scenario);continue;
 }
 const run=async()=>{const id=worker.data['n36:background-view']?.id;await popup.locator('#one-start').click();if(process.env.N36_NAV_RESTART==='1'&&!restarted){await worker.wait(()=>!!checkpoint);stopRelease();worker.kill();restarted=true;row.restartBeforeReturnProof=true;stopRelease=await makeWorker(checkpoint);}if(scenario==='restart'&&!restarted){await worker.wait(()=>!!checkpoint);stopRelease();worker.kill();row.restartCheckpoint=checkpoint['n36:background-view'];assert.equal(row.restartCheckpoint.confirmedRows,2);assert.equal(row.restartCheckpoint.confirmedReceipts,1);restarted=true;stopRelease=await makeWorker(checkpoint);}
 await worker.wait(d=>['complete','stopped'].includes(d['n36:background-view']?.phase)&&d['n36:background-view'].id!==id,45000);return structuredClone(worker.data['n36:background-view']);};
 row.view=await run();row.requests=[...requests];row.outcomes=structuredClone(worker.evidence.outcomes);let after=await disk();
 row.durable={students:after.students.length,sections:after.sections.length,teachings:after.teachings.length,slots:after.slots.length,profile:after.profile,receipts:Object.values(after.device[0].n36NamesBatch?.receipts??{}).map(r=>r.total)};
 if(baseline){row.status='OBSERVED';console.log(JSON.stringify(row));stopRelease();continue;}
 const expected={'teacher-return':'TEACHER_CONTEXT_CHANGED','school-return':'SCHOOL_CONTEXT_CHANGED','role-return':'NON_TEACHER_ROLE','login-return':'LOGIN_OR_LOGOUT',owner:'APP_CHANGED',session:'APP_CHANGED',stale:'SOURCE_BINDING_CHANGED',timeout:'TEACHER_TRANSITION_UNRESOLVED',hidden:'AMBIGUOUS_LESSON_LINKS',nav:'SCHOOL_CONTEXT_UNCONFIRMED',foreign:'SCHOOL_CONTEXT_CHANGED',mixed:'SCHOOL_CONTEXT_CHANGED',duplicate:'UNSAFE_LESSON_LINK',base:'UNSAFE_SETUP_LINK',login:'LOGIN_OR_LOGOUT',role:'NON_TEACHER_ROLE','missing-day':'UNRESOLVED_WEEKDAY','unsafe-path':'UNSAFE_LESSON_LINK','explicit-teacher':'TEACHER_CONTEXT_CHANGED'};
 assert.equal(row.injected,true);assert.equal(row.view.phase,'stopped');assert.equal(row.view.code,expected[scenario],JSON.stringify(row.view));
 for(const k of ['students','sections','teachings','slots','profile','scores','years','terms','calendars','calendarDays'])assert.deepEqual(after[k],before[k],k);
 assert.equal(worker.evidence.outcomes.length,0);row.noRowsOrSetupAdmitted=true;
 stopRelease();row.status='PASS';console.log('PASS '+scenario);
 }catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();worker=null;await c.close();result.cases.push(row);}
 }
 });}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();if(server.listening)await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,sharedBrowserFinally:true};await fs.writeFile(folder+(process.env.N36_LABEL??'worker-identity-guards')+'.json',JSON.stringify(result,null,2)+'\n');}
