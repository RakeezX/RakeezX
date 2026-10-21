/** AI: actual runtime/client/view/CSS and existing account/owner/lease fixture over owned HTTP. */
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'node:http';import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';import {A} from '../fixtures/n88-existing-host/provider.mjs';import {makeSection,makeTeaching} from '../../src/models.js';
const root='C:/Users/Abody/Projects/RakeezX',task='continuous-n88-user-copy-list-diagnostic-20261021',run='42c8aae7-f887-4cc1-8abc-e3cb7fec2b00',dir='tests/n88-user-copy-list-diagnostic-20261021/';
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const token='e30.'+Buffer.from(JSON.stringify({session_id:'synthetic-session',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
const boot=`import{bootstrap}from'/tests/fixtures/n88-integrated-class/bootstrap.js';import{mountClassService,classBinding}from'/src/lib/student-portal-runtime.js';await bootstrap();let mode='success',handle;let calls=0,release;window.copies=[];window.failCopy=false;window.holdCopy=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(failCopy)throw Error('synthetic-refusal');copies.push(text);if(holdCopy)await new Promise(ok=>window.finishCopy=ok);}}});const root=document.querySelector('main');
const getBinding=w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:${JSON.stringify(teaching.id)}},w);
const send=async(path,init)=>{calls++;const input=JSON.parse(init.body);if(mode==='hold'||mode==='timeout')await new Promise(ok=>release=ok);const binding=input.binding;const data={classId:mode==='invalid-ack'?'wrong-class':binding.classId,rosterRevision:'a'.repeat(64),policyRevision:0,students:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}],visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]))};return new Response(JSON.stringify(mode==='failure'?{error:'POISON-PRIVATE-PAYLOAD'}:{rollout:'public',ack:true,binding,requestId:null,data}),{status:mode==='failure'?503:200,headers:mode==='missing'?{}:{'x-n88-service-region':mode==='invalid-header'?'POISON-PRIVATE-ID':'ap-south-1'}});};
window.review={start(next){handle?.dispose();mode=next;calls=0;handle=mountClassService(root,{fetch:send,getBinding,readTimeoutMs:next==='timeout'?50:10000,subscribe:fn=>{const a=n88Fixture.cloud.subscribe(fn),b=n88Fixture.store.subscribe(fn);return()=>{a();b();};}});},calls:()=>calls,held:()=>!!release,release:()=>release?.(),owner:()=>n88Fixture.switchOwner(),expire:()=>n88Fixture.expire(),dispose:()=>handle?.dispose()};window.review.start('success');`;
let server;const report={status:'FAIL',checks:[]};
try{
 server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main data-class-portal></main><script type="module" src="/boot.mjs"></script></html>');}
 if(u.pathname==='/boot.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(boot);}
 if(u.pathname==='/review/context'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ownerId:A,token,canonical}));}
 const file=path.resolve('.'+decodeURIComponent(u.pathname));if(!file.startsWith(process.cwd()+path.sep))throw Error('path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':file.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(await fs.readFile(file));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
await withIsolatedLocalBrowser({taskFile:root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json',runId:run,url:origin,timeoutMs:120000},async({createContext})=>{
 for(const width of [390,1280])for(const mode of ['success','failure']){
  const context=await createContext({viewport:{width,height:844}});
  try{
   const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(origin);await page.locator('.n88-class-roster').waitFor();
   if(mode==='failure'){await page.evaluate(()=>review.start('failure'));await page.locator('[data-n88-copy-failure]').waitFor();}
   const details=page.locator('[data-n88-list-support]'),button=page.locator('[data-n88-copy-list]');
   assert.equal(await details.evaluate(e=>e.open),false);assert.equal(await button.isVisible(),false);assert.equal(await page.evaluate(()=>copies.length),0);
   assert(!/elapsedMs|ap-south-1|success|POISON/.test(await page.locator('main').innerText()));
   await page.screenshot({path:dir+mode+'-collapsed-'+width+'.png',fullPage:true});
   await details.locator('summary').click();await button.click();await page.waitForFunction(()=>copies.length===1);
   const safe=JSON.parse(await page.evaluate(()=>copies[0]));assert.deepEqual(Object.keys(safe),['schema','region','elapsedMs','outcome']);assert.equal(safe.schema,'n88-list-response-v1');assert.equal(safe.region,'ap-south-1');assert.equal(safe.outcome,mode);assert(Number.isInteger(safe.elapsedMs)&&safe.elapsedMs>=0&&safe.elapsedMs<=30000);
   await page.evaluate(()=>failCopy=true);await button.click();const fallback=page.locator('[data-n88-list-copy-text]');await fallback.waitFor({state:'visible'});assert.equal(await fallback.inputValue(),await page.evaluate(()=>copies[0]));assert.equal(await fallback.evaluate(e=>e.readOnly),true);assert.match(await page.locator('[data-n88-list-copy-status]').innerText(),/يدويًا/);
   await page.screenshot({path:dir+mode+'-fallback-'+width+'.png',fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await button.click();assert.equal(await fallback.isVisible(),true);assert.equal(await page.evaluate(()=>copies.length),1);
   // Invalid tuples never copy, and must erase an earlier manual fallback.
   for(const value of [null,'{',JSON.stringify({region:'https://POISON',elapsedMs:1,outcome:'success'}),JSON.stringify({region:'unknown',elapsedMs:30001,outcome:'success'}),JSON.stringify({region:'unknown',elapsedMs:-1,outcome:'success'}),JSON.stringify({region:'unknown',elapsedMs:1.5,outcome:'success'}),JSON.stringify({region:'unknown',elapsedMs:0,outcome:'POISON'}),JSON.stringify({region:'unknown',elapsedMs:0,outcome:'success',token:'POISON'})]){
    await page.evaluate(v=>{const r=document.querySelector('main');v===null?r.removeAttribute('data-n88-list-response'):r.setAttribute('data-n88-list-response',v);},value);await button.click();assert.equal(await fallback.isVisible(),false);assert.equal(await fallback.inputValue(),'');assert.match(await page.locator('[data-n88-list-copy-status]').innerText(),/لم يُنسخ شيء/);
   }
   // Copy-time validation reads the current attribute; finite boundary values work.
   await page.evaluate(()=>{window.copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>copies.push(t)}});document.querySelector('main').setAttribute('data-n88-list-response',JSON.stringify({region:'unknown',elapsedMs:30000,outcome:'failure'}));});
   await button.click();await page.waitForFunction(()=>copies.length===1);assert.equal(JSON.parse(await page.evaluate(()=>copies[0])).elapsedMs,30000);assert.equal(JSON.parse(await page.evaluate(()=>copies[0])).region,'unknown');
   if(mode==='failure'){await page.locator('[data-n88-copy-failure]').click();await page.waitForFunction(()=>copies.length===2);const prior=JSON.parse(await page.evaluate(()=>copies[1]));assert.equal(prior.httpStatus,503);assert.equal(prior.sourceVersion,'n88-class-deadline-v1');assert(!JSON.stringify(prior).includes('POISON'));}
   const before=await page.evaluate(()=>copies.length);assert.equal(await page.evaluate(()=>review.calls()),1);
   await page.evaluate(()=>{window.detachedCopy=document.querySelector('[data-n88-copy-list]');review.dispose();detachedCopy.click();});assert.equal(await page.evaluate(()=>copies.length),before);
   report.checks.push({width,mode,status:'PASS',finiteCopy:true,invalidAndMissingAbsent:true,clipboardDeniedAndUnavailableFallback:true,legacyFailureCopyPreserved:true,oneListRequest:true,noHorizontalOverflow:true});
  }finally{await context.close();}
 }
 for(const retire of ['owner','expire','session']){
  const context=await createContext({viewport:{width:390,height:844}});
  try{const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(origin);await page.locator('.n88-class-roster').waitFor();await page.locator('[data-n88-list-support]>summary').click();
   await page.evaluate(()=>{holdCopy=true;window.saved=document.querySelector('[data-n88-copy-list]');});await page.locator('[data-n88-copy-list]').click();await page.waitForFunction(()=>copies.length===1);
   await page.evaluate(r=>{if(r==='owner')review.owner();else if(r==='expire')review.expire();else {const c=n88Fixture.cloud;const payload={session_id:'retired-session',exp:1};c.setMockAuth(c.user,{...c.session,access_token:'e30.'+btoa(JSON.stringify(payload))+'.synthetic'});}finishCopy();saved.click();window.dispatchEvent(new Event('focus'));},retire);await page.waitForFunction(()=>!document.querySelector('[data-n88-list-response]'));assert.equal(await page.evaluate(()=>copies.length),1);assert.equal(await page.locator('[data-n88-list-copy-text]').isVisible(),false);assert.equal(await page.locator('[data-n88-list-copy-text]').inputValue(),'');assert.equal(await page.locator('.n88-class-roster').count(),0);
   report.checks.push({retire,status:'PASS',inflightAndDetachedRetired:true});
  }finally{await context.close();}
 }
});report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup='Owned isolated browser, contexts and loopback server closed';await fs.writeFile(dir+'ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
