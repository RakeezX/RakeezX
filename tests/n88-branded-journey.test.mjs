import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='aa6a1843c5102add77d61d1a3777c7916e376bb7';
const read=p=>readFile(new URL('../'+p,import.meta.url));
test('guest remains standalone and browser evidence binds exact source',async()=>{
 const source=await read('src/views/n88-public-guest.js'),text=source.toString();
 assert.doesNotMatch(text,/\b(import|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon|dispatch|serviceWorker)\b/);
 assert.doesNotMatch(text,/https?:|ownerId|authUserId|access_token/);
 const proof=JSON.parse(await read('tests/n88-branded-journey-browser.json'));
 assert.equal(proof.baseSha,base);assert.equal(proof.sourceSha256,createHash('sha256').update(source).digest('hex'));
 assert.equal(proof.visuals.length,4);assert.ok(proof.results.every(r=>r.status==='PASS'));
});
test('exact hash bootstrap, ordinary/account code, offline shell, assets and shared CSS unchanged',async()=>{
 for(const path of ['index.html','sw.js','src/app.js','src/router.js','src/store.js','src/styles/app.css','src/styles/components.css','assets/header-light-standard.svg','assets/header-dark-standard.svg']){
  const current=await read(path),previous=execFileSync('git',['show',base+':'+path]);assert.deepEqual(current,previous,path);
 }
 const index=(await read('index.html')).toString();assert.match(index,/location.hash === '#\/n88-invite-lab'/);assert.match(index,/hashchange.*location.reload/);
});
