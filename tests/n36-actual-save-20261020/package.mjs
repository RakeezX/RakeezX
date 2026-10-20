// AI: existing deterministic versioned package workflow; no stable-folder writes.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const base='7a68241d47c4501b224ac237a36e9d44c4a377ea',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',version='0.5.17';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('${dir}')
old=json.loads(Path('${assets}rakeez-teacher-import-helper-0.5.16.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${assets}rakeez-teacher-import-helper-${version}.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=(root/f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,20,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='${version}',applicationBaseSha='${base}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${assets}rakeez-teacher-import-helper-${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
const manifest=JSON.parse(await fs.readFile(assets+`rakeez-teacher-import-helper-${version}.manifest.json`,'utf8'));
const bytes=await fs.readFile(assets+manifest.archive.file),zip=unzipSync(bytes);
assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){const source=await fs.readFile(dir+f.file);assert.deepEqual(Buffer.from(zip[f.file]),source,f.file);assert.equal(hash(source),f.sha256);assert.equal(source.length,f.bytes);}
assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,version);assert.ok(approvedPackageBoundary(JSON.parse(Buffer.from(zip['manifest.json']))));
assert.deepEqual(await fs.readFile(dir+'handoff-protocol.js'),await fs.readFile('src/lib/n36-extension-protocol.js'));
const unchanged=['source-adapter.js','source-roster.js','selection.js','route-diagnostics.js','categories.js','class-order.js','navigation.js','run-controller.js','core.js'];
for(const f of unchanged)assert.deepEqual(await fs.readFile(dir+f),execFileSync('git',['show',base+':'+dir+f]),f+' extraction/lifecycle proof reused');
for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-0.5.16.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]));}
for(const file of ['src/app.js','src/store.js','src/views/class-import-center.js',...manifest.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file)])execFileSync(process.execPath,['--check',file]);
const stableRoot='C:/Users/Abody/Projects/RakeezX/artifacts/private-tools/n36-current';
const stable=JSON.parse(await fs.readFile(stableRoot+'/STABLE_CURRENT.json','utf8'));
for(const f of stable.files){const b=await fs.readFile(stableRoot+'/runtime/'+f.file);assert.equal(hash(b),f.sha256);assert.equal(b.length,f.bytes);}
const published=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-'+stable.version+'.manifest.json','utf8'));
assert.deepEqual(stable.files,published.files);assert.equal(stable.archiveSha256,published.archive.sha256);
const result={status:'PASS',version,baseSha:base,archive:manifest.archive,runtimeFiles:manifest.files.length,checks:['Exact ZIP/source/SHA256/size parity','Original extraction/lifecycle modules unchanged; proof reused','Protocol parity, unchanged narrow permissions/CSP, changed JS syntax','Previous 0.5.16 immutable','Current stable runtime read-only hash verification'],stable:{version:stable.version,sourceTaskId:stable.sourceTaskId,publishedSha:stable.publishedSha,filesVerified:stable.files.length,updated:false},deliveryGate:{status:'NOT_RUN',reason:'Independent publisher must first verify source/served 0.5.17 package; existing n36-stable-sync then installs those exact bytes and records version/hash. Current stable remains '+stable.version+'. Chrome reload NOT_RUN.'}};
await fs.writeFile('tests/n36-actual-save-20261020/package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
