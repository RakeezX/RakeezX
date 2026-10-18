/** AI: focused actual application -> authenticated service -> restricted nativePG checks. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A,B,SESSION} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-task-execution-delivery-guidance-20261018',runId='da437f4d-bfbe-42af-bcbc-33996358d071';
const canonical='C:/Users/Abody/Projects/RakeezX',taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}},pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try{const prior=JSON.parse(await readFile('tests/n88-task-guidance.json','utf8'));report.priorAttempts=[...(prior.priorAttempts||[]),{stage:prior.stage,failure:prior.failure||null,checks:prior.checks,cleanup:prior.cleanup}];}catch{}
let review,owned=false,failed;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
 review=await startIntegratedReview({ttl:600});const t=review.testing,q=t.query,origin=new URL(review.url).origin;
 const binding={ownerId:A,sessionId:SESSION,leaseId:'guidance-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
 const teacher=async(action,body={},token=t.provider.token(),bind=binding)=>{const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+token},body:JSON.stringify({teachingId:'teaching',binding:bind,...body})});return {status:r.status,body:await r.json()};};
 const list=async()=>{const r=await teacher('list');assert.equal(r.status,200);return r.body.data;};
 const sources=async()=>{const r=await teacher('guidance-list');assert.equal(r.status,200);return r.body.data.tasks;};
 const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,true]));
 const publish=async fs=>{const r=await list();assert.equal((await teacher('visibility',{policyRevision:r.policyRevision,expectedRosterRevision:r.rosterRevision,fields:fs})).status,200);};
 const save=(task,extra={})=>teacher('guidance-save',{requestId:randomUUID(),guidance:{subitemId:task.subitemId,sourceStamp:task.sourceStamp,revision:task.revision,executionInstructions:'قارن الكسرين.\nاكتب: 1 < 2 ثم فسّر إجابتك.',deliveryInstructions:'أحضر الحل في كراسة الرياضيات إلى الحصة القادمة.',confirmClear:false,...extra}});
 const canonicalState=async()=>JSON.stringify((await q("select jsonb_build_object('scores',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.scores s),'completions',(select jsonb_agg(to_jsonb(c) order by id) from rakeezx.score_subitem_completions c),'tasks',(select jsonb_agg(to_jsonb(t) order by id) from rakeezx.score_subitems t)) as state")).rows[0]);
 report.stage='setup';assert.deepEqual(await sources(),[]);await publish(fields);
 const roster=await list();assert.equal((await teacher('issue-missing',{expectedRosterRevision:roster.rosterRevision,requestId:randomUUID()})).status,200);
 const code=(await list()).students.find(s=>s.studentId==='student').credential;
 const before=await canonicalState();
 report.stage='actual-ui';
 await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:120000},async({createContext})=>{
  const c=await createContext({viewport:{width:390,height:1000},locale:'ar-SA'}),page=await c.newPage();
  page.setDefaultTimeout(12000);
  report.stage='ui-open-class';await page.goto(review.url);await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();
  report.stage='ui-guidance-list';await page.locator('[data-guidance-source]').waitFor({state:'attached'});await page.locator('.n88-task-guidance>summary').click();
  await page.locator('[data-guidance-source]').selectOption('overdue');
  await page.locator('[name=executionInstructions]').fill('قارن الكسرين.\nاكتب: 1 < 2 ثم فسّر إجابتك.');
  await page.locator('[name=deliveryInstructions]').fill('أحضر الحل في كراسة الرياضيات إلى الحصة القادمة.');
  await page.locator('[data-guidance] button[type=submit]').click();
  report.stage='ui-save-ack';await page.getByRole('status').filter({hasText:'حُفظت التعليمات وأُقرّ نشرها.'}).waitFor();
  assert.equal((await sources()).find(s=>s.subitemId==='overdue').revision,1);
  const sc=await createContext({viewport:{width:390,height:1000},locale:'ar-SA'}),sp=await sc.newPage();sp.setDefaultTimeout(12000);
  report.stage='ui-student';await sp.goto(review.studentUrl);await sp.locator('[data-claim] input').fill(code);await sp.locator('[data-claim] button').click();await sp.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();
  const task=sp.locator('[data-section=required] details').filter({hasText:'تطبيق مقارنة الكسور'});await task.locator('summary').click();
  assert.equal(await task.locator('.n88-guidance-text').first().innerText(),'قارن الكسرين.\nاكتب: 1 < 2 ثم فسّر إجابتك.');
  assert.match(await task.innerText(),/أحضر الحل/);assert.equal(await task.locator('script').count(),0);
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:1000});await sp.setViewportSize({width,height:1000});
   for(const p of [page,sp])assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await sp.locator('.n88-guidance-text').first().evaluate(e=>getComputedStyle(e).whiteSpace),'pre-wrap');
   await page.screenshot({path:`tests/fixtures/n88-task-guidance/teacher-${width}.png`,fullPage:true,mask:[page.locator('[data-code]')]});
   await sp.screenshot({path:`tests/fixtures/n88-task-guidance/student-${width}.png`,fullPage:true});
  }
  report.stage='ui-reload';await page.reload();await page.locator('[data-guidance-source]').waitFor({state:'attached'});await page.locator('.n88-task-guidance>summary').click();await page.locator('[data-guidance-source]').selectOption('overdue');assert.match(await page.locator('[name=executionInstructions]').inputValue(),/قارن/);
  await sp.reload();await sp.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();assert.match(await sp.locator('main').innerText(),/قارن/);
  report.stage='failed-save-draft';
  t.failGuidanceCommit('before');await page.locator('[name=executionInstructions]').fill('مسودة محفوظة عند فشل الحفظ');await page.locator('[data-guidance] button[type=submit]').click();await page.getByRole('status').filter({hasText:'تعذّر تأكيد النشر'}).waitFor();
  assert.equal(await page.locator('[name=executionInstructions]').inputValue(),'مسودة محفوظة عند فشل الحفظ');assert.equal((await sources()).find(s=>s.subitemId==='overdue').revision,1);
  report.stage='failed-save-after-commit';t.failGuidanceCommit('after');await page.locator('[data-guidance] button[type=submit]').click();await page.getByRole('status').filter({hasText:'تعذّر تأكيد النشر'}).waitFor();await page.locator('[data-guidance-revalidate]').waitFor();
  assert.equal(await page.locator('[name=executionInstructions]').inputValue(),'مسودة محفوظة عند فشل الحفظ');assert.equal((await sources()).find(s=>s.subitemId==='overdue').revision,2);
  report.stage='ui-expired-owner';await page.evaluate(()=>window.n88Fixture.expire());await page.locator('[data-guidance-refresh]').click();assert.equal(await page.locator('[name=executionInstructions]').count(),0);
  await page.reload();await page.locator('[data-guidance-source]').waitFor({state:'attached'});await page.evaluate(()=>window.n88Fixture.switchOwner());assert.equal(await page.locator('[name=executionInstructions]').count(),0);
 });
 pass('n88_task_guidance_actual_teacher_save_same_student_task_pg_ack_and_durability','Actual whole-app owner-bound teacher class client/service/restricted nativePG: both fields edited and saved, ACK then same canonical student task renders multiline text; teacher/student reload; failed precommit and lost postcommit ACK preserve draft and show uncertainty, committed state read back. 390/1280 source CSS screenshots with credential masks.');
 report.stage='durability';await t.restart();assert.equal((await sources()).find(s=>s.subitemId==='overdue').revision,2);assert.equal(await canonicalState(),before);
 let task=(await sources()).find(s=>s.subitemId==='overdue');
 report.stage='negatives';assert.equal((await save(task,{revision:0})).status,503);assert.equal((await save(task,{sourceStamp:'f'.repeat(64)})).status,503);
 for(const extra of [{executionInstructions:'<script>alert(1)</script>'},{deliveryInstructions:'<b>نص</b>'},{executionInstructions:'x'.repeat(401)},{deliveryInstructions:42},{unknown:true},{executionInstructions:'',deliveryInstructions:'',confirmClear:false}])assert.equal((await save(task,extra)).status,503);
 for(const [token,bind] of [[t.provider.token({sub:B}),{...binding,ownerId:B}],[t.provider.token(),{...binding,termId:'wrong'}],[t.provider.token(),{...binding,classId:'wrong'}],[t.provider.token({exp:1}),binding]])assert.equal((await teacher('guidance-list',{},token,bind)).status,401);
 const claim=await fetch(origin+'/api/n88/student/claim',{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1'},body:JSON.stringify({code})});assert.equal(claim.status,200);const cookie=claim.headers.get('set-cookie').split(';')[0];
 const student=async()=>{const r=await fetch(origin+'/api/n88/student/read',{headers:{cookie}});return {status:r.status,text:await r.text()};};
 assert.match((await student()).text,/مسودة محفوظة/);
 await publish({...fields,required:false});assert.ok(!(await student()).text.includes('مسودة محفوظة'));assert.equal((await save(task)).status,503);
 await publish(fields);assert.ok(!(await student()).text.includes('مسودة محفوظة'));task=(await sources()).find(s=>s.subitemId==='overdue');assert.equal(task.executionInstructions,'');assert.equal((await save(task)).status,200);
 await q("update rakeezx.score_subitems set revision=revision+1,name='مقارنة الكسور — نسخة جديدة' where id='overdue'");assert.ok(!(await student()).text.includes('قارن الكسرين'));assert.equal((await save(task)).status,503);
 await publish(fields);task=(await sources()).find(s=>s.subitemId==='overdue');assert.equal(task.needsRepublication,true);assert.equal((await save(task)).status,200);
 task=(await sources()).find(s=>s.subitemId==='overdue');assert.equal((await save(task,{executionInstructions:'',deliveryInstructions:'',confirmClear:true})).status,200);assert.ok(!(await student()).text.includes('قارن الكسرين'));
 await q("update rakeezx.score_subitems set deleted_at=now(),revision=revision+1 where id='overdue'");assert.ok(!(await student()).text.includes('قارن الكسرين'));assert.equal((await save(task)).status,503);
 await q("update rakeezx.enrollments set status='inactive',revision=revision+1 where id='enrollment'");assert.equal((await student()).status,401);assert.equal((await save(task)).status,503);
 for(const role of ['anon','authenticated']){await q('set role '+role);try{await assert.rejects(()=>q('select payload from n88_private.task_guidance'));}finally{await q('reset role');}}
 pass('n88_task_guidance_owner_source_cas_visibility_removal_plaintext_and_failedsave','Restricted PG restart durability; canonical scoring/tasks/completions unchanged by guidance writes; owner/class/term/expiry, stale source and CAS, unknown keys/type/markup/length/empty-confirm negatives. Hide/republication/revision/deletion/current enrollment omit text server-side; explicit clear tombstone; browser roles denied metadata. Original unchanged E/F/H safeguards reused.');
 report.stage='identities';const identities=(await q(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;
 assert.ok(identities.tables.some(x=>x.relname==='task_guidance'&&x.relrowsecurity));
 await writeFile('tests/fixtures/n88-task-guidance/expected-identities.json',JSON.stringify({sourceOnly:true,migrationVersions:['20261018034356','20261018102843','20261018110713','20261018114113','20261018115648','20261018125611'],identities},null,2)+'\n');
}catch(e){failed=true;report.failure={stage:report.stage,location:e.stack?.split('\n').find(x=>x.includes('n88-task-guidance.mjs:')),message:e?.code==='ERR_ASSERTION'?'Assertion failed; values omitted':String(e.message).replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]').split('\n')[0]};}
finally{await review?.close();report.cleanup.httpAndPgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-task-guidance.json',JSON.stringify(report,null,2)+'\n');}
console.log(failed?'N88 guidance FAIL; sanitized report':'N88 guidance focused checks PASS');if(failed)process.exitCode=1;
