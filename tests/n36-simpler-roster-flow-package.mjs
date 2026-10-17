// AI: deterministic package preparation and exact bounded source/privacy evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const baseSha='91b4adc8736f79c663512a2829eb3b57ec54998f',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv.includes('--prepare')){
 execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('extensions/rakeez-teacher-import-helper')
old=json.loads(Path('assets/extensions/rakeez-teacher-import-helper-0.5.9.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('assets/extensions/rakeez-teacher-import-helper-0.5.10.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=(root/f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,17,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='0.5.10',applicationBaseSha='${baseSha}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('assets/extensions/rakeez-teacher-import-helper-0.5.10.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`],{stdio:'inherit'});
}
const manifest=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.10.manifest.json','utf8'));
const bytes=await fs.readFile(assets+manifest.archive.file),zip=unzipSync(bytes);
assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);
assert.equal(manifest.applicationBaseSha,baseSha);assert.equal(manifest.version,'0.5.10');
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const item of manifest.files){const packaged=Buffer.from(zip[item.file]),source=await fs.readFile(dir+item.file);assert.deepEqual(packaged,source,item.file);assert.equal(hash(source),item.sha256);assert.equal(source.length,item.bytes);}
const before=file=>execFileSync('git',['show',baseSha+':'+file]);
for(const suffix of ['zip','manifest.json'])assert.deepEqual(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.9.'+suffix),before(assets+'rakeez-teacher-import-helper-0.5.9.'+suffix));
const unchanged=['selection.js','source-adapter.js','navigation.js','class-order.js','core.js','categories.js','handoff-protocol.js','handoff-worker.js','popup.js','route-diagnostics.js'];
const reusedHashes={};
for(const f of unchanged){const source=await fs.readFile(dir+f);assert.deepEqual(source,before(dir+f),f);reusedHashes[f]=hash(source);}
assert.deepEqual(await fs.readFile(dir+'handoff-protocol.js'),await fs.readFile('src/lib/n36-extension-protocol.js'));
const oldManifest=JSON.parse(before(dir+'manifest.json'));const currentManifest=JSON.parse(await fs.readFile(dir+'manifest.json','utf8'));
assert.deepEqual({...currentManifest,version:oldManifest.version},oldManifest);
for(const f of ['src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','sw.js'])assert.deepEqual(await fs.readFile(f),before(f),f);
const app=await fs.readFile('src/views/class-import-center.js','utf8');assert.equal(app.replaceAll('0.5.10','0.5.9'),before('src/views/class-import-center.js').toString('utf8'));
const roster=await fs.readFile(dir+'source-roster.js','utf8');assert.equal(roster.split('export function coverageMessage')[0],before(dir+'source-roster.js').toString('utf8').split('export function coverageMessage')[0]);
const collection=s=>s.slice(s.indexOf('async function start(tabId)'),s.indexOf('async function finishCollection(ticket)'));
assert.equal(collection(await fs.readFile(dir+'run-controller.js','utf8')),collection(before(dir+'run-controller.js').toString('utf8')));
for(const f of ['categories-popup.js','run-controller.js','source-roster.js'])execFileSync(process.execPath,['--check',dir+f]);
execFileSync(process.execPath,['--check','src/views/class-import-center.js']);
for(const f of ['categories-popup.js','run-controller.js'])assert.doesNotMatch(await fs.readFile(dir+f,'utf8'),/localStorage|storage\.(local|sync)|indexedDB|fetch\(/);
const parserEvidence=JSON.parse(await fs.readFile('tests/n36-terminal-pager-evidence-browser.json','utf8'));
assert.equal(parserEvidence.status,'PASS');assert.equal(reusedHashes['source-adapter.js'],parserEvidence.sourceHashes['source-adapter.js']);
const collectionEvidence=JSON.parse(await fs.readFile('tests/n36-collect-before-review-browser.json','utf8'));
assert.equal(collectionEvidence.status,'PASS');for(const name of ['collect-350','collect-1000'])assert.ok(collectionEvidence.checks.some(c=>c.name===name&&c.status==='PASS'));
const evidence={taskId:'continuous-n36-simpler-reviewed-roster-flow-0510-20261017',runId:'e1a6a4b5-41dd-4733-9627-1c8fe012cd34',baseSha,status:'PASS',archive:manifest.archive,files:manifest.files,reusedHashes,
 checks:['Exact ZIP/source/per-file/size/SHA256 and base binding','0.5.9 archive and manifest preserved','Unchanged permissions, parser, class order, protocol, transport worker, receiver and offline shell','Source coverage algorithm and collection/continuation functions unchanged; 350/1000 and parser evidence reused','Central application differs only in download version, preserving N107/owner/lease/save logic','Changed JS syntax and no new persistent storage/network primitives'],
 delivery:{provider:'NOT_RUN — independent publisher',production:'NOT_RUN — independent publisher',stableLocalUpdate:'NOT_RUN — requires publication, then natural scheduled update and disk receipt; no manual updater or Chrome control'}};
await fs.writeFile('tests/n36-simpler-roster-flow-package.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'PASS',archive:manifest.archive,unchangedGuards:unchanged.length}));
