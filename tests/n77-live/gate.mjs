import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readState, saveState, safeReceipt, recordGate, PRIVATE, TASK_ID } from './run.mjs';

const card='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+TASK_ID+'.json';
const lease='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const phase=action=>execFileSync('powershell.exe',['-NoProfile','-File',lease,'-Name','browser','-Action',action,
  '-TaskFile',card,'-WaitSeconds','0'],{windowsHide:true,encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const repository=path.resolve('C:/Users/Abody/Projects/RakeezX/.worktrees/'+TASK_ID);
const observed=[];
function mark(name,detail){observed.push({name,status:'PASS',detail,at:new Date().toISOString()});}
async function checkpoint(s){s.liveObservations=observed;await saveState(s);await safeReceipt(s);}
async function boot(browser,s,context) {
  const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const p=await c.newPage(), session=s.tokens[context];
  // Preserve the ordinary authenticated foundation handler while binding all its IDs
  // to the pre-write manifest; this is a forwarded real request, never a mock reply.
  await p.route('https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/rpc/provision_account_workspace',route=>
    route.continue({postData:JSON.stringify({p_defaults:s.foundation})}));
  await p.addInitScript(session=>{
    localStorage.setItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns',JSON.stringify(session));
    // Static Product hosting has no Vite-only window.store. Rebind the same
    // application module after ordinary provisioning/navigation reloads too.
    addEventListener('DOMContentLoaded',async()=>{window.__n77Store=await import('/src/store.js');},{once:true});
  },session);
  await p.goto(s.binding.previewUrl+'/#/classes');
  await p.evaluate(async()=>{window.__n77Store=await import('/src/store.js');});
  await p.waitForFunction(()=>window.__n77Store?.state.ready||document.querySelector('[data-account-profile-form]')||
    document.querySelector('[data-initial-restore-state="RESTORE_FAILED"],[data-initial-restore-state="PROVISIONING_FAILED"]'),null,{timeout:60000});
  const bootFailure=p.locator('[data-initial-restore-state="RESTORE_FAILED"],[data-initial-restore-state="PROVISIONING_FAILED"]');
  if(await bootFailure.count())throw new Error('Ordinary account boot failed: '+await bootFailure.innerText());
  if(await p.locator('[data-account-profile-form]').count()) {
    await p.locator('[name="teacherName"]').fill('معلم N77 اصطناعي '+context[0]);
    await p.locator('[name="phone"]').fill(context[0]==='A'?'0500000077':'0500000078');
    await p.locator('[data-account-profile-form] button[type="submit"]').click();
  }
  await p.waitForFunction(()=>window.__n77Store?.state.ready,null,{timeout:60000});
  await p.evaluate(async()=>{
    const sync=await import('/src/lib/sync.js');await sync.suspendForWorkspaceDeactivation();
    await window.__n77Store.renewOfflineLease();
  });
  assert.equal(await p.evaluate(()=>window.__n77Store.getActiveWorkspace().authUserId),s.accounts.find(a=>a.slot===context[0]).id);
  return {context:c,page:p};
}
export async function flush(p) {
  const r=await p.evaluate(async()=>{
    const sync=await import('/src/lib/sync.js');const db=await import('/src/lib/db.js');
    let result;
    for(let attempt=0;attempt<3;attempt++) {
      // The public coordinator returns false for an overlapping pass. Settle
      // owned background work before requiring our own acknowledged full pass.
      await sync.suspendForWorkspaceDeactivation();
      const ok=await sync.syncAll({full:true});
      const busy=!ok&&sync.displayState().status==='syncing';
      await sync.suspendForWorkspaceDeactivation();
      result={ok,state:sync.displayState(),outbox:await db.getAll('outbox')};
      if(ok||!busy)break;
    }
    return result;
  });
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.outbox.length,0,JSON.stringify(r));
}
async function serverObservation(p,s) {
  // Independent owner-filtered real HTTP reads, not store memory or an RPC acknowledgment.
  return p.evaluate(async({ownerId,ids})=>{
    const cloud=await import('/src/lib/cloud.js');
    const wanted={sections:[ids.section,ids.outsideSection],teachings:ids.teachings,items:ids.itemIds.flat(),
      students:[ids.student],enrollments:ids.enrollments,notes:[ids.note],scores:ids.scoreIds??[]};
    const result={};
    for(const[entity,selected]of Object.entries(wanted)) {
      const records=await cloud.fetchRecords(entity,{ownerId});
      result[entity]=records.filter(r=>selected.includes(r.id));
    }
    return result;
  },{ownerId:s.accounts[0].id,ids:s.fixtureIds});
}
export async function gate() {
  const s=await readState();
  if(Date.now()>=Date.parse(s.issuedAt)+45*60*1000)throw new Error('Live work deadline exhausted');
  if(Date.now()+15*60*1000>=Date.parse(s.expiresAt))throw new Error('Cleanup reserve exhausted');
  let browser;const contexts=[];let owned=false;
  try {
    phase('acquire');owned=true;
    const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();assert.equal(candidate,s.binding.candidateSha);
    const assets=[];
    for(const file of ['index.html','src/lib/n77-delete.js','src/lib/restore-deletion-scope.js','src/lib/backup-v2.js',
      'src/lib/cloud.js','src/lib/db.js','src/lib/sync.js','src/store.js','src/views/teachings.js','src/styles/components.css','sw.js']) {
      const r=await fetch(new URL(file==='index.html'?'./':file,s.binding.previewUrl),{redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,file);
      const served=Buffer.from(await r.arrayBuffer()),expected=execFileSync('git',['show',candidate+':'+file],{cwd:repository,maxBuffer:5*1024*1024});
      assert.equal(hash(served),hash(expected),file);assets.push({file,sha256:hash(served)});
    }
    mark('served_product_source_parity',assets);await checkpoint(s);
    browser=await chromium.launch({headless:true});
    const A1=await boot(browser,s,'A1');contexts.push(A1.context);
    const B1=await boot(browser,s,'B1');contexts.push(B1.context);
    const p=A1.page;
    await p.route('https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/rpc/n77_delete_teaching',async route=>{
      const envelope=route.request().postDataJSON();
      if(envelope.p_commit) {
        assert.ok(s.fixtureIds.teachings.slice(0,2).includes(envelope.p_teaching_id));
        assert.equal(envelope.p_expected_section_id,s.fixtureIds.section);
        // Observe the Product handler's own durable mutation identity before
        // forwarding the real, unchanged request; never fabricate a receipt.
        s.prewriteDeletionEnvelopes??=[];
        s.prewriteDeletionEnvelopes.push({envelope,at:new Date().toISOString()});
        await checkpoint(s);
      }
      await route.continue();
    });
    const foundation=await p.evaluate(()=>({year:window.__n77Store.activeYear()?.id,term:window.__n77Store.activeTerm()?.id,subjects:window.__n77Store.subjects().map(r=>r.id)}));
    assert.equal(foundation.year,s.fixtureIds.yearId);assert.equal(foundation.term,s.fixtureIds.termId);assert.ok(foundation.subjects.includes(s.fixtureIds.subjectId));
    mark('ordinary_foundation',foundation);
    const ids=s.fixtureIds;
    await p.evaluate(async ids=>{
      const models=await import('/src/models.js');const store=window.__n77Store;
      await store.save({sections:[models.makeSection({id:ids.section,yearId:ids.yearId,grade:4,label:'N77'}),
        models.makeSection({id:ids.outsideSection,yearId:ids.yearId,grade:5,label:'N77外'})],
        subjects:[models.makeSubject({id:ids.secondSubject,name:'مادة N77 اصطناعية',slug:'n77-'+ids.secondSubject.split(':')[1]})],
        students:[models.makeStudent({id:ids.student,name:'طالب N77 اصطناعي'})]});
    },ids);await flush(p);
    // Ordinary versioned creation commands with every ID saved before server writes.
    await p.evaluate(async ids=>{
      const cloud=await import('/src/lib/cloud.js');const db=await import('/src/lib/db.js');
      const deviceId=(await db.get('device','device')).deviceId;
      for(let i=0;i<ids.teachings.length;i++)await cloud.applySyncV2TeachingCreationCommand({
        mutationId:ids.mutations[['t1','t2','outside'][i]],deviceId,teachingId:ids.teachings[i],
        sectionId:i===2?ids.outsideSection:ids.section,subjectId:i===1?ids.secondSubject:ids.subjectId,
        termId:ids.termId,order:i,itemIds:ids.itemIds[i],clientUpdatedAt:Date.now()});
      // Current N13 permits one active membership per student. The student's
      // outside Teaching score, rather than a second enrollment, shares identity.
      for(let i=0;i<ids.enrollments.length;i++)await cloud.applySyncV2EnrollmentCommand({mutationId:ids.mutations.enroll,deviceId,
        command:'enroll',payload:{studentId:ids.student,sourceEnrollmentId:null,destinationEnrollmentId:ids.enrollments[i],
          destinationSectionId:ids.section,date:'2026-10-13',note:''},clientUpdatedAt:Date.now()});
    },ids);await flush(p);
    await p.evaluate(async ids=>{
      const s=window.__n77Store,models=await import('/src/models.js');
      await s.save({notes:[models.makeNote({id:ids.note,studentId:ids.student,teachingId:ids.teachings[0],text:'N77 synthetic scope'})],
        assignments:[{id:ids.assignment,teachingId:ids.teachings[0],deleted:false,updatedAt:Date.now()}],
        submissions:[{id:ids.submission,assignmentId:ids.assignment,studentId:ids.student,deleted:false,updatedAt:Date.now()}]});
      for(let i=0;i<3;i++)await s.setScore(ids.student,ids.itemIds[i][1],i+1);
    },ids);await flush(p);
    const before=await serverObservation(p,s);mark('fixture_before_exact_ids',before);await checkpoint(s);
    const A2=await boot(browser,s,'A2');contexts.push(A2.context);await flush(A2.page);
    await A2.page.evaluate(async ids=>{const m=await import('/src/models.js');await window.__n77Store.save({
      assignments:[m.makeAssignment({id:ids.assignment,teachingId:ids.teachings[0]})],
      submissions:[m.makeSubmission({id:ids.submission,assignmentId:ids.assignment,studentId:ids.student})]});},ids);
    const staleBackup=await A2.page.evaluate(async backupId=> (await import('/src/lib/export.js')).buildBackup({backupId}),ids.backupId);
    await fs.writeFile(path.join(PRIVATE,'stale-backup.tmp'),JSON.stringify(staleBackup));
    await A2.context.setOffline(true);
    const localBefore=await A2.page.evaluate(()=>structuredClone(window.__n77Store.state.teachings));
    const offline=await A2.page.evaluate(async id=>{try{await window.__n77Store.previewDeleteTeaching(id);return null;}catch(e){return e.message;}},ids.teachings[0]);
    assert.match(offline,/يتطلب حذف الفصل اتصالًا/);assert.deepEqual(await A2.page.evaluate(()=>window.__n77Store.state.teachings),localBefore);
    mark('offline_no_destructive_mutation',{teachingId:ids.teachings[0],message:offline});
    const firstPlan=await p.evaluate(async id=>window.__n77Store.previewDeleteTeaching(id),ids.teachings[0]);assert.equal(firstPlan.scope,'teaching');
    const denied=await B1.page.evaluate(async({ids,plan})=>{
      const cloud=await import('/src/lib/cloud.js');
      try {await cloud.n77DeleteTeaching({teachingId:ids.teachings[0],sectionId:ids.section,fingerprint:plan.fingerprint,
        mutationId:ids.mutations.ownerDenied,deviceId:'n77-B1',commit:true});return {success:true};}
      catch(e){return {code:e.code,status:e.status,message:e.message};}
    },{ids,plan:firstPlan});
    assert.equal(denied.code,'22023');assert.equal(denied.status,400);assert.deepEqual(await serverObservation(p,s),before);
    mark('B_owner_denial_real_server_unchanged_A',denied);await checkpoint(s);
    // Change sibling revision through the real owner, then submit the original fingerprint.
    await p.evaluate(async id=>window.__n77Store.patch('teachings',id,{order:9}),ids.teachings[1]);await flush(p);
    const staleBefore=await serverObservation(p,s);
    const staleResult=await p.evaluate(async({id,plan})=>{try{await window.__n77Store.deleteTeaching(id,plan);return null;}catch(e){return e.message;}},
      {id:ids.teachings[0],plan:firstPlan});
    assert.match(staleResult,/تغيّرت بيانات الفصل/);assert.deepEqual(await serverObservation(p,s),staleBefore);
    mark('stale_fingerprint_no_scope_broadening',{message:staleResult});await checkpoint(s);
    await p.goto(s.binding.previewUrl+'/#/classes');await p.waitForFunction(()=>window.__n77Store?.state.ready);await flush(p);
    await p.locator('[data-act="delete-class-flow"]').click();
    let dialog=p.getByRole('dialog');await dialog.locator(`[data-teaching-id="${ids.teachings[0]}"]`).click();
    await dialog.locator('#class-delete-next-btn').click();
    await dialog.locator('#class-delete-confirm-btn').waitFor();
    assert.match(await dialog.locator('.class-delete-confirm-box__consequence').innerText(),/هذه المادة/);
    assert.ok(await dialog.locator('#class-delete-confirm-btn').evaluate(el=>getComputedStyle(el).color));
    await dialog.locator('#class-delete-confirm-btn').click();
    await p.waitForFunction(id=>!window.__n77Store.getTeaching(id),ids.teachings[0]);
    const receipt=await p.evaluate(async()=>{const db=await import('/src/lib/db.js');return (await db.get('device','device')).n77DeleteReceipt;});
    assert.equal(receipt.scope,'teaching');assert.equal(receipt.ownerId,s.accounts[0].id);assert.equal(receipt.selectedTeachingId,ids.teachings[0]);
    const selectedAfter=await serverObservation(p,s);
    assert.ok(selectedAfter.teachings.find(r=>r.id===ids.teachings[0]).deleted_at);
    assert.equal(selectedAfter.teachings.find(r=>r.id===ids.teachings[1]).deleted_at,null);
    assert.equal(selectedAfter.sections.find(r=>r.id===ids.section).deleted_at,null);
    assert.equal(selectedAfter.students[0].deleted_at,null);
    assert.equal(selectedAfter.teachings.find(r=>r.id===ids.teachings[2]).deleted_at,null);
    assert.ok(selectedAfter.items.filter(r=>ids.itemIds[0].includes(r.id)).every(r=>r.deleted_at));
    assert.ok(selectedAfter.scores.find(r=>r.id===ids.scoreIds[0]).deleted_at);
    assert.ok(selectedAfter.notes.find(r=>r.id===ids.note).deleted_at);
    for(const [entity,unchangedIds]of Object.entries({sections:[ids.outsideSection],teachings:[ids.teachings[2]],
      items:ids.itemIds[2],scores:[ids.scoreIds[2]],students:[ids.student]}))
      assert.deepEqual(selectedAfter[entity].filter(r=>unchangedIds.includes(r.id)),staleBefore[entity].filter(r=>unchangedIds.includes(r.id)),entity);
    mark('Product_DOM_selected_Teaching_receipt_and_independent_after',{receipt,selectedAfter});await checkpoint(s);
    const retry=await p.evaluate(async r=> (await import('/src/lib/cloud.js')).n77DeleteTeaching({teachingId:r.selectedTeachingId,sectionId:r.sectionId,
      fingerprint:r.fingerprint,mutationId:r.mutationId,deviceId:window.__n77Store.state.device.deviceId,commit:true}),receipt);
    assert.equal(retry.mutationId,receipt.mutationId);assert.deepEqual(await serverObservation(p,s),selectedAfter);
    mark('exact_envelope_idempotent_retry',retry);
    await A2.context.setOffline(false);await flush(A2.page);
    assert.equal(await A2.page.evaluate(id=>window.__n77Store.getTeaching(id),ids.teachings[0]),null);
    assert.ok(await A2.page.evaluate(id=>!!window.__n77Store.getTeaching(id),ids.teachings[2]));
    mark('A2_stale_view_real_tombstone_convergence',{deleted:ids.teachings[0],survivor:ids.teachings[2]});
    const restored=await A2.page.evaluate(async({backup,restoreId})=>{
      const restore=await import('/src/lib/backup-v2.js');const preview=await restore.previewCloudRestore(backup);
      const result=await restore.restoreBackupToCloud(backup,{restoreId});return {preview:preview.plan,result};
    },{backup:staleBackup,restoreId:ids.restoreId});
    assert.equal(restored.preview.operations.some(r=>r.recordId===ids.teachings[0]||ids.itemIds[0].includes(r.recordId)),false);
    assert.equal(await A2.page.evaluate(id=>window.__n77Store.getTeaching(id),ids.teachings[0]),null);
    assert.ok(await A2.page.evaluate(id=>!!window.__n77Store.getTeaching(id),ids.teachings[2]));
    assert.equal(await A2.page.evaluate(async ids=>{const db=await import('/src/lib/db.js');return (await db.getAll('assignments')).some(r=>r.id===ids.assignment&&!r.deleted);},ids),false);
    mark('ordinary_versioned_restore_no_resurrection',restored);await checkpoint(s);
    await flush(p);
    await p.locator('[data-act="delete-class-flow"]').click();dialog=p.getByRole('dialog');
    await dialog.locator(`[data-teaching-id="${ids.teachings[1]}"]`).click();await dialog.locator('#class-delete-next-btn').click();
    await dialog.locator('#class-delete-confirm-btn').waitFor();
    assert.match(await dialog.locator('.class-delete-confirm-box__consequence').innerText(),/الفصل كاملًا/);
    await dialog.locator('#class-delete-confirm-btn').click();await p.waitForFunction(id=>!window.__n77Store.getSection(id),ids.section);
    const finalAfter=await serverObservation(p,s);
    assert.ok(finalAfter.sections.find(r=>r.id===ids.section).deleted_at);
    assert.equal(finalAfter.sections.find(r=>r.id===ids.outsideSection).deleted_at,null);
    assert.equal(finalAfter.students[0].deleted_at,null);
    assert.ok(finalAfter.enrollments.find(r=>r.id===ids.enrollments[0]).deleted_at);
    assert.equal(finalAfter.scores.find(r=>r.id===ids.scoreIds[2]).deleted_at,null);
    mark('Product_DOM_final_Section_shared_student_outside_preserved',finalAfter);
    await flush(A2.page);assert.equal(await A2.page.evaluate(id=>window.__n77Store.getSection(id),ids.section),null);
    await p.screenshot({path:path.join(PRIVATE,'Product-final.tmp'),type:'png'});
    s.gate='PASS';await checkpoint(s);await recordGate('PASS');return 'PASS';
  } catch(e) {
    s.gate={status:'FAIL',error:e.message,stack:e.stack};await checkpoint(s);await recordGate(s.gate);throw e;
  } finally {
    for(const c of contexts)await c.close().catch(()=>{});await browser?.close();
    if(owned)phase('release');
  }
}
if(process.argv[1]?.endsWith('gate.mjs')) {
  try {console.log(JSON.stringify({gate:await gate()}));}
  catch(e){console.log(JSON.stringify({gate:'FAIL',error:e.message}));process.exitCode=1;}
}
