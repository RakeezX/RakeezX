/** AI: real source/private application DOM, handlers and CSS over owned loopback HTTP. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {studentFixture} from './service-fixture.mjs';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';
import {A} from '../fixtures/n88-existing-host/provider.mjs';
import {makeSection,makeTeaching} from '../../src/models.js';
const dir='tests/n88-student-session-quiet-progress-20261021/',root='C:/Users/Abody/Projects/RakeezX';
const task='continuous-n88-student-session-and-quiet-progress-20261021',run='d56d8290-b64f-493d-9dc8-69b8f84d7c36';
const extra=process.argv.includes('--extra');
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const r of rows)r.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});
canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const token='e30.'+Buffer.from(JSON.stringify({session_id:'synthetic-session',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
const sourceBoot=`import{mountUnifiedStudentPortal}from'/src/views/student-portal-login.js';import{createUnifiedStudentPortalClient}from'/src/lib/student-portal-unified-client.js';const client=createUnifiedStudentPortalClient();window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{client,readiness:{enabled:true}});window.retire=()=>client.invalidate();`;
const teacherBoot=`import{bootstrap}from'/tests/fixtures/n88-integrated-class/bootstrap.js';import{mountClassService,classBinding}from'/src/lib/student-portal-runtime.js';await bootstrap();let issued=false,hold='list',release,calls=[];window.copies=[];window.holdCopy=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copies.push(text);if(holdCopy)await new Promise(ok=>window.finishCopy=ok);}}});const root=document.querySelector('main');
const send=async(path,init)=>{const action=path.split('/').at(-1),input=JSON.parse(init.body);calls.push(action);if(hold===action)await new Promise(ok=>release=ok);const data=action==='list'?{classId:input.binding.classId,rosterRevision:'a'.repeat(64),policyRevision:0,students:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:issued,credentialVersion:issued?1:0,recoveryStatus:issued?'recoverable':'inactive',credential:issued?'123456':null}],visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]))}:action==='guidance-list'?{tasks:[]}:action==='issue-missing'?{requestId:input.requestId,created:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',credentialVersion:1,credential:'123456'}],skipped:[],failed:[],uncertain:false}:null;if(action==='issue-missing')issued=true;return new Response(JSON.stringify({rollout:'public',ack:true,binding:input.binding,requestId:input.requestId??null,data}),{headers:{'x-n88-service-region':'ap-south-1'}});};
const handle=mountClassService(root,{fetch:send,getBinding:w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:${JSON.stringify(teaching.id)}},w),subscribe:fn=>{const a=n88Fixture.cloud.subscribe(fn),b=n88Fixture.store.subscribe(fn);return()=>{a();b();};}});
window.review={calls:()=>calls,hold:a=>hold=a,release:()=>{hold='';release?.();},owner:()=>n88Fixture.switchOwner(),expire:()=>n88Fixture.expire(),dispose:()=>handle.dispose()};`;
let server,service,fault='',hold='',release,counts,errors=[];const jobs=new Set();
const report={status:'FAIL',student:[],teacher:[],scope:'Synthetic memory repository and actual numeric handler/credential adapter; no PG durability, live service or hosted acceptance proof.'};
try{
 server=createServer((req,res)=>{const job=(async()=>{try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  const send=(data,type='text/javascript')=>{if(!res.destroyed){res.setHeader('Content-Type',type);res.end(data);}};
  if(u.pathname==='/student')return send(await fs.readFile('drafts/n88-student-portal/activation/bundle/private/student.html'),'text/html; charset=utf-8');
  if(['/source','/teacher'].includes(u.pathname))return send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main data-class-portal></main><script type="module" src="/'+u.pathname.slice(1)+'-boot.mjs"></script></html>','text/html; charset=utf-8');
  if(u.pathname==='/source-boot.mjs')return send(sourceBoot);if(u.pathname==='/teacher-boot.mjs')return send(teacherBoot);
  if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token,canonical}),'application/json');
  if(u.pathname.startsWith('/api/n88/student/')){
   const action=u.pathname.split('/').at(-1);counts[action]++;let raw='';for await(const b of req)raw+=b;
   const result=await service.send(u.pathname,{method:req.method,body:raw?JSON.parse(raw):{},cookie:req.headers.cookie||''});raw='';
   if(hold===action)await new Promise(ok=>release=ok);
   if(result.cookie)res.setHeader('Set-Cookie',result.cookie);
   res.statusCode=result.status;
   if(fault===action+'-error'){res.statusCode=503;return send('{}','application/json');}
   if(fault==='read-denied'&&action==='read'){res.statusCode=403;return send('{}','application/json');}
   if(fault==='read-malformed'&&action==='read')return send('{"version":"wrong"}','application/json');
   return send(JSON.stringify(result.body),'application/json');
  }
  const mapped=u.pathname.startsWith('/n88-private/')?'drafts/n88-student-portal/activation/bundle/private/'+u.pathname.slice(13):u.pathname.slice(1);
  const file=path.resolve(mapped);if(!file.startsWith(process.cwd()+path.sep)||mapped.includes('..'))throw Error('path');
  send(await fs.readFile(file),({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
 }catch{if(!res.destroyed){res.statusCode=500;res.end();}}})();jobs.add(job);job.finally(()=>jobs.delete(job));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json',runId:run,url:origin,timeoutMs:120000},async({createContext})=>{
  const visibility=(page,state)=>page.evaluate(s=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:s});document.dispatchEvent(new Event('visibilitychange'));},state);
  const login=async p=>{await p.getByLabel('رمز الدخول',{exact:true}).fill(service.code);await p.getByRole('button',{name:'دخول الطالب',exact:true}).click();};
  const privateVisible=p=>p.getByRole('heading',{name:'مساحتي الدراسية',exact:true}).waitFor();
  const reset=async()=>{release?.();release=null;hold=fault='';counts={claim:0,read:0,end:0};service=await studentFixture();};
  for(const target of ['/source','/student'])for(const scenario of (extra?['read-denied',...(target==='/source'?['late-retire']:[])]:['twice','return','expired','revoked','read-error','read-malformed','claim-error','hidden-pending','pagehide','end-hidden',...(target==='/source'?['retire','dispose','read-timeout']:[])])){
   await reset();const c=await createContext({viewport:{width:390,height:844}}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.name));
   try{
    await p.goto(origin+target);await p.locator('[data-claim]').waitFor();
    if(['read-error','read-malformed','read-denied','claim-error'].includes(scenario))fault=scenario;
    if(['hidden-pending','read-timeout','late-retire'].includes(scenario))hold='read';
    await login(p);
    if(['read-error','read-malformed','read-denied','claim-error','read-timeout'].includes(scenario)){
     const expected=scenario==='claim-error'?'تعذّر تأكيد الدخول':scenario==='read-denied'?'الجلسة غير متاحة أو انتهت':'قُبل الرمز';
     await p.waitForFunction(t=>document.querySelector('#n88-message')?.textContent.includes(t),expected,{timeout:18000});
     assert.equal(await p.locator('input').getAttribute('aria-invalid'),'false');assert.equal(await p.locator('input').inputValue(),'');assert.equal(counts.claim,1);assert.equal(counts.read,scenario==='claim-error'?0:1);
     release?.();hold=fault='';await p.getByRole('button',{name:'متابعة جلسة سابقة',exact:true}).click();await privateVisible(p);assert.equal(counts.claim,1);
    }else if(['hidden-pending','late-retire'].includes(scenario)){
     await p.waitForFunction(()=>document.querySelector('form')?.getAttribute('aria-busy')==='true');await visibility(p,'hidden');
     for(let n=0;!release;n++){assert(n<200);await p.waitForTimeout(10);}release();hold='';await p.waitForTimeout(80);
     assert(!await p.locator('body').innerText().then(t=>t.includes('طالب مصطنع')));
     if(scenario==='late-retire')await p.evaluate(()=>retire());await visibility(p,'visible');
     if(scenario==='late-retire'){await p.waitForTimeout(80);assert.equal(await p.locator('[data-end]').count(),0);}else await privateVisible(p);assert.equal(counts.claim,1);assert.equal(counts.read,1);
    }else{
     await privateVisible(p);
     if(scenario==='twice'){
      await p.screenshot({path:dir+(target==='/student'?'private':'source')+'-student-390.png',fullPage:true});
      await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await login(p);await privateVisible(p);assert.equal(counts.claim,2);assert.equal(counts.read,2);
     }else if(scenario==='end-hidden'){
      hold='end';await p.locator('[data-end]').click();for(let n=0;!release;n++){assert(n<200);await p.waitForTimeout(10);}await visibility(p,'hidden');await visibility(p,'visible');assert.equal(counts.read,1);release();hold='';await p.waitForTimeout(80);assert.equal(await p.locator('[data-end]').count(),0);assert.equal(counts.end,1);
     }else{
      await visibility(p,'hidden');assert(!await p.locator('body').innerText().then(t=>t.includes('طالب مصطنع')));
      if(scenario==='expired')service.expire();if(scenario==='revoked')await service.revoke();
      if(scenario==='retire')await p.evaluate(()=>retire());if(scenario==='dispose')await p.evaluate(()=>handle.dispose());if(scenario==='pagehide')await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
      const hard=['retire','dispose','pagehide'].includes(scenario);if(!hard)hold='read';await visibility(p,'visible');await visibility(p,'visible');
      if(hard){await p.waitForTimeout(80);assert.equal(counts.read,1);assert.equal(await p.locator('[data-end]').count(),0);}
      else{
       for(let n=0;!release;n++){assert(n<200);await p.waitForTimeout(10);}assert.equal(counts.read,2);assert.equal(await p.locator('[data-end]').count(),0);release();hold='';
       if(['expired','revoked'].includes(scenario)){await p.getByText('الجلسة غير متاحة أو انتهت. أدخل رمزك أو راجع معلمك.',{exact:true}).waitFor();assert.equal(await p.locator('[data-end]').count(),0);}else await privateVisible(p);
       assert.equal(counts.claim,1);assert.equal(counts.read,2);
      }
     }
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);
    report.student.push({target,scenario,status:'PASS',counts:{...counts}});
   }finally{release?.();release=null;await c.close();await Promise.allSettled([...jobs]);}
  }
  if(!extra){
  // The second valid claim works with the unchanged actual server handler;
  // a genuine denied claim still stays denied and never starts a read.
  await reset();await service.revoke();const deniedContext=await createContext(),deniedPage=await deniedContext.newPage();await deniedPage.goto(origin+'/student');await login(deniedPage);await deniedPage.waitForFunction(()=>document.querySelector('input')?.getAttribute('aria-invalid')==='true');assert.deepEqual(counts,{claim:1,read:0,end:0});report.student.push({scenario:'revoked-claim',status:'PASS'});await deniedContext.close();
  for(const width of [390,1280]){
   const c=await createContext({viewport:{width,height:844}}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.name));
   try{
    await p.goto(origin+'/teacher');const status=p.locator('[data-n88-entry-status]');await status.waitFor();assert.equal(await p.locator('main').getAttribute('aria-busy'),'true');assert.equal(await status.getAttribute('role'),'status');await p.waitForTimeout(500);assert.equal(await status.evaluate(e=>getComputedStyle(e).opacity),'1');await p.screenshot({path:dir+'teacher-loading-'+width+'.png',fullPage:true});await p.evaluate(()=>review.release());await p.locator('.n88-class-roster').waitFor();assert.deepEqual(await p.evaluate(()=>review.calls()),['list']);
    await p.evaluate(()=>review.hold('guidance-list'));await p.locator('.n88-task-guidance>summary').click();await p.locator('.n88-task-guidance[aria-busy=true]').waitFor();await p.waitForTimeout(500);assert.equal(await p.getByText('جارٍ قراءة المهام…',{exact:true}).getAttribute('role'),'status');await p.screenshot({path:dir+'teacher-tasks-'+width+'.png',fullPage:true});await p.evaluate(()=>review.release());await p.locator('.n88-task-guidance[aria-busy=false]').waitFor();
    await p.evaluate(()=>review.hold('issue-missing'));await p.getByRole('button',{name:'إنشاء الرموز الناقصة',exact:true}).click();await p.getByText('جارٍ إتمام العملية، يرجى الانتظار…',{exact:true}).waitFor();assert.equal(await p.locator('[data-code]').count(),0);assert.equal(await p.getByRole('button',{name:'إنشاء الرموز الناقصة',exact:true}).isDisabled(),true);assert(!await p.locator('main').innerText().then(t=>t.includes('أُنشئ:')));await p.screenshot({path:dir+'teacher-operation-'+width+'.png',fullPage:true});await p.evaluate(()=>review.release());await p.locator('[data-code]').waitFor();
    assert.deepEqual(await p.evaluate(()=>review.calls()),['list','guidance-list','issue-missing','list']);
    await p.locator('[data-n88-list-support]>summary').click();await p.evaluate(()=>holdCopy=true);await p.locator('[data-n88-copy-list]').click();await p.waitForFunction(()=>copies.length===1);
    await p.evaluate(()=>{window.saved=document.querySelector('[data-n88-copy-list]');review.owner();finishCopy();saved.click();});await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>copies.length),1);assert.equal(await p.locator('[data-code]').count(),0);assert.equal(await p.locator('.n88-class-roster').count(),0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    report.teacher.push({width,status:'PASS',pendingBeforeACK:true,oneInitialList:true,copyOwnerRetirement:true});
   }finally{await c.close();}
  }
  // Separate lease retirement exercises the actual account/store entry guard.
  const leaseContext=await createContext(),leasePage=await leaseContext.newPage();await leasePage.goto(origin+'/teacher');await leasePage.waitForFunction(()=>window.review);await leasePage.evaluate(()=>review.release());await leasePage.locator('.n88-class-roster').waitFor();await leasePage.evaluate(()=>{review.expire();window.dispatchEvent(new Event('focus'));});await leasePage.waitForFunction(()=>document.querySelector('main').dataset.n88EntryState==='lease');assert.equal(await leasePage.locator('.n88-class-roster').count(),0);await leaseContext.close();report.teacher.push({scenario:'lease-retirement',status:'PASS'});
  const desktop=await createContext({viewport:{width:1280,height:900}}),p=await desktop.newPage();await reset();await p.goto(origin+'/student');await login(p);await privateVisible(p);await p.screenshot({path:dir+'private-student-1280.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await desktop.close();
  }
 });
 assert.deepEqual(errors,[]);report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message.replace(/1[0-9]{5}/g,'[REDACTED]').slice(0,1000)};process.exitCode=1;}
finally{release?.();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}await Promise.allSettled([...jobs]);report.cleanup='Owned isolated contexts/browser and loopback server closed';await fs.writeFile(dir+(extra?'ui-extra.json':'ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
