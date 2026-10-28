// AI-authored: actual app route, owner guard, view/client and source CSS; synthetic ports only.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {start} from './server.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-content-priority-after-n130-20261027',runId='87b53fe5-2574-46b3-86e5-35363518d70b';
const taskFile=`${canonical}/artifacts/ops-supervisor-v4/queue/${taskId}.json`,dir='tests/n88-portal-content-priority-20261027';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],matrix:[],cleanup:{}};let owned=false,server,stage='lease';
const payload={version:'n88-student-v3',profile:{name:'طالب مصطنع',classLabel:'الفصل المصطنع'},grades:{items:[{id:'g',label:'درجة منشورة',value:0,max:10,status:'recorded'}]},work:{required:[{id:'r',title:'مهمة مطلوبة بعنوان عربي طويل لاختبار التفاف الكلمات وإظهار النص كاملًا',executionInstructions:'اقرأ الدرس ثم أجب عن الأسئلة.\nاكتب تفسيرك في سطرين.',deliveryInstructions:'سلّم الكراسة للمعلم في الفصل.\nلا يلزم رفع ملف.',startDate:'2026-10-20',dueDate:'2026-10-29',completionState:'unrecorded'}],scheduled:[{id:'s',title:'عمل قادم',executionInstructions:'راجع الأمثلة.',deliveryInstructions:'أحضر ورقة الإجابة.',startDate:'2026-11-01',dueDate:'2026-11-04',completionState:'unrecorded'}],completed:[{id:'c',title:'عمل مكتمل',completionState:'regular'}]},private:'UNPUBLISHED_PRIVATE'};
async function geometry(page,selector){return page.evaluate(selector=>({overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth;})}),selector);}
async function teacher(page,count){
 await page.goto(server.url);await page.waitForFunction(()=>!!window.compactFixture);
 await page.evaluate(count=>{const f=window.compactFixture,base=f.roster.students[0];f.roster.credentialRevision='e'.repeat(64);f.roster.reconciliation=[];f.roster.students=Array.from({length:count},(_,i)=>({...base,studentId:'fake-'+i,enrollmentId:'ef-'+i,label:`طالب مصطنع ${i+1} عبد الرحمن محمد عبد الله\nاسم طويل للفحص`,credential:i===count-1?null:String(100001+i),hasActiveCode:i!==count-1,credentialVersion:i===count-1?0:1,recoveryStatus:i===count-1?'inactive':'recoverable'}));},count);
 await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await page.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false'&&document.querySelector('.n88-class-roster'));
 assert.equal(await page.locator('.n88-class-roster>li').count(),count);
 assert.equal(await page.locator('[data-action=batch]').isEnabled(),true);
 assert.equal(await page.locator('[data-action=batch]').count(),1);
 assert.equal(await page.locator('.n88-class-roster').evaluate(e=>e.getBoundingClientRect().top<innerHeight-100),true);
}
async function student(page,data=payload){
 await page.goto(server.url);await page.waitForFunction(()=>!!window.compactFixture);
 await page.evaluate(async data=>{
  const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');
  const {createUnifiedStudentPortalClient}=await import('/src/lib/student-portal-unified-client.js');
  document.querySelector('#app')?.remove();const root=document.createElement('div');document.body.replaceChildren(root);
  window.studentPayload=data;window.studentDelay=false;window.studentCalls=[];
  window.studentClient=createUnifiedStudentPortalClient({fetch:async(url)=>{window.studentCalls.push(url);const snapshot=structuredClone(window.studentPayload);if(window.studentDelay)await new Promise(r=>window.releaseStudent=r);return {ok:true,status:200,headers:new Headers(),json:async()=>snapshot};}});
  window.studentHandle=mountUnifiedStudentPortal(root,{client:window.studentClient,readiness:{enabled:true}});await window.studentHandle.ready;
 },data);
 await page.locator('.n88-unified-profile').waitFor();
}
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url,timeoutMs:120000},async({createContext})=>{
  if(!process.env.N88_GUARDS_ONLY)for(const theme of ['light','dark'])for(const width of [320,390,768,1280]){
   stage=`matrix ${theme} ${width}`;const c=await createContext({viewport:{width,height:1000},colorScheme:theme}),p=await c.newPage();p.setDefaultTimeout(10000);p.on('requestfailed',r=>report.requestFailures=(report.requestFailures||[]).concat(new URL(r.url()).pathname+':'+r.failure()?.errorText));p.on('console',m=>{if(m.type()==='error')report.consoleErrors=(report.consoleErrors||[]).concat(m.text());});p.on('pageerror',e=>report.pageErrors=(report.pageErrors||[]).concat(e.message));p.on('response',r=>{if(r.status()>=400)report.httpErrors=(report.httpErrors||[]).concat(new URL(r.url()).pathname+':'+r.status());});
   for(const count of [1,30,50]){await teacher(p,count);await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.deepEqual(await geometry(p,'.n88-class button,.n88-class summary'),{overflow:false,targets:true});
    if(count===50&&[320,1280].includes(width))await p.screenshot({path:`${dir}/teacher-${width}-${theme}-roster.png`,fullPage:false,mask:[p.locator('[data-code] input')]});
    await p.locator('[data-action=open-guidance]').focus();await p.keyboard.press('Enter');await p.locator('[data-guidance-source]').waitFor();assert.equal(await p.locator('.n88-task-guidance').evaluate(e=>e.open),true);assert.equal(await p.locator('.n88-task-guidance>summary').evaluate(e=>e===document.activeElement),true);
    await p.locator('[data-action=open-settings]').click();assert.equal(await p.locator('.n88-class-settings').evaluate(e=>e.open),true);assert.deepEqual(await geometry(p,'.n88-class button,.n88-class summary,.n88-class textarea,.n88-class select'),{overflow:false,targets:true});
    if(count===50&&[320,1280].includes(width))await p.screenshot({path:`${dir}/teacher-${width}-${theme}.png`,fullPage:false,mask:[p.locator('[data-code] input')]});
   }
   await student(p);await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.locator('link[href*="student-portal-login.css"]').evaluate(e=>new Promise(resolve=>e.sheet?resolve():e.addEventListener('load',resolve,{once:true})));
   assert.deepEqual(await p.locator('.n88-unified-sections>section').evaluateAll(es=>es.map(e=>e.dataset.section||'grades')),['required','scheduled','grades','completed']);
   for(const key of ['required','scheduled']){const task=p.locator(`[data-section=${key}] article`);assert.equal(await task.locator('details').count(),0);assert.equal(await task.locator('.n88-guidance-text').count(),2);for(const value of [payload.work[key][0].executionInstructions,payload.work[key][0].deliveryInstructions,payload.work[key][0].dueDate,payload.work[key][0].startDate,'لم يُرصد إنجاز'])assert.equal((await task.innerText()).includes(value),true);for(const el of await task.locator('h3,p').all())assert.equal(await el.isVisible(),true);}
   const positions=await p.locator('.n88-unified-sections>section').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
   assert.equal(await p.locator('.n88-unified').innerText().then(t=>t.includes('UNPUBLISHED_PRIVATE')),false);
   assert.deepEqual(await geometry(p,'.n88-unified button,.n88-unified summary'),{overflow:false,targets:true});
   await p.locator('[data-read]').focus();await p.keyboard.press('Tab');assert.equal(await p.locator('[data-end]').evaluate(e=>e===document.activeElement),true);
   if([320,1280].includes(width))await p.screenshot({path:`${dir}/student-${width}-${theme}.png`,fullPage:true});
   report.matrix.push({theme,width,students:[1,30,50],teacher:'PASS',student:'PASS'});await c.close();
  }
  stage='teacher safeguards';const c=await createContext({viewport:{width:390,height:1000}}),p=await c.newPage();p.setDefaultTimeout(7000);await teacher(p,30);
  await p.locator('[data-action=copy-student]').first().click();assert.equal(await p.evaluate(()=>/^1[0-9]{5}$/.test(window.compactFixture.copied)),true);
  await p.locator('[data-action=share-student]').first().click();assert.equal(await p.evaluate(()=>window.compactFixture.shared===window.compactFixture.copied&&window.compactFixture.shared.includes('/student')),true);
  await p.locator('[data-action=review-rotate]').first().click();assert.equal(await p.locator('[data-code]').count(),0);assert.equal(await p.locator('[data-action=confirm]').evaluate(e=>e===document.activeElement),true);assert.equal(await p.evaluate(()=>window.compactFixture.calls.some(c=>c.action==='rotate')),false);
  await p.locator('[data-action=cancel]').click();await p.locator('[data-code]').first().waitFor();assert.equal(await p.locator('[data-action=review-rotate]').first().evaluate(e=>e===document.activeElement),true);
  await p.locator('[data-action=review-revoke]').first().click();await p.locator('[data-action=confirm]').click();await p.waitForFunction(()=>window.compactFixture.calls.some(c=>c.action==='revoke')&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  await p.locator('[data-action=review-rotate]').nth(1).click();await p.locator('[data-action=confirm]').click();await p.waitForFunction(()=>window.compactFixture.calls.some(c=>c.action==='rotate')&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  await p.locator('[data-action=open-guidance]').click();await p.locator('[name=executionInstructions]').fill('تعليمات مصطنعة معدلة');await p.locator('[data-guidance] [type=submit]').click();await p.waitForFunction(()=>window.compactFixture.calls.some(c=>c.action==='guidance-save')&&!document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')?.includes('true'));
  await p.locator('[data-action=open-settings]').click();await p.locator('[name=grades]').check();await p.locator('[data-visibility] [type=submit]').click();await p.waitForFunction(()=>window.compactFixture.roster.visibility.grades);
  stage='unconfirmed operation recovery';await p.evaluate(()=>window.compactFixture.failNext=true);await p.locator('[data-action=review-rotate]').nth(1).click();await p.locator('[data-action=confirm]').click();await p.locator('[data-action=refresh]').waitFor();assert.equal(await p.locator('[data-code]').count(),0);const mutationCount=await p.evaluate(()=>window.compactFixture.calls.filter(c=>['rotate','revoke','issue-missing'].includes(c.action)).length);await p.locator('[data-action=refresh]').click();await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);assert.equal(await p.evaluate(()=>window.compactFixture.calls.filter(c=>['rotate','revoke','issue-missing'].includes(c.action)).length),mutationCount);
  await p.evaluate(()=>{window.compactFixture.delay=180;window.compactFixture.handle.refresh();window.n88Fixture.switchOwner();window.compactFixture.notify();});await p.waitForTimeout(240);assert.equal(await p.locator('[data-code],[data-manual],[name=executionInstructions]').count(),0);assert.equal(await p.evaluate(()=>{try{window.compactFixture.getBinding(false);return false;}catch{return true;}}),true);
  stage='student retirement';await student(p);await p.evaluate(()=>{window.studentDelay=true;window.studentHandle.refresh();});await p.waitForFunction(()=>!!window.releaseStudent);await p.evaluate(()=>{window.studentClient.invalidate('context');window.releaseStudent();});await p.waitForTimeout(100);assert.equal(await p.locator('.n88-unified-profile,[data-work-id],.n88-unified-grades').count(),0);
  stage='publication omission and empty';await student(p,{version:'n88-student-v3',profile:{name:'مصطنع'},work:{required:[],scheduled:[],completed:[]}});assert.equal(await p.locator('.n88-unified-sections>section').count(),0);assert.equal(await p.locator('.n88-unified-empty').count(),1);assert.equal(await p.locator('.n88-unified-grades').count(),0);
  await p.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await p.locator('.n88-unified-profile').count(),0);await c.close();
 });
 report.checks=[{name:'n88_teacher_first_screen_accessible_actions_and_roster',status:'PASS',evidence:'24 real app route/owner-client roster cases; primary action, direct editor navigation, keyboard focus; 1/30/50 synthetic students.'},{name:'n88_student_required_instructions_and_due_dates_visible',status:'PASS',evidence:'8 actual student view/client/CSS cases: published required/scheduled instructions, delivery, dates/status visible; DOM/visual order required, scheduled, grades, completed; one minimal empty state.'},{name:'n88_published_data_privacy_session_and_owner_mutation_guards',status:'PASS',evidence:'Actual teacher owner guard denies/wipes after context change and delayed read; copy/share, confirmed rotate/revoke and cancel focus, guidance/visibility handlers. Actual student client retirement rejects delayed old response; omitted grades absent; pagehide wipe.'},{name:'n88_mobile_rtl_keyboard_dom_visual_order',status:'PASS',evidence:'320/390/768/1280, light/dark: no horizontal overflow, 44px controls, RTL, DOM/visual order and keyboard navigation. Screenshots in same directory.'}];
if(process.env.N88_GUARDS_ONLY)report.checks=[{name:'n88_published_data_privacy_session_and_owner_mutation_guards',status:'PASS',evidence:'Targeted guard run: copy/share, confirmed rotate/revoke and cancel focus, guidance/visibility handlers; failed mutation wipes secrets, review does not replay and batch stays disabled; actual owner guard and delayed student context retirement remove private DOM; omitted grades/empty and pagehide.'}];
}catch(e){report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{await server?.close();report.cleanup.serverClosed=true;if(owned)report.cleanup.integrationLease=lease('release');await writeFile(`${dir}/${report.failure?'failure-'+Date.now():process.env.N88_GUARDS_ONLY?'guards-result':'result'}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
