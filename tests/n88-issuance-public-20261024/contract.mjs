// AI-authored: exact public delta and actual merged app qualification. No live ports/services/data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';
import {A,B,SESSION,providerFixture} from '../fixtures/n88-existing-host/provider.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-issuance-phase-public-dependency-20261024',runId='92b4cb1b-e074-4fb3-83ae-8bd1442ef7e0';
const base='5c486712946de4e4f02129e5443008e15b3407d2',parent='05621c12db294399eb7ebce2486810f9fee857fc';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const dir='tests/n88-issuance-public-20261024/',prefix='drafts/n88-student-portal/activation/issuance-diagnostic-20261024/';
const git=(...args)=>execFileSync('git',args,{windowsHide:true,maxBuffer:5000000});
const object=p=>git('show',parent+':'+p),hash=b=>createHash('sha256').update(b).digest('hex');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{windowsHide:true,encoding:'utf8',timeout:20000}).trim();
const issuance=['issuance-synchronize','issuance-roster','issuance-receipt','issuance-members','issuance-savepoint','issuance-recovery','issuance-member-result','issuance-member-release','issuance-member-rollback','issuance-flush'];
const inherited=['synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit'];
if(process.argv.includes('--context-only')){await contextSwapSupplement();}else{
const report={aiAuthored:true,taskId,runId,baseSha:base,qualifiedCandidate:parent,deltaBase:'6c9f34539702819ae84c12fd720524d8239f581c',status:'FAIL',checks:[],sources:{},reused:{},providerOperations:0,publicServedProof:'NOT_RUN: independent publisher only',wholeN88:'OPEN; actual source/issuance causes UNKNOWN; historical FAIL/NOT_RUN unchanged'};
let server,owned=false,service,requests=0,mutations=0;const jobs=new Set();
try{
 const dependency=JSON.parse(object(prefix+'public-dependency.json'));
 for(const [file,expected] of Object.entries(dependency.paths)){
  const before=git('show',base+':'+file),after=Buffer.from((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n'));
  assert.equal(hash(before),expected.before);assert.equal(hash(after),expected.after);
  const delta=git('diff','--numstat',base,'--',file).toString().trim();assert.equal(delta,'1\t1\t'+file);
  report.sources[file]={before:hash(before),after:hash(after)};
 }
 for(const file of ['src/lib/student-portal-class-client.js','src/views/student-portal-class.js','src/lib/sync-ownership.js','drafts/n88-student-portal/class-credentials.mjs','drafts/n88-student-portal/receipt-reconciliation.mjs','drafts/n88-student-portal/postgres-repository.mjs','sw.js']){
  assert.equal(git('diff',base,'--',file).length,0);report.reused[file]={sha256:hash(git('show',base+':'+file)),disposition:'Unchanged base safeguards'};
 }
 const binding=JSON.parse(object(prefix+'candidate-binding.json'));report.qualifiedBinding=binding;assert.equal(hash(object(prefix+'native.inactive.mjs')),binding.native);
 for(const [file,expected] of Object.entries(binding.evidence||{})){assert.equal(hash(object(file)),expected);report.reused[file]={sha256:expected,disposition:'Immutable original qualification; not rerun'};}
 for(const file of [prefix+'candidate-binding.json',prefix+'manifest.json',prefix+'native.inactive.mjs',prefix+'public-enum.patch','tests/n88-five-correlation-20261024/durable-native-qualified.json'])report.reused[file]={sha256:hash(object(file)),disposition:'Immutable original native/real-PG qualification; no new PG fixture'};
 report.checks.push({name:'n88_issuance_public_exact_current_delta',status:'PASS',evidence:'All three before/after SHA256 values equal qualified public-dependency.json; exactly one enum line per file; protected client/view/owner/native/receipt/offline code unchanged.'});
 // Reuse the existing signed composition harness. Select immutable qualified native,
 // without patching its handlers, validators, ACKs, ownership, SQL or COMMIT predicates.
 let harness=await fs.readFile('tests/n88-validation-public-20261024/composition.mjs','utf8');
 harness=harness.replace("const parent='f3eaef6dc3e268bb91de98c3b99e4df4714ccfe3'","const parent='"+parent+"'");
 harness=harness.slice(0,harness.indexOf('let prepare='))+"const native=object('"+prefix+"native.inactive.mjs');\n"+harness.slice(harness.indexOf('const built='));
 harness=harness.replace('createRequire(import.meta.url)', 'createRequire('+JSON.stringify(pathToFileURL(path.resolve('tests/n88-validation-public-20261024/composition.mjs')).href)+')');
 harness=harness.replaceAll("from '../../drafts/","from '"+pathToFileURL(path.resolve('drafts')+path.sep).href).replaceAll("from '../fixtures/","from '"+pathToFileURL(path.resolve('tests/fixtures')+path.sep).href);
 const {composition}=await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
 const baseOptions={classId:'class',teachingId:'teaching',firstDelay:0,nextDelay:0};
 const normal=({text})=>text.startsWith('with recursive input(')?{rows:[{ordinal:0,affected:'1'}]}:null;
 const corrupt=({sql})=>sql.includes('as enrollment_id')?{rows:[{payload:JSON.stringify({owner_id:A,enrollment_id:'enrollment',section_id:'class',student_id:'fabricated',revision:'1',status:'active',end_date:null,enrollment_present:true,student_active:null,label:'PRIVATE_NOT_EXPORTED',class_active:true,student_revision:'1',section_revision:'1',year_revision:'1'})}]}:null;
 const bindingContext={ownerId:A,sessionId:SESSION,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'[1,1]'};
 const send=async(s,token=s.provider.token(),overrides={})=>s.send('/api/n88/teacher/class/list',{method:'POST',headers:{'content-type':'application/json','x-n88-csrf':'1',Authorization:'Bearer '+token},body:JSON.stringify({binding:{...bindingContext,...overrides},teachingId:'teaching',uiProtocol:'n88-public-ui-v1',reconciliationVersion:1,reconcile:[]})});
 // Inject only failure metadata after an actual native503; never synthesize ACK.
 const failed=stage=>composition({...baseOptions,queryFixture:corrupt,replyTransform:r=>{assert.equal(r.status,503);return {...r,body:{...r.body,stage}};}});
 for(const stage of [...issuance,...inherited]){const r=await send(failed(stage));assert.equal(r.status,503);assert.equal(r.headers.get('x-n88-service-stage'),stage);}
 for(const stage of ['PRIVATE_SQL SELECT id=42','issuance-secret',null,{},['issuance-flush']]){const r=await send(failed(stage));assert.equal(r.status,503);assert.equal(r.headers.get('x-n88-service-stage'),null);}
 const classified=failed('issuance-flush');
 for(const [name,s,token,overrides] of [['bad JWT',classified,classified.provider.token().slice(0,-4)+'xxxx',{}],['foreign owner',classified,classified.provider.token({sub:B}),{ownerId:B}],['bad signature',composition({...baseOptions,queryFixture:corrupt,wireTamper:true}),undefined,{}],['source denied',composition({...baseOptions,queryFixture:corrupt,sourceDenied:true}),undefined,{}]]){
  // Failure-stage injection is inapplicable to denials: use unmodified signed harness.
  const target=s===classified?composition({...baseOptions,queryFixture:corrupt}):s;
  const r=await send(target,token,overrides);assert.equal(r.status,401,name);assert.equal(r.headers.get('x-n88-service-stage'),null);assert(!JSON.stringify(await r.json()).includes('issuance-'),name);
 }
 service=composition({...baseOptions,queryFixture:normal});let r=await send(service);assert.equal(r.status,200);assert.equal((await r.json()).ack,true);assert.equal(service.counts.commits,1);
 report.nativeSynthetic='Actual qualified native + current carrier + existing synthetic query/provider ports; no fabricated success ACK or PG claim. Failure metadata injection tests public transport only.';
 assert.match(lease('acquire'),/ACQUIRED|ALREADY OWNED/);owned=true;
 const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
 const boot=`import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import {mountClassService,classBinding,studentPortalDiagnostic} from '/src/lib/student-portal-runtime.js';import {sanitizeSupportDiagnostics} from '/src/lib/support.js';await bootstrap();window.safeSupport=sanitizeSupportDiagnostics;window.diag=studentPortalDiagnostic;const binding=w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:'teaching'},w);let once=true;const send=async(p,i)=>{const r=await fetch(p,i);if(location.search==='?slowbody'&&p.endsWith('/list')&&once){once=false;return {ok:r.ok,status:r.status,headers:r.headers,json:()=>new Promise(()=>{})};}return r;};window.handle=mountClassService(document.querySelector('main'),{getBinding:binding,fetch:send,readTimeoutMs:location.search==='?slowbody'?250:4000,subscribe:fn=>n88Fixture.store.subscribe(fn)});`;
 server=createServer((req,res)=>{const job=(async()=>{try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
  const end=(b,t)=>{res.setHeader('content-type',t);res.end(b);};
  if(u.pathname==='/')return end('<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main></main><script type="module" src="/boot.mjs"></script>','text/html');
  if(u.pathname==='/boot.mjs')return end(boot,'text/javascript');
  if(u.pathname==='/review/context')return end(JSON.stringify({canonical,ownerId:A,token:service.provider.token()}),'application/json');
  if(u.pathname.startsWith('/api/n88/')){requests++;if(!u.pathname.endsWith('/list')&&!u.pathname.endsWith('/guidance-list'))mutations++;const chunks=[];for await(const c of req)chunks.push(c);const response=await service.send(u.pathname,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}
  assert(u.pathname.startsWith('/src/')||u.pathname.startsWith('/tests/fixtures/'));const file=path.resolve('.'+u.pathname);assert(file.startsWith(process.cwd()+path.sep));end(await fs.readFile(file),file.endsWith('.css')?'text/css':'text/javascript');
 }catch(e){report.serverFailure=e.message;res.statusCode=500;res.end();}})();jobs.add(job);void job.finally(()=>jobs.delete(job));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile,runId,url:origin,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(6500);page.on('pageerror',e=>errors.push(e.message));
  for(const stage of [...issuance,...inherited,'PRIVATE_SQL SELECT owner=42']){
   service=failed(stage);await page.goto(origin);await page.locator('[data-n88-entry-state="connection"]').waitFor();
   await page.locator('[data-n88-failure-details] summary').click();await page.waitForFunction(()=>document.querySelector('[data-n88-failure-text]')?.textContent.length>0);
   const details=JSON.parse(await page.locator('[data-n88-failure-text]').textContent());assert.equal(details.stage,stage.startsWith('PRIVATE')?'none':stage);assert.equal(details.httpStatus,503);
   const sanitized=await page.evaluate(d=>safeSupport({n88Portal:{...d,raw:'PRIVATE_SQL',body:'PRIVATE_BODY',ownerId:'PRIVATE_ID',count:42,secret:'PRIVATE_SECRET'}}),details);
   assert.equal(sanitized.n88Portal.stage,details.stage);assert(!JSON.stringify(sanitized).includes('PRIVATE'));assert(!JSON.stringify(details).includes('PRIVATE'));
   assert.deepEqual(Object.keys(details).sort(),['phase','code','stage','httpStatus','elapsedMs','sourceVersion'].sort());
   assert.equal(await page.evaluate(()=>!!document.querySelector('link[href="/src/styles/student-portal-class.css"]').sheet),true);
  }
  service=failed('issuance-flush');await page.goto(origin);await page.locator('[data-n88-entry-state="connection"]').waitFor();
  await page.evaluate(()=>{window.oldContextDetails=document.querySelector('[data-n88-failure-details]');n88Fixture.store.state.teachings.find(t=>t.id==='teaching').revision++;dispatchEvent(new Event('focus'));});
  await page.waitForFunction(()=>!oldContextDetails.isConnected);await page.locator('[data-n88-entry-state="denied"]').waitFor();assert.notEqual((await page.evaluate(()=>diag()))?.stage,'issuance-flush');
  const before=requests;await page.evaluate(()=>{window.oldDetails=document.querySelector('[data-n88-failure-details]');n88Fixture.switchOwner();});await page.waitForFunction(()=>!oldDetails.isConnected);assert.equal(requests,before);assert(!issuance.includes((await page.evaluate(()=>diag()))?.stage));
  report.checks.push({name:'n88_issuance_public_finite_privacy_and_owner',status:'PASS',evidence:'19 fixed stages carrier -> actual runtime failure DOM -> support sanitizer; arbitrary stage/SQL/body/IDs/counts/secrets absent from support. Bad JWT/owner/signature/source denied without phase. Actual same-owner source-context swap retires old details; store owner change retires DOM/details and dispatches no request.'});
  service=composition({...baseOptions,queryFixture:corrupt});await page.goto(origin+'/?slowbody');await page.locator('[data-n88-entry-state="timeout"]').waitFor();assert.equal((await page.evaluate(()=>diag())).code,'timeout');
  service=composition({...baseOptions,queryFixture:normal});await page.locator('[data-n88-retry]').click();await page.locator('[data-n88-entry-state="ready"]').waitFor();await page.locator('.n88-class-roster>li').waitFor();
  assert.equal(await page.locator('.n88-class-roster>li').evaluate(el=>getComputedStyle(el).display),'grid');
  // Throw at actual typed native mutation flush. The native503 remains503. Only
  // its failure-stage label is injected to cover each public rollback diagnostic.
  for(const stage of ['issuance-member-rollback','issuance-flush','projection-commit']){
   let failWrite=true;
   service=composition({...baseOptions,queryFixture:args=>{if(failWrite&&args.op?.effect)throw Error('PRIVATE_SYNTHETIC_WRITE_FAILURE');return normal(args);},replyTransform:r=>r.status===503?{...r,body:{...r.body,stage}}:r});
   // Initial synchronization itself writes: allow actual list preparation first.
   failWrite=false;const fresh=await createContext(),p=await fresh.newPage();p.setDefaultTimeout(6500);await p.goto(origin);await p.locator('.n88-class-roster>li').waitFor();failWrite=true;
   const startMutations=mutations;await p.locator('[data-action="batch"]').click();await p.locator('[data-n88-uncertain]').waitFor();assert.equal(mutations,startMutations+1);
   const hints=()=>p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rakeezx-n88-uncertain-v1:')));
   const saved=await hints();assert.equal(saved.length,1);const oldId=JSON.parse(saved[0][1]).rows[0].requestId;assert(oldId);
   await p.locator('[data-n88-mutation-details] summary').click();await p.waitForFunction(()=>document.querySelector('[data-n88-mutation-details] pre')?.textContent.length>0);assert.equal(JSON.parse(await p.locator('[data-n88-mutation-details] pre').textContent()).stage,stage);
   failWrite=false;await p.reload();await p.locator('.n88-class-roster>li').waitFor();await p.locator('[data-n88-uncertain]').waitFor();assert.deepEqual(await hints(),saved);
   await p.locator('[data-action="batch"]').click();await p.locator('[data-n88-uncertain]').waitFor();assert.equal(mutations,startMutations+1);assert.equal(JSON.parse((await hints())[0][1]).rows[0].requestId,oldId);
   await fresh.close();
  }
  assert.deepEqual(errors,[]);await context.close();
  report.checks.push({name:'n88_issuance_public_unknown_ack_and_deadline_unchanged',status:'PASS',evidence:'Actual native valid list ACK/COMMIT and rendered ready roster; hung failure-body deadline cancels and retry frees lane. Real app batch503 with rollback/flush/commit labels retains original durable command after document reload/list200 UNKNOWN; replacement clicks dispatch zero further mutations. No fake success ACK.'});
 });report.status='PASS';
}catch(e){report.failure={message:e.message,...(e.stdout?{stdout:String(e.stdout).slice(0,2000)}:{}),stack:e.stack?.split('\n').map(s=>s.length>500?s.slice(0,500):s).slice(0,6)};process.exitCode=1;}
finally{if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}await Promise.allSettled([...jobs]);if(owned)report.leaseRelease=lease('release');report.cleanup='Owned HTTP server, isolated contexts/browser closed; no PG/provider/live operation';let previous;try{previous=JSON.parse(await fs.readFile(dir+'provenance.json','utf8'));}catch{}if(previous?.earlierAffectedQualification)report.earlierAffectedQualification=previous.earlierAffectedQualification;if(previous?.recordedHarnessFailures)report.recordedHarnessFailures=previous.recordedHarnessFailures;if(previous)report.previousHarnessFailures=[...(previous.previousHarnessFailures||[previous.previousHarnessFailure].filter(Boolean)),...(previous.status==='FAIL'?[previous.failure]:[])];await fs.writeFile(dir+'provenance.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:report.checks,failure:report.failure,cleanup:report.cleanup}));

}
// AI: resume only the previously NOT_RUN context swap. No native/PG/service work.
async function contextSwapSupplement(){
 const currentRunId='ed35dd1f-970f-4f5f-a920-51857a4fffe6';
 const savedCandidate='650ae968c8e38c2d78309813b305160024d189d9';
 const previousText=await fs.readFile(dir+'provenance.json','utf8'),previous=JSON.parse(previousText);
 const result={aiAuthored:true,runId:currentRunId,savedCandidate,priorProvenanceSha256:hash(previousText),status:'FAIL',check:'n88_same_owner_context_swap_supplement',providerOperations:0,nativeOperations:0,pgClusters:0,mutationRequests:0};
 const phase=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',currentRunId],{windowsHide:true,encoding:'utf8',timeout:20000}).trim();
 let http,phaseOwned=false,listCalls=0;const pending=new Set();
 try{
  // Source and dependency identity checks permit reuse; no prior journey reruns.
  for(const [file,source] of Object.entries(previous.sources))assert.equal(hash((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')),source.after);
  for(const [file,proof] of Object.entries(previous.reused))if(proof.disposition==='Unchanged base safeguards')assert.equal(hash((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')),proof.sha256);
  assert.equal(previous.earlierAffectedQualification.status,'PASS');const required=['n88_issuance_public_exact_current_delta','n88_issuance_public_finite_privacy_and_owner','n88_issuance_public_unknown_ack_and_deadline_unchanged'];const reusedChecks=previous.earlierAffectedQualification.checks.filter(c=>required.includes(c.name));assert.deepEqual(reusedChecks.map(c=>c.name).sort(),required.sort());assert(reusedChecks.every(c=>c.status==='PASS'));
  assert.equal((await fs.readFile(taskFile,'utf8')).includes(currentRunId),true);
  assert.match(phase('acquire'),/ACQUIRED|ALREADY OWNED/);phaseOwned=true;
  const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
  const token=providerFixture().token();
  const entry=`import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import {mountClassService,classBinding,studentPortalDiagnostic} from '/src/lib/student-portal-runtime.js';import {sanitizeSupportDiagnostics} from '/src/lib/support.js';await bootstrap();const binding=w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:'teaching'},w);window.binding=binding;window.diag=studentPortalDiagnostic;window.safeSupport=sanitizeSupportDiagnostics;window.handle=mountClassService(document.querySelector('main'),{getBinding:binding,subscribe:fn=>n88Fixture.store.subscribe(fn)});`;
  http=createServer((req,res)=>{const job=(async()=>{try{
   res.setHeader('cache-control','no-store');const u=new URL(req.url,'http://127.0.0.1');
   const end=(body,type)=>{res.setHeader('content-type',type);res.end(body);};
   if(u.pathname==='/')return end('<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main></main><script type="module" src="/context-entry.mjs"></script>','text/html');
   if(u.pathname==='/context-entry.mjs')return end(entry,'text/javascript');
   if(u.pathname==='/review/context')return end(JSON.stringify({canonical,ownerId:A,token}),'application/json');
   if(u.pathname.startsWith('/api/n88/')){
    for await(const chunk of req){};
    if(u.pathname!=='/api/n88/teacher/class/list'){result.mutationRequests++;res.statusCode=401;return end('{"error":"denied"}','application/json');}
    listCalls++;res.statusCode=503;if(listCalls===1)res.setHeader('x-n88-service-stage','issuance-flush');
    return end('{"error":"unavailable"}','application/json');
   }
   assert(u.pathname.startsWith('/src/')||u.pathname.startsWith('/tests/fixtures/'));const file=path.resolve('.'+u.pathname);assert(file.startsWith(process.cwd()+path.sep));end(await fs.readFile(file),file.endsWith('.css')?'text/css':'text/javascript');
  }catch(e){result.serverFailure=e.message;res.statusCode=500;res.end();}})();pending.add(job);void job.finally(()=>pending.delete(job));});
  await new Promise((ok,fail)=>{http.once('error',fail);http.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+http.address().port;
  await withIsolatedLocalBrowser({taskFile,runId:currentRunId,url:origin,timeoutMs:30000},async({createContext})=>{
   const context=await createContext({viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(6500);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);await page.locator('[data-n88-entry-state="connection"]').waitFor();
   await page.locator('[data-n88-failure-details] summary').click();await page.waitForFunction(()=>document.querySelector('[data-n88-failure-text]')?.textContent.length>0);
   const first=JSON.parse(await page.locator('[data-n88-failure-text]').textContent());assert.equal(first.stage,'issuance-flush');assert.equal(first.httpStatus,503);
   assert.equal(await page.evaluate(()=>!!document.querySelector('link[href="/src/styles/student-portal-class.css"]').sheet),true);
   await page.evaluate(()=>{window.beforeBinding=binding(false);window.oldDetails=document.querySelector('[data-n88-failure-details]');const teaching=n88Fixture.store.state.teachings.find(t=>t.id==='teaching');teaching.revision=(teaching.revision??1)+1;dispatchEvent(new Event('focus'));});
   await page.waitForFunction(()=>!oldDetails.isConnected);await page.locator('[data-n88-entry-state="connection"]').waitFor();await page.waitForFunction(()=>diag()?.phase==='http'&&diag()?.stage==='none');
   const fence=await page.evaluate(()=>{const after=binding(false);return {sameOwner:beforeBinding.context.ownerId===after.context.ownerId,sameSession:beforeBinding.context.sessionId===after.context.sessionId,sameWorkspace:beforeBinding.context.leaseId===after.context.leaseId,keyChanged:beforeBinding.key!==after.key,revisionChanged:beforeBinding.context.contextRevision!==after.context.contextRevision};});
   assert(Object.values(fence).every(Boolean));result.bindingFence=fence;
   await page.locator('[data-n88-failure-details] summary').click();await page.waitForFunction(()=>document.querySelector('[data-n88-failure-text]')?.textContent.length>0);
   const current=JSON.parse(await page.locator('[data-n88-failure-text]').textContent());assert.equal(current.httpStatus,503);assert.equal(current.stage,'none');assert(!JSON.stringify(current).includes('issuance-flush'));
   const support=await page.evaluate(()=>safeSupport({n88Portal:diag()}));assert.equal(support.n88Portal.stage,'none');assert.equal(support.n88Portal.httpStatus,503);
   assert.equal(listCalls,2);assert.equal(result.mutationRequests,0);assert.deepEqual(errors,[]);await context.close();
  });
  result.status='PASS';result.evidence='Actual runtime/store/classBinding/ownership guard and CSS over isolated loopback HTTP: same owner/session/workspace, changed source revision/key retires opened issuance-flush details. New generic503 remains503/stage none in DOM and support. Two list reads, zero mutation/native/PG/provider operations.';
 }catch(e){process.exitCode=1;result.failure={message:e.message,stdout:e.stdout?String(e.stdout):undefined};}
 finally{
  if(http?.listening){http.closeAllConnections();await new Promise(ok=>http.close(ok));}await Promise.allSettled([...pending]);
  if(phaseOwned)result.leaseRelease=phase('release');result.cleanup={ownedHttpServerClosed:!http?.listening,ownedBrowserClosed:true};
  previous.continuations??=[];previous.continuations.push(result);previous.currentRunId=currentRunId;previous.currentState=result.status==='PASS'?'LOCAL_READY':'BLOCKED';
  await fs.writeFile(dir+'provenance.json',JSON.stringify(previous,null,2)+'\n');
 }
 console.log(JSON.stringify(result));
}
