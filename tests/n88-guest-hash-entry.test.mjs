import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const base='296839c0ee4cc1a33b3b2126565a231b07255b58';
test('only module entry changes in index; exact hash selects standalone module',async()=>{
 const index=await read('index.html');
 const old=execFileSync('git',['show',base+':index.html'],{encoding:'utf8'}).replaceAll('\r\n','\n');
 assert.equal(index.replaceAll('\r\n','\n').replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="src/lib/app-update.js"></script>'),old);
 assert.match(index,/location.hash === '#\/n88-invite-lab'/);
 assert.match(index,/else \{\s*import\('\.\/src\/lib\/app-update.js'\)/);
 const guest=await read('src/views/n88-public-guest.js');
 assert.doesNotMatch(guest,/\b(import|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon|dispatch|serviceWorker)\b/);
 assert.doesNotMatch(guest,/https?:|ownerId|authUserId|access_token|\.value\s*\}/);
 assert.match(guest,/نموذج تجريبي دون بيانات طلاب أو دخول فعلي/);
});
test('actual offline worker returns shell and isolated new startup dependency',async()=>{
 const worker=await read('sw.js'),handlers={},origin='http://127.0.0.1:48888/';
 const key=k=>new URL(typeof k==='string'?k:k.url,origin).href.split('#')[0];
 const entries=new Map(),paths=['./index.html','./src/views/n88-public-guest.js','./src/lib/app-update.js'];
 for(const p of paths){assert.ok(worker.includes("'"+p+"'"));entries.set(key(p),new Response(await read(p.slice(2))));}
 entries.set(key('./'),new Response(await read('index.html')));
 const cache={match:async k=>entries.get(key(k))?.clone(),put:async(k,v)=>entries.set(key(k),v.clone())};
 vm.runInNewContext(worker,{self:{location:{origin:new URL(origin).origin},addEventListener:(n,f)=>handlers[n]=f},caches:{keys:async()=>[],open:async()=>cache,match:cache.match},URL,Request,Response,fetch:async()=>{throw Error('synthetic offline');},console});
 for(const p of ['./#/n88-invite-lab',...paths]){
  let pending;handlers.fetch({request:{url:new URL(p,origin).href,method:'GET',mode:p.includes('#')?'navigate':'cors'},respondWith:r=>pending=r,waitUntil:()=>{}});
  const response=await pending;assert.equal(response.status,200);assert.ok((await response.text()).length>0);
 }
});
test('offline shell install requires new startup module with reload semantics',async()=>{
 const worker=await read('sw.js'),handlers={},added=[];
 class LocalRequest extends Request {constructor(url,options){super(new URL(url,'http://127.0.0.1:48888/'),options);}}
 const cache={add:async request=>{added.push(request);if(request.url.endsWith('/n88-public-guest.js'))throw Error('synthetic missing module');}};
 vm.runInNewContext(worker,{self:{skipWaiting(){},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>cache},Request:LocalRequest,console});
 let install;handlers.install({waitUntil:p=>install=p});
 await assert.rejects(install,/synthetic missing module/);
 assert.ok(added.some(r=>r.url.endsWith('/n88-public-guest.js')&&r.cache==='reload'));
});
