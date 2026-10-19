// AI-authored: bounded presentation fixtures in the actual application, no import replay.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
const taskId='continuous-n107-missing-class-code-field-20261019',runId='b3a4f494-7079-4175-a6cd-29a95321b1d3';
const base='http://127.0.0.1:49859',root=resolve('.'),out='tests/n107-actual-1719';
const evidence={taskId,runId,checks:[],failures:[],testedFiles:{},scope:'Actual account-bound import view; synthetic CSV, no submit mutation or live service.'};
for(const f of ['src/views/class-import-center.js','src/styles/teacher-setup-import.css'])evidence.testedFiles[f]=createHash('sha256').update(await readFile(f)).digest('hex');
const service=syntheticService();
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,base).pathname;
 if(pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}
 const f=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!f.startsWith(root+sep))throw Error('Outside root');
 let content=await readFile(f);
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
const pass=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
try {
 await new Promise((r,j)=>{server.once('error',j);server.listen(49859,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();await prepare(page);const before=await snapshot(page);
  await page.locator('[data-change="grade-file"]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('اسم الطالب\nطالب اصطناعي')});
  await page.locator('[data-import-kind]').selectOption('new');
  const review=()=>page.locator('[data-act="grade-review"]').click();
  await review();
  await page.waitForFunction(()=>document.activeElement?.matches('[data-roster-field="grade"][aria-invalid="true"]'));
  await page.locator('[data-roster-field="grade"]').selectOption('4');
  await page.locator('[data-roster-subject]').selectOption({index:1});
  const code=page.locator('[data-roster-field="label"]');
  async function fieldError(message){
   await page.waitForFunction(()=>document.activeElement?.matches('[data-roster-field="label"][aria-invalid="true"]'));
   assert.equal(await page.locator('#roster-label-error').innerText(),message);
   assert.equal(await code.getAttribute('aria-describedby'),'roster-label-error');
   assert.equal(await page.locator('.grade-transfer__message.is-error').count(),0);
   assert.equal(await page.locator('[data-act="class-import-confirm"]').count(),0);
   assert.ok(await code.evaluate(el=>getComputedStyle(el).borderColor===getComputedStyle(document.querySelector('#roster-label-error')).color));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await review();await fieldError('أدخل رمز الفصل');
  await page.screenshot({path:out+'/missing-code.png',fullPage:true});
  await code.fill('   ');await code.dispatchEvent('change');await review();await fieldError('أدخل رمز الفصل');
  await code.fill('أ/1');await code.dispatchEvent('change');await review();await fieldError('استخدم أحرفًا أو أرقامًا أو مسافة أو . _ -');
  await page.screenshot({path:out+'/invalid-code.png',fullPage:true});
  assert.equal(await code.getAttribute('maxlength'),'8');
  // Programmatic overlength input verifies the submit guard as well as the native cap.
  await code.evaluate(el=>{el.value='123456789';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await review();await fieldError('رمز الفصل: 8 أحرف كحد أقصى');
  await code.fill('أ-1');await code.dispatchEvent('change');
  assert.equal(await code.getAttribute('aria-invalid'),'false');
  assert.equal(await page.locator('#roster-label-error').isVisible(),false);
  await review();await page.locator('[data-act="class-import-confirm"]').waitFor();
  assert.equal(await page.locator('[data-roster-preview]').count(),1);
  assert.equal(await page.locator('[data-roster-field="label"]').inputValue(),'أ-1');
  assert.equal(await snapshot(page),before);
  await page.screenshot({path:out+'/valid-code-review.png',fullPage:true});
  pass('n107_missing_class_code_precise_field_feedback','Actual app at loopback HTTP, fresh390px context, real synthetic account ownership/lease guards and CSV/review/change handlers: grade precedence; empty/whitespace code focused with direct error; invalid character/overlength precise error; valid code clears feedback and reaches existing review/confirm without writes. CSS red border and no overflow verified; database/outbox snapshot unchanged.');
  await context.close();
 });
}catch(e){evidence.failures.push(e.stack);process.exitCode=1;console.error(e.stack);}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(out+'/result.json',JSON.stringify(evidence,null,2));}
