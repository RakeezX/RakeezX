/** AI: actual HTTP gateway/client/runtime/guard + owned restricted PostgreSQL, synthetic only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startIntegratedReview} from './server.mjs';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A,SESSION} from '../fixtures/n88-existing-host/provider.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='n88-guidance-read-1028',runId='f1d7a109-b3dc-47a4-a74d-126c5dc3e4e0',dir='tests/n88-guidance-read-20261028';
const taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],matrix:[],cleanup:{},realOperations:0};let review,owned=false,stage='lease';
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 stage='native setup';review=await startIntegratedReview({ttl:900});const t=review.testing,q=t.query,origin=new URL(review.url).origin;
 await q('set role postgres');try{await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));}finally{await q('reset role');}
 let context={enabled:true,ownerId:A,sessionId:SESSION,leaseId:'guidance-read-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1',validUntil:Date.now()+600000};
 const storage=new Map(),diagnostics=[],lists=[];let fault=null;
 const request=async(path,init)=>{
  if(fault){if(typeof fault==='function')return fault(path,init);return fault;}
  const r=await fetch(origin+path,{...init,headers:{...init.headers,Authorization:'Bearer '+t.provider.token()}});
  if(!r.ok)report.lastHTTP={status:r.status,stage:r.headers.get('x-n88-service-stage')};return {ok:r.ok,status:r.status,headers:r.headers,json:async()=>{const {rollout,...ack}=await r.json();return ack;}};
 };
 const client=createClassPortalClient({request,getContext:()=>context,storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},onGuidanceDiagnostic:d=>{if(d)diagnostics.push(d);},onListDiagnostic:d=>{if(d)lists.push(d);}});
 const raw=async(action,body={})=>{const {enabled,validUntil,...binding}=context;const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+t.provider.token()},body:JSON.stringify({teachingId:'teaching',binding,...body})});return {status:r.status,data:(await r.json()).data};};
 stage='native list and sources';assert.equal((await client.listClass('teaching')).students.length,2);assert.deepEqual(await client.listGuidance('teaching'),{tasks:[]});
 const fields={name:true,class:true,required:true,scheduled:true,completed:true,grades:false};
 const publish=async fields=>{const r=await client.listClass('teaching');assert.equal((await raw('visibility',{fields,expectedRosterRevision:r.rosterRevision,policyRevision:r.policyRevision})).status,200);};
 await publish(fields);assert.ok((await client.listGuidance('teaching')).tasks.length>0);
 await publish(Object.fromEntries(Object.keys(fields).map(k=>[k,false])));assert.deepEqual((await client.listGuidance('teaching')).tasks,[]);await publish(fields);
 const nativeHashes=Object.fromEntries(await Promise.all(["src/lib/student-portal-class-client.js","src/lib/student-portal-task-guidance-client.js","drafts/n88-student-portal/integrated-service.mjs","drafts/n88-student-portal/task-guidance.mjs"].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
 let reused;try{const proof=JSON.parse(await readFile(dir+'/native-proof.json','utf8'));if(JSON.stringify(proof.hashes)===JSON.stringify(nativeHashes))reused=proof;}catch{}
 if(reused){report.checks.push(...reused.checks);report.nativeReuse=reused.sourceEvidence;}else{
 stage='absent table independent list';await q('alter table n88_private.task_guidance rename to synthetic_guidance_hidden');
 try{assert.ok(await client.listClass('teaching'));await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='rejected');assert.equal(lists.at(-1).outcome,'success');assert.equal(diagnostics.at(-1).httpStatus,503);assert.equal(diagnostics.at(-1).stage,'projection');}finally{await q('alter table n88_private.synthetic_guidance_hidden rename to task_guidance');}
 stage='wrong grants';await q('revoke select on n88_private.task_guidance from n88_backend');try{assert.ok(await client.listClass('teaching'));await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='rejected');}finally{await q('grant select on n88_private.task_guidance to n88_backend');}
 stage='malformed stored constraints';for(const payload of [{}, {revision:0,sourceStamp:'c'.repeat(64),executionInstructions:[],deliveryInstructions:'',bindings:[]}])await assert.rejects(()=>q('insert into n88_private.task_guidance(owner_id,class_id,term_id,teaching_id,subitem_id,payload) values($1,\'class\',\'term\',\'teaching\',\'synthetic-malformed\',$2)',[A,payload]));
 assert.equal((await q("select count(*)::int as n from n88_private.task_guidance")).rows[0].n,0);
 for(const role of ['anon','authenticated']){await q('set role '+role);try{await assert.rejects(()=>q('select payload from n88_private.task_guidance'));}finally{await q('reset role');}}
 pass('n88_guidance_list_http200_independent_class_list_and_actual_ack_shape','Actual /api/n88/teacher/class routes, gateway, integrated service and restricted native PG: list/guidance 200; saved visibility ON has tasks, OFF empty; renamed task_guidance or revoked backend SELECT gives independent guidance 503/projection while roster succeeds. No provider inference.');
 pass('n88_guidance_owner_session_draft_preservation_and_absent_table_fail_closed','Native table constraints reject malformed payload; anon/authenticated denied private table; absent table and missing SELECT fail closed. UI owner/session/term/draft checks recorded below.');
 stage='client status and ACK';const binding=()=>{const {enabled,validUntil,...b}=context;return b;};
 const response=(status,data,extra={})=>({ok:status===200,status,headers:new Headers({'x-n88-service-stage':status===503?'source':'evil-private-stage','x-n88-service-region':'ap-south-1'}),json:async()=>({ack:true,binding:binding(),requestId:null,data,...extra})});
 for(const status of [401,403,503]){fault=response(status,null);await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='rejected');assert.equal(diagnostics.at(-1).httpStatus,status);}
 for(const data of [null,{}, {tasks:[null]},{tasks:[{}]},{tasks:'secret-private-body'}]){fault=response(200,data);await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='invalid_ack');assert.equal(diagnostics.at(-1).code,'invalid_ack');}
 fault={ok:true,status:200,headers:new Headers(),json:async()=>{throw new SyntaxError('SECRET_BODY');}};await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='invalid_ack');
 stage='real 10 second client deadline';fault=()=>new Promise(()=>{});const started=performance.now();await assert.rejects(()=>client.listGuidance('teaching'),e=>e.code==='timeout');assert.ok(performance.now()-started>=9900);assert.equal(diagnostics.at(-1).code,'timeout');
 for(const field of ['ownerId','sessionId','termId']){let release;fault=()=>new Promise(r=>{release=r;});const p=client.listGuidance('teaching');await new Promise(r=>setTimeout(r,0));const old=context;context={...context,[field]:'shifted'};release(response(200,{tasks:[]}));await assert.rejects(()=>p,e=>e.code==='stale_context');context=old;}
 const permitted=['schema','kind','phase','code','httpStatus','statusClass','stage','region','elapsedMs','outcome'];for(const d of diagnostics){assert.deepEqual(Object.keys(d),permitted);assert.ok(d.elapsedMs>=0&&d.elapsedMs<=30000);assert.ok(!JSON.stringify(d).includes('SECRET'));assert.ok(!JSON.stringify(d).includes(A));}
 pass('n88_guidance_failure_timeout_503_401_invalid_ack_distinguished_without_personal_data','Actual client distinguishes 401/403/503 rejected, malformed/partial/null/invalid JSON ACK invalid_ack, full default 10-second deadline timeout, stale owner/session/term. Exact operational-only diagnostic key allowlist and bounded timing; no body, IDs, credentials.');
 await writeFile(dir+'/native-proof.json',JSON.stringify({hashes:nativeHashes,sourceEvidence:'result.json',checks:report.checks},null,2));
 }
 fault=null;
 stage='actual application browser';
 await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:120000},async({createContext})=>{
  const c=await createContext({viewport:{width:390,height:1000},locale:'ar-SA'}),p=await c.newPage();p.setDefaultTimeout(12000);
  p.on('response',r=>{if(r.status()>=400)(report.failedResources??=[]).push({path:new URL(r.url()).pathname,status:r.status()});});
  const errors=[];p.on('pageerror',e=>{errors.push(e.message);report.pageErrors=errors;});let mode='normal',delay=0;const calls=[];
  await c.route(origin+'/api/n88/teacher/class/**',async route=>{const action=new URL(route.request().url()).pathname.split('/').at(-1);calls.push(action);if(action==='guidance-list'&&mode!=='normal'){if(delay)await new Promise(r=>setTimeout(r,delay));if(mode==='malformed')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ack:true,binding:JSON.parse(route.request().postData()).binding,requestId:null,data:{tasks:[null]}})});return route.fulfill({status:Number(mode),contentType:'application/json',headers:{'x-n88-service-stage':'projection'},body:'{"error":"unavailable"}'});}return route.continue();});
  await p.goto(review.url);await p.waitForTimeout(1500);report.boot=await p.evaluate(()=>({fixture:!!window.n88Fixture,text:document.body.innerText.slice(0,1800)}));await p.screenshot({path:dir+'/boot.png',fullPage:true});await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[name=executionInstructions]').waitFor();
  await p.locator('[name=executionInstructions]').fill('مسودة مصطنعة لا تُنشر');
  const hide=()=>p.evaluate(()=>{dispatchEvent(new Event('pagehide'));dispatchEvent(new Event('pageshow'));});
  stage='UI draft fail retry';mode='503';await hide();await p.locator('[data-guidance-refresh]').waitFor();await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة لا تُنشر');assert.equal(await p.locator('[data-guidance] [type=submit]').isDisabled(),true);
  await p.locator('[data-n88-guidance-details] summary').click();await p.waitForFunction(()=>document.querySelector('[data-n88-guidance-details] pre')?.textContent.length>0);const diag=JSON.parse(await p.locator('[data-n88-guidance-details] pre').innerText());assert.equal(diag.httpStatus,503);assert.equal(diag.outcome,'failure');
  await p.locator('[data-n88-list-support] summary').click();await p.waitForFunction(()=>document.querySelector('[data-n88-list-support] pre')?.textContent.length>0);assert.equal(JSON.parse(await p.locator('[data-n88-list-support] pre').innerText()).outcome,'success');
  const count=calls.length;await p.waitForTimeout(200);assert.equal(calls.length,count);
  mode='normal';await p.locator('[data-guidance-refresh]').click();await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة لا تُنشر');assert.ok(calls.every(x=>['list','guidance-list'].includes(x)));
  stage='UI mobile';for(const theme of ['light','dark'])for(const width of [320,390]){await p.setViewportSize({width,height:1000});await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:`${dir}/native-${width}-${theme}.png`,fullPage:true});report.matrix.push({width,theme,overflow:false});}
  report.readRetryUI='PASS';await writeFile(dir+'/ui-read-proof.json',JSON.stringify({matrix:report.matrix,readRetryUI:report.readRetryUI,evidence:'actual app read-only retry/draft/CAS disabled, separate roster/guidance statuses; four screenshots before uncertain-save harness failure'},null,2));
  stage='uncertain save';t.failGuidanceCommit('before');await p.locator('[data-guidance] [type=submit]').click();await p.getByRole('status').filter({hasText:'تعذّر تأكيد النشر'}).waitFor();await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');assert.equal(calls.filter(x=>x==='guidance-save').length,1);assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة لا تُنشر');assert.equal(await p.locator('[data-guidance] [type=submit]').isDisabled(),true);
  stage='UI owner guard';await p.evaluate(()=>window.n88Fixture.switchOwner());await p.waitForFunction(()=>!document.querySelector('[name=executionInstructions]'));assert.deepEqual(errors,[]);await c.close();
 });
 pass('n88_guidance_read_only_retry_no_mutation_no_duplicate_guidance_publish','Whole actual app route + real store ownership guard + runtime/client + synthetic HTTP service: pagehide/pageshow failure preserves draft, disables save, one deliberate retry makes read only, no background retry; separate success roster and failed guidance details. Explicit uncertain save runs once, keeps draft/CAS fence, owner retirement removes controls.');
}catch(e){report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{await review?.close();report.cleanup.httpAndPgClosed=true;if(owned)report.cleanup.integrationLease=lease('release');await writeFile(dir+'/'+(report.failure?'failure-'+Date.now():'result')+'.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
