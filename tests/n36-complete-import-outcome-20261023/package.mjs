// AI-authored: certify the selected bounded app evidence, then package once via the existing 29-file path.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {sourceSchoolIdentity,sourceSchoolDepartmentFallback} from '../../src/lib/teacher-setup-import.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='4ee4608c3a043f8ff27fd1c90d0ba652bc7e558b',folder='tests/n36-complete-import-outcome-20261023/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.38';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const selection={'legacy-and-final-receipts':['legacy','restart'],'populated-final':['populated'],candidate:['fresh'],'display-permissions':['permissions','same','conflict','label'],'final-coverage-restart':['gap','unknown','no-subject'],'coverage-bounded':['excluded','ambiguous'],'negative-links':['nonget-before','download-before','disabled-before','form-before','duplicate-before','different-before','base-before','contract-before'],'negative-identity':['event-before','response-missing-before','response-conflict-before','response-teacher-before','response-schoolid-before','pending-school-drift-before','pending-teacher-drift-before','pending-document-drift-before'],'pending-owner-session':['pending-owner-drift-late','pending-session-drift-late'],'entry-guards':['foreign','owner-race','term-drift','unknown']};
let selectedCases=0;for(const [file,names] of Object.entries(selection)){const r=await json(folder+file+'.json');assert.equal(r.resources.serverClosed,true,file);assert.equal(r.resources.isolatedBrowserFinally,true,file);for(const name of names){const c=r.cases.find(c=>(c.scenario??c.mode)===name);assert.equal(c?.status,'PASS',file+':'+name);selectedCases++;}}
const baseline=await json(folder+'baseline.json'),fresh=baseline.cases.find(c=>c.scenario==='fresh');assert.equal(fresh.status,'OBSERVED');assert.equal(fresh.view.confirmedRows,0);assert.equal(fresh.view.confirmedReceipts,0);assert.equal(fresh.view.setupRejectReason,'live-link-event');assert.equal(fresh.durable.students,302);assert.equal(fresh.durable.receipts.length,10);assert.equal(fresh.durable.receipts.reduce((n,v)=>n+v,0),302);assert.equal(fresh.durable.slots,0);
const current=await json(folder+'candidate.json'),journey=current.cases.find(c=>c.scenario==='fresh');assert.equal(journey.view.confirmedRows,302);assert.equal(journey.view.confirmedReceipts,10);assert.equal(journey.repeat.added,0);assert.equal(journey.repeat.existing,302);
const department='الإدارة العامة للتعليم بمنطقة مكة المكرمة';
assert.deepEqual(await sourceSchoolIdentity('ابن الجوزي الابتدائية بمكة المكرمة'),{displayName:'ابن الجوزي الابتدائية',department});
for(const name of ['مدرسة مكة المكرمة','مدرسة بمكة المكرمة النموذجية','مدرسة بالرياض بمكة المكرمة'])assert.deepEqual(await sourceSchoolIdentity(name),{displayName:name,department:null});
assert.equal(await sourceSchoolDepartmentFallback('ابن الجوزي الابتدائية بمكة المكرمة',department),null);
const protectedPaths=['src/store.js','src/lib/n36-extension-protocol.js','src/lib/n36-extension-handoff.js','sw.js',...['handoff-worker.js','handoff-protocol.js','route-diagnostics.js','navigation.js','categories.js','class-order.js'].map(f=>dir+f)];
execFileSync('git',['diff','--exit-code',baseSha,'--',...protectedPaths]);
const prior=await json(prefix+'0.5.37.manifest.json'),app='src/views/class-import-center.js';
if(process.argv.includes('--prepare')){
 await assert.rejects(fs.access(prefix+version+'.zip'));
 const files=[];for(const f of prior.files)files.push({file:f.file,sha256:hash(await fs.readFile(dir+f.file))});
 await fs.writeFile(folder+'certified-runtime.json',JSON.stringify({baseSha,selection,selectedCases,files,appHash:hash(await fs.readFile(app)),teacherSetupHash:hash(await fs.readFile('src/lib/teacher-setup-import.js')),metadataOnlyAfterProof:['manifest.json','README.md','app download href/version label']},null,2)+'\n');
 const manifest=await fs.readFile(dir+'manifest.json','utf8');assert.ok(manifest.includes('"version": "0.5.37"'));await fs.writeFile(dir+'manifest.json',manifest.replace('"version": "0.5.37"','"version": "0.5.38"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.38 (23 October 2026): current-run exact acknowledged receipt totals survive popup reopen and worker restart; completed .37 cached sums are read without inventing the discarded receipt count; bounded structural roster reasons remain separate from optional setup. The exact observed visible same-origin SchoolSchedule/Schedule/TeacherSchedule GET with its sole matching SchoolId may carry inert event attribute names: their values/properties are never read or executed. All other identity/URL/response/size/timeout/unsafe-context gates remain. Raw school stays bound; requested display suffix is split using only the existing directory, with labelled department precedence and honest current/conflict handling. Supported synthetic fresh provisioning and populated-account setup completion persist class-subject links, slots and names, with 302 rows/10 handoffs and duplicate-free repeat. Actual portal event name/response and real-account/cloud acceptance are NOT verified; historical .35 remains distinct. Permissions, CSP, receiver schema, 300-row handoffs and calendar behavior are unchanged. See docs/automation-evidence/20261023/N36_COMPLETE_IMPORT_OUTCOME.md for threat argument, selected proofs and limits. Sole publisher owns integration/Production.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const source=await fs.readFile(app,'utf8');assert.equal(source.split('rakeez-teacher-import-helper-0.5.37.zip').length,2);await fs.writeFile(app,source.replace('rakeez-teacher-import-helper-0.5.37.zip','rakeez-teacher-import-helper-0.5.38.zip').replace('تنزيل إضافة ركيز 0.5.37','تنزيل إضافة ركيز 0.5.38'));
 execFileSync('python',['-c',`import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.37.manifest.json').read_text(encoding='utf-8'))
archive=Path('${prefix}${version}.zip')
assert not archive.exists()
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
assert.equal(hash(await fs.readFile('src/lib/teacher-setup-import.js')),certificate.teacherSetupHash);
const appSource=(await fs.readFile(app,'utf8')).replace('rakeez-teacher-import-helper-0.5.38.zip','rakeez-teacher-import-helper-0.5.37.zip').replace('تنزيل إضافة ركيز 0.5.38','تنزيل إضافة ركيز 0.5.37');assert.equal(hash(appSource),certificate.appHash);
const manifest=await json(prefix+version+'.manifest.json'),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);assert.equal(manifest.files.length,29);assert.deepEqual(manifest.files.map(f=>f.file),prior.files.map(f=>f.file));assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete old.version;assert.deepEqual(m,old);
const historical=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n');execFileSync('git',['diff','--exit-code',baseSha,'--',...historical]);
for(const f of [...prior.files.filter(f=>f.file.endsWith('.js')).map(f=>dir+f.file),app,'src/lib/teacher-setup-import.js'])execFileSync(process.execPath,['--check',f]);execFileSync('git',['diff','--check']);
const result={status:'PASS',baseSha,version,selectedCases,selection,archive:manifest.archive,files:29,permissionsAndCSP:'unchanged',receiverAnd300RowBound:'unchanged',shellDependencies:'no new dependency; existing lazy directory import reused; sw.js unchanged',production:'NOT_RUN; independent publisher',actualAccountAcceptance:'NOT_RUN; actual source event/response unknown; no historical nonce/cloud reconciliation'};await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
