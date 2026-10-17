// AI-authored: actual shipped controller/worker/application; synthetic Chrome and school only.
// This deliberately does not rewrite APP_ORIGIN, suppress guards, or fabricate saved receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, extname, sep} from 'node:path';
import {createHash, webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {syntheticService} from './n73-account-flow-fixture.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {unzipSync} from '../src/lib/student-import-parsers.js';
import {validateHandoff, HANDOFF_TTL} from '../src/lib/n36-extension-protocol.js';

const taskId='continuous-n36-final-receiver-journey-20261018',runId='7f8c82ff-b9cc-4fd1-969e-fc45c94caf5f';
const baseSha='f2395c4841db30fb29e5908fe30e6154a925116a',base='http://127.0.0.1:49483',root=resolve('.');
const extension='extensions/rakeez-teacher-import-helper/',canonical='C:/Users/Abody/Projects/RakeezX';
const classes=['خامس1','خامس2','خامس3','خامس4','خامس5','خامس6','خامس7','خامس8','سادس6','سادس7'];
const counts=[28,28,29,28,30,28,29,31,34,38],alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const rows=[...classes].reverse().flatMap(classroom=>Array.from({length:counts[classes.indexOf(classroom)]},(_,i)=>({classroom,name:'طالب اصطناعي '+alphabet[Math.floor(i/alphabet.length)]+alphabet[i%alphabet.length]})));
const evidence={taskId,runId,baseSha,checks:[],errors:[],sourceRows:rows.length,classCounts:Object.fromEntries(classes.map((c,i)=>[c,counts[i]])),preservedFailures:[]};
const record=(name,status,detail)=>{evidence.checks.push({name,status,evidence:detail});console.log(status+' '+name);};
const hash=b=>createHash('sha256').update(b).digest('hex');
let openedRoute=null,workerInternal,workerExternal;
// Actual worker code executes in its own realm; only Chrome APIs are fabricated.
async function workerFixture(){
 const data={},runtimeId='a'.repeat(32),listeners={};
 const chrome={runtime:{id:runtimeId,getURL:p=>'chrome-extension://'+runtimeId+'/'+p,onMessage:{addListener:f=>listeners.internal=f},onMessageExternal:{addListener:f=>listeners.external=f}},
  storage:{session:{get:async k=>structuredClone(k===null?data:Object.hasOwn(data,k)?{[k]:data[k]}:{}),set:async o=>Object.assign(data,structuredClone(o)),remove:async k=>{delete data[k];}}},
  alarms:{create:async()=>{},clear:async()=>true,onAlarm:{addListener:f=>listeners.alarm=f}},
  tabs:{create:async()=>({id:99}),update:async(id,{url})=>{openedRoute=url;},remove:async()=>{},onRemoved:{addListener:f=>listeners.remove=f}}};
 const realm=vm.createContext({URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console});
 // This is the established package test's import-linking technique, without changing any engine code.
 vm.runInContext((await fs.readFile(extension+'handoff-protocol.js','utf8')).replaceAll('export ',''),realm);
 vm.runInContext((await fs.readFile(extension+'handoff-worker.js','utf8')).replace(/^import .*?;\r?\n/m,''),realm);
 const send=(kind,message,sender)=>new Promise((done,reject)=>{
  const timer=setTimeout(()=>reject(Error('Synthetic Chrome reply deadline')),5000);
  realm.messageJSON=JSON.stringify(message);
  const accepted=listeners[kind](vm.runInContext('JSON.parse(messageJSON)',realm),sender,result=>{clearTimeout(timer);done(JSON.parse(JSON.stringify(result)));});
  if(!accepted){clearTimeout(timer);done({ok:false,fixture:'sender rejected without reply'});}
 });
 workerInternal=m=>send('internal',m,{id:runtimeId,url:chrome.runtime.getURL('popup.html')+'?run=journey',tab:{id:7,windowId:1}});
 workerExternal=(m,sender)=>send('external',m,sender);
 return {data};
}
const service=syntheticService();
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,base).pathname;
 if(pathname.startsWith('/__n73/')){let body='';for await(const c of req)body+=c;const result=await service.request(pathname.slice(7),JSON.parse(body||'{}'));res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;}
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch(error){res.writeHead(404);res.end(error.message);}});
try{
 const prior=JSON.parse(await fs.readFile('tests/n36-final-journey-browser.json','utf8').catch(()=>'{}'));
 evidence.preservedFailures=[...(prior.preservedFailures??[]),...(prior.failure?[prior.failure]:[])];
 const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.11.manifest.json','utf8'));
 const archive=await fs.readFile('assets/extensions/'+manifest.archive.file),files=unzipSync(archive);
 assert.equal(hash(archive),manifest.archive.sha256);assert.equal(archive.length,manifest.archive.bytes);
 assert.deepEqual(Object.keys(files).sort(),manifest.files.map(f=>f.file).sort());
 for(const item of manifest.files){const source=await fs.readFile(extension+item.file);assert.deepEqual(Buffer.from(files[item.file]),source);assert.equal(hash(source),item.sha256);assert.equal(source.length,item.bytes);}
 assert.equal((await fs.readFile(extension+'handoff-protocol.js','utf8')).replaceAll('\r\n','\n'),(await fs.readFile('src/lib/n36-extension-protocol.js','utf8')).replaceAll('\r\n','\n'));
 evidence.package=manifest.archive;
 // Read the existing updater's receipt; never invoke its mutation entry point.
 const stable=JSON.parse(await fs.readFile(canonical+'/artifacts/private-tools/n36-current/STABLE_CURRENT.json','utf8'));
 evidence.stable={version:stable.version,sourceTaskId:stable.sourceTaskId,publishedSha:stable.publishedSha};
 record('n36_0511_exact_archive_sources_and_stable_read_only','PASS',{files:manifest.files.length,archive:manifest.archive,stable:evidence.stable,unchangedEvidence:['tests/n36-popup-width-diagnostics-package.json','tests/n36-popup-width-diagnostics-browser.json','tests/n36-terminal-pager-evidence-browser.json'],extensionChanged:false});
 const envelope={schema:'rakeez-extension-names',version:1,source:'madrasati',scope:'reviewed-run',createdAt:Date.now(),expiresAt:Date.now()+HANDOFF_TTL,rows:rows.filter(r=>r.classroom===classes[0])};
 envelope.expiresAt=envelope.createdAt+HANDOFF_TTL;
 assert.equal(validateHandoff(envelope).rows.length,28);
 assert.throws(()=>validateHandoff(envelope,envelope.expiresAt),/HANDOFF_LIMIT_OR_EXPIRED/);
 assert.throws(()=>validateHandoff({...envelope,rows:[envelope.rows[0],envelope.rows[0]]}),/HANDOFF_DUPLICATE/);
 assert.throws(()=>validateHandoff({...envelope,rows}),/HANDOFF_LIMIT_OR_EXPIRED/);
 record('n36_protocol_ttl_duplicate_and_per_transfer_cap','PASS','Actual shared protocol accepts one selected class, rejects expired/duplicate/303-row single transfer; no total-run cap asserted.');
 await workerFixture();
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49483,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile:canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:950},locale:'ar-SA'});
  try{
   await context.exposeBinding('syntheticExtensionMessage',async(_,message)=>workerInternal(message));
   await context.addInitScript(({base,rows})=>{
    sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
    const source={id:7,url:base+'/Dashboards/Schools',status:'complete'},report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'a'.repeat(32);
    window.chrome={runtime:{getManifest:()=>({version:'0.5.11'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:(...args)=>{
     if(typeof args[0]==='string'){window.externalClaimCalls=(window.externalClaimCalls??0)+1;args[2]?.({ok:false});return;}
     return window.syntheticExtensionMessage(args[0]);
    }},tabs:{get:async()=>source,onRemoved:{addListener(){}},onUpdated:{addListener(){}}},scripting:{executeScript:async input=>{
     if(input.files)return [];
     let result={ok:true};const mode=input.args?.[0];
     if(mode==='home')result={ok:true,runContext:{schoolId:'a'.repeat(32)},tables:[],warnings:[],links:[{kind:'students',path:report}]};
     if(mode==='fetch')result={ok:true,tables:[{category:'students',text:'اسم الطالب\tالفصل\n'+rows.map(r=>r.name+'\t'+r.classroom).join('\n')}],warnings:[],links:[],pagination:{series:'synthetic',current:1,total:1,terminal:true}};
     return [{frameId:0,result}];
    }}};
   },{base,rows});
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
   await openReadyServedDemo(page,base);
   const ready=await page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount());
   assert.equal(ready.ready,true);assert.equal(ready.lease.editable,true);assert.deepEqual(ready.outbox,[]);
   const checkpoint=()=>page.evaluate(async()=>(await import('/tests/n36-receiver-fixture.mjs')).checkpoint());
   const before=await checkpoint();
   const runner=await context.newPage();runner.setDefaultTimeout(10000);runner.on('pageerror',e=>evidence.errors.push(e.message));
   await runner.goto(base+'/'+extension+'popup.html?run=journey');
   await runner.waitForFunction(()=>typeof window.n36BeforeExport==='function');
   await runner.evaluate(()=>{const c=new BroadcastChannel('rakeez-private-one-start');c.postMessage({type:'launch',token:'journey',tabId:7});c.close();});
   await runner.locator('#source-class-select').waitFor();
   assert.deepEqual(await runner.locator('#source-class-select option').evaluateAll(es=>es.slice(1).map(e=>e.value)),classes);
   assert.equal(await runner.locator('#handoff-transfer').isDisabled(),true);
   for(const classroom of classes){await runner.locator('#source-class-select').selectOption(classroom);assert.deepEqual(await runner.locator('#source-class-names li').allTextContents(),rows.filter(r=>r.classroom===classroom).map(r=>r.name));}
   assert.equal(openedRoute,null,'review/selection must not send automatically');assert.deepEqual(await checkpoint(),before);
   record('n36_actual_controller_303_ten_sorted_class_reviews_no_automatic_save','PASS',{classes,counts,total:rows.length,actualDOM:true,networkAndChromeOnlyFixtures:true});
   await runner.locator('#source-class-select').selectOption(classes[0]);await runner.locator('#handoff-transfer').click();
   await runner.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('فُتح'));
   assert.ok(openedRoute?.startsWith('https://rakeezx.com/#/classes/koshoof?import=1&extension='));
   assert.equal(await runner.locator('#source-class-select').isDisabled(),true);
   const route=new URL(openedRoute).hash;
   // The same synthetic account document retains the owner/lease/DB checkpoint.
   // Navigate only its hash, to the exact real receiver route produced by the worker.
   await page.evaluate(route=>location.hash=route,route);
   await page.locator('[data-n36-handoff-status]').filter({hasText:'تعذّر النقل'}).waitFor();
   const failure=await page.evaluate(async()=>{
    const transport=await import('/src/lib/n36-extension-handoff.js'),protocol=await import('/src/lib/n36-extension-protocol.js');
    let error;try{await transport.claimHandoff({extensionId:'a'.repeat(32),nonce:'b'.repeat(64)});}catch(e){error=e.message;}
    const s=await import('/src/store.js');
    return {error,actualOrigin:location.origin,requiredOrigin:protocol.APP_ORIGIN,externalClaimCalls:window.externalClaimCalls??0,owner:s.getActiveWorkspace().authUserId,databaseName:s.getActiveWorkspace().databaseName,lease:s.getOfflineLeaseStatus(),status:document.querySelector('[data-n36-handoff-status]').textContent};
   });
   assert.equal(failure.error,'HANDOFF_UNAVAILABLE');assert.equal(failure.externalClaimCalls,0);assert.equal(failure.lease.editable,true);
   assert.deepEqual(await checkpoint(),before);assert.equal(await page.locator('.n36-receiver').count(),0);
   evidence.blocker={type:'environment',...failure,remaining:'Run the unchanged real transport/receiver on an explicitly authorized synthetic HTTPS rakeezx.com origin, with fabricated Chrome/network APIs, or approve a specific origin-injection test seam. The loopback-only helper cannot supply that origin; weakening or replacing the Product origin guard is excluded.'};
   record('n36_actual_extension_to_actual_receiver_full_roster_explicit_save_and_ack','FAIL',evidence.blocker);
   record('n36_receiver_owner_ttl_duplicate_partial_and_final_package_guards','NOT_RUN','Protocol TTL/duplicate and exact package passed separately. Receiver save/normal Sync ACK, persisted resume, partial and owner-change scenarios cannot be reached after the real origin rejection; no saved receipt fabricated.');
   await runner.locator('#run-cancel').click();
   evidence.noMutation=true;
  }finally{await context.close();}
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='BLOCKED';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
 if(server.listening){server.closeAllConnections();await new Promise(done=>server.close(done));}
 evidence.cleanup='Canonical isolated helper closed owned contexts/browser; owned loopback server closed. No user browser/profile, external navigation, live mutation, shared lease, or updater mutation.';
 evidence.nativeActionPopup={status:'NOT_RUN',evidence:'HTTP controller execution is not native action-popup/module-error reproduction; prior native limitation preserved.'};
 await fs.writeFile('tests/n36-final-journey-browser.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({status:evidence.status,failure:evidence.failure,checks:evidence.checks.length}));
}
