import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { xlsxFixtures } from './n90-xlsx-fixtures.mjs';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n90-reviewed-grade-transfer-20261013.json';
const leaseScript='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const token='ccf493ea-4eee-4010-b002-f93de6e8118a';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',token,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true});
export async function browserFlow({q,owner}) {
  const root=resolve('.'),output='test-results/n90-browser',checks=[];let loss=false,requests=[];
  const capability={scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1};
  const entities={years:'years',terms:'terms',subjects:'subjects',sections:'sections',teachings:'teachings',students:'students',enrollments:'enrollments',items:'items',scores:'scores'};
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://127.0.0.1').pathname;
      if(pathname.startsWith('/__n90/')) {
        let body='';for await(const c of req)body+=c;const input=JSON.parse(body||'{}'),name=pathname.slice(7);let data;
        if(name==='auth')data={id:owner,source:'supabase-auth-user',verifiedAt:Date.now()};
        else if(name==='capability')data=capability;
        else if(name==='grade-capability')data=(await q('select rakeezx.reviewed_grade_import_capability() result')).rows[0].result;
        else if(name==='fixture') {
          data={};for(const [store,table] of Object.entries(entities))data[store]=(await q(`select to_jsonb(t) row from rakeezx.${table} t where owner_id=$1`,[owner])).rows.map(r=>decodeSyncV2Canonical(store,r.row));
        } else if(name==='apply') {
          requests.push(structuredClone(input));
          data=(await q('select rakeezx.apply_reviewed_grade_import($1,$2,$3) result',[input.mutationId,input.deviceId,input.batch])).rows[0].result;
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
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await openReadyServedDemo(page,base);
    const account=await page.evaluate(async()=> (await import('/tests/n90-account-fixture.mjs')).prepareAccount());
    assert.equal(account.ready,true);assert.equal(account.lease.editable,true);assert.deepEqual(account.outbox,[]);
    await page.goto(base+'/#/teaching/t/grades');
    await page.locator('[data-grade-transfer] summary').click();
    let fileNumber=0;
    const file=async csv=>{
      const name='grades-'+(++fileNumber)+'.csv';
      await page.locator('[data-change="grade-file"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(csv)});
      try { await page.waitForFunction(name=>document.querySelector('[data-grade-file-name]')?.textContent===name,name,{timeout:5000}); }
      catch(e){await writeFile(output+'/file-failure.txt',await page.locator('[data-grade-transfer]').innerText());throw e;}
    };
    const map=async()=>{await page.locator('[data-grade-name]').selectOption('0');await page.locator('[data-grade-column="1"] [data-grade-kind]').selectOption('i');await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();};
    const score=async()=>Number((await q("select value from rakeezx.scores where id='s'")).rows[0].value);
    const before=await score();
    await file('name,grade\nأحمد سالم,١٢٫٥\nسعيد علي,0');await map();
    assert.equal(requests.length,0);assert.equal(await score(),before);
    assert.match(await page.locator('[data-grade-review]').innerText(),/استبدالات/);
    await page.locator('[data-act="grade-confirm"]').click();assert.equal(requests.length,0);
    await page.locator('[data-act="grade-cancel"]').click();await page.locator('[data-grade-name]').waitFor({state:'detached'});assert.equal(await score(),before);
    checks.push({name:'account_local_preview_cancel',status:'PASS',evidence:'Actual account DOM/handlers and store with ownership guard; CSV mapping/review/cancel and missing confirmation make zero grade RPC calls.'});
    const xlsx=await xlsxFixtures();
    const xlsxResults=await page.evaluate(async fixtures=>{
      const {readGradeFile}=await import('/src/lib/grade-transfer-parsers.js');const result={};
      for(const [name,bytes] of Object.entries(fixtures))try{result[name]={rows:await readGradeFile(new File([new Uint8Array(bytes)],name+'.xlsx'))};}catch(e){result[name]={error:e.message};}
      return result;
    },Object.fromEntries(Object.entries(xlsx).map(([k,v])=>[k,[...v]])));
    assert.equal(xlsxResults.valid.rows[1][1],9);assert.match(xlsxResults.formula.error,/FORMULA/);assert.match(xlsxResults.duplicate.error,/DUPLICATE/);
    checks.push({name:'xlsx_actual_parser',status:'PASS',evidence:'Real browser DOMParser + audited N12 reader reads first-sheet XLSX numeric 9; actual formula-only and duplicate-address XLSX cells rejected before matching.'});
    await file('name,grade\nأحمد سالم,6\nأحمد سالم,8');await map();assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);assert.match(await page.locator('[data-grade-review]').innerText(),/مكرر/);
    await file('name,grade\nأحمد سالم,١٢٫٥\nسعيد علي,0');await map();
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'/390-review.png',fullPage:true});
    const overflow=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,width:innerWidth,scroll:document.documentElement.scrollWidth,
      elements:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.width>innerWidth||e.left<0||e.right>innerWidth+2).slice(0,25)}));
    await writeFile(output+'/overflow.json',JSON.stringify(overflow,null,2));assert.equal(overflow.overflow,false,JSON.stringify(overflow));
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:output+'/1280-review.png',fullPage:true});
    loss=true;await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();
    await page.getByRole('alert').filter({hasText:'طلب محفوظ:'}).waitFor();assert.equal(await score(),12.5);assert.equal(requests.length,1);
    const durable=await page.evaluate(async()=> (await import('/src/store.js')).gradeImportRecovery());assert.equal(durable.length,1);assert.equal(durable[0].ownerId,owner);assert.equal(durable[0].envelopeLocked,true);
    await q("update rakeezx.scores set value=9 where id='s'");
    // A later canonical pull before retry must not be regressed by the saved receipt.
    const newer=(await q("select to_jsonb(s) row from rakeezx.scores s where id='s'")).rows[0].row;
    await page.evaluate(async row=>{const db=await import('/src/lib/db.js'),sync=await import('/src/lib/sync-v2.js');await db.put('scores',sync.decodeSyncV2Canonical('scores',row));},newer);
    await page.locator('[data-act="grade-retry"]').click();await page.getByRole('status').filter({hasText:'تم تأكيد الدفعة كاملة'}).waitFor();
    assert.equal(requests.length,2);assert.deepEqual(requests[1],requests[0]);assert.equal(await score(),9);
    assert.equal(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).get('scores','s')).value),9);
    assert.equal((await page.evaluate(async()=> (await import('/src/store.js')).gradeImportRecovery())).length,0);
    checks.push({name:'account_native_atomic_lost_ack',status:'PASS',evidence:'Actual UI→store→owner-bound durable command→HTTP→native exact RPC; lost response after atomic commit is explicit recovery; retry identical ID/envelope adopts same receipt and does not overwrite later server 9.'});
    // Refresh only canonical local snapshot for the next independent review.
    await page.evaluate(async()=> (await import('/tests/n90-account-fixture.mjs')).prepareAccount());
    await page.goto(base+'/#/teaching/t/grades');await page.locator('[data-grade-transfer] summary').click();
    await file('name,grade\nأحمد سالم,10');await map();await q("update rakeezx.items set max=19 where id='i'");
    await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();
    await page.getByRole('alert').filter({hasText:'مرفوض'}).waitFor();assert.equal(await score(),9);
    checks.push({name:'account_native_stale',status:'PASS',evidence:'Item maximum changed after actual review; native PT409 rejected entire account command and preserved marks; rejected state shown.'});
    const dirty=await page.evaluate(async()=>{
      const s=await import('/src/store.js');const r=s.reviewGradeImport('t',{rows:[['name','grade'],['أحمد سالم','8']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
      try{await s.confirmGradeImport(r,{approved:true,overwriteConfirmed:true});return null;}catch(e){return e.message;}
    });assert.match(dirty,/المزامنة/);assert.equal(requests.length,3);
    await page.locator('[data-grade-retire-confirm]').check();await page.locator('[data-act="grade-retire"]').click();
    await page.locator('[data-act="grade-retire"]').waitFor({state:'detached'});
    const retired=await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('outbox')).filter(r=>r.command==='score:grade_import'));
    assert.equal(retired.length,1);assert.equal(retired[0].state,'superseded');assert.equal(retired[0].recoveryReason,'n90-explicit-rejected-disposition');
    checks.push({name:'account_clean_outbox_rejected_disposition',status:'PASS',evidence:'Dirty/rejected outbox blocks new import before transport. Teacher explicitly retires only definitively rejected batch; original identity/envelope/rejection preserved, no grade changed.'});
    await file('name,grade\nأحمد سالم,4');
    await page.locator('[data-grade-name]').selectOption('0');
    await page.locator('[data-grade-column="1"] [data-grade-kind]').selectOption('new');
    await page.locator('[data-grade-new-name]').fill('رصد يدوي');await page.locator('[data-grade-new-name]').press('Tab');
    await page.locator('[data-grade-new-max]').fill('5');await page.locator('[data-grade-new-max]').press('Tab');
    await page.locator('[data-act="grade-review"]').click();await page.getByRole('status').filter({hasText:'GRADE_NEW_ITEM_CONFIRM_REQUIRED'}).waitFor();
    assert.equal(requests.length,3);
    await page.locator('[data-grade-new-confirm]').check();await page.locator('[data-act="grade-review"]').click();await page.locator('[data-grade-review]').waitFor();
    await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();
    await page.getByRole('status').filter({hasText:'تم تأكيد الدفعة كاملة'}).waitFor();assert.equal(requests.length,4);
    const newItem=(await q("select * from rakeezx.items where name='رصد يدوي'")).rows;assert.equal(newItem.length,1);assert.equal(newItem[0].score_mode,'direct');assert.equal(Number(newItem[0].max),5);
    assert.equal(Number((await q('select value from rakeezx.scores where item_id=$1',[newItem[0].id])).rows[0].value),4);
    checks.push({name:'account_explicit_new_item',status:'PASS',evidence:'Actual UI refuses unconfirmed new maximum, then explicitly named manual 5-point item + reviewed grade 4 commit together through native RPC.'});
    const ownerDrift=await page.evaluate(async()=>{
      const s=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js');const oldUser=cloud.user,oldSession=cloud.session;
      const review=s.reviewGradeImport('t',{rows:[['name','grade'],['أحمد سالم','8']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
      try{cloud.setMockAuth({id:'b9000000-0000-4000-8000-000000000002'}, {...oldSession,user:{id:'b9000000-0000-4000-8000-000000000002'}});await s.confirmGradeImport(review,{approved:true,overwriteConfirmed:true});return null;}
      catch(e){return e.message;}finally{cloud.setMockAuth(oldUser,oldSession);}
    });assert.ok(ownerDrift);assert.equal(requests.length,4);
    await context.setOffline(true);
    const offlineCommit=await page.evaluate(async()=>{
      const s=await import('/src/store.js'),r=s.reviewGradeImport('t',{rows:[['name','grade'],['أحمد سالم','8']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
      const lease=s.getOfflineLeaseStatus();try{await s.confirmGradeImport(r,{approved:true,overwriteConfirmed:true});return {lease};}catch(e){return {lease,error:e.message};}
    });assert.equal(offlineCommit.lease.editable,true);assert.match(offlineCommit.error,/اتصال/);assert.equal(requests.length,4);
    await context.setOffline(false);
    const denial=await page.evaluate(async()=>{
      const store=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js'),guard=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard;
      const access=guard.cloudAccess({operation:'dispatch',authenticatedUserId:cloud.user.id});
      const review=store.reviewGradeImport('t',{rows:[['name','grade'],['أحمد سالم','10']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
      (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().invalidate('synthetic-expired');
      try{await store.confirmGradeImport(review,{approved:true,overwriteConfirmed:true});return {access};}catch(e){return {access,error:e.message};}
    });assert.equal(denial.access.reason,'command-owner-missing');assert.ok(denial.error);assert.equal(requests.length,4);
    checks.push({name:'account_owner_and_lease_entry',status:'PASS',evidence:'Actual standalone ownerless dispatch remains command-owner-missing; invalidated N49 lease rejects actual store confirm before transport.'});
    // Real service worker shell cache, including new startup modules. No remote calls.
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.waitForFunction(async()=>{const c=await caches.open('rakeezx-v57');return !!navigator.serviceWorker.controller && (await Promise.all(['grade-transfer.js','grade-transfer-parsers.js','grade-transfer-export.js'].map(p=>c.match('/src/lib/'+p)))).every(Boolean);});
    await context.setOffline(true);
    const download=page.waitForEvent('download');await page.locator('[data-act="grade-noor-export"]').click();const d=await download;const bytes=await readFile(await d.path());
    assert.match(d.suggestedFilename(),/مراجعة للرصد في نور/);assert.match(bytes.toString('utf8'),/ليست قالب رفع رسمي/);assert.match(bytes.toString('utf8'),/العظمى/);
    const offline=await page.evaluate(async()=>{const s=await import('/src/store.js');return {owner:s.getActiveWorkspace().authUserId,ready:s.state.ready,roster:s.teachingContext('t').roster.length};});assert.equal(offline.owner,owner);assert.equal(offline.ready,true);assert.equal(offline.roster,2);
    checks.push({name:'offline_account_read_export_shell',status:'PASS',evidence:'Actual SW v57 caches new dependency; same live account checkpoint while offline reads roster and downloads Noor aid CSV. No remote fixture/account created.'});
    // A fresh document also boots and loads the new grade modules solely from SW.
    await page.evaluate(async()=>{sessionStorage.setItem('rakeezx-demo-session-v1','preparing');localStorage.removeItem((await import('/src/lib/cloud.js')).AUTH_STORAGE_KEY);});
    await page.reload();await openReadyServedDemo(page,base);
    const checkpoint=await page.evaluate(async()=>{const s=await import('/src/store.js');return {workspace:s.getActiveWorkspace(),ready:s.state.ready,teachingId:s.teachings()[0].id};});
    assert.equal(checkpoint.workspace.databaseName,'rakeezx-demo');assert.equal(checkpoint.ready,true);
    await page.goto(base+'/#/teaching/'+checkpoint.teachingId+'/grades');await page.locator('[data-grade-transfer] summary').click();
    const shellDownload=page.waitForEvent('download');await page.locator('[data-act="grade-export"]').click();assert.match((await shellDownload).suggestedFilename(),/درجات ركيز/);
    checks.push({name:'offline_shell_reload',status:'PASS',evidence:'Actual offline reload boots approved Demo fixture in a new document; same checkpoint confirms database/ready/teaching; real grade DOM imports all new modules from SW and downloads CSV.'});
    await context.setOffline(false);await context.close();assert.deepEqual(errors,[]);
    console.log('PASS actual_account_UI_native_transport');return checks;
  }finally {
    await browser?.close();await new Promise(r=>server.close(r));if(ownedLease)console.log(lease('release'));
    await writeFile(output+'/result.json',JSON.stringify({checks,requests,ownedBrowserClosed:true,ownedServerStopped:true},null,2));
  }
}
