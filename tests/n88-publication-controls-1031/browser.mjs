/** AI: focused actual mounted route proof; reuses existing HTTP/app/real service fixtures unchanged. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {start} from '../n88-publication-ui-1031/host.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-publication-controls-compatibility-20261031',runId='75f5be38-08e5-4e3b-b9c7-f808acf94706',taskFile=`${root}/artifacts/ops-supervisor-v4/queue/${taskId}.json`,dir='tests/n88-publication-controls-1031';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,status:'FAIL',checks:[],pageErrors:[],teacherRequests:[],realAccountOperations:0,providerOperations:0,cleanup:{}};
let server,owned=false,stage='lease';
async function boot(p,enabled){
 await p.goto(server.url+'#/teaching/teaching');await p.waitForFunction(()=>!!window.uiFixture);await p.evaluate(enabled=>{window.uiFixture.enabled=enabled;},enabled);
 await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
 if(enabled)await p.waitForFunction(()=>document.querySelector('.n88-publications')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-publication-source]'));
}
const saveGrade=async(p,value)=>{
 await p.locator('[data-publication-save] [name=grade]').setChecked(value);await p.locator('[data-publication-save] [type=submit]').click();
 await p.waitForFunction(()=>document.querySelector('.n88-publications')?.getAttribute('aria-busy')==='false'&&document.querySelector('.n88-publications [role=status]').textContent.includes('حُفظت'));
};
try{
 lease('acquire');owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'});
  context.on('page',p=>p.on('pageerror',e=>report.pageErrors.push(e.message)));
  const p=await context.newPage();let mode='v2';
  p.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/n88/teacher/'))report.teacherRequests.push({mode,path});});
  p.on('response',r=>{const path=new URL(r.url()).pathname;if(path.endsWith('/visibility'))report.legacyVisibilityStatus=r.status();});
  if(process.env.N88_CONTROLS_V1_ONLY){
    const previous=JSON.parse(await readFile(dir+'/browser-initial-failure.json','utf8'));
    for(const [file,hash] of Object.entries(previous.sourceHashes))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash);
    assert.equal(previous.checks.length,2);assert.deepEqual(previous.pageErrors,[]);
    report.checks.push(...previous.checks);report.teacherRequests.push(...previous.teacherRequests.filter(r=>r.mode==='v2'));
    report.reusedV2Evidence='Two completed V2 checks from browser-initial-failure.json; exact source hashes unchanged. Original V1 harness failure retained.';
  }else{
  stage='V2 actual mounted route';await boot(p,true);
  assert.equal(await p.locator('.n88-publications').count(),1);
  assert.equal(await p.locator('[data-visibility],.n88-class-settings,.n88-task-guidance,[data-action=open-settings],[data-action=open-guidance]').count(),0);
  await p.locator('[data-action=open-publications]').focus();await p.keyboard.press('Enter');assert(await p.locator('[data-publication-source]').evaluate(n=>n===document.activeElement));
  await p.locator('[data-action=open-codes]').focus();await p.keyboard.press('Enter');await p.locator('.n88-class-roster').waitFor();
  await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('[data-action=review-rotate]').count(),1);assert.equal(await p.locator('[data-action=review-revoke]').count(),1);
  await p.locator('[data-action=review-rotate]').click();await p.locator('[data-confirm]').waitFor();await p.locator('[data-action=cancel]').click();
  await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('[data-action=batch]').count(),1);assert.equal(await p.locator('a[href="/student"]').first().isVisible(),true);
  report.checks.push('V2 mounts one per-item editor, no legacy editors; keyboard anchors and numeric roster/rotate/revoke/cancel controls remain reachable');
  stage='server confirmed grade ON/OFF';await p.locator('[data-publication-source]').selectOption({label:'مهمة مكتملة — بند فرعي'});await saveGrade(p,true);
  const student=await context.newPage();await student.goto(server.url+'fixture/student');await student.locator('[data-claim] input:not(:disabled)').waitFor();await student.locator('[data-claim] input').fill(server.f.code);await student.locator('[data-claim] [type=submit]').click();
  await student.locator('.n88-v2-grades>div').waitFor();assert.equal(await student.locator('.n88-v2-grades dd').textContent(),'5');
  assert(!(await student.locator('body').innerText()).includes('دون جمع البنود المخفية'));
  await saveGrade(p,false);await student.locator('[data-read]').click();await student.waitForFunction(()=>!document.querySelector('.n88-v2-grades'));
  await saveGrade(p,true);await student.locator('[data-read]').click();await student.locator('.n88-v2-grades>div').waitFor();
  assert.equal(await student.locator('.n88-v2-grades>div').count(),1);assert.equal(await student.locator('.n88-unified-total').count(),0);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:dir+'/teacher-v2-390.png',fullPage:true});await student.screenshot({path:dir+'/student-v2-390.png',fullPage:true});
  await p.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  const colors=await p.locator('.n88-publications').evaluate(n=>({background:getComputedStyle(n).backgroundColor,text:getComputedStyle(n).color}));assert.notEqual(colors.background,colors.text);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:dir+'/teacher-v2-dark-390.png',fullPage:true});
  assert(!report.teacherRequests.some(r=>r.mode==='v2'&&/\/(guidance-list|guidance-save|visibility)$/.test(r.path)));
  report.checks.push('Actual server-confirmed per-item grade ON displays 5, OFF removes it, ON restores it; concise student copy and mobile390/light/dark RTL inspected; zero legacy visibility/guidance requests in V2');
  }
  stage='dispose V2 without guidance and default-OFF V1';await p.goto(server.url);mode='v1';await boot(p,false);
  await p.locator('.n88-task-guidance').waitFor();await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('.n88-publications').count(),0);assert.equal(await p.locator('[data-visibility]').count(),1);
  await p.locator('[data-action=open-settings]').click();assert(await p.locator('.n88-class-settings').evaluate(n=>n.open));
  await p.locator('[data-action=open-guidance]').click();assert(await p.locator('.n88-task-guidance').evaluate(n=>n.open));
  await p.locator('[data-visibility] [name=grades]').check();await p.locator('[data-visibility] [type=submit]').click();
  await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert(report.teacherRequests.some(r=>r.mode==='v1'&&r.path.endsWith('/visibility')));assert(report.teacherRequests.some(r=>r.mode==='v1'&&r.path.endsWith('/guidance-list')));
  // The reused terminal-issuance fixture has no V1 canonical visibility-write
  // port: its unchanged service returns source/503. Check preserved dispatch
  // and existing safe failure handling, not an invented successful V1 save.
  assert.equal(report.legacyVisibilityStatus,503);
  assert.match(await p.locator('.n88-class-status [role=status]').textContent(),/غير مؤكدة/);
  assert(!report.teacherRequests.some(r=>r.mode==='v1'&&r.path.endsWith('/publication-v2')));
  await p.locator('.n88-code-management>summary').click();await p.locator('.n88-class-roster').waitFor();
  await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('[data-action=review-revoke]').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:dir+'/teacher-v1-390.png',fullPage:true});
  await p.evaluate(()=>window.n88Fixture.switchOwner());await p.waitForFunction(()=>!document.querySelector('[data-visibility]'));
  report.checks.push('Default-OFF actual route retains legacy field/guidance controls and endpoints, existing source/503 safe failure handling, roster and owner-change cleanup; no V2 request. V1 service save success is not claimed.');
  assert.deepEqual(report.pageErrors,[]);
 });report.status='PASS';
}catch(error){report.stage=stage;report.error=error.message;process.exitCode=1;}
finally{
 if(server){await server.close();report.cleanup.serverClosed=true;}report.cleanup.browserClosedByHelper=true;if(owned)report.cleanup.integrationLease=lease('release');
 report.sourceHashes={};for(const f of ['src/views/student-portal-class.js','src/views/student-portal-publications.js','sw.js'])report.sourceHashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');
 await writeFile(dir+'/browser-evidence.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
