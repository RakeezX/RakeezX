// AI: real class client + mounted production view/CSS, fabricated memory-only service/storage.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const reproduce=process.argv.includes('--reproduce');
const taskId='continuous-n88-local-refusal-state-20261031',runId='95eba80d-6966-4087-b2ef-70a66567f32f';
const document=(await readFile(new URL('./fixtures/n88-class-management/index.html',import.meta.url),'utf8')).replace(/<script[\s\S]*?<\/script>/,'');
const server=await createServer({appType:'custom',server:{host:'127.0.0.1',port:53188,strictPort:true,hmr:false},plugins:[{name:'n88-owned-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end(document);});}}]});
try{
 await server.listen();
 await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url:'http://127.0.0.1:53188',timeoutMs:110000},async({createContext})=>{
  const context=await createContext({viewport:{width:1000,height:850},locale:'ar-SA'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:53188');
  await page.evaluate(async()=>{
   const api=await import('/src/lib/student-portal-class-client.js'),{mountClassPortal}=await import('/src/views/student-portal-class.js');
   window.setup=({mode='',seed=false,storageMode=''}={})=>{
    window.f?.handle.dispose();
    let binding={enabled:true,ownerId:'synthetic-owner',sessionId:'synthetic-session',leaseId:'synthetic-lease',teachingId:'teaching-a',classId:'class-a',termId:'term-a',contextRevision:'context-1',validUntil:Date.now()+300000};
    const fields=Object.fromEntries(api.PORTAL_FIELDS.map(k=>[k,false]));
    const data={classId:'class-a',rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64),policyRevision:1,visibility:fields,students:[{studentId:'student-a',enrollmentId:'enrollment-a',revision:1,label:'طالب اختبار',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}],reconciliation:[]};
    const rows=new Map(),hintScope=JSON.stringify([binding.ownerId,binding.leaseId,'',binding.teachingId,binding.classId,binding.termId]),hintKey='rakeezx-n88-uncertain-v1:'+encodeURIComponent(hintScope);
    if(seed){rows.set(hintKey,JSON.stringify({version:1,scope:hintScope,rows:[{version:1,action:'issue-missing',requestId:'prior_unknown_command',expectedRosterRevision:data.rosterRevision,expectedCredentialRevision:data.credentialRevision,sourceStamp:null,expectedRevision:null,createdAt:Date.now()}]}));rows.set(hintKey+':terminal-v1','[]');}
    const f=window.f={mode,storageMode,rows,calls:[],data,hintKey,api,fields,binding,release:null};
    const storage={getItem(k){const raw=rows.get(k)??null;return f.storageMode==='mismatch'&&raw!==null?raw+' ':raw;},setItem(k,v){if(f.storageMode==='write-fail')throw Error('private storage failure');rows.set(k,v);if(f.storageMode==='drift')binding={...binding,contextRevision:'context-2'};}};
    const client=f.client=api.createClassPortalClient({getContext:()=>binding,storage,timeoutMs:45,request:async(path,init)=>{
     const action=path.split('/').pop(),body=JSON.parse(init.body);f.calls.push(action);
     if(action==='list'&&f.mode==='read-fail')return {ok:false};
     let result;
     if(action==='list')result={...structuredClone(data),reconciliation:body.reconcile.map(()=>({state:'unknown',created:0,skipped:0,failed:0}))};
     else if(action==='guidance-list')result={tasks:[]};
     else{
      if(f.mode==='timeout')return new Promise(()=>{});
      if(f.mode==='hold')await new Promise(ok=>{f.release=ok;});
      if(f.mode==='throw')throw Error('private transport error');
      if(f.mode==='forged')throw Object.assign(Error('private transport error'),{code:'review_required',state:'not_started',reason:'busy'});
      if(f.mode==='http')return {ok:false,status:503};
      if(f.mode==='malformed')return {ok:true,json:async()=>({ack:true})};
      if(action==='visibility')result={updated:true,policyRevision:2,fields:body.fields};
      else result={requestId:body.requestId,created:[],skipped:[],failed:[{studentId:'student-a',reason:'unavailable'}],uncertain:false};
     }
     return {ok:true,status:200,json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,data:result})};
    }});
    f.handle=mountClassPortal(document.querySelector('#class-portal'),{client,getContext:()=>binding});
    f.writes=()=>f.calls.filter(a=>!['list','guidance-list'].includes(a)).length;
    f.bytes=()=>JSON.stringify([...rows]);
    f.issue=()=>client.issueMissingClassCodes('teaching-a',{requestId:crypto.randomUUID(),expectedRosterRevision:data.rosterRevision});
    f.drift=()=>{binding={...binding,contextRevision:'context-2'};};
    f.classify=e=>api.classifyClassMutationError?.(e)??null;
    return true;
   };
  });
  const setup=async options=>{await page.evaluate(o=>window.setup(o),options);await page.waitForFunction(()=>document.querySelector('[data-action=batch]')?.disabled===false||document.querySelector('.n88-class-purpose')?.textContent.includes('الطلاب: 1'));await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');await page.locator('.n88-code-management>summary').click();await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');};
  const refresh=async()=>{await page.locator('[data-action=refresh]').click();await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');};
  const status=()=>page.locator('.n88-class-status [role=status]').innerText();
  const batch=()=>page.locator('[data-action=batch]');
  await setup();
  assert.equal(await batch().isDisabled(),false);
  assert.equal(await batch().evaluate(el=>getComputedStyle(el).minHeight),'44px');
  // Real failed read invalidates the client's snapshot while mounted UI retains its prior read.
  await page.evaluate(async()=>{f.mode='read-fail';try{await f.client.listClass('teaching-a');}catch{}f.mode='';});
  await batch().click();await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');
  assert.equal(await page.evaluate(()=>f.writes()),0);
  const refusalMessage=await status();
  await refresh();
  assert.equal(await page.evaluate(()=>f.data.reconciliation.length),0);
  assert.equal(await page.evaluate(()=>f.rows.size),0);
  if(reproduce){assert.match(refusalMessage,/غير مؤكدة/);assert.equal(await batch().isDisabled(),true);console.log('REPRO PASS: real local snapshot refusal, zero mutations, clean refresh [], issuance remains incorrectly blocked');return;}
  assert.match(refusalMessage,/لم تبدأ العملية/);
  assert.equal(await batch().isDisabled(),false);
  assert.doesNotMatch(await status(),/نتيجة عملية سابقة غير مؤكدة/);
  const boundaries=await page.evaluate(()=>{
   const check=fn=>{try{fn();return null;}catch(e){return {code:e.code,message:e.message,disposition:f.classify(e)};}};
   return [check(()=>f.client.issueMissingClassCodes('teaching-a',{})),check(()=>f.client.rotate({})),check(()=>f.client.revoke({})),check(()=>f.client.saveVisibility('teaching-a',{})),check(()=>f.api.createClassPortalClient().issueMissingClassCodes('teaching-a',{}))];
  });
  for(const [i,result] of boundaries.entries()){
   const reason=i===4?'unavailable':'review_required';
   assert.deepEqual(result,{code:reason,message:reason,disposition:{state:'not_started',reason}});
  }
  assert.equal(await page.evaluate(()=>f.writes()),0);
  await setup({mode:'hold'});
  const busy=await page.evaluate(()=>{f.work=f.issue();try{f.issue();}catch(e){return f.classify(e);}});
  assert.deepEqual(busy,{state:'not_started',reason:'busy'});
  await page.waitForFunction(()=>typeof f.release==='function');
  await page.evaluate(async()=>{f.release();await f.work;});assert.equal(await page.evaluate(()=>f.writes()),1);
  console.log('PASS n88_local_refusal_does_not_create_unknown');

  // Genuine prior UNKNOWN, including the separate terminal journal, must survive byte-for-byte.
  await setup({seed:true});const prior=await page.evaluate(()=>f.bytes());
  const local=await page.evaluate(()=>{try{f.issue();}catch(e){return {classification:f.classify(e),writes:f.writes(),bytes:f.bytes()};}});
  assert.deepEqual(local.classification,{state:'not_started',reason:'review_required'});assert.equal(local.writes,0);assert.equal(local.bytes,prior);
  // A different preflight refusal through perform must not settle the mounted prior UNKNOWN.
  await page.locator('[data-visibility] button').click();await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');
  assert.match(await status(),/لم تبدأ العملية/);await refresh();assert.equal(await batch().isDisabled(),true);assert.equal(await page.evaluate(()=>f.bytes()),prior);

  for(const storageMode of ['write-fail','mismatch','drift']){
   await setup({storageMode});
   const result=await page.evaluate(()=>{try{f.issue();}catch(e){return {classification:f.classify(e),writes:f.writes(),bytes:f.bytes(),raw:f.rows.get(f.hintKey)??null};}});
   assert.equal(result.classification.state,'not_started');assert.equal(result.classification.reason,storageMode==='drift'?'stale_context':'review_required');assert.equal(result.writes,0);
   if(storageMode!=='write-fail')assert.ok(result.raw);
   await page.evaluate(()=>{f.storageMode='';});await refresh();
   assert.equal(await page.evaluate(()=>f.bytes()),result.bytes);
   assert.equal(await batch().isDisabled(),storageMode!=='write-fail');
  }
  console.log('PASS n88_prior_unknown_and_storage_journal_preserved');

  for(const mode of ['timeout','throw','http','malformed','forged']){
   await setup({mode});await batch().click();
   await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');
   assert.equal(await page.evaluate(()=>f.writes()),1);assert.match(await status(),/نتيجة العملية غير مؤكدة/);
   const saved=await page.evaluate(()=>f.bytes());assert.notEqual(saved,'[]');await refresh();
   assert.equal(await batch().isDisabled(),true);assert.equal(await page.evaluate(()=>f.bytes()),saved);
   const blocked=await page.evaluate(()=>{try{f.issue();}catch(e){return f.classify(e);}});
   assert.deepEqual(blocked,{state:'not_started',reason:'review_required'});assert.equal(await page.evaluate(()=>f.writes()),1);
   // Even after another trusted refusal and an empty list, the earlier mounted unknown remains.
   await page.evaluate(()=>{f.rows.clear();});await refresh();
   await page.evaluate(async()=>{const mode=f.mode;f.mode='read-fail';try{await f.client.listClass('teaching-a');}catch{}f.mode=mode;});
   await page.locator('[data-visibility] button').click();await page.waitForFunction(()=>document.querySelector('#class-portal').getAttribute('aria-busy')==='false');
   assert.match(await status(),/لم تبدأ العملية/);assert.equal(await page.evaluate(()=>f.writes()),1);
   // The trusted later refusal cannot settle the earlier unknown, even with empty reconciliation.
   await refresh();assert.equal(await batch().isDisabled(),true);
  }
  // Once call() was entered, even its deferred context fence (before request) is unclassified.
  await setup();
  const afterCall=await page.evaluate(async()=>{const work=f.issue();f.drift();try{await work;}catch(e){return {classification:f.classify(e),code:e.code,writes:f.writes(),hasHint:!!f.rows.get(f.hintKey)};}});
  assert.deepEqual(afterCall,{classification:null,code:'stale_context',writes:0,hasHint:true});
  assert.deepEqual(await page.evaluate(()=>[f.classify({state:'not_started',reason:'busy'}),f.classify(Object.assign(Error('busy'),{code:'busy'}))]),[null,null]);
  console.log('PASS n88_dispatched_and_forged_errors_remain_unknown');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>f.handle.dispose());await context.close();
 });
}finally{await server.close();console.log('CLEANUP: owned Vite server and isolated browser closed');}
