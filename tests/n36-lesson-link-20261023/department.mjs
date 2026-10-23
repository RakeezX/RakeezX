// AI-authored: real mounted app/popup + serialized .37 reader/worker + native IndexedDB.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
import {sourceHTML,dash,home,role,report,roster,timetable,classes,meta,department,displaySchool,school} from './source.mjs';
const taskId='continuous-n36-lesson-link-school-department-outcome-20261023',runId='2e3dee0a-bade-41d6-96e5-5173af64ed5c';
const base='http://127.0.0.1:49973',folder='tests/n36-lesson-link-20261023/',root=resolve('.'),baseline=false;let options={},requests=[],worker;
const baseSha='a068e8db4d3793c067a07b400bfd3f146ef8dc91',runtimeDir='extensions/rakeez-teacher-import-helper/';
const baselineFiles=baseline?Object.fromEntries(JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.39.manifest.json','utf8')).files.map(f=>[f.file,execFileSync('git',['show',baseSha+':'+runtimeDir+f.file])])):null;
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
try{await new Promise(r=>server.listen(49973,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const scenario of (process.env.N36_CASES??'suffix,ambiguous,unknown,label-conflict,label-explicit,owner,session,atomic').split(',')){
 const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),row={scenario};requests=[];
 try{
 options={count:2,explicitDepartment:scenario==='label-conflict'?'الإدارة العامة للتعليم بمنطقة الرياض':scenario==='label-explicit'?department:null,schoolOverride:scenario==='ambiguous'?'مدرسة اصطناعية بالرياض بمكة المكرمة':scenario==='unknown'?'مدرسة اصطناعية بغير معروف':scenario==='label-explicit'?'مدرسة اصطناعية':null,multi:false,setup:true,pager:'complete',excluded:false,ambiguous:false,subject:true};
 const app=await c.newPage();app.on('pageerror',e=>console.log('PAGE '+e.message));await app.goto(base+'/?case=conflict'+'#/classes/koshoof?import=1');await app.waitForFunction(()=>window.fixtureReady&&window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});
 const ready=()=>app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable&&typeof window.rakeezBeginNamesBatch==='function';});await ready();
 const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
 const before=await disk();assert.equal(before.sections.length,0);assert.equal(before.students.length,0);
 if(['owner','session','atomic'].includes(scenario))await app.evaluate(async mode=>{
 if(window.departmentArmed)return;window.departmentArmed=true;window.departmentTransactions=[];
 const cloud=await import('/src/lib/cloud.js'),store=await import('/src/store.js');let count=0;const original=IDBDatabase.prototype.transaction;
 IDBDatabase.prototype.transaction=function(names,modeTx,...rest){const tx=original.call(this,names,modeTx,...rest);if(modeTx==='readwrite'){window.departmentTransactions.push(Array.from(names));if(Array.isArray(names)&&names.includes('profile')&&names.includes('outbox')&&names.includes('years')&&++count===2){window.departmentFault=true;if(mode==='atomic')tx.abort();if(mode==='owner')store.state.profile.ownerId='b7300000-0000-4000-8000-000000000002';if(mode==='session')cloud.setMockAuth(cloud.user,{...cloud.session,access_token:'synthetic-changed'});}}return tx;};
 },scenario);

 await app.evaluate(()=>history.replaceState(null,'','/'+location.hash));const source=await c.newPage();await source.goto(base+(scenario==='populated'||scenario==='label'?home:dash));
 await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});
 let checkpoint=null,restarted=false;
 const makeWorker=async data=>{worker=await backgroundFixture({app,source,base,data,runtimeFiles:baselineFiles,denySource:scenario==='permissions',onStorage:async()=>{const j=worker?.data['n36:background-job'];if(scenario==='restart'&&!restarted&&j?.phase==='transfer'&&Object.keys(j.acknowledged??{}).length===1){checkpoint=structuredClone(worker.data);worker.kill();}},onRead:async input=>{
 if(input.args?.[0]?.schema==='rakeez-extension-names')assert.equal(input.args[0].setup.find(c=>c.category==='school').rows[0].name,options.schoolOverride??school);
 }});const timer=setInterval(()=>worker?.release(),10);timer.unref();return ()=>clearInterval(timer);};const initialData=scenario==='legacy'?{'n36:background-view':JSON.parse(await fs.readFile(folder+'baseline.json','utf8')).cases.find(c=>c.scenario==='fresh').view}:{};let stopRelease=await makeWorker(initialData);
 if(scenario==='permissions'){
 assert.deepEqual(await worker.internal({type:'n36-job-start',sourceTabId:7},{id:'p'.repeat(32)}),{ok:false});
 const denied=await worker.internal({type:'n36-job-start',sourceTabId:7});assert.equal(denied.ok,false);assert.equal(denied.code,'SOURCE_ACCESS_REQUIRED');assert.deepEqual((await disk()).students,before.students);assert.equal(worker.evidence.reads,0);
 const late=await worker.external({type:'n36-outcome',nonce:'f'.repeat(64),outcome:{status:'saved',added:2,existing:0,remaining:0,total:2}},{frameId:0});assert.equal(late.ok,false);assert.equal(late.code,'RECEIPT_SENDER');
 row.denied=denied;row.late=late;row.status='PASS';stopRelease();console.log('PASS '+scenario);continue;
 }
 await c.exposeBinding('fixtureInternal',(_,m)=>worker.internal(m));await c.exposeBinding('fixtureSource',()=>({id:7,url:source.url(),status:'complete'}));
 await c.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copiedReport=text}});window.chrome={runtime:{getManifest:()=>({version:'0.5.39'}),sendMessage:m=>window.fixtureInternal(m)},tabs:{query:async()=>[await window.fixtureSource()]},storage:{onChanged:{addListener(){}}}};});
 let popup=await c.newPage();const open=async()=>{await popup.setViewportSize({width:430,height:640});await popup.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html');await popup.locator('#one-start:not([disabled])').waitFor();};await open();
 if(scenario==='legacy'){
 const status=await worker.internal({type:'n36-job-status'});assert.equal(status.view.confirmedRows,302);assert.equal(status.view.confirmedReceipts,null);assert.equal(worker.data['n36:background-view'].confirmedRows,0);assert.deepEqual(await disk(),before);assert.equal(worker.evidence.reads,0);
 row.popup=await popup.locator('body').innerText();assert.ok(row.popup.includes('302'));assert.ok(row.popup.includes('عدد الإيصالات غير محفوظ'));await popup.screenshot({path:folder+'legacy-popup.png',fullPage:true});row.view=status.view;row.status='PASS';stopRelease();console.log('PASS '+scenario);continue;
 }
 const run=async()=>{const id=worker.data['n36:background-view']?.id;await popup.locator('#one-start').click();if(scenario==='restart'&&!restarted){await worker.wait(()=>!!checkpoint);stopRelease();worker.kill();row.restartCheckpoint=checkpoint['n36:background-view'];assert.equal(row.restartCheckpoint.confirmedRows,2);assert.equal(row.restartCheckpoint.confirmedReceipts,1);restarted=true;stopRelease=await makeWorker(checkpoint);}
 await worker.wait(d=>(['complete','stopped'].includes(d['n36:background-view']?.phase)||worker.evidence.outcomes.some(o=>o.status==='unknown'))&&d['n36:background-view'].id!==id,45000);return structuredClone(worker.data['n36:background-view']);};
 row.view=await run();row.requests=[...requests];row.outcomes=structuredClone(worker.evidence.outcomes);let after=await disk();
 row.durable={students:after.students.length,sections:after.sections.length,teachings:after.teachings.length,slots:after.slots.length,profile:after.profile,receipts:Object.values(after.device[0].n36NamesBatch?.receipts??{}).map(r=>r.total)};
 const negative=['owner','session','atomic'].includes(scenario);if(negative){row.injection=await app.evaluate(()=>({armed:window.departmentArmed,transactions:window.departmentTransactions,fault:window.departmentFault}));console.log(JSON.stringify(row.injection));}
 assert.deepEqual(after.scores,before.scores);for(const k of ['years','terms','calendars','calendarDays'])assert.deepEqual(after[k],before[k]);
 if(negative){assert.equal(await app.evaluate(()=>!!window.departmentFault),true);assert.equal(after.profile[0].educationDepartment,'الإدارة العامة للتعليم بمنطقة الرياض');assert.ok(!after.outbox.some(o=>o.fields?.includes('educationDepartment')));assert.ok(worker.evidence.outcomes.some(o=>o.status==='unknown')||row.view.phase==='stopped');row.departmentAndOutboxUnchanged=true;}
 else{
 assert.equal(row.view.phase,'complete',JSON.stringify(row.view));
 const expected=['ambiguous','unknown','label-conflict'].includes(scenario)?'الإدارة العامة للتعليم بمنطقة الرياض':department;
 assert.equal(after.profile[0].educationDepartment,expected);
 if(scenario==='label-conflict')assert.ok(row.view.fields.some(f=>f.field==='department'&&f.reason==='conflict'));
 if(['ambiguous','unknown'].includes(scenario))assert.ok(row.view.fields.some(f=>f.field==='department'&&f.reason==='missing'));
 if(['suffix','label-explicit'].includes(scenario))assert.ok(row.view.fields.some(f=>f.field==='department'&&f.reason==='saved'));
 row.department=after.profile[0].educationDepartment;
 }
 stopRelease();row.status='PASS';console.log('PASS '+scenario);
 }catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();worker=null;await c.close();result.cases.push(row);}
 }
 });}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true};await fs.writeFile(folder+(process.env.N36_LABEL??'department')+'.json',JSON.stringify(result,null,2)+'\n');}
