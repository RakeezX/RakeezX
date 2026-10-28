// AI-authored: affected offline source contract. Served PWA proof belongs to publisher.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
test('one cache generation; exact offline teacher UI bytes; private student requests never cached',async()=>{
 const source=await readFile('sw.js','utf8'),before=execFileSync('git',['show','6696d03518111134cbf855544c090d92496e3126:sw.js'],{encoding:'utf8'});
 assert.equal(source.replace('rakeezx-v92','rakeezx-v91').replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'));
 const handlers=new Map(),entries=new Map(),origin='http://127.0.0.1:49888/';let opened;
 const key=r=>new URL(typeof r==='string'?r:r.url,origin).pathname;
 class LocalRequest extends Request{constructor(url,options){super(new URL(typeof url==='string'?url:url.url,origin),options);}}
 const cache={async add(r){const p=key(r);entries.set(p,await readFile(p==='/'?'index.html':'.'+p));},async match(r){const body=entries.get(key(r));return body?new Response(body):undefined;},async put(r,response){entries.set(key(r),Buffer.from(await response.arrayBuffer()));}};
 vm.runInNewContext(source,{self:{addEventListener:(n,f)=>handlers.set(n,f),skipWaiting(){},location:{origin:new URL(origin).origin},clients:{claim(){}}},caches:{async open(n){opened=n;return cache;},async keys(){return [];},async match(r){return cache.match(r);}},Request:LocalRequest,Response,URL,console,fetch:async()=>{throw Error('Synthetic offline');}});
 let installation;handlers.get('install')({waitUntil:p=>installation=p});await installation;assert.equal(opened,'rakeezx-v92');
 for(const path of ['/src/views/student-portal-class.js','/src/styles/student-portal-class.css']){assert.deepEqual(entries.get(path),await readFile('.'+path));let response;handlers.get('fetch')({request:new LocalRequest(path),respondWith:p=>response=p,waitUntil(){}});assert.equal(await(await response).text(),await readFile('.'+path,'utf8'));}
 for(const path of ['/student','/api/n88/student/read','/api/n88/teacher/class/list']){let intercepted=false;handlers.get('fetch')({request:new LocalRequest(path),respondWith(){intercepted=true;},waitUntil(){}});assert.equal(intercepted,false);assert.equal(entries.has(path),false);}
});
