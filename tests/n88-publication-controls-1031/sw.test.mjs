/** AI: only SW104 affected asset bytes/atomic install; all SW103 policy remains byte-identical. */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const source=await readFile('sw.js','utf8'),base=execFileSync('git',['show','c4e3d6a3ad3b4da889b5d60d4d4d5b8d26e9a53e:sw.js'],{encoding:'utf8',windowsHide:true});
const assets=['/src/views/student-portal-class.js','/src/views/student-portal-publications.js'],origin='https://synthetic.invalid';
function environment(missing=null){
 const handlers={},bytes=new Map();class LocalRequest extends Request{constructor(value,init){super(typeof value==='string'?new URL(value,origin):value,init);}}
 const cache={add:async req=>{const p=new URL(req.url).pathname;if(p===missing)throw Error('missing affected asset');bytes.set(req.url,new Response(assets.includes(p)?await readFile('.'+p,'utf8'):'unchanged shell'));},match:async req=>bytes.get(new URL(typeof req==='string'?req:req.url,origin).href)?.clone()};
 const context={URL,Request:LocalRequest,Response,console:{warn(){}},self:{location:{origin},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache,keys:async()=>[],match:cache.match},fetch:async()=>{throw Error('offline');}};
 vm.runInNewContext(source,context);
 return {async install(){let result;handlers.install({waitUntil:p=>result=p});return result;},async get(path){let result;handlers.fetch({request:new LocalRequest(path),respondWith:p=>result=p});return result;}};
}
test('SW104 retains exact SW103 offline/N44/private-cache policies and atomically caches both changed view identities',async()=>{
 assert.equal(source.replace("const VERSION = 'rakeezx-v104';","const VERSION = 'rakeezx-v103';"),base);
 const sw=environment();await sw.install();for(const path of assets)assert.equal(await (await sw.get(path)).text(),await readFile('.'+path,'utf8'));
 for(const path of assets)await assert.rejects(()=>environment(path).install(),/missing affected asset/);
});
