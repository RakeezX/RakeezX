/** AI: affected actual SW install/fetch semantics in a VM; no live worker or offline certification. */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const source=await readFile('sw.js','utf8'),base=execFileSync('git',['show','5b77024e36f254a6568a0224abb9ea25d78698af:sw.js'],{encoding:'utf8',windowsHide:true});
const assets=['/src/lib/student-portal-publication-client.js','/src/views/student-portal-publications.js','/src/lib/student-portal-unified-client.js','/src/views/student-portal-login.js','/src/styles/student-portal-login.css'];
const origin='https://synthetic.invalid';
function environment(code,missing=null){
 const handlers={},banks=new Map([['n44-unrelated',new Map()]]),writes=[];
 class BoundRequest extends Request{constructor(value,init){super(typeof value==='string'?new URL(value,origin):value,init);}}
 const cache=name=>{if(!banks.has(name))banks.set(name,new Map());const map=banks.get(name);return {
  add:async req=>{const pathname=new URL(req.url).pathname;if(pathname===missing)throw Error('fabricated missing new asset');writes.push(pathname);map.set(req.url,new Response(assets.includes(pathname)?await readFile('.'+pathname,'utf8'):'unchanged synthetic shell'));},
  put:async(req,response)=>map.set(new URL(typeof req==='string'?req:req.url,origin).href,response),
  match:async req=>map.get(new URL(typeof req==='string'?req:req.url,origin).href)?.clone()
 };};
 const context={URL,Request:BoundRequest,Response,console:{warn(){}},self:{location:{origin},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(k,fn)=>handlers[k]=fn},
  caches:{open:async name=>cache(name),keys:async()=>[...banks.keys()],delete:async name=>banks.delete(name),match:async key=>{for(const name of banks.keys()){const r=await cache(name).match(key);if(r)return r;}}},fetch:async()=>{throw Error('synthetic offline');}};
 vm.runInNewContext(code+'\nglobalThis.graph={VERSION,SHELL};',context);
 return {handlers,banks,writes,graph:context.graph,install(){let pending;handlers.install({waitUntil:p=>pending=p});return pending;},async fetch(pathname){let pending;handlers.fetch({request:new BoundRequest(pathname),respondWith:p=>pending=p});return pending;}};
}
test('SW105 preserves all SW104 shell/N44 assets and requires the new frontend graph atomically',async()=>{
 const old=environment(base),now=environment(source);assert.equal(now.graph.VERSION,'rakeezx-v105');
 assert([...old.graph.SHELL].every(path=>now.graph.SHELL.includes(path)));
 await now.install();for(const asset of assets){assert(now.writes.includes(asset));const response=await now.fetch(asset);assert.equal(await response.text(),await readFile('.'+asset,'utf8'));}
 assert(now.banks.has('n44-unrelated'));
 for(const missing of assets)await assert.rejects(()=>environment(source,missing).install(),/missing new asset/);
});
test('actual SW never intercepts/cache-writes V2 API, existing N44 API or private student navigation',async()=>{
 const e=environment(source);for(const pathname of ['/api/n88/teacher/class/publication-v2','/api/n88/student/publication-v2/read','/api/n44/status','/student','/student/private'])assert.equal(await e.fetch(pathname),undefined);
 assert.equal(e.writes.length,0);
});
