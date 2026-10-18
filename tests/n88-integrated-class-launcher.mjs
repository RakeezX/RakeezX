import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
/** AI: exact executable launcher/owned graceful stop, no repeated UI journey. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const ps=(file,args)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',file,...args],{encoding:'utf8',windowsHide:true,timeout:80000,maxBuffer:1024*1024});
const lease=action=>ps(base+'/scripts/ops-supervisor-v4/resource-lease.ps1',['-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]).trim();
const launcher=path.resolve('drafts/n88-student-portal/current-review-launch.ps1'),receipt=path.resolve('tests/fixtures/n88-integrated-class/receipts/'+randomUUID()+'.json');
const report={taskId,runId,checks:[],cleanup:{}};let owned=false,started=false;
try{
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  const initial=JSON.parse(ps(launcher,['-TtlSeconds','180','-Receipt',receipt]));started=true;
  assert.equal(initial.receiptPath,receipt);assert.equal(initial.review.status,'running');assert.ok(initial.review.url.endsWith('/#/teaching/teaching'));
  assert.equal((await fetch(initial.review.url)).status,200);assert.equal((await fetch(new URL('/student',initial.review.url))).status,200);
  assert.equal(initial.review.credentialFormat,'six-v1');
  await withIsolatedLocalBrowser({taskFile,runId,url:initial.review.url,timeoutMs:60000},async({createContext})=>{
    const c=await createContext({viewport:{width:390,height:900}}),p=await c.newPage();let claims=0;
    p.on('request',r=>{if(new URL(r.url()).pathname==='/api/n88/student/claim')claims++;});
    await p.goto(new URL('/student',initial.review.url).href);
    const field=p.locator('[data-claim] input');await field.waitFor();
    assert.match(await p.locator('#n88-code-help').innerText(),/6 أرقام/);
    for(const [attr,value]of [['type','text'],['minlength','6'],['maxlength','6'],['pattern','1[0-9]{5}']])assert.equal(await field.getAttribute(attr),value);
    await field.evaluate(el=>{const d=new DataTransfer();d.setData('text','1'+'234567');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));});
    assert.equal(await field.inputValue(),'');assert.equal(await field.evaluate(el=>el.validity.customError),true);
    await field.fill('1'+'2345');await p.locator('[data-claim] button').click();assert.equal(claims,0);
    await field.fill('');await field.evaluate(el=>{const d=new DataTransfer();d.setData('text','١'+'٢٣٤٥٦');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));});
    assert.equal(await field.evaluate(el=>/^1[0-9]{5}$/.test(el.value)&&el.validity.valid),true);
    await field.evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,data:'7',inputType:'insertText'})));
    assert.equal(await field.inputValue(),'');assert.equal(await field.evaluate(el=>el.validity.customError),true);assert.equal(claims,0);
    await field.fill('');await p.screenshot({path:'tests/fixtures/n88-six-digit/login-390.png',fullPage:true});
  });
  report.checks.push({name:'actual_universal_entry_no_truncation_or_five_digit_claim',status:'PASS',evidence:'Actual current launcher app DOM/handlers/CSS: six-digit help/pattern/min/max; seven-digit paste and excess insertion reject before native truncation; five digits cannot submit; defined Arabic paste normalizes six ASCII digits. No claim request/credential persisted; blank login screenshot.'});
  const stopped=JSON.parse(ps(launcher,['-Stop','-Receipt',receipt]));assert.equal(stopped.review.status,'stopped');assert.equal(stopped.review.reason,'owned-request');
  assert.deepEqual(stopped.review.cleanup,{httpClosed:true,postgresStopped:true,ownedFilesRemoved:true});started=false;
  await assert.rejects(fetch(initial.review.url));await unlink(receipt);
  report.checks.push({name:'exact_review_launcher_start_and_owned_stop',status:'PASS',evidence:'Actual PowerShell launcher returns live actual-app teacher URL, /student HTTP 200 and PID/birth receipt; owned -Stop gracefully closes HTTP/native PG and removes owned cluster. Receipt removed by this test only; no browser replay or hosted call.'});
}finally{
  if(started)ps(launcher,['-Stop','-Receipt',receipt]);
  if(owned)report.cleanup.lease=lease('release');
  await writeFile('tests/n88-six-digit-launcher.json',JSON.stringify(redactN88(report),null,2)+'\n');
}
console.log('N88 executable review launcher/owned shutdown PASS');
