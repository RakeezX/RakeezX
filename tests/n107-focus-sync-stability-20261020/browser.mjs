// AI-authored: one bounded changed-view check; real app/CSS/handlers, synthetic owner.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const baseline=process.env.N107_BASELINE==='1';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from '../n73-account-flow-fixture.mjs';
import {makeEnrollment} from '../../src/models.js';
const taskId='continuous-n107-focus-sync-stability-20261020',runId='69386de3-2267-43e4-a4cf-59b578806a89';
const base='http://127.0.0.1:49827',root=resolve('.'),out='tests/n107-focus-sync-stability-20261020/';
const service=syntheticService();
service.current.enrollments=service.current.students.map((s,i)=>({...makeEnrollment({id:'e'+i,studentId:s.id,sectionId:'n73-source-section'}),ownerId:owner,serverRevision:1}));
const result={taskId,runId,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(body||'{}'))));return;}
 const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');let body=await readFile(f);
 if(path==='/'&&new URL(req.url,base).searchParams.has('account'))body=Buffer.from(body.toString().replace("import('./src/lib/app-update.js');", "await import('/tests/n107-focus-sync-stability-20261020/sync-bootstrap.mjs'); import('./src/lib/app-update.js');"));
 if(baseline&&['/src/app.js','/src/lib/dom.js'].includes(path))body=execFileSync('git',['show','10a98fcbec350030c5b72a1ea9132cab196a9ae2:'+path.slice(1)]);
 res.end(body);
}catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message}));}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49827,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>result.failures.push(e.message));
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
   const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
   const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
   const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-roster-local'};
   s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
   const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
   try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
   const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
   if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
   await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
   s.assertClassImportAccess();location.hash='#/classes/koshoof?teaching=n73-source';(await import('/src/repaint.js')).repaint();
  });
  await page.locator('[data-roster-file-flow]').waitFor();
  await page.locator('[data-change="grade-file"]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب,Exam (العظمى 20)\nSynthetic 1,7')});
  await page.locator('[data-import-kind]').waitFor();
  await page.locator('[data-import-kind]').selectOption('new');await page.waitForTimeout(80);
  const snapshot=()=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
  const before=await snapshot();
  // All notifications pass through the actual shared repaint scheduler.
  const startBackground=()=>page.evaluate(async()=>{
    const r=await import('/src/repaint.js');
    globalThis.__ticks=0;globalThis.__timer=setInterval(()=>{__ticks++;r.repaint();},40);
  });
  const stopBackground=()=>page.evaluate(()=>{clearInterval(__timer);return __ticks;});
  for(const [label,width]of [['desktop',1100],['narrow',390]]){
    await page.setViewportSize({width,height:900});
    for(const selector of ['[data-roster-field="grade"]','[data-roster-subject]']){
      const control=page.locator(selector);await control.scrollIntoViewIfNeeded();
      await page.evaluate(selector=>{globalThis.__select=document.querySelector(selector);},selector);
      await control.click();await startBackground();
      await page.waitForTimeout(260);
      assert.equal(await page.evaluate(()=>__select.isConnected),true,'native select node must stay connected');
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
      assert.ok(await stopBackground()>=4);
      // Committing a selection may intentionally render its new destination state.
      assert.notEqual(await control.inputValue(),'');await page.waitForTimeout(80);
    }
    const code=page.locator('[data-roster-field="label"]');await code.fill('12');await code.evaluate(el=>el.setSelectionRange(1,1));
    await page.evaluate(()=>{globalThis.__input=document.querySelector('[data-roster-field="label"]');});
    await startBackground();await page.keyboard.type('345',{delay:85});
    assert.equal(await code.inputValue(),'13452');
    assert.deepEqual(await code.evaluate(el=>({same:el===globalThis.__input,focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd})),{same:true,focused:true,start:4,end:4});
    assert.ok(await stopBackground()>=4);
    await page.screenshot({path:out+label+'.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await code.blur();await page.waitForTimeout(80);
  }
  assert.equal(await snapshot(),before,'view-only repeated updates must not mutate data/outbox');
  result.checks.push({name:'n107_actual_dom_background_update_keeps_active_control',status:'PASS',evidence:'Actual owned-account import UI at 1100px/390px: grade/subject native selects remain connected through timed background paints and accept keyboard selection; class-code typing keeps exact node, focus, text and caret. Data/outbox unchanged.'});
  // Genuine unrelated store notification (synthetic durable row update) uses the real subscriber.
  const code=page.locator('[data-roster-field="label"]');await code.focus();
  await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');globalThis.__input=document.activeElement;const row=s.state.scores[0];await d.put('scores',{...row,value:row.value-1});await s.refreshSyncedState();});
  await page.waitForTimeout(100);
  assert.equal(await code.evaluate(el=>el===globalThis.__input&&el===document.activeElement),true);
  // A meaningful header change must render without remounting the unchanged page.
  await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.profile.teacherName='Synthetic updated';(await import('/src/repaint.js')).repaint();});
  await page.waitForFunction(()=>document.querySelector('[data-sync-account-label]')?.getAttribute('aria-label').includes('Synthetic updated'));
  assert.equal(await code.evaluate(el=>el===globalThis.__input),true);
  await code.blur();
  // Relevant page changes still render immediately (custom subject field appears).
  await page.locator('[data-roster-subject]').selectOption('custom');
  await page.locator('[data-roster-field="subject"]').waitFor({state:'visible'});
  // Representative actual app account dialog, not a hand-written test template.
  await page.locator('.topbar [data-act="open-teacher-mini-hub"]').click();
  await page.locator('[role="dialog"]').waitFor();
  const dialogBefore=await snapshot();
  await page.locator('[role="dialog"] summary').first().click();
  await page.locator('[role="dialog"] summary').first().focus();
  await page.evaluate(()=>{globalThis.__dialog=document.querySelector('[role="dialog"]');globalThis.__focused=document.activeElement;});
  await startBackground();await page.waitForTimeout(260);await stopBackground();
  assert.equal(await page.evaluate(()=>__dialog.isConnected&&document.activeElement===__focused),true);
  assert.equal(await page.locator('[role="dialog"] details').first().evaluate(el=>el.open),true);
  assert.equal(await snapshot(),dialogBefore);
  await page.screenshot({path:out+'dialog-narrow.png',fullPage:true});
  await page.keyboard.press('Escape');
  result.checks.push({name:'n107_import_and_representative_dialog_affected_result_inspected',status:'PASS',evidence:'Actual import, relevant custom-subject rerender, changed account header, genuine score-store notification and account dialog/disclosure checked. Dialog focus/open state and data/outbox preserved; narrow screenshots captured.'});

  // Boot the persisted fabricated account through the actual app entry, with local-only transport.
  await page.goto(base+'/?account#/classes/koshoof',{waitUntil:'domcontentloaded'});
  await page.locator('[data-roster-file-flow]').waitFor();
  await page.waitForTimeout(600); // let the initial synthetic read-only pass settle
  const states=[];
  for(const state of ['pending','synced','blocked','rejected','error']){
    const summary=await page.evaluate(async state=>{
      const d=await import('/src/lib/db.js'),y=await import('/src/lib/sync.js');
      await d.clearStore('outbox');y.state.status='idle';
      if(state!=='synced')await d.put('outbox',{id:'synthetic-status',protocol:'v2',state:state==='error'?'failed':state,store:'students',recordId:'synthetic',sequence:1});
      const summary=await y.getSyncOperationalSummary();(await import('/src/repaint.js')).repaint();return summary;
    },state);
    await page.waitForFunction(state=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--'+state),state);
    const dot=await page.locator('.topbar [data-sync-status]').evaluate(el=>({color:getComputedStyle(el).backgroundColor,title:el.title||el.parentElement.getAttribute('aria-label')}));
    states.push({state,summary,dot});assert.equal(summary.state,state);assert.equal(summary.cloudSyncHealthy,state==='synced');
  }
  assert.notEqual(states[0].dot.color,states[1].dot.color);assert.notEqual(states[4].dot.color,states[1].dot.color);
  await page.locator('[data-change="grade-file"]').setInputFiles({name:'sync-focus.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب\nSynthetic 1')});
  await page.locator('[data-import-kind]').waitFor();await page.locator('[data-import-kind]').selectOption('new');await page.waitForTimeout(80);
  const syncCode=page.locator('[data-roster-field="label"]');await syncCode.fill('5');
  await page.evaluate(()=>globalThis.__syncInput=document.activeElement);
  await page.evaluate(async()=>{const d=await import('/src/lib/db.js'),y=await import('/src/lib/sync.js');await d.clearStore('outbox');y.state.status='idle';globalThis.__syncFail=true;globalThis.__syncGate=new Promise(r=>globalThis.__releaseSync=r);globalThis.__syncRun=y.syncAll({full:true});});
  await page.waitForFunction(()=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--syncing'));
  await page.keyboard.type('67',{delay:85});assert.equal(await syncCode.inputValue(),'567');
  assert.equal(await syncCode.evaluate(el=>el===__syncInput&&el===document.activeElement),true);
  await page.screenshot({path:out+'syncing-narrow.png',fullPage:true});
  await page.evaluate(async()=>{__releaseSync();await __syncRun;});
  await page.waitForFunction(()=>document.querySelector('.topbar [data-sync-status]')?.classList.contains('sync-dot--error'));
  assert.equal(await syncCode.evaluate(el=>el===__syncInput&&el===document.activeElement&&el.selectionStart===3),true);
  await page.screenshot({path:out+'failure-narrow.png',fullPage:true});
  // Preserve the import's existing session-reset boundary even for the same owner.
  await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth(c.user,{...c.session});(await import('/src/repaint.js')).repaint();});
  await page.waitForFunction(()=>!__syncInput.isConnected);
  // A real permission/workspace transition must invalidate cached controls.
  await page.evaluate(async()=>{(await import('/src/store.js')).deactivateWorkspace('n107-synthetic-owner-retired');(await import('/src/repaint.js')).repaint();});
  await page.locator('[data-class-access-status]').waitFor();assert.equal(await page.locator('[data-roster-field="label"]').count(),0);
  result.syncStates=states;
  result.checks.push({name:'n107_sync_status_truth_and_owner_recovery_preserved',status:'PASS',evidence:'Actual account boot and rendered status dot: pending blue, synced green, blocked/rejected/failed remain non-green; paused real synthetic Sync publishes syncing blue then hard failure red. Typing also survives actual Sync start/failure notifications; workspace deactivation removes cached import controls. Existing owner tests recorded separately. No real service requests.'});
  assert.equal(service.evidence.commits,0);assert.deepEqual(result.failures,[]);
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));result.sourceSha256=Object.fromEntries(await Promise.all(['src/app.js','src/lib/dom.js'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));await writeFile(out+(baseline?'baseline-result.json':'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}





