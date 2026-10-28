/** AI: actual app DOM/handlers/CSS/owner guard over loopback; synthetic service I/O. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {start} from './server.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const base='C:/Users/Abody/Projects/RakeezX',taskId='n88-term-negative-1028',runId='3b7b773c-82bc-4cd5-aade-9b265aa7c2d8';
const taskFile=`${base}/artifacts/ops-supervisor-v4/queue/${taskId}.json`,dir='tests/n88-terminal-negative-20261028';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',base+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,sourceOnly:true,realOperations:0,cases:[],cleanup:{}};let server,owned=false,stage='lease';
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url,timeoutMs:120000},async({createContext})=>{
  async function boot(n,enabled=true){
   await server.reset(n,enabled);const context=await createContext({viewport:{width:390,height:900}}),p=await context.newPage();p.setDefaultTimeout(8000);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   // Exercise the real supported deep-link route, including the empty class.
   await p.goto(server.url+'/student-portal');try{await p.waitForFunction(()=>!!window.negativeFixture);}catch(e){throw Error('bootstrap: '+JSON.stringify(errors),{cause:e});}
   try{await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');}catch(e){throw Error('entry: '+JSON.stringify({errors,calls:server.calls,text:(await p.locator('body').innerText()).slice(-2000)}),{cause:e});}
   await p.locator('.n88-code-management>summary').click();
   await p.waitForFunction(()=>document.querySelector('.n88-code-management')?.open&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
   return {p,context};
  }
  for(const n of [0,28,50]){
   stage='rendered-close-'+n;const {p,context}=await boot(n);
   assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);
   assert.equal(server.calls.filter(c=>c.resolution).length,0);
   await p.locator('[data-action=close-unknown]').click();
   await p.waitForFunction(()=>document.querySelector('.n88-class-status')?.textContent.includes('أُقرّ إغلاق الطلب السابق'));
   assert.equal(server.calls.filter(c=>c.resolution==='close').length,1);
   assert.equal(server.fixture.snapshot().classReceipts.length,1);assert.equal(server.fixture.snapshot().numericCredentials.length,0);
   assert.equal(await p.locator('[data-code]').count(),0);
   assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.n88-class')).direction),'rtl');
   await p.screenshot({path:`${dir}/closed-${n}.png`,fullPage:true});report.cases.push({name:stage,status:'PASS',receiptCount:1,issued:0});await context.close();
  }
  stage='default-off';{
   const {p,context}=await boot(28,false);assert.equal(await p.locator('[data-action=close-unknown]').count(),0);
   assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);assert.equal(server.fixture.snapshot().classReceipts.length,0);
   report.cases.push({name:stage,status:'PASS'});await context.close();
  }
  stage='owner-guard-delayed-close';{
   const {p,context}=await boot(28);server.setDelay(400);
   const hint=await p.evaluate(()=>localStorage.getItem(window.negativeFixture.hintKey));
   await p.locator('[data-action=close-unknown]').click();
   await p.waitForFunction(()=>window.negativeFixture.calls.some(c=>c.body.resolution==='close'));
   await p.evaluate(()=>window.n88Fixture.switchOwner());
   await p.waitForTimeout(500);
   assert.equal(await p.evaluate(()=>{try{window.negativeFixture.getBinding(false);return false;}catch{return true;}}),true);
   assert.equal(await p.locator('[data-code],[data-action=close-unknown],.n88-class-roster').count(),0);
   assert.equal(await p.evaluate(()=>localStorage.getItem(window.negativeFixture.hintKey)),hint);
   report.cases.push({name:stage,status:'PASS'});await context.close();
  }
 });
}catch(e){report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{if(server){await server.close();report.cleanup.serverClosed=true;}if(owned)report.cleanup.integrationLease=lease('release');await writeFile(`${dir}/${report.failure?'browser-failure-'+Date.now():'browser-result'}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
