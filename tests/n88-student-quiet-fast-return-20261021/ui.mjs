/** AI: actual app and packaged student DOM/CSS/transport; only synthetic responses. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const dir='tests/n88-student-quiet-fast-return-20261021/';
const root='C:/Users/Abody/Projects/RakeezX',task='continuous-n88-student-quiet-fast-return-20261021',run='6f338b83-ed40-4a6a-a30e-2d3c8c4a0a0f';
const baseline=process.argv.includes('--baseline');
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true}).trim();
// Both entries use the real client. The packaged entry captures its real fetch.
const fixture=`window.calls=[];window.queue=[];window.good={version:'n88-student-v3',profile:{name:'SYNTHETIC_PRIVATE'},extra:'NEVER_PROJECT'};
window.send=(url,init)=>{calls.push({url,method:init.method,signal:init.signal,at:performance.now(),credentials:init.credentials,cache:init.cache});return new Promise(resolve=>queue.push({resolve}));};
window.respond=(i,status=200,body=good)=>queue[i].resolve(new Response(JSON.stringify(body),{status}));
window.visibility=v=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:v});document.dispatchEvent(new Event('visibilitychange'));};
window.fetch=send;
window.forbidden=false;window.flashes=[];
const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){if(this.id==='student-portal'&&window.mountMark===undefined)window.mountMark=performance.now();html.set.call(this,value);}});
new MutationObserver(()=>{if(forbidden&&(document.querySelector('[data-claim],[data-end]')||document.body.textContent.includes('SYNTHETIC_PRIVATE')))flashes.push(document.body.textContent);}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
window.mark=performance.now();`;
const boot=`import{mountUnifiedStudentPortal}from'/src/views/student-portal-login.js';import{createUnifiedStudentPortalClient}from'/src/lib/student-portal-unified-client.js';
window.client=createUnifiedStudentPortalClient({fetch:send});window.handle=mountUnifiedStudentPortal(document.querySelector('#student-portal'),{client,readiness:{enabled:true}});`;
const report={status:'FAIL',taskId:task,runId:run,baseline,checks:[],timings:[],errors:[],limits:'Synthetic loopback actual application only; no live account, private service request, browser profile or provider operation.'};
let server,browser,leased=false;
try{
 report.lease=lease('acquire');leased=true;
 server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  const send=(body,type)=>{res.setHeader('Content-Type',type);res.end(body);};
  if(['/source','/private'].includes(u.pathname))return send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><div id="student-portal"></div><script src="/fixture.js"></script><script type="module" src="${u.pathname==='/source'?'/boot.mjs':'/n88-private/assets/student.mjs'}"></script></html>`,'text/html; charset=utf-8');
  if(u.pathname==='/fixture.js')return send(fixture,'text/javascript');
  if(u.pathname==='/boot.mjs')return send(boot,'text/javascript');
  let name=u.pathname.startsWith('/n88-private/')?'/drafts/n88-student-portal/activation/bundle/private/'+u.pathname.slice('/n88-private/'.length):u.pathname;
  const file=path.resolve('.'+name);assert(file.startsWith(process.cwd()+path.sep));
  send(await fs.readFile(file),({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 browser=await createRequire(root+'/package.json')('playwright').chromium.launch({headless:true});
 for(const entry of baseline?['source']:['source','private'])for(const width of [390,1280]){
  const c=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',serviceWorkers:'block'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  const p=await c.newPage();await p.clock.install();p.setDefaultTimeout(5000);p.on('pageerror',e=>report.errors.push(e.message));
  const tag=entry+'-'+width;
  const neutral=async()=>{assert.equal(await p.locator('[data-claim],[data-end]').count(),0);assert(!(await p.locator('body').innerText()).includes('SYNTHETIC_PRIVATE'));};
  const hidden=v=>p.evaluate(v=>visibility(v),v);
  const count=()=>p.evaluate(()=>calls.length);
  const fresh=async()=>{await p.goto(origin+'/'+entry);await p.waitForFunction(()=>calls.length===1);await neutral();};
  const valid=async i=>{await p.evaluate(i=>{forbidden=false;respond(i);},i);await p.locator('[data-end]').waitFor();};
  const fits=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  try{
   // Controlled service delay, independent of event-to-dispatch scheduling.
   await fresh();const opening=await p.evaluate(()=>calls[0].at-mountMark);assert(opening<150,'No queued initial request after pending paint');
   const delay=width===1280?6000:600;
   const measured=await p.evaluate(async delay=>{const start=performance.now();await new Promise(ok=>setTimeout(ok,delay));respond(0);return performance.now()-start;},delay);
   await p.locator('[data-end]').waitFor();assert(!(await p.locator('body').innerText()).includes('NEVER_PROJECT'));
   await p.evaluate(()=>{forbidden=true;visibility('hidden');});await neutral();await hidden('hidden');
   await p.evaluate(()=>{mark=performance.now();visibility('visible');document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new PageTransitionEvent('pageshow'));});
   assert.equal(await count(),2);await neutral();
   const scheduling=await p.evaluate(()=>calls[1].at-mark);assert(scheduling<150,'No queued return request');
   await p.waitForTimeout(120);assert.equal(await count(),2);await neutral();
   if(!baseline){
    await p.getByRole('heading',{name:'مساحة الطالب',exact:true}).waitFor();
    assert.equal(await p.getByRole('progressbar',{name:'جارٍ تجهيز مساحة الطالب'}).count(),1);
    assert.equal(await p.getByRole('progressbar').getAttribute('aria-valuenow'),null);
    assert.equal(await p.locator('[role=status][aria-live=polite]').first().innerText(),'لحظات ونجهّز مساحتك…');
    const normal=await p.locator('main > section').innerText();assert(!/الخادم|الجلسة|لم تُحسم/.test(normal));
    assert.equal(await p.locator('.n88-student-support').getAttribute('open'),null);
    await fits();await p.screenshot({path:dir+'pending-'+tag+'.png'});
    await p.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await p.locator('.n88-unified-progress').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
   }
   await valid(1);assert.deepEqual(await p.evaluate(()=>flashes),[]);
   report.timings.push({entry,width,controlledDelayMs:delay,observedDelayMs:Math.round(measured),initialDispatchMs:Math.round(opening*10)/10,returnDispatchMs:Math.round(scheduling*10)/10,dispatches:await count()});
   report.checks.push(tag+': ordinary-hide-show-duplicates-single-current-get-and-separated-delay');
   // Hide during the first GET. An abort-ignoring late reply cannot render.
   await fresh();await p.evaluate(()=>{forbidden=true;visibility('hidden');});await neutral();
   await p.evaluate(()=>{respond(0);});await p.waitForTimeout(20);await neutral();
   await hidden('visible');await p.waitForFunction(()=>calls.length===2);await neutral();
   await hidden('visible');await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));assert.equal(await count(),2);
   assert(await p.evaluate(()=>calls[0].signal.aborted));await valid(1);assert.deepEqual(await p.evaluate(()=>flashes),[]);
   report.checks.push(tag+': hidden-first-get-late-response-retired');
   for(const status of [401,403,410,503,'timeout']){
    await fresh();await p.evaluate(()=>forbidden=true);
    if(status==='timeout'){await p.clock.fastForward(15001);}
    else await p.evaluate(status=>{if([401,403,410].includes(status))forbidden=false;respond(0,status);},status);
    if([401,403,410].includes(status))await p.locator('[data-claim]').waitFor();
    else{await p.locator('[data-session-retry]').waitFor();await neutral();assert(!(await p.locator('body').innerText()).includes('انتهت الجلسة.'));}
    assert.equal(await count(),1);
    if(status==='timeout'){await p.evaluate(()=>respond(0));await p.waitForTimeout(20);await neutral();await p.clock.resume();}
    if(status===503&&!baseline){await fits();await p.screenshot({path:dir+'recovery-'+tag+'.png'});}
    assert.deepEqual(await p.evaluate(()=>flashes),[]);
   }
   report.checks.push(tag+': no-cookie-denied-expired-revoked-entry-503-timeout-late-recovery');
   for(const status of [401,503,'timeout']){
    await fresh();await valid(0);await p.evaluate(()=>{forbidden=true;visibility('hidden');visibility('visible');});await neutral();
    assert.equal(await count(),2);
    if(status==='timeout'){await p.clock.fastForward(15001);}
    else await p.evaluate(status=>{if(status===401)forbidden=false;respond(1,status);},status);
    if(status===401)await p.locator('[data-claim]').waitFor();else{await p.locator('[data-session-retry]').waitFor();await neutral();}
    if(status==='timeout'){await p.evaluate(()=>respond(1));await p.waitForTimeout(20);await neutral();await p.clock.resume();}
    assert.equal(await count(),2);assert.deepEqual(await p.evaluate(()=>flashes),[]);
   }
   report.checks.push(tag+': return-denial-unavailable-timeout-never-false-signout-or-private');
   for(const outcome of ['ack','unavailable','pagehide']){
    await fresh();await valid(0);await p.evaluate(()=>forbidden=true);await p.locator('[data-end]').click();await neutral();
    await hidden('hidden');await hidden('hidden');assert.equal(await count(),2);
    assert.equal(await p.evaluate(()=>calls[1].method),'POST');
    if(outcome==='pagehide')await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));respond(1);});
    else await p.evaluate(outcome=>respond(1,outcome==='ack'?200:503),outcome);
    await p.waitForTimeout(30);await p.evaluate(outcome=>{if(outcome==='ack')forbidden=false;visibility('visible');dispatchEvent(new PageTransitionEvent('pageshow'));},outcome);
    if(outcome==='ack'){await p.locator('[data-claim]').waitFor();assert((await p.locator('body').innerText()).includes('انتهت الجلسة.'));}
    else{await p.locator('[data-session-retry]').waitFor();await neutral();assert((await p.locator('body').innerText()).includes('تعذّر تأكيد إنهاء الجلسة'));}
    assert.equal(await count(),2);assert.deepEqual(await p.evaluate(()=>flashes),[]);
   }
   report.checks.push(tag+': end-hidden-ack-uncertain-pagehide-no-read-or-post-replay');
   assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
   assert(await p.evaluate(()=>calls.filter(c=>c.method==='GET').every(c=>c.url==='/api/n88/student/read'&&c.credentials==='same-origin'&&c.cache==='no-store')));
  }finally{await c.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{
 if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok));}if(leased)report.release=lease('release');
 await fs.writeFile(dir+(baseline?'baseline.json':'ui.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
