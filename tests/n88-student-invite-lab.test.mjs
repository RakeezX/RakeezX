import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {demoWorkspaceOnly,acceptsIllustrativeCode,EXAMPLE} from '../src/lib/n88-invite-lab.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('only explicit Demo workspace and fixed illustrative input are accepted',()=>{
 for(const w of [null,undefined,{}, {type:'account'},{type:'legacy'},{type:'demo-copy'}])assert.equal(demoWorkspaceOnly(w),false);
 assert.equal(demoWorkspaceOnly({type:'demo'}),true);
 assert.equal(acceptsIllustrativeCode(' demo-only '),true);
 for(const code of ['','123456','طالب افتراضي','<script>'])assert.equal(acceptsIllustrativeCode(code),false);
 assert.ok(Object.isFrozen(EXAMPLE)&&Object.isFrozen(EXAMPLE.tasks));
});
test('lab capability imports are restricted to workspace metadata and static presentation',async()=>{
 const view=await read('src/views/n88-student-invite-lab.js'),lib=await read('src/lib/n88-invite-lab.js');
 assert.match(view,/import \{ getActiveWorkspace \} from '..\/store.js'/);
 for(const code of [view,lib])assert.doesNotMatch(code,/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|dispatch|sendBeacon|cloud|analytics)\b/);
 assert.doesNotMatch(view,/getStudent|teachingContext|\.state|scores|ownerId|authUserId/);
 assert.match(view,/if \(!allowed\(\)\) return denied\(\)/);
 assert.match(await read('src/router.js'),/path: '\/n88-invite-lab'/);
});
test('actual service worker resolves lab modules and hash shell with network unavailable',async()=>{
 const worker=await read('sw.js'),handlers={},base='http://127.0.0.1:48888/';
 const entries=new Map();
 const key=k=>new URL(typeof k==='string'?k:k.url,base).href.split('#')[0];
 const cache={match:async k=>entries.get(key(k))?.clone(),put:async(k,v)=>entries.set(key(k),v.clone())};
 const paths=['./','./src/router.js','./src/views/n88-student-invite-lab.js','./src/lib/n88-invite-lab.js','./src/styles/components.css'];
 for(const p of paths){
  if(p!== './')assert.ok(worker.includes("'"+p+"'"),'new dependency must be precached');
  entries.set(key(p),new Response(await read(p==='./'?'index.html':p.slice(2))));
 }
 vm.runInNewContext(worker,{self:{location:{origin:new URL(base).origin},addEventListener:(n,f)=>handlers[n]=f},caches:{keys:async()=>['rakeezx-v67'],open:async()=>cache,match:cache.match},URL,Request,Response,fetch:async()=>{throw Error('synthetic offline');},console});
 for(const p of paths){let result;handlers.fetch({request:{url:new URL(p==='./'?'./#/n88-invite-lab':p,base).href,method:'GET',mode:p==='./'?'navigate':'cors'},respondWith:r=>result=r});const response=await result;assert.equal(response.status,200);assert.ok((await response.text()).length>0);}
});
