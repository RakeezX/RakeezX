/** AI: affected real-app UI checks only, fabricated ports, redacted output. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {start} from './fixtures/n88-compact-teacher/server.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-compact-teacher-portal-20261018',runId='a2cc5ee3-395f-456f-a814-6ea5cd0e4080',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',root+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],steps:[],cleanup:{}},pass=s=>report.steps.push(s);let server,owned=false,failed=false;
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;server=await start();
 await withIsolatedLocalBrowser({taskFile,runId,url:server.url,timeoutMs:120000},async({createContext})=>{
  const ctx=await createContext({viewport:{width:1280,height:1000}}),page=await ctx.newPage();
  const codes=()=>page.locator('[data-code] input');
  const ready=async()=>{await codes().first().waitFor();await page.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');};
  const calls=()=>page.evaluate(()=>window.compactFixture.calls.map(c=>c.action));
  const wake=()=>page.evaluate(()=>{dispatchEvent(new Event('focus'));dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));window.compactFixture.notify();});
  page.setDefaultTimeout(8000);page.on('pageerror',e=>{report.pageErrors??=[];report.pageErrors.push(String(e.message).replace(/[1][0-9]{5,}/g,'[REDACTED]'));});await page.goto(server.url);await page.waitForFunction(()=>!!window.compactFixture);report.boot=await page.evaluate(()=>({links:[...document.querySelectorAll('a')].map(e=>e.textContent.trim()),text:document.body.innerText.replace(/[1][0-9]{5,}/g,'[REDACTED]').slice(-3000)}));await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await ready();
  assert.equal((await calls()).filter(a=>a==='list').length,1);pass('actual shell/class route mount: one authorized list, real owner-bound dispatch guard');
  assert.equal(await page.locator('[data-action=refresh]').count(),0);assert.equal(await page.locator('[data-action=batch]').innerText(),'إنشاء الرموز');
  await page.locator('summary').click();await page.locator('[name=grades]').check();
  await page.locator('[data-action=copy-student]').first().click();
  await page.waitForFunction(()=>!!window.compactFixture.copied);
  assert.equal(await page.evaluate(()=>{const f=window.compactFixture,s=f.roster.students[0];return f.copied===`مرحبًا ${s.label}،\nرمز دخولك: ${s.credential}\n${location.origin}/student\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`;}),true);
  assert.equal(await page.locator('[name=grades]').isChecked(),true);assert.equal(await page.locator('details').getAttribute('open'),'');
  await page.evaluate(()=>{window.compactFixture.failCopy=true;});await page.locator('[data-action=copy-student]').first().click();await page.locator('[data-manual]').waitFor();
  assert.equal(await page.evaluate(()=>document.querySelector('[data-manual]').value===window.compactFixture.copied),true);
  await page.evaluate(()=>{window.compactFixture.failShare=true;});await page.locator('[data-action=share-student]').first().click();await page.locator('[data-manual]').waitFor();
  assert.equal(await page.locator('[name=grades]').isChecked(),true);pass('exact name/code/universalURL/instructions; sync clipboard and async share failure manual fallback; unsaved disclosure preserved');
  let before=(await calls()).length;
  await wake();await page.waitForFunction(n=>window.compactFixture.calls.length>n,before);await ready();
  report.wakeState=await page.evaluate(()=>({count:window.compactFixture.calls.length,checked:document.querySelector('[name=grades]')?.checked,policy:window.compactFixture.roster.policyRevision,context:window.compactFixture.getBinding(false).context.contextRevision}));assert.equal((await calls()).length,before+1);assert.equal(await page.locator('[name=grades]').isChecked(),true);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-code] input').value===window.compactFixture.roster.students[0].credential),true);
  assert.equal((await calls()).includes('visibility'),false);pass('focus/pageshow/visible/subscription coalescing, same recovered code, no implicit settings save');
  await page.evaluate(()=>{dispatchEvent(new Event('pagehide'));});assert.equal(await codes().count(),0);
  await wake();await ready();assert.equal(await page.locator('[name=grades]').isChecked(),true);pass('pagehide wipe, authorized return read, unchanged-context draft survives');
  await page.locator('[data-visibility] button').click();await ready();
  assert.equal(await page.evaluate(()=>{const f=window.compactFixture,c=f.calls.find(c=>c.action==='visibility');return c.body.policyRevision===0&&c.body.expectedRosterRevision===f.roster.rosterRevision&&c.body.fields.grades&&f.roster.policyRevision===1;}),true);pass('explicit six-field save with policy/roster CAS and validated ACK then refetch');
  await page.evaluate(()=>{window.compactFixture.delay=180;});before=(await calls()).length;
  await page.locator('[data-action=batch]').click();await wake();
  await page.waitForFunction(()=>window.compactFixture.calls.at(-1)?.action==='list');await ready();
  assert.deepEqual((await calls()).slice(before),['issue-missing','list']);pass('mutation wake events coalesced into one postcommit list; no duplicate requests or mutation replay');
  await page.evaluate(()=>{window.compactFixture.uncertain=true;});before=(await calls()).length;
  await page.locator('[data-action=batch]').click();await page.locator('[data-action=refresh]').waitFor();
  assert.equal(await codes().count(),0);assert.equal(await page.locator('[data-action=batch]').isDisabled(),true);assert.equal((await calls()).length,before+1);
  await page.locator('[data-action=refresh]').click();await ready();assert.deepEqual((await calls()).slice(before),['issue-missing','list']);pass('unknown ACK: one review action, writes disabled until fresh list, no replay');
  await page.evaluate(()=>{window.compactFixture.failNext=true;});await wake();await page.locator('[data-action=refresh]').waitFor();assert.equal(await codes().count(),0);
  assert.equal(await page.locator('[data-action=refresh]').count(),1);await page.locator('[data-action=refresh]').click();await ready();pass('read failure wipes credentials and offers one authorized retry');
  await page.locator('[data-action=review-rotate]').last().click();assert.equal(await page.locator('[data-confirm]').count(),1);assert.equal((await calls()).filter(a=>a==='rotate').length,0);
  await page.locator('[data-action=confirm]').click();await ready();assert.equal((await calls()).filter(a=>a==='rotate').length,1);
  await page.locator('[data-action=review-revoke]').first().click();await page.locator('[data-action=cancel]').click();await ready();assert.equal((await calls()).filter(a=>a==='revoke').length,0);
  await page.locator('[data-action=review-revoke]').first().click();await page.locator('[data-action=confirm]').click();await ready();assert.equal((await calls()).filter(a=>a==='revoke').length,1);pass('legacy explicit selective rotate and consequences, revoke confirmation/cancel, postcommit authorized recovery');
  // Delayed response after context invalidation must never restore old plaintext.
  await page.evaluate(()=>{window.compactFixture.delay=250;});await wake();await page.waitForFunction(()=>document.querySelector('.n88-class').getAttribute('aria-busy')==='true');
  await page.evaluate(()=>{const f=window.compactFixture;f.override={...f.getBinding(false).context,contextRevision:'new-context'};f.notify();});
  assert.equal(await codes().count(),0);await ready();
  assert.equal(await page.evaluate(()=>window.compactFixture.calls.at(-1).body.binding.contextRevision==='new-context'),true);pass('context switch during delayed read: immediate wipe and queued fresh authorized read; stale result discarded');
  await page.evaluate(()=>window.n88Fixture.switchOwner());assert.equal(await codes().count(),0);await page.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
  assert.equal(await codes().count(),0);assert.equal(await page.locator('[data-action=batch]').isEnabled().catch(()=>false),false);pass('actual account owner/store guard rejects foreign owner and immediately wipes plaintext');
  await ctx.close();
  for(const theme of ['light','dark'])for(const width of [390,698,1280]){
   const c=await createContext({viewport:{width,height:1000},colorScheme:theme}),p=await c.newPage();
   await p.goto(server.url);await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[data-code] input').first().waitFor();
   await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.n88-class button,.n88-class summary')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth;})),true);
   assert.equal(await p.evaluate(()=>[...document.querySelectorAll('[data-code] input')].every(e=>e.scrollWidth<=e.clientWidth+2)),true);
   await p.locator('summary').click();assert.equal(await p.locator('[data-visibility] input').count(),6);
   await p.locator('[data-action=copy-student]').first().focus();
   await p.screenshot({path:`tests/fixtures/n88-compact-teacher/${width}-${theme}.png`,fullPage:true,mask:[p.locator('[data-code] input'),p.locator('[data-manual]')],maskColor:'#64748b'});
   report.steps.push(`actual shell ${width}px ${theme}: no overflow, 44px targets, six disclosure fields, masked screenshot`);await c.close();
  }
 });
 delete report.boot;delete report.wakeState;
 report.checks=[{name:'n88_compact_teacher_responsive_390_698_1280_light_dark_actual_app',status:'PASS',evidence:'Six masked actual application shell/class route screenshots and geometry checks; source CSS and handlers, fresh contexts.'},{name:'n88_compact_teacher_automatic_refetch_retry_recovery_and_stale_owner_guards',status:'PASS',evidence:'See steps: mount/return/focus/context/postcommit, coalescing, unknown ACK/read retry, delayed stale response, actual account ownership guard.'},{name:'n88_compact_teacher_copy_share_visibility_semantics_and_disjoint_scope',status:'PASS',evidence:'Exact delivery text, manual fallbacks, legacy selective confirmations and explicit ACK/CAS settings save; task-owned fabricated ports only.'}];
}catch(e){failed=true;report.failure={stage:report.steps.at(-1)||'startup',message:e?.code==='ERR_ASSERTION'?'Assertion failed (values omitted)':String(e.message).replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]').split('\n')[0],location:String(e.stack).split('\n').filter(l=>l.includes('n88-compact-teacher.mjs:')).map(l=>l.match(/n88-compact-teacher\.mjs:\d+:\d+/)?.[0])};}
finally{await server?.close();report.cleanup.ownedServerClosed=true;if(owned){try{report.cleanup.lease=lease('release');}catch(e){failed=true;report.cleanup.leaseError=String(e.stderr||e.message).split('\n')[0];}}await writeFile(failed?`tests/n88-compact-teacher-failure-${Date.now()}.json`:'tests/n88-compact-teacher.json',JSON.stringify(report,null,2)+'\n');}
console.log(failed?'N88 compact teacher FAIL; sanitized evidence saved':'N88 compact teacher PASS');if(failed)process.exitCode=1;
