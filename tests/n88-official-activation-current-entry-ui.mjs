/** AI: actual component/store/ownership guard/CSS over owned HTTP, fresh shared-lease contexts. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fixture} from './fixtures/n88-student-projection/canonical.mjs';
import {A,providerFixture} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-official-student-portal-activation-20261018',runId='b324b7b5-5bfa-4ddb-8a92-adde7e26fe04',canonicalRoot='C:/Users/Abody/Projects/RakeezX';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',checks:[],hostedProof:false,cleanup:{}};let server,browser,owned=false,admit=true,calls=0,activeRequests=0,maxRequests=0;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const row of rows)row.ownerId=A;
 const token=providerFixture().token();
 const pieces=token.split('.'),claims=JSON.parse(Buffer.from(pieces[1],'base64url'));claims.exp+=60;
 const renewedToken=[pieces[0],Buffer.from(JSON.stringify(claims)).toString('base64url'),pieces[2]].join('.');
 const boot=`const renewalSubscribers=new Set();import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import * as store from '/src/store.js';import * as cloud from '/src/lib/cloud.js';import {mountClassService,classBinding} from '/src/lib/student-portal-runtime.js';await bootstrap();mountClassService(document.getElementById('portal'),{getBinding:w=>classBinding({cloud,store,teachingId:'teaching'},w),subscribe:fn=>{renewalSubscribers.add(fn);const off=store.subscribe(fn);return()=>{renewalSubscribers.delete(fn);off();};},classLabel:()=> 'الفصل المصطنع'});`;
 server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  if(u.pathname.startsWith('/api/')){activeRequests++;maxRequests=Math.max(maxRequests,activeRequests);let closed=false;const done=()=>{if(!closed){closed=true;activeRequests--;}};res.once('finish',done);res.once('close',done);await new Promise(ok=>setTimeout(ok,120));}
  const send=(body,type='text/javascript')=>{res.setHeader('Content-Type',type);res.end(body);};
  if(u.pathname==='/')return send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main id="portal"></main><script type="module" src="/boot.js"></script></html>','text/html');
  if(u.pathname==='/boot.js')return send(boot+`window.n88RenewSyntheticSession=()=>{cloud.setMockAuth(cloud.user,{...cloud.session,access_token:${JSON.stringify(renewedToken)}});for(const fn of [...renewalSubscribers])fn();};`);
  if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token,canonical}),'application/json');
  if(u.pathname==='/api/n88/teacher/class/list'){
   calls++;let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw);
   if(!admit){res.statusCode=401;return send('{}','application/json');}
   assert.ok([token,renewedToken].includes(req.headers.authorization?.slice(7)));assert.equal(b.binding.ownerId,A);
   return send(JSON.stringify({ack:true,binding:b.binding,requestId:null,rollout:'pilot',data:{classId:'class',rosterRevision:'a'.repeat(64),policyRevision:0,visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students:['student','other'].map((id,i)=>({studentId:id,enrollmentId:'enrollment-'+i,revision:1,label:'طالب مصطنع '+(i+1),hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}))}}),'application/json');
  }
  if(u.pathname.startsWith('/api/')){res.statusCode=401;return send('{}','application/json');}
  const file=u.pathname.slice(1);if(!/^(src|assets|font|tests\/fixtures\/n88-integrated-class)\/[A-Za-z0-9_./-]+$/.test(file)||file.includes('..')){res.statusCode=404;return res.end();}
  const type={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
  return send(await readFile(file),type);
 }catch{res.statusCode=500;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 const {chromium}=createRequire(canonicalRoot+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 for(const admitted of [true,false]){
  admit=admitted;const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',locale:'ar-SA'});
  try{
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
   if(admitted){await page.locator('.n88-class-roster>li').last().waitFor();assert.equal(await page.locator('.n88-class-roster>li').count(),2);assert.match(await page.locator('#portal').innerText(),/تجربة محدودة/);
    assert.ok(calls>=2);await page.locator('.n88-class-settings summary').click();await page.locator('input[name=name]').check();assert.equal(await page.locator('input[name=name]').isChecked(),true);assert.match(await page.locator('#portal').innerText(),/تجربة محدودة/);
    assert.equal(await page.locator('link[href="/src/styles/student-portal-class.css"]').evaluate(e=>!!e.sheet),true);
    const response=page.waitForResponse(r=>r.url().endsWith('/api/n88/teacher/class/list')&&r.request().headers().authorization==='Bearer '+renewedToken);
    await page.evaluate(()=>window.n88RenewSyntheticSession());await response;
    await page.locator('.n88-class-roster>li').last().waitFor();assert.equal(await page.locator('.n88-class-roster>li').count(),2);
    await page.evaluate(()=>window.n88Fixture.switchOwner());await page.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.equal(await page.locator('[data-delivery]').count(),0);
   }else{await page.getByText('مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة الخاصة بعد.',{exact:true}).waitFor();await page.waitForTimeout(300);assert.equal(await page.locator('.n88-class-roster').count(),0);assert.equal(await page.locator('[data-action]').count(),0);}
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 assert.equal(maxRequests,1);report.checks=['actual class runtime/component/handlers and source CSS rendered over loopback HTTP','actual account store and owner-bound dispatch guard admitted synthetic current owner','pilot state and two-member roster rendered','field draft handler exercised without publishing','renewed same-owner synthetic session requires fresh server admission and restores controls','owner deactivation removes private roster/delivery','server admission rejection keeps controls unavailable','delayed actual list/guidance requests serialized; maximum one in flight'];report.status='PASS';
}catch(e){report.failure={message:String(e.message).slice(0,300),stack:e.stack?.split('\n').filter(l=>l.includes('pilot-ui.mjs')).join('\n')};process.exitCode=1;}
finally{await browser?.close();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup.ownedBrowserAndHttpClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-official-activation-current-entry-ui.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
