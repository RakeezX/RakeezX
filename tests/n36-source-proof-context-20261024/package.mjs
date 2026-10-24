// AI-authored: reuse N36's deterministic allowlisted ZIP packager; no install/publish.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='aa761cc6583385d0a5215c49324f68d20b0f8ba0',folder='tests/n36-source-proof-context-20261024/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.42';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const files=['baseline','candidate','candidate-guards-dashboard','candidate-guards-teacher','candidate-fetch-binding'];
let cases=0;for(const name of files){const r=await json(folder+name+'.json');assert.equal(r.status,'PASS',name);assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);cases+=r.cases.length;}
const certified=await json(folder+'candidate-fetch-binding.json');for(const [name,sha] of Object.entries(certified.sourceHashes))assert.equal(hash(await fs.readFile(dir+name)),sha,name);
if(process.argv.includes('--prepare')){
 await assert.rejects(fs.access(prefix+version+'.zip'));
 const m=await fs.readFile(dir+'manifest.json','utf8');assert.ok(m.includes('"version": "0.5.41"'));await fs.writeFile(dir+'manifest.json',m.replace('"version": "0.5.41"','"version": "0.5.42"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.42 (24 October 2026): source proof binds exact origin/path/query, school, teacher/role and unique safe primary read targets. Same-document fragments and coherent optional-control enrichment are not identity changes. A busy marker may settle for at most three seconds only with unchanged positive teacher/school and structural proof; no reads/saves advance while pending. Document/job/account/session and true identity changes still stop. Diagnostics add only a finite mismatch category. Both dashboard and teacher-page entries qualified on synthetic actual worker/source/receiver DOM; actual user cause remains unproven and N36 acceptance remains open. No permission/CSP, academic, recovery, grade or cloud change.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const app='src/views/class-import-center.js',s=await fs.readFile(app,'utf8');assert.equal(s.split('rakeez-teacher-import-helper-0.5.41.zip').length,2);await fs.writeFile(app,s.replace('rakeez-teacher-import-helper-0.5.41.zip','rakeez-teacher-import-helper-0.5.42.zip').replace('تنزيل إضافة ركيز 0.5.41','تنزيل إضافة ركيز 0.5.42'));
 // Same ZIP recipe/file allowlist as school-proof-package.mjs; exclusive create.
 execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.41.manifest.json').read_text(encoding='utf-8'))
archive=Path('${prefix}${version}.zip')
files=[]
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=Path('${dir}',f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='${version}',applicationBaseSha='${baseSha}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${prefix}${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
}
const manifest=await json(prefix+version+'.manifest.json'),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes),prior=await json(prefix+'0.5.41.manifest.json');
assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);assert.equal(manifest.applicationBaseSha,baseSha);assert.equal(manifest.files.length,29);assert.deepEqual(Object.keys(zip).sort(),prior.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.equal(zip[f.file].length,f.bytes);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.equal(m.version,version);assert.ok(approvedPackageBoundary(m));delete m.version;delete old.version;assert.deepEqual(m,old);
for(const [name,sha] of Object.entries(certified.sourceHashes))assert.equal(hash(zip[name]),sha,'qualified runtime '+name);
execFileSync('git',['diff','--exit-code',baseSha,'--','src/store.js','src/lib/teacher-setup-import.js','src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','sw.js',dir+'route-diagnostics.js',dir+'source-roster.js',dir+'handoff-worker.js',dir+'handoff-protocol.js']);
for(const suffix of ['zip','manifest.json'])assert.deepEqual(await fs.readFile(prefix+'0.5.41.'+suffix),execFileSync('git',['show',baseSha+':'+prefix+'0.5.41.'+suffix]));
const app=await fs.readFile('src/views/class-import-center.js','utf8'),oldApp=execFileSync('git',['show',baseSha+':src/views/class-import-center.js'],{encoding:'utf8'});assert.equal(app.replaceAll('0.5.42','0.5.41').replaceAll('\r\n','\n'),oldApp.replaceAll('\r\n','\n'));
for(const p of [...manifest.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file),'src/views/class-import-center.js',folder+'runtime.mjs'])execFileSync(process.execPath,['--check',p]);
const evidence={status:'PASS',baseSha,version,cases,archive:manifest.archive,sourceHashes:certified.sourceHashes,files:29,permissionAndCSPUnchanged:true,priorArchiveUnchanged:true,appLinkOnly:true,protectedAcademicReceiverRecoveryUnchanged:true,production:'NOT_RUN',officialAccountVerification:'NOT_RUN'};
await fs.writeFile(folder+'package.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
