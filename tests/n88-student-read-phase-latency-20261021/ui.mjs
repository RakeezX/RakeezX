/** AI: actual app source/compiled DOM, handlers and CSS on owned loopback HTTP. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const dir='tests/n88-student-read-phase-latency-20261021/',root='C:/Users/Abody/Projects/RakeezX',task='continuous-n88-student-read-phase-latency-20261021',run='2c1fb6b8-d4ce-428a-8539-65e83d5a6a86';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','-OwnerToken',run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true}).trim();
const phases={pool:250,boundary:500,snapshot:750,sync:250,canonical:1000,visibility:0,guidance:250,projection:0,commit:250,total:3500};
const fixture=`window.calls=[];window.queue=[];window.copies=[];window.good={version:'n88-student-v3',profile:{name:'SYNTHETIC_PRIVATE'}};window.phases=${JSON.stringify(phases)};
window.fetch=(url,init)=>{calls.push({url,method:init.method});return new Promise(resolve=>queue.push(resolve));};
window.respond=(i,status=200,p=phases)=>queue[i](Response.json(status===200?good:{error:'unavailable'},{status,headers:{'x-n88-student-read-phases':JSON.stringify(p)}}));
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copies.push(text)}});
window.visibility=v=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:v});document.dispatchEvent(new Event('visibilitychange'));};`;
const boot=`import{mountUnifiedStudentPortal}from'/src/views/student-portal-login.js';import{createUnifiedStudentPortalClient}from'/src/lib/student-portal-unified-client.js';window.client=createUnifiedStudentPortalClient();window.handle=mountUnifiedStudentPortal(document.querySelector('#student-portal'),{client,readiness:{enabled:true}});`;
let server,browser,leased=false;const report={taskId:task,runId:run,status:'FAIL',checks:[],cleanup:{}};
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1'),send=(text,type)=>{res.setHeader('Content-Type',type);res.end(text);};res.setHeader('Cache-Control','no-store');
  if(['/source','/private'].includes(u.pathname))return send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><div id="student-portal"></div><script src="/fixture.js"></script><script type="module" src="${u.pathname==='/source'?'/boot.mjs':'/n88-private/assets/student.mjs'}"></script></html>`,'text/html; charset=utf-8');
  if(u.pathname==='/fixture.js')return send(fixture,'text/javascript');if(u.pathname==='/boot.mjs')return send(boot,'text/javascript');
  const file=u.pathname.startsWith('/n88-private/')?path.resolve('drafts/n88-student-portal/activation/bundle/private/'+u.pathname.slice('/n88-private/'.length)):path.resolve('.'+u.pathname);
  assert(file.startsWith(process.cwd()+path.sep));const ext=path.extname(file);send(await fs.readFile(file),({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');
 }catch{res.statusCode=404;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 browser=await createRequire(root+'/package.json')('playwright').chromium.launch({headless:true});
 for(const entry of ['source','private'])for(const width of [390,1280]){
  const c=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  try{const p=await c.newPage();p.setDefaultTimeout(5000);await p.goto(origin+'/'+entry);await p.waitForFunction(()=>calls.length===1);
   assert.equal(await p.locator('[data-end]').count(),0);await p.locator('summary').click();await p.locator('[data-copy-diagnostic]').click();assert.equal(await p.evaluate(()=>copies.length),0);
   await p.evaluate(()=>respond(0));await p.locator('[data-end]').waitFor();await p.locator('summary').click();await p.locator('[data-copy-diagnostic]').click();
   const copied=JSON.parse(await p.evaluate(()=>copies.at(-1)));assert.deepEqual(copied.readPhases,phases);assert.equal(Object.keys(copied).length,8);assert(!JSON.stringify(copied).includes('SYNTHETIC_PRIVATE'));
   await p.evaluate(()=>visibility('hidden'));assert(!(await p.locator('body').innerText()).includes('SYNTHETIC_PRIVATE'));await p.evaluate(()=>visibility('visible'));await p.waitForFunction(()=>calls.length===2);
   await p.locator('summary').click();await p.locator('[data-copy-diagnostic]').click();assert.equal(await p.evaluate(()=>copies.length),1);
   await p.evaluate(()=>respond(1,401));await p.locator('[data-claim]').waitFor();await p.locator('summary').click();await p.locator('[data-copy-diagnostic]').click();
   assert.equal(JSON.parse(await p.evaluate(()=>copies.at(-1))).readPhases,undefined);assert.equal(await p.evaluate(()=>calls.length),2);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:dir+'diagnostic-'+entry+'-'+width+'.png'});
   report.checks.push(entry+'-'+width+': actual copy parity, no automatic transmission, no pending/denied/stale phase copy, one return GET, no private DOM on hide, layout fits');
  }finally{await c.close();}
 }
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message.slice(0,300)};process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));report.cleanup.ownedBrowserAndServerClosed=true;if(leased)report.cleanup.browserLease=lease('release');await fs.writeFile(dir+'ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
