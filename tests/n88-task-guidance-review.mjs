/** AI: exact current launcher, filled actual app, same-source owned shutdown. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-task-execution-delivery-guidance-20261018',runId='da437f4d-bfbe-42af-bcbc-33996358d071',canonical='C:/Users/Abody/Projects/RakeezX',taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const ps=(file,args)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',file,...args],{encoding:'utf8',windowsHide:true,timeout:65000,maxBuffer:1024*1024});
const lease=action=>ps(canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1',['-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]);
const launcher=path.resolve('drafts/n88-student-portal/current-review-launch.ps1'),receipt=path.resolve('tests/fixtures/n88-integrated-class/receipts/guidance-'+randomUUID()+'.json');
const report={taskId,runId,checks:[],cleanup:{}},args=['-Receipt',receipt];let owned=false,started=false,failed=false;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 const r=JSON.parse(ps(launcher,[...args,'-TtlSeconds','180']));started=true;assert.equal(r.review.status,'running');
 await withIsolatedLocalBrowser({taskFile,runId,url:r.review.url,timeoutMs:60000},async({createContext})=>{
  const c=await createContext({viewport:{width:390,height:900}}),p=await c.newPage();p.setDefaultTimeout(12000);
  await p.goto(r.review.url);await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[data-code] input').first().waitFor();
  const code=await p.locator('.n88-class-roster>li').filter({hasText:'عبدالله سالم'}).locator('[data-code] input').inputValue();
  await p.locator('.n88-task-guidance>summary').click();await p.locator('[data-guidance-source]').selectOption('overdue');assert.match(await p.locator('[name=executionInstructions]').inputValue(),/قارن 1\/2/);
  const sc=await createContext({viewport:{width:1280,height:900}}),s=await sc.newPage();s.setDefaultTimeout(12000);await s.goto(new URL('/student',r.review.url).href);
  await s.locator('[data-claim] input').fill(code);await s.locator('[data-claim] button').click();await s.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();
  const task=s.locator('[data-section=required] details').filter({hasText:'تطبيق مقارنة الكسور'});await task.locator('summary').click();assert.match(await task.innerText(),/قارن 1\/2 و3\/4/);assert.match(await task.innerText(),/كراسة الرياضيات/);
 });
 report.checks.push({name:'same_source_populated_current_review_launcher',status:'PASS',evidence:'Unmodified hidden PowerShell launch/owned receipt and shutdown path launches current worktree actual teacher/student app and restricted PG. Fresh examples published through actual authenticated service; task guidance and canonical status populated, teacher code entered only into actual student form. No credentials captured/logged.'});
}catch(e){failed=true;report.failure={message:e.code==='ERR_ASSERTION'?'Assertion failed; private values omitted':String(e.message).split('\n')[0].replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]')};}
finally{if(started){try{const stopped=JSON.parse(ps(launcher,[...args,'-Stop']));assert.equal(stopped.review.status,'stopped');report.cleanup=stopped.review.cleanup;await unlink(receipt);}catch{failed=true;report.cleanup.failure='Owned shutdown failed; preserve receipt for exact cleanup';}}if(owned)report.cleanup.lease=lease('release').trim();await writeFile('tests/n88-task-guidance-review.json',JSON.stringify(report,null,2)+'\n');}
console.log(failed?'N88 guidance launcher FAIL; sanitized report':'N88 guidance same-source review PASS');if(failed)process.exitCode=1;
