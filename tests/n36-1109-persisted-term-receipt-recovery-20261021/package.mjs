// AI-authored: certify only affected checks, then package the frozen tested runtime. No publishing.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
import {approvedPackageBoundary} from '../../../../scripts/ops-supervisor-v4/n36-extension-package-policy.mjs';
const folder='tests/n36-1109-persisted-term-receipt-recovery-20261021/',dir='extensions/rakeez-teacher-import-helper/',prefix='assets/extensions/rakeez-teacher-import-helper-',version='0.5.36',baseSha='f3f4fe4c074881e5eac9a4a767cb1140d023be32';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=async n=>JSON.parse(await fs.readFile(folder+n+'.json','utf8'));
const baseline=await read('baseline-certified');assert.equal(baseline.status,'PASS');assert.equal(baseline.cases.length,6);assert.equal(baseline.archiveIdentity.sha256,'025fb2a896fb6027789575c0cd35ff4cfd9e3740b55137b81e7880a79ea71aef');
for(const c of baseline.cases){assert.equal(c.view.phase,'receipt');assert.equal(c.view.staged,303);assert.equal(c.view.schoolBindingState,'bound');assert.equal(c.view.setupRejectReason,'live-link-unsafe');assert.equal(c.receipts.at(-1).status,'unknown');}
const selections={
 'certified-prospective-and-start':['missing-year','missing-term','deleted-year','deleted-term','optimistic','multiclass','existing','ambiguous','ambiguous-year','disk-ambiguous','conflicting-year','foreign-term','foreign-term-disk','persistent-start','new-selection'],
 'certified-receiver-and-isolation':['cross-tab','after-chunk','transaction-drift','owner','session','lease','document','saved-before-receipt','readback-unknown','fallback-ambiguous-at-write','after-owner','after-session','after-lease','after-document'],
 'denied-saved-receipt-control':['denied-saved-receipt']
};
const accepted=[],inputs={};let fingerprint,applicationFiles;
for(const [name,scenarios] of Object.entries(selections)){
 const r=await read(name);fingerprint??=r.runtimeFingerprint;applicationFiles??=r.applicationFiles;
 assert.equal(r.runtimeFingerprint,fingerprint);assert.deepEqual(r.applicationFiles,applicationFiles);assert.equal(r.resources.serverClosed,true);assert.equal(r.resources.isolatedBrowserFinally,true);
 inputs[name]={fileStatus:r.status,acceptedScenarios:scenarios,failedScenariosRetained:r.cases.filter(c=>c.status==='FAIL').map(c=>c.scenario)};
 for(const scenario of scenarios){const c=r.cases.find(c=>c.scenario===scenario);assert.equal(c?.status,'PASS',name+':'+scenario);assert.equal(c.unsafeGETs,0);assert.ok(c.selectedTermUnchanged||['persistent-start','new-selection'].includes(scenario));accepted.push(c);}
}
assert.equal(accepted.length,30);
const certificatePath=folder+'certified-runtime.json';
if(process.argv.includes('--prepare')){
 const h=createHash('sha256'),old=JSON.parse(await fs.readFile(prefix+'0.5.35.manifest.json','utf8')),files=[];
 for(const f of old.files.map(f=>f.file).sort()){const b=await fs.readFile(dir+f);h.update(f);h.update(b);files.push({file:f,sha256:hash(b)});}
 assert.equal(h.digest('hex'),fingerprint);
 for(const [p,digest] of Object.entries(applicationFiles))assert.equal(hash(await fs.readFile(p)),digest,p);
 await fs.writeFile(certificatePath,JSON.stringify({runtimeFingerprint:fingerprint,applicationFiles,files,metadataOnlyAfterProof:['manifest.json','README.md','app package href/version label']},null,2)+'\n');
 const m=await fs.readFile(dir+'manifest.json','utf8');assert.ok(m.includes('"version": "0.5.35"'));await fs.writeFile(dir+'manifest.json',m.replace('"version": "0.5.35"','"version": "0.5.36"'));
 await fs.writeFile(dir+'README.md','AI — 0.5.36: future explicit Starts qualify the durable academic context before any source collection. A unique coherent missing/deleted raw selection is read through only inside guarded transactions; ambiguous contexts require an explicit year/term selection. A bounded same-tab optimistic settlement must match the original selection and write stamp. Durable different selections and owner/session/document/lease drift deny writes. Saved/current receipts require authoritative roster identities and durable readback. Local progress is counts only: the app never replays an uncertain pending write or manufactures a new nonce. Unknown extension jobs remain unknown, including expired 0.5.35 jobs. This package cannot retroactively acknowledge the PO batch. Do not reload an unresolved extension job or recrawl its source. New package for future jobs only. Production/stable installation/actual PO acceptance remain pending with the independent publisher and PO.\n\n'+await fs.readFile(dir+'README.md','utf8'));
 const p='src/views/class-import-center.js',text=await fs.readFile(p,'utf8');assert.equal(text.split('rakeez-teacher-import-helper-0.5.35.zip').length,2);await fs.writeFile(p,text.replace('rakeez-teacher-import-helper-0.5.35.zip','rakeez-teacher-import-helper-0.5.36.zip').replace('تنزيل إضافة ركيز 0.5.35','تنزيل إضافة ركيز 0.5.36'));
 execFileSync('python',['-c',`
import json,hashlib,zipfile
from pathlib import Path
old=json.loads(Path('${prefix}0.5.35.manifest.json').read_text(encoding='utf-8'))
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
const certificate=JSON.parse(await fs.readFile(certificatePath,'utf8'));
for(const f of certificate.files)if(!['manifest.json','README.md'].includes(f.file))assert.equal(hash(await fs.readFile(dir+f.file)),f.sha256,f.file);
for(const [p,digest] of Object.entries(certificate.applicationFiles)){
 let b=await fs.readFile(p);if(p.endsWith('class-import-center.js'))b=Buffer.from(b.toString().replace('rakeez-teacher-import-helper-0.5.36.zip','rakeez-teacher-import-helper-0.5.35.zip').replace('تنزيل إضافة ركيز 0.5.36','تنزيل إضافة ركيز 0.5.35'));
 assert.equal(hash(b),digest,p);
}
const m=JSON.parse(await fs.readFile(prefix+version+'.manifest.json','utf8')),bytes=await fs.readFile(prefix+version+'.zip'),zip=unzipSync(bytes);
assert.equal(m.files.length,29);assert.equal(hash(bytes),m.archive.sha256);assert.equal(bytes.length,m.archive.bytes);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
for(const f of m.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
const manifest=JSON.parse(Buffer.from(zip['manifest.json'])),oldManifest=JSON.parse(execFileSync('git',['show',baseSha+':'+dir+'manifest.json'],{encoding:'utf8'}));assert.ok(approvedPackageBoundary(manifest));assert.equal(manifest.version,version);delete manifest.version;delete oldManifest.version;assert.deepEqual(manifest,oldManifest);
const protectedPaths=['src/store.js','src/lib/db.js','src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js','sw.js',...['source-adapter.js','source-roster.js','handoff-protocol.js','background-collector.js','class-order.js','navigation.js','selection.js','core.js','lib'].map(f=>dir+f)];
execFileSync('git',['diff','--exit-code',baseSha,'--',...protectedPaths]);
const archives=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','assets/extensions'],{encoding:'utf8'}).trim().split('\n');execFileSync('git',['diff','--exit-code',baseSha,'--',...archives]);
for(const p of ['src/views/class-import-center.js',...['handoff-worker.js','background-runner.js','run-controller.js','diagnostics-bootstrap.js'].map(f=>dir+f)])execFileSync(process.execPath,['--check',p]);
execFileSync('git',['diff','--check']);
const result={status:'PASS',version,baseSha,archive:m.archive,files:29,baselineCases:6,acceptedCases:accepted.length,inputs,checks:['Immutable public .35 receipt uncertainty at independent boundaries','Unique missing/deleted fallback and real patchDevice delayed write settle before collection','Exact saved/current 303 receipts, 300-row cap, per-class ordering and 4-class fixture','Ambiguity/persistent/new selection stop before source GET','Owner/session/lease/document/selection deny before and inside student transaction; earlier receipts retained','Same batch/nonce read-only progress, no recollection/replay, expired/different-document denial','Bounded diagnostics, actual popup/app DOM and unchanged safe source/time/Sync guards','Exact 29-file ZIP/source SHA256 parity; unchanged permissions/CSP and old packages','Affected syntax and diff checks'],production:'NOT_RUN',installedStableParity:'NOT_RUN',actualPOBatch:'UNRESOLVED_NOT_INSPECTED'};
await fs.writeFile(folder+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
