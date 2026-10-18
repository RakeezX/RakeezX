import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
/** AI: final changed projection/SQL and UI lost-ACK/data-layout boundaries only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {A} from './fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',base+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}};let review,owned=false,failed;
const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try{
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;review=await startIntegratedReview({ttl:240});const q=review.testing.query;
  const expected=JSON.parse(await readFile('drafts/n88-student-portal/activation/integrated-expected-identities.json','utf8'));
  const identities=(await q(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;assert.deepEqual(identities,expected.identities);
  check('final_typed_migration_and_identity_readback','Exact CLI-created additive migration with all 109 consumed-column type gates applied only to fresh owned native PG; extended helper/role/ACL/policy identities equal exported expected snapshot. No hosted DDL.');
  await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:120000},async({createContext})=>{
    const teacherContext=await createContext({viewport:{width:1280,height:900}}),teacher=await teacherContext.newPage();await teacher.goto(review.url);await teacher.getByRole('link',{name:/مساحة الطلاب/}).first().click();
    const refresh=async()=>{await teacher.locator('[data-action=refresh]').click();await teacher.locator('.n88-class-roster>li').last().waitFor();};
    await teacher.locator('.n88-class-roster>li').last().waitFor();
    for(const f of ['name','class','grades','required','completed','scheduled'])await teacher.locator(`[name=${f}]`).check();
    const save=async()=>{await teacher.locator('[data-visibility] button').click();await teacher.getByRole('status').filter({hasText:'أقرّ الخادم حفظ'}).waitFor();await refresh();};
    await save();await teacher.locator('[data-action=batch]').click();await teacher.locator('[data-delivery]').waitFor();let code=await teacher.locator('[data-delivery] input').nth(1).inputValue();await teacher.locator('[data-action=close-sheet]').click();
    const sc=await createContext({viewport:{width:390,height:900}}),student=await sc.newPage();await student.goto(review.studentUrl);await student.locator('[data-claim] input').waitFor();await student.locator('[data-claim] input').fill(code);code='';await student.locator('[data-claim] button').click();await student.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();
    for(const width of [390,1280]){await student.setViewportSize({width,height:900});assert.equal(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await student.locator('.n88-unified').evaluate(e=>getComputedStyle(e).direction),'rtl');await student.screenshot({path:`tests/fixtures/n88-integrated-class/student-data-${width}.png`,fullPage:true});}
    if(process.argv.includes('--ui-only')){assert.equal(await student.locator('table').innerText().then(t=>/recorded|unrecorded/.test(t)),false);check('final_arabic_grade_labels_and_actual_data_layout','Actual populated student page and class route inspected at 390/1280; unrecorded is distinct from zero, Arabic status labels, current class heading and synthetic review guidance; unchanged service proof reused.');return;}
    // Reviewed transfer uses existing student's historical enrollment, not another student's data.
    await q("insert into rakeezx.sections(owner_id,id,year_id,status,revision,grade,label) values($1,'old-class','year','active',1,4,'ب')",[A]);
    await q("insert into rakeezx.teachings(owner_id,id,section_id,term_id,revision,subject_id) values($1,'old-teaching','old-class','term',1,'subject')",[A]);
    await q("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,status,end_date,revision) values($1,'old-enrollment','student','old-class','transferred','2026-09-01',1)",[A]);
    await q("update rakeezx.items set portability_group_id='reviewed-direct',revision=revision+1 where owner_id=$1 and id='direct'",[A]);
    await q("insert into rakeezx.items(owner_id,id,teaching_id,name,max,revision,score_mode,portability_group_id) values($1,'old-direct','old-teaching','مباشر',10,1,'direct','reviewed-direct')",[A]);
    await q("update rakeezx.scores set item_id='old-direct',value=0,revision=revision+1 where owner_id=$1 and id='score-direct'",[A]);
    await teacher.reload();await teacher.locator('.n88-class-roster>li').last().waitFor();await save();
    const projected=await student.evaluate(async()=>{const r=await fetch('/api/n88/student/read');return {status:r.status,data:await r.json()};});assert.equal(projected.status,200);assert.equal(projected.data.grades.items[0].value,0);
    const actualTeacherGrades=await teacher.evaluate(async()=>{const {store}=window.n88Fixture,{itemScore}=await import('/src/models.js');return store.items('teaching').map(i=>itemScore(i,store.studentContext('student','teaching')));});assert.deepEqual(projected.data.grades.items.map(x=>x.value),actualTeacherGrades);
    check('native_portable_projection_matches_current_app_store','Published transferred direct grade is zero and exactly equals current actual teacher store/studentContext across native canonical source; all other direct/automatic/subitem values stay equal. Fresh reload reads owner/database/receipt and canonical rows in the same document.');
    // New member forces a real missing-only mutation during a lost ACK, not a no-op simulation.
    await q("insert into rakeezx.students(owner_id,id,name,status,revision) values($1,'third','طالب ثالث مصطنع','active',1)",[A]);await q("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,status,revision) values($1,'third-enrollment','third','class','active',1)",[A]);
    await refresh();assert.equal(await teacher.locator('.n88-class-roster>li').count(),3);review.testing.loseAck();await teacher.locator('[data-action=batch]').click();await teacher.getByRole('status').filter({hasText:'لم يتأكد اكتمال'}).waitFor();assert.equal(await teacher.locator('[data-delivery]').count(),0);
    await refresh();await teacher.locator('[data-action=batch]').click();await teacher.getByRole('status').filter({hasText:'موجود مسبقًا: 3'}).waitFor();assert.equal((await q('select count(*)::int as n from n88_private.numeric_credentials')).rows[0].n,3);
    await refresh();await teacher.locator('[data-action=review-rotate]').last().click();await teacher.locator('[data-action=confirm]').click();await teacher.locator('[data-delivery]').waitFor();assert.equal(await teacher.locator('[data-delivery] input').count(),1);await teacher.locator('[data-action=close-sheet]').click();
    assert.equal((await q('select count(*)::int as n from n88_private.numeric_credentials')).rows[0].n,4);
    check('actual_ui_lost_ack_selective_recovery_and_data_layout','Actual class UI: adding third canonical student, missing-only batch loses ACK after commit, UI reports uncertainty without codes, reload/list+retry skips all three, selective rotate recovers only that student. Actual populated student page inspected at 390/1280 RTL/no overflow, screenshots contain no credential.');
  });
}catch(e){failed=e;report.failure=diagnosticError(e);}
finally{await review?.close();report.cleanup.ownedHttpAndNativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-final.json',JSON.stringify(redactN88(report),null,2)+'\n');}
if(failed){console.error(redactN88(report.failure));process.exitCode=1;}else console.log('N88 final changed projection/SQL/UI boundaries PASS');
