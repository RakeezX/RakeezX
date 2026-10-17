// AI: actual HTTP popup DOM/CSS/controllers, synthetic browser APIs only; no school access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-simpler-reviewed-roster-flow-0510-20261017',runId='e1a6a4b5-41dd-4733-9627-1c8fe012cd34';
const base='http://127.0.0.1:49461',root=resolve('.'),out=resolve('test-results/n36-simpler-roster-flow');
const classes=['خامس1','خامس2','خامس3','خامس4','خامس5','خامس6','خامس7','خامس8','سادس6','سادس7'];
const counts=[28,28,29,28,30,28,29,31,34,38];
const rows=[...classes].reverse().flatMap(classroom=>Array.from({length:counts[classes.indexOf(classroom)]},(_,i)=>({classroom,name:'طالب اصطناعي '+'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'[Math.floor(i/20)]+'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'[i%20]})));
const evidence={taskId,runId,baseSha:'91b4adc8736f79c663512a2829eb3b57ec54998f',checks:[],errors:[],screenshots:[]};
try { const prior=JSON.parse(await fs.readFile('tests/n36-simpler-roster-flow-browser.json','utf8'));evidence.preservedFailures=prior.preservedFailures??[];if(prior.failure)evidence.preservedFailures.push({failure:prior.failure,correction:'Synthetic fixture name suffix used sequential Unicode points including Arabic marks; replaced with explicit Arabic letter alphabet. Production validation unchanged.'}); } catch {}
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base),file=resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});
const record=(name,data)=>{evidence.checks.push({name,status:'PASS',evidence:data});console.log('PASS '+name);};
try{
 await fs.mkdir(out,{recursive:true});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49461,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
  for(const scenario of ['complete','unknown','partial','cancel','expiry','context','race','error','receipt','send-cancel','send-expiry']){
   const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
   try{
    await context.addInitScript(({base,rows,scenario})=>{
     const source={id:7,url:base+'/Dashboards/Schools',status:'complete'},report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+'a'.repeat(32);
     window.sent=[];window.receipts=false;window.pauseGuard=false;
     window.chrome={runtime:{getManifest:()=>({version:'0.5.10'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:async m=>{
      if(m.type==='n36-create'){if(scenario==='error')return {ok:false};window.sent.push(m.envelope);if(scenario.startsWith('send-'))await new Promise(done=>window.releaseSend=done);return {ok:true,actionId:'synthetic-batch'};}
      if(m.type==='n36-result')return window.receipts?{ok:true,status:'saved',total:window.sent.at(-1).rows.length,remaining:0,added:window.sent.at(-1).rows.length,existing:0}:{ok:true,status:'pending'};
      return {ok:true};
     }},tabs:{get:async()=>source,onRemoved:{addListener(){}},onUpdated:{addListener(fn){window.sourceUpdated=fn;}}},scripting:{executeScript:async input=>{
      if(input.files)return [];
      const mode=input.args?.[0];let result={ok:true};
      if(mode==='guard'&&window.pauseGuard){window.guardWaiting=true;await new Promise(done=>window.releaseGuard=done);window.pauseGuard=false;}
      if(mode==='home')result={ok:true,runContext:{schoolId:'a'.repeat(32)},tables:[],warnings:[],links:[{kind:'students',path:report}]};
      if(mode==='fetch')result={ok:true,tables:[{category:'students',text:'اسم الطالب\tالفصل\n'+rows.map(r=>r.name+'\t'+r.classroom).join('\n')}],warnings:scenario==='partial'?[{category:'students',code:'PAGINATION_MISSING_NEXT'}]:[],links:[],pagination:{series:'synthetic',current:1,total:scenario==='unknown'?null:1,terminal:scenario!=='unknown'}};
      return [{frameId:0,result}];
     }}};
    },{base,rows,scenario});
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>evidence.errors.push(e.message));
    if(scenario==='expiry'||scenario==='send-expiry')await page.clock.install();
    await page.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html?run='+scenario);
    await page.waitForFunction(()=>typeof window.n36BeforeExport==='function');
    await page.evaluate(token=>{const channel=new BroadcastChannel('rakeez-private-one-start');channel.postMessage({type:'launch',token,tabId:7});channel.close();},scenario);
    await page.locator('#source-class-select').waitFor();
    assert.deepEqual(await page.locator('#source-class-select option').evaluateAll(es=>es.slice(1).map(e=>e.value)),classes);
    assert.equal(await page.locator('#source-class-summary').innerText(),'جُمعت 303 أسماء / 10 فصول');
    assert.equal(await page.locator('#legacy-tools').evaluate(e=>e.open),false);
    assert.equal(await page.locator('#bundle-review').isVisible(),false);
    assert.equal(await page.locator('#handoff-cancel').isVisible(),false);
    assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
    // Forging the old hidden checkbox must not unlock any unselected batch.
    await page.evaluate(()=>{const el=document.querySelector('#bundle-review');el.checked=true;el.dispatchEvent(new Event('change'));});
    assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
    await page.locator('#source-class-select').selectOption('خامس2');
    assert.deepEqual(await page.locator('#source-class-names li').allTextContents(),rows.filter(r=>r.classroom==='خامس2').map(r=>r.name));
    if(['unknown','partial'].includes(scenario)){
     assert.equal(await page.locator('#partial-approval').isVisible(),true);
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     assert.match(await page.locator('#source-coverage').innerText(),scenario==='unknown'?/غير معلوم/:/جزئية/);
     await page.locator('#partial-approval').check();assert.equal(await page.locator('#handoff-transfer').isEnabled(),true);
     await page.locator('#source-class-select').selectOption('سادس7');
     assert.equal(await page.locator('#partial-approval').isChecked(),false);
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     assert.deepEqual(await page.locator('#source-class-names li').allTextContents(),rows.filter(r=>r.classroom==='سادس7').map(r=>r.name));
     await page.locator('#partial-approval').check();
    }else assert.equal(await page.locator('#partial-approval').isVisible(),false);
    if(['complete','unknown','partial'].includes(scenario)){
     for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:950});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      assert.equal(await page.locator('#source-class-review').evaluate(e=>getComputedStyle(e).direction),'rtl');
      assert.notEqual(await page.locator('#handoff-transfer').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      const visible=await page.locator('body').innerText();assert.doesNotMatch(visible,/PAGINATION_|ROSTER_LINKS|N36|stage=|JSON/);
      const screenshot=resolve(out,scenario+'-'+width+'.png');await page.screenshot({path:screenshot,fullPage:true});
      evidence.screenshots.push({scenario,width,path:screenshot,sha256:createHash('sha256').update(await fs.readFile(screenshot)).digest('hex')});
     }
     await page.locator('#handoff-transfer').click();await page.waitForFunction(()=>window.sent.length===1);
     const sent=await page.evaluate(()=>window.sent[0]);
     assert.deepEqual(sent.rows,rows.filter(r=>r.classroom===(scenario==='complete'?'خامس2':'سادس7')));
     assert.deepEqual(Object.keys(sent).sort(),['schema','version','source','scope','createdAt','expiresAt','rows'].sort());
     assert.equal(sent.expiresAt-sent.createdAt,120000);assert.equal(sent.rows.length<=300,true);
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     assert.equal(await page.locator('#source-class-select').isDisabled(),true);
     record('actual-'+scenario+'-320-390-1280',{singleExplicitAction:true,sortedClasses:true,onlySelectedNames:true,partialAcknowledgement:scenario!=='complete'});
    }else if(scenario.startsWith('send-')){
     await page.locator('#handoff-transfer').click();await page.waitForFunction(()=>window.releaseSend);
     assert.equal(await page.locator('#source-class-select').isDisabled(),true);
     if(scenario==='send-cancel')await page.locator('#run-cancel').click();else await page.clock.fastForward(300001);
     await page.evaluate(()=>window.releaseSend());await page.waitForTimeout(50);
     assert.equal(await page.locator('#source-class-review').count(),0);
     assert.equal(await page.locator('#direct-handoff').isVisible(),false);
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     assert.doesNotMatch(await page.locator('body').innerText(),/طالب اصطناعي|فُتح ركيز/);
     record(scenario+'-late-reply-ignored','Only consented names sent before invalidation; late reply does not restore names, status, selector or send');
    }else if(scenario==='race'){
     await page.evaluate(()=>window.pauseGuard=true);await page.locator('#handoff-transfer').click();
     await page.waitForFunction(()=>window.guardWaiting);
     await page.locator('#source-class-select').selectOption('سادس7');await page.evaluate(()=>window.releaseGuard());
     await page.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('تعذّر'));
     assert.equal(await page.evaluate(()=>window.sent.length),0);assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     record('class-change-during-preflight-rejected','No send for the previous or replacement class; explicit new review action required');
    }else if(scenario==='error'){
     await page.locator('#handoff-transfer').click();await page.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('تعذّر'));
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);assert.equal(await page.evaluate(()=>window.sent.length),0);
     record('failed-transport-disabled','Failure does not claim saving, advance cursor or enable send');
    }else if(scenario==='receipt'){
     await page.locator('#handoff-transfer').click();await page.waitForTimeout(800);
     assert.equal(await page.locator('#source-class-select').isDisabled(),true);
     await page.evaluate(()=>window.receipts=true);await page.waitForFunction(()=>!document.querySelector('#source-class-select').disabled);
     assert.equal(await page.locator('#source-class-names li').count(),0);assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);
     await page.locator('#source-class-select').selectOption('سادس7');assert.equal(await page.locator('#handoff-transfer').isEnabled(),true);
     record('receipt-only-advancement','Pending keeps exact batch; saved/existing receipt advances only that class');
    }else{
     if(scenario==='cancel')await page.locator('#run-cancel').click();
     if(scenario==='expiry')await page.clock.fastForward(300001);
     if(scenario==='context')await page.evaluate(()=>window.sourceUpdated(7,{url:'http://127.0.0.1:49461/Account/Login'}));
     await page.waitForFunction(()=>!document.querySelector('#source-class-review'));
     assert.equal(await page.locator('#handoff-transfer').isDisabled(),true);assert.equal(await page.evaluate(()=>window.sent.length),0);
     assert.doesNotMatch(await page.locator('body').innerText(),/طالب اصطناعي/);
     assert.equal(await page.evaluate(()=>window.n36HandoffSource()),null);
     record(scenario+'-erases-preview','No names, source authorization or enabled send after invalidation');
    }
    if(await page.locator('#run-cancel').isEnabled())await page.locator('#run-cancel').click();
   }finally{await context.close();}
  }
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
 server.closeAllConnections();await new Promise(done=>server.close(done));
 evidence.cleanup='Owned loopback server closed; canonical isolated helper closed disposable contexts and its browser in finally; no shared live-browser phase used';
 evidence.sourceHashes={};for(const f of ['popup.html','popup.css','categories-popup.js','run-controller.js','source-roster.js'])evidence.sourceHashes[f]=createHash('sha256').update(await fs.readFile('extensions/rakeez-teacher-import-helper/'+f)).digest('hex');
 await fs.writeFile('tests/n36-simpler-roster-flow-browser.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({status:evidence.status,checks:evidence.checks.length,failure:evidence.failure}));
}
