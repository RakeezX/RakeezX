/** AI: actual anonymous private document only; no teacher journey or student code. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const root='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-official-student-portal-activation-20261018',runId='3576957c-1cf3-455d-8d62-150b1934b728';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',scope:'Actual anonymous /student DOM/CSS/handlers only; no authenticated teacher/student acceptance',fullHostedJourney:'NOT_RUN',cleanup:{}};let browser,owned=false;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 const {chromium}=createRequire(root+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin==='https://rakeezx.com'?r.continue():r.abort('blockedbyclient'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('https://rakeezx.com/student');assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);assert.equal(response.headers()['referrer-policy'],'no-referrer');
 await page.getByRole('heading',{name:'دخول الطالب'}).waitFor();
 const input=page.locator('input');assert.equal(await input.isEnabled(),true);assert.equal(await input.getAttribute('maxlength'),'6');
 assert.equal(await page.locator('link[href="/n88-private/styles/student-portal-login.css"]').evaluate(e=>!!e.sheet),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 await mkdir('tests/fixtures/n88-official-activation',{recursive:true});await page.screenshot({path:'tests/fixtures/n88-official-activation/pilot-student-blank.png',fullPage:true});
 report.status='PASS';report.checks=['actual official document and source CSS rendered in fresh disposable context','six-digit enabled blank login, no code entered or submitted','private no-store/no-referrer response','mobile layout has no horizontal overflow or JS error'];report.credentialsOrCookiesImported=false;
}catch(e){report.failure={message:String(e.message).slice(0,250)};process.exitCode=1;}
finally{await browser?.close();report.cleanup.ownedBrowserClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-official-activation-pilot-hosted-browser.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
