/** AI: actual student HTML, entry, client, handlers and source CSS over loopback. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const dir='tests/n88-failure-capture-client-delivery-20261024/';
const taskId='continuous-n88-failure-capture-client-delivery-20261024',runId='923a2be4-4016-4b55-8d5e-ffe53c3571e0';
const taskFile=`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const report={aiAuthored:true,status:'FAIL',taskId,runId,renderedUI:true,checks:[],providerOperations:0,scope:'Synthetic HTTP only; actual public source entry, not private carrier packaging or authenticated read'};
let mode='selected',calls=[],resources=[],pendingResponse;
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  if(u.pathname==='/api/n88/student/read'){
   const challenge=req.headers['x-n88-binding-challenge'];
   calls.push({method:req.method,selected:!!challenge,referrer:!!req.headers.referer});
   const status=mode==='401'?401:503;
   const receipt={version:1,challengeHash:createHash('sha256').update(challenge||'absent').digest('hex'),status,phase:'snapshot',family:status===401?'auth_or_membership':'database',sourcePin:'a'.repeat(64),mac:'b'.repeat(64)};
   if(mode==='extra')receipt.private='FORBIDDEN_PRIVATE';
   if(mode==='wrong-browser')receipt.challengeHash='c'.repeat(64);
   if(mode==='wrong-source')receipt.sourcePin='x-n88-source-is-not-a-pin';
   const finish=()=>{if(res.writableEnded||res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json');
    if(!['unknown','ordinary'].includes(mode))res.setHeader('X-N88-Failure-Correlation',mode==='malformed'?'{bad':JSON.stringify(receipt));
    // Even a successful-binding-shaped header on a failure must never be adopted.
    res.setHeader('X-N88-Binding-Proof',JSON.stringify({version:1,challengeHash:receipt.challengeHash,sealed:'a'.repeat(683)}));
    res.end(JSON.stringify({version:'n88-student-v3',profile:{name:'FORBIDDEN_PRIVATE'},private:'FORBIDDEN_PRIVATE'}));};
   if(mode==='late')pendingResponse=finish;else finish();return;
  }
  const name=u.pathname==='/student'?'/drafts/n88-student-portal/client/student.html':u.pathname;
  if(!/^\/(?:src\/|assets\/|drafts\/n88-student-portal\/client\/)/.test(name)){res.statusCode=404;res.end();return;}
  const file=path.resolve('.'+name);assert(file.startsWith(process.cwd()+path.sep));
  const bytes=await readFile(file);resources.push(name);
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end();}
});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 await withIsolatedLocalBrowser({taskFile,runId,url:origin+'/student',timeoutMs:90000},async({createContext})=>{
  for(const scenario of ['selected','ordinary','unknown','401','extra','wrong-browser','wrong-source','malformed','expired','late']){
   mode=scenario;calls=[];resources=[];pendingResponse=null;
   const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'});
   const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.captureEvents=[];window.privateFlashes=0;
    const set=Element.prototype.setAttribute;
    Element.prototype.setAttribute=function(k,v){if(k==='data-n88-failure-correlation')captureEvents.push({kind:'capture',pending:!!document.querySelector('.n88-unified-pending')});return set.call(this,k,v);};
    const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(Element.prototype,'innerHTML',{...html,set(v){if(this.id==='student-portal'&&v.includes('data-session-retry'))captureEvents.push({kind:'ordinary-error',captured:this.hasAttribute('data-n88-failure-correlation')});html.set.call(this,v);}});
    new MutationObserver(()=>{if(document.body?.textContent.includes('FORBIDDEN_PRIVATE'))privateFlashes++;}).observe(document,{subtree:true,childList:true,characterData:true});
   });
   const fragment=scenario==='ordinary'?'':`#n88-binding=${randomUUID()}.${Date.now()+(scenario==='expired'?-1000:60000)}`;
   await page.goto(origin+'/student'+fragment);
   if(scenario==='late'){
    await page.waitForFunction(()=>!!document.querySelector('.n88-unified-pending'));
    // Actual pagehide handler retires the in-flight browser request before reply.
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
    if(pendingResponse)pendingResponse();
    await page.waitForTimeout(50);
   }else await page.locator(scenario==='401'?'[data-claim]':'[data-session-retry]').waitFor();
   assert.equal(calls.length,1,scenario+': exactly one ordinary GET, no automatic retry');
   assert.equal(calls[0].method,'GET');assert.equal(calls[0].referrer,false);
   assert.equal(calls[0].selected,!['ordinary','expired'].includes(scenario));
   assert.equal(new URL(page.url()).hash,'');
   assert.equal(await page.locator('.n88-unified-profile,[data-end],[data-n88-binding-proof]').count(),0);
   assert(!(await page.locator('body').innerText()).includes('FORBIDDEN_PRIVATE'));
   assert.equal(await page.evaluate(()=>privateFlashes),0);
   const captured=await page.locator('#student-portal').getAttribute('data-n88-failure-correlation');
   assert.equal(!!captured,['selected','401'].includes(scenario),scenario+': finite metadata only');
   if(captured){
    assert.deepEqual(Object.keys(JSON.parse(captured)).sort(),['challengeHash','family','mac','phase','sourcePin','status','version']);
    const events=await page.evaluate(()=>captureEvents);
    assert.deepEqual(events.map(e=>e.kind),scenario==='401'?['capture']:['capture','ordinary-error']);
    assert(events[0].pending);if(scenario!=='401')assert(events[1].captured);
   }
   assert(resources.includes('/drafts/n88-student-portal/client/binding-proof.js'));
   assert(resources.includes('/src/lib/student-portal-unified-client.js'));
   assert(resources.includes('/src/styles/student-portal-login.css'));
   assert.equal(await page.locator('#student-portal').evaluate(el=>getComputedStyle(el).direction),'rtl');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);
   await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
   assert.equal(await page.locator('[data-n88-failure-correlation],[data-n88-binding-proof]').count(),0);
   // The actual automatic return handler may read again; the retired challenge
   // must never accompany this new browser context generation.
   if(scenario==='selected'){
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
    await page.locator('[data-session-retry]').waitFor();
    assert.equal(calls.length,2);assert.equal(calls[1].selected,false);
    assert.equal(await page.locator('[data-n88-failure-correlation]').count(),0);
   }
   report.checks.push({scenario,status:'PASS',initialRequests:1,captured:!!captured,retired:true,privateProfileOrBinding:false});
   await context.close();
  }
 });
 report.status='PASS';report.isolation='Canonical isolated-local-browser: fresh disposable contexts, loopback origin only, SW blocked; no shared live-browser lease required';
}catch(error){report.error=String(error.stack||error);throw error;}
finally{
 pendingResponse?.();server.closeAllConnections();await new Promise(ok=>server.close(ok));
 report.cleanup={ownedHttpServerClosed:!server.listening,ownedBrowserClosed:true};
 await writeFile(dir+'app.json',JSON.stringify(report,null,2)+'\n');
}
console.log('PASS: actual student HTTP/app 503, finite capture before error, retirement and privacy');
