/** AI: affected real runtime/client/component/CSS; existing HTTP fixture pattern. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {withIsolatedLocalBrowser} from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const dir='tests/n88-five-ui-delivery-20261024/';
const report={aiAuthored:true,status:'FAIL',providerOperations:0,renderedUI:false,initialHarnessFailure:{actual:'block',expected:'grid',reason:'CSS assertion initially targeted the ul; existing source CSS applies grid to each li. Corrected selector only; Product source unchanged.'}};
const binding={enabled:true,ownerId:'synthetic-owner',sessionId:'synthetic-session',leaseId:'synthetic-lease',teachingId:'synthetic-teaching',classId:'synthetic-class',termId:'synthetic-term',contextRevision:'1',validUntil:0};
const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]));
let mode='mixed',mutationCalls=0,lastMutation,server;
const students=['طالب 10','طالب 2','طالب 1','طالب 2','طالب 3'].map((label,i)=>({label,studentId:'s'+i,enrollmentId:'e'+i,revision:1,hasActiveCode:i<2,credentialVersion:i<2?1:0,recoveryStatus:i<2?'legacy':'inactive',credential:null}));
const entry=`import {mountClassService} from '/src/lib/student-portal-runtime.js';let context=${JSON.stringify(binding)};context.validUntil=Date.now()+120000;let key='same-owner';const listeners=new Set();let h=mountClassService(document.querySelector('#class-portal'),{getBinding:()=>{if(!context.enabled)throw Error('owner');return {key,token:'synthetic-token',context};},subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);}});window.fixture={refresh:()=>document.querySelector('[data-action="refresh"]')?.click(),off(){context.enabled=false;key='retired';for(const fn of [...listeners])fn();},mode:async value=>{await fetch('/fixture-mode',{method:'POST',body:value});h.dispose();context.enabled=true;context.validUntil=Date.now()+120000;h=mountClassService(document.querySelector('#class-portal'),{getBinding:()=>({key:'new-'+value,token:'synthetic',context}),subscribe:()=>()=>{}});}};`;
try{
 server=createServer(async(req,res)=>{try{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/fixture-mode'){let v='';for await(const b of req)v+=b;assert(['empty','unavailable'].includes(v));mode=v;res.end();return;}
  if(req.url.startsWith('/api/n88/teacher/class/')){
   let raw='';for await(const b of req){raw+=b;assert(raw.length<12000);}const body=JSON.parse(raw);
   if(!req.url.endsWith('/list')){mutationCalls++;lastMutation={action:req.url.split('/').at(-1),body};res.writeHead(503,{'x-n88-service-stage':'projection-commit'});res.end();return;}
   if(mode==='unavailable'){res.writeHead(503);res.end();return;}
   const data={classId:binding.classId,rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64),policyRevision:0,students:mode==='empty'?[]:students.slice().reverse(),visibility:fields,reconciliation:(body.reconcile||[]).map(()=>({state:'unknown',created:0,skipped:0,failed:0}))};
   res.writeHead(200,{'Content-Type':'application/json','x-n88-service-region':'ap-south-1'});res.end(JSON.stringify({rollout:'public',ack:true,binding:body.binding,requestId:null,data}));return;
  }
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end((await readFile('tests/fixtures/n88-class-management/index.html','utf8')).replace('/tests/fixtures/n88-class-management/entry.js','/fixture-entry.js'));return;}
  if(req.url==='/fixture-entry.js'){res.setHeader('Content-Type','text/javascript');res.end(entry);return;}
  const relative=req.url.split('?')[0];if(!relative.startsWith('/src/')||relative.includes('..')){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',relative.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(path.resolve('.'+relative)));
 }catch{res.writeHead(400);res.end();}});
 await new Promise(ok=>server.listen(52488,'127.0.0.1',ok));const origin='http://127.0.0.1:52488';
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-current-five-ui-delivery-20261024.json',runId:'b249f900-9cd7-499a-8902-e09f387def2c',url:origin},async({createContext})=>{const ctx=await createContext();const page=await ctx.newPage();await page.goto(origin);
 await page.getByText('الطلاب: 5 · الرموز الفعّالة: 2',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.n88-class-student strong').allTextContents(),['طالب 1','طالب 2','طالب 2','طالب 3','طالب 10']);
 assert.equal(await page.locator('.n88-class-roster > li').nth(1).locator('[data-action="review-revoke"]').isDisabled(),false);
 assert.equal(await page.locator('.n88-class-roster > li').nth(2).locator('[data-action="review-revoke"]').isDisabled(),true);
 // Sorted row actions must keep the original identity, not arrival ordinal.
 assert.match(await page.locator('.n88-class-roster > li').last().textContent(),/طالب 10/);
 assert.equal(await page.locator('.n88-class-roster > li').last().locator('[data-action="review-revoke"]').isDisabled(),false);
 await page.getByRole('button',{name:'إنشاء الرموز الناقصة',exact:true}).click();
 await page.getByText(/نتيجة العملية غير مؤكدة/).waitFor();assert.equal(mutationCalls,1);
 await page.locator('[data-n88-mutation-details] summary').click();
 await page.waitForFunction(()=>document.querySelector('[data-n88-mutation-details] pre')?.textContent.startsWith('{'));
 const diagnostic=JSON.parse(await page.locator('[data-n88-mutation-details] pre').textContent());
 assert.deepEqual(Object.keys(diagnostic).sort(),['action','code','elapsedMs','httpStatus','outcome','schema','stage']);assert.equal(diagnostic.action,'issue-missing');assert.equal(diagnostic.httpStatus,503);assert.equal(diagnostic.stage,'projection-commit');
 await page.getByRole('button',{name:'مراجعة القائمة',exact:true}).click();await page.getByText(/نجاح القراءة لا يؤكد الإنشاء/).waitFor();assert.equal(mutationCalls,1);
 assert.equal(JSON.parse(await page.locator('[data-n88-mutation-details] pre').textContent()).outcome,'unconfirmed');
 assert.equal(JSON.parse(await page.locator('[data-n88-list-response]').getAttribute('data-n88-list-response')).outcome,'success');
 assert.equal(await page.locator('link[href="/src/styles/student-portal-class.css"]').count(),1);
 // Exercise the sorted final row through the real handler, using only synthetic HTTP.
 const finalRow=page.locator('.n88-class-roster > li').last();
 await finalRow.locator('summary').click();await finalRow.locator('[data-action="review-revoke"]').click();
 assert.equal(await page.locator('[data-confirm] h3').textContent(),'طالب 10');
 await page.locator('[data-action="confirm"]').click();
 await page.getByText(/نتيجة العملية غير مؤكدة/).waitFor();
 assert.equal(mutationCalls,2);assert.equal(lastMutation.action,'revoke');
 assert.equal(lastMutation.body.studentId,'s0');assert.equal(lastMutation.body.enrollmentId,'e0');
 assert(!JSON.stringify(diagnostic).includes('synthetic'));assert(!JSON.stringify(diagnostic).includes('s0'));
 assert.equal(await page.locator('.n88-class-roster > li').first().evaluate(el=>getComputedStyle(el).display),'grid');
 await page.evaluate(()=>window.fixture.off());await page.waitForFunction(()=>!document.querySelector('.n88-class-roster'));assert.equal(await page.locator('[data-n88-mutation-details]').count(),0);
 await page.evaluate(()=>window.fixture.mode('empty'));await page.getByText('الطلاب: 0 · الرموز الفعّالة: 0',{exact:true}).waitFor();assert.equal(await page.locator('[data-action="batch"]').isDisabled(),true);
 await page.evaluate(()=>window.fixture.mode('unavailable'));await page.getByText('تعذّر الاتصال بمساحة الطلاب. حاول مجددًا.',{exact:true}).waitFor();assert.equal(await page.locator('.n88-class-purpose').count(),0);
 }); report.status='PASS';report.renderedUI=true;report.checks=['actual mounted runtime/client/handlers/CSS over fresh loopback HTTP','five mixed active/inactive rows: distinct total/active counts','Arabic numeric order; duplicate-label ties preserve active/inactive identity; actual revoke handler sends original student/enrollment' ,'uncertain mutation and successful list diagnostics remain separate; no command replay','owner switch removes prior roster and mutation metadata','empty is confirmed zero; unavailable never claims zero'];
}catch(e){report.failure={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{if(server){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup={ownedBrowserClosed:true,ownedServerClosed:true};await writeFile(dir+'ui.json',JSON.stringify(report,null,2)+'\n');}
