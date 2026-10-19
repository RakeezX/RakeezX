// AI-authored: bounded presentation fixtures in the actual application, no import replay.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
const taskId='continuous-n107-clear-import-review-success-20261019',runId='b42ed375-f948-4b01-833c-140a4adc5503';
const base='http://127.0.0.1:49847',root=resolve('.'),out='tests/n107-feedback-1532';
const evidence={taskId,runId,harnessCorrections:['First run used a summary selector matching its nested advanced summary; narrowed to direct child before rerun. A guessed16px spacing assertion was replaced with the actual loaded CSS nonzero padding check; token sp-3 is12px.'],checks:[],failures:[],testedFiles:{},scope:'Presentation fixtures only; no backend import, live service or acceptance replay.'};
for(const f of ['src/views/class-import-center.js','src/styles/teacher-setup-import.css'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
const service=syntheticService();
// Test-only state seam appended to the otherwise unmodified served source module.
// Rendering, delegated handlers, account guards and all styles remain actual app code.
const seam=`\nexport function n107PresentationFixture(kind) {
 draft={};transfer={...emptyTransfer(),panel:'import'};hub.kind='existing';hub.existing='n73-source';
 if(kind==='success'||kind==='pending') {
   transfer.successTeaching='n73-source';transfer.successCounts={names:28,grades:31};
   if(kind==='pending'){transfer.created={teachingId:'n73-source',added:28};transfer.stage='الدرجات لم يتأكد حفظها.';transfer.successTeaching=null;transfer.successCounts=null;}
 } else {
   transfer.importMode='grades';transfer.nameColumn=0;
   transfer.rows=[['اسم الطالب','واجبات'],...Array.from({length:28},(_,i)=>['طالب اصطناعي '+(i+1),'5'])];
   const entries=transfer.rows.slice(1).map((r,i)=>({row:i+2,student:r[0],item:'واجبات',value:5,old:null,max:20}));
   transfer.review={teachingId:'n73-source',entries,cells:Array.from({length:31},()=>({})),newStudents:transfer.rows.slice(1).map(r=>({name:r[0]})),newItems:[],rejected:[],maxChanges:kind==='maximum'?[{item:JSON.stringify({name:'واجبات'}),oldMax:10,max:20}]:[]};
 }
 repaint();
}\n`;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,base).pathname;
 if(pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}
 const f=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!f.startsWith(root+sep))throw Error('Outside root');
 let content=await readFile(f);if(pathname==='/src/views/class-import-center.js')content=Buffer.concat([content,Buffer.from(seam)]);
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(content);
}catch(e){res.writeHead(500);res.end(e.message);}});
const snapshot=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
async function prepare(page){
 await openReadyServedDemo(page,base);
 await page.evaluate(async()=>{
  const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
  const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-ui-only'};
  s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
  const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();try{await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
  const route=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});if(route.status!=='ready')throw Error(JSON.stringify(route));s.activateWorkspace(route.workspace);
  await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  s.assertClassImportAccess();location.hash='#/classes/koshoof?teaching=n73-source';(await import('/src/repaint.js')).repaint();
 });
 await page.locator('[data-roster-file-flow]').waitFor();
}
async function fixture(page,kind){await page.evaluate(async kind=>(await import('/src/views/class-import-center.js')).n107PresentationFixture(kind),kind);}
const pass=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
try{
 await new Promise(r=>server.listen(49847,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const width of [390,1280]){
  const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await prepare(page);const before=await snapshot(page);
  // Real file parsing and actual account-bound review click reproduce the missing-grade entry.
  await page.locator('[data-change="grade-file"]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب\nطالب اصطناعي')});
  await page.locator('[data-import-kind]').selectOption('new');
  await page.locator('[data-act="grade-review"]').click();
  await page.waitForFunction(()=>document.activeElement?.matches('[data-roster-field="grade"][aria-invalid="true"]'));
  assert.equal(await page.locator('#roster-grade-error').innerText(),'اختر الصف');
  assert.equal(await page.locator('.grade-transfer__message.is-error').count(),0);
  await page.screenshot({path:out+'/missing-grade-'+width+'.png',fullPage:true});
  await page.locator('[data-roster-field="grade"]').selectOption('4');
  await page.waitForFunction(()=>document.querySelector('[data-roster-field="grade"]').getAttribute('aria-invalid')==='false');
  assert.equal(await page.locator('#roster-grade-error').isVisible(),false);
  // Advanced ID mapping remains functional and out of the ordinary visible path.
  await page.locator('[data-grade-mapping-details] > summary').click();
  assert.equal(await page.locator('[data-grade-identity-optional]').getAttribute('open'),null);
  assert.equal(await page.locator('[data-grade-id]').isVisible(),false);
  await page.locator('[data-grade-identity-optional] summary').click();
  assert.equal(await page.locator('[data-grade-id]').isVisible(),true);
  pass('missing_grade_'+width,'Actual account guard + CSV handler + review click focuses grade, exposes direct field error, clears on selection; advanced ID retained.');
  for(const kind of ['preview','maximum','success','pending']){
   await fixture(page,kind);
   if(kind==='success'){
    await page.locator('[data-import-success]').waitFor();
    assert.match(await page.locator('[data-import-success]').innerText(),/الأسماء المحفوظة: 28\s+الدرجات المحفوظة: 31/);
    const link=page.locator('[data-import-success] a.btn--primary');assert.equal(await link.getAttribute('href'),'#/teaching/n73-source');
    assert.equal(await page.locator('.grade-transfer__message').count(),0);
    assert.ok(await page.locator('[data-import-success]').evaluate(el=>parseFloat(getComputedStyle(el).padding)>0));
   }else if(kind==='pending'){
    await page.locator('[data-roster-partial]').waitFor();assert.match(await page.locator('[data-roster-partial]').innerText(),/لم يتأكد حفظها/);assert.equal(await page.locator('[data-import-success]').count(),0);
   }else{
    await page.locator('[data-roster-preview]').waitFor();assert.match(await page.locator('.n107-review__counts').innerText(),/28 طالبًا.*31 درجة/);
    assert.equal(await page.locator('[data-grade-max-impact]').count(),kind==='maximum'?1:0);
    assert.equal(await page.locator('[data-act="grade-confirm"]').count(),1);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:out+'/'+kind+'-'+width+'.png',fullPage:true});
   pass(kind+'_'+width,'Actual app DOM and source CSS at '+width+'px; presentation fixture only, one review consent, no page overflow.');
  }
  assert.equal(await snapshot(page),before);pass('no_mutation_'+width,'All affected UI checks leave synthetic records, grades and outbox unchanged.');
  await context.close();
 }
 });
 pass('n107_clear_success_review_and_missing_grade_field_feedback','390/1280 actual application checks passed; screenshots and source hashes recorded.');
}catch(e){evidence.failures.push(e.stack);process.exitCode=1;console.error(e.stack);}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(out+'/result.json',JSON.stringify(evidence,null,2));}
