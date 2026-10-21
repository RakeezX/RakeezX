// AI: package only after actual-app recovery and fail-closed controls; no publishing.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {sourceCoverage} from '../../extensions/rakeez-teacher-import-helper/source-roster.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const baseSha='0bca7554e60adca6b19ad804e4370874d9f5676b',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.35',folder='tests/n36-1018-unsafe-setup-partial-20261021/';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=async n=>JSON.parse(await fs.readFile(folder+n+'.json','utf8'));
const baseline=await read('baseline-0534');
assert.equal(baseline.status,'PASS');assert.equal(baseline.archiveIdentity.sha256,'70ed0905ed3a04ccdbb7872daf4d0fd5f56071d56ebe85af9e9db68f77f23ffd');
assert.equal(baseline.cases.length,5);
for(const c of baseline.cases){assert.equal(c.view.code,'UNSAFE_SETUP_LINK');assert.equal(c.view.staged,303);assert.equal(c.view.observed,303);assert.equal(c.view.schoolBindingState,'bound');assert.equal(c.deliveries,0);assert.deepEqual(c.receipts,[]);}
const labels=['candidate-classes-final','candidate-timetable-final','serial-metadata','negative-after-final','negative-before-between','serial-critical','serial-unknown-receipt','strict-anchor-controls','safe-setup','serial-large'];
const results=await Promise.all(labels.map(read));
const fingerprint=results[0].runtimeFingerprint;
for(const r of results){
 assert.equal(r.status,'PASS');assert.equal(r.runtimeFingerprint,fingerprint,'Same complete runtime, before metadata-only packaging');assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);
 for(const c of r.cases){assert.equal(c.status,'PASS');assert.equal(c.navigation,0);if(c.view.phase==='complete'){assert.equal(c.view.staged,303);assert.equal(c.view.observed,303);assert.deepEqual(c.receipts.map(r=>r.total),[300,3]);assert.equal(c.deliveries,2);if(c.view.setupPartial)assert.equal(c.warningVisible,true);}else if(c.honestReceipt){assert.equal(c.view.code,'RECEIPT_UNKNOWN');assert.equal(c.deliveries,1);assert.deepEqual(c.honestReceipt,{confirmedByWorker:0,actuallySaved:300,noSecondTransfer:true});}else{assert.equal(c.view.phase,'stopped');assert.equal(c.deliveries,0);assert.deepEqual(c.receipts,[]);}}
}
const reimport=results[labels.indexOf('strict-anchor-controls')].cases.find(c=>c.reimport).reimport;
assert.deepEqual(reimport,{added:0,existing:303,totals:[300,3],statuses:['existing','existing'],studentRecordsUnchanged:true});
const large=results.at(-1);assert.equal(large.model.tiles,640);assert.equal(large.model.scriptDelayMs,100);assert.equal(large.model.styleCostMs,0);assert.ok(large.cases[0].metrics.wallMs<90000);assert.ok(large.cases[0].metrics.pendingReadProofs>=1);
// Existing student coverage is independent of every optional setup category.
for(const state of ['complete','partial','unknown']){
 const series=state==='unknown'?new Map():new Map([['synthetic',{total:1,pages:new Set([1]),terminal:state==='complete',gap:false}]]);
 const prior=sourceCoverage({series});assert.equal(prior.coverage,state);
 for(const category of ['metadata','classes','timetable'])assert.deepEqual(sourceCoverage({series,warnings:[{category,code:'SETUP_FIELDS_UNAVAILABLE'}]}),prior);
}
const oldManifest=JSON.parse(await fs.readFile(prefix+'0.5.34.manifest.json','utf8'));
// Bind evidence to all executable/HTML/CSS files before metadata changes.
const certified=[];for(const f of oldManifest.files)certified.push({file:f.file,sha256:hash(await fs.readFile(dir+f.file))});
const runtimeHash=createHash('sha256');
for(const name of oldManifest.files.map(f=>f.file).sort()){runtimeHash.update(name);runtimeHash.update(await fs.readFile(dir+name));}
if(process.argv.includes('--prepare')){
 assert.equal(runtimeHash.digest('hex'),fingerprint);
 const manifestText=await fs.readFile(dir+'manifest.json','utf8');assert.ok(manifestText.includes('"version": "0.5.34"'));
 await fs.writeFile(dir+'manifest.json',manifestText.replace('"version": "0.5.34"','"version": "0.5.35"'));
 const notes='AI — 0.5.35: classified optional setup rejection no longer discards a roster verified by the actual student report and explicit school/SchoolId. Unsafe/absent setup anchors never receive GET; inert base responses provide no setup fields. Teacher/document and receiver owner/session/batch guards retain priority, including between checks. The popup visibly separates partial setup fields from student-page coverage; fixed setupKind/setupRejectReason diagnostics contain no source data. Rejected classes are not presented as saved setup. The 90s/8s bounds, source memory/page caps, 300-row envelopes and idempotent receiver remain unchanged. Synthetic HTTP proof only; actual 0.5.34 setup kind/subreason are unknown. Production and stable installed 29-file parity belong to the independent publisher; actual portal acceptance remains pending.\n\n';
 await fs.writeFile(dir+'README.md',notes+await fs.readFile(dir+'README.md','utf8'));
 const view='src/views/class-import-center.js',text=await fs.readFile(view,'utf8'),oldLink='<a class="btn btn--primary" href="/assets/extensions/rakeez-teacher-import-helper-0.5.34.zip" download>تنزيل إضافة ركيز 0.5.34</a>';
 assert.equal(text.split(oldLink).length,2);await fs.writeFile(view,text.replace(oldLink,oldLink.replaceAll('0.5.34',version)));
 await fs.writeFile(folder+'certified-runtime.json',JSON.stringify({runtimeFingerprint:fingerprint,files:certified,metadataOnlyAfterProof:['manifest.json','README.md']},null,2)+'\n');
 execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.34.manifest.json').read_text(encoding='utf-8'))
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
const certificate=await read('certified-runtime');
for(const f of certificate.files)if(!['manifest.json','README.md'].includes(f.file))assert.equal(hash(await fs.readFile(dir+f.file)),f.sha256,f.file);
const manifest=JSON.parse(await fs.readFile(prefix+version+'.manifest.json','utf8')),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);
assert.equal(manifest.files.length,29);assert.deepEqual(manifest.files.map(f=>f.file),oldManifest.files.map(f=>f.file));assert.equal(hash(bytes),manifest.archive.sha256);assert.equal(bytes.length,manifest.archive.bytes);
assert.deepEqual(Object.keys(zip).sort(),manifest.files.map(f=>f.file).sort());
for(const f of manifest.files){assert.equal(hash(zip[f.file]),f.sha256);assert.equal(zip[f.file].length,f.bytes);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const m=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(m));assert.equal(m.version,version);delete m.version;delete old.version;assert.deepEqual(m,old);
const view='src/views/class-import-center.js',before=execFileSync('git',['show',baseSha+':'+view],{encoding:'utf8'}).replaceAll('\r\n','\n'),current=(await fs.readFile(view,'utf8')).replaceAll('\r\n','\n');
assert.equal(current,before.replaceAll('rakeez-teacher-import-helper-0.5.34.zip','rakeez-teacher-import-helper-0.5.35.zip').replace('تنزيل إضافة ركيز 0.5.34','تنزيل إضافة ركيز 0.5.35'));
const historical=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n').filter(p=>/rakeez-teacher-import-helper-[0-9.]+\.(zip|manifest\.json)$/.test(p));
execFileSync('git',['diff','--exit-code',baseSha,'--',...historical]);
execFileSync('git',['diff','--exit-code',baseSha,'--',...['handoff-worker.js','handoff-protocol.js','source-roster.js','selection.js','route-diagnostics.js','navigation.js','categories.js','class-order.js','lib'].map(n=>dir+n),'src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','src/store.js','sw.js']);
for(const p of [view,...['source-adapter.js','background-runner.js','run-controller.js','diagnostics-bootstrap.js'].map(f=>dir+f)])execFileSync(process.execPath,['--check',p]);
execFileSync('git',['diff','--check']);
const result={status:'PASS',version,baseSha,runtimeFiles:29,archive:manifest.archive,runtimeFingerprint:fingerprint,inputs:labels,checks:['Immutable .34 reproduction','Actual app 303 rows / 300+3 receipts and independent coverage','Before/after/between identity denials','Unknown receipt is honest; reimport existing with unchanged student records','Strict non-GET/download/disabled/form rejection','Exact ZIP/source/29-file SHA256 parity','Version-only manifest permissions/CSP; exact app link change','Protected receiver/owner/store/coverage/caps and old archives unchanged','Affected JS syntax and diff check'],production:'NOT_RUN',installedStableParity:'NOT_RUN',actualPortalAcceptance:'PENDING'};
await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
