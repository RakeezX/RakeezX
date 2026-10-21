/** AI: actual student DOM, handlers, CSS and transport; fabricated payloads only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const dir='tests/n88-student-pending-return-finite-diagnostic-20261021/';
const root='C:/Users/Abody/Projects/RakeezX', task='continuous-n88-student-pending-return-finite-diagnostic-20261021',run='42e76d1c-cba3-404f-b7a3-0fad1b6e919d';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true}).trim();
const boot=`import{mountUnifiedStudentPortal}from'/src/views/student-portal-login.js';import{createUnifiedStudentPortalClient}from'/src/lib/student-portal-unified-client.js';
window.calls=[];window.queue=[];window.copies=[];window.copyFail=false;
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.holdCopy)await new Promise(ok=>window.finishCopy=ok);if(copyFail)throw Error('fabricated provider exception');copies.push(text);}}});
window.good={version:'n88-student-v3',profile:{name:'SYNTHETIC_PRIVATE'},ignored:'NEVER_PROJECT'};
window.respond=(i,status=200,body=good)=>queue[i].resolve(new Response(JSON.stringify(body),{status,headers:{'Retry-After':'1'}}));
window.start=(timeoutMs=15000)=>{window.handle?.dispose();calls=[];queue=[];window.client=createUnifiedStudentPortalClient({timeoutMs,fetch:(url,init)=>{calls.push({action:url.split('/').at(-1),method:init.method,signal:init.signal});return new Promise(resolve=>queue.push({resolve}));}});window.handle=mountUnifiedStudentPortal(document.querySelector('#student-portal'),{client,readiness:{enabled:true}});};start();`;
let server,browser,leased=false;
const report={status:'FAIL',checks:[],errors:[]};
try{
 report.lease=lease('acquire');leased=true;
 server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 const send=(body,type)=>{res.setHeader('Content-Type',type);res.end(body);};
 if(u.pathname==='/source')return send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><div id="student-portal"></div><script type="module" src="/boot.mjs"></script></html>','text/html; charset=utf-8');
 if(u.pathname==='/boot.mjs')return send(boot,'text/javascript');
 const file=path.resolve('.'+u.pathname);if(!file.startsWith(process.cwd()+path.sep))throw Error('outside');
 send(await fs.readFile(file),({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 browser=await createRequire(root+'/package.json')('playwright').chromium.launch({headless:true});
 const hidden=(p,v)=>p.evaluate(v=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:v});document.dispatchEvent(new Event('visibilitychange'));},v);
 const neutral=async p=>{assert.equal(await p.locator('[data-claim]').count(),0,'Unconfirmed GET must not paint code form');assert.equal(await p.locator('[data-end]').count(),0);assert(!(await p.locator('body').innerText()).includes('SYNTHETIC_PRIVATE'));};
 const count=(p,action)=>p.evaluate(action=>calls.filter(c=>c.action===action).length,action);
 const fits=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
 for(const width of [390,1280]){
 const c=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',serviceWorkers:'block'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
 const p=await c.newPage();await p.clock.install();p.setDefaultTimeout(5000);p.on('pageerror',e=>report.errors.push(e.message));
 try{
 await p.goto(origin+'/source');await p.waitForFunction(()=>calls.length===1);await neutral(p);
 await hidden(p,'hidden');await neutral(p);
 await hidden(p,'visible');await p.waitForFunction(()=>calls.length===2);await neutral(p);
 assert(await p.evaluate(()=>calls[0].signal.aborted));
 await p.evaluate(()=>respond(0));await neutral(p);
 await p.evaluate(()=>respond(1));await p.locator('[data-end]').waitFor();
 assert(!(await p.locator('body').innerText()).includes('NEVER_PROJECT'));
 report.checks.push('held-initial-hidden-return-current-only-'+width);
 // A prior projection is also retired on hide. Duplicate lifecycle notifications
 // cannot renew the request budget or adopt an old projection.
 await hidden(p,'hidden');await neutral(p);await hidden(p,'hidden');
 await hidden(p,'visible');await p.waitForFunction(()=>calls.length===3);await neutral(p);
 await hidden(p,'visible');await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
 assert.equal(await count(p,'read'),3);await p.evaluate(()=>respond(2));await p.locator('[data-end]').waitFor();
 await p.locator('[data-read]').click();await neutral(p);assert.equal(await count(p,'read'),4);
 await p.evaluate(()=>respond(3,503));await p.locator('[data-session-retry]').waitFor();await neutral(p);
 await p.screenshot({path:dir+'retry-'+width+'.png'});await fits(p);
 report.checks.push('projection-return-manual-refresh-single-read-'+width);

 for(const status of [200,401,403,410,429,503,'malformed','timeout']){
 await p.evaluate(status=>start(status==='timeout'?100:15000),status);await neutral(p);
 if(status!=='timeout')await p.evaluate(status=>respond(0,status==='malformed'?200:status,status==='malformed'?{version:'invalid',profile:{name:'SYNTHETIC_PRIVATE'}}:good),status);
 if(status===200){await p.locator('[data-end]').waitFor();await fits(p);}
 else if([401,403,410].includes(status))await p.locator('[data-claim]').waitFor();
 else {await p.locator('[data-session-retry]').waitFor();await neutral(p);if(status===429){assert(await p.locator('[data-session-retry]').isDisabled());await p.locator('[data-session-retry]:enabled').waitFor();}}
 assert.equal(await count(p,'read'),1);assert.equal(await count(p,'claim'),0);
 const d=await p.evaluate(()=>client.getDiagnostic());
 assert.equal(d.phase,'initial');assert.equal(d.outcome,status===200?'success':[401,403,410].includes(status)?'denied':status===429?'rate':status==='timeout'?'timeout':'unavailable');
 if(status==='timeout'){await p.evaluate(()=>respond(0));await p.waitForTimeout(30);await neutral(p);}
 }
 report.checks.push('initial-200-denied-rate-503-malformed-timeout-late-'+width);

 for(const status of [200,401,503,'timeout']){
 await p.evaluate(()=>start());await hidden(p,'hidden');await hidden(p,'visible');await p.waitForFunction(()=>calls.length===2);await neutral(p);
 if(status==='timeout'){
 // Use the actual client deadline under a controllable browser clock.
 await p.clock.fastForward(15001);
 }else await p.evaluate(status=>respond(1,status),status);
 if(status===200)await p.locator('[data-end]').waitFor();
 else if(status===401)await p.locator('[data-claim]').waitFor();
 else {await p.locator('[data-session-retry]').waitFor();await neutral(p);}
 await p.evaluate(()=>respond(0));await p.waitForTimeout(20);
 assert.equal(await count(p,'read'),2);assert.equal(await count(p,'claim'),0);
 assert.equal((await p.evaluate(()=>client.getDiagnostic())).phase,'return');
 if(status==='timeout'){await p.evaluate(()=>respond(1));await p.waitForTimeout(20);await neutral(p);await p.clock.resume();}
 }
 report.checks.push('return-200-denied-503-view-deadline-late-'+width);

 // Real claim handler clears its input, never automatically replays POST,
 // and transitions to a current authoritative GET before showing a projection.
 await p.evaluate(()=>start());await p.evaluate(()=>respond(0,401));await p.locator('[data-claim]').waitFor();
 await p.locator('input').fill('123456');await p.locator('[type=submit]').click();
 assert.equal(await p.locator('input').inputValue(),'');assert.equal(await count(p,'claim'),1);
 await p.evaluate(()=>respond(1));await p.waitForFunction(()=>calls.length===3);
 await hidden(p,'hidden');await hidden(p,'visible');await p.evaluate(()=>respond(2));await p.locator('[data-end]').waitFor();
 assert.equal(await count(p,'claim'),1);assert.equal(await count(p,'read'),2);
 report.checks.push('claim-no-replay-private-input-cleared-current-read-'+width);
 for(const state of ['accepted','uncertain']){
 await p.evaluate(()=>start());await p.evaluate(()=>respond(0,401));await p.locator('[data-claim]').waitFor();
 await p.locator('input').fill('123456');await p.locator('[type=submit]').click();
 await p.evaluate(status=>respond(1,status),state==='accepted'?200:503);
 if(state==='accepted'){await p.waitForFunction(()=>calls.length===3);await p.evaluate(()=>respond(2,503));}
 await p.locator('[data-session-retry]').waitFor();await neutral(p);
 assert((await p.locator('body').innerText()).includes(state==='accepted'?'قُبل الرمز':'تعذّر تأكيد الدخول'));
 const before=await p.evaluate(()=>calls.length);await p.locator('[data-session-retry]').click();
 await p.evaluate(i=>respond(i),before);await p.locator('[data-end]').waitFor();assert.equal(await count(p,'claim'),1);
 }
 report.checks.push('accepted-uncertain-claim-recovery-is-get-only-'+width);

 for(const scenario of ['ack','503','timeout','hidden-ack','hidden-503','hidden-rate','hidden-timeout','pagehide']){
 await p.evaluate(()=>start());await p.evaluate(()=>respond(0));await p.locator('[data-end]').waitFor();
 await p.locator('[data-end]').click();await neutral(p);await p.getByRole('heading',{name:'جارٍ إنهاء الجلسة…',exact:true}).waitFor();
 assert.equal(await count(p,'end'),1);
 if(scenario.startsWith('hidden')){await hidden(p,'hidden');await neutral(p);await hidden(p,'hidden');}
 if(scenario==='pagehide'){
 await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));await neutral(p);
 assert(await p.evaluate(()=>calls[1].signal.aborted));
 await p.evaluate(()=>respond(1));await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
 await p.locator('[data-session-retry]').waitFor();assert(!(await p.locator('body').innerText()).includes('انتهت الجلسة.'));
 assert.equal(await count(p,'read'),1); // No silent read or POST replay after uncertain retirement.
 }else{
 if(scenario.includes('timeout')){await p.clock.fastForward(15001);}
 else await p.evaluate(status=>respond(1,status),scenario.includes('503')?503:scenario.includes('rate')?429:200);
 // Allow the actual promises to settle while hidden; private DOM stays retired.
 await p.waitForTimeout(20);
 if(scenario.startsWith('hidden'))await hidden(p,'visible');
 if(scenario.endsWith('ack')){await p.locator('[data-claim]').waitFor();assert((await p.locator('body').innerText()).includes('انتهت الجلسة.'));}
 else {await p.locator('[data-session-retry]').waitFor();await neutral(p);assert((await p.locator('body').innerText()).includes('تعذّر تأكيد إنهاء الجلسة'));}
 if(scenario.includes('timeout')){await p.evaluate(()=>respond(1));await p.waitForTimeout(20);await neutral(p);await p.clock.resume();}
 if(scenario.includes('rate')){await p.locator('[data-session-retry]:enabled').waitFor();await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});await neutral(p);assert.equal(await count(p,'read'),1);assert((await p.locator('body').innerText()).includes('تعذّر تأكيد إنهاء الجلسة'));}
 }
 assert.equal(await count(p,'end'),1);await fits(p);
 if(scenario==='hidden-ack')await p.screenshot({path:dir+'end-ack-'+width+'.png'});
 if(scenario==='pagehide'){
 await p.screenshot({path:dir+'end-uncertain-'+width+'.png'});
 await p.locator('[data-session-retry]').click();await neutral(p);assert.equal(await count(p,'read'),2);
 await p.evaluate(()=>respond(2,401));await p.locator('[data-claim]').waitFor();assert.equal(await count(p,'end'),1);
 }
 }
 report.checks.push('end-ack-unavailable-hidden-deadline-pagehide-late-no-replay-'+width);

 for(const retire of ['pagehide','dispose','context']){
 await p.evaluate(()=>start());await p.evaluate(retire=>{if(retire==='pagehide')dispatchEvent(new PageTransitionEvent('pagehide'));else if(retire==='dispose')handle.dispose();else client.invalidate();respond(0);},retire);
 await p.waitForTimeout(30);assert.equal(await p.locator('[data-end]').count(),0);assert(!(await p.locator('body').innerText()).includes('SYNTHETIC_PRIVATE'));
 }
 report.checks.push('pagehide-dispose-context-late-private-fences-'+width);

 await p.evaluate(()=>start());await p.evaluate(()=>respond(0,503));await p.locator('[data-session-retry]').waitFor();
 const before=await p.evaluate(()=>calls.length);assert.equal(await p.evaluate(()=>copies.length),0);
 await p.locator('.n88-student-support summary').click();await p.locator('[data-copy-diagnostic]').click();
 await p.waitForFunction(()=>copies.length===1);
 const copied=await p.evaluate(()=>copies[0]),d=JSON.parse(copied);
 assert.deepEqual(Object.keys(d).sort(),['action','phase','outcome','httpStatusClass','elapsedMs','visibility','retirementReason'].sort());
 assert.equal(d.outcome,'unavailable');assert.equal(d.httpStatusClass,'5xx');assert.equal(d.elapsedMs%250,0);assert(d.elapsedMs>=0&&d.elapsedMs<=15000);
 assert(!/SYNTHETIC|123456|provider|http:|token|cookie|session_id|name|body|header/i.test(copied));
 await p.evaluate(()=>copyFail=true);await p.locator('[data-copy-diagnostic]').click();await p.locator('[data-copy-text]:visible').waitFor();
 assert.equal(await p.locator('[data-copy-text]').inputValue(),copied);
 assert(!(await p.locator('body').innerText()).includes('fabricated provider exception'));
 assert.equal(await p.evaluate(()=>calls.length),before);await fits(p);await p.screenshot({path:dir+'diagnostic-'+width+'.png'});
 await hidden(p,'hidden');assert.equal(await p.locator('[data-copy-text]').inputValue(),'');
 await hidden(p,'visible');assert.equal(await p.evaluate(()=>calls.length),before);await p.evaluate(()=>copyFail=false);
 assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
 await p.evaluate(()=>{copyFail=false;window.holdCopy=true;});await p.locator('[data-copy-diagnostic]').click();
 await p.waitForFunction(()=>typeof finishCopy==='function');await hidden(p,'hidden');await p.evaluate(()=>{finishCopy();window.holdCopy=false;});
 await hidden(p,'visible');await p.locator('[data-copy-diagnostic]:enabled').waitFor();
 assert.equal(await p.locator('[data-copy-text]').inputValue(),'');assert.equal(await p.evaluate(()=>calls.length),before);
 report.checks.push('optional-allowlist-clipboard-fallback-no-extra-request-storage-'+width);
 await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});start();});
 assert.equal(await p.evaluate(()=>calls.length),0);await hidden(p,'visible');await p.waitForFunction(()=>calls.length===1);await neutral(p);
 await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));assert.equal(await count(p,'read'),1);
 await p.screenshot({path:dir+'pending-'+width+'.png'});await fits(p);
 report.checks.push('hidden-bootstrap-one-return-read-'+width);
 }finally{await c.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.failure=e.message;process.exitCode=1;}finally{
 if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok));}if(leased)report.release=lease('release');
 await fs.writeFile(dir+(process.argv.includes('--red')?'test-first-failure.json':'ui.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
