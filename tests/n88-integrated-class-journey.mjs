import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
/** AI: affected whole-app/native-PG journey; all identities/data are fabricated. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45';
const canonical='C:/Users/Abody/Projects/RakeezX',taskFile=canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{},failures:[]};let review,owned=false,failed;
const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
try {
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  review=await startIntegratedReview({ttl:180});
  await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:120000},async({createContext})=>{
    const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'}),page=await context.newPage();
    const errors=[];report.pageErrors=errors;page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)(report.resourceErrors??=[]).push({path:new URL(r.url()).pathname,status:r.status()});});
    report.stage='hub';
    await page.goto(review.url);await page.getByRole('link',{name:/مساحة الطلاب/}).first().waitFor();
    assert.equal(await page.locator('.layout').count(),1);report.stage='class';
    await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();
    await page.locator('.n88-class-roster>li').last().waitFor();assert.equal(await page.locator('.n88-class-roster>li').count(),2);
    assert.equal(await page.locator('[data-visibility] input:checked').count(),0);
    for(const f of ['name','class','grades','required','completed','scheduled'])await page.locator(`[name=${f}]`).check();
    await page.locator('[data-visibility] button').click();await page.getByRole('status').filter({hasText:'أقرّ الخادم حفظ'}).waitFor();
    report.stage='visibility';
    const refresh=async()=>{await page.locator('[data-action=refresh]').click();await page.locator('.n88-class-roster>li').last().waitFor();};
    await refresh();await page.locator('[data-action=batch]').click();await page.locator('[data-delivery]').waitFor();
    report.stage='batch';
    let codes=await page.locator('[data-delivery] input').evaluateAll(els=>els.map(e=>e.value));
    assert.ok(codes.length===2&&codes.every(c=>/^1[0-9]{5}$/.test(c))&&codes[0]!==codes[1]);
    await page.evaluate(()=>{window.__n88CopyValid=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__n88CopyValid=text.split('\n').filter(Boolean).every(row=>/^1[0-9]{5}$/.test(row.split(': ').at(-1)));}}});});
    await page.locator('[data-action=copy]').click();assert.equal(await page.evaluate(()=>window.__n88CopyValid),true);
    // Sorted roster: other, student. Secrets remain test-memory only, never persisted or photographed.
    await page.locator('[data-action=close-sheet]').click();await refresh();
    await page.locator('[data-action=batch]').click();await page.getByRole('status').filter({hasText:'موجود مسبقًا: 2'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
    report.stage='students';
    const students=[];
    for(const code of codes){const c=await createContext({viewport:{width:390,height:900}}),p=await c.newPage();await p.goto(review.studentUrl);await p.locator('[data-claim] input').waitFor();assert.equal(await p.locator('[data-claim] input').getAttribute('maxlength'),'6');assert.equal(await p.locator('[data-claim] input').getAttribute('pattern'),'1[0-9]{5}');await p.locator('[data-claim] input').evaluate(el=>{const data=new DataTransfer();data.setData('text','1'+'234567');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});assert.equal(await p.locator('[data-claim] input').inputValue(),'');await p.locator('[data-claim] input').fill(code);await p.locator('[data-claim] button').click();try{await p.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor({timeout:10000});}catch(e){report.studentFailure={text:await p.locator('main').innerText(),calls:review.testing.calls.slice(-8)};throw e;}students.push({context:c,page:p});}
    const p=students[1].page,other=students[0].page;
    assert.match(await p.locator('main').innerText(),/طالب اصطناعي/);assert.ok(!(await p.locator('main').innerText()).includes('OTHER_NAME'));
    assert.match(await other.locator('main').innerText(),/OTHER_NAME/);
    const data=await p.evaluate(async()=>{const r=await fetch('/api/n88/student/read',{cache:'no-store'});return r.json();});
    assert.deepEqual(data.grades.items.map(x=>x.value),[8,0,null,4,8,4]);
    assert.deepEqual(data.work.completed.map(x=>x.completionState),['regular','late']);assert.equal(data.work.required.length,1);assert.equal(data.work.scheduled.length,1);
    assert.ok(!/ownerId|studentId|enrollmentId|PRIVATE_NOTE|OTHER_NAME/.test(JSON.stringify(data)));
    assert.match(await p.locator('[data-section=scheduled]').innerText(),/2026-10-20/);
    assert.deepEqual(await p.evaluate(async()=>({local:{...localStorage},session:{...sessionStorage},caches:await caches.keys(),dbs:await indexedDB.databases(),cookie:document.cookie})),{local:{},session:{},caches:[],dbs:[],cookie:''});
    await p.reload();await p.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();
    await refresh();for(const f of ['name','class','grades','required','completed','scheduled'])await page.locator(`[name=${f}]`).uncheck();
    await page.locator('[data-visibility] button').click();await page.getByRole('status').filter({hasText:'أقرّ الخادم حفظ'}).waitFor();
    const hidden=await p.evaluate(async()=>{const r=await fetch('/api/n88/student/read');return r.json();});assert.deepEqual(hidden,{version:'n88-student-v3'});
    await refresh();await page.locator('[data-action=review-rotate]').nth(1).click();await page.locator('[data-action=confirm]').click();await page.locator('[data-delivery]').waitFor();
    codes[1]=await page.locator('[data-delivery] input').inputValue();await page.locator('[data-action=close-sheet]').click();
    assert.equal(await p.evaluate(async()=>(await fetch('/api/n88/student/read')).status),401);
    assert.equal(await other.evaluate(async()=>(await fetch('/api/n88/student/read')).status),200);
    await p.reload();await p.locator('[data-claim] input').fill(codes[1]);await p.locator('[data-claim] button').click();await p.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();
    await refresh();await page.locator('[data-action=review-revoke]').nth(1).click();await page.locator('[data-action=confirm]').click();await page.getByRole('status').filter({hasText:'أُقرّ إلغاء'}).waitFor();
    assert.equal(await p.evaluate(async()=>(await fetch('/api/n88/student/read')).status),401);
    await refresh();await page.locator('[data-action=batch]').click();await page.getByRole('status').filter({hasText:'أُنشئ: 0'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
    for(const width of [390,1280]){await page.setViewportSize({width,height:900});await refresh();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.n88-class').evaluate(el=>getComputedStyle(el).direction),'rtl');await page.screenshot({path:`tests/fixtures/n88-six-digit/class-${width}.png`,fullPage:true});await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:`tests/fixtures/n88-six-digit/student-${width}.png`,fullPage:true});}
    const before=review.testing.calls.length;await page.evaluate(()=>window.n88Fixture.expire());await page.locator('[data-action=batch]').click();await page.getByRole('status').filter({hasText:/لم يتأكد|غير مفعّلة/}).waitFor();assert.equal(review.testing.calls.length,before);
    assert.deepEqual(errors,[]);codes=[];
    check('n88_actual_app_class_batch_to_universal_student_same_service_pg_journey','Actual app shell/hash route/store and account lease guard; two students batch/skip, universal numeric login through signed gateway/Auth/restricted native PG, reload, 390/1280 source CSS/screenshots. No credentials retained.');
    check('n88_canonical_projection_visibility_score_task_and_current_identity_isolation','Canonical teacher-model grades [8,0,null,4,8,4], regular/late/required/future work, own profile and other student isolation; server hides all six fields; selective rotation/revocation kills only target sessions; revoked batch does not resurrect. Lease expiry denies before network.');
  });
}catch(e){failed=e;report.failures.push(diagnosticError(e));}
finally{await review?.close();report.cleanup.ownedHttpAndNativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-journey.json',JSON.stringify(redactN88(report),null,2)+'\n');}
if(failed){console.error(redactN88(report.failures));process.exitCode=1;}else console.log('N88 integrated actual app journey PASS');
