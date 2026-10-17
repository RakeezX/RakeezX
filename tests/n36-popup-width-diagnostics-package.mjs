// AI: exact package, actual ESM graph, and no-side-effect health boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',baseSha='e1950472da7abd53bd520dad2beac791146b298f';
const read=p=>fs.readFile(p,'utf8'),norm=s=>s.replace(/\r\n/g,'\n'),hash=b=>createHash('sha256').update(b).digest('hex');
const before=p=>execFileSync('git',['show',baseSha+':'+p]);
const worker=await read(dir+'handoff-worker.js');
const addition=worker.slice(worker.indexOf('  // AI: health has'),worker.indexOf('  enqueue(async()=>{'));
assert.equal(norm(worker.replace(addition,'')),norm(before(dir+'handoff-worker.js').toString()));
const reused={};
for(const file of ['handoff-protocol.js','selection.js','source-adapter.js','source-roster.js','navigation.js','route-diagnostics.js','class-order.js','core.js','categories.js']){
 const bytes=await fs.readFile(dir+file);assert.equal(norm(bytes.toString()),norm(before(dir+file).toString()));reused[file]=hash(bytes);
}
for(const file of ['sw.js','src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js'])assert.equal(norm(await read(file)),norm(before(file).toString()));
assert.equal(norm(await read(dir+'handoff-protocol.js')),norm(await read('src/lib/n36-extension-protocol.js')));
assert.equal(norm((await read('src/views/class-import-center.js')).replaceAll('0.5.11','0.5.10')),norm(before('src/views/class-import-center.js').toString()));
const manifest=JSON.parse(await read(dir+'manifest.json')),oldManifest=JSON.parse(before(dir+'manifest.json'));
assert.deepEqual({...manifest,version:oldManifest.version},oldManifest);
const html=await read(dir+'popup.html');assert.ok(html.indexOf('src="diagnostics-bootstrap.js"')<html.indexOf('type="module"'));
assert.doesNotMatch(await read(dir+'diagnostics-bootstrap.js'),/\bimport\s|\beval\(|fetch\(|localStorage|clipboard\.read|storage\./);
assert.doesNotMatch(html,/<script\b(?![^>]*\bsrc=)[^>]*>/);
// Execute the actual worker with protocol import resolved, spy every storage/tab/alarm effect.
const context=vm.createContext({URL,console});
vm.runInContext(`globalThis.effects=[];globalThis.listeners={};globalThis.chrome={runtime:{id:'a'.repeat(32),getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:{addListener:f=>listeners.internal=f},onMessageExternal:{addListener:f=>listeners.external=f}},storage:{session:{get:()=>{effects.push('get');return Promise.resolve({});},set:()=>effects.push('set'),remove:()=>effects.push('remove')}},alarms:{create:()=>effects.push('alarm'),clear:()=>effects.push('clear'),onAlarm:{addListener(){}}},tabs:{create:()=>effects.push('create'),update:()=>effects.push('update'),remove:()=>effects.push('remove-tab'),onRemoved:{addListener(){}}}};`,context);
const protocol=await read(dir+'handoff-protocol.js');
vm.runInContext(protocol.replaceAll('export ',''),context);
vm.runInContext(worker.replace(/^import .*?;\r?\n/m,''),context);
const health=vm.runInContext(`(()=>{
 const good={id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')+'?run=ignored'};
 let replies=[];const call=(m,s=good)=>listeners.internal(m,s,r=>replies.push(r));
 call({type:'n36-health'});
 for(const sender of [{...good,id:'foreign'},{...good,url:'https://invalid.invalid/popup.html'},{...good,url:chrome.runtime.getURL('other.html')},{id:good.id}])call({type:'n36-health'},sender);
 for(const request of [{type:'n36-health',payload:'PRIVATE_SENTINEL'},{type:'n36-health',nonce:'PRIVATE_SENTINEL'},Object.assign(Object.create({private:'PRIVATE_SENTINEL'}),{type:'n36-health'})])call(request);
 return {replies,effects};
})()`,context);
assert.equal(JSON.stringify(health),JSON.stringify({replies:[{ok:true,health:'ready'}],effects:[]}));
const visited=new Set();
async function graph(file){if(visited.has(file))return;visited.add(file);const source=await read(dir+file);
 execFileSync(process.execPath,['--check',dir+file]);
 for(const m of source.matchAll(/\bimport\s+(?:[^'";]*?from\s*)?['"]([^'"]+)['"]/g)){
  assert.ok(m[1].startsWith('.'));const {posix}=await import('node:path');const dependency=posix.normalize(posix.join(posix.dirname(file),m[1]));
  assert.ok(!dependency.startsWith('../'));const names=await fs.readdir(dir+posix.dirname(dependency));assert.ok(names.includes(posix.basename(dependency)),dependency+' exact resource case');await graph(dependency);
 }
}
for(const file of ['popup.js','categories-popup.js','run-controller.js','handoff-worker.js','diagnostics-bootstrap.js'])await graph(file);
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('${dir}')
old=json.loads(Path('${assets}rakeez-teacher-import-helper-0.5.10.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${assets}rakeez-teacher-import-helper-0.5.11.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name in sorted([f['file'] for f in old['files']]+['diagnostics-bootstrap.js']):
  data=(root/name).read_bytes()
  info=zipfile.ZipInfo(name,(2026,10,17,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='0.5.11',applicationBaseSha='${baseSha}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${assets}rakeez-teacher-import-helper-0.5.11.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
const packaged=JSON.parse(await read(assets+'rakeez-teacher-import-helper-0.5.11.manifest.json'));
const bytes=await fs.readFile(assets+packaged.archive.file),zip=unzipSync(bytes);
assert.equal(hash(bytes),packaged.archive.sha256);assert.equal(bytes.length,packaged.archive.bytes);
assert.equal(packaged.applicationBaseSha,baseSha);assert.equal(packaged.version,manifest.version);
assert.deepEqual(Object.keys(zip).sort(),packaged.files.map(f=>f.file).sort());
for(const file of packaged.files){const source=await fs.readFile(dir+file.file);assert.deepEqual(Buffer.from(zip[file.file]),source);assert.equal(hash(source),file.sha256);assert.equal(source.length,file.bytes);if(process.argv.includes('--verify-index'))assert.deepEqual(source,execFileSync('git',['show',':'+dir+file.file]));}
for(const ext of ['zip','manifest.json'])assert.deepEqual(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.10.'+ext),before(assets+'rakeez-teacher-import-helper-0.5.10.'+ext));
const previousEvidence=JSON.parse(await read('tests/n36-terminal-pager-evidence-browser.json'));
assert.equal(previousEvidence.sourceHashes['source-adapter.js'],reused['source-adapter.js']);assert.equal(previousEvidence.status,'PASS');
const checks=[{name:'n36_protocol_module_graph_packaging_and_bounded_strict_health_no_sideeffects',status:'PASS',evidence:{modules:[...visited],strictHealth:JSON.parse(JSON.stringify(health)),native:JSON.parse(await read('tests/n36-popup-width-diagnostics-native.json'))}},
{name:'n36_0511_source_package_binding_and_unchanged_transport_guards',status:'PASS',evidence:{archive:packaged.archive,files:packaged.files,reusedHashes:reused,worker:'Exact baseline plus isolated health branch after unchanged sender guard',site:'Version substitution only; N107 flow preserved',offlineShell:'Unchanged; new bootstrap is extension-only, not web startup',coverage:'Unchanged parser evidence reused; no school/receipt acceptance claim'}}];
await fs.writeFile('tests/n36-popup-width-diagnostics-package.json',JSON.stringify({baseSha,status:'PASS',checks},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',modules:visited.size,files:packaged.files.length,archive:packaged.archive}));
