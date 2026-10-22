// AI: package only a certified source-visible GET candidate; no live operations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const folder='tests/n36-1255-visible-timetable-get-20261021/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.37',baseSha='ed42bc472b009fae04eb34ddd1f23f8fed81df1e';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=async n=>JSON.parse(await fs.readFile(folder+n+'.json','utf8'));
const selection=JSON.parse(await fs.readFile(folder+'evidence-selection.json','utf8'));
const baseline=await read('baseline-0536');assert.equal(baseline.status,'PASS');assert.equal(baseline.archiveIdentity.sha256,'1a2a4d1f70e27a30f262b176c65c22e8d412e5ff8d6cede1ee7d073ced21b46f');
assert.equal(baseline.cases.length,2);
for(const c of baseline.cases){assert.equal(c.view.setupRejectReason,'live-link-unsafe');assert.ok(c.fetches.some(f=>f.kind==='timetable'));assert.equal(c.unsafeGETs,0);assert.deepEqual(c.durableReceiptTotals,[300,3]);for(const r of c.receipts)assert.ok(r.fields.some(f=>f.field==='timetable'&&f.reason==='missing'));}
let fingerprint;const cases=[];
for(const [file,names] of Object.entries(selection)){
 const r=await read(file);fingerprint??=r.runtimeFingerprint;assert.equal(r.runtimeFingerprint,fingerprint);assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);
 for(const name of names){const c=r.cases.find(c=>c.mode===name);assert.equal(c?.status,'PASS',file+':'+name);assert.equal(c.navigation,0);assert.equal(c.unsafeGETs,0);cases.push({file,...c});}
}
for(const name of ['onclick-before','onclick-after']){const c=cases.find(c=>c.mode===name&&c.storedSetupVerified);assert.ok(c);assert.deepEqual(c.durableReceiptTotals,[300,3]);assert.equal(c.handlerReads,0);assert.equal(c.timetableGETs,1);for(const r of c.receipts)for(const field of ['teacher','principal','school','classes','timetable'])assert.ok(r.fields.some(f=>f.field===field&&['saved','current'].includes(f.reason)));}
const unknown=cases.find(c=>c.honestReceipt);assert.ok(unknown);assert.equal(unknown.deliveries,1);assert.equal(unknown.view.code,'RECEIPT_UNKNOWN');
for(const c of cases.filter(c=>c.view.phase==='stopped')){assert.equal(c.deliveries,0);assert.deepEqual(c.receipts,[]);}
const contract=cases.find(c=>c.contractDenials);assert.equal(contract.contractDenials.length,10);for(const c of contract.contractDenials)assert.equal(c.code,c.expected);
assert.ok(cases.some(c=>c.reimport?.studentRecordsUnchanged));
const documentCase=cases.find(c=>c.mode==='pending-document-drift-before');assert.ok(documentCase.documentTargetDenials>0);assert.equal(documentCase.noTimetableGETAfterDrift,true);const large=await read('bounded-polling-large');assert.equal(large.model.tiles,640);assert.equal(large.model.scriptDelayMs,100);assert.ok(large.cases[0].metrics.pendingReadProofs>=1);assert.ok(large.cases[0].metrics.modeledMs<90000);
const diagnostics=await read('diagnostics');assert.equal(diagnostics.status,'PASS');assert.equal(diagnostics.kindReasonPairs.length,27);
const old=JSON.parse(await fs.readFile(prefix+'0.5.36.manifest.json','utf8'));
const runtimeHash=createHash('sha256');for(const name of old.files.map(f=>f.file).sort()){runtimeHash.update(name);runtimeHash.update(await fs.readFile(dir+name));}
if(process.argv.includes('--prepare')){
 assert.equal(runtimeHash.digest('hex'),fingerprint);
 const certified=[];for(const f of old.files)certified.push({file:f.file,sha256:hash(await fs.readFile(dir+f.file))});
 await fs.writeFile(folder+'certified-runtime.json',JSON.stringify({runtimeFingerprint:fingerprint,files:certified,metadataOnlyAfterProof:['manifest.json','README.md']},null,2)+'\n');
 const m=await fs.readFile(dir+'manifest.json','utf8');assert.ok(m.includes('"version": "0.5.36"'));await fs.writeFile(dir+'manifest.json',m.replace('"version": "0.5.36"','"version": "0.5.37"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.37: a single visible, already observed, route-approved timetable GET anchor may carry only an inert onclick attribute. The reader inspects attribute names only: no handler value, invocation, click, iframe or source navigation. Other event attributes, mixed duplicates, unsafe contexts and unobserved links fail closed with fixed safe diagnostic categories. Document/teacher/school and receiver owner/session/batch guards, redirect refusal, inert parsing and 8s/2MB/90s bounds remain. A timetable response requires the matching explicit school. Synthetic full-runtime proof includes 303 students, durable 300+3 saved/current receipts and supported setup fields. The actual .35 batch remains unresolved and untouched; this does not establish its live-link-unsafe subtype or request a repeat import. Production/stable 29-file parity belongs to the sole publisher; actual portal acceptance remains pending.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const p='src/views/class-import-center.js',s=await fs.readFile(p,'utf8');assert.equal(s.split('rakeez-teacher-import-helper-0.5.36.zip').length,2);await fs.writeFile(p,s.replace('rakeez-teacher-import-helper-0.5.36.zip','rakeez-teacher-import-helper-0.5.37.zip').replace('تنزيل إضافة ركيز 0.5.36','تنزيل إضافة ركيز 0.5.37'));
 execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.36.manifest.json').read_text(encoding='utf-8'))
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
}
const certificate=await read('certified-runtime');assert.equal(certificate.runtimeFingerprint,fingerprint);
for(const f of certificate.files)if(!['manifest.json','README.md'].includes(f.file))assert.equal(hash(await fs.readFile(dir+f.file)),f.sha256,f.file);
const manifest=JSON.parse(await fs.readFile(prefix+version+'.manifest.json','utf8')),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);
assert.equal(manifest.files.length,29);assert.deepEqual(manifest.files.map(f=>f.file),old.files.map(f=>f.file));assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.equal(zip[f.file].length,f.bytes);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),prior=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete prior.version;assert.deepEqual(m,prior);
const view='src/views/class-import-center.js',before=execFileSync('git',['show',baseSha+':'+view],{encoding:'utf8'}).replaceAll('\r\n','\n'),current=(await fs.readFile(view,'utf8')).replaceAll('\r\n','\n');assert.equal(current,before.replace('rakeez-teacher-import-helper-0.5.36.zip','rakeez-teacher-import-helper-0.5.37.zip').replace('تنزيل إضافة ركيز 0.5.36','تنزيل إضافة ركيز 0.5.37'));
const historical=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n');execFileSync('git',['diff','--exit-code',baseSha,'--',...historical]);
execFileSync('git',['diff','--exit-code',baseSha,'--',...['handoff-worker.js','handoff-protocol.js','source-roster.js','selection.js','route-diagnostics.js','navigation.js','categories.js','class-order.js','lib','run-controller.js'].map(n=>dir+n),'src/lib','src/store.js','src/models.js','sw.js']);
for(const name of ['background-runner.js','diagnostics-bootstrap.js']){const original=execFileSync('git',['show',baseSha+':'+dir+name],{encoding:'utf8'}).replaceAll('\r\n','\n'),actual=(await fs.readFile(dir+name,'utf8')).replaceAll('\r\n','\n');assert.equal(actual,original.replace("'live-link-unsafe','response-base'","'live-link-unsafe','live-link-event','live-link-context','live-link-download','live-link-method','live-link-duplicate','response-base'"),'Only fixed diagnostic allowlist changed');}
for(const p of [view,...['source-adapter.js','background-runner.js','diagnostics-bootstrap.js'].map(f=>dir+f)])execFileSync(process.execPath,['--check',p]);execFileSync('git',['diff','--check']);
const result={status:'PASS',version,baseSha,baselineCases:2,candidateCases:cases.length,archive:manifest.archive,runtimeFingerprint:fingerprint,selection,originalFailuresPreserved:['anchor-controls.json','identity-before.json','response-controls.json','pending-identity.json','handler-and-pending-final.json'],production:'NOT_RUN; sole publisher',installedStableParity:'NOT_RUN; sole publisher',actualPortalAcceptance:'PENDING',actual0535Batch:'Unknown; no read/write/replay'};
await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
