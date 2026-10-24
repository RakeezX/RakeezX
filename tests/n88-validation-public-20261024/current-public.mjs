// AI: focused merged-public qualification. Synthetic signed native composition; no PG/provider/network operations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {composition} from './composition.mjs';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';
import {A,B,SESSION} from '../fixtures/n88-existing-host/provider.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const dir='tests/n88-validation-public-20261024/',taskId='continuous-n88-validation-family-public-dependency-20261024',runId='4b319ebd-0fa4-45c9-964e-1c8439e82d9b';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{windowsHide:true,encoding:'utf8',timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',scope:'SOURCECURRENT synthetic only',cases:[],hostedFamily:'UNKNOWN',providerOperations:0};
const base={classId:'class',teachingId:'teaching',firstDelay:0,nextDelay:0};
const corrupt=({sql})=>sql.includes('as enrollment_id')?{rows:[{payload:JSON.stringify({owner_id:A,enrollment_id:'enrollment',section_id:'class',student_id:'fabricated',revision:'1',status:'active',end_date:null,enrollment_present:true,student_active:null,label:'PRIVATE_NOT_EXPORTED',class_active:true,student_revision:'1',section_revision:'1',year_revision:'1'})}]}:null;
const normal=({text})=>text.startsWith('with recursive input(')?{rows:[{ordinal:0,affected:'1'}]}:null;
const binding={ownerId:A,sessionId:SESSION,leaseId:'synthetic',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'[1,1]'};
const send=async(s,token=s.provider.token(),overrides={})=>s.send('/api/n88/teacher/class/list',{method:'POST',headers:{'content-type':'application/json','x-n88-csrf':'1',Authorization:'Bearer '+token},body:JSON.stringify({binding:{...binding,...overrides},teachingId:'teaching',uiProtocol:'n88-public-ui-v1'})});
let server,owned=false,service,mode='classified',requests=0,mutations=0;const jobs=new Set();
try{
 const publicFiles=['drafts/n88-student-portal/cloudflare-entry.mjs','src/lib/student-portal-runtime.js','src/lib/support.js'];
 const parent='f3eaef6dc3e268bb91de98c3b99e4df4714ccfe3';
 const vocabulary=JSON.parse(execFileSync('git',['show',parent+':tests/n88-five-correlation-20261024/validation-family-vocabulary.json'],{encoding:'utf8'}));
 for(const file of publicFiles){const text=await fs.readFile(file,'utf8');assert.deepEqual(JSON.parse(text.match(/const validationFamilies=Object.freeze\((\[.*?\])\);/)[1]),vocabulary);}
 report.cases.push('All three merged public enums exactly match qualified immutable vocabulary');
 const classified=composition({...base,queryFixture:corrupt});let r=await send(classified);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'unavailable',stage:'synchronize-validate',validationFamily:'memberships.studentActive'});assert.equal(r.headers.get('x-n88-service-stage'),'synchronize-validate');assert.equal(classified.counts.rollbacks,1);assert.equal(classified.counts.commits,0);
 for(const [name,s,token,overrides] of [
 ['bad JWT',classified,classified.provider.token().slice(0,-4)+'xxxx',{}],
 ['foreign owner',classified,classified.provider.token({sub:B}),{ownerId:B}],
 ['bad ingress signature',composition({...base,queryFixture:corrupt,wireTamper:true}),undefined,{}],
 ['denied source',composition({...base,queryFixture:corrupt,sourceDenied:true}),undefined,{}]]){
  r=await send(s,token,overrides);assert.equal(r.status,401,name);assert(!JSON.stringify(await r.json()).includes('validationFamily'),name);report.cases.push(name+' denies without family');
 }
 for(const value of ['PRIVATE_ERROR value=42',null,{},['memberships.label']]){
  const s=composition({...base,queryFixture:corrupt,replyTransform:reply=>({...reply,body:{...reply.body,validationFamily:value}})});r=await send(s);assert.equal(r.status,503);assert(!Object.hasOwn(await r.json(),'validationFamily'));
 }
 const absent=composition({...base,queryFixture:corrupt,replyTransform:reply=>{delete reply.body.validationFamily;return reply;}});r=await send(absent);assert.equal(r.status,503);assert(!Object.hasOwn(await r.json(),'validationFamily'));
 const successful=composition({...base,queryFixture:normal});r=await send(successful);assert.equal(r.status,200);const success=await r.json();assert.equal(success.ack,true);assert.equal(success.data.students.length,1);assert(!Object.hasOwn(success,'validationFamily'));assert.equal(successful.counts.commits,1);
 report.cases.push('Actual signed authenticated source -> current carrier finite family; malformed/forged/absent family remains generic503; real validated success ACK and COMMIT unchanged');
 assert.match(lease('acquire'),/ACQUIRED|ALREADY OWNED/);owned=true;
 const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
 const boot=`import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import {mountClassService,classBinding,studentPortalDiagnostic} from '/src/lib/student-portal-runtime.js';import {sanitizeSupportDiagnostics} from '/src/lib/support.js';await bootstrap();window.safeSupport=sanitizeSupportDiagnostics;window.diag=studentPortalDiagnostic;const binding=w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:'teaching'},w);window.currentBinding=()=>binding(false);let once=true;const send=async(path,init)=>{const r=await fetch(path,init);if(location.search==='?slowbody'&&path.endsWith('/list')&&once){once=false;return {ok:r.ok,status:r.status,headers:r.headers,json:()=>new Promise(()=>{})};}return r;};if(location.search==='?unknown'){const b=binding(false),c=b.context,scope=JSON.stringify([c.ownerId,c.leaseId,b.receiptScope,c.teachingId,c.classId,c.termId]),key='rakeezx-n88-uncertain-v1:'+encodeURIComponent(scope);if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({version:1,scope,rows:[{version:1,action:'issue-missing',requestId:'unknown-synthetic-command-0001',expectedRosterRevision:'a'.repeat(64),expectedCredentialRevision:'b'.repeat(64),sourceStamp:null,expectedRevision:null,createdAt:Date.now()}]}));window.hintKey=key;}window.handle=mountClassService(document.querySelector('main'),{getBinding:binding,fetch:send,readTimeoutMs:location.search==='?slowbody'?250:4000,subscribe:fn=>n88Fixture.store.subscribe(fn)});window.ready=true;`;
 server=createServer((req,res)=>{const job=(async()=>{try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
  const end=(body,type)=>{res.setHeader('content-type',type);res.end(body);};
  if(u.pathname==='/')return end('<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main></main><script type="module" src="/boot.mjs"></script>','text/html');
  if(u.pathname==='/boot.mjs')return end(boot,'text/javascript');
  if(u.pathname==='/review/context')return end(JSON.stringify({canonical,ownerId:A,token:service.provider.token()}),'application/json');
  if(u.pathname.startsWith('/api/n88/')){requests++;if(!u.pathname.endsWith('/list')&&!u.pathname.endsWith('/guidance-list'))mutations++;const chunks=[];for await(const c of req)chunks.push(c);const response=await service.send(u.pathname,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}
  const file=path.resolve('.'+u.pathname);assert(file.startsWith(process.cwd()+path.sep));end(await fs.readFile(file),file.endsWith('.css')?'text/css':'text/javascript');
 }catch(e){report.serverFailure=e.message;res.statusCode=500;res.end();}})();jobs.add(job);void job.finally(()=>jobs.delete(job));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile,runId,url:origin,timeoutMs:90000},async({createContext})=>{
  for(const scenario of ['classified','generic','forged','success','slowbody','unknown']){
   service=composition({...base,queryFixture:['success','unknown'].includes(scenario)?normal:corrupt,...(scenario==='generic'?{replyTransform:reply=>{delete reply.body.validationFamily;return reply;}}:{}),...(scenario==='forged'?{replyTransform:reply=>({...reply,body:{...reply.body,validationFamily:'PRIVATE_ERROR value=42'}})}:{})});
   const context=await createContext({viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin+(['slowbody','unknown'].includes(scenario)?'/?'+scenario:''));
    if(scenario==='unknown'){
     await page.locator('[data-n88-entry-state="ready"]').waitFor();
     await page.locator('[data-n88-uncertain]').waitFor();
     const saved=await page.evaluate(()=>localStorage.getItem(hintKey));assert(saved);assert.equal(JSON.parse(saved).rows.length,1);
     await page.reload();await page.locator('[data-n88-entry-state="ready"]').waitFor();await page.locator('[data-n88-uncertain]').waitFor();
     assert.equal(await page.evaluate(()=>localStorage.getItem(hintKey)),saved);await page.locator('[data-action="batch"]').click();await page.locator('[data-action="refresh"]').waitFor();assert.equal(mutations,0);assert.equal(await page.evaluate(()=>localStorage.getItem(hintKey)),saved);
     const before=requests;await page.evaluate(()=>n88Fixture.switchOwner());await page.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.equal(requests,before);
     report.cases.push('Actual merged runtime/client UNKNOWN hint survives real document reload; successful list never clears unconfirmed receipt or dispatches replacement; owner retirement hides roster without dispatch');
    }else if(scenario==='success'){await page.locator('[data-n88-entry-state="ready"]').waitFor();await page.locator('.n88-class-roster>li').waitFor();assert.equal((await page.evaluate(()=>diag())).validationFamily,undefined);}
    else if(scenario==='slowbody'){
     await page.locator('[data-n88-entry-state="timeout"]').waitFor();assert.equal((await page.evaluate(()=>diag())).code,'timeout');
     service=composition({...base,queryFixture:normal});await page.locator('[data-n88-retry]').click();await page.locator('[data-n88-entry-state="ready"]').waitFor();report.cases.push('Hung failure-body read hits existing deadline, cancels and frees serialized lane; retry obtains real success');
    }else{
     await page.locator('[data-n88-entry-state="connection"]').waitFor();const d=await page.evaluate(()=>diag());assert.equal(d.validationFamily,scenario==='classified'?'memberships.studentActive':undefined);
     await page.locator('[data-n88-failure-details] summary').click();await page.waitForFunction(()=>document.querySelector('[data-n88-failure-text]').textContent.length>0);const details=JSON.parse(await page.locator('[data-n88-failure-text]').textContent());assert.equal(details.validationFamily,d.validationFamily);assert.deepEqual(Object.keys(details).sort(),['phase','code','stage','httpStatus','elapsedMs','sourceVersion',...(d.validationFamily?['validationFamily']:[])].sort());
     const sanitized=await page.evaluate(d=>safeSupport({n88Portal:{...d,raw:'PRIVATE_ERROR',count:42,ownerId:'PRIVATE_ID'}}),d);assert.equal(sanitized.n88Portal.validationFamily,d.validationFamily);assert(!JSON.stringify(sanitized).includes('PRIVATE'));assert(!JSON.stringify(details).includes('PRIVATE'));
     assert.equal(await page.evaluate(()=>!!document.querySelector('link[href="/src/styles/student-portal-class.css"]').sheet),true);
     await page.evaluate(()=>n88Fixture.switchOwner());await page.waitForFunction(()=>!document.querySelector('[data-n88-failure-text]')?.textContent.includes('memberships.studentActive'));assert(!JSON.stringify(await page.evaluate(()=>diag())).includes('memberships.studentActive'));
    }
    assert.deepEqual(errors,[]);report.cases.push('Actual current DOM/handlers/store ownership guard/source CSS: '+scenario);
   }finally{await context.close();}
  }
 });
 report.status='PASS';
}catch(e){report.failure={message:e.message,stack:e.stack?.split('\n').slice(0,5)};process.exitCode=1;}
finally{if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}await Promise.allSettled([...jobs]);if(owned)report.lease=lease('release');report.cleanup='Owned HTTP server and isolated contexts/browser closed';await fs.writeFile(dir+'current-public.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
