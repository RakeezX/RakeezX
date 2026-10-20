// AI: existing deterministic versioned package workflow; no stable-folder writes.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const base='91b12fa2c6488c74a8cda81650861cbe1b13e870',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',version='0.5.21';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('${dir}')
old=json.loads(Path('${assets}rakeez-teacher-import-helper-0.5.20.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${assets}rakeez-teacher-import-helper-${version}.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']+[dict(file='background-runner.js'),dict(file='background-collector.js')]:
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
assert.equal(manifest.files.length,27);
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){const source=await fs.readFile(dir+f.file);assert.deepEqual(Buffer.from(zip[f.file]),source,f.file);assert.equal(hash(source),f.sha256);assert.equal(source.length,f.bytes);}
assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,version);assert.ok(approvedPackageBoundary(JSON.parse(Buffer.from(zip['manifest.json']))));
const oldManifest=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json']));
const currentManifest=JSON.parse(await fs.readFile(dir+'manifest.json','utf8'));
for(const key of Object.keys(oldManifest).filter(k=>k!=='version'))assert.deepEqual(currentManifest[key],oldManifest[key],key+' permission/CSP/manifest unchanged');
const unchanged=['source-adapter.js','source-roster.js','route-diagnostics.js','class-order.js','core.js','lib/rakeez-datetime.js','lib/rakeez-datetime-values.js','lib/rakeez-datetime.css'];
for(const f of unchanged)assert.deepEqual(await fs.readFile(dir+f),execFileSync('git',['show',base+':'+dir+f]),f+' previous proof reused');
for(const p of ['src/store.js','src/views/settings.js','src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js',dir+'handoff-protocol.js',dir+'categories-popup.js',dir+'categories.js'])assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]),p+' preceding qualified pipeline reused');
for(const p of ['src/app.js','src/store.js','src/views/class-import-center.js'])assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]),p+' concurrent app scope untouched');
const app=await import('../../src/lib/n36-extension-handoff.js'),extension=await import('../../extensions/rakeez-teacher-import-helper/handoff-protocol.js');
const createdAt=Date.now(),envelope={schema:'rakeez-extension-names',version:3,source:'madrasati',scope:'reviewed-run',createdAt,expiresAt:createdAt+120000,batchId:'f'.repeat(64),complete:true,rows:[{name:'طالب اصطناعي',classroom:'خامس1'}],setup:[{category:'department',provenance:['teacher-readonly-run'],rows:[{name:'الرياض'}]}]};
assert.deepEqual(app.validateHandoff(envelope),extension.validateHandoff(envelope));
for(const mutate of [e=>e.setup.push(e.setup[0]),e=>e.setup[0].provenance=['pasted-visible'],e=>e.setup[0].rows[0].token='private',e=>e.rows[0].ownerId='foreign',e=>e.setup[0].rows.push({name:'جدة'}),e=>e.expiresAt=createdAt-1]){const e=structuredClone(envelope);mutate(e);assert.throws(()=>app.validateHandoff(e));assert.throws(()=>extension.validateHandoff(e));}
assert.equal(app.validateHandoff(envelope).version,3);
const sw=await fs.readFile('sw.js','utf8');for(const module of ['teacher-setup-import.js','education-department-directory.js','n36-extension-handoff.js'])assert.ok(sw.includes('/src/lib/'+module),module+' existing offline shell dependency');
for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-0.5.20.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]));}
for(const file of ['src/app.js','src/store.js','src/views/class-import-center.js',...manifest.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file)])execFileSync(process.execPath,['--check',file]);
const result={name:'n36_background_changed_package_no_new_permissions',status:'PASS',version,baseSha:base,archive:manifest.archive,runtimeFiles:manifest.files.length,checks:['Exact ZIP/source/SHA256/size parity','Unaffected source adapter/roster/route/date proofs reused','Additive department app/extension validation parity and malformed rejection; unchanged permissions/CSP; changed JS syntax; existing offline shell modules present','Previous 0.5.20 immutable; source/student/date/route readers unchanged','Stable installation is a postpublication gate'],deliveryGate:{status:'NOT_RUN',reason:'Independent publisher must first verify source/served 0.5.21 package; existing n36-stable-sync then installs those exact bytes and records version/hash. Chrome reload NOT_RUN.'}};
await fs.writeFile('tests/n36-background-no-popup-20261020/package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
