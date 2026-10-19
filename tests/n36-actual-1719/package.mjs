// AI: deterministic scoped 0.5.15 package and immutable prior release verification.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
const base='0b4e841ca9447373add29c0a62876494a81ecdb8',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',version='0.5.15';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('${dir}')
old=json.loads(Path('${assets}rakeez-teacher-import-helper-0.5.14.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${assets}rakeez-teacher-import-helper-${version}.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=(root/f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,19,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='${version}',applicationBaseSha='${base}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${assets}rakeez-teacher-import-helper-${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
const manifest=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-'+version+'.manifest.json','utf8'));
const bytes=await fs.readFile(assets+manifest.archive.file),zip=unzipSync(bytes);
assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);assert.equal(manifest.applicationBaseSha,base);
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file),f.file);assert.equal(hash(zip[f.file]),f.sha256);}
const m=JSON.parse(Buffer.from(zip['manifest.json']));assert.equal(m.version,version);assert.deepEqual(m.permissions,['activeTab','scripting','storage','alarms']);assert.deepEqual(m.host_permissions,['https://rakeezx.com/*']);assert.equal(m.content_scripts,undefined);
for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-0.5.14.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]));}
const reusedHashes={};for(const f of ['source-adapter.js','source-roster.js','selection.js','route-diagnostics.js','categories.js','class-order.js','handoff-worker.js','handoff-protocol.js']){
 const source=await fs.readFile(dir+f);assert.deepEqual(source,execFileSync('git',['show',base+':'+dir+f]));reusedHashes[f]=hash(source);
}
assert.deepEqual(await fs.readFile(dir+'handoff-protocol.js'),await fs.readFile('src/lib/n36-extension-protocol.js'));
const popup=await fs.readFile(dir+'popup.html','utf8');assert.ok(popup.includes('href="https://rakeezx.com/" target="_blank" rel="noopener noreferrer"'));
const app=await fs.readFile('src/views/class-import-center.js','utf8');assert.match(app,/helper-0\.5\.15\.zip/);
for(const f of ['src/views/class-import-center.js',...manifest.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file)])execFileSync(process.execPath,['--check',f]);
const canonical='C:/Users/Abody/Projects/RakeezX';
const updater=await fs.readFile(canonical+'/scripts/ops-supervisor-v4/n36-stable-sync.mjs','utf8');assert.ok(updater.includes("root+'/scripts/ops-supervisor-v4/n36-update-stable.mjs'"));
const stable=JSON.parse(await fs.readFile(canonical+'/artifacts/private-tools/n36-current/STABLE_CURRENT.json','utf8'));
const evidence={status:'PASS',version,archive:manifest.archive,files:manifest.files.length,reusedHashes,checks:['Exact ZIP/source/manifest hashes; immutable 0.5.14','Unchanged source extraction/pagination/transport guards: reuse recorded evidence','Scoped JS syntax and protocol parity','Actual website download points to verified local 0.5.15 package'],stableFolder:{observedVersion:stable.version,updatedByWorker:false,existingMinuteUpdater:true,advanceToCandidate:'NOT_RUN: requires independent publisher verified release'},provider:'NOT_RUN',production:'NOT_RUN'};
await fs.writeFile('tests/n36-actual-1719/package.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
