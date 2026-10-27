// AI-authored source cache regression, not served PWA certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createRemoteSync} from '../../src/lib/remote-sync.js';

test('N130 cache generation increments once; N44 handlers and shell are preserved, offline sync bytes are current',async()=>{
 const source=await readFile('sw.js','utf8'),before=execFileSync('git',['show','c589904f955c2841794025dedda2606edfd2d2f8:sw.js'],{encoding:'utf8'});
 const version=s=>s.match(/const VERSION = '([^']+)'/)[1];assert.equal(version(source),'rakeezx-v91');assert.equal(source.replace(version(source),version(before)).replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'));
 const handlers=new Map(),entries=new Map(),origin='http://127.0.0.1:49830/';let opened;
 const key=r=>new URL(typeof r==='string'?r:r.url,origin).pathname;
 class LocalRequest extends Request{constructor(url,options){super(new URL(typeof url==='string'?url:url.url,origin),options);}}
 const cache={async add(request){const path=key(request);entries.set(path,await readFile(path==='/'?'index.html':'.'+path));},async match(request){const body=entries.get(key(request));return body?new Response(body):undefined;},async put(request,response){entries.set(key(request),Buffer.from(await response.arrayBuffer()));}};
 const sandbox={self:{addEventListener:(name,fn)=>handlers.set(name,fn),skipWaiting(){},location:{origin:new URL(origin).origin},clients:{claim(){}}},caches:{async open(name){opened=name;return cache;},async keys(){return [];},async match(r){return cache.match(r);}},Request:LocalRequest,Response,URL,console,fetch:async()=>{throw Error('Synthetic offline');}};
 vm.runInNewContext(source,sandbox);let installation;handlers.get('install')({waitUntil:p=>installation=p});await installation;
 assert.equal(opened,'rakeezx-v91');assert.deepEqual(entries.get('/src/lib/sync.js'),await readFile('src/lib/sync.js'));assert.ok(entries.has('/index.html'));assert.ok(entries.has('/src/lib/notification-push-runtime.js'));
 let response;handlers.get('fetch')({request:new LocalRequest('/src/lib/sync.js'),respondWith:p=>response=p,waitUntil(){}});assert.equal(await(await response).text(),await readFile('src/lib/sync.js','utf8'));
});

test('ignored abort and late marker reply cannot certify the timed-out validation',async()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',context={ownerId:owner,workspace:'synthetic',token:'synthetic',ready:true,proven:true,online:true,visible:true};
 let pending=false,release,abortedSignal;const timers=new Map();let id=0;
 const marker=()=>({protocol:'OWNER_SIGNAL_V1',ownerId:owner,revision:'10'});
 const remote=createRemoteSync({getContext:()=>context,getMarker:({signal})=>pending?(abortedSignal=signal,new Promise(r=>release=r)):Promise.resolve(marker()),openChannel:()=>()=>{},requestSync(){},timers:{setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(i){timers.delete(i);},setInterval(){},clearInterval(){}}});
 try{
  await remote.refresh();const capture=await remote.beforeFullSync();pending=true;
  const validation=remote.validateFullSync(capture);const rejected=assert.rejects(validation,{code:'REMOTE_MARKER_TIMEOUT'});
  [...timers.values()].find(t=>t.ms===5000).fn();await rejected;assert.equal(abortedSignal.aborted,true);
  remote.afterFullSync(capture,false);release(marker());await Promise.resolve();assert.equal(remote.diagnostics().pending,true);
 }finally{remote.stop();}
});
