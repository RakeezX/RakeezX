// AI-authored: certify the affected checks before making a new immutable package.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='a068e8db4d3793c067a07b400bfd3f146ef8dc91',folder='tests/n36-lesson-link-20261023/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.40';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=async f=>JSON.parse(await fs.readFile(f,'utf8'));
for(const [file,names] of [['candidate',['conflict']],['packaged-runtime',['conflict']],['restarted',['conflict']],['department-source',['suffix','ambiguous','unknown','label-conflict','label-explicit']],['department-guards',['owner','session','atomic']],['partial-roster',['gap']]]){
 const r=await json(folder+file+'.json');assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);
 for(const name of names)assert.equal(r.cases.find(c=>c.scenario===name)?.status,'PASS',file+':'+name);
}
const guards=await json(folder+'guards.json');assert.ok(!guards.error);assert.equal(guards.cases.length,32);assert.ok(guards.cases.every(c=>c.status==='PASS'));assert.equal(guards.resources.serverClosed,true);
if(!process.argv.includes('--prepare')){const download=await json(folder+'download.json');assert.equal(download.status,'PASS');assert.equal(download.actualDownloadHashMatched,true);}
const red=(await json(folder+'baseline.json')).cases[0];assert.equal(red.status,'OBSERVED');assert.equal(red.view.setupRejectReason,'response-school-absent');assert.ok(red.view.fields.some(d=>d.field==='department'&&d.reason==='conflict'));assert.equal(red.durable.teachings,0);
const prior=await json(prefix+'0.5.39.manifest.json');
const historical=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n');
execFileSync('git',['diff','--exit-code',baseSha,'--',...historical]);
// Reuse unchanged .39 recovery, receipt, roster/coverage and transport evidence.
execFileSync('git',['diff','--exit-code',baseSha,'--','src/store.js','src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','src/lib/teacher-setup-import.js','sw.js',dir+'handoff-worker.js',dir+'background-runner.js',dir+'selection.js']);
if(process.argv.includes('--prepare')){
 await assert.rejects(fs.access(prefix+version+'.zip'));
 const files=await Promise.all(prior.files.map(async f=>({file:f.file,sha256:hash(await fs.readFile(dir+f.file))})));
 await fs.writeFile(folder+'certified-runtime.json',JSON.stringify({baseSha,files,reusedEvidence:'N36_COMPLETE_IMPORT_OUTCOME.md; school-proof-entry/identity/roster/resources and .39 receipt history unchanged',metadataOnlyAfterProof:['manifest.json','README.md','download label/href']},null,2)+'\n');
 const m=await fs.readFile(dir+'manifest.json','utf8');assert.ok(m.includes('"version": "0.5.39"'));await fs.writeFile(dir+'manifest.json',m.replace('"version": "0.5.39"','"version": "0.5.40"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.40 (23 October 2026): inert, strict same-origin ManageLecture tuples in an explicitly headed timetable cell may bind an absent response school label to the already-bound school. Two anchors in that cell provide subject then classroom; no lesson navigation, execution or source write. Explicit identity contradictions still reject. Unknown coordinates produce unavailable timetable, never invented dates/periods. A unique known school-title suffix now updates an old department via the existing owner/session transaction; ambiguous/unknown suffix does not overwrite, explicit conflicting department is unresolved. Raw source identity and provenance remain in the existing envelope. Synthetic supported-seam qualification only: actual surrounding portal layout and user acceptance remain open. No permissions/CSP, receipts, roster coverage, recovery or cloud changes. Prior 0.5.39 archive retained.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const app='src/views/class-import-center.js',s=await fs.readFile(app,'utf8');assert.equal(s.split('rakeez-teacher-import-helper-0.5.39.zip').length,2);await fs.writeFile(app,s.replace('rakeez-teacher-import-helper-0.5.39.zip','rakeez-teacher-import-helper-0.5.40.zip').replace('تنزيل إضافة ركيز 0.5.39','تنزيل إضافة ركيز 0.5.40'));
 execFileSync('python',['-c',`import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.39.manifest.json').read_text(encoding='utf-8'))
archive=Path('${prefix}${version}.zip')
files=[]
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in old['files']:
  data=Path('${dir}',f['file']).read_bytes()
  info=zipfile.ZipInfo(f['file'],(2026,10,23,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
  files.append(dict(file=f['file'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
data=archive.read_bytes()
manifest=dict(schema=old['schema'],version='${version}',applicationBaseSha='${baseSha}',officialAccountVerification='NOT_RUN',files=files,archive=dict(file=archive.name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
Path('${prefix}${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')
`]);
}
const certificate=await json(folder+'certified-runtime.json');for(const f of certificate.files)if(!['manifest.json','README.md'].includes(f.file))assert.equal(hash(await fs.readFile(dir+f.file)),f.sha256,f.file);
const manifest=await json(prefix+version+'.manifest.json'),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);assert.deepEqual(Object.keys(zip).sort(),prior.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete old.version;assert.deepEqual(m,old);
for(const f of [dir+'source-adapter.js','src/views/class-import-center.js'])execFileSync(process.execPath,['--check',f]);execFileSync('git',['diff','--check']);
const result={status:'PASS',baseSha,version,archive:manifest.archive,files:manifest.files.length,previousArchivesAndReceipts:'unchanged',permissionsAndCSP:'unchanged',buildAndPublication:'NOT_RUN; independent publisher',actualPortalLayoutAndProductAcceptance:'OPEN'};
await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
