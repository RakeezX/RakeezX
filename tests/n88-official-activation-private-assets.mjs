/** AI-authored: actual inert private document, source CSS and packaged asset URLs. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const canonical='C:/Users/Abody/Projects/RakeezX';
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='bb64e011-c3c1-417b-9e99-af05ee0f8f09';
const baseSha='5046e82968cb0055db7a99aea41d65dcb71b2a60',dir='drafts/n88-student-portal/activation/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const report={aiAuthored:true,taskId,runId,baseSha,at:new Date().toISOString(),checks:[],cleanup:{},hostedProof:false};
let server,browser,owned=false;
try{
 const m=await json(dir+'manifest.json'),d=await json(dir+'deploy.staged.json');
 for(const [file,h]of Object.entries(m.sources))assert.equal(sha((await readFile(file,'utf8')).replaceAll('\r\n','\n')),h,file);
 for(const [file,h]of Object.entries(m.binarySources))assert.equal(sha(await readFile(file)),h,file);
 for(const [file,h]of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+'bundle/'+file)),h,file);
 const prior=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));
 for(const file of Object.keys(prior.outputs).filter(p=>p.startsWith('edge/')||p.startsWith('cloudflare/')))assert.equal(m.outputs[file],prior.outputs[file],file);
 assert.equal(d.migrations.length,6);assert.equal(d.enabled,false);assert.equal(d.function.enabled,false);assert.equal(d.privateDocument.enabled,false);assert.equal(d.privateDocument.browserReadiness,false);assert.deepEqual(d.cloudflare.routes,[]);
 assert.deepEqual(m.gates,{edgeEnabled:false,cloudflareEnabled:false,browserReadiness:false,routes:[],cron:[]});
 report.checks.push({name:'current_graph_and_unchanged_service',status:'PASS',evidence:'All LF source hashes, exact-byte brand/output hashes match; Edge/Cloudflare output bytes unchanged from base; six migrations retained; all live gates OFF.'});
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 const allowed=new Set(d.privateDocument.assetAllowlist);
 server=createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');let file;
   if(req.method!=='GET'||u.search){res.writeHead(404).end();return;}
   if(u.pathname==='/student')file='student.html';
   else if(u.pathname.startsWith('/n88-private/')&&allowed.has(u.pathname.slice(13)))file=u.pathname.slice(13);
   else {res.writeHead(404).end();return;}
   for(const [key,value]of Object.entries(d.privateDocument.headers))res.setHeader(key,value);
   res.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]);
   res.end(await readFile(dir+'bundle/private/'+file));
  }catch{res.writeHead(500).end();}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const origin='http://127.0.0.1:'+server.address().port;
 const {chromium}=createRequire(canonical+'/package.json')('playwright');
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',locale:'ar-SA',colorScheme:theme});
  try{
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
   const page=await context.newPage(),errors=[],bad=[];
   page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(new URL(r.url()).pathname);});
   const response=await page.goto(origin+'/student');assert.equal(response.status(),200);
   await page.getByRole('heading',{name:'دخول الطالب'}).waitFor();
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const logo=page.locator('.brand-lockup__image--'+theme);
   await logo.evaluate(e=>e.decode());assert.equal(await logo.isVisible(),true);
   assert.equal(await logo.evaluate(e=>e.naturalWidth>0),true);
   assert.equal(await page.locator('input').isDisabled(),true);
   assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
   assert.match(await page.locator('[role=status]').textContent(),/لم تُفعّل الخدمة/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#student-portal').evaluate(e=>getComputedStyle(e).direction),'rtl');
   const css=await page.locator('link[rel=stylesheet]').evaluateAll(es=>es.map(e=>({url:new URL(e.href).pathname,loaded:!!e.sheet})));
   assert.ok(css.every(e=>e.loaded&&e.url.startsWith('/n88-private/styles/')));
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   await page.getByRole('heading',{name:'دخول الطالب'}).waitFor();
   assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
   if(width===390){await mkdir('tests/fixtures/n88-official-activation',{recursive:true});await page.screenshot({path:`tests/fixtures/n88-official-activation/private-${theme}.png`,fullPage:true});}
   report.checks.push({name:`actual_private_document_${width}_${theme}`,status:'PASS',evidence:'Fresh shared-lease Chromium context, loopback HTTP, actual compiled student entry/DOM/brand/CSS; both logos decode, dynamic stylesheet loaded, no failed assets/JS errors/overflow, live entry disabled; actual pagehide handler resets entry. No credentials or fixture identities.'});
  }finally{await context.close();}
 }
}catch(e){report.failure=e.message;process.exitCode=1;}
finally{
 if(browser){await browser.close();report.cleanup.browserClosed=true;}
 if(server){await new Promise(ok=>{server.close(ok);server.closeAllConnections();});report.cleanup.serverClosed=true;}
 if(owned)report.cleanup.browserLease=lease('release');
 await writeFile('tests/n88-official-activation-private-assets.json',JSON.stringify(report,null,2)+'\n');
}
console.log(report.failure?'N88 private asset check FAIL; see report':'N88 private asset graph and actual document PASS; hosted gates NOT_RUN');
