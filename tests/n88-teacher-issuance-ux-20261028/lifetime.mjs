/** AI-authored targeted remaining lifecycle checks; reuse unchanged matrix evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {start} from './server.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-teacher-issuance-review-and-content-hub-20261028',runId='dcf225dd-076a-47fc-91c7-404b3dd31ec7',taskFile=`${canonical}/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={checks:[],providerOperations:0,cleanup:{}};let server,owned=false;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url,timeoutMs:30000},async({createContext})=>{
  const c=await createContext({viewport:{width:390,height:1000}}),p=await c.newPage();p.setDefaultTimeout(5000);
  await p.goto(server.url);await p.waitForFunction(()=>!!window.compactFixture);
  await p.evaluate(()=>{const s=window.compactFixture.roster.students[0];Object.assign(s,{hasActiveCode:true,credential:'123456',credentialVersion:1,recoveryStatus:'recoverable'});});
  await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('.n88-code-management>summary').waitFor();await p.locator('.n88-code-management>summary').click();await p.locator('[data-code]').waitFor();
  await p.locator('[data-n88-list-support]>summary').click();await p.waitForFunction(()=>document.querySelector('[data-n88-failure-text]')?.textContent.includes('admitted'));
  const diagnostic=JSON.parse(await p.locator('[data-n88-failure-text]').textContent());assert.equal(diagnostic.phase,'admitted');assert.equal(diagnostic.httpStatus,200);assert.equal(diagnostic.code,'none');assert.equal(diagnostic.stage,'none');assert.equal(diagnostic.region,'ap-south-1');
  await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await p.locator('[data-code],[data-manual]').count(),0);assert.equal(await p.locator('.n88-code-management').evaluate(e=>e.open),false);
  await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[data-code]').count(),0);
  await p.locator('.n88-code-management>summary').click();await p.locator('[data-code]').waitFor();
  await p.evaluate(()=>{const {cloud}=window.n88Fixture,user=cloud.user;cloud.setMockAuth(user,{user,access_token:'synthetic.'+btoa(JSON.stringify({session_id:'expired-synthetic-session',exp:1}))+'.synthetic'});window.compactFixture.notify();});
  await p.locator('[data-n88-entry-state=session]').waitFor();assert.equal(await p.locator('[data-code],[data-manual],[name=executionInstructions]').count(),0);
  assert.equal(await p.evaluate(()=>window.compactFixture.calls.some(x=>!['list','guidance-list'].includes(x.action))),false);
  report.checks.push({name:'actual_UI_session_expiry_hidden_visibility_and_admitted_diagnostic',status:'PASS',evidence:'Real classBinding rejects expired fabricated JWT; hidden visibility synchronously wipes codes and collapses roster; returning document needs explicit expansion; actual support DOM reports admitted/200/none/ap-south-1. No mutations.'});await c.close();
 });
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{await server?.close();report.cleanup.serverClosed=true;if(owned)report.cleanup.integrationLease=lease('release');await writeFile('tests/n88-teacher-issuance-ux-20261028/lifetime-result.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
