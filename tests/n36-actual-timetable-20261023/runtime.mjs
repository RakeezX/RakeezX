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
 for(const scenario of (process.env.N36_CASES??'conflict').split(',')){
 const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),row={scenario};requests=[];
 try{
 options={count:2,multi:scenario==='restart',setup:scenario!=='populated',label:scenario==='label',pager:scenario==='unknown'?'unknown':scenario==='gap'?'gap':'complete',excluded:scenario==='excluded',ambiguous:scenario==='ambiguous',subject:scenario!=='no-subject'};
 const app=await c.newPage();app.on('pageerror',e=>console.log('PAGE '+e.message));await app.goto(base+'/?case='+scenario+'#/classes/koshoof?import=1');await app.waitForFunction(()=>window.fixtureReady&&window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});
 const ready=()=>app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable&&typeof window.rakeezBeginNamesBatch==='function';});await ready();
 const disk=()=>app.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
 const before=await disk();assert.equal(before.sections.length,0);assert.equal(before.students.length,0);
 await app.evaluate(()=>history.replaceState(null,'','/'+location.hash));const source=await c.newPage();await source.goto(base+(scenario==='populated'||scenario==='label'?home:dash));
 await c.exposeBinding('fixtureExternal',(_,m)=>worker.external(m,{frameId:0}));await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});
 let checkpoint=null,restarted=false,actualSourceDocument=null;
 const makeWorker=async data=>{worker=await backgroundFixture({app,source,base,data,sourceDocumentNumber:restarted?actualSourceDocument:null,runtimeFiles:baselineFiles,denySource:scenario==='permissions',onStorage:async()=>{const j=worker?.data['n36:background-job'];if(j?.pending?.envelope){const proof=j.pending.envelope.setup.find(c=>c.category==='school');assert.equal(proof.rows[0].name,school);assert.deepEqual(proof.provenance,['teacher-readonly-run']);row.rawSchoolProvenancePreserved=true;}if(scenario==='restart'&&!restarted&&j?.phase==='transfer'&&Object.keys(j.acknowledged??{}).length===1){checkpoint=structuredClone(worker.data);worker.kill();}},onRead:async input=>{
 if(process.env.N36_DELAYED==='1'&&input.args?.[0]==='rendered-timetable'&&!row.delayedRead){row.delayedRead=true;await source.evaluate(()=>{document.body.setAttribute('aria-busy','true');setTimeout(()=>document.body.removeAttribute('aria-busy'),600);});}
 if(input.args?.[0]?.schema==='rakeez-extension-names')assert.ok(!worker.data['n36:background-job']?.renderedTimetable,'quarantined setup cannot reach receiver');
 },onAfterRead:async(input,result,data,evidence,meta)=>{
 if(process.env.N36_NAV_RESTART==='1'&&!restarted&&data['n36:background-job']?.navigation?.rendered==='return'&&result===base+dash){checkpoint=structuredClone(worker.data);actualSourceDocument=Number(meta.snapshotDocument?.split('-').at(-1));worker.kill();}
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
 assert.equal(row.view.phase,'complete');assert.equal(after.students.length,['excluded','ambiguous'].includes(scenario)?1:options.count);
 if(scenario==='populated'){
 assert.equal(after.teachings.length,0);assert.equal(after.slots.length,0);row.partialStudents=structuredClone(after.students);
 options.setup=true;await source.goto(base+home);await popup.reload();await popup.locator('#one-start:not([disabled])').waitFor();row.completion=await run();after=await disk();assert.deepEqual(after.students,row.partialStudents);row.view=row.completion;
 }
 if(['fresh','populated','label','same','conflict','no-subject','restart'].includes(scenario)){
 assert.equal(row.view.coverage,'complete');assert.equal(row.view.confirmedRows,options.count);assert.equal(row.view.confirmedReceipts,scenario==='fresh'?10:scenario==='restart'?2:1);assert.equal(row.view.pendingRows,0);
 assert.equal(after.profile[0].schoolName,displaySchool);assert.equal(after.profile[0].educationDepartment,department);
 assert.ok(row.view.fields.some(f=>f.field==='department'&&['saved','current'].includes(f.reason)));
 assert.equal(after.teachings.length,scenario==='no-subject'?0:scenario==='fresh'?10:scenario==='restart'?2:1);assert.equal(after.slots.length,scenario==='no-subject'?0:scenario==='fresh'?10:scenario==='restart'?2:1);
 await app.evaluate(()=>location.hash='#/classes');await app.waitForFunction(()=>document.body.innerText.includes('خامس'));
 if(scenario!=='no-subject')await app.waitForFunction(()=>document.body.innerText.includes('المهارات الرقمية'));
 else assert.ok(!(await app.locator('body').innerText()).includes('المهارات الرقمية'));
 await app.screenshot({path:folder+scenario+'-classes.png',fullPage:true});await app.evaluate(()=>location.hash='#/classes/koshoof?import=1');await app.locator('[data-act=n36-batch-resume]').waitFor();
 }else {assert.equal(row.view.coverage,'partial');assert.ok(row.view.coverageReasons.length>0);}
 assert.deepEqual(after.scores,before.scores);assert.deepEqual(after.years,before.years);assert.deepEqual(after.terms,before.terms);assert.deepEqual(after.calendars,before.calendars);assert.deepEqual(after.calendarDays,before.calendarDays);
 row.finalDurable={students:after.students.length,sections:after.sections.length,teachings:after.teachings.length,slots:after.slots.length,receipts:Object.values(after.device[0].n36NamesBatch.receipts).map(r=>r.total)};
 assert.equal(await source.evaluate(()=>!!window.executedHandler||!!window.executedResponse),false);assert.equal(requests.includes('/forbidden-resource'),false);
 const durable=after;await popup.close();popup=await c.newPage();await open();row.popup=await popup.locator('body').innerText();assert.ok(row.popup.includes(String(['excluded','ambiguous'].includes(scenario)?1:options.count)));assert.ok(row.popup.includes('إيصال'));
 await popup.locator('#copy-safe-report').click();await popup.waitForFunction(()=>!!window.copiedReport);const diagnostic=await popup.evaluate(()=>window.copiedReport);row.diagnostic=JSON.parse(diagnostic).collection;assert.deepEqual(row.diagnostic.coverageReasons,row.view.coverageReasons);assert.equal(row.diagnostic.confirmedRows,row.view.confirmedRows);assert.equal(row.diagnostic.processedPages,row.view.processedPages);assert.equal(row.diagnostic.excluded,row.view.excluded);assert.ok(!diagnostic.includes(school)&&!diagnostic.includes('طالب اصطناعي'));
 // Reload reads owner, data and receipts together in the new live checkpoint.
 await app.reload();await app.waitForFunction(()=>window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});await ready();after=await disk();assert.deepEqual(after.students,durable.students);assert.deepEqual(after.teachings,durable.teachings);assert.deepEqual(after.slots,durable.slots);assert.deepEqual(after.profile,durable.profile);
 await app.locator('[data-act=n36-batch-resume]').click();await app.waitForTimeout(100);row.receiver=await app.locator('body').innerText();assert.ok(!row.receiver.includes('نتيجة الإضافة غير المحسومة لم تتغير'));
 await app.evaluate(()=>location.hash='#/settings');await app.locator('[data-settings-profile]').waitFor();if(!await app.locator('[data-settings-profile]').evaluate(n=>n.open))await app.locator('[data-settings-profile] summary').click();await app.locator('input[name=schoolName]').waitFor();assert.equal(await app.locator('input[name=schoolName]').inputValue(),displaySchool);assert.equal(await app.locator('[data-education-department-combobox]').inputValue(),after.profile[0].educationDepartment);row.renderedProfileAfterReload=true;await app.screenshot({path:folder+scenario+'-profile.png',fullPage:true});await app.evaluate(()=>{document.activeElement.blur();location.hash='#/classes/koshoof?import=1';});await app.locator('[data-act=n36-batch-resume]').waitFor();
 await app.screenshot({path:folder+scenario+'-receiver.png',fullPage:true});await popup.screenshot({path:folder+scenario+'-popup.png',fullPage:true});
 // Controlled duplicate replay through the same actual UI/store entry.
 if(['conflict'].includes(scenario)){
 if(process.env.N36_RESTART==='1'){const data=structuredClone(worker.data);stopRelease();worker.kill();stopRelease=await makeWorker(data);}
 await app.evaluate(()=>window.chrome={runtime:{sendMessage:(id,m,cb)=>window.fixtureExternal(m).then(cb)}});await source.goto(base+dash);await popup.reload();await popup.locator('#one-start:not([disabled])').waitFor();row.repeat=await run();const repeated=await disk();
 assert.deepEqual(repeated.students,durable.students);assert.deepEqual(repeated.sections,durable.sections);assert.deepEqual(repeated.teachings,durable.teachings);assert.deepEqual(repeated.slots,durable.slots);assert.equal(row.repeat.added,0);assert.equal(row.repeat.existing,options.count);assert.equal(row.repeat.confirmedRows,options.count);assert.equal(row.repeat.confirmedReceipts,scenario==='fresh'?10:1);
 }
 stopRelease();row.status='PASS';console.log('PASS '+scenario);
 }catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();worker=null;await c.close();result.cases.push(row);}
 }
 });}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{worker?.release();worker?.kill();await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,sharedBrowserFinally:true};await fs.writeFile(folder+(process.env.N36_LABEL??(baseline?'rendered-baseline':'rendered-candidate'))+'.json',JSON.stringify(result,null,2)+'\n');}
