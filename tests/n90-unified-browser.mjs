import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { parseCsv } from '../src/lib/student-import.js';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n90-unified-import-noor-20261014.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const token='c1a22e7a-b7e3-41e8-b370-d98736ff4cbe';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',token,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true});
export async function browserFlow({q,owner}) {
  const root=resolve('.'),output='test-results/n90-unified-browser',checks=[];let loss=false,requests=[];
  const capability={scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1};
  const entities={years:'years',terms:'terms',subjects:'subjects',sections:'sections',teachings:'teachings',students:'students',enrollments:'enrollments',items:'items',scores:'scores'};
  await q("update rakeezx.scores set value=4 where id='s';update rakeezx.items set max=5,name='اختبار' where id='i';insert into rakeezx.sections(id,year_id,grade,label,name) values('empty-section','y',5,'1','5/1');insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('empty-t','empty-section','subject','term');insert into rakeezx.items(id,teaching_id,name,max) values('empty-i','empty-t','اختبار',5);");
  for(let j=2;j<=5;j++)await q('insert into rakeezx.items(id,teaching_id,name,max) values($1,\'t\',$2,5)',['i'+j,'بند '+j]);
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://127.0.0.1').pathname;
      if(pathname.startsWith('/__n90/')) {
        let body='';for await(const c of req)body+=c;const input=JSON.parse(body||'{}'),name=pathname.slice(7);let data;
        if(name==='auth')data={id:owner,source:'supabase-auth-user',verifiedAt:Date.now()};
        else if(name==='capability')data=capability;
        else if(name==='grade-capability')data=(await q('select rakeezx.unified_student_grade_import_capability() result')).rows[0].result;
        else if(name==='fixture') {
          data={};for(const [store,table] of Object.entries(entities))data[store]=(await q(`select to_jsonb(t) row from rakeezx.${table} t where owner_id=$1`,[owner])).rows.map(r=>decodeSyncV2Canonical(store,r.row));
        } else if(name==='apply') {
          requests.push(structuredClone(input));
          const rpc=input.batch.newStudents?.length?'apply_unified_student_grade_import':'apply_reviewed_grade_import';
          data=(await q(`select rakeezx.${rpc}($1,$2,$3) result`,[input.mutationId,input.deviceId,input.batch])).rows[0].result;
          if(loss){loss=false;throw Object.assign(Error('Synthetic response lost after native commit'),{status:503});}
        } else throw Error('Unknown endpoint');
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
      }
      const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
      res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));
    }catch(e){res.writeHead(e.status??(e.code==='PT409'?409:400),{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message,code:e.code,status:e.status??409}));}
  });
  let browser,ownedLease=false;
  try {
    console.log(lease('acquire'));ownedLease=true;
    await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
    const require=createRequire('C:/Users/Abody/Projects/RakeezX/package.json');browser=await require('playwright').chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await openReadyServedDemo(page,base);
    const account=await page.evaluate(async()=> (await import('/tests/n90-account-fixture.mjs')).prepareAccount());
    assert.equal(account.ready,true);assert.equal(account.lease.editable,true);assert.deepEqual(account.outbox,[]);

    const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
    const state=async()=> (await q(`select jsonb_build_object('students',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.students s),'enrollments',(select jsonb_agg(to_jsonb(e) order by id) from rakeezx.enrollments e),'scores',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.scores s)) result`)).rows[0].result;
    const panel=page.locator('[data-grade-transfer]');let sequence=0;
    const file=async(csv)=>{const name='unified-'+(++sequence)+'.csv';await page.locator('[data-change="grade-file"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(csv)});await page.waitForFunction(n=>document.querySelector('[data-grade-file-name]')?.textContent===n,name);};
    const review=async()=>{await page.locator('[data-act="grade-review"]').click();await panel.locator('[data-grade-review]').waitFor();};
    const cancel=async()=>{await page.locator('[data-act="grade-cancel"]').click();await page.waitForFunction(()=>!document.querySelector('[data-grade-file-name]')&&document.querySelector('[data-change="grade-file"]')?.disabled===false);};
    const confirm=async()=>{await page.locator('[data-grade-match-confirm]').check();if(await page.locator('[data-grade-overwrite-confirm]').count())await page.locator('[data-grade-overwrite-confirm]').check();if(await page.locator('[data-grade-enroll-confirm]').count())await page.locator('[data-grade-enroll-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();};
    await page.goto(base+'/#/teaching/empty-t');await page.getByText('الفصل بلا طلاب بعد',{exact:true}).waitFor();
    await page.locator('[data-act="add-student"]').click();await page.locator('#new-student').waitFor();await page.locator('[data-sheet-close]').last().click();
    await page.locator('a[href="#/teaching/empty-t/grades?import=1"]').click();await panel.waitFor();assert.equal(await panel.getAttribute('open'),'');
    const emptyBefore=await state();
    await file('اسم الطالب,اختبار (العظمى 5)\nطالب تجريبي جديد,7');await review();assert.match(await panel.innerText(),/7→5/);assert.match(await panel.innerText(),/انتساب جديد/);assert.equal(requests.length,0);assert.deepEqual(await state(),emptyBefore);
    await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();assert.equal(requests.length,0);await cancel();assert.deepEqual(await state(),emptyBefore);assert.equal(await panel.locator('.is-error').count(),0);
    await file('اسم الطالب,اختبار (العظمى 5)\nطالب تجريبي جديد,7');await review();await page.screenshot({fullPage:true,path:output+'/390-fresh-review.png'});await confirm();await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('إيصال الخادم'));
    const request=requests.at(-1);assert.equal(request.batch.cells[0].value,5);assert.equal(request.batch.newStudents[0].name,'طالب تجريبي جديد');
    const local=await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return {roster:s.teachingContext('empty-t').roster,grades:await d.getAll('scores'),outbox:await d.getAll('outbox')};});assert.equal(local.roster.length,1);assert.equal(local.outbox.length,0);assert.ok(local.grades.some(s=>s.studentId===request.batch.newStudents[0].id&&s.value===5));
    record('n90_shared_names_or_grades_entry_and_empty_class','Actual empty-class hub, direct manual-add form, shared file route; new names+7→5 preview/cancel/missing enrollment consent makes no writes. Confirm commits native student+enrollment+score and atomically adopts receipt into guarded account store.');
    await page.goto(base+'/#/teaching/t/students');await page.locator('[data-act="file-import"]').first().click();await panel.waitFor();
    const headers=['اسم الطالب','اختبار (العظمى 5)','بند 2 (العظمى 5)','بند 3 (العظمى 5)','بند 4 (العظمى 5)','بند 5 (العظمى 5)'];
    const csv=[headers,['أحمد سالم',7,'','','',''],['سعيد علي',0,'','','','']].map(r=>r.join(',')).join('\n');
    await file(csv);assert.equal(await panel.locator('[data-grade-column]').count(),3);assert.equal(await panel.locator('[data-grade-mapping-summary] li').count(),3);
    await panel.locator('[data-grade-mapping-details] > summary').click();await panel.locator('[data-grade-add-choice]').selectOption('4');await panel.locator('[data-act="grade-add-column"]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-grade-column]').length===4);assert.equal(await panel.locator('[data-grade-column]').count(),4);
    await panel.locator('[data-grade-column="4"] [data-grade-kind]').selectOption('i4');await review();assert.match(await panel.innerText(),/7→5/);assert.equal(await panel.locator('tbody tr').count(),2);await cancel();
    await panel.locator('[data-grade-export-panel] > summary').click();const download=page.waitForEvent('download');await page.locator('[data-act="grade-template"]').click();const artifact=await download;const blank=parseCsv(await readFile(await artifact.path(),'utf8'));assert.ok(blank[0].some(h=>h==='اختبار (العظمى 5)'));assert.ok(!blank[0].some(h=>h.includes('Auto')));assert.ok(blank.slice(1).every(row=>row.slice(2,7).every(v=>v==='')));assert.ok(blank.slice(1).some(row=>row[1]==='أحمد سالم'));
    record('n90_blank_template_and_compact_mapping','Actual CSV user shape shows exactly three unambiguous suggestions and one add-column action; fourth mapping added through handlers. Real download contains existing names/max hints and blank direct-item marks, omits automatic item.');
    await file(csv);await review();await page.locator('[data-grade-match-confirm]').check();const calls=requests.length;await page.locator('[data-act="grade-confirm"]').click();assert.equal(requests.length,calls);await confirm();await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('إيصال الخادم'));
    assert.equal(Number((await q("select value from rakeezx.scores where id='s'")).rows[0].value),5);assert.equal(Number((await q("select value from rakeezx.scores where student_id='b' and item_id='i'")).rows[0].value),0);
    await file('اسم الطالب,اختبار (العظمى 5)\nأحمد سالم,\nسعيد علي,0');await review();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);await cancel();
    for(const value of ['-1','=2+2','Infinity']){await file('اسم الطالب,اختبار (العظمى 5)\nأحمد سالم,'+value);await review();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);await cancel();}
    await file('اسم الطالب,اختبار (العظمى 5),معرف الطالب\nأحمد سالم,4,unknown');await review();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);await cancel();
    await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.students.push({...s.state.students.find(x=>x.id==='a'),id:'local-ambiguous'});s.state.enrollments.push({...s.state.enrollments.find(x=>x.studentId==='a'),id:'local-e-ambiguous',studentId:'local-ambiguous'});});
    await file('اسم الطالب,اختبار (العظمى 5)\nأحمد سالم,4');await review();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);await cancel();await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.students=s.state.students.filter(x=>x.id!=='local-ambiguous');s.state.enrollments=s.state.enrollments.filter(x=>x.id!=='local-e-ambiguous');});
    record('n90_explicit_cap_zero_blank_atomicity','Actual guarded account UI imports 7→5 with separate overwrite consent, zero persists; blank/same zero is no-op. Negative/text/nonfinite, ambiguous names and unknown explicit IDs block entire confirm. Cancel sends no grade call.');
    await file('اسم الطالب,اختبار (العظمى 5)\nطالب تجربة إعادة,4');await review();await q("update rakeezx.items set max=6 where id='i'");const beforeStale=await state();await confirm();await page.locator('[data-act="grade-retire"]').waitFor();assert.deepEqual(await state(),beforeStale);await panel.locator('[data-grade-retire-confirm]').check();await page.locator('[data-act="grade-retire"]').click();await page.locator('[data-act="grade-retire"]').waitFor({state:'detached'});await cancel();
    await page.evaluate(async()=>{await (await import('/src/store.js')).refreshSyncedState();}); // actual pull fixture below updates authoritative revision only
    await page.evaluate(async()=>{const d=await import('/src/lib/db.js'),s=await import('/src/store.js');const data=await fetch('/__n90/fixture',{method:'POST',body:'{}'}).then(r=>r.json());await d.putMany('items',data.items);await s.refreshSyncedState();});
    await file('اسم الطالب,اختبار (العظمى 6)\nطالب تجربة إعادة,4');await review();loss=true;await confirm();await page.locator('[data-act="grade-retry"]').waitFor();const first=requests.at(-1),afterLost=await state();const createdId=first.batch.newStudents[0].id;await q('update rakeezx.scores set value=3 where student_id=$1',[createdId]);await page.locator('[data-act="grade-retry"]').click();await page.waitForFunction(()=>!document.querySelector('[data-act="grade-retry"]'));assert.deepEqual(requests.at(-1),first);assert.equal(Number((await q('select value from rakeezx.scores where student_id=$1',[createdId])).rows[0].value),3);assert.equal((await q('select count(*)::int n from rakeezx.students where id=$1',[createdId])).rows[0].n,1);
    record('n90_names_grades_owner_retry_invariants','Actual store/Sync/UI owner-bound command, stale reviewed item max rejects enrollment+scores fully and preserves rejected disposition. Lost native acknowledgement retries identical envelope/ID; one student/enrollment and later grade edit preserved.');
    const negativeCalls=requests.length;
    const negatives=await page.evaluate(async()=>{
      const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),guard=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;
      const r=s.reviewGradeImport('t',{rows:[['اسم الطالب','اختبار'],['طالب حارس جديد','2']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
      const session=c.session; c.setMockAuth({id:'different-owner'},session);let ownerError;try{await s.confirmGradeImport(r,{approved:true,enrollmentConfirmed:true});}catch(e){ownerError=e.message;}finally{c.setMockAuth(session.user,session);}
      const missing=guard.cloudAccess({operation:'dispatch',authenticatedUserId:c.user.id});
      s.getOfflineLeaseStatus();(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('synthetic-invalid');let leaseError;try{await s.confirmGradeImport(r,{approved:true,enrollmentConfirmed:true});}catch(e){leaseError=e.message;}
      await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:c.user.id,source:'supabase-auth-user',verifiedAt:Date.now()}));
      return {ownerError,missing,leaseError};
    });assert.ok(negatives.ownerError);assert.equal(negatives.missing.reason,'command-owner-missing');assert.ok(negatives.leaseError);assert.equal(requests.length,negativeCalls);
    await context.setOffline(true);const offline=await page.evaluate(async()=>{const s=await import('/src/store.js'),r=s.reviewGradeImport('t',{rows:[['اسم الطالب','اختبار'],['طالب حارس جديد','2']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});try{await s.confirmGradeImport(r,{approved:true,enrollmentConfirmed:true});return false;}catch{return true;}});assert.equal(offline,true);assert.equal(requests.length,negativeCalls);await context.setOffline(false);
    record('n90_actual_owner_lease_offline_guards','New enrollment review enters real account store; auth drift, ownerless command, invalid lease and offline confirmation rejected before transport. All existing guards remain enabled.');
    // Names-only shares reader/review but uses the unchanged N12 atomic persisted-roster path.
    await page.locator('[data-change="grade-import-mode"]').selectOption('names');await file('اسم الطالب,درجة\nأحمد سالم,7\nاسم إضافي فقط,3');await review();assert.match(await panel.innerText(),/موجود؛ لن يتكرر/);const gradesBefore=(await state()).scores,callsBefore=requests.length;await confirm();await page.waitForFunction(()=>document.querySelector('[data-grade-transfer]')?.textContent.includes('أُضيفت الأسماء'));assert.equal(requests.length,callsBefore);assert.deepEqual((await state()).scores,gradesBefore);
    const namesOnly=await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return {roster:s.teachingContext('t').roster,queue:await d.getAll('outbox')};});assert.equal(namesOnly.roster.filter(s=>s.name==='اسم إضافي فقط').length,1);assert.ok(namesOnly.queue.every(r=>r.ownerId===account.workspace.authUserId));
    const dirty=await page.evaluate(async()=>{const s=await import('/src/store.js');const r=s.reviewGradeImport('t',{rows:[['اسم الطالب','اختبار'],['طالب حارس دفعة','2']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});try{await s.confirmGradeImport(r,{approved:true,enrollmentConfirmed:true});return false;}catch{return true;}});assert.equal(dirty,true);assert.equal(requests.length,callsBefore);
    record('n90_names_only_duplicate_prevention','Same actual file workflow selects names-only, reviews existing versus new, confirms through unchanged N12 persisted-roster transaction. Exactly one local new identity/enrollment with owner-bound outbox; no grade RPC or score mutation.');
    // Export grouping uses current local items; no service writes or invented values.
    await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.items=[...s.state.items.filter(i=>i.teachingId!=='t'),{id:'p40',name:'المهام الأدائية',max:40,teachingId:'t',scoreMode:'direct'},{id:'e60',name:'تقويمات تحريرية وتطبيقات عملية',max:60,teachingId:'t',scoreMode:'direct'}];s.state.scores=[...s.state.scores,{id:'p-a',studentId:'a',itemId:'p40',value:0},{id:'e-a',studentId:'a',itemId:'e60',value:55}];(await import('/src/repaint.js')).repaint();});
    await panel.locator('[data-grade-export-panel] > summary').click();await panel.locator('[data-noor-grouping] > summary').click();await page.locator('[data-act="grade-noor-export"]').click();await panel.locator('[data-noor-alert]:not([hidden])').waitFor();
    await panel.locator('[data-noor-confirm]').check();const noorDownload=page.waitForEvent('download');await page.locator('[data-act="grade-noor-export"]').click();const noor=parseCsv(await readFile(await (await noorDownload).path(),'utf8'));assert.deepEqual(noor[0],['اسم الطالب','المهام الأدائية والمشاركة والتفاعل (40)','تقويمات تحريرية وتطبيقات عملية (60)']);assert.ok(noor.every(r=>r.length===3));assert.deepEqual(noor.find(r=>r[0]==='أحمد سالم'),['أحمد سالم','0','55']);assert.deepEqual(noor.find(r=>r[0]==='سعيد علي'),['سعيد علي','','']);
    record('n90_noor_exact_three_column_grouping','Actual UI requires teacher-confirmed suggested 40/60 assignments before real CSV download; exact three supplied headers, numeric 0/55, blanks for unrecorded groups. Manual entry label; no Noor call.');
    await page.screenshot({fullPage:true,path:output+'/390-noor.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:900});await page.screenshot({fullPage:true,path:output+'/1280-noor.png'});assert.deepEqual(errors,[]);
    await context.close();
    return checks;
  } finally {await browser?.close();if(server.listening)await new Promise(r=>server.close(r));if(ownedLease)console.log(lease('release'));await writeFile(output+'/result.json',JSON.stringify({checks,requests,ownedBrowserClosed:true,ownedServerStopped:true},null,2));}
}
