// AI: scoped boundary/security checks and reproducible exact-byte package, no service access.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {validateCategory,parseCategoryTable,bundle} from '../extensions/rakeez-teacher-import-helper/categories.js';
import {mergePage,RUN_LIMITS,safeRoute,startOrigin} from '../extensions/rakeez-teacher-import-helper/navigation.js';
import {validateHandoff,HANDOFF_TTL} from '../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {namesCsv} from '../extensions/rakeez-teacher-import-helper/core.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',base='8714bef9f047a5169a5c4ca3eb0d9ef6e3b08199',hash=b=>createHash('sha256').update(b).digest('hex');
const word=n=>String.fromCharCode(0x620+Math.floor(n/25))+String.fromCharCode(0x620+n%25);
const rows=n=>Array.from({length:n},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:i%2?'خامس ألف':'خامس باء'}));
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.2.manifest.json','utf8'));
 execFileSync('python',['-c',`import zipfile,json,pathlib; m=json.loads(pathlib.Path('${assets}rakeez-teacher-import-helper-0.5.2.manifest.json').read_text()); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.3.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(f['file'],pathlib.Path('${dir}'+f['file']).read_bytes())) for f in m['files']]; z.close()`]);
 const files=await Promise.all(old.files.map(async f=>{const b=await fs.readFile(dir+f.file);return {file:f.file,sha256:hash(b),bytes:b.length};}));
 const file='rakeez-teacher-import-helper-0.5.3.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.3.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.3',applicationBaseSha:base,officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
test('299/300 accepted; 301/350 rejected independently of 600 bundle cap; empty has distinct cause',()=>{
 for(const n of [299,300]){const r=rows(n);assert.equal(validateCategory('students',r).length,n);assert.equal(parseCategoryTable('students','اسم الطالب\tالفصل\n'+r.map(v=>v.name+'\t'+v.classroom).join('\n')).length,n);}
 for(const n of [301,350]){assert.throws(()=>validateCategory('students',rows(n)),/CATEGORY_ROW_LIMIT/);assert.throws(()=>parseCategoryTable('students','اسم الطالب\tالفصل\n'+rows(n).map(v=>v.name+'\t'+v.classroom).join('\n')),/LIMIT/);}
 assert.throws(()=>validateCategory('students',[]),/EMPTY_CATEGORY/);assert.equal(RUN_LIMITS.rows,600);
 const now=Date.now();const envelope={schema:'rakeez-extension-names',version:1,source:'madrasati',scope:'reviewed-run',createdAt:now,expiresAt:now+HANDOFF_TTL,rows:rows(300)};
 assert.equal(validateHandoff(envelope).rows.length,300);assert.throws(()=>validateHandoff({...envelope,rows:rows(301)}));
});
test('50/page accumulator does not mutate prior 300 on rejected overflow; normalized identity collision blocked',()=>{
 let staged=[];const r=rows(350);for(let i=0;i<300;i+=50){staged=mergePage(staged,'students',r.slice(i,i+50));bundle(staged);}
 const next=mergePage(staged,'students',r.slice(300));assert.throws(()=>bundle(next),/CATEGORY_ROW_LIMIT/);assert.equal(staged[0].rows.length,300);
 assert.throws(()=>validateCategory('students',[rows(1)[0],{...rows(1)[0],name:rows(1)[0].name+'ـ'}]),/DUPLICATE/);
});
test('HTML/CSV/JSON formulas, unexpected category/field, URL/origin/context rejected',()=>{
 for(const value of ['=SUM(A1)','+cmd','-cmd','@cmd','<img onerror=alert(1)>','طالب\n=cmd','طالب 123']){
 assert.throws(()=>validateCategory('students',[{name:value,classroom:'خامس ألف'}]));assert.throws(()=>namesCsv([value]));}
 assert.throws(()=>validateCategory('grades',rows(1)));assert.throws(()=>validateCategory('students',[{...rows(1)[0],phone:'PRIVATE'}]));
 assert.throws(()=>startOrigin('https://untrusted.invalid/Dashboards/Schools'));assert.throws(()=>safeRoute('https://schools.madrasati.sa','https://untrusted.invalid/SchoolManagment/Actions/MyStudents'));
 assert.throws(()=>safeRoute('https://schools.madrasati.sa','/SchoolManagment/Actions/MyStudents?SchoolId='+'b'.repeat(32),{schoolId:'a'.repeat(32)}));
});
test('0.5.3 exact ZIP/manifests/checkouts; both published rollback versions immutable; permissions unchanged',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.3.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);
 assert.equal(m.applicationBaseSha,base);assert.equal(hash(b),m.archive.sha256);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){const data=Buffer.from(zip[f.file]);assert.equal(hash(data),f.sha256);assert.equal(data.length,f.bytes);assert.deepEqual(data,await fs.readFile(dir+f.file));}
 for(const v of ['0.5.1','0.5.2'])for(const ext of ['zip','manifest.json']){const f=assets+'rakeez-teacher-import-helper-'+v+'.'+ext;assert.deepEqual(await fs.readFile(f),execFileSync('git',['show',base+':'+f]));}
 const manifest=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json']));assert.equal(manifest.version,'0.5.3');manifest.version=old.version;assert.deepEqual(manifest,old);
 const view=await fs.readFile('src/views/class-import-center.js','utf8');assert.equal((view.match(/href="\/assets\/extensions\/rakeez-teacher-import-helper-0.5.3.zip"/g)||[]).length,1);
});

test('saved corrected browser acceptance is source-bound; original fixture failures remain historical',async()=>{
 const evidence=JSON.parse(await fs.readFile('tests/n36-300-then-zero-browser.json','utf8'));
 assert.equal(evidence.status,'PASS');assert.deepEqual(evidence.externalRequests,[]);assert.deepEqual(evidence.errors,[]);
 assert.equal(evidence.release,'RELEASED browser');
 const expected=['full299','full300','overflow301','overflow350','missingLast','missingPage','repeat','duplicate','ambiguous','empty','schoolChanged','roleChanged','originChanged','sessionChanged','selfKnown'];
 assert.deepEqual(evidence.scenarios.map(s=>s.scenario).sort(),expected.sort());
 for(const scenario of evidence.scenarios)assert.equal(scenario.transferAllowed,['full299','full300','selfKnown'].includes(scenario.scenario),scenario.scenario);
 assert.deepEqual(evidence.ownerPreview,{rows:300,committed:0,ownerSwitchInvalidates:true,databaseUnchanged:true});
 assert.match(evidence.reusedPartial.counts,/300.*مجمّع.*0 مكتمل/);
 assert.match(evidence.reusedPartial.diagnostic,/staged=300.*complete=0.*excluded=ROSTER_LINKS_UNAVAILABLE/);
 assert.deepEqual(evidence.reusedPartial.sourceHashes,evidence.runtimeHashes);
 const currentManifest=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.3.manifest.json','utf8'));
 const currentArchive=await fs.readFile(assets+currentManifest.archive.file);assert.equal(hash(currentArchive),currentManifest.archive.sha256);
 const currentZip=unzipSync(currentArchive);
 for(const [file,sha] of Object.entries(evidence.runtimeHashes)){
  assert.equal(hash(await fs.readFile(dir+file)),sha,file);assert.equal(hash(currentZip[file]),sha,file);
  assert.equal(currentManifest.files.find(f=>f.file===file).sha256,sha,file);
 }
 const baseline=evidence.baselineEvidence;assert.equal(baseline.status,'PASS');
 assert.ok(baseline.history.some(s=>/10 صفحات؛ 300 طلاب؛ 323 صف/.test(s)));
 assert.match(baseline.counts,/11 صفحات؛ 0 طلاب؛ 23 صف/);assert.match(baseline.warning,/EMPTY_OR_LIMIT/);
 assert.match(baseline.diagnostic,/ROSTER_LINKS_UNAVAILABLE.*relevant=2.*unsupported=0.*iframeCount=3/);
 const originalZip=unzipSync(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.1.zip'));
 for(const [file,sha] of Object.entries(baseline.sourceHashes))assert.equal(hash(originalZip[file]),sha,file);
 // Do not erase or promote the failed HTTP-redirect fixture into a successful check.
 assert.ok(evidence.priorFailures.length>0);assert.ok(evidence.priorBlockedExternal.includes('https://vstedu.azureedge.net'));
 assert.match(evidence.networkPolicy,/No HTTP redirects/);
});
