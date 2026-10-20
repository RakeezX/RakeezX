import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import path from 'node:path';
import {makeSection,makeTeaching} from '../../src/models.js';import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';import {A} from '../fixtures/n88-existing-host/provider.mjs';import {composition} from './composition.mjs';
const taskId='continuous-n88-actual-teacher-deadline-cause-20261020',runId='bdbf83c0-795c-43cc-86ed-9a6994eb67e7',base='7a68241d47c4501b224ac237a36e9d44c4a377ea',root='C:/Users/Abody/Projects/RakeezX';
const lease=a=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',a,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const report={taskId,runId,browserReadDeadlineMs:process.argv.includes('--default-budget')?10000:500,acquireDependencyMs:process.argv.includes('--default-budget')?[5500,5500]:[550,200],status:'FAIL',checks:[],actualHostedCause:'NOT_PROVEN',hostedTeacherSuccess:'NOT_PROVEN'};let server,browser,owned=false,mode='baseline',service,lastPage;const work=[];
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const r of rows)r.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const boot=variant=>"import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import * as store from '/src/store.js';import * as cloud from '/src/lib/cloud.js';import {mountClassService,classBinding,studentPortalDiagnostic} from '"+(variant==='baseline'?'/baseline.js':'/src/lib/student-portal-runtime.js')+"';await bootstrap();window.handle=mountClassService(document.querySelector('#portal'),{readTimeoutMs:"+(process.argv.includes("--default-budget")?10000:500)+",getBinding:w=>classBinding({cloud,store,teachingId:"+JSON.stringify(teaching.id)+"},w),subscribe:fn=>{const a=cloud.subscribe(fn),b=store.subscribe(fn);return()=>{a();b();};}});window.review={renew:()=>{store.state.teachings[0].revision=(store.state.teachings[0].revision??1)+1;window.dispatchEvent(new Event('focus'));},diagnostic:studentPortalDiagnostic,owner:()=>window.n88Fixture.switchOwner()};";
try {
 const l=lease('acquire');assert.match(l,/^(ACQUIRED|ALREADY OWNED)/);owned=l.startsWith('ACQUIRED');
 server=createServer((req,res)=>{const pending=(async()=>{try{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');const send=(b,type='text/javascript')=>{if(res.destroyed)return;res.setHeader('Content-Type',type);res.end(b);};
 if(u.pathname==='/teacher')return send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><header><h1 class="topbar__title">مساحة طلاب الفصل</h1></header><main id="portal"></main><script type="module" src="/boot.js"></script></html>','text/html');
 if(u.pathname==='/boot.js')return send(boot(mode));
 if(u.pathname==='/baseline.js')return send(execFileSync('git',['show',base+':src/lib/student-portal-runtime.js'],{encoding:'utf8'}).replaceAll("'./","'/src/lib/").replaceAll("'../views/","'/src/views/"));
 if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token:service.provider.token(),canonical}),'application/json');
 if(u.pathname.startsWith('/api/n88/teacher/class/')){
  let body='';for await(const c of req)body+=c;
  const r=await service.send(u.pathname,{method:'POST',headers:req.headers,body});(report.transport??=[]).push({mode,status:r.status,serviceStage:r.headers.get('x-n88-service-stage'),counts:service.counts});
  if(res.destroyed)return;res.statusCode=r.status;for(const [k,v]of r.headers)res.setHeader(k,v);return res.end(await r.text());
 }
 const file=u.pathname.slice(1);if(!/^(src|assets|font|tests\/fixtures\/n88-integrated-class)\/[A-Za-z0-9_./-]+$/.test(file)||file.includes('..')){res.statusCode=404;return res.end();}
 send(await fs.readFile(file),{'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream');
 }catch(e){report.serverFailure={name:e.name,message:e.message.slice(0,150)};if(!res.destroyed){res.statusCode=500;res.end();}}})();work.push(pending);});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port,{chromium}=createRequire(root+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 for(const variant of (process.argv.includes('--error-only')?['service-failure']:process.argv.includes('--default-budget')?['baseline','corrected']:['baseline','corrected','service-failure'])){
  mode=variant;service=composition({classId:section.id,teachingId:teaching.id,failStage:variant==='service-failure',...(process.argv.includes('--default-budget')?{firstDelay:5500,nextDelay:5500}:{})});
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));const p=await ctx.newPage();lastPage=p;p.setDefaultTimeout(process.argv.includes('--default-budget')?15000:5000);await p.goto(origin+'/teacher');await p.waitForFunction(()=>!!window.review);
  if(variant!=='service-failure'){
   await p.waitForTimeout(process.argv.includes('--default-budget')?250:80);await p.evaluate(()=>review.renew());
   if(variant==='baseline'){await p.locator('[data-n88-entry-state=timeout]').waitFor();report.checks.push({baseline:'Retired HTTP acquisition occupied FIFO; replacement initial read timed out behind old acquisition plus its own controlled acquisition, within unchanged server limits'});}
   else{
    await p.locator('.n88-class-roster>li').waitFor();assert.equal(await p.locator('.n88-class-roster>li').count(),1);
    const diag=await p.evaluate(()=>review.diagnostic());assert(['admitted','queue','dispatch','http','response'].includes(diag.phase));assert.equal(await p.getByRole('heading',{name:'مساحة طلاب الفصل',exact:true}).count(),1);
    const link=p.getByRole('link',{name:'صفحة دخول الطالب'});assert.equal(await link.getAttribute('href'),'/student');assert.equal(await link.locator('..').getAttribute('class'),'n88-entry-toolbar');
    const layout=await link.evaluate(e=>({height:e.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));assert(layout.height>=40&&!layout.overflow);
    await p.screenshot({path:'tests/n88-actual-deadline-20261020/ready-390.png',fullPage:true});
    await p.evaluate(()=>review.owner());assert.equal(await p.locator('.n88-class-roster').count(),0);
    report.checks.push({correction:'Owned retired HTTP aborted; replacement request succeeds within unchanged configured deadline through real client/signed ingress/Web entry/Auth SDK/repository/commit ACK',guards:'Actual owner/lease binding clears on owner change; one validated pupil, no guessed result',layout});
   }
  }else{
   await p.locator('[data-n88-entry-state=timeout]').waitFor();
   const timeout=await p.evaluate(()=>review.diagnostic());assert.equal(timeout.phase,'dispatch');assert.equal(timeout.code,'timeout');
   await p.waitForTimeout(120);const after=await p.evaluate(()=>review.diagnostic());assert.equal(after.code,'timeout','late HTTP must not overwrite deadline');
   assert.equal(await p.getByRole('link',{name:'صفحة دخول الطالب'}).count(),1);assert.equal(await p.getByRole('heading',{name:'مساحة طلاب الفصل',exact:true}).count(),1);
   const layout=await p.evaluate(()=>{const el=document.querySelector('#portal'),message=el.querySelector('[role=status]');return {overflow:document.documentElement.scrollWidth>innerWidth,rootWidth:el.getBoundingClientRect().width,messageWidth:message.getBoundingClientRect().width};});report.errorLayout=layout;
   await p.screenshot({path:'tests/n88-actual-deadline-20261020/error-390.png',fullPage:true});assert(!layout.overflow);
   // Explicit retry has a bounded200ms failing acquire, preserving its exact finite phase header.
   await p.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await p.locator('[data-n88-entry-state=connection]').waitFor();
   const d=await p.evaluate(()=>review.diagnostic());assert.equal(d.phase,'http');assert.equal(d.code,'rejected');assert.equal(d.stage,'acquire');assert.equal(d.httpStatus,503);
   report.checks.push({failurePhase:'dispatch/timeout remains after late response; subsequent actual acquire503 remains http/rejected/acquire',privateFieldsAbsent:!JSON.stringify(d).includes(A)});
  }
  await ctx.close();await Promise.allSettled(work);
 }
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message,checkpoint:await lastPage?.evaluate(()=>({diagnostic:review.diagnostic(),entryState:document.querySelector('#portal').dataset.n88EntryState,abortAny:typeof AbortSignal.any})).catch(()=>null)};process.exitCode=1;}
finally{await browser?.close();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}await Promise.allSettled(work);report.cleanup={ownedBrowserAndServerClosed:true,browserLease:owned?lease('release'):'not acquired'};await fs.writeFile(process.argv.includes('--error-only')?'tests/n88-actual-deadline-20261020/layout.json':process.argv.includes('--default-budget')?'tests/n88-actual-deadline-20261020/default-budget.json':'tests/n88-actual-deadline-20261020/ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
