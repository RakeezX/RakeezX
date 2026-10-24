/** AI: real runtime/component/CSS on owned loopback; fabricated service only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {withIsolatedLocalBrowser} from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const baseline=process.argv.includes('--baseline'),dir='tests/n88-uncertain-recovery-20261024/';
const taskId='continuous-n88-uncertain-receipt-recovery-isolated-20261024',runId='74ddc95c-2e2d-4fa3-a19d-649466baa6d8';
const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]));
let calls=[],mode='unknown',server,holdMutation=false,releaseMutation;
const entry=`
import {mountClassService,classBinding} from '/src/lib/student-portal-runtime.js';
import {createSyncOwnershipGuard} from '/src/lib/sync-ownership.js';
const owner='11111111-1111-4111-8111-111111111111';
let workspace={id:'synthetic-workspace',databaseName:'synthetic-db',leaseGeneration:1,type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true};
const guard=createSyncOwnershipGuard({workspace});
const cloud={user:{id:owner},session:{access_token:'synthetic.'+btoa(JSON.stringify({session_id:'synthetic-session',exp:Math.floor(Date.now()/1000)+600}))+'.synthetic'},authStatus:()=>({state:'authenticated'})};
let leaseAllowed=true;
const store={state:{},getActiveWorkspace:()=>workspace,getTeaching:()=>({id:'teaching',sectionId:'class',termId:'term',revision:1}),activeTerm:()=>({id:'term',revision:1}),isTeachingArchived:()=>false,assertClassOperationsAccess(){},assertLeaseWritable(){if(!leaseAllowed)throw Error('lease');}};
let h;const root=document.querySelector('#class-portal');
const mount=()=>{h=mountClassService(root,{getBinding:w=>classBinding({cloud,store,teachingId:'teaching',guard},w),classLabel:()=> 'فصل مصطنع'});};
mount();window.fixture={remount(){h.dispose();mount();},leaseOff(){leaseAllowed=false;h.dispose();mount();},retire(){cloud.user={id:'22222222-2222-4222-8222-222222222222'};h.dispose();mount();}};
`;
const report={aiAuthored:true,baseline,providerOperations:0,status:'FAIL',checks:[]};
try{
 server=createServer(async(req,res)=>{try{
  res.setHeader('Cache-Control','no-store');
  if(req.url.startsWith('/api/n88/teacher/class/')){
   let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw),action=req.url.split('/').at(-1);calls.push({action,body});
   if(!['list','guidance-list'].includes(action)){if(holdMutation)await new Promise(ok=>releaseMutation=ok);res.writeHead(503);res.end();return;}
   const data=action==='guidance-list'?{tasks:[{subitemId:'task',title:'مهمة مصطنعة',sourceStamp:'a'.repeat(64),revision:0,executionInstructions:'تعليمات حالية',deliveryInstructions:'تسليم حالي',needsRepublication:false}]}:{classId:'class',rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64),policyRevision:0,visibility:fields,students:[{studentId:'s',enrollmentId:'e',revision:1,label:'طالب مصطنع',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}],reconciliation:(body.reconcile||[]).map(()=>({state:mode,created:mode==='committed'?1:0,skipped:0,failed:0}))};
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ack:true,binding:body.binding,requestId:null,rollout:'public',data}));return;
  }
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end((await readFile('tests/fixtures/n88-class-management/index.html','utf8')).replace('/tests/fixtures/n88-class-management/entry.js','/fixture-entry.js'));return;}
  if(req.url==='/fixture-entry.js'){res.setHeader('Content-Type','text/javascript');res.end(entry);return;}
  const relative=req.url.split('?')[0];if(!relative.startsWith('/src/')||relative.includes('..')){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',relative.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(path.resolve('.'+relative)));
 }catch(e){res.writeHead(500);res.end();}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(52589,'127.0.0.1',ok);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:'http://127.0.0.1:52589',timeoutMs:90000},async({createContext,url})=>{
  const ctx=await createContext(),page=await ctx.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('.n88-class-roster>li').waitFor();
  await page.locator('.n88-class-settings summary').click();await page.locator('input[name=name]').check();
  await page.locator('[data-action=batch]').click();await page.getByText(/نتيجة العملية غير مؤكدة/).waitFor();
  assert.equal(await page.locator('input[name=name]').isChecked(),true);
  const command=calls.find(x=>x.action==='issue-missing').body;
  await page.evaluate(()=>window.fixture.remount());await page.locator('.n88-class-roster>li').waitFor();
  const remount=calls.filter(x=>x.action==='list').at(-1).body.reconcile;
  await page.reload();await page.locator('.n88-class-roster>li').waitFor();
  const reload=calls.filter(x=>x.action==='list').at(-1).body.reconcile;
  if(baseline){assert.deepEqual(remount,[]);assert.deepEqual(reload,[]);report.checks.push('REPRODUCED: actual runtime remount and HTTP reload both lose uncertain request identity');}
  else{
   const wanted=[{requestId:command.requestId,expectedRosterRevision:command.expectedRosterRevision,expectedCredentialRevision:command.expectedCredentialRevision}];assert.deepEqual(remount,wanted);assert.deepEqual(reload,wanted);
   await page.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();
   await page.locator('[data-action=batch]').click();await page.getByText(/نتيجة العملية غير مؤكدة/).waitFor();assert.equal(calls.filter(x=>x.action==='issue-missing').length,1);
   await page.locator('[data-action=refresh]').click();await page.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();
   mode='committed';await page.evaluate(()=>window.fixture.remount());await page.getByText(/تأكد إقرار العملية السابقة/).waitFor();
   assert.equal(calls.filter(x=>x.action==='issue-missing').length,1);
   assert.equal(await page.locator('.n88-class-roster>li').evaluate(el=>getComputedStyle(el).display),'grid');
   assert.equal(await page.locator('input[name=name]').isChecked(),false);
   report.checks.push('same command ID and original roster/credential versions reconciled after actual runtime remount + reload','list200/UNKNOWN and replacement click never dispatch another mutation','authoritative committed receipt clears uncertainty even when current data disagrees; current fields retained','actual account binding + real ownership guard and source CSS');
  }
  await page.evaluate(()=>window.fixture.retire());await page.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.deepEqual(errors,[]);
  if(!baseline){
   // Pending transport is retired by the real lifetime abort, yet its pre-send
   // hint survives both a new runtime entry and a new document.
   const pendingContext=await createContext(),pendingPage=await pendingContext.newPage();pendingPage.setDefaultTimeout(6000);mode='unknown';holdMutation=true;
   await pendingPage.goto(url);await pendingPage.locator('.n88-class-roster>li').waitFor();
   const sent=pendingPage.waitForRequest(r=>r.url().endsWith('/issue-missing'));await pendingPage.locator('[data-action=batch]').click();const pendingBody=(await sent).postDataJSON();
   await pendingPage.evaluate(()=>window.fixture.remount());await pendingPage.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();
   await pendingPage.reload();await pendingPage.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();assert.equal(calls.filter(x=>x.action==='list').at(-1).body.reconcile[0].requestId,pendingBody.requestId);
   releaseMutation?.();holdMutation=false;
   const beforeLease=calls.length;await pendingPage.evaluate(()=>window.fixture.leaseOff());await pendingPage.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.equal(calls.length,beforeLease);
   report.checks.push('actual pending handler remount + reload preserve pre-send hint; real lease denial dispatches no request');
   // A separate fresh synthetic context exercises the affected guidance form.
   const guidanceContext=await createContext(),guidancePage=await guidanceContext.newPage();guidancePage.setDefaultTimeout(6000);
   await guidancePage.goto(url);await guidancePage.locator('.n88-class-roster>li').waitFor();
   const edit=async()=>{await guidancePage.locator('.n88-task-guidance summary').click();await guidancePage.locator('textarea[name=executionInstructions]').fill('تعليمات اختبار خاصة');};
   const uncertainGuidance=async()=>{await guidancePage.locator('[data-guidance-revalidate]').waitFor();await guidancePage.locator('.n88-task-guidance[aria-busy="false"]').waitFor();};
   await edit();await guidancePage.locator('[data-guidance] button[type=submit]').click();await uncertainGuidance();
   await guidancePage.locator('[data-guidance-revalidate]').click();await guidancePage.locator('[data-guidance] button[type=submit]').click();await uncertainGuidance();
   assert.equal(calls.filter(x=>x.action==='guidance-save').length,1);
   await guidancePage.reload();await guidancePage.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();await edit();await guidancePage.locator('[data-guidance] button[type=submit]').click();await uncertainGuidance();assert.equal(calls.filter(x=>x.action==='guidance-save').length,1);
   const hints=await guidancePage.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rakeezx-n88-uncertain-v1:')));assert(!JSON.stringify(hints).includes('تعليمات اختبار خاصة'));
   report.checks.push('actual guidance save/revalidate/reload handlers cannot replay or replace UNKNOWN; no guidance text stored');
   const blockedContext=await createContext(),blockedPage=await blockedContext.newPage();blockedPage.setDefaultTimeout(6000);
   await blockedPage.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Synthetic storage fault','QuotaExceededError');};});
   const beforeBlocked=calls.filter(x=>x.action==='issue-missing').length;
   await blockedPage.goto(url);await blockedPage.locator('.n88-class-roster>li').waitFor();await blockedPage.locator('[data-action=batch]').click();await blockedPage.getByText(/نتيجة العملية غير مؤكدة/).waitFor();assert.equal(calls.filter(x=>x.action==='issue-missing').length,beforeBlocked);
   report.checks.push('actual batch handler with synthetic quota failure dispatches zero mutations');
  }
  report.mutationCalls=calls.filter(x=>x.action==='issue-missing').length;
 });report.status='PASS';
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{releaseMutation?.();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup={ownedServerClosed:true,ownedBrowserClosed:true,sharedBrowserLease:'not required: canonical isolated synthetic phase'};await writeFile(dir+(baseline?'baseline-ui.json':'ui.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
