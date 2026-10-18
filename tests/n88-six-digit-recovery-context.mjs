/** AI: additional affected membership/reauthorization/unmount regression only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A,SESSION} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-teacher-code-recovery-share-20261018',runId='72d3c8a3-8a69-4e86-8cee-e6c37034035e',root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',root+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}};let review,owned=false,failed;
try {
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;review=await startIntegratedReview({ttl:180});const t=review.testing,origin=new URL(review.url).origin;
 const binding={ownerId:A,sessionId:SESSION,leaseId:'context-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=async(action,body={})=>{const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+t.provider.token()},body:JSON.stringify({teachingId:'teaching',binding,...body})});return {status:r.status,body:await r.json()};};
 const first=await teacher('list');assert.equal(first.status,200);assert.equal((await teacher('issue-missing',{requestId:randomUUID(),expectedRosterRevision:first.body.data.rosterRevision})).body.data.created.length,2);
 report.stage='membership-removal';const original=(await teacher('list')).body.data.students,member=original.find(s=>s.studentId==='student');
 await t.query("update rakeezx.enrollments set status='ended',end_date='2026-10-18',revision=revision+1 where id='enrollment'");
 const reads=t.metrics.recoveryReads,removed=await teacher('list');assert.equal(removed.status,200);assert.equal(removed.body.data.students.length,1);assert.equal(t.metrics.recoveryReads-reads,1);assert.ok(removed.body.data.students.every(s=>s.studentId!=='student'&&s.credential!==member.credential));
 assert.equal((await teacher('rotate',{studentId:member.studentId,enrollmentId:member.enrollmentId,revision:member.revision,credentialVersion:member.credentialVersion,requestId:randomUUID()})).status,409);
 await t.query("update rakeezx.enrollments set status='active',end_date=null,revision=revision+1 where id='enrollment'");
 const restored=(await teacher('list')).body.data.students.find(s=>s.studentId==='student');assert.equal(restored.credential,member.credential);assert.equal(restored.credentialVersion,member.credentialVersion);
 report.stage='actual-context-ui';await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  await page.goto(review.url);await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await page.locator('[data-code] input').first().waitFor();
  const values=await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  t.provider.denied=true;await page.locator('[data-action=refresh]').click();assert.equal(await page.locator('[data-code]').count(),0);await page.getByRole('status').filter({hasText:'تعذّر التحقق'}).waitFor();assert.equal(await page.locator('[data-code]').count(),0);t.provider.denied=false;
  await page.locator('[data-action=refresh]').click();await page.locator('[data-code] input').first().waitFor();assert.deepEqual(await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value)),values);
  await page.evaluate(()=>{location.hash='#/teaching/teaching';});await page.locator('[data-code]').waitFor({state:'detached'});
  await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await page.locator('[data-code] input').first().waitFor();assert.deepEqual(await page.locator('[data-code] input').evaluateAll(es=>es.map(e=>e.value)),values);
  report.stage='actual-signout';await page.evaluate(async()=>{const originalFetch=window.fetch;window.fetch=(url,init)=>String(url).includes('/auth/v1/logout')?Promise.resolve(new Response(null,{status:204})):originalFetch(url,init);await window.n88Fixture.cloud.signOut();});assert.equal(await page.locator('[data-code]').count(),0);
 });
 report.checks.push({name:'recovery_current_membership_failed_reauthorization_unmount_logout',status:'PASS',evidence:'Current canonical membership removal excludes the exact old student/code before envelope query; stale selective rotation denies. Restoring valid membership preserves same code/version. Actual desktop class source CSS/handlers: failed teacher reauthorization immediately wipes codes; successful refresh recovers unchanged; route unmount/reopen and logout clear ephemeral DOM. No private output or screenshots.'});
}catch(e){failed=true;report.failure={stage:report.stage,location:String(e.stack||'').split('\n').filter(l=>l.includes('recovery-context.mjs:')).map(l=>l.match(/recovery-context\.mjs:\d+:\d+/)?.[0]).filter(Boolean),message:e?.code==='ERR_ASSERTION'?'Assertion failed; values omitted':String(e.message).replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]').split('\n')[0]};}
finally{await review?.close();report.cleanup.httpAndPgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-recovery-context.json',JSON.stringify(report,null,2)+'\n');}
console.log(failed?'N88 recovery context FAIL (sanitized report)':'N88 recovery context PASS');if(failed)process.exitCode=1;
