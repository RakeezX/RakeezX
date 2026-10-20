// AI-authored: one bounded changed-view check; real app/CSS/handlers, synthetic owner.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from '../n73-account-flow-fixture.mjs';
import {makeEnrollment} from '../../src/models.js';
const taskId='continuous-n107-minimal-import-controls-20261020',runId='893e0f66-5275-4ec0-82af-d1a1f9f435ab';
const base='http://127.0.0.1:49807',root=resolve('.'),out='tests/n107-minimal-controls-20261020/';
const service=syntheticService();
service.current.enrollments=service.current.students.map((s,i)=>({...makeEnrollment({id:'e'+i,studentId:s.id,sectionId:'n73-source-section'}),ownerId:owner,serverRevision:1}));
const result={taskId,runId,checks:[],failures:[]};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(path.slice(7),JSON.parse(body||'{}'))));return;}
 const f=resolve(root,path==='/'?'index.html':'.'+decodeURIComponent(path));if(!f.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]??'application/octet-stream');res.end(await readFile(f));
}catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:e.message}));}});
try{
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(49807,'127.0.0.1',ok);});
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
  let fileSequence=0;
  const upload=async text=>{if(fileSequence){await page.locator('[data-act="grade-cancel"]').click();await page.locator('[data-change="grade-file"]').waitFor({state:'visible'});}const name='synthetic-'+(++fileSequence)+'.csv';await page.locator('[data-change="grade-file"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(text)});await page.waitForFunction(name=>document.querySelector('[data-grade-file-name]')?.textContent.includes(name),name).catch(async e=>{console.log(await page.locator('[data-roster-file-flow]').innerText());throw e;});await page.locator('[data-import-kind]').waitFor();};
  const mapping=async()=>{const details=page.locator('[data-act="grade-toggle-mapping"]').locator('..');if(!await details.evaluate(e=>e.open))await page.locator('[data-act="grade-toggle-mapping"]').click();};
  await upload('اسم الطالب,Exam (العظمى 20)\nSynthetic 1,7');
  assert.equal(await page.getByText('الوجهة ومحتوى الكشف',{exact:true}).count(),0);
  assert.equal(await page.locator('[data-import-kind]').isVisible(),true);
  await page.locator('[data-act="grade-import-mode"][data-mode="grades"]').first().click();await mapping();
  assert.equal(await page.locator('[data-grade-identity-optional]').isVisible(),false);
  assert.equal(await page.locator('[data-grade-id]').inputValue(),'-1');
  await page.locator('[data-grade-name]').selectOption('0');
  assert.equal(await page.locator('[data-grade-id]').inputValue(),'-1');
  for(const [label,width]of [['desktop',1100],['mobile',390]]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+label+'.png',fullPage:true});}
  await page.locator('[data-import-kind]').selectOption('new');
  for(const selector of ['[data-roster-field="grade"]','[data-roster-field="label"]','[data-roster-subject]'])assert.equal(await page.locator(selector).isVisible(),true);
  await page.locator('[data-import-kind]').selectOption('existing');await page.locator('[data-existing-class]').selectOption('n73-source');
  // Export-format IDs stay selected even after the actual mapping reader runs.
  await upload('اسم الطالب,معرف الطالب,Exam (العظمى 20)\nRenamed synthetic,n73-student1,7');await page.locator('[data-act="grade-import-mode"][data-mode="grades"]').first().click();await mapping();
  assert.equal(await page.locator('[data-grade-id]').inputValue(),'1');
  await page.locator('[data-grade-name]').selectOption('0');
  assert.equal(await page.locator('[data-grade-id]').inputValue(),'1');
  // Genuine duplicate identity still has the existing explicit row-choice controls.
  await page.evaluate(async()=>{const s=await import('/src/store.js');s.state.students[1].name=s.state.students[0].name;});
  await upload('اسم الطالب,Exam (العظمى 20)\nSynthetic 1,7');await page.locator('[data-act="grade-import-mode"][data-mode="grades"]').first().click();await mapping();
  await page.locator('[data-grade-identity-optional]').waitFor({state:'visible'});
  await page.locator('[data-act="grade-review"]').click();
  await page.locator('[data-grade-student-row="2"]').waitFor({state:'visible'});
  // View-only durable-plan fixtures: no coordinator/transport or cancellation replay.
  const seedPlans=async state=>page.evaluate(async state=>{const s=await import('/src/store.js'),w=s.getActiveWorkspace();s.assertClassImportAccess();s.state.device.classFileImportPlans={p:{id:'p',state,ownerId:w.authUserId,databaseName:w.databaseName,created:{teachingId:'n73-source'}}};(await import('/src/repaint.js')).repaint();},state);
  await seedPlans('cloud_confirmed');assert.equal(await page.locator('[data-local-import-plans]').count(),0);assert.equal(await page.locator('[data-act="local-import-cancel"]').count(),0);
  await seedPlans('waiting_sync');assert.equal(await page.locator('[data-local-import-plans]').evaluate(e=>e.open),false);assert.equal(await page.locator('[data-act="local-import-cancel"]').isVisible(),false);
  await page.locator('[data-local-import-plans] > summary').click();assert.equal(await page.locator('[data-act="local-import-cancel"]').isVisible(),true);
  assert.match(await page.locator('[data-local-import-plans]').innerText(),/لا يحذف الفصل أو الطلاب أو الدرجات المحفوظة/);
  await seedPlans('uncertain');assert.equal(await page.locator('[data-local-import-plans]').evaluate(e=>e.open),true);assert.equal(await page.locator('[data-act="local-import-retry"]').isVisible(),true);
  await page.screenshot({path:out+'follow-up.png',fullPage:true});
  assert.equal(await page.locator('pre').count(),0);assert.equal(service.evidence.commits,0);
  assert.deepEqual(result.failures,[]);
  result.checks.push({name:'n107_changed_view_destination_identity_stop_semantics',status:'PASS',evidence:'Actual HTTP app/CSS, owner-guarded file/mapping handlers, direct destination controls, hidden ordinary ID with preserved auto-ID and duplicate row choices; pending optional stop, uncertain recovery and no terminal stop; desktop/mobile no overflow. Stop engine unchanged; no save/dispatch/reload matrix.'});
 });
}catch(e){result.failures.push(e.stack);process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));result.viewSha256=createHash('sha256').update(await readFile('src/views/class-import-center.js')).digest('hex');await writeFile(out+'result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
