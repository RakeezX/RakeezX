/** AI-authored: actual app HTTP route/runtime/client/source CSS, fabricated account and service. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {start} from './server.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-teacher-issuance-review-and-content-hub-20261028',runId='dcf225dd-076a-47fc-91c7-404b3dd31ec7';
const taskFile=`${canonical}/artifacts/ops-supervisor-v4/queue/${taskId}.json`,dir='tests/n88-teacher-issuance-ux-20261028';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,providerOperations:0,realAccountReads:0,realAccountMutations:0,matrix:[],checks:[],pageErrors:[],cleanup:{}};let server,owned=false,stage='lease';
let fixtureNumber=0;
async function boot(p,config={}){
 // Each independent fabricated scenario starts from empty synthetic-only storage.
 if(new URL(p.url()).origin===new URL(server.url).origin)await p.evaluate(()=>localStorage.clear());
 await p.goto(server.url.replace('/#','/?fixture='+(++fixtureNumber)+'#'));await p.waitForFunction(()=>!!window.compactFixture);
 await p.evaluate(config=>{
  const f=window.compactFixture;Object.assign(f,config);
  if(config.count!==undefined)f.roster.students=Array.from({length:config.count},(_,i)=>({...f.roster.students[0],studentId:'synthetic-'+i,enrollmentId:'synthetic-enrollment-'+i,label:'طالب مصطنع '+i}));
  if(config.mixed){Object.assign(f.roster.students[0],{hasActiveCode:true,credential:'123456',credentialVersion:1,recoveryStatus:'recoverable'});Object.assign(f.roster.students[1],{hasActiveCode:false,credential:null,credentialVersion:2,recoveryStatus:'inactive'});Object.assign(f.roster.students[2],{hasActiveCode:true,credential:null,credentialVersion:1,recoveryStatus:'legacy'});}
 },config);
 await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();
 try{await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');}catch(e){const d=await p.evaluate(async()=>({entry:document.querySelector('[data-n88-entry-state]')?.dataset.n88EntryState,diagnostic:(await import('/src/lib/student-portal-runtime.js')).studentPortalDiagnostic(),actions:window.compactFixture.calls.map(c=>({action:c.action,reconcile:c.body.reconcile?.length})),hintRows:JSON.parse(localStorage.getItem(window.compactFixture.hintKey)||'null')?.rows.length}));throw Error('boot: '+JSON.stringify(d),{cause:e});}
 await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false'&&(document.querySelector('[data-guidance-source]')||document.querySelector('[data-guidance-refresh]')));
}
const reads=p=>p.evaluate(()=>window.compactFixture.calls.filter(x=>x.action==='list').length);
const mutations=p=>p.evaluate(()=>window.compactFixture.calls.filter(x=>!['list','guidance-list'].includes(x.action)).length);
async function expand(p){await p.locator('.n88-code-management>summary').click();await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false'&&document.querySelector('.n88-code-management')?.open&&document.querySelector('.n88-class-roster'));}
async function geometry(p){return p.evaluate(()=>({rtl:getComputedStyle(document.querySelector('.n88-class')).direction==='rtl',overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('.n88-class button,.n88-class summary,.n88-class textarea,.n88-class select')].filter(e=>e.checkVisibility()).every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth;})}));}
async function unknown(p){
 assert.equal(await p.locator('.n88-code-management').evaluate(e=>e.open),false);
 assert.equal(await p.locator('.n88-class-roster,[data-code],[data-manual]').count(),0);
 assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);
 assert.equal(await p.locator('[data-action=close-unknown]').count(),0);
 assert.equal(await p.locator('.n88-class-status').innerText().then(t=>t.includes('نجاح قراءة القائمة لا يؤكد إنشاء الرموز')),true);
 assert.equal(await p.locator('[data-guidance-source] option').count(),2);
 assert.match(await p.locator('[data-guidance-source] option').nth(1).textContent(),/تحتاج إعادة نشر/);
 assert.equal(await mutations(p),0);
 const before=await reads(p),hint=await p.evaluate(()=>localStorage.getItem(window.compactFixture.hintKey));
 await p.locator('[data-action=refresh]').click();await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
 assert.equal(await reads(p),before+1);assert.equal(await mutations(p),0);
 assert.equal(await p.evaluate(()=>localStorage.getItem(window.compactFixture.hintKey)),hint);
 assert.equal(await p.evaluate(()=>JSON.parse(document.querySelector('[data-n88-list-response]').dataset.n88ListResponse).region),'ap-south-1');
 const states=await p.evaluate(async()=>{const m=await import('/src/lib/student-portal-class-client.js');return [m.classResponseStage(200,new Headers({'x-n88-service-stage':'source'})),m.classListRegion('unsafe arbitrary text')];});assert.deepEqual(states,['none','unknown']);
 await expand(p);assert.equal(await p.locator('.n88-class-roster>li').count(),28);assert.equal(await p.locator('[data-code]').count(),0);
 assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);
 await p.locator('[data-action=batch]').dispatchEvent('click');assert.equal(await mutations(p),0);
}
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url,timeoutMs:120000},async({createContext})=>{
  if(process.env.N88_GUARDS_ONLY){const saved=JSON.parse(await readFile(`${dir}/matrix-result.json`,'utf8'));for(const [path,hash] of Object.entries(saved.sourceHashes))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash);report.matrix=saved.matrix;report.matrixReuse='matrix-result.json';}
  if(!process.env.N88_GUARDS_ONLY)for(const theme of ['light','dark'])for(const width of [320,390,768,1280]){
   stage=`matrix-${theme}-${width}`;const c=await createContext({viewport:{width,height:1000},colorScheme:theme}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>report.pageErrors.push(e.message));
   await boot(p,{seedUnknown:true});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await unknown(p);
   assert.deepEqual(await geometry(p),{rtl:true,overflow:false,targets:true});
   await p.locator('.n88-code-management>summary').click();await p.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.equal(await p.locator('.n88-class-roster,[data-code]').count(),0);
   const order=await p.evaluate(()=>['.n88-class-settings','.n88-task-guidance','.n88-code-management'].map(q=>document.querySelector(q).getBoundingClientRect().top));assert.deepEqual(order,[...order].sort((a,b)=>a-b));
   await p.locator('[data-action=open-guidance]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.n88-task-guidance>summary').evaluate(e=>e===document.activeElement),true);
   await p.screenshot({path:`${dir}/teacher-${width}-${theme}.png`,fullPage:true});
   report.matrix.push({width,theme,reportedSynthetic28:'PASS',rtl:true,overflow:false});await c.close();
  }
  const c=await createContext({viewport:{width:390,height:1000}}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>report.pageErrors.push(e.message));
  stage='missing revision independent from terminal capability';await boot(p,{missingRevision:true,terminal:true});
  assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);assert.equal(await p.locator('[data-action=close-unknown]').count(),0);assert.match(await p.locator('.n88-class-status').innerText(),/مراجعة إصدار الرموز غير متاحة/);assert.equal(await mutations(p),0);
  stage='capability offered only explicitly and never auto invoked';await boot(p,{seedUnknown:true,terminal:true});assert.equal(await p.locator('[data-action=close-unknown]').count(),1);assert.equal(await mutations(p),0);
  await p.evaluate(()=>{window.compactFixture.terminal=false;});await p.locator('[data-action=refresh]').click();await p.waitForFunction(()=>!document.querySelector('[data-action=close-unknown]'));assert.equal(await mutations(p),0);
  stage='identity and explicit six-key save';await boot(p,{mixed:true,count:50});
  assert.equal(await p.locator('[name=name],[name=class]').count(),0);assert.equal(await p.locator('[data-visibility] input[type=checkbox]').count(),4);assert.equal(await p.locator('[data-legacy-identity]').count(),1);assert.equal(await mutations(p),0);
  assert.equal(await p.locator('[data-code]').count(),0);await p.locator('[name=grades]').check();await p.locator('[data-visibility] [type=submit]').click();await p.waitForFunction(()=>window.compactFixture.roster.visibility.name&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  const sent=await p.evaluate(()=>window.compactFixture.calls.find(x=>x.action==='visibility').body.fields);assert.deepEqual(sent,{name:true,class:true,grades:true,required:true,completed:true,scheduled:true});assert.equal(await p.locator('[data-legacy-identity]').count(),0);
  stage='collapsed roster, six digits, gesture copy share and safe cancel';await expand(p);assert.equal(await p.locator('.n88-class-roster>li').count(),50);assert.equal(await p.locator('[data-code] input').inputValue(),'123456');
  await p.locator('[data-action=copy-student]').click();assert.equal(await p.evaluate(()=>window.compactFixture.copied),'123456');
  await p.locator('[data-action=share-student]').click();assert.equal(await p.evaluate(()=>window.compactFixture.shared===window.compactFixture.copied&&window.compactFixture.shared.includes('/student')),true);
  await p.locator('[data-action=review-rotate]').first().click();assert.equal(await p.locator('[data-code]').count(),0);assert.equal(await p.locator('[data-action=confirm]').evaluate(e=>e===document.activeElement),true);
  const commands=await mutations(p);await p.locator('[data-action=cancel]').click();await p.locator('[data-code]').waitFor();assert.equal(await mutations(p),commands);assert.equal(await p.locator('[data-action=review-rotate]').first().evaluate(e=>e===document.activeElement),true);
  await p.locator('[data-action=review-revoke]').first().click();await p.locator('[data-action=confirm]').click();await p.waitForFunction(()=>!window.compactFixture.roster.students[0].hasActiveCode&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('[data-code]').count(),0);await p.locator('[data-action=review-rotate]').first().click();await p.locator('[data-action=confirm]').click();await p.waitForFunction(()=>window.compactFixture.roster.students[0].credentialVersion===2&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[data-code] input').inputValue(),'199999');
  stage='guidance CAS save and independent read failure';await p.locator('[name=executionInstructions]').fill('تعليمات مصطنعة جديدة');await p.locator('[data-guidance] [type=submit]').click();await p.waitForFunction(()=>window.compactFixture.tasks[0].revision===2&&document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');
  const guidance=await p.evaluate(()=>window.compactFixture.calls.find(x=>x.action==='guidance-save').body.guidance);assert.equal(guidance.revision,1);assert.equal(guidance.sourceStamp,'c'.repeat(64));
  await boot(p,{seedUnknown:true,failGuidance:true});assert.match(await p.locator('.n88-guidance-body').innerText(),/تعذّرت قراءة الحالة/);assert.match(await p.locator('.n88-class-status').innerText(),/غير مؤكدة/);assert.equal(await p.locator('[data-guidance-refresh]').isVisible(),true);assert.equal(await mutations(p),0);
  await p.evaluate(()=>window.compactFixture.failGuidance=false);await p.locator('[data-guidance-refresh]').click();await p.locator('[data-guidance-source]').waitFor();
  stage='guidance uncertain save has safe review and no replay';await boot(p,{guidanceFailure:true});await p.locator('[name=executionInstructions]').fill('مسودة مصطنعة');await p.locator('[data-guidance] [type=submit]').click();await p.waitForFunction(()=>document.querySelector('.n88-task-guidance')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[data-guidance] [type=submit]').isDisabled(),true);assert.equal(await p.locator('[name=executionInstructions]').inputValue(),'مسودة مصطنعة');
  stage='failed identity policy remains remote false';await boot(p,{failVisibility:true});await p.locator('[data-visibility] [type=submit]').click();await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.evaluate(()=>window.compactFixture.roster.visibility.name),false);assert.equal(await p.locator('[data-legacy-identity]').count(),1);assert.equal(await p.locator('[data-code]').count(),0);
  stage='empty roster';await boot(p,{count:0});await expand(p);assert.equal(await p.locator('.n88-roster-empty').count(),1);assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);
  stage='copy failure, closure wipes manual credentials';await boot(p,{mixed:true,failCopy:true,failShare:true});await expand(p);await p.locator('[data-action=share-student]').click();await p.locator('[data-manual]').waitFor();assert.match(await p.locator('.n88-class-status').innerText(),/لم يُؤكّد النسخ أو التسليم/);await p.locator('.n88-code-management>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-manual]'));assert.equal(await p.locator('[data-code],[data-manual]').count(),0);
  stage='owner guard and delayed stale reply';await expand(p);await p.evaluate(()=>{window.compactFixture.delay=150;document.querySelector('[data-action=refresh]').click();window.n88Fixture.switchOwner();window.compactFixture.notify();});await p.waitForTimeout(200);assert.equal(await p.locator('[data-code],[data-manual],[name=executionInstructions]').count(),0);assert.equal(await p.evaluate(()=>{try{window.compactFixture.getBinding(false);return false;}catch{return true;}}),true);
  stage='lease expiry denies actual UI entry';await boot(p,{mixed:true});await expand(p);await p.evaluate(()=>{window.n88Fixture.expire();window.compactFixture.notify();});await p.waitForFunction(()=>!document.querySelector('[data-code]'));assert.equal(await p.locator('[data-manual],[name=executionInstructions]').count(),0);
  stage='visibility retirement';await boot(p,{mixed:true});await expand(p);await p.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await p.locator('[data-code],[data-manual]').count(),0);assert.equal(await p.locator('.n88-code-management').evaluate(e=>e.open),false);await p.evaluate(()=>dispatchEvent(new Event('pageshow')));await p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('[data-code]').count(),0);
  stage='permission denied entry';await p.goto(server.url);await p.waitForFunction(()=>!!window.compactFixture);await p.evaluate(()=>window.compactFixture.mode='denied');await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[data-n88-entry-state=denied]').waitFor();assert.equal(await p.locator('[data-code],.n88-class-roster').count(),0);
  assert.deepEqual(report.pageErrors,[]);await c.close();
 });
 report.checks=[
  {name:'n88_teacher_unknown_request_disables_only_unsafe_issue_and_has_honest_review',status:'PASS',evidence:'8 actual route/runtime synthetic 28-pupil UNKNOWN cases; HTTP 200 read, sanitized region/stage, original hint preserved, zero issuance/revoke calls; read-only review. Separate missing-revision and explicit terminal-capability cases.'},
  {name:'n88_identity_name_class_not_optional_with_six_field_transport_contract',status:'PASS',evidence:'4 visible field choices, no identity checkboxes or mount writes; explicit exact six-key save with true name/class; failed ACK retains actual false policy and legacy explanation.'},
  {name:'n88_teacher_work_first_ui_collapsible_private_roster_and_restore_on_context',status:'PASS',evidence:'Actual DOM order fields/guidance/code-manager; default collapsed with no code DOM, explicit open read, collapse/manual wipe, 50 mixed/legacy/revoked and empty rosters; source-backed guidance CAS save, independent read failure/recovery and uncertain-save draft retention.'},
  {name:'n88_canonical_owner_ack_grades_privacy_and_320_390_768_1280_mobile',status:'PASS',evidence:'Chromium 320/390/768/1280 RTL light/dark, geometry and screenshots; real ownership/lease guard, stale delayed reply and pagehide/pageshow, 403 admission, six-digit copy/share/failure/cancel and confirmed selective rotate/revoke. Client receipt guards separately in client-result.json.'}
 ];
}catch(e){report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{await server?.close();report.cleanup.serverClosed=true;if(owned)report.cleanup.integrationLease=lease('release');await writeFile(`${dir}/${report.failure?'failure-'+Date.now():'result'}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
