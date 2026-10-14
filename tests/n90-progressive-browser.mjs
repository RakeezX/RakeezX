import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {parseCsv} from '../src/lib/student-import.js';
import {decodeSyncV2Canonical} from '../src/lib/sync-v2.js';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
export async function browserFlow({q,owner}) {
 const checks=[],requests=[],root=resolve('.'),output='test-results/n90-progressive';
 await mkdir(output,{recursive:true});
 // Extend only the owned native synthetic fixture to represent seven mark columns + metadata (12 total).
 await q("update rakeezx.items set max=5 where id='i';insert into rakeezx.students(id,name) values('c','هند خالد'),('d','أحمد سالم');insert into rakeezx.enrollments(id,student_id,section_id) values('ec','c','section'),('ed','d','section');insert into rakeezx.scores(id,student_id,item_id,value) values('sc','c','i',3)");
 for(let i=2;i<=7;i++)await q('insert into rakeezx.items(id,teaching_id,name,max) values($1,\'t\',$2,5)',['i'+i,'بند '+i]);
 const entities=['years','terms','subjects','sections','teachings','students','enrollments','items','scores'];
 const server=createServer(async(req,res)=>{
  try {
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(pathname.startsWith('/__n90/')) {
    let body='';for await(const c of req)body+=c;const input=JSON.parse(body||'{}'),name=pathname.slice(7);let data;
    if(name==='auth')data={id:owner,source:'supabase-auth-user',verifiedAt:Date.now()};
    else if(name==='capability')data={scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1};
    else if(name==='grade-capability')data=(await q('select rakeezx.reviewed_grade_import_capability() result')).rows[0].result;
    else if(name==='fixture'){data={};for(const store of entities)data[store]=(await q(`select to_jsonb(t) row from rakeezx.${store} t where owner_id=$1`,[owner])).rows.map(r=>decodeSyncV2Canonical(store,r.row));}
    else if(name==='apply'){requests.push(input);data=(await q('select rakeezx.apply_reviewed_grade_import($1,$2,$3) result',[input.mutationId,input.deviceId,input.batch])).rows[0].result;}
    else throw Error('Unknown endpoint');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
   }
   const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
   res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message,code:e.code}));}
 });
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n90-progressive-grade-import-20261014.json',runId:'81f745f3-b78c-4114-863b-b1095dd6d312',url:base,timeoutMs:120000},async({createContext})=>{
   const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'});
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await openReadyServedDemo(page,base);
   const account=await page.evaluate(async()=> (await import('/tests/n90-account-fixture.mjs')).prepareAccount());assert.equal(account.ready,true);assert.equal(account.lease.editable,true);
   await page.goto(base+'/#/teaching/t/grades');await page.locator('[data-grade-transfer] > summary').click();
   const panel=page.locator('[data-grade-transfer]');
   assert.equal(await panel.locator('[data-grade-column]').count(),0);
   assert.equal(await panel.locator('[data-grade-export-panel]').getAttribute('open'),null);
   assert.doesNotMatch(await panel.innerText(),/NOT_VERIFIED|كاتب XLSX/);
   await page.screenshot({fullPage:true,path:output+'/390-choose.png'});
   let number=0;
   const file=async csv=>{const name='fixture-'+(++number)+'.csv';await page.locator('[data-change="grade-file"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(csv)});await page.waitForFunction(n=>document.querySelector('[data-grade-file-name]')?.textContent===n,name);};
   const review=async()=>{await page.locator('[data-act="grade-review"]').click();await panel.locator('[data-grade-review]').waitFor();};
   const cancel=async()=>{await page.locator('[data-act="grade-cancel"]').click();await page.waitForFunction(()=>!document.querySelector('[data-grade-file-name]')&&!document.querySelector('[data-grade-review]')&&document.querySelector('[data-change="grade-file"]')?.disabled===false);};
   const headers=['معرف الطالب','اسم الطالب','Exam (العظمى 5)',...Array.from({length:5},(_,i)=>`بند ${i+2} (العظمى 5)`),'الفصل','المادة','الفصل الدراسي','نوع الملف'];
   const csv=value=>[headers,['a','أحمد سالم',value,...Array(5).fill(''),'4/1','Math','Synthetic','كشف درجات ركيز'],['b','سعيد علي',0,...Array(5).fill(''),'4/1','Math','Synthetic','كشف درجات ركيز'],['c','هند خالد','',...Array(5).fill(''),'4/1','Math','Synthetic','كشف درجات ركيز']].map(r=>r.join(',')).join('\n');
   const state=async()=>(await q('select jsonb_agg(to_jsonb(s) order by id) data from rakeezx.scores s')).rows[0].data;
   const original=await state();
   await file(csv(7));
   assert.equal(await panel.locator('[data-grade-column]').count(),6); // no name/metadata fieldsets
   assert.equal(await panel.locator('[data-grade-mapping-details]').getAttribute('open'),null);
   assert.equal(await panel.locator('[data-grade-mapping-summary] li').count(),6);
   await review();
   assert.equal(await panel.locator('[data-grade-reviewed-mapping]').getAttribute('open'),null);
   const alert=await panel.locator('[role="alert"]').innerText();assert.match(alert,/أحمد سالم/);assert.match(alert,/Exam/);assert.match(alert,/القيمة 7/);assert.match(alert,/العظمى 5/);
   assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);assert.equal(requests.length,0);assert.deepEqual(await state(),original);
   await page.screenshot({fullPage:true,path:output+'/390-error.png'});
   checks.push({name:'n90_out_of_range_clear_block',status:'PASS',evidence:'12-column upload: actual UI displays row/student/Exam/value 7/max 5; whole batch confirm disabled, zero transport and native scores unchanged.'});
   await cancel();await file(csv(4));await review();
   assert.equal(await panel.locator('tbody tr').count(),2);assert.doesNotMatch(await panel.locator('table').innerText(),/a9000000|studentId|\/ a|\/ b/);
   assert.equal(await panel.locator('[data-grade-unchanged]').getAttribute('open'),null);
   await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();
   await page.evaluate(()=>window.n90OldConfirm=document.querySelector('[data-act="grade-confirm"]'));
   await cancel();assert.equal(requests.length,0);assert.deepEqual(await state(),original);assert.equal(await page.locator('[data-act="grade-confirm"]').count(),0);
   // Actual handler with delayed File.arrayBuffer, followed by visible cancel.
   await page.evaluate(()=>{
    window.n90Pending=import('/src/views/grades.js').then(({default:view})=>view.actions['grade-file']({files:[{name:'late.csv',size:20,arrayBuffer:()=>new Promise(r=>window.n90Release=()=>r(new TextEncoder().encode('اسم الطالب,Exam\nأحمد سالم,4').buffer))}]},null,{id:'t'}));
   });
   await page.waitForFunction(()=>!!window.n90Release);await cancel();await page.evaluate(async()=>{window.n90Release();await window.n90Pending;});
   assert.equal(await panel.locator('[data-grade-file-name]').count(),0);assert.equal(requests.length,0);
   // The next upload has fresh, unchecked confirmations and commits only changed cells.
   await file(csv(4));await review();assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
   await page.evaluate(async()=>{const view=(await import('/src/views/grades.js')).default;await view.actions['grade-confirm'](window.n90OldConfirm);});assert.equal(requests.length,0);assert.deepEqual(await state(),original);
   await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await page.locator('[data-act="grade-confirm"]').click();
   await page.getByRole('status').filter({hasText:'تم تأكيد الدفعة كاملة'}).waitFor();assert.equal(requests.length,1);
   const committed=await state();assert.equal(Number(committed.find(s=>s.student_id==='a').value),4);assert.equal(Number(committed.find(s=>s.student_id==='b').value),0);assert.equal(Number(committed.find(s=>s.student_id==='c').value),3);
   assert.equal(requests[0].batch.cells.length,2);
   console.log('PASS native 4/0/blank and cancellation');
   const guard=await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');return (await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard.cloudAccess({operation:'dispatch',authenticatedUserId:cloud.user.id});});assert.equal(guard.reason,'command-owner-missing');
   checks.push({name:'n90_valid_zero_blank_cancel_guards',status:'PASS',evidence:'Actual account store/ownership guard + native RPC: cancel and delayed-read cancellation no write; new review clears acknowledgements and disconnected old confirmation is inert; confirmed 4 and 0, blank preserves original 3; ownerless dispatch still denied.'});
   // Duplicate external columns and unknown names require explicit handling; no inferred item.
   await file('اسم الطالب,Exam,Exam,unknown\nغير معروف,4,2,3\nأحمد سالم,4,2,3');
   assert.notEqual(await panel.locator('[data-grade-mapping-details]').getAttribute('open'),null);assert.equal(await panel.locator('[data-grade-mapping-summary] li').count(),0);
   await panel.locator('[data-grade-column="1"] [data-grade-kind]').selectOption('i');await review();
   assert.match(await panel.locator('[role="alert"]').allTextContents().then(r=>r.join(' ')),/طالب غير معروف/);assert.match(await panel.locator('[role="alert"]').allTextContents().then(r=>r.join(' ')),/اسم ملتبس/);assert.equal(await page.locator('[data-act="grade-confirm"]').isDisabled(),true);assert.equal(requests.length,1);
   await page.locator('[data-act="grade-edit-mapping"]').click();
   await panel.locator('[data-grade-column="1"] [data-grade-kind]').selectOption('new');await panel.locator('[data-grade-new-name]').fill('بند يدوي');await panel.locator('[data-grade-new-name]').press('Tab');await panel.locator('[data-grade-new-max]').fill('5');await panel.locator('[data-grade-new-max]').press('Tab');
   await page.locator('[data-act="grade-review"]').click();await panel.locator('[role="status"]').filter({hasText:'GRADE_NEW_ITEM_CONFIRM_REQUIRED'}).waitFor();assert.match(await panel.locator('[role="status"]').innerText(),/GRADE_NEW_ITEM_CONFIRM_REQUIRED/);assert.equal(requests.length,1);
   await cancel();
   checks.push({name:'n90_upload_mapping_review_flow',status:'PASS',evidence:'Real DOM/file handler/CSS: 12-column Rakeez shape yields 6 exact manual suggestions and no name/metadata rows; collapsed edit; changed-only review. Duplicate/unknown external file opens exceptions, unknown/ambiguous identities and unconfirmed new item cannot write.'});
   for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});await file(csv(2));
    await page.screenshot({fullPage:true,path:output+'/'+width+'-mapping.png'});
    assert.equal(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    await review();assert.equal(await panel.locator('tbody tr').count(),1);await page.screenshot({fullPage:true,path:output+'/'+width+'-review.png'});
    await cancel();
   }
   await panel.locator('[data-grade-export-panel] > summary').click();
   await panel.locator('[data-grade-export-item][value="i2"]').uncheck();
   await file(csv(4));await cancel();await panel.locator('[data-grade-export-panel] > summary').click();assert.equal(await panel.locator('[data-grade-export-item][value="i2"]').isChecked(),false);
   await context.setOffline(true);
   const download=page.waitForEvent('download');await page.locator('[data-act="grade-noor-export"]').click();const d=await download;const bytes=(await readFile(await d.path())).toString('utf8');
   assert.match(bytes,/ليست قالب رفع رسمي/);assert.match(bytes,/Exam \(العظمى 5\)/);assert.doesNotMatch(bytes,/بند 2/);const exported=parseCsv(bytes),mark=exported[0].indexOf('Exam (العظمى 5)');assert.equal(exported.find(r=>r[0]==='b')[mark],'0');assert.equal(exported.find(r=>r[0]==='c')[mark],'3');
   await context.setOffline(false);
   // A reload checkpoint rehydrates the same synthetic native fixture with current scores.
   await page.reload();await openReadyServedDemo(page,base);const checkpoint=await page.evaluate(async()=>{await (await import('/tests/n90-account-fixture.mjs')).prepareAccount();const s=await import('/src/store.js');return {owner:s.getActiveWorkspace().authUserId,ready:s.state.ready,value:s.state.scores.find(r=>r.studentId==='a'&&r.itemId==='i').value};});assert.equal(checkpoint.owner,owner);assert.equal(checkpoint.ready,true);assert.equal(Number(checkpoint.value),4);
   assert.deepEqual(errors,[]);
   checks.push({name:'n90_mobile_density_export',status:'PASS',evidence:'390/1280 real app screenshots, contained panel, collapsed export. Selection survives import repaint; offline loaded-document Noor-aid CSV preserves 0/3 and excludes unchecked item. Fresh reload checkpoint reads correct synthetic owner and mark 4. SW/cache certification reused, not rerun.'});
  });
  console.log('PASS all N90 progressive UI checks');return checks;
 }finally {await new Promise(r=>server.close(r));await writeFile(output+'/result.json',JSON.stringify({checks,requests,ownedServerStopped:true,isolatedBrowserFinally:true},null,2));}
}

