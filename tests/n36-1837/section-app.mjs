// AI: actual app/store/Sync exclusion → native disposable PostgreSQL new API.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';import {fixture,capability,owner} from '../n73-account-flow-fixture.mjs';import {decodeSyncV2Canonical} from '../../src/lib/sync-v2.js';import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
export async function appQualification({a,root,report}){
 const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-one-start-complete-madrasati-20261019.json',runId='4c635c30-9a3d-4255-84c3-4a7da9982bbd';
 const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
 let leased=false,browser,context,server;let mode='lost',requests=[];const blocked=[];report.ui={};
 try{
  lease('acquire');leased=true;
  await a.query("reset role;insert into rakeezx.sections(id,year_id,grade,label,name) values('ui-section','y',6,'1','synthetic');insert into rakeezx.enrollments(id,student_id,section_id) values('ui-en','shared','ui-section');set role authenticated");
  const data=fixture();for(const k of ['sections','teachings','students','enrollments','subjects','items','scores','scoreSubitems','scoreSubitemCompletions','units','lessons','logs'])data[k]=[];
  for(const [store,table]of [['years','years'],['terms','terms'],['sections','sections'],['subjects','subjects'],['teachings','teachings'],['students','students'],['enrollments','enrollments'],['items','items'],['scores','scores']]){
   data[store]=(await a.query(`select to_jsonb(r) r from rakeezx.${table} r where owner_id=$1`,[owner])).rows.map(({r})=>decodeSyncV2Canonical(store,r));
  }
  data.device[0].activeYearId='y';data.device[0].activeTermId='t';
  server=http.createServer(async(req,res)=>{try{
   const u=new URL(req.url,'http://127.0.0.1');
   if(u.pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;const input=JSON.parse(body||'{}'),name=u.pathname.slice(7);let result;
    if(name==='fixture')result=data;else if(name==='auth')result={id:owner,source:'supabase-auth-user',verifiedAt:Date.now()};else if(name==='capability')result=capability;
    else if(name==='n36-delete'){
     requests.push(input);result=(await a.query('select rakeezx.n36_delete_subjectless_section($1,$2,$3,$4,$5,$6,$7) r',[input.sectionId,input.yearId,input.termId,input.fingerprint??null,input.mutationId??null,input.deviceId??null,input.commit??false])).rows[0].r;
     if(input.commit&&mode==='lost'){mode='normal';res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({message:'Synthetic lost receipt'}));return;}
    }else throw Error('Unknown fixture call');res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
   }
   const file=path.resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(file.startsWith(root+path.sep));res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:e.code??'FIXTURE',message:'Synthetic fixture rejection'}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});context=await browser.newContext({serviceWorkers:'block',viewport:{width:1100,height:850},locale:'ar-SA'});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(u.pathname==='/auth/v1/user')return r.fulfill({contentType:'application/json',body:JSON.stringify({id:owner})});blocked.push(u.origin);return r.abort();});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await openReadyServedDemo(page,origin);
  const ready=await page.evaluate(async()=>{const r=await(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount();
   (await import('/src/lib/cloud.js')).setMockBackend({n36DeleteSubjectlessSection:async input=>{const r=await fetch('/__n73/n36-delete',{method:'POST',body:JSON.stringify(input)}),v=await r.json();if(!r.ok)throw Object.assign(Error(v.message),v);return v;}});
   (await import('/src/repaint.js')).repaint();return r;});assert.equal(ready.ready,true);assert.equal(ready.outbox.length,0,'complete native fixture must require no bootstrap writes');report.ui.initialOutbox=ready.outbox.map(r=>({store:r.store,command:r.command}));report.ui.requests=requests;
  const negative=await page.evaluate(async()=>{
   const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js'),checks={};
   const deny=async()=>{try{await s.previewDeleteSubjectlessSection('ui-section');return false;}catch{return true;}};
   const owner=c.session.user.id;c.session.user.id='b7300000-0000-4000-8000-000000000002';checks.owner=await deny();c.session.user.id=owner;
   for(const [name,row,field,value]of [['section',s.getSection('ui-section'),'ownerId','foreign'],['enrollment',s.state.enrollments.find(e=>e.id==='ui-en'),'ownerId','foreign'],['closed',s.activeTerm(),'status','closed'],['archived',s.getSection('ui-section'),'status','archived']]){const old=row[field];row[field]=value;checks[name]=await deny();row[field]=old;}
   return checks;
  });assert.ok(Object.values(negative).every(Boolean));assert.equal(requests.length,0);
  report.checks.push({name:'actual_app_owner_foreign_cache_closed_archive_preflight_no_service_call',status:'PASS'});
  await page.locator('[data-section-roster="ui-section"]').waitFor();await page.locator('[data-section-roster="ui-section"] > summary').click();
  const read=()=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());const before=await read();
  await page.locator('[data-section-roster="ui-section"] [data-act="delete-class-flow"]').click();await page.locator('#class-delete-next-btn').click();
  try{await page.locator('#class-delete-confirm-btn').waitFor({timeout:8000});}catch(e){report.ui.body=(await page.locator('body').innerText()).slice(-1700);throw e;}assert.match(await page.locator('.sheet__title').innerText(),/تأكيد حذف الفصل/);
  await page.screenshot({path:root+'/tests/n36-1837/section-delete-confirm.png',fullPage:true});
  await page.locator('#class-delete-confirm-btn').click();await page.waitForFunction(async()=>!!(await(await import('/src/lib/db.js')).get('device','device')).n77DeleteIntent);
  await page.waitForFunction(()=>!document.querySelector('#class-delete-confirm-btn')?.disabled);
  const pending=await read();assert.equal(pending.sections.find(s=>s.id==='ui-section').deleted,false);assert.equal(pending.enrollments.find(s=>s.id==='ui-en').deleted,false);assert.equal(pending.device[0].n77DeleteIntent.kind,'subjectless-section');
  assert.ok((await a.query("select deleted_at from rakeezx.sections where id='ui-section'")).rows[0].deleted_at);
  await page.locator('#class-delete-confirm-btn').click();await page.waitForFunction(async()=> (await(await import('/src/lib/db.js')).get('sections','ui-section'))?.deleted===true);
  await page.locator('#class-delete-confirm-btn').waitFor({state:'detached',timeout:8000});
  const after=await read();report.ui.finalIntent=after.device[0].n77DeleteIntent;assert.equal(after.device[0].n77DeleteIntent,null);assert.equal(after.students.find(s=>s.id==='shared').deleted,false);assert.equal(after.enrollments.find(s=>s.id==='outside-en').deleted,false);assert.deepEqual(after.outbox,before.outbox);
  assert.equal(requests.filter(r=>r.commit).length,2);assert.deepEqual(requests.filter(r=>r.commit)[0],requests.filter(r=>r.commit)[1]);
  await page.locator('[data-section-roster="ui-section"]').waitFor({state:'detached'});
  assert.ok(blocked.every(o=>o==='https://fonts.googleapis.com'||o==='https://fonts.gstatic.com'));
  report.checks.push({name:'actual_app_subjectless_confirmation_native_commit_lost_receipt_exact_retry_projection',status:'PASS',evidence:'Real DOM/handlers/store/owner/Sync exclusion and native PG API: no local tombstones on lost receipt, durable same-mutation retry, confirmed atomic projection, shared pupil/outside enrollment unchanged. No hosted calls.'});
  report.ui={requests:requests.map(r=>({commit:r.commit,sectionId:r.sectionId,mutationId:r.mutationId})),externalBlocked:blocked,cleanup:true};
 }finally{await context?.unrouteAll({behavior:'ignoreErrors'});await context?.close();await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));if(leased)lease('release');}
}
