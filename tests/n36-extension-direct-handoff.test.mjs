// AI: boundary tests; rendered behavior is exercised separately in installed MV3 Chromium.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {HANDOFF_TTL,handoffRoute,validateHandoff,handoffBundle} from '../src/lib/n36-extension-protocol.js';
import {parseBundle} from '../src/lib/teacher-setup-import.js';
const now=Date.now(),valid=()=>({schema:'rakeez-extension-names',version:1,source:'noor',scope:'selected-visible-partial',createdAt:now,expiresAt:now+HANDOFF_TTL,rows:[{name:'طالب تجريبي',classroom:'خامس ألف'}]});
test('strict minimal validated bounded schema feeds existing bundle adapter',()=>{
 const e=valid();assert.deepEqual(validateHandoff(e,now),e);assert.deepEqual(parseBundle(JSON.stringify(handoffBundle(e,now))).categories[0].rows,e.rows);
 for(const change of [e=>e.token='x',e=>e.rows[0].id='x',e=>e.rows[0].grade=10,e=>e.source='other',e=>e.scope='complete',e=>e.rows[0].name='=bad()',e=>e.rows[0].classroom='<x>',e=>e.rows.push({...e.rows[0]}),e=>e.rows[0].name='طالب 123',e=>e.rows=Array(301).fill(e.rows[0]),e=>e.expiresAt++,e=>e.createdAt+=60000,e=>e.rows[0].name+=' ']){const e=valid();change(e);assert.throws(()=>validateHandoff(e,now));}
 assert.throws(()=>validateHandoff(e,e.expiresAt));assert.throws(()=>validateHandoff({...e,rows:[]},now));
 assert.throws(()=>validateHandoff({...e,rows:[JSON.parse('{"__proto__":{},"name":"طالب تجريبي","classroom":"خامس ألف"}')]},now));
});
test('nonce transport URL contains no student fields and accepts device-specific IDs only',()=>{
 for(const id of ['a'.repeat(32),'p'.repeat(32)]){const h=handoffRoute(id,'a1'.repeat(32));assert.match(h,/^#\/classes\/koshoof\?import=1&extension=[a-p]{32}&handoff=[a-f0-9]{64}$/);assert.doesNotMatch(h,/طالب|name|token/);}
 for(const id of ['', 'x'.repeat(32),'a'.repeat(31)])assert.throws(()=>handoffRoute(id,'a'.repeat(64)));
});
test('package and app use identical protocol; no broader hosts, content scripts, relay or persistent envelope',async()=>{
 const dir='extensions/rakeez-teacher-import-helper/';const m=JSON.parse(await readFile(dir+'manifest.json','utf8'));
 assert.deepEqual(m.permissions,['activeTab','scripting','storage','alarms']);assert.deepEqual(m.externally_connectable,{matches:['https://rakeezx.com/*']});
 assert.equal(m.host_permissions,undefined);assert.equal(m.content_scripts,undefined);
 assert.equal(await readFile(dir+'handoff-protocol.js','utf8'),await readFile('src/lib/n36-extension-protocol.js','utf8'));
 const worker=await readFile(dir+'handoff-worker.js','utf8');assert.doesNotMatch(worker,/fetch\(|XMLHttpRequest|localStorage|storage\.(local|sync)|clipboard|cookies/);
 for(const file of ['navigation.js','source-adapter.js','route-diagnostics.js']){
  const {execFileSync}=await import('node:child_process');const baseline=execFileSync('git',['show','0246d892de99ff66c8106d37b77678136cc3cacf:'+dir+file],{encoding:'utf8'});
  assert.equal((await readFile(dir+file,'utf8')).replace(/\r\n/g,'\n'),baseline.replace(/\r\n/g,'\n'));
 }
 const sw=await readFile('sw.js','utf8');for(const file of ['n36-extension-handoff.js','n36-extension-protocol.js'])assert.ok(sw.includes("'./src/lib/"+file+"'"));
});
test('installable ZIP and provenance manifest match every shipped runtime byte',async()=>{
 const {createHash}=await import('node:crypto');const {unzipSync}=await import('../src/lib/student-import-parsers.js');
 const dir='assets/extensions/',m=JSON.parse(await readFile(dir+'rakeez-teacher-import-helper-0.5.0.manifest.json','utf8'));
 const bytes=await readFile(dir+m.archive.file),hash=b=>createHash('sha256').update(b).digest('hex'),zip=unzipSync(bytes);
 assert.equal(hash(bytes),m.archive.sha256);assert.equal(bytes.length,m.archive.bytes);assert.equal(m.version,'0.5.0');
 assert.equal(m.inheritedExtensionCommit,'0246d892de99ff66c8106d37b77678136cc3cacf');
 assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const file of m.files){const source=await readFile('extensions/rakeez-teacher-import-helper/'+file.file);assert.deepEqual(Buffer.from(zip[file.file]),source,file.file);assert.equal(hash(source),file.sha256);}
 assert.equal(JSON.parse(Buffer.from(zip['manifest.json']).toString()).version,'0.5.0');
});
