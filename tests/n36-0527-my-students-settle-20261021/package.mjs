// AI: existing deterministic versioned archive workflow; no stable install or publishing.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='ebb8aa4daf5c71f255941c9ffb71fae91c18a155',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.28',folder='tests/n36-0527-my-students-settle-20261021/';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--prepare'))execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.27.manifest.json').read_text(encoding='utf-8'))
files=[]
archive=Path('${prefix}${version}.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=Path('${dir}',f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,21,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='${version}',applicationBaseSha='${baseSha}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${prefix}${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
const manifest=JSON.parse(await fs.readFile(prefix+version+'.manifest.json','utf8')),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);
assert.equal(manifest.version,version);assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);assert.equal(manifest.archive.file,'rakeez-teacher-import-helper-'+version+'.zip');
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256,f.file);assert.equal(zip[f.file].length,f.bytes);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file),f.file);}
const m=JSON.parse(Buffer.from(zip['manifest.json']).toString('utf8')),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));
assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete old.version;assert.deepEqual(m,old,'Only manifest version changes; permission/host/CSP unchanged');
const view='src/views/class-import-center.js',before=execFileSync('git',['show',baseSha+':'+view],{encoding:'utf8'}).replaceAll('\r\n','\n'),current=(await fs.readFile(view,'utf8')).replaceAll('\r\n','\n');
const oldLink='<a class="btn btn--primary" href="/assets/extensions/rakeez-teacher-import-helper-0.5.27.zip" download>تنزيل إضافة ركيز 0.5.27</a>';
assert.equal(before.split(oldLink).length,2);assert.equal(current,before.replace(oldLink,oldLink.replaceAll('0.5.27',version)),'Exact href/label replacement, all other import view content preserved (Git LF / Windows CRLF normalized)');
const historical=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n').filter(p=>/rakeez-teacher-import-helper-[0-9.]+\.(zip|manifest\.json)$/.test(p));
execFileSync('git',['diff','--exit-code',baseSha,'--',...historical]);
const unchanged=[dir+'handoff-worker.js',dir+'handoff-protocol.js',dir+'background-collector.js',dir+'source-roster.js',dir+'route-diagnostics.js',dir+'popup.html',dir+'popup.css',dir+'categories.js',dir+'categories-popup.js',dir+'core.js',dir+'class-order.js',dir+'navigation.js',dir+'lib','src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','src/store.js','sw.js'];
execFileSync('git',['diff','--exit-code',baseSha,'--',...unchanged]);
for(const p of [view,dir+'background-runner.js',dir+'selection.js',dir+'source-adapter.js',dir+'run-controller.js',dir+'diagnostics-bootstrap.js'])execFileSync(process.execPath,['--check',p]);
const result={name:'n36_0528_package_link_and_safe_diagnostic_exact',status:'PASS',baseSha,version,archive:manifest.archive,runtimeFiles:manifest.files.length,checks:['ZIP/source/file SHA256 and size parity','Exact .28 download href + label only','Manifest permissions/hosts/CSP unchanged','Immutable .27 ZIP/manifest and unchanged receiver/data/route/date/popup assets','Changed JS syntax'],reusedEvidence:['tests/n36-0524-package-link-20261020/result.json','tests/n36-background-no-popup-20261020/browser.json'],actualSourceAcceptance:'NOT_RUN: one later manual user diagnostic is required to establish actual source acceptance',publicationAndStableParity:'NOT_RUN: independent controller/publisher, followed by existing stable updater only after verified publication'};
await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
