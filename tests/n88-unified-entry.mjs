/** AI: affected client guards and real module DOM/CSS on task-owned synthetic HTTP. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { createUnifiedStudentPortalClient, projectUnifiedStudentData, normalizeStudentCode } from '../src/lib/student-portal-unified-client.js';
const taskId='continuous-n88-unified-student-entry-view-20261018', runId='5cd15d10-5ebc-4063-8333-ab41fae20236';
const version='n88-student-v3';
const a={version,profile:{name:'طالب تجريبي أ',classLabel:'فصل تجريبي',private:'NEVER_RENDER'},grades:{items:[{id:'g1',label:'بند صفر',value:0,max:10},{id:'g2',label:'بند غير منشور',value:null,max:10}],total:{earned:0,possible:20}},work:{required:[{id:'r1',title:'واجب تجريبي',instruction:'تعليمات منشورة',private:'NEVER_RENDER'}],completed:[],scheduled:[{id:'s1',title:'نشاط قادم'}]},private:'NEVER_RENDER'};
const b={version,profile:{name:'طالب تجريبي ب'},work:{completed:[{id:'c1',title:'عمل منشور مكتمل'}]}};
assert.equal(normalizeStudentCode('١٢٣٤ ٥٦٧٨ ٩٠١٢'),'123456789012');
assert.equal(JSON.stringify(projectUnifiedStudentData(a)).includes('NEVER_RENDER'),false);
for(const bad of [{version:'old'}, {...a,grades:{items:[{id:'x',label:'x',value:'0',max:10}]}}, {...a,work:{required:[{title:'missing id'}]}}, {...a,grades:{items:[],total:{earned:0}}}]) assert.throws(()=>projectUnifiedStudentData(bad));
let sends=0;
const invalid=createUnifiedStudentPortalClient({fetch:async()=>{sends++;throw Error('transport secret');}});
for(const code of ['1234','023456789012','223456789012','1234567890123','1e1234567890','<1234567890>']) await assert.rejects(invalid.claim(code));
assert.equal(sends,0);
await assert.rejects(invalid.claim('123456789012'),e=>e.message==='Student access unavailable'&&!e.message.includes('secret'));
invalid.dispose();const disposedSends=sends;await assert.rejects(invalid.read());assert.equal(sends,disposedSends);
const transport=[];
const contract=createUnifiedStudentPortalClient({fetch:async(url,init)=>{transport.push({url,init});return {ok:true,json:async()=>b};}});
await contract.claim('١٢٣٤ ٥٦٧٨ ٩٠١٢');await contract.read();await contract.end();contract.dispose();
assert.deepEqual(transport.map(t=>t.url),['/api/n88/student/claim','/api/n88/student/read','/api/n88/student/end']);
for(const {init} of transport){assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.referrerPolicy,'no-referrer');assert.ok(init.signal instanceof AbortSignal);}
assert.deepEqual(Object.keys(JSON.parse(transport[0].init.body)),['code']);assert.equal(/^1[0-9]{11}$/.test(JSON.parse(transport[0].init.body).code),true);assert.equal(transport[1].init.body,undefined);assert.equal(transport[2].init.body,'{}');
transport.length=0;
let finish;
const stale=createUnifiedStudentPortalClient({fetch:async()=>({ok:true,json:()=>new Promise(r=>{finish=r;})})});
const pending=stale.read(); await new Promise(r=>setImmediate(r));stale.invalidate();finish(a);await assert.rejects(pending,e=>e.kind==='stale');
let state='session', calls=[], delayResolve;
const sourcePaths=['src/lib/student-portal-unified-client.js','src/views/student-portal-login.js','src/styles/student-portal-login.css'];
const hashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(url.pathname.startsWith('/api/')){
   assert.equal(url.search,'');let raw='';for await(const part of req)raw+=part;
   const body=raw?JSON.parse(raw):null;
   calls.push({path:url.pathname,method:req.method,bodyKeys:body?Object.keys(body):[],validCode:body?.code? /^1[0-9]{11}$/.test(body.code):null,csrf:req.headers['x-n88-csrf']==='1'});
   raw='';res.setHeader('Content-Type','application/json');
   if(state==='delay'){await new Promise(r=>{delayResolve=r;});res.end(JSON.stringify(a));return;}
   if(url.pathname.endsWith('/end')){state='session';res.end('{}');return;}
   if(state==='rate'){res.setHeader('Retry-After','1');res.writeHead(429).end('{"private":"NEVER_RENDER"}');return;}
   if(state==='session'||state==='expired'||state==='revoked'){res.writeHead(state==='revoked'?410:401).end('{"private":"NEVER_RENDER"}');return;}
   if(state==='failure'){res.writeHead(503).end('{"private":"NEVER_RENDER"}');return;}
   res.end(JSON.stringify(state==='b'?b:a));return;
  }
  const file=url.pathname==='/'||url.pathname==='/off'?'tests/fixtures/n88-unified-entry/index.html':url.pathname.slice(1);
  if(!['tests/fixtures/n88-unified-entry/index.html',...sourcePaths,'src/lib/rakeez-datetime-values.js'].includes(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]);res.end(await readFile(file));
 }catch{res.writeHead(500).end();}
});
const visual=[], checks=[];
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:origin,timeoutMs:90000},async({createContext})=>{
  for(const width of [390,1280]){
   state='session';const context=await createContext({viewport:{width,height:900},locale:'ar-SA'}),page=await context.newPage();
   const diagnostics=[],requests=[];
   page.on('console',msg=>diagnostics.push(msg.text()));page.on('pageerror',e=>diagnostics.push(e.message));
   page.on('request',req=>requests.push({url:req.url(),cache:req.headers()['cache-control']}));
   await context.addInitScript(()=>{window.persistenceWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){window.persistenceWrites++;return set.apply(this,args);};});
   await page.goto(origin);await page.locator('input:enabled').waitFor();
   assert.equal(await page.locator('input').count(),1);assert.equal(await page.locator('input').getAttribute('type'),'text');
   assert.equal(await page.locator('input').getAttribute('inputmode'),'numeric');
   assert.equal(await page.locator('input').inputValue(),'');
   const shot=resolve(tmpdir(),`n88-unified-${runId}-${width}-empty-entry.png`);await page.screenshot({path:shot,fullPage:true});
   await page.locator('input').fill('1234');await page.locator('[type=submit]').click();assert.equal(await page.locator('[aria-invalid=true]').count(),1);
   state='a';await page.locator('input').fill('١٢٣٤ ٥٦٧٨ ٩٠١٢');await page.locator('[type=submit]').click();await page.getByText(a.profile.name,{exact:true}).waitFor();
   assert.equal(await page.locator('input').count(),0);assert.equal(await page.locator('tbody tr').first().locator('td').first().textContent(),'0');assert.equal(await page.locator('tbody tr').nth(1).locator('td').first().textContent(),'لم تُنشر');
   assert.equal(await page.locator('[data-section]').count(),3);assert.equal((await page.locator('#portal').textContent()).includes('NEVER_RENDER'),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#portal').evaluate(e=>getComputedStyle(e).direction),'rtl');
   assert.equal(await page.locator('.n88-unified-sections').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width===390?1:2);
   await page.locator('[data-end]').click();await page.locator('input:enabled').waitFor();
   state='b';await page.locator('input').fill('198765432109');await page.locator('[type=submit]').click();await page.getByText(b.profile.name,{exact:true}).waitFor();
   assert.equal((await page.locator('#portal').textContent()).includes(a.profile.name),false);assert.equal(await page.locator('table').count(),0);assert.equal(await page.locator('[data-section=required]').count(),0);assert.equal(await page.locator('[data-section=scheduled]').count(),0);
   state='expired';await page.locator('[data-read]').click();await page.locator('input:enabled').waitFor();assert.equal((await page.locator('#portal').textContent()).includes(b.profile.name),false);
   state='b';await page.locator('input').fill('198765432109');await page.locator('input').press('Enter');await page.getByText(b.profile.name,{exact:true}).waitFor();
   state='revoked';await page.locator('[data-read]').click();await page.locator('input:enabled').waitFor();assert.equal((await page.locator('#portal').textContent()).includes(b.profile.name),false);
   state='rate';await page.locator('input').fill('123456789012');await page.locator('[type=submit]').click();await page.locator('input:disabled').waitFor();await page.locator('input:enabled').waitFor();
   state='failure';await page.locator('input').fill('123456789012');await page.locator('[type=submit]').click();await page.locator('input:enabled').waitFor();assert.match(await page.locator('[role=status]').textContent(),/تعذّر/);
   state='delay';await page.locator('input').fill('123456789012');await page.locator('[type=submit]').click();await page.getByRole('heading',{name:'جارٍ الاتصال…'}).waitFor();
   while(!delayResolve) await new Promise(r=>setTimeout(r,10));
   await page.evaluate(()=>window.portal.clear());delayResolve();delayResolve=null;state='session';
   await page.locator('input:enabled').waitFor();await page.waitForTimeout(100);assert.equal((await page.locator('#portal').textContent()).includes(a.profile.name),false);
   state='b';await page.evaluate(()=>window.portal.refresh());await page.getByText(b.profile.name,{exact:true}).waitFor();
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.locator('input').waitFor();assert.equal((await page.locator('#portal').textContent()).includes(b.profile.name),false);
   assert.equal(await page.evaluate(()=>window.persistenceWrites),0);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
   assert.equal(requests.every(req=>new URL(req.url).origin===origin&&!new URL(req.url).search),true);
   assert.equal(diagnostics.some(s=>/123456789012|198765432109|NEVER_RENDER|طالب تجريبي/.test(s)),false);
   await page.evaluate(()=>window.portal.dispose());assert.equal(await page.locator('#portal').textContent(),'');
   const before=calls.length;await page.goto(origin+'/off');await page.locator('input:disabled').waitFor();assert.equal(calls.length,before);
   visual.push({width,rtl:true,overflow:false,sourceCSS:true,entryScreenshot:shot,privateDataScreenshots:false,storageWrites:0});await context.close();
  }
 });
 assert.ok(calls.some(c=>c.path==='/api/n88/student/claim'));
 for(const c of calls){assert.ok(['/api/n88/student/claim','/api/n88/student/read','/api/n88/student/end'].includes(c.path));assert.equal(c.method,c.path.endsWith('/read')?'GET':'POST');assert.deepEqual(c.bodyKeys,c.path.endsWith('/claim')?['code']:[]);if(c.path.endsWith('/claim'))assert.equal(c.validCode,true);if(c.method==='POST')assert.equal(c.csrf,true);}
 checks.push({name:'n88_unified_numeric_entry_actual_student_ui_and_allowed_projection',status:'PASS',evidence:'Actual module DOM/handlers/source CSS at 390/1280: one numeric field, Arabic normalization, exact prefix/length, own A/B projections, omitted sections, null versus zero, RTL/responsive layout, readiness OFF.'});
 checks.push({name:'n88_unified_client_session_failure_revocation_and_private_credential_boundaries',status:'PASS',evidence:'Fixed claim/read/end methods and body keys; stale body-parse and pending UI invalidation; current session, logout, revoked, 429 cooldown/retry, 503, pagehide/dispose; zero storage writes; no secret/payload diagnostics or query. Synthetic HTTP only; owned browser/server finally cleanup.'});
 await writeFile('tests/n88-unified-entry.result.json',JSON.stringify({taskId,runId,baseSha:'8ff59100ead8802dec7ebb7f7d4f4d41c2c89f8c',hashes,checks,visual,requestSummary:calls},null,2)+'\n');
 console.log(JSON.stringify(checks));
}finally{delayResolve?.();server.closeAllConnections();await new Promise(done=>server.close(done));}
