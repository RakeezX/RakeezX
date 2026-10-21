/** AI: focused actual application DOM/CSS with fabricated service, fresh owned contexts. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {studentFixture} from '../n88-student-session-quiet-progress-20261021/service-fixture.mjs';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';
import {A} from '../fixtures/n88-existing-host/provider.mjs';
import {makeSection,makeTeaching} from '../../src/models.js';
const dir='tests/n88-student-reopen-end-guidance-20261021/',root='C:/Users/Abody/Projects/RakeezX';
const task='continuous-n88-student-reopen-end-guidance-20261021',run='05421e19-d5a7-47ee-8b6b-32259e1adf68';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true}).trim();
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const r of rows)r.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});
canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const token='e30.'+Buffer.from(JSON.stringify({session_id:'synthetic-session',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
const sourceBoot=`import{mountUnifiedStudentPortal}from'/src/views/student-portal-login.js';import{createUnifiedStudentPortalClient}from'/src/lib/student-portal-unified-client.js';const client=createUnifiedStudentPortalClient();window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{client,readiness:{enabled:true}});window.retire=()=>client.invalidate();`;
const teacherBoot=`import{bootstrap}from'/tests/fixtures/n88-integrated-class/bootstrap.js';import{mountClassService,classBinding}from'/src/lib/student-portal-runtime.js';await bootstrap();let issued=true,hold='',release,calls=[];window.copies=[];window.holdCopy=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copies.push(text);if(holdCopy)await new Promise(ok=>window.finishCopy=ok);}}});const root=document.querySelector('main');
const send=async(path,init)=>{const action=path.split('/').at(-1),input=JSON.parse(init.body);calls.push(action);if(hold===action)await new Promise(ok=>release=ok);if(window.failGuidance&&action==='guidance-list')throw Error('synthetic');const data=action==='list'?{classId:input.binding.classId,rosterRevision:'a'.repeat(64),policyRevision:0,students:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:issued,credentialVersion:issued?1:0,recoveryStatus:issued?'recoverable':'inactive',credential:issued?'123456':null}],visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]))}:action==='guidance-list'?{tasks:[{subitemId:'task',title:'مهمة مصطنعة',sourceStamp:'a'.repeat(64),revision:1,executionInstructions:'تعليمات',deliveryInstructions:'تسليم',needsRepublication:false}]}:action==='issue-missing'?{requestId:input.requestId,created:[{studentId:'synthetic',enrollmentId:'synthetic-enrollment',credentialVersion:1,credential:'123456'}],skipped:[],failed:[],uncertain:false}:null;if(action==='issue-missing')issued=true;return new Response(JSON.stringify({rollout:'public',ack:true,binding:input.binding,requestId:input.requestId??null,data}),{headers:{'x-n88-service-region':'ap-south-1'}});};
const handle=mountClassService(root,{fetch:send,getBinding:w=>classBinding({cloud:n88Fixture.cloud,store:n88Fixture.store,teachingId:${JSON.stringify(teaching.id)}},w),subscribe:fn=>{const a=n88Fixture.cloud.subscribe(fn),b=n88Fixture.store.subscribe(fn);return()=>{a();b();};}});
window.review={calls:()=>calls,hold:a=>hold=a,unhold:()=>hold='',release:()=>{hold='';release?.();},owner:()=>n88Fixture.switchOwner(),expire:()=>n88Fixture.expire(),dispose:()=>handle.dispose()};`;
let server,browser,leased=false,service,mode='',counts={read:0,end:0,claim:0},releases=[];
const report={status:'FAIL',checks:[],errors:[]};
try {
 report.lease=lease('acquire');leased=true;
 server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 const send=(body,type='text/javascript')=>{if(!res.destroyed){res.setHeader('Content-Type',type);res.end(body);}};
 if(['/source','/teacher'].includes(u.pathname))return send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main></main><script type="module" src="/'+u.pathname.slice(1)+'-boot.mjs"></script></html>','text/html; charset=utf-8');
 if(u.pathname==='/source-boot.mjs')return send(sourceBoot);if(u.pathname==='/teacher-boot.mjs')return send(teacherBoot);
 if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token,canonical}),'application/json');
 if(u.pathname.startsWith('/api/n88/student/')){
 const action=u.pathname.split('/').at(-1);counts[action]++;let raw='';for await(const b of req)raw+=b;
 if(mode===action+'-hold')await new Promise(ok=>releases.push(ok));
 if(mode===action+'-error'){res.statusCode=503;return send('{}','application/json');}
 if(mode===action+'-denied'){res.statusCode=403;return send('{}','application/json');}
 const result=await service.send(u.pathname,{method:req.method,body:raw?JSON.parse(raw):{},cookie:req.headers.cookie||''});
 if(result.cookie)res.setHeader('Set-Cookie',result.cookie);res.statusCode=result.status;return send(JSON.stringify(result.body),'application/json');
 }
 const file=path.resolve('.'+u.pathname);if(!file.startsWith(process.cwd()+path.sep))throw Error('outside');
 send(await fs.readFile(file),({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 browser=await createRequire(root+'/package.json')('playwright').chromium.launch({headless:true});
 const context=async width=>{const c=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));return c;};
 const fresh=async width=>{service=await studentFixture();mode='';counts={read:0,end:0,claim:0};const c=await context(width),p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>report.errors.push(e.name+':'+e.message));return {c,p};};
 const text=p=>p.locator('body').innerText();
 const privateVisible=p=>p.locator('[data-end]').waitFor();
 const claim=async p=>{await p.locator('[data-claim]').waitFor();await p.locator('input').fill(service.code);await p.locator('[type=submit]').click();await privateVisible(p);};
 const hidden=async(p,v)=>p.evaluate(v=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:v});document.dispatchEvent(new Event('visibilitychange'));},v);
 const fits=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(!process.argv.includes('--teacher')&&!process.argv.includes('--additional')&&!process.argv.includes('--cooldown')){
 for(const width of [390,1280]){
 const {c,p}=await fresh(width);
 try {
 await p.goto(origin+'/source');await p.locator('[data-claim]').waitFor();assert.equal(counts.read,1);assert.equal(counts.claim,0);
 await claim(p);assert.equal(counts.claim,1);let n=counts.read;
 await p.reload();await privateVisible(p);assert.equal(counts.read,n+1);assert.equal(counts.claim,1);
 await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));await p.waitForTimeout(60);assert.equal(counts.read,n+1);
 await p.close();const q=await c.newPage();await q.goto(origin+'/source');await privateVisible(q);assert.equal(counts.claim,1);assert.equal(counts.read,n+2);
 report.checks.push({name:'fresh-valid-denied-reload-close-reopen-'+width,status:'PASS'});
 // End waits with private DOM already retired, then explicit acknowledged completion.
 mode='end-hold';await q.locator('[data-end]').click();await q.getByRole('heading',{name:'جارٍ إنهاء الجلسة…',exact:true}).waitFor();assert(!(await text(q)).includes('طالب مصطنع'));await fits(q);await q.screenshot({path:dir+'end-pending-'+width+'.png'});
 mode='';for(const ok of releases.splice(0))ok();await q.locator('[data-claim]').waitFor();assert((await text(q)).includes('انتهت الجلسة.'));assert.equal(counts.end,1);
 await claim(q);mode='end-denied';await q.locator('[data-end]').click();await q.locator('[data-session-retry]').waitFor();assert(!(await text(q)).includes('انتهت الجلسة.'));assert.equal(counts.end,2);mode='';await q.locator('[data-session-retry]').click();await privateVisible(q);assert.equal(counts.end,2);
 mode='read-error';await q.reload();await q.locator('[data-session-retry]').waitFor();assert.equal(await q.locator('[data-claim]').count(),0);assert(!(await text(q)).includes('طالب مصطنع'));await fits(q);await q.screenshot({path:dir+'read-retry-'+width+'.png'});mode='';await q.locator('[data-session-retry]').click();await privateVisible(q);
 await hidden(q,'hidden');assert.equal(await q.locator('[data-end]').count(),0);n=counts.read;await hidden(q,'visible');await privateVisible(q);assert.equal(counts.read,n+1);
 await service.revoke();await q.reload();await q.locator('[data-claim]').waitFor();assert.equal(await q.locator('[data-end]').count(),0);
 report.checks.push({name:'end-ack-denial-recovery-hidden-revoked-'+width,status:'PASS'});
 }finally{mode='';for(const ok of releases.splice(0))ok();await c.close();}
 }
 // Ignore AbortSignal completely, including delayed response bodies; actual client must settle.
 for(const action of ['read','end']){
 const {c,p}=await fresh(390);try{
 await p.goto(origin+'/source');if(action==='end')await claim(p);else await p.locator('[data-claim]').waitFor();
 await p.evaluate(async action=>{
 window.handle.dispose();const {createUnifiedStudentPortalClient}=await import('/src/lib/student-portal-unified-client.js');const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');
 window.transportCalls=[];const client=createUnifiedStudentPortalClient({timeoutMs:120,fetch:async(url,init)=>{transportCalls.push(url.split('/').at(-1));if(url.endsWith('/'+action))return await new Promise(ok=>window.late=()=>ok(new Response(JSON.stringify({version:'n88-student-v3',profile:{name:'LATE_PRIVATE'}}))));return new Response(JSON.stringify({version:'n88-student-v3',profile:{name:'synthetic'}}));}});
 window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{client,readiness:{enabled:true}});
 },action);
 if(action==='end'){await privateVisible(p);await p.locator('[data-end]').click();}
 await p.locator('[data-session-retry]').waitFor();assert.equal(await p.locator('[data-end]').count(),0);await p.evaluate(()=>late());await p.waitForTimeout(100);assert(!(await text(p)).includes('LATE_PRIVATE'));assert.equal(await p.evaluate(a=>transportCalls.filter(x=>x===a).length,action),1);
 report.checks.push({name:action+'-abort-ignoring-timeout-late-private-fence',status:'PASS'});
 }finally{await c.close();}}
 // UI's own independent deadline also covers clients without transport cancellation.
 {const {c,p}=await fresh(390);try{await p.goto(origin+'/source');await p.locator('[data-claim]').waitFor();await p.evaluate(async()=>{handle.dispose();const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{readiness:{enabled:true},client:{read:async()=>({version:'n88-student-v3'}),end:()=>new Promise(ok=>window.endLate=ok)}});});await privateVisible(p);await p.locator('[data-end]').click();await p.locator('[data-session-retry]').waitFor({timeout:17000});await p.evaluate(()=>endLate());await p.waitForTimeout(50);assert.equal(await p.locator('[data-claim]').count(),0);report.checks.push({name:'independent-view-end-deadline-no-late-ack',status:'PASS'});}finally{await c.close();}}
 }
 if(!process.argv.includes('--student')&&!process.argv.includes('--additional')&&!process.argv.includes('--cooldown')) for(const width of [390,1280]){
 const {c,p}=await fresh(width);try{
 await p.goto(origin+'/teacher');await p.locator('.n88-class-roster').waitFor();
 await p.evaluate(()=>review.hold('guidance-list'));await p.locator('.n88-task-guidance summary').click();
 await p.locator('.n88-task-guidance[aria-busy=true]').waitFor();assert((await text(p)).includes('يشمل الانتظار في الطابور'));await fits(p);await p.screenshot({path:dir+'guidance-pending-'+width+'.png'});
 // Queue a class review behind the stalled guidance. Deadline cancels the owned
 // lane even though this fabricated transport ignores the AbortSignal.

 await p.locator('[data-guidance-refresh]').waitFor({timeout:12000});await p.locator('.n88-class-roster').waitFor();
 assert(!(await text(p)).includes('لا توجد مهام'));assert.equal(await p.locator('.n88-task-guidance').getAttribute('aria-busy'),'false');
 await p.evaluate(()=>review.release());await p.waitForTimeout(50);assert.equal(await p.locator('[data-guidance]').count(),0);
 await p.locator('[data-guidance-refresh]').click();await p.locator('[data-guidance]').waitFor();
 await p.locator('[name=executionInstructions]').fill('مسودة مصطنعة محفوظة');
 const beforeReturn=await p.evaluate(()=>review.calls().filter(x=>x==='guidance-list').length);
 await p.evaluate(()=>{window.failGuidance=true;dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});
 await p.waitForFunction(n=>review.calls().filter(x=>x==='guidance-list').length===n+1,beforeReturn);await p.locator('.n88-task-guidance[aria-busy=false]').waitFor();
 await p.locator('[data-guidance-refresh]').waitFor();assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة محفوظة');assert(!(await text(p)).includes('لا توجد مهام'));await fits(p);await p.screenshot({path:dir+'guidance-failure-'+width+'.png'});
 await p.evaluate(()=>window.failGuidance=false);await p.locator('[data-guidance-refresh]').click();await p.locator('.n88-task-guidance[aria-busy=false]').waitFor();assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة محفوظة');
 await p.locator('.n88-class-roster').waitFor();
 for(const command of ['rotate','revoke']){await p.locator('.n88-student-more summary').click();const before=await p.evaluate(()=>review.calls().filter(x=>['rotate','revoke'].includes(x)).length);await p.locator('[data-action="review-'+command+'"]').click();await p.locator('[data-confirm]').waitFor();assert.equal(await p.evaluate(()=>review.calls().filter(x=>['rotate','revoke'].includes(x)).length),before);await p.locator('[data-action=cancel]').click();}
 await p.locator('.n88-student-more summary').click();await p.locator('[data-action=review-rotate]').click();await p.locator('[data-action=confirm]').click();await p.waitForFunction(()=>review.calls().filter(x=>x==='rotate').length===1);assert.equal(await p.evaluate(()=>review.calls().filter(x=>x==='revoke').length),0);
 report.checks.push({name:'guidance-pending-error-return-draft-and-admitted-review-no-write-'+width,status:'PASS'});
 }finally{await c.close();}}
 if(process.argv.includes('--additional')){
 {const {c,p}=await fresh(390);try{
 await p.goto(origin+'/teacher');await p.locator('.n88-class-roster').waitFor();await p.evaluate(()=>review.hold('guidance-list'));await p.locator('.n88-task-guidance summary').click();await p.waitForFunction(()=>review.calls().includes('guidance-list'));
 await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));review.unhold();});
 await p.locator('.n88-class-roster').waitFor({timeout:12000});await p.locator('[data-guidance]').waitFor();const before=await p.evaluate(()=>review.calls());await p.evaluate(()=>review.release());await p.waitForTimeout(80);assert.deepEqual(await p.evaluate(()=>review.calls()),before);
 assert.equal(before.filter(x=>x==='list').length,2);assert.equal(before.filter(x=>x==='guidance-list').length,2);
 await p.locator('.n88-student-more summary').click();await p.locator('[data-action=review-revoke]').click();await p.locator('[data-confirm]').waitFor();await p.evaluate(()=>review.owner());await p.waitForFunction(()=>!document.querySelector('[data-confirm]'));assert.equal(await p.evaluate(()=>review.calls().filter(x=>['rotate','revoke'].includes(x)).length),0);
 report.checks.push({name:'actual-runtime-queue-timeout-return-no-late-dispatch-and-owner-fenced-confirm',status:'PASS'});
 }finally{await c.close();}}
 for(const retire of ['pagehide','dispose','context']){const {c,p}=await fresh(390);try{
 await p.goto(origin+'/source');await p.locator('[data-claim]').waitFor();await p.evaluate(async()=>{handle.dispose();const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');let owner=1;window.wrongOwner=()=>owner++;window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{readiness:{enabled:true},client:{captureContext:()=>owner,isContextCurrent:c=>c===owner,read:()=>new Promise(ok=>window.lateRead=()=>ok({version:'n88-student-v3',profile:{name:'LATE_PRIVATE'}}))}});});
 await p.evaluate(retire=>{if(retire==='pagehide')dispatchEvent(new PageTransitionEvent('pagehide'));else if(retire==='dispose')handle.dispose();else wrongOwner();lateRead();},retire);await p.waitForTimeout(80);assert(!(await text(p)).includes('LATE_PRIVATE'));report.checks.push({name:'fresh-read-late-'+retire+'-privacy-fence',status:'PASS'});
 }finally{await c.close();}}
 }
 if(process.argv.includes('--cooldown')){const {c,p}=await fresh(390);try{
 await p.goto(origin+'/source');await p.locator('[data-claim]').waitFor();await p.evaluate(async()=>{handle.dispose();const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');const {createUnifiedStudentPortalClient}=await import('/src/lib/student-portal-unified-client.js');window.rateCalls=0;window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{readiness:{enabled:true},client:createUnifiedStudentPortalClient({fetch:async()=>{rateCalls++;return new Response('{}',{status:429,headers:{'Retry-After':'1'}});}})});});await p.locator('[data-session-retry]:disabled').waitFor();await p.screenshot({path:dir+'read-cooldown-390.png'});await p.locator('[data-session-retry]:enabled').waitFor();assert.equal(await p.evaluate(()=>rateCalls),1);
 await p.evaluate(async()=>{handle.dispose();Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');window.bootReads=0;window.handle=mountUnifiedStudentPortal(document.querySelector('main'),{readiness:{enabled:true},client:{read:async()=>{bootReads++;return {version:'n88-student-v3'};}}});});assert.equal(await p.evaluate(()=>bootReads),0);await hidden(p,'visible');await privateVisible(p);await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));assert.equal(await p.evaluate(()=>bootReads),1);report.checks.push({name:'rate-retry-disabled-until-finite-cooldown-and-hidden-initial-boot-once',status:'PASS'});
 }finally{await c.close();}}
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.failure=e.message;throw e;}finally{
 mode='';for(const ok of releases.splice(0))ok();if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok));}if(leased)report.release=lease('release');await fs.writeFile(dir+(process.argv.includes('--cooldown')?'ui-cooldown.json':process.argv.includes('--additional')?'ui-additional.json':process.argv.includes('--teacher')?'ui-teacher.json':process.argv.includes('--student')?'ui-student.json':'ui.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({status:report.status,checks:report.checks.length}));

