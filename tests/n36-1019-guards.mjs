// AI: exact v2 protocol and actual MV3 worker engines with fabricated Chrome events.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateHandoff,HANDOFF_TTL,APP_ORIGIN} from '../src/lib/n36-extension-protocol.js';
const now=Date.now(),rows=[{name:'طالب ألف',classroom:'خامس ألف'}],batchId='b'.repeat(64);
const envelope=()=>({schema:'rakeez-extension-names',version:2,source:'madrasati',scope:'reviewed-run',createdAt:Date.now(),expiresAt:Date.now()+HANDOFF_TTL,batchId,complete:false,rows});
test('exact names-only schema, old v1, expiry, duplicate and batch limits',()=>{
 const e=envelope();assert.equal(validateHandoff(e).rows.length,1);
 const v1={...e,version:1};delete v1.batchId;delete v1.complete;assert.equal(validateHandoff(v1).version,1);
 for(const bad of [{...e,batchId:'x'},{...e,complete:'false'},{...e,source:'noor',scope:'selected-visible-partial'},{...e,rows:[...rows,...rows]},{...e,ownerId:'invented'},{...e,rows:Array.from({length:301},()=>rows[0])}])assert.throws(()=>validateHandoff(bad));
 assert.throws(()=>validateHandoff(e,e.expiresAt));
});
test('actual encrypted one-time worker: exact open tab, runner, receipt and cancellation guards',async()=>{
 const data={},alarms=new Map(),updates=[],removed=[];let internal,external,alarm,tabRemoved,appTabs=[{id:10,url:APP_ORIGIN+'/#/classes/koshoof?import=1'}];
 globalThis.chrome={runtime:{id:'a'.repeat(32),getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:{addListener:f=>internal=f},onMessageExternal:{addListener:f=>external=f}},
 storage:{session:{async get(k){return k===null?structuredClone(data):{[k]:structuredClone(data[k])};},async set(v){Object.assign(data,structuredClone(v));},async remove(k){delete data[k];}}},
 alarms:{async create(k,v){alarms.set(k,v);},async clear(k){alarms.delete(k);},onAlarm:{addListener:f=>alarm=f}},
 tabs:{async query(){return appTabs;},async get(id){return {...appTabs.find(t=>t.id===id)};},async update(id,v){updates.push({id,...v});appTabs.find(t=>t.id===id).url=v.url;},async create(){throw Error('MUST_REUSE_OPEN_TAB');},async remove(id){removed.push(id);},onRemoved:{addListener:f=>tabRemoved=f}},
 scripting:{async executeScript(){return [{frameId:0,documentId:'synthetic-document',result:batchId}];}}};
 await import('../extensions/rakeez-teacher-import-helper/handoff-worker.js');
 const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')+'?run=synthetic',tab:{id:20,windowId:1}};
 const send=(listener,message,source)=>new Promise(resolve=>listener(message,source,resolve));
 appTabs=[];assert.equal((await send(internal,{type:'n36-begin'},sender)).ok,false);
 appTabs=[{id:10,url:APP_ORIGIN+'/#/classes/koshoof?import=1'}];assert.deepEqual(await send(internal,{type:'n36-begin'},sender),{ok:true,batchId});
 assert.equal((await send(internal,{type:'n36-create',envelope:envelope()},{...sender,tab:{id:21}})).ok,false);
 const made=await send(internal,{type:'n36-create',envelope:envelope()},sender);assert.equal(made.ok,true);assert.equal(updates[0].id,10);assert.equal(updates[0].active,undefined);assert.deepEqual(removed,[]);
 assert.doesNotMatch(JSON.stringify(data),/طالب|خامس/);
 const source={origin:APP_ORIGIN,url:APP_ORIGIN+'/#/classes',documentId:'synthetic-document',tab:{id:10}},claim={type:'n36-claim',nonce:made.actionId};
 assert.equal((await send(external,claim,{...source,tab:{id:11}})).ok,false);
 assert.equal((await send(external,claim,{...source,origin:'https://invalid.invalid'})).ok,false);
 assert.equal((await send(external,claim,{...source,documentId:'new-document'})).ok,false);
 const transferURL=appTabs[0].url;appTabs[0].url=APP_ORIGIN+'/#/classes';assert.equal((await send(external,claim,source)).ok,false);appTabs[0].url=transferURL;
 const claimed=await send(external,claim,source);assert.deepEqual(claimed.envelope.rows,rows);assert.equal((await send(external,claim,source)).ok,false);
 const outcome={status:'saved',added:1,existing:0,remaining:0,total:1};
 assert.equal((await send(external,{type:'n36-outcome',nonce:made.actionId,outcome:{...outcome,remaining:1}},source)).ok,false);
 assert.equal((await send(external,{type:'n36-outcome',nonce:made.actionId,outcome},{...source,tab:{id:11}})).ok,false);
 assert.equal((await send(external,{type:'n36-outcome',nonce:made.actionId,outcome},source)).ok,true);
 assert.equal((await send(internal,{type:'n36-result',actionId:made.actionId},sender)).status,'saved');
 const another=await send(internal,{type:'n36-create',envelope:envelope()},sender);alarm({name:'handoff:'+another.actionId});
 // Enqueue a read after the actual alarm, which serializes erasure before the claim.
 assert.equal((await send(external,{type:'n36-claim',nonce:another.actionId},{...source,url:appTabs[0].url})).ok,false);
 await send(internal,{type:'n36-cancel'},sender);assert.deepEqual(data,{});
 assert.equal((await send(internal,{type:'n36-create',envelope:envelope()},sender)).ok,false);
});
test('unchanged actual extraction/coverage evidence and cached dependency graph',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const e=JSON.parse(await fs.readFile('tests/n36-terminal-pager-evidence-browser.json','utf8'));
 assert.equal(e.status,'PASS');
 for(const name of ['source-adapter.js','selection.js','route-diagnostics.js']){
  const current=hash(await fs.readFile('extensions/rakeez-teacher-import-helper/'+name));
  // source binding is checked against current immutable base, no new 303-name crawl.
  const {execFileSync}=await import('node:child_process');assert.equal(current,hash(execFileSync('git',['show','3fce1195b9c840259e0acea6973efd1436288c29:extensions/rakeez-teacher-import-helper/'+name])));
 }
 const sw=await fs.readFile('sw.js','utf8');for(const name of ['src/lib/db.js','src/lib/student-import.js','src/views/class-import-center.js'])assert.ok(sw.includes(name));
});
