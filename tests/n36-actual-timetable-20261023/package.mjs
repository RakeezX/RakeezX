// AI-authored: affected qualification and immutable .41 packaging; no build/deploy.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='7fa9b61259df3036caf8e6eda6bf03196d7d4d2e',priorCandidate='068bd4c5db8c5cdf56dd7599328157d890b04d75',folder='tests/n36-actual-timetable-20261023/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.41';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=async f=>JSON.parse(await fs.readFile(f,'utf8'));
for(const file of ['cross-class-candidate','cross-class-delayed-home','cross-class-stale-return','cross-class-restart']){const r=await json(folder+file+'.json');assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.sharedBrowserFinally,true);assert.ok(r.cases.length>0&&r.cases.every(c=>c.status==='PASS'),file);}
const red=(await json(folder+'cross-class-baseline.json')).cases[0];assert.equal(red.status,'OBSERVED');assert.equal(red.view.code,'AMBIGUOUS_LESSON_LINKS');assert.equal(red.durable.students,0);assert.equal(red.durable.slots,0);
const guards=await json(folder+'scoped-source-guards.json');assert.equal(guards.cases.length,10);assert.ok(guards.cases.every(c=>c.status==='PASS'));
const actual=await json(folder+'actual-source-parity-913a4635.json');assert.equal(actual.rendered.lessonAnchors,20);assert.equal(actual.returnProof.finalFreshWholeCheckpointEquality,true);assert.equal(actual.resources.originalTabRestored,true);
// Original certificates/failures are immutable history, reused only for unchanged scopes.
const reused=await json(folder+'local-certificate.json');assert.equal(reused.localStatus,'PASS');assert.equal(reused.workerRejectionScenarios,19);
execFileSync('git',['diff','--exit-code',baseSha,'--','src/store.js','src/lib/teacher-setup-import.js','src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','sw.js',dir+'handoff-worker.js']);
const oldArchives=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n');execFileSync('git',['diff','--exit-code',baseSha,'--',...oldArchives]);
const prior=await json(prefix+'0.5.40.manifest.json');
if(process.argv.includes('--prepare')){
 await assert.rejects(fs.access(prefix+version+'.zip'));
 const files=await Promise.all(['background-runner.js','selection.js','source-adapter.js'].map(async file=>({file,sha256:hash(await fs.readFile(dir+file))})));
 await fs.writeFile(folder+'certified-runtime-913a4635.json',JSON.stringify({taskId:actual.taskId,runId:actual.runId,baseSha,priorCandidate,files,qualification:['actual-source-parity-913a4635','cross-class-baseline','cross-class-candidate','cross-class-delayed-home','cross-class-stale-return','cross-class-restart','scoped-source-guards'],unchangedEvidence:'local-certificate.json and underlying .40/068 evidence; scopes described in outcome',metadataOnlyAfterProof:['manifest.json','README.md','download label/href']},null,2)+'\n');
 const m=await fs.readFile(dir+'manifest.json','utf8');assert.ok(m.includes('"version": "0.5.40"'));await fs.writeFile(dir+'manifest.json',m.replace('"version": "0.5.40"','"version": "0.5.41"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.41 (23 October 2026): the user-started collector can read the exact rendered school timetable when its inert response lacks school proof. The worker quarantines rows until the same original canonical school/teacher/role/document and receiver owner/session proof returns, with a fixed deadline and restart-safe checkpoints. Visible strict lesson tuples retain explicit day/period; subject IDs may differ by classroom, while same-class contradictions reject. Temporary semantic-control settling cannot admit changed identity. Actual portal structural parity and synthetic real-app/store checks qualified; real import remains the user action. No new permissions/CSP, receipts, roster completeness, department or cloud changes. Historical 0.5.39/0.5.40 archives retained.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const app='src/views/class-import-center.js',s=await fs.readFile(app,'utf8');assert.equal(s.split('rakeez-teacher-import-helper-0.5.40.zip').length,2);await fs.writeFile(app,s.replace('rakeez-teacher-import-helper-0.5.40.zip','rakeez-teacher-import-helper-0.5.41.zip').replace('0.5.40</a>','0.5.41</a>'));
 execFileSync('python',['-c',`import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.40.manifest.json').read_text(encoding='utf-8'))
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
Path('${prefix}${version}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+chr(10),encoding='utf-8')`]);
}
const certified=await json(folder+'certified-runtime-913a4635.json');for(const f of certified.files)assert.equal(hash(await fs.readFile(dir+f.file)),f.sha256);
const manifest=await json(prefix+version+'.manifest.json'),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);assert.equal(hash(bytes),manifest.archive.sha256);assert.deepEqual(Object.keys(zip).sort(),prior.files.map(f=>f.file).sort());for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete old.version;assert.deepEqual(m,old);
for(const f of [...certified.files.map(f=>dir+f.file),'src/views/class-import-center.js'])execFileSync(process.execPath,['--check',f]);execFileSync('git',['diff','--check']);
if(!process.argv.includes('--prepare')){const download=await json(folder+'download.json');assert.equal(download.status,'PASS');assert.equal(download.actualDownloadHashMatched,true);assert.equal(download.archiveSha256,manifest.archive.sha256);}
const result={status:'PASS',taskId:actual.taskId,runId:actual.runId,baseSha,version,archive:manifest.archive,files:manifest.files.length,packageSourceParity:true,chosenRenderedSourceParity:true,previousArchivesAndReceipts:'unchanged',permissionsAndCSP:'unchanged',publication:'NOT_RUN; independent publisher',wholeN36Acceptance:'OPEN; explicit PO import required'};await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
