import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { xlsxFixtures } from './n90-xlsx-fixtures.mjs';
import { parseCsv } from '../src/lib/student-import.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
// Reuse the existing N90 test-only ZIP writer for a fourth-column workbook.
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
function xlsxZip(files){const entries=[],directory=[];let offset=0;
  for(const [name,value] of Object.entries(files)){
    const data=Buffer.from(value),filename=Buffer.from(name),crc=crc32(data),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
    entries.push(local,filename,data);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);directory.push(central,filename);offset+=local.length+filename.length+data.length;
  }const body=Buffer.concat(entries),central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(body.length,16);return Buffer.concat([body,central,end]);
}

import { createRequire } from 'node:module';
// N106 has liveAuthorizationRef: use the shared leased browser phase, never the isolated eligibility path.
async function withLeasedBrowser(options, check) {
 const lease=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8'));assert.equal(lease.owner.token,options.runId);assert.equal(lease.taskId,'continuous-n106-koshoof-followup-ux-identity-mapping-20261015');
 const {chromium}=createRequire('C:/Users/Abody/Projects/RakeezX/package.json')('playwright');
 const browser=await chromium.launch({headless:true});
 const origin=new URL(options.url).origin;
 const timer=setTimeout(()=>browser.close(),options.timeoutMs);timer.unref();
 try { return await check({createContext:async opts=>{
   const c=await browser.newContext({...opts,serviceWorkers:'block'});
   await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
   return c;
 }}); } catch(error) { for(const c of browser.contexts())for(const p of c.pages()){await writeFile('test-results/n106-ui/failure.txt',await p.locator('body').innerText());await p.screenshot({path:'test-results/n106-ui/failure.png',fullPage:true});}throw error; } finally {clearTimeout(timer);await browser.close();}
}
// Match the current class-entry guard using an owner-bound synthetic provisioning receipt.
async function prepareN106Account() {
 const result=await (await import('/tests/n90-account-fixture.mjs')).prepareAccount();
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),l=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
 const owner=result.workspace.authUserId,receipt={ownerId:owner,contractVersion:1,foundationHash:'n106-synthetic-foundation'};
 await d.put('device',{...s.state.device,accountProvisioningReceipt:receipt});
 s.activateWorkspace({...result.workspace,workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([owner,null,null,receipt])});
 await l.renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
 await s.init();s.assertClassOperationsAccess('t');
 return {ready:s.state.ready,lease:s.getOfflineLeaseStatus(),outbox:await d.getAll('outbox'),owner:s.getActiveWorkspace().authUserId};
}
export async function browserFlow({q,owner}) {
 const root=resolve('.'),output='test-results/n106-ui',checks=[],requests=[],screenshots=[];let loss=false;
 const capability={scoreDomainVersion:1,restoreProtocol:'CORE_V2',backupVersion:5,copyDomainVersion:1,n94SubitemVersion:1};
 const entities={years:'years',terms:'terms',subjects:'subjects',sections:'sections',teachings:'teachings',students:'students',enrollments:'enrollments',items:'items',scores:'scores'};
 await mkdir(output,{recursive:true});
 await q("update rakeezx.scores set value=4 where id='s';delete from rakeezx.items where id='auto';update rakeezx.items set max=10,name='المشاركة والتفاعل' where id='i';insert into rakeezx.students(id,name) values('c','هند خالد'),('du1','ناصر حمد'),('du2','ناصر حمد');insert into rakeezx.enrollments(id,student_id,section_id) values('ec','c','section'),('edu1','du1','section'),('edu2','du2','section');insert into rakeezx.sections(id,year_id,grade,label,name) values('empty-section','y',5,'1','5/1');insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('empty-t','empty-section','subject','term');insert into rakeezx.items(id,teaching_id,name,max) values('empty-i','empty-t','اختبار',5)");
 const definitions=[['i2','الواجبات',10],['i3','الأنشطة والمشاريع',20],['i4','الاختبارات القصيرة',30],['i5','الاختبار النهائي',30]];
 for(const [id,name,max] of definitions)await q("insert into rakeezx.items(id,teaching_id,name,max) values($1,'t',$2,$3)",[id,name,max]);
 for(const [id,,] of definitions)await q("insert into rakeezx.scores(id,student_id,item_id,value) values($1,'a',$2,0)",['s-'+id,id]);
 for(const id of ['i',...definitions.map(i=>i[0])])await q("insert into rakeezx.scores(id,student_id,item_id,value) values($1,'c',$2,0)",['c-'+id,id]);
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
 const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
 const state=async()=> (await q("select jsonb_build_object('students',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.students s),'scores',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.scores s),'enrollments',(select jsonb_agg(to_jsonb(e) order by id) from rakeezx.enrollments e)) result")).rows[0].result;
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  await withLeasedBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n106-koshoof-followup-ux-identity-mapping-20261015.json',runId:'ad277a1f-fc36-4411-99ce-7b7542f8b321',url:base,timeoutMs:180000},async({createContext})=>{
   const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
   await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await openReadyServedDemo(page,base);
   const account=await page.evaluate(prepareN106Account);assert.equal(account.ready,true);assert.equal(account.lease.editable,true);assert.deepEqual(account.outbox,[]);
   const screenshot=async name=>{await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({fullPage:true,path:output+'/'+name});screenshots.push(name);};
   const panel=page.locator('[data-grade-transfer]'),imp=page.locator('[data-grade-import-panel]'),exp=page.locator('[data-grade-export-panel]');
   const act=name=>page.locator(`[data-act="${name}"]`);
   const switchPanel=async name=>{await page.locator(`[data-act="koshoof-mode"][data-panel="${name}"]`).click();await (name==='import'?imp:exp).waitFor();};
   const setMode=async name=>{const button=imp.locator(`[data-mode="${name}"]`),old=await button.elementHandle();await button.click();await page.waitForFunction(el=>!el.isConnected,old);await old.dispose();};
   let number=0;
   const file=async(csv,extension='csv')=>{const name='كشف-'+(++number)+'.'+extension;await page.locator('[data-change="grade-file"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.isBuffer(csv)?csv:Buffer.from(csv)});await page.waitForFunction(n=>document.querySelector('[data-grade-file-name]')?.textContent===n,name);};
   const review=async()=>{await act('grade-review').click();await imp.locator('[data-grade-review]').waitFor();};
   const cancel=async()=>{await act('grade-cancel').click();await page.locator('[data-change="grade-file"]').waitFor();};
   const download=async name=>{const event=page.waitForEvent('download');await act(name).click();const d=await event,csv=await readFile(await d.path(),'utf8');return {name:d.suggestedFilename(),csv,rows:parseCsv(csv)};};
   const initial=await state();
   for(const suffix of ['students','grades']) {
    await page.goto(base+'/#/teaching/t/'+suffix);
    const entry=page.getByRole('link',{name:'استيراد وتصدير الكشوف',exact:true});try {await entry.waitFor({timeout:8000});}catch(error){console.error('NAV DEBUG',suffix,await page.evaluate(async()=>{const s=await import('/src/store.js');let err;try{s.assertClassOperationsAccess('t');}catch(e){err=e.message;}return {url:location.href,err,ready:s.state.ready,workspace:s.getActiveWorkspace(),teaching:s.getTeaching('t'),body:document.body.innerText};}));throw error;}assert.equal(await entry.count(),1);
    if(suffix==='students') {
     assert.equal(await page.locator('.topbar__actions [data-act="file-import"]').count(),1);
     assert.equal(await page.getByRole('button',{name:'إضافة سريعة',exact:true}).count()>=1,true);
    }
    assert.equal(await entry.getAttribute('href'),'#/teaching/t/koshoof');await entry.click();await imp.waitFor();
   }
   for(const id of ['t','empty-t']) {await page.goto(base+'/#/teaching/'+id);await page.locator('.class-hub,.empty').first().waitFor();assert.equal(await page.locator('.roster-entry-actions [data-act="file-import"]').count(),0);assert.equal(await page.locator('[data-act="file-export"]').count(),0);if(id==='t')assert.equal(await page.locator('a[href="#/teaching/t/koshoof"]').count(),1);else for(const action of ['paste-names','add-student']){await act(action).click();await page.locator(action==='paste-names'?'#names-box':'#new-student').waitFor();await page.getByRole('button',{name:'إلغاء',exact:true}).click();}}
   record('n106_single_entrance_roster_grade_and_no_duplicate_hub_buttons','Actual account routes: one unified roster/grade entry, one populated hub tile, empty hub paste/add dialogs retained.');
   const navGuard=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),v=(await import('/src/views/students.js')).default;
    const t=s.getTeaching('t'),sec=s.getSection(t.sectionId),saved={...sec},hash=location.hash;
    sec.archived=true;sec.status='archived';const archivedHidden=!v.topActions({id:'t'});v.actions['file-import'](null,{preventDefault(){}},{id:'t'});Object.keys(sec).forEach(k=>delete sec[k]);Object.assign(sec,saved);
    const session=c.session;c.setMockAuth({id:'foreign-owner'},session);const foreignHidden=!v.topActions({id:'t'});v.actions['file-import'](null,{preventDefault(){}},{id:'t'});c.setMockAuth(session.user,session);
    const owner=t.ownerId;t.ownerId='foreign-owner';const foreignTeachingHidden=!v.topActions({id:'t'});v.actions['file-import'](null,{preventDefault(){}},{id:'t'});t.ownerId=owner;
    return {archivedHidden,foreignHidden,foreignTeachingHidden,unchanged:hash===location.hash};
   });assert.deepEqual(navGuard,{archivedHidden:true,foreignHidden:true,foreignTeachingHidden:true,unchanged:true});
   record('n106_archived_foreign_owner_navigation','Actual account store/UI rejects archived section, foreign Auth and foreign teaching owner before navigation.');


   await page.goto(base+'/#/teaching/t/grades');await page.getByRole('link',{name:'استيراد وتصدير الكشوف',exact:true}).waitFor();assert.equal(await panel.isVisible(),false);await screenshot('390-default.png');
   await page.goto(base+'/#/teaching/empty-t/grades');await page.getByText('الفصل بلا طلاب بعد',{exact:true}).waitFor();assert.equal(await panel.isVisible(),false);await page.getByRole('link',{name:'كشف الطلاب',exact:true}).waitFor();await screenshot('390-empty.png');
   await page.goto(base+'/#/teaching/empty-t/koshoof?import=1');await imp.waitFor();assert.equal(await exp.isVisible(),false);assert.equal(await act('grade-import-mode').count(),2);assert.equal(await imp.locator('[data-mode="names"]').getAttribute('aria-pressed'),'true');assert.equal(await imp.locator('[data-noor-item]:visible').count(),0);
   await page.goto(base+'/#/teaching/t/koshoof?export=1');await exp.waitFor();assert.equal(await imp.isVisible(),false);assert.equal(await page.locator('[data-noor-grouping]').getAttribute('open'),null);
   record('separate_panels_routes_empty_class','Actual current application: default grade table and empty student CTA unobstructed; ?import=1 / ?export=1 open only requested panel; exactly two import mode buttons, names-only default.');
   assert.equal(await exp.locator('[data-act="grade-template"]').count(),0);
   await page.locator('[data-grade-export-format]').selectOption('csv');
   const filled=await download('grade-export'),namesDownload=await download('grade-names-export');
   assert.equal(namesDownload.rows[0].length,1);assert.ok(namesDownload.rows.length>1);
   assert.equal(namesDownload.name,'كشف أسماء طلاب فصل الرابع الابتدائي 1 - ركيز المعلم.csv');
   assert.equal(filled.name,'كشف درجات طلاب فصل الرابع الابتدائي 1 - ركيز المعلم.csv');
   assert.equal(filled.rows.find(r=>r[0]==='أحمد سالم')[filled.rows[0].indexOf('المشاركة والتفاعل (العظمى 10)')],'4');
   await switchPanel('import');const blank=await download('grade-template');
   assert.equal(blank.name,'نموذج أسماء الطلاب - ركيز المعلم.csv');assert.deepEqual(blank.rows[0],['اسم الطالب']);assert.ok(blank.rows.slice(1).every(r=>r.every(v=>!v)));
   await file((await import('../src/lib/grade-transfer-export.js')).exportNamesTemplate());await review();assert.equal(requests.length,0);await cancel();await switchPanel('export');
   assert.equal(await page.locator('[data-grade-export-ids]').count(),0);
   await page.locator('[data-noor-grouping] > summary').click();assert.match(await page.locator('[data-noor-totals]').innerText(),/40 ← 40 · 60 ← 60/);
   assert.equal(await page.locator('[data-noor-item]').count(),5);for(const options of await page.locator('[data-noor-item]').evaluateAll(es=>es.map(e=>[...e.options].map(o=>o.textContent))))assert.deepEqual(options,['اختر','40','60']);
   await act('grade-noor-export').click();await page.locator('[data-noor-alert]:visible').waitFor();assert.match(await page.locator('[data-noor-alert]').innerText(),/أكد/);
   await page.locator('[data-noor-confirm]').check();const noor=await download('grade-noor-export');assert.ok(noor.rows.every(r=>r.length===3));assert.deepEqual(noor.rows.find(r=>r[0]==='هند خالد'),['هند خالد','0','0']);assert.deepEqual(noor.rows.find(r=>r[0]==='سعيد علي'),['سعيد علي','','']);
   await page.locator('[data-noor-item="i"]').selectOption('60');assert.equal(await page.locator('[data-noor-confirm]').isChecked(),false);assert.match(await page.locator('[data-noor-totals]').innerText(),/40 ← 30 · 60 ← 70/);await page.locator('[data-noor-confirm]').check();await act('grade-noor-export').click();assert.match(await page.locator('[data-noor-alert]').innerText(),/يساوي 40 و60/);await page.locator('[data-noor-item="i"]').selectOption('40');
   record('n106_names_template_and_populated_exports','Actual downloads: names-only, names+five populated grade columns, safe actual class label, empty names template inside Import and no template in Export; optional ID is explicit.');
   record('n90_noor_compact_mapping_exact_40_60_and_three_columns','Five short 40/60 menus, visible totals, missing consent blocked; 30/70 rejected after reassignment and consent reset. Exact 40/60 produces precisely three manual-review columns; all-zero student remains 0/0 and missing marks remain blank.');
   await switchPanel('import');await setMode('grades');await file(filled.csv);assert.equal(await imp.locator('[data-grade-mapping-details]').getAttribute('open'),null);assert.match(await imp.locator('[data-grade-mapping-summary]').innerText(),/بنود يدوية مرتبطة: 5/);assert.equal(requests.length,0);await cancel();
   record('n106_exported_rakeez_csv_autolinks','Upload actual downloaded populated CSV: all five persisted manual items linked and advanced mapping collapsed; no request.');
   await file('اسم الطالب,اختبار إضافي (العظمى 7.50)\nأحمد سالم,0');
   assert.equal(await imp.locator('[data-grade-mapping-details]').getAttribute('open'),'');
   assert.equal(await imp.locator('[data-grade-new-name]').inputValue(),'اختبار إضافي');assert.equal(await imp.locator('[data-grade-new-max]').inputValue(),'7.5');assert.equal(await imp.locator('[data-grade-new-confirm]').isChecked(),false);
   await act('grade-review').click();await page.getByText(/أكد إنشاء كل بند جديد/).waitFor();assert.match(await imp.innerText(),/أكد إنشاء كل بند جديد/);assert.equal(requests.length,0);
   await imp.locator('[data-grade-new-confirm]').check();await review();await act('grade-confirm').click();assert.equal(requests.length,0);assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);await cancel();await setMode('names');
   record('n106_new_item_explicit_confirmation','Actual file handler prefills unique new manual name/max, rejects unchecked item, and final unchecked review sends zero RPC.');
   await switchPanel('import');const csv='اسم الطالب,المشاركة والتفاعل (العظمى 10)\nأحمد سالم,12\nسعيد علي,0\nهند خالد,';
   await file(csv);assert.equal(await imp.locator('[data-grade-column]').count(),0);await review();assert.match(await imp.locator('[data-grade-review]').innerText(),/أسماء جديدة/);assert.equal(requests.length,0);assert.deepEqual(await state(),initial);await screenshot('390-names-review.png');
   await setMode('grades');assert.equal(await imp.locator('[data-grade-review]').count(),0);assert.equal(await imp.locator('[data-grade-file-name]').count(),1);assert.equal(await imp.locator('[data-grade-mapping-details]').getAttribute('open'),null);await review();assert.match(await imp.innerText(),/12→10/);await screenshot('390-grades-review.png');
   await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await page.evaluate(()=>window.oldGradeConfirm=document.querySelector('[data-act="grade-confirm"]'));
   await switchPanel('export');await switchPanel('import');assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);assert.equal(await imp.locator('[data-grade-review]').count(),1);
   await page.goto(base+'/#/teaching/t');await page.goto(base+'/#/teaching/t/koshoof?import=1');await imp.waitFor();assert.equal(await imp.locator('[data-grade-review]').count(),1);assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
   await cancel();await page.evaluate(async()=>{const v=(await import('/src/views/grades.js')).default;await v.actions['grade-confirm'](window.oldGradeConfirm);});assert.equal(requests.length,0);assert.deepEqual(await state(),initial);
   // Real delayed read/cancel: stale completion cannot restore file state.
   await page.evaluate(()=>{window.pendingRead=import('/src/views/grades.js').then(({default:v})=>v.actions['grade-file']({files:[{name:'late.csv',size:25,arrayBuffer:()=>new Promise(r=>window.releaseRead=()=>r(new TextEncoder().encode('اسم الطالب,درجة\nطالب مؤجل,1').buffer))}]},null,{id:'t'}));});
   await page.waitForFunction(()=>!!window.releaseRead);await cancel();await page.evaluate(async()=>{window.releaseRead();await window.pendingRead;});assert.equal(await imp.locator('[data-grade-file-name]').count(),0);
   record('n90_import_modes_review_state_cancel','Names-only review exposes no grade mapping and sends nothing; explicit grades selection preserves parsed file but resets review/consent. Panel switches and same-workspace route return retain review with fresh unchecked consent. Cancel, disconnected old confirmation and delayed canceled read cause no write.');
   // Actual XLSX reader, generated using the existing local parser package.
   const xlsx=await xlsxFixtures();
   await setMode('names');await file(xlsx.valid,'xlsx');await review();assert.match(await imp.locator('[data-grade-review]').innerText(),/طالب إكسل اصطناعي/);
   await setMode('grades');await imp.locator('[data-grade-column="1"] [data-grade-kind]').selectOption('i');await review();assert.match(await imp.locator('[data-grade-review]').innerText(),/طالب إكسل اصطناعي/);await cancel();

   // Exact visual/toolbar checks use the actual authenticated app at each target size.
   for(const theme of ['light','dark'])for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    for(const id of ['t','empty-t']) {
     await page.goto(base+'/#/teaching/'+id+'/students');await page.locator('.topbar__actions [data-act="file-import"]').waitFor();
     assert.equal(await page.locator('[data-act="file-import"]').count(),1);
     const targets=await page.locator('.topbar__actions .roster-toolbar-action').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {h:r.height,l:r.left,r:r.right,w:innerWidth};}));
     assert.equal(targets.length,2);assert.ok(targets.every(r=>r.h>=44 && r.l>=0 && r.r<=r.w),JSON.stringify(targets));
     await screenshot(`${theme}-${width}-${id}-toolbar.png`);
    }
    await page.goto(base+'/#/teaching/t/koshoof?import=1');await imp.waitFor();if(await act('grade-cancel').count())await cancel();
    const template=await act('grade-template').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}));
    assert.ok(template.h>=44 && template.h<60 && template.w<=300);assert.notEqual(template.bg,'rgba(0, 0, 0, 0)');
    await screenshot(`${theme}-${width}-template.png`);await switchPanel('export');
    const styles=await page.locator('[data-act="grade-names-export"],[data-act="grade-export"]').evaluateAll(es=>es.map(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,h:e.getBoundingClientRect().height})));
    assert.deepEqual(styles[0],styles[1]);assert.notEqual(styles[0].bg,'rgba(0, 0, 0, 0)');await switchPanel('import');await setMode('grades');
    await file('اسم الطالب,المشاركة والتفاعل (العظمى 10)\nناصر حمد,1');await review();
    await page.locator('[data-grade-student-row="2"]').selectOption('1');await page.locator('[data-grade-student-confirm="2"]').check();
    await page.waitForFunction(()=>document.querySelector('[data-act="grade-confirm"]')?.disabled===false);assert.equal(await act('grade-confirm').isDisabled(),false);assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
    const bounds=await page.locator('[data-grade-student-row]').evaluate(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,w:innerWidth};});assert.ok(bounds.l>=0 && bounds.r<=bounds.w);
    await screenshot(`${theme}-${width}-identity.png`);await cancel();
   }
   record('n106_template_soft_green_and_two_green_export_actions','Actual computed styles and screenshots at all 8 size/theme combinations: compact tinted template, identical green export actions.');
   record('n106_roster_toolbar_single_koshoof_and_quick_paste','Populated and empty authenticated routes: two usable toolbar targets >=44px inside viewport at all 8 size/theme combinations, one Koshoof entry.');
   // Screenshot matrix on source DOM/CSS with the actual responsive controls.
   for(const theme of ['light','dark'])for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    await setMode('names');await screenshot(`${theme}-${width}-names-only.png`);await setMode('grades');
    await file('اسم الطالب,المشاركة والتفاعل (العظمى 10),عمود غير معروف,اختبار إضافي (العظمى 7.5),الحضور (العظمى 5)\nأحمد سالم,5,3,0,2');
    assert.equal(await imp.locator('[data-grade-mapping-details] details').count(),0);
    assert.equal(await imp.locator('fieldset').count(),0);assert.equal(await imp.locator('[data-grade-mapping-details]').getAttribute('open'),'');assert.equal(await imp.locator('[data-grade-column]').count(),3);assert.equal(await imp.locator('[data-grade-add-choice]').count(),0);assert.match(await imp.locator('[data-grade-mapping-summary]').innerText(),/قراءة فقط متجاهلة: 1/);assert.equal(await imp.locator('.grade-transfer__mapping').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
    assert.equal(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    await screenshot(`${theme}-${width}-mapping.png`);
    const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.left< -1||r.right>innerWidth+1);}).slice(0,12).map(e=>({tag:e.tagName,class:e.className}))}));assert.ok(overflow.scroll<=overflow.width,JSON.stringify(overflow));
    const targets=await imp.locator('select:visible,button:visible,input:not([type=checkbox]):visible').evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width})));assert.ok(targets.every(r=>r.h>=43.9&&r.w>0));
    await cancel();await switchPanel('export');await page.locator('[data-noor-grouping]').evaluate(e=>e.open=true);assert.equal(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth),true);await screenshot(`${theme}-${width}-export.png`);await switchPanel('import');
   }
   await page.setViewportSize({width:390,height:900});await imp.locator('[data-mode="names"]').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-act="grade-import-mode"][data-mode="names"]')?.getAttribute('aria-pressed')==='true');assert.equal(await imp.locator('[data-mode="grades"]').getAttribute('aria-pressed'),'false');await page.keyboard.press('Tab');assert.equal(await imp.locator('[data-mode="grades"]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-act="grade-import-mode"][data-mode="grades"]')?.getAttribute('aria-pressed')==='true');assert.equal(await imp.locator('[data-mode="names"]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
   record('n90_import_mapping_mobile_and_advanced_preview','Actual CSV and XLSX handlers exercised; unique matching auto-collapses sound mapping. An unknown column opens only the unresolved card with ignore/error guidance; no fieldsets.');
   record('n90_rtl_accessibility_and_320_to_1280_render','24 matrix light/dark screenshots plus 4 default/empty/review screenshots: actual mapping and Noor export at 320/390/768/1280; zero horizontal page/panel overflow and visible controls >=44px. Keyboard Space selects modes, Tab follows mode buttons, RTL document retained.');
   await file('اسم الطالب,المشاركة والتفاعل (العظمى 10),الواجبات (العظمى 10),الأنشطة والمشاريع (العظمى 20),رابع غير معروف\nأحمد سالم,1,2,3,0');
   await imp.locator('[data-grade-column="4"] [data-grade-kind]').selectOption('i4');await review();await imp.locator('[data-grade-unchanged] > summary').click();assert.match(await imp.locator('[data-grade-review]').innerText(),/الاختبارات القصيرة/);assert.equal(requests.length,0);await cancel();
   const workbook=unzipSync(new Uint8Array(xlsx.valid)),sheet=Object.keys(workbook).find(k=>/^xl\/worksheets\/.+\.xml$/.test(k));
   const headers=['اسم الطالب','المشاركة والتفاعل (العظمى 10)','الواجبات (العظمى 10)','الأنشطة والمشاريع (العظمى 20)','رابع غير معروف'];
   const xmlRow=(row,n)=>`<row r="${n}">${row.map((v,c)=>`<c r="${String.fromCharCode(65+c)}${n}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;
   workbook[sheet]=new TextEncoder().encode(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRow(headers,1)}${xmlRow(['أحمد سالم','1','2','3','0'],2)}</sheetData></worksheet>`);
   await file(xlsxZip(workbook),'xlsx');await imp.locator('[data-grade-column="4"] [data-grade-kind]').selectOption('i4');await review();await imp.locator('[data-grade-unchanged] > summary').click();assert.match(await imp.locator('[data-grade-review]').innerText(),/الاختبارات القصيرة/);assert.equal(requests.length,0);await cancel();
   record('n106_fourth_unknown_manual_column','Actual uploaded CSV and XLSX fourth grade heading mapped to current manual item; zero reviewed under unchanged values, no request.');
   // Owner/offline/lease and stale guards at the affected actual account store entry.
   await file('اسم الطالب,المشاركة والتفاعل (العظمى 10)\nناصر حمد,1');await review();assert.match(await imp.locator('[data-grade-review]').innerText(),/اسم ملتبس/);assert.equal(await act('grade-confirm').isDisabled(),true);assert.equal(requests.length,0);
   await page.locator('[data-grade-student-row="2"]').selectOption('0');assert.equal(await act('grade-confirm').isDisabled(),true);
   await page.locator('[data-grade-student-confirm="2"]').check();await page.waitForFunction(()=>document.querySelector('[data-act="grade-confirm"]')?.disabled===false);assert.equal(await act('grade-confirm').isDisabled(),false);
   assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
   await act('grade-confirm').click();assert.equal(requests.length,0);
   await act('grade-edit-mapping').click();await review();assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);
   record('n106_ambiguous_choice_explicit_review','Actual owned account DOM: ambiguous row blocks, numbered roster selection still blocks until per-row approval; final approval separate; re-review clears final consent; no request.');await cancel();
   await file(csv);await review();
   const negative=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),g=(await import('/src/lib/sync-ownership.js')).runtimeSyncOwnershipGuard,l=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
    const r=s.reviewGradeImport('t',{rows:[['اسم الطالب','المشاركة والتفاعل'],['أحمد سالم','5']],nameColumn:0,mappings:[{kind:'ignore'},{kind:'existing',itemId:'i'}]});
    const session=c.session;c.setMockAuth({id:'foreign-owner'},session);let ownerError;try{await s.confirmGradeImport(r,{approved:true,overwriteConfirmed:true});}catch(e){ownerError=e.message;}finally{c.setMockAuth(session.user,session);}
    const missing=g.cloudAccess({operation:'dispatch',authenticatedUserId:c.user.id});s.getOfflineLeaseStatus();l.invalidate('synthetic');let leaseError;try{await s.confirmGradeImport(r,{approved:true,overwriteConfirmed:true});}catch(e){leaseError=e.message;}await l.renew(async()=>({id:c.user.id,source:'supabase-auth-user',verifiedAt:Date.now()}));return {ownerError,leaseError,missing};
   });assert.ok(negative.ownerError);assert.ok(negative.leaseError);assert.equal(negative.missing.reason,'command-owner-missing');assert.equal(requests.length,0);
   await context.setOffline(true);await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await act('grade-confirm').click();await page.locator('.grade-transfer__message.is-error').waitFor();assert.equal(requests.length,0);await context.setOffline(false);await cancel();
   await q("update rakeezx.items set max=9 where id='i'");await file(csv);await review();await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await act('grade-confirm').click();await page.locator('.grade-transfer__message.is-error').waitFor();assert.equal(requests.length,1);assert.deepEqual(await state(),initial);await q("update rakeezx.items set max=10 where id='i'");
   // Refresh this synthetic account's changed revisions in the same live document.
   // Boot/offline evidence is unchanged and reused, not re-certified by this UX check.
   await cancel();await page.evaluate(prepareN106Account);const checkpoint=await page.evaluate(async()=>{const result={ready:true};const s=await import('/src/store.js');return {...result,item:s.state.items.find(i=>i.id==='i'),owner:s.getActiveWorkspace().authUserId};});assert.equal(checkpoint.owner,owner);assert.equal(checkpoint.ready,true);assert.equal(Number(checkpoint.item.max),10);
   // Keep the real rejection history while using the existing explicit retire action.
   await page.goto(base+'/#/teaching/t/koshoof?import=1');await imp.waitFor();await page.locator('[data-grade-retire-confirm]').waitFor();{await page.locator('[data-grade-retire-confirm]').check();await act('grade-retire').click();await act('grade-retire').waitFor({state:'detached'});}
   await setMode('grades');await file(csv);await review();await act('grade-confirm').click();assert.equal(requests.length,1);await page.locator('[data-grade-match-confirm]').check();await page.locator('[data-grade-overwrite-confirm]').check();await act('grade-confirm').click();await page.getByText(/إيصال الخادم/).waitFor();assert.equal(requests.length,2);
   const committed=await state();assert.equal(Number(committed.scores.find(s=>s.id==='s').value),10);assert.equal(Number(committed.scores.find(s=>s.student_id==='b'&&s.item_id==='i').value),0);assert.equal(Number(committed.scores.find(s=>s.student_id==='c'&&s.item_id==='i').value),0);
   record('n90_current_owner_grade_atomicity_and_cancel_preserved','Actual synthetic account UI/store: wrong owner, invalid lease, ownerless dispatch and offline confirmation denied before transport. Native stale max rejects whole batch, retains real failure, then explicit retirement and fresh review permit only consented 12→10 / 0; blank preserves existing 0. Existing native suite separately verifies rollback/owner/exact retry.');
   await file('اسم الطالب,المشاركة والتفاعل (العظمى 10)\nناصر حمد,1\nناصر حمد,2');await review();
   for(const [row,index] of [[2,'0'],[3,'1']]) {await page.locator(`[data-grade-student-row="${row}"]`).selectOption(index);await page.locator(`[data-grade-student-confirm="${row}"]`).check();}
   await page.waitForFunction(()=>document.querySelector('[data-act="grade-confirm"]')?.disabled===false);assert.equal(await act('grade-confirm').isDisabled(),false);await page.locator('[data-grade-match-confirm]').check();
   await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.students.find(s=>s.id==='du1').serverRevision++;});
   await act('grade-confirm').click();await page.locator('.grade-transfer__message.is-error').waitFor();assert.equal(requests.length,2);
   await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.students.find(s=>s.id==='du1').serverRevision--;});
   await act('grade-edit-mapping').click();await review();assert.equal(await page.locator('[data-grade-match-confirm]').isChecked(),false);await page.locator('[data-grade-match-confirm]').check();
   let releaseCapability;const heldCapability=new Promise(r=>releaseCapability=r);
   await page.route('**/__n90/grade-capability',async route=>{await heldCapability;await route.continue();});
   try {await act('grade-confirm').click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-grade-student-row],[data-grade-student-confirm]')].every(e=>e.disabled));assert.equal(requests.length,2);}
   finally {releaseCapability();}
   await page.getByText(/إيصال الخادم/).waitFor();await page.unroute('**/__n90/grade-capability');assert.equal(requests.length,3);
   const mapped=await state();assert.equal(Number(mapped.scores.find(s=>s.student_id==='du1'&&s.item_id==='i').value),1);assert.equal(Number(mapped.scores.find(s=>s.student_id==='du2'&&s.item_id==='i').value),2);
   record('n106_explicit_duplicate_mapping_save_and_stale_revision','Two identical-name rows explicitly choose distinct current students; changed student revision blocks actual UI save before transport; fresh review resets approval then one unchanged native atomic RPC commits exactly chosen identities.');
   await file('اسم الطالب,المشاركة والتفاعل (العظمى 10)\nاسم جديد فقط,9');await setMode('names');await review();const beforeNames=await state(),localScoresBeforeNames=await page.evaluate(async()=> (await import('/src/lib/db.js')).getAll('scores'));await page.locator('[data-grade-match-confirm]').check();await act('grade-confirm').click();await page.getByText('أُضيفت الأسماء الجديدة دون تكرار.',{exact:true}).waitFor();assert.equal(requests.length,3);assert.deepEqual((await state()).scores,beforeNames.scores);
   const names=await page.evaluate(async()=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js');return {roster:s.teachingContext('t').roster,outbox:await d.getAll('outbox'),scores:await d.getAll('scores')};});assert.deepEqual(names.scores,localScoresBeforeNames);assert.equal(names.roster.filter(s=>s.name==='اسم جديد فقط').length,1);assert.ok(names.outbox.filter(r=>r.state!=='superseded').every(r=>r.ownerId===owner));
   record('n90_names_only_vs_names_grades_functional_separation','One file, two actual mode buttons: names-only confirms a new persisted N12 identity/enrollment with owner-bound outbox and no grade RPC or native grade mutation; grades mode uses unchanged guarded atomic native RPC only after consent.');
   await writeFile(output+'/page-errors.json',JSON.stringify(errors));assert.deepEqual(errors,[]);
  });
  return checks;
 }finally{if(server.listening)await new Promise(r=>server.close(r));await writeFile('tests/n106-koshoof-browser.json',JSON.stringify({checks,requests,screenshots,ownedServerStopped:true,leasedBrowserFinally:true},null,2));}
}
