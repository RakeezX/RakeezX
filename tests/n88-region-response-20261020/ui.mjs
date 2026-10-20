/** AI: actual runtime/client/view/CSS and existing account/owner/lease fixture over owned HTTP. */
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';import {A} from '../fixtures/n88-existing-host/provider.mjs';import {makeSection,makeTeaching} from '../../src/models.js';
const root='C:/Users/Abody/Projects/RakeezX',task='continuous-n88-region-response-attestation-20261020',run='267848ca-6455-4b13-8088-63a960922547',dir='tests/n88-region-response-20261020/';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const token='e30.'+Buffer.from(JSON.stringify({session_id:'synthetic-session',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
const boot=`import{bootstrap}from'/tests/fixtures/n88-integrated-class/bootstrap.js';import{mountClassService,classBinding}from'/src/lib/student-portal-runtime.js';await bootstrap();let mode='success',handle;let calls=0,release;const root=document.querySelector('main');
const getBinding=w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:${JSON.stringify(teaching.id)}},w);
const send=async(path,init)=>{calls++;const input=JSON.parse(init.body);if(mode==='hold'||mode==='timeout')await new Promise(ok=>release=ok);const binding=input.binding;const data={classId:mode==='invalid-ack'?'wrong-class':binding.classId,rosterRevision:'a'.repeat(64),policyRevision:0,students:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}],visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]))};return new Response(JSON.stringify(mode==='failure'?{error:'POISON-PRIVATE-PAYLOAD'}:{rollout:'public',ack:true,binding,requestId:null,data}),{status:mode==='failure'?503:200,headers:mode==='missing'?{}:{'x-n88-service-region':mode==='invalid-header'?'POISON-PRIVATE-ID':'ap-south-1'}});};
window.review={start(next){handle?.dispose();mode=next;calls=0;handle=mountClassService(root,{fetch:send,getBinding,readTimeoutMs:next==='timeout'?50:10000,subscribe:fn=>{const a=n88Fixture.cloud.subscribe(fn),b=n88Fixture.store.subscribe(fn);return()=>{a();b();};}});},calls:()=>calls,held:()=>!!release,release:()=>release?.(),owner:()=>n88Fixture.switchOwner(),expire:()=>n88Fixture.expire(),dispose:()=>handle?.dispose()};window.review.start('success');`;
let browser,server,owned=false;const report={status:'FAIL',runId:run,scope:'Actual app authenticated runtime, ownership guard, class client/view and source CSS; fresh loopback synthetic contexts',checks:[],actualTeacherReads:0,providerOperations:0};
try{
 const status=lease('acquire');assert.match(status,/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main data-class-portal></main><script type="module" src="/boot.mjs"></script></html>');}
 if(u.pathname==='/boot.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(boot);}
 if(u.pathname==='/review/context'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ownerId:A,token,canonical}));}
 const file=path.resolve('.'+decodeURIComponent(u.pathname));if(!file.startsWith(process.cwd()+path.sep))throw Error('path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':file.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(await fs.readFile(file));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;const {chromium}=createRequire(root+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 for(const scenario of ['success','missing','invalid-header','failure','invalid-ack','timeout','owner-retire','lease-retire']){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  try{await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));const page=await context.newPage();page.setDefaultTimeout(7000);
   await page.goto(origin);await page.locator('.n88-class-roster').waitFor();
   const initialText=await page.locator('main').innerText();
   if(scenario!=='success')await page.evaluate(s=>review.start(s==='owner-retire'?'hold':s==='lease-retire'?'hold':s),scenario);
   if(scenario==='owner-retire'||scenario==='lease-retire'){
    await page.waitForFunction(()=>review.held());await page.evaluate(s=>{s==='owner-retire'?review.owner():review.expire();review.release();},scenario);
    await page.locator('.n88-class-roster').waitFor({state:'detached'});await page.evaluate(()=>new Promise(ok=>setTimeout(ok,80)));
    assert.equal(await page.locator('[data-n88-list-response]').count(),0);report.checks.push({scenario,status:'PASS',diagnosticRetired:true});continue;
   }
   await page.locator('[data-n88-list-response]').waitFor();const diagnostic=JSON.parse(await page.locator('main').getAttribute('data-n88-list-response'));
   assert.deepEqual(Object.keys(diagnostic),['region','elapsedMs','outcome']);assert(Number.isInteger(diagnostic.elapsedMs)&&diagnostic.elapsedMs>=0&&diagnostic.elapsedMs<=30000);
   assert.equal(diagnostic.region,['missing','invalid-header','timeout'].includes(scenario)?'unknown':'ap-south-1');
   assert.equal(diagnostic.outcome,['failure','invalid-ack','timeout'].includes(scenario)?'failure':'success');
   if(diagnostic.outcome==='success'){await page.locator('.n88-class-roster').waitFor();assert.equal(await page.locator('.n88-class-roster>li').count(),1);assert.equal(await page.locator('main').innerText(),initialText);}
   else{await page.locator('[data-n88-entry-status]').waitFor();assert.equal(await page.locator('.n88-class-roster').count(),0);}
   const text=await page.locator('main').innerText();assert(!/ap-south-1|unknown|elapsedMs|POISON/.test(text));assert(!/POISON|Bearer|synthetic-session|https?:/.test(JSON.stringify(diagnostic)));assert.equal(await page.evaluate(()=>review.calls()),1);
   if(scenario==='timeout'){await page.evaluate(()=>review.release());await page.evaluate(()=>new Promise(ok=>setTimeout(ok,80)));assert.equal(await page.locator('main').getAttribute('data-n88-list-response'),JSON.stringify(diagnostic));}
   await page.evaluate(()=>review.dispose());assert.equal(await page.locator('[data-n88-list-response]').count(),0);report.checks.push({scenario,status:'PASS',diagnostic,resultAndTextPreserved:true,initialListReads:1});
  }finally{await context.close();}
 }
 report.status='PASS';report.foreignRequestsBlocked=true;report.persistentProfiles=false;
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await browser?.close();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup={ownedBrowserAndServerClosed:true,lease:owned?lease('release'):'not acquired'};await fs.writeFile(dir+'ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
