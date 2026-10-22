// AI-authored: bounded actual-app readback proof; no source collector or real account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService} from '../n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const taskId='continuous-n36-local-readback-distinction-20261023',runId='d18bc10f-300d-4f34-bf63-1cdbd2e18e59';
const baseSha='2e43dc14161c6a27af7c30fc6bf29f39fd2a0bc4',base='http://127.0.0.1:49943',root=resolve('.'),folder='tests/n36-local-readback-20261023/';
const baseline=process.argv.includes('--baseline'),service=syntheticService();
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname.startsWith('/__n73/')){let body='';for await(const b of req)body+=b;res.setHeader('content-type','application/json');return res.end(JSON.stringify(await service.request(u.pathname.slice(7),JSON.parse(body||'{}'))));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));
 const bytes=baseline&&u.pathname==='/src/views/class-import-center.js'?execFileSync('git',['show',baseSha+':src/views/class-import-center.js']):await fs.readFile(f);
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
const evidence={taskId,runId,baseSha,baseline,applicationSha256:createHash('sha256').update(baseline?execFileSync('git',['show',baseSha+':src/views/class-import-center.js']):await fs.readFile('src/views/class-import-center.js')).digest('hex'),cases:[]};
try{
 await new Promise(r=>server.listen(49943,'127.0.0.1',r));
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 for(const scenario of (baseline?['absent','abort','context-before']:['absent','foreign','abort','timeout','context-before','session-after','owner-after','lease-after','document-after','malformed','digest-invalid','receipts','pending','original-term'])){
 const context=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'});
 try{
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();await openReadyServedDemo(page,base);
 await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
 await page.evaluate(async scenario=>{
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),cloud=await import('/src/lib/cloud.js');
  const {owner,foreignOwner}=await import('/tests/n73-account-flow-fixture.mjs');
  const marker={ownerId:owner,batchId:'a'.repeat(64),yearId:'n73-year',termId:'n73-term',receipts:{one:{status:'saved',total:2,added:2,existing:0,remaining:0}}};
  if(scenario==='foreign')marker.ownerId=foreignOwner;
  if(scenario==='malformed')marker.batchId='invalid-private-value';
  if(scenario==='original-term')marker.termId='synthetic-original-term';
  if(['pending','digest-invalid'].includes(scenario)){
   const rows=[{name:'Synthetic 1',classroom:'خامس1'}],digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows))))].map(n=>n.toString(16).padStart(2,'0')).join('');
   marker.pending={[scenario==='digest-invalid'?'b'.repeat(64):digest]:{rows}};
   const enrollment={id:'readback-enrollment',ownerId:owner,studentId:'n73-student1',sectionId:'n73-source-section',status:'active'};
   await d.put('enrollments',enrollment);s.state.enrollments.push(enrollment);
  }
  if(['foreign','malformed','receipts','pending','original-term','digest-invalid','context-before','session-after','owner-after','lease-after','document-after'].includes(scenario)){s.state.device.n36NamesBatch=marker;await d.put('device',s.state.device);}
  location.hash='#/classes/koshoof?import=1';
  const lease=(await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
  window.readbackSetup={s,d,cloud,owner,foreignOwner,scenario,lease};
 },scenario);
 await page.locator('[data-act=n36-batch-resume]').waitFor();
 const before=await page.evaluate(async()=>JSON.stringify(await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()));
 const requests=[];page.on('request',r=>requests.push({method:r.method(),url:r.url()}));
 await page.evaluate(()=>{
  const {s,cloud,owner,foreignOwner,scenario,lease}=window.readbackSetup;
  const initial=cloud.session;window.readbackCounts={writes:0,writeTransactions:0,messages:0,snapshots:0};
  for(const name of ['put','add','delete','clear']){const original=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){window.readbackCounts.writes++;return original.apply(this,args);};}
  const send=window.postMessage;window.postMessage=function(...args){window.readbackCounts.messages++;return send.apply(this,args);};
  window.chrome={runtime:{sendMessage(){window.readbackCounts.messages++;}}};
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){
   if(mode==='readwrite')window.readbackCounts.writeTransactions++;
   const tx=transaction.call(this,names,mode,...rest);
   if(mode==='readonly'&&Array.isArray(names)&&names.length===7&&names.includes('device')){
    window.readbackCounts.snapshots++;
    if(scenario==='abort')queueMicrotask(()=>tx.abort());
    if(scenario==='timeout')Object.defineProperty(tx,'oncomplete',{set(){}});
    tx.addEventListener('complete',()=>{
     if(scenario==='session-after')cloud.setMockAuth({id:owner},{...initial,access_token:'different-synthetic-session'});
     if(scenario==='owner-after')cloud.setMockAuth({id:foreignOwner},{...initial,user:{id:foreignOwner}});
     if(scenario==='lease-after')lease.invalidate('synthetic-readback-test');
     if(scenario==='document-after')window.dispatchEvent(new Event('pagehide'));
    });
   }
   return tx;
  };
  if(scenario==='context-before')window.dispatchEvent(new Event('pagehide'));
 });
 await page.locator('[data-act=n36-batch-resume]').click();
 await page.waitForFunction(()=>document.querySelector('[data-n36-handoff-status]')?.textContent.trim().length>0||document.querySelector('[data-class-access-status]')||document.body.textContent.includes('الاستيراد غير متاح الآن'));
 const gated=await page.locator('[data-n36-handoff-status]').count()===0; const text=await page.locator(gated?'[data-class-access-status]':'[data-n36-handoff-status]').innerText();
 const progress=await page.evaluate(()=>window.rakeezNamesLocalProgress());
 const counts=await page.evaluate(()=>window.readbackCounts);
 assert.deepEqual(Object.keys(progress),['checkpoint','relation','confirmedRows','confirmedReceipts','pendingRows','pendingSavedRows']);
 assert.equal(counts.writes,0);assert.equal(counts.writeTransactions,0);assert.equal(counts.messages,0);
 assert.deepEqual(requests.filter(r=>!r.url.startsWith(base+'/src/')&&!r.url.startsWith(base+'/node_modules/')),[]);
 const after=await page.evaluate(async()=>JSON.stringify(await(await import('/tests/n36-receiver-fixture.mjs')).checkpoint()));assert.equal(after,before);
 assert.doesNotMatch(text,/a7300000|b7300000|Synthetic|invalid-private-value|https?:|Error|stack|different-synthetic/);
 if(baseline)assert.equal(text,'لا يوجد أثر محلي موثوق يثبت الحفظ؛ نتيجة الإضافة ما زالت غير محسومة. لم تُعد كتابة أي صف.');
 else if(['absent','foreign'].includes(scenario)){assert.match(text,/اكتملت القراءة المحلية/);assert.doesNotMatch(text,/0|٠|مالك|آخر/);assert.equal(progress.checkpoint,'none');}
 else if(['abort','timeout'].includes(scenario)){assert.match(text,/لم تكتمل قراءة التخزين المحلي/);assert.equal(progress.checkpoint,'unresolved');}
 else if(['malformed','digest-invalid'].includes(scenario)){assert.match(text,/تعذّر التحقق من الأثر المحلي/);assert.equal(progress.checkpoint,'unresolved');}
 else if(scenario.includes('before')||scenario.includes('after')){if(gated)assert.ok(['ownership','lease','verification'].includes(await page.locator('[data-class-access-status]').getAttribute('data-class-access-status')));else assert.match(text,/تعذّر التحقق من سياق الحساب/);assert.doesNotMatch(text,/إيصالات|صفًا/);assert.equal(progress.checkpoint,scenario==='session-after'?'receipts':'unresolved');}
 else {assert.match(text,/إيصالات محلية مؤكدة: 1 \(2 صفًا\)/);assert.equal(progress.confirmedRows,2);if(scenario==='pending'){assert.equal(progress.pendingRows,1);assert.equal(progress.pendingSavedRows,1);}if(scenario==='original-term')assert.match(text,/السنة والفصل الدراسي الأصليين/);}
 assert.ok(await page.locator('link[rel=stylesheet]').count()>0);
 if(['absent','timeout','pending'].includes(scenario))await page.screenshot({path:folder+(baseline?'baseline-':'candidate-')+scenario+'.png',fullPage:true});
 console.log('case PASS: '+scenario);evidence.cases.push({scenario,gated,text,progress,counts,requests:requests.length,databaseUnchanged:true});
 }finally{await context.close();}
 }
 });
 if(!baseline)assert.equal(evidence.cases.find(c=>c.scenario==='absent').text,evidence.cases.find(c=>c.scenario==='foreign').text);
 const paths=['src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','assets/extensions/rakeez-teacher-import-helper-0.5.37.zip','assets/extensions/rakeez-teacher-import-helper-0.5.37.manifest.json'];
 evidence.unchanged={};for(const path of paths){const bytes=await fs.readFile(path);assert.deepEqual(bytes,execFileSync('git',['show',baseSha+':'+path],{maxBuffer:4000000}));evidence.unchanged[path]=createHash('sha256').update(bytes).digest('hex');}
 evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;}
finally{await new Promise(r=>server.close(r));evidence.resources={serverClosed:!server.listening,browserClosedByOwnedHelper:true,origin:base};await fs.writeFile(folder+(baseline?'baseline':'candidate')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}
