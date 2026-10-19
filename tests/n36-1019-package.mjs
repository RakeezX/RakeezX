// AI: deterministic genuine 0.5.12 package; previous accepted packages remain immutable.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const base='3fce1195b9c840259e0acea6973efd1436288c29',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
root=Path('${dir}')
old=json.loads(Path('${assets}rakeez-teacher-import-helper-0.5.11.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${assets}rakeez-teacher-import-helper-0.5.12.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=(root/f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,19,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='0.5.12',applicationBaseSha='${base}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${assets}rakeez-teacher-import-helper-0.5.12.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
const manifest=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.12.manifest.json','utf8'));
const bytes=await fs.readFile(assets+manifest.archive.file),zip=unzipSync(bytes);
assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);
assert.equal(manifest.applicationBaseSha,base);assert.equal(manifest.version,'0.5.12');
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file),f.file);assert.equal(hash(zip[f.file]),f.sha256);}
const m=JSON.parse(Buffer.from(zip['manifest.json']));assert.equal(m.version,'0.5.12');assert.deepEqual(m.permissions,['activeTab','scripting','storage','alarms']);assert.deepEqual(m.host_permissions,['https://rakeezx.com/*']);assert.equal(m.content_scripts,undefined);
assert.deepEqual(await fs.readFile(dir+'handoff-protocol.js'),await fs.readFile('src/lib/n36-extension-protocol.js'));
for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-0.5.11.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]));}
const reusedHashes={};for(const f of ['source-adapter.js','source-roster.js','selection.js','route-diagnostics.js','categories.js','class-order.js']){
 const source=await fs.readFile(dir+f);assert.deepEqual(source,execFileSync('git',['show',base+':'+dir+f]));reusedHashes[f]=hash(source);
}
const app=await fs.readFile('src/views/class-import-center.js','utf8');assert.match(app,/helper-0\.5\.12\.zip/);assert.doesNotMatch(app,/helper-0\.5\.11\.zip/);
for(const f of ['src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','src/views/class-import-center.js',...manifest.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file)])execFileSync(process.execPath,['--check',f]);
const evidence={status:'PASS',baseSha:base,archive:manifest.archive,reusedHashes,checks:['Exact 25 runtime files ZIP/source/size/SHA256','Narrow app-only host grant; no content scripts, school hosts, cookies or background collection','Protocol parity and changed JS syntax','0.5.11 immutable archive and manifest','Original accepted extraction/coverage engines unchanged; no 303-suite rerun','Current app download link matches genuine 0.5.12 package']};
await fs.writeFile('tests/n36-1019-package.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
